/**
 * @fileoverview Connection Manager Module
 * 
 * This file defines the ConnectionManager, a module responsible for managing
 * HSQLDB connections with pooling, health monitoring, and automatic recovery
 * capabilities using real JDBC connections.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    ConnectionError,
    ConnectionTimeoutError,
    PoolExhaustedError,
    ConnectionLostError,
    ConnectionRetriesExhaustedError,
    HSQLDBError,
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    isRecoverableError
} from '../../errors.js';
import { retry, debounce, resourceCleaner } from '../../utils.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import { JDBCConnectionFactory, type JDBCConnection, type JDBCConnectionConfig } from './JDBCConnectionFactory.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import {
    ModuleEventEmitterImpl,
    ConnectionEvent,
    ModuleEvent,
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';

// Import ReconnectionManager types for coordination
import type { ReconnectionManager } from './ReconnectionManager.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @enum {string}
 * @description Defines the possible states of a connection.
 * @readonly
 */
export enum ConnectionState {
    /** The connection is not established. */
    DISCONNECTED = 'disconnected',
    /** The connection is in the process of being established. */
    CONNECTING = 'connecting',
    /** The connection is established and ready for use. */
    CONNECTED = 'connected',
    /** The connection was lost and is attempting to reconnect. */
    RECONNECTING = 'reconnecting',
    /** The connection is in the process of being closed. */
    CLOSING = 'closing',
    /** The connection has failed and cannot be used. */
    FAILED = 'failed'
}

/**
 * @interface ConnectionConfig
 * @description Defines the configuration for the ConnectionManager.
 */
export interface ConnectionConfig {
    /** The JDBC URL for the HSQLDB database. */
    url: string;
    /** The timeout in milliseconds for establishing a connection. */
    timeoutMs: number;
    /** The maximum number of times to retry a failed connection attempt. */
    maxRetries: number;
    /** The delay in milliseconds between connection retry attempts. */
    retryDelayMs: number;
    /** A flag indicating whether connection pooling is enabled. */
    enablePooling: boolean;
    /** The maximum number of connections allowed in the pool. */
    maxPoolSize: number;
    /** The minimum number of connections to maintain in the pool. */
    minPoolSize: number;
    /** The timeout in milliseconds for idle connections before they are closed. */
    idleTimeoutMs: number;
    /** The interval in milliseconds for performing health checks on connections. */
    healthCheckIntervalMs: number;
    /** A flag indicating whether connections should be read-only. */
    readOnly: boolean;
    /** A flag indicating whether auto-commit should be enabled for connections. */
    autoCommit: boolean;
}

/**
 * @interface ConnectionHealth
 * @description Holds health status information for a single connection.
 */
export interface ConnectionHealth {
    /** A flag indicating if the connection is currently healthy. */
    isHealthy: boolean;
    /** The timestamp of the last health check. */
    lastCheck: Date;
    /** The response time in milliseconds of the last health check. */
    responseTime: number;
    /** The number of consecutive health check failures. */
    consecutiveFailures: number;
    /** An array of recent error messages from health checks. */
    errors: string[];
    /** The response time in milliseconds of the last ping operation. */
    lastPingTime?: number;
}

/**
 * @interface ConnectionStats
 * @description Provides statistics and metrics for the ConnectionManager.
 */
export interface ConnectionStats {
    /** The total number of connections ever created. */
    totalConnections: number;
    /** The number of currently active (healthy and connected) connections. */
    activeConnections: number;
    /** The number of failed connection attempts. */
    failedConnections: number;
    /** The total number of queries executed across all connections. */
    totalQueries: number;
    /** The average response time in milliseconds for operations. */
    averageResponseTime: number;
    /** The uptime of the ConnectionManager in milliseconds. */
    uptime: number;
    /** The current utilization of the connection pool as a percentage (0-100). */
    poolUtilization: number;
    /** The rate of connection failures as a percentage (0-100). */
    failureRate: number;
    /** The maximum number of concurrent connections allowed. */
    maxConcurrentConnections: number;
}

/**
 * @interface PooledJDBCConnection
 * @description Internal interface representing a connection within the pool.
 * @private
 */
interface PooledJDBCConnection {
    /** A unique identifier for the pooled connection. */
    id: string;
    /** The underlying JDBC connection instance. */
    jdbcConnection: JDBCConnection;
    /** The current state of the connection. */
    state: ConnectionState;
    /** The timestamp when the connection was created. */
    created: Date;
    /** The timestamp when the connection was last used. */
    lastUsed: Date;
    /** The number of times this connection has been used. */
    useCount: number;
    /** The health status of the connection. */
    health: ConnectionHealth;
    /** A flag indicating if the connection is currently reserved for use. */
    isReserved: boolean;
}

/**
 * @interface TransactionSession
 * @description Represents a transaction session with a dedicated connection.
 */
interface TransactionSession {
    /** The dedicated JDBC connection for this session. */
    connection: JDBCConnection;
    /** Unique session identifier. */
    sessionId: string;
    /** When the session was created. */
    created: Date;
    /** When the session was last used. */
    lastUsed: Date;
}

// =============================================================================
// CONNECTION MANAGER CLASS
// =============================================================================

/**
 * @class ConnectionManager
 * @description Manages real JDBC connections with pooling, health monitoring,
 * and automatic recovery capabilities using JDBCConnectionFactory.
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<ConnectionEvent>}
 */
export class ConnectionManager implements BaseModule, ModuleEventEmitter<ConnectionEvent> {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'connection-manager';
/**
 * The version of the module.
 * @public
 * @readonly
 * @type {string}
 */
    public readonly version = '1.0.0';
    /** 
     * Indicates whether the module has been initialized.
     * @public
     * @readonly
     * @type {boolean}
     */
    public get isInitialized(): boolean { return this._initialized; }

    /** 
     * @private 
     * @type {boolean}
     */
    private _initialized = false;
    /** 
     * @private 
     * @type {number}
     */
    private lastAutoReconnectionTrigger: number = 0;
    /** 
     * @private 
     * @type {number}
     */
    private readonly autoReconnectionCooldown: number = 10000; // 10 seconds
    /** 
     * @private 
     * @type {HSQLManager | undefined}
     */
    private manager?: HSQLManager;
    /** 
     * @private 
     * @type {ConnectionConfig | undefined}
     */
    private config?: ConnectionConfig;
    /** 
     * @private 
     * @type {JDBCConnectionFactory | undefined}
     */
    private jdbcFactory?: JDBCConnectionFactory;
    /** 
     * @private 
     * @type {Map<string, PooledJDBCConnection>}
     */
    private connectionPool: Map<string, PooledJDBCConnection> = new Map();
    /** 
     * @private 
     * @type {Map<string, TransactionSession>}
     */
    private transactionSessions: Map<string, TransactionSession> = new Map();
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private healthCheckTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private cleanupTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {boolean}
     */
    private destroyed = false;
    /** 
     * @private 
     * @readonly
     * @type {number}
     */
    private readonly startTime = Date.now();
    /** 
     * @private 
     * @type {ModuleLogger}
     */
    private logger: ModuleLogger;
    /** 
     * @private 
     * @type {ModuleEventEmitterImpl<ConnectionEvent>}
     */
    private eventEmitter: ModuleEventEmitterImpl<ConnectionEvent>;
    /** 
     * @private 
     * @type {ConnectionStats}
     */
    private stats: ConnectionStats = {
        totalConnections: 0,
        activeConnections: 0,
        failedConnections: 0,
        totalQueries: 0,
        averageResponseTime: 0,
        uptime: 0,
        poolUtilization: 0,
        failureRate: 0,
        maxConcurrentConnections: 0
    };

    /**
     * Creates a new instance of the ConnectionManager.
     */
    constructor() {
        this.logger = createModuleLogger('ConnectionManager-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'ConnectionManager');
    }

    /**
     * Initializes the connection manager. This sets up the configuration,
     * initializes the JDBC factory, creates the initial connection pool, and
     * starts monitoring and recovery processes.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the provided manager is invalid.
     * @throws {ConnectionError} If the JDBC factory or connection pool fails to initialize.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('ConnectionManager', {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing ConnectionManager v1.0 with real JDBC connections and ReconnectionManager integration', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();

        // Initialize JDBC factory
        await this.initializeJDBCFactory();

        // Initialize connection pool with real JDBC connections
        await this.initializeRealPool();

        // Start health monitoring and cleanup
        this.startHealthMonitoring();
        this.startCleanupTimer();

        // Setup ReconnectionManager integration
        await this.setupReconnectionIntegration();

        this._initialized = true;
        resourceCleaner.register(this);

        this.logger.info('ConnectionManager v1.0 initialized successfully with ReconnectionManager integration', {
            operation: 'initialize-complete',
            poolSize: this.connectionPool.size,
            enablePooling: this.config?.enablePooling,
            autoReconnectionEnabled: this.isAutoReconnectionEnabled()
        });

        // Emit pool created event
        this.emit(ConnectionEvent.POOL_CREATED, createEventData('pool-created', {
            poolSize: this.connectionPool.size,
            maxSize: this.config?.maxPoolSize,
            minSize: this.config?.minPoolSize,
            enablePooling: this.config?.enablePooling,
            autoReconnectionEnabled: this.isAutoReconnectionEnabled()
        }, this.name));
    }

    /**
     * Checks if auto-reconnection is enabled in the HSQLManager configuration.
     * @private
     * @returns {boolean} True if auto-reconnection is enabled, false otherwise.
     */
    private isAutoReconnectionEnabled(): boolean {
        if (!this.manager) return false;

        const config = this.manager.getConfiguration();
        return config.modules.enableAutoReconnection === true;
    }

    /**
     * Sets up integration with the ReconnectionManager module by listening for its events.
     * @private
     * @async
     */
    private async setupReconnectionIntegration(): Promise<void> {
        if (!this.isAutoReconnectionEnabled()) {
            this.logger.debug('Auto-reconnection disabled, skipping ReconnectionManager integration', {
                operation: 'setup-reconnection-integration'
            });
            return;
        }

        // Give some time for ReconnectionManager to be initialized by HSQLManager
        setTimeout(() => {
            const reconnectionManager = this.manager?.getModule<ReconnectionManager>('reconnection-manager');
            if (reconnectionManager?.isInitialized) {
                this.logger.info('Setting up ReconnectionManager integration', {
                    operation: 'setup-reconnection-integration',
                    reconnectionManagerVersion: reconnectionManager.version
                });

                // Listen for reconnection success events
                reconnectionManager.on('reconnect-success' as any, () => {
                    this.logger.info('Reconnection successful, refreshing connection pool', {
                        operation: 'reconnection-success-handler'
                    });

                    // Refresh unhealthy connections after successful reconnection
                    this.refreshUnhealthyConnections().catch(error => {
                        this.logger.warn('Failed to refresh connections after reconnection', {
                            operation: 'refresh-after-reconnection-error',
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                });

                // Listen for circuit breaker events
                reconnectionManager.on('circuit-breaker-opened' as any, () => {
                    this.logger.warn('ReconnectionManager circuit breaker opened', {
                        operation: 'circuit-breaker-opened-handler'
                    });
                });

                reconnectionManager.on('circuit-breaker-closed' as any, () => {
                    this.logger.info('ReconnectionManager circuit breaker closed', {
                        operation: 'circuit-breaker-closed-handler'
                    });
                });

                this.logger.info('ReconnectionManager integration setup complete', {
                    operation: 'setup-reconnection-integration-complete'
                });
            } else {
                this.logger.debug('ReconnectionManager not available for integration', {
                    operation: 'setup-reconnection-integration',
                    hasReconnectionManager: !!reconnectionManager,
                    isInitialized: reconnectionManager?.isInitialized
                });
            }
        }, 100); // Small delay to ensure ReconnectionManager is initialized
    }

    /**
     * Refreshes unhealthy connections in the pool, typically after a successful reconnection.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    private async refreshUnhealthyConnections(): Promise<void> {
        if (this.destroyed || !this.config?.enablePooling) {
            return;
        }

        const unhealthyConnections: string[] = [];

        // Identify unhealthy connections
        for (const [connectionId, connection] of this.connectionPool.entries()) {
            if (!connection.health.isHealthy || connection.state === ConnectionState.FAILED) {
                unhealthyConnections.push(connectionId);
            }
        }

        if (unhealthyConnections.length === 0) {
            this.logger.debug('No unhealthy connections to refresh', {
                operation: 'refresh-unhealthy-connections'
            });
            return;
        }

        this.logger.info('Refreshing unhealthy connections after successful reconnection', {
            operation: 'refresh-unhealthy-connections',
            unhealthyCount: unhealthyConnections.length,
            totalConnections: this.connectionPool.size
        });

        // Close and remove unhealthy connections
        for (const connectionId of unhealthyConnections) {
            const connection = this.connectionPool.get(connectionId);
            if (connection && !connection.isReserved) {
                try {
                    await connection.jdbcConnection.close();
                    this.connectionPool.delete(connectionId);
                    this.stats.activeConnections--;

                    this.logger.debug('Removed unhealthy connection', {
                        operation: 'remove-unhealthy-connection',
                        connectionId,
                        jdbcConnectionId: connection.jdbcConnection.id
                    });
                } catch (error) {
                    this.logger.warn('Failed to close unhealthy connection during refresh', {
                        operation: 'close-unhealthy-connection-error',
                        connectionId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }

        // Try to create new healthy connections to maintain minimum pool size
        const currentPoolSize = this.connectionPool.size;
        const neededConnections = Math.max(0, this.config.minPoolSize - currentPoolSize);

        if (neededConnections > 0) {
            this.logger.info('Creating new connections to maintain minimum pool size', {
                operation: 'create-replacement-connections',
                neededConnections,
                currentPoolSize,
                minPoolSize: this.config.minPoolSize
            });

            const createPromises: Promise<void>[] = [];
            for (let i = 0; i < neededConnections; i++) {
                createPromises.push(
                    this.createRealPoolConnection()
                        .then(() => { })
                        .catch(error => {
                            this.logger.warn('Failed to create replacement connection', {
                                operation: 'create-replacement-connection-error',
                                error: error instanceof Error ? error.message : String(error)
                            });
                        })
                );
            }

            await Promise.allSettled(createPromises);
        }

        this.logger.info('Connection refresh completed', {
            operation: 'refresh-unhealthy-connections-complete',
            removedConnections: unhealthyConnections.length,
            newPoolSize: this.connectionPool.size
        });
    }

    /**
     * Triggers the automatic reconnection process via the ReconnectionManager if conditions are met.
     * @private
     * @async
     * @param {string} reason - The reason for triggering the reconnection.
     * @param {any} [context={}] - Additional context for logging.
     */
    private async triggerAutoReconnection(reason: string, context: any = {}): Promise<void> {
        if (!this.isAutoReconnectionEnabled()) {
            return;
        }

        // Check cooldown to prevent spam
        const now = Date.now();
        if (now - this.lastAutoReconnectionTrigger < this.autoReconnectionCooldown) {
            this.logger.debug('Auto-reconnection request ignored due to cooldown', {
                operation: 'trigger-auto-reconnection-cooldown',
                reason,
                cooldownRemaining: this.autoReconnectionCooldown - (now - this.lastAutoReconnectionTrigger),
                context
            });
            return;
        }

        const reconnectionManager = this.manager?.getModule<ReconnectionManager>('reconnection-manager');
        if (!reconnectionManager?.isInitialized) {
            this.logger.warn('ReconnectionManager not available for auto-reconnection', {
                operation: 'trigger-auto-reconnection-unavailable',
                reason,
                hasReconnectionManager: !!reconnectionManager,
                isInitialized: reconnectionManager?.isInitialized,
                context
            });
            return;
        }

        this.lastAutoReconnectionTrigger = now;

        this.logger.warn('Triggering automatic reconnection due to connection issues', {
            operation: 'trigger-auto-reconnection',
            reason,
            context
        });

        try {
            const success = await reconnectionManager.triggerReconnection();

            if (success) {
                this.logger.info('Auto-reconnection completed successfully', {
                    operation: 'auto-reconnection-success',
                    reason
                });
            } else {
                this.logger.warn('Auto-reconnection completed but was not successful', {
                    operation: 'auto-reconnection-failed',
                    reason
                });
            }
        } catch (error) {
            this.logger.error('Auto-reconnection failed with error', {
                operation: 'auto-reconnection-error',
                reason,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Builds the connection manager's configuration from the HSQLManager's settings.
     * @private
     * @throws {ConfigurationError} If the manager reference is not set.
     */
    private buildConfiguration(): void {
        if (!this.manager) {
            throw new ConfigurationError('Manager not set', ['manager'], {
                operation: 'build-config'
            });
        }

        const managerConfig = this.manager.getConfiguration();

        this.config = {
            url: this.manager.getDatabaseUrl(),
            timeoutMs: managerConfig.connection.timeoutMs!,
            maxRetries: managerConfig.connection.maxRetries!,
            retryDelayMs: 1000,
            enablePooling: managerConfig.connection.maxConcurrentConnections! > 1,
            maxPoolSize: Math.min(managerConfig.connection.maxConcurrentConnections!, 3), // Reduced pool size
            minPoolSize: Math.max(1, Math.min(1, managerConfig.connection.maxConcurrentConnections! / 3)), // Reduced minimum pool size
            idleTimeoutMs: 60000, // Reduced to 1 minute
            healthCheckIntervalMs: 30000, // Reduced to 30 seconds
            readOnly: managerConfig.connection.readOnly!,
            autoCommit: managerConfig.connection.autoCommit!
        };

        this.logger.debug('Configuration built for real JDBC connections with auto-reconnection support', {
            operation: 'build-config',
            config: this.config,
            autoReconnectionEnabled: this.isAutoReconnectionEnabled()
        });
    }

    /**
     * Initializes the underlying JDBC connection factory.
     * @private
     * @async
     * @throws {ConfigurationError} If the manager reference is not set.
     * @throws {ConnectionError} If the factory fails to initialize.
     */
    private async initializeJDBCFactory(): Promise<void> {
        if (!this.manager) {
            throw new ConfigurationError('Manager not set', ['manager'], {
                operation: 'jdbc-factory-init'
            });
        }

        try {
            this.jdbcFactory = new JDBCConnectionFactory();
            await this.jdbcFactory.initialize(this.manager);

            this.logger.info('JDBC Connection Factory initialized', {
                operation: 'jdbc-factory-init',
                factoryVersion: this.jdbcFactory.version
            });
        } catch (error) {
            this.logger.error('Failed to initialize JDBC factory', {
                operation: 'jdbc-factory-init-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new ConnectionError(
                `JDBC factory initialization failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Initializes the connection pool with the configured minimum number of connections.
     * @private
     * @async
     * @throws {ConnectionError} If the pool fails to initialize.
     */
    private async initializeRealPool(): Promise<void> {
        if (!this.config?.enablePooling) {
            this.logger.info('Connection pooling disabled, using direct connections', {
                operation: 'pool-init'
            });
            return;
        }

        this.logger.info('Initializing real JDBC connection pool', {
            operation: 'pool-init',
            minSize: this.config.minPoolSize,
            maxSize: this.config.maxPoolSize
        });

        try {
            // Create minimum pool connections using JDBC factory
            const initPromises: Promise<void>[] = [];
            for (let i = 0; i < this.config.minPoolSize; i++) {
                initPromises.push(this.createRealPoolConnection().then(() => { }));
            }

            await Promise.all(initPromises);

            this.logger.info('Real JDBC connection pool initialized', {
                operation: 'pool-init-complete',
                actualSize: this.connectionPool.size,
                targetSize: this.config.minPoolSize
            });

        } catch (error) {
            this.logger.error('Failed to initialize real connection pool', {
                operation: 'pool-init-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new ConnectionError(
                `Real pool initialization failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Creates a new pooled JDBC connection and adds it to the pool.
     * @private
     * @async
     * @returns {Promise<string>} The ID of the newly created connection.
     * @throws {ConfigurationError} If configuration or JDBC factory is not set.
     * @throws {ConnectionError} If connection creation fails.
     */
    private async createRealPoolConnection(): Promise<string> {
        if (!this.config || !this.jdbcFactory) {
            throw new ConfigurationError('Configuration or JDBC factory not set', ['config', 'jdbcFactory'], {
                operation: 'create-pool-connection',
                hasConfig: !!this.config,
                hasJdbcFactory: !!this.jdbcFactory
            });
        }

        const connectionId = `pool_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        this.logger.debug('Creating real JDBC pooled connection', {
            operation: 'create-pool-connection',
            connectionId
        });

        try {
            // Create real JDBC connection using factory
            const jdbcConnection = await this.jdbcFactory.createConnectionFromManager();

            const pooledConnection: PooledJDBCConnection = {
                id: connectionId,
                jdbcConnection,
                state: ConnectionState.CONNECTED,
                created: new Date(),
                lastUsed: new Date(),
                useCount: 0,
                isReserved: false,
                health: {
                    isHealthy: true,
                    lastCheck: new Date(),
                    responseTime: 0,
                    consecutiveFailures: 0,
                    errors: []
                }
            };

            this.connectionPool.set(connectionId, pooledConnection);
            this.stats.totalConnections++;
            this.stats.activeConnections++;

            this.logger.debug('Real JDBC pooled connection created', {
                operation: 'create-pool-connection-complete',
                connectionId,
                jdbcConnectionId: jdbcConnection.id
            });

            // Emit connection created event
            this.emit(ConnectionEvent.CONNECTED, createEventData('connection-created', {
                connectionId,
                jdbcConnectionId: jdbcConnection.id,
                poolSize: this.connectionPool.size
            }, this.name));

            return connectionId;

        } catch (error) {
            this.stats.failedConnections++;

            this.logger.error('Failed to create real JDBC pooled connection', {
                operation: 'create-pool-connection-error',
                connectionId,
                error: error instanceof Error ? error.message : String(error)
            });

            // AUTO-RECONNECTION TRIGGER: Multiple connection creation failures
            if (this.stats.failedConnections > 2) {
                await this.triggerAutoReconnection('multiple-connection-failures', {
                    failedConnections: this.stats.failedConnections,
                    totalConnections: this.stats.totalConnections
                });
            }

            throw new ConnectionError(
                `Failed to create real JDBC connection: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId }
            );
        }
    }

    /**
     * Retrieves a JDBC connection. If pooling is enabled, it will attempt to reuse
     * an available connection from the pool or create a new one if space is available.
     * If the pool is full, it will wait for a connection to become available.
     * @async
     * @returns {Promise<JDBCConnection>} A ready-to-use JDBC connection.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     * @throws {ConnectionError} If creating a new connection fails.
     * @throws {ConnectionTimeoutError} If waiting for a connection times out.
     */
    public async getConnection(): Promise<JDBCConnection> {
        if (!this._initialized || this.destroyed) {
            throw new ModuleNotInitializedError('ConnectionManager', 'get connection', {
                operation: 'get-connection',
                destroyed: this.destroyed
            });
        }

        this.logger.debug('Getting real JDBC connection', {
            operation: 'get-connection',
            pooling: this.config?.enablePooling,
            poolSize: this.connectionPool.size
        });

        if (!this.config?.enablePooling) {
            // Create direct connection
            return await this.createDirectJDBCConnection();
        }

        // Try to get a healthy connection from the pool
        const availableConnection = this.findAvailablePooledConnection();
        if (availableConnection) {
            // Validate connection before returning it
            if (await this.validateConnectionBeforeUse(availableConnection)) {
                availableConnection.lastUsed = new Date();
                availableConnection.useCount++;
                availableConnection.isReserved = true;

                this.logger.debug('Reusing pooled JDBC connection', {
                    operation: 'reuse-connection',
                    connectionId: availableConnection.id,
                    jdbcConnectionId: availableConnection.jdbcConnection.id
                });

                // Emit connection acquired event
                this.emit(ConnectionEvent.CONNECTION_ACQUIRED, createEventData('connection-acquired', {
                    connectionId: availableConnection.id,
                    jdbcConnectionId: availableConnection.jdbcConnection.id,
                    fromPool: true,
                    poolUtilization: this.getStats().poolUtilization
                }, this.name));

                return availableConnection.jdbcConnection;
            } else {
                // Connection is not valid, remove it and try to create a new one
                this.removeInvalidConnection(availableConnection);
            }
        }

        // Create new connection if pool has capacity
        if (this.connectionPool.size < this.config.maxPoolSize) {
            const connectionId = await this.createRealPoolConnection();
            const pooledConnection = this.connectionPool.get(connectionId)!;
            pooledConnection.isReserved = true;

            // Emit connection acquired event for new connections
            this.emit(ConnectionEvent.CONNECTION_ACQUIRED, createEventData('connection-acquired', {
                connectionId: pooledConnection.id,
                jdbcConnectionId: pooledConnection.jdbcConnection.id,
                fromPool: false,
                poolUtilization: this.getStats().poolUtilization
            }, this.name));

            return pooledConnection.jdbcConnection;
        }

        // Pool is full, wait for available connection
        return await this.waitForAvailableJDBCConnection();
    }

    /**
     * Gets a connection for a transaction session - ensures same connection is used
     * @deprecated This method is no longer needed with the refactored TransactionManager v2.0
     * @async
     * @param {string} [sessionId] - Optional session identifier for transaction continuity
     * @returns {Promise<{connection: JDBCConnection, sessionId: string}>} Connection with session info
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     * @throws {ConnectionError} If creating a new connection fails.
     * @throws {ConnectionTimeoutError} If waiting for a connection times out.
     */
    public async getTransactionConnection(sessionId?: string): Promise<{ connection: JDBCConnection, sessionId: string }> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ConnectionManager', 'get transaction connection', {
                operation: 'get-transaction-connection'
            });
        }

        this.logger.warn('getTransactionConnection is deprecated - use getConnection() directly', {
            operation: 'get-transaction-connection-deprecated',
            sessionId,
            reason: 'TransactionManager v2.0 uses simplified connection management'
        });

        // Fallback to regular connection for compatibility
        const connection = await this.getConnection();
        const newSessionId = sessionId || `tx_legacy_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        this.logger.debug('Created legacy transaction session for compatibility', {
            operation: 'create-legacy-transaction-session',
            sessionId: newSessionId,
            jdbcConnectionId: connection.id
        });

        return { connection, sessionId: newSessionId };
    }

    /**
     * Releases a transaction session and its connection
     * @deprecated This method is no longer needed with the refactored TransactionManager v2.0
     * @async
     * @param {string} sessionId - The session identifier
     * @returns {Promise<void>}
     */
    public async releaseTransactionSession(sessionId: string): Promise<void> {
        this.logger.warn('releaseTransactionSession is deprecated - use releaseConnection() directly', {
            operation: 'release-transaction-session-deprecated',
            sessionId,
            reason: 'TransactionManager v2.0 uses simplified connection management'
        });

        // For backward compatibility, this method now does nothing
        // since the refactored TransactionManager handles connections directly
    }

    /**
     * Finds an available, healthy, and unreserved connection in the pool.
     * @private
     * @returns {PooledJDBCConnection | undefined} An available connection, or undefined if none is found.
     */
    private findAvailablePooledConnection(): PooledJDBCConnection | undefined {
        for (const connection of this.connectionPool.values()) {
            if (connection.state === ConnectionState.CONNECTED &&
                connection.health.isHealthy &&
                !connection.isReserved) {

                this.logger.debug('Found available pooled connection', {
                    operation: 'find-available-connection',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    useCount: connection.useCount,
                    lastUsed: connection.lastUsed
                });

                return connection;
            }
        }

        this.logger.debug('No available pooled connections found', {
            operation: 'find-available-connection',
            totalConnections: this.connectionPool.size,
            reservedConnections: Array.from(this.connectionPool.values()).filter(c => c.isReserved).length,
            healthyConnections: Array.from(this.connectionPool.values()).filter(c => c.health.isHealthy).length,
            connectedConnections: Array.from(this.connectionPool.values()).filter(c => c.state === ConnectionState.CONNECTED).length
        });

        return undefined;
    }

    /**
     * Creates a direct, non-pooled JDBC connection.
     * @private
     * @async
     * @returns {Promise<JDBCConnection>} A new direct JDBC connection.
     * @throws {ConfigurationError} If the JDBC factory is not initialized.
     * @throws {ConnectionError} If connection creation fails.
     */
    private async createDirectJDBCConnection(): Promise<JDBCConnection> {
        if (!this.jdbcFactory) {
            throw new ConfigurationError('JDBC factory not initialized', ['jdbcFactory'], {
                operation: 'create-direct-connection'
            });
        }

        try {
            const jdbcConnection = await this.jdbcFactory.createConnectionFromManager();

            this.stats.totalConnections++;
            this.stats.activeConnections++;

            this.logger.debug('Created direct JDBC connection', {
                operation: 'create-direct-connection',
                jdbcConnectionId: jdbcConnection.id
            });

            return jdbcConnection;

        } catch (error) {
            this.stats.failedConnections++;

            this.logger.error('Failed to create direct JDBC connection', {
                operation: 'create-direct-connection-error',
                error: error instanceof Error ? error.message : String(error)
            });

            // AUTO-RECONNECTION TRIGGER: Direct connection failure
            await this.triggerAutoReconnection('direct-connection-failure', {
                error: error instanceof Error ? error.message : String(error)
            });

            throw new ConnectionError(
                `Failed to create direct JDBC connection: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Waits for a connection to become available in the pool, with a timeout.
     * @private
     * @async
     * @returns {Promise<JDBCConnection>} A promise that resolves with an available JDBC connection.
     * @throws {ConnectionTimeoutError} If the wait times out.
     * @throws {ConnectionError} If the manager is destroyed while waiting.
     */
    private async waitForAvailableJDBCConnection(): Promise<JDBCConnection> {
        const timeoutMs = this.config?.timeoutMs || 15000; // Use config or default to 15 seconds
        const startTime = Date.now();

        this.logger.debug('Waiting for available JDBC connection', {
            operation: 'wait-connection',
            timeoutMs,
            poolSize: this.connectionPool.size,
            maxPoolSize: this.config?.maxPoolSize
        });

        return new Promise((resolve, reject) => {
            let timeoutHandle: NodeJS.Timeout;
            let checkInterval: NodeJS.Timeout;

            const cleanup = () => {
                if (checkInterval) clearInterval(checkInterval);
                if (timeoutHandle) clearTimeout(timeoutHandle);
            };

            const checkForConnection = () => {
                // Check if we're destroyed
                if (this.destroyed) {
                    cleanup();
                    reject(new ConnectionError('Connection manager destroyed while waiting'));
                    return;
                }

                const connection = this.findAvailablePooledConnection();
                if (connection) {
                    cleanup();
                    connection.lastUsed = new Date();
                    connection.useCount++;
                    connection.isReserved = true;

                    this.logger.debug('Found available connection after waiting', {
                        operation: 'wait-connection-found',
                        connectionId: connection.id,
                        jdbcConnectionId: connection.jdbcConnection.id,
                        waitTime: Date.now() - startTime
                    });

                    // Emit connection acquired event
                    this.emit(ConnectionEvent.CONNECTION_ACQUIRED, createEventData('connection-acquired', {
                        connectionId: connection.id,
                        jdbcConnectionId: connection.jdbcConnection.id,
                        fromPool: true,
                        poolUtilization: this.getStats().poolUtilization
                    }, this.name));

                    resolve(connection.jdbcConnection);
                    return;
                }

                // Check timeout
                if (Date.now() - startTime > timeoutMs) {
                    cleanup();

                    this.logger.warn('Connection wait timeout', {
                        operation: 'wait-connection-timeout',
                        waitTime: Date.now() - startTime,
                        poolSize: this.connectionPool.size,
                        reservedConnections: Array.from(this.connectionPool.values()).filter(c => c.isReserved).length
                    });

                    // Force release stale connections that have been reserved for too long
                    this.forceReleaseStaleConnections();

                    // AUTO-RECONNECTION TRIGGER: Connection wait timeout (pool exhaustion)
                    this.triggerAutoReconnection('connection-wait-timeout', {
                        timeoutMs,
                        poolSize: this.connectionPool.size,
                        maxPoolSize: this.config?.maxPoolSize,
                        reservedConnections: Array.from(this.connectionPool.values()).filter(c => c.isReserved).length
                    }).catch(() => { }); // Don't wait for this

                    reject(new PoolExhaustedError(timeoutMs, this.connectionPool.size, this.config?.maxPoolSize || 0, {
                        reservedConnections: Array.from(this.connectionPool.values()).filter(c => c.isReserved).length
                    }));
                }
            };

            // Initial check
            checkForConnection();

            // Set up periodic checking with improved frequency
            checkInterval = setInterval(checkForConnection, 50); // Check every 50ms

            // Set up timeout handler as backup
            timeoutHandle = setTimeout(() => {
                cleanup();
                reject(new PoolExhaustedError(timeoutMs, this.connectionPool.size, this.config?.maxPoolSize || 0, {
                    reservedConnections: Array.from(this.connectionPool.values()).filter(c => c.isReserved).length
                }));
            }, timeoutMs);
        });
    }

    /**
     * Force release connections that have been reserved for too long.
     * @private
     */
    private forceReleaseStaleConnections(): void {
        const now = Date.now();
        const staleThreshold = 45000; // 45 seconds - increased from 30 for more stability
        let staleCount = 0;

        for (const connection of this.connectionPool.values()) {
            if (connection.isReserved && (now - connection.lastUsed.getTime()) > staleThreshold) {
                // Validate connection before releasing
                connection.jdbcConnection.ping().then(isHealthy => {
                    if (isHealthy) {
                        connection.isReserved = false;
                        connection.lastUsed = new Date();
                        staleCount++;

                        this.logger.warn('Force released stale but healthy connection', {
                            operation: 'force-release-stale',
                            connectionId: connection.id,
                            jdbcConnectionId: connection.jdbcConnection.id,
                            staleTime: now - connection.lastUsed.getTime()
                        });
                    } else {
                        // Connection is unhealthy, mark for removal
                        connection.state = ConnectionState.FAILED;
                        connection.health.isHealthy = false;
                        connection.isReserved = false;
                        
                        this.logger.warn('Force released stale unhealthy connection', {
                            operation: 'force-release-stale-unhealthy',
                            connectionId: connection.id,
                            jdbcConnectionId: connection.jdbcConnection.id,
                            staleTime: now - connection.lastUsed.getTime()
                        });
                    }
                }).catch(error => {
                    // Ping failed, mark as unhealthy and release
                    connection.state = ConnectionState.FAILED;
                    connection.health.isHealthy = false;
                    connection.isReserved = false;
                    
                    this.logger.warn('Force released stale connection with ping error', {
                        operation: 'force-release-stale-ping-error',
                        connectionId: connection.id,
                        jdbcConnectionId: connection.jdbcConnection.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                });
            }
        }

        if (staleCount > 0) {
            this.logger.info('Force released stale connections', {
                operation: 'force-release-stale-complete',
                staleConnectionsReleased: staleCount,
                totalConnections: this.connectionPool.size
            });
        }
    }

    /**
     * Releases a JDBC connection. If pooling is enabled, the connection is returned
     * to the pool. If pooling is disabled, the connection is closed.
     * @async
     * @param {JDBCConnection} jdbcConnection - The JDBC connection to release.
     * @returns {Promise<void>} A promise that resolves when the connection is released.
     */
    public async releaseConnection(jdbcConnection: JDBCConnection): Promise<void> {
        if (!jdbcConnection) {
            this.logger.warn('Attempted to release null/undefined connection', {
                operation: 'release-connection-null'
            });
            return;
        }

        if (!this.config?.enablePooling) {
            // For direct connections, just close them
            try {
                await jdbcConnection.close();
                this.stats.activeConnections--;

                // Emit disconnection event for direct connection
                this.emit(ConnectionEvent.DISCONNECTED, createEventData('connection-closed', {
                    jdbcConnectionId: jdbcConnection.id,
                    connectionType: 'direct'
                }, this.name));
            } catch (error) {
                this.logger.warn('Error closing direct connection', {
                    operation: 'release-direct-connection',
                    jdbcConnectionId: jdbcConnection.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            return;
        }

        // Find the pooled connection by JDBC connection ID
        let connectionFound = false;
        for (const pooledConnection of this.connectionPool.values()) {
            if (pooledConnection.jdbcConnection.id === jdbcConnection.id) {
                connectionFound = true;
                
                // Validate connection before returning to pool
                const isValid = await this.validateConnectionBeforeUse(pooledConnection);
                if (isValid) {
                    pooledConnection.lastUsed = new Date();
                    pooledConnection.isReserved = false; // This is crucial!

                    this.logger.debug('Released JDBC connection back to pool', {
                        operation: 'release-connection',
                        connectionId: pooledConnection.id,
                        jdbcConnectionId: jdbcConnection.id,
                        wasReserved: true
                    });

                    // Emit connection released event
                    this.emit(ConnectionEvent.CONNECTION_RELEASED, createEventData('connection-released', {
                        connectionId: pooledConnection.id,
                        jdbcConnectionId: jdbcConnection.id,
                        useCount: pooledConnection.useCount,
                        poolSize: this.connectionPool.size
                    }, this.name));
                } else {
                    // Connection is invalid, remove it from pool
                    this.removeInvalidConnection(pooledConnection);
                    
                    this.logger.debug('Removed invalid connection during release', {
                        operation: 'release-invalid-connection',
                        connectionId: pooledConnection.id,
                        jdbcConnectionId: jdbcConnection.id
                    });
                }
                return;
            }
        }

        if (!connectionFound) {
            this.logger.warn('Attempted to release unknown JDBC connection', {
                operation: 'release-connection-unknown',
                jdbcConnectionId: jdbcConnection.id,
                poolSize: this.connectionPool.size
            });
            
            // Try to close the unknown connection anyway to prevent leaks
            try {
                await jdbcConnection.close();
            } catch (error) {
                this.logger.debug('Error closing unknown connection', {
                    operation: 'close-unknown-connection',
                    jdbcConnectionId: jdbcConnection.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Starts the periodic health monitoring of connections in the pool.
     * @private
     */
    private startHealthMonitoring(): void {
        if (!this.config?.healthCheckIntervalMs) {
            return;
        }

        this.healthCheckTimer = setInterval(
            () => this.performRealHealthChecks(),
            this.config.healthCheckIntervalMs
        );

        this.logger.debug('Health monitoring started for real JDBC connections with auto-reconnection support', {
            operation: 'start-health-monitoring',
            interval: this.config.healthCheckIntervalMs,
            autoReconnectionEnabled: this.isAutoReconnectionEnabled()
        });
    }

    /**
     * Performs health checks on all connections in the pool and triggers auto-reconnection if necessary.
     * @private
     * @async
     */
    private async performRealHealthChecks(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.debug('Performing real health checks with auto-reconnection support', {
            operation: 'health-check',
            connectionCount: this.connectionPool.size
        });

        const healthPromises = Array.from(this.connectionPool.values()).map(connection =>
            this.checkRealConnectionHealth(connection).catch(error => {
                this.logger.warn('Health check failed for real JDBC connection', {
                    operation: 'health-check-error',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            })
        );

        await Promise.allSettled(healthPromises);
        this.updateRealStats();

        // Count healthy connections
        const connections = Array.from(this.connectionPool.values());
        const healthyConnections = connections.filter(conn => conn.health.isHealthy).length;
        const totalConnections = connections.length;

        // Emit health check events
        if (healthyConnections === totalConnections && totalConnections > 0) {
            this.emit(ConnectionEvent.HEALTH_CHECK_PASSED, createEventData('health-check-passed', {
                totalConnections,
                healthyConnections
            }, this.name));
        } else if (totalConnections > 0) {
            this.emit(ConnectionEvent.HEALTH_CHECK_FAILED, createEventData('health-check-failed', {
                totalConnections,
                healthyConnections,
                unhealthyConnections: totalConnections - healthyConnections
            }, this.name));

            // AUTO-RECONNECTION TRIGGER: All connections are unhealthy
            if (healthyConnections === 0 && totalConnections > 0) {
                await this.triggerAutoReconnection('all-connections-unhealthy', {
                    totalConnections,
                    healthyConnections,
                    unhealthyConnections: totalConnections - healthyConnections
                });
            }
            // AUTO-RECONNECTION TRIGGER: High failure rate (>80% unhealthy)
            else if (totalConnections > 1 && (healthyConnections / totalConnections) < 0.2) {
                await this.triggerAutoReconnection('high-failure-rate', {
                    totalConnections,
                    healthyConnections,
                    unhealthyConnections: totalConnections - healthyConnections,
                    failureRate: ((totalConnections - healthyConnections) / totalConnections * 100).toFixed(1) + '%'
                });
            }
        }
    }

    /**
     * Performs a health check on a single pooled JDBC connection.
     * @private
     * @async
     * @param {PooledJDBCConnection} connection - The connection to check.
     */
    private async checkRealConnectionHealth(connection: PooledJDBCConnection): Promise<void> {
        const startTime = Date.now();

        // Skip health check if connection is currently reserved and recently used
        if (connection.isReserved && (Date.now() - connection.lastUsed.getTime()) < 5000) {
            // Connection is actively being used, skip health check
            return;
        }

        try {
            // Use real JDBC connection ping() method
            const isHealthy = await connection.jdbcConnection.ping();

            connection.health.isHealthy = isHealthy;
            connection.health.lastCheck = new Date();
            connection.health.responseTime = Date.now() - startTime;
            connection.health.lastPingTime = connection.health.responseTime;

            if (isHealthy) {
                connection.health.consecutiveFailures = 0;
                // Only update state if not currently in use
                if (!connection.isReserved) {
                    connection.state = ConnectionState.CONNECTED;
                }
            } else {
                connection.health.consecutiveFailures++;
                this.logger.warn('JDBC connection ping failed', {
                    operation: 'ping-failed',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    consecutiveFailures: connection.health.consecutiveFailures
                });
                
                // Mark as failed if too many consecutive failures and not in use
                if (connection.health.consecutiveFailures >= 3 && !connection.isReserved) {
                    connection.state = ConnectionState.FAILED;
                }
            }

        } catch (error) {
            connection.health.isHealthy = false;
            connection.health.lastCheck = new Date();
            connection.health.consecutiveFailures++;
            connection.health.errors.push(error instanceof Error ? error.message : String(error));

            // Keep only last 10 errors
            if (connection.health.errors.length > 10) {
                connection.health.errors = connection.health.errors.slice(-10);
            }

            // Mark connection as failed if too many consecutive failures and not currently in use
            if (connection.health.consecutiveFailures >= 3 && !connection.isReserved) {
                connection.state = ConnectionState.FAILED;
                this.logger.warn('JDBC connection marked as failed', {
                    operation: 'connection-failed',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    consecutiveFailures: connection.health.consecutiveFailures
                });
            }
        }
    }

    /**
     * Starts the periodic cleanup of idle connections in the pool.
     * @private
     */
    private startCleanupTimer(): void {
        if (!this.config?.idleTimeoutMs) {
            return;
        }

        this.cleanupTimer = setInterval(
            () => this.cleanupIdleConnections(),
            this.config.idleTimeoutMs / 2 // Check twice as often as timeout
        );
        if (typeof this.cleanupTimer.unref === 'function') {
            this.cleanupTimer.unref();
        }

        this.logger.debug('Cleanup timer started for idle connections', {
            operation: 'start-cleanup',
            idleTimeout: this.config.idleTimeoutMs
        });
    }

    /**
     * Closes idle connections in the pool to maintain the minimum pool size.
     * @private
     * @async
     */
    private async cleanupIdleConnections(): Promise<void> {
        if (this.destroyed || !this.config) {
            return;
        }

        const now = Date.now();
        const idleThreshold = now - this.config.idleTimeoutMs;
        const connectionsToRemove: string[] = [];

        for (const [connectionId, connection] of this.connectionPool.entries()) {
            if (!connection.isReserved &&
                connection.lastUsed.getTime() < idleThreshold &&
                this.connectionPool.size > this.config.minPoolSize) {
                connectionsToRemove.push(connectionId);
            }
        }

        if (connectionsToRemove.length > 0) {
            this.logger.debug('Cleaning up idle JDBC connections', {
                operation: 'cleanup-idle',
                connectionsToRemove: connectionsToRemove.length,
                totalConnections: this.connectionPool.size
            });

            // Clean up failed connections that are not reserved
            const failedConnectionsToRemove: string[] = [];
            for (const [connectionId, connection] of this.connectionPool.entries()) {
                if (connection.state === ConnectionState.FAILED && !connection.isReserved) {
                    failedConnectionsToRemove.push(connectionId);
                }
            }

            // Remove failed connections first
            for (const connectionId of failedConnectionsToRemove) {
                const connection = this.connectionPool.get(connectionId);
                if (connection) {
                    try {
                        await connection.jdbcConnection.close();
                        this.connectionPool.delete(connectionId);
                        this.stats.activeConnections--;
                    } catch (error) {
                        // Remove from pool anyway
                        this.connectionPool.delete(connectionId);
                        this.stats.activeConnections--;
                    }
                }
            }

            // Now proceed with normal idle cleanup
            for (const [connectionId, connection] of this.connectionPool.entries()) {
                if (!connection.isReserved &&
                    connection.lastUsed.getTime() < idleThreshold &&
                    this.connectionPool.size > this.config.minPoolSize) {
                    connectionsToRemove.push(connectionId);
                }
            }

            for (const connectionId of connectionsToRemove) {
                const connection = this.connectionPool.get(connectionId);
                if (connection) {
                    try {
                        await connection.jdbcConnection.close();
                        this.connectionPool.delete(connectionId);
                        this.stats.activeConnections--;

                        // Emit disconnection event for idle cleanup
                        this.emit(ConnectionEvent.DISCONNECTED, createEventData('connection-idle-closed', {
                            connectionId,
                            jdbcConnectionId: connection.jdbcConnection.id,
                            reason: 'idle-timeout',
                            poolSize: this.connectionPool.size
                        }, this.name));
                    } catch (error) {
                        this.logger.warn('Failed to close idle JDBC connection', {
                            operation: 'cleanup-idle-error',
                            connectionId,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }
        }
    }

    /**
     * Updates the internal statistics object with the latest data from the connection pool.
     * @private
     */
    private updateRealStats(): void {
        const totalConnections = this.connectionPool.size;
        const activeConnections = Array.from(this.connectionPool.values())
            .filter(conn => conn.state === ConnectionState.CONNECTED && conn.health.isHealthy).length;
        const failedConnections = Array.from(this.connectionPool.values())
            .filter(conn => conn.state === ConnectionState.FAILED).length;

        this.stats.activeConnections = activeConnections;
        this.stats.uptime = Date.now() - this.startTime;
        this.stats.maxConcurrentConnections = this.config?.maxPoolSize || 0;
        this.stats.poolUtilization = this.config?.maxPoolSize ?
            (totalConnections / this.config.maxPoolSize) * 100 : 0;
        this.stats.failureRate = totalConnections > 0 ?
            (failedConnections / totalConnections) * 100 : 0;

        // Calculate average response time from health checks
        const healthyConnections = Array.from(this.connectionPool.values())
            .filter(conn => conn.health.isHealthy && conn.health.lastPingTime);

        if (healthyConnections.length > 0) {
            this.stats.averageResponseTime = healthyConnections
                .reduce((sum, conn) => sum + (conn.health.lastPingTime || 0), 0) / healthyConnections.length;
        }
    }

    /**
     * Gets a snapshot of the current connection statistics.
     * @returns {ConnectionStats} The current connection statistics.
     */
    public getStats(): ConnectionStats {
        this.updateRealStats();
        return { ...this.stats };
    }

    /**
     * Gets detailed information about each connection currently in the pool.
     * @returns {Array<object>} An array of objects, each containing details for one connection.
     */
    public getConnectionDetails(): Array<{
        id: string;
        jdbcConnectionId: string;
        state: ConnectionState;
        created: Date;
        lastUsed: Date;
        useCount: number;
        isReserved: boolean;
        health: ConnectionHealth;
    }> {
        return Array.from(this.connectionPool.values()).map(conn => ({
            id: conn.id,
            jdbcConnectionId: conn.jdbcConnection.id,
            state: conn.state,
            created: conn.created,
            lastUsed: conn.lastUsed,
            useCount: conn.useCount,
            isReserved: conn.isReserved,
            health: { ...conn.health }
        }));
    }

    /**
     * Forces all currently reserved connections to be released back to the pool.
     * This is intended for debugging and recovery scenarios.
     * @warning This can disrupt active operations and should be used with caution.
     */
    public forceReleaseAllConnections(): void {
        for (const connection of this.connectionPool.values()) {
            if (connection.isReserved) {
                connection.isReserved = false;
                connection.lastUsed = new Date();

                this.logger.debug('Force released reserved connection', {
                    operation: 'force-release',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id
                });
            }
        }
    }

    /**
     * Gets a comprehensive set of debugging information about the connection pool's state.
     * @returns {object} An object containing detailed debugging information.
     */
    public getPoolDebugInfo(): {
        totalConnections: number;
        reservedConnections: number;
        availableConnections: number;
        healthyConnections: number;
        connectedConnections: number;
        details: Array<{
            id: string;
            jdbcId: string;
            state: ConnectionState;
            isReserved: boolean;
            isHealthy: boolean;
            useCount: number;
            lastUsed: Date;
        }> ;
    } {
        const connections = Array.from(this.connectionPool.values());

        return {
            totalConnections: connections.length,
            reservedConnections: connections.filter(c => c.isReserved).length,
            availableConnections: connections.filter(c => !c.isReserved && c.health.isHealthy && c.state === ConnectionState.CONNECTED).length,
            healthyConnections: connections.filter(c => c.health.isHealthy).length,
            connectedConnections: connections.filter(c => c.state === ConnectionState.CONNECTED).length,
            details: connections.map(c => ({
                id: c.id,
                jdbcId: c.jdbcConnection.id,
                state: c.state,
                isReserved: c.isReserved,
                isHealthy: c.health.isHealthy,
                useCount: c.useCount,
                lastUsed: c.lastUsed
            }))
        };
    }

    /**
     * Tests all connections in the pool by pinging them and returns the results.
     * @async
     * @returns {Promise<object>} A promise that resolves with a detailed test result object.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async testAllConnections(): Promise<{
        totalTested: number;
        healthyConnections: number;
        failedConnections: number;
        details: Array<{
            connectionId: string;
            jdbcConnectionId: string;
            isHealthy: boolean;
            responseTime?: number;
            error?: string;
        }> ;
    }> {
        const results = {
            totalTested: 0,
            healthyConnections: 0,
            failedConnections: 0,
            details: [] as Array<{
                connectionId: string;
                jdbcConnectionId: string;
                isHealthy: boolean;
                responseTime?: number;
                error?: string;
            }>
        };

        this.logger.info('Testing all JDBC connections', {
            operation: 'test-all-connections',
            totalConnections: this.connectionPool.size
        });

        for (const connection of this.connectionPool.values()) {
            results.totalTested++;
            const startTime = Date.now();

            try {
                const isHealthy = await connection.jdbcConnection.ping();
                const responseTime = Date.now() - startTime;

                results.details.push({
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    isHealthy,
                    responseTime
                });

                if (isHealthy) {
                    results.healthyConnections++;
                } else {
                    results.failedConnections++;
                }
            } catch (error) {
                results.failedConnections++;
                results.details.push({
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    isHealthy: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        this.logger.info('Connection testing completed', {
            operation: 'test-all-connections-complete',
            results
        });

        return results;
    }

    /**
     * Destroys the connection manager, closing all connections and cleaning up resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying ConnectionManager and all JDBC connections', {
            operation: 'destroy',
            connectionsToClose: this.connectionPool.size,
            transactionSessionsToClose: this.transactionSessions.size
        });

        this.destroyed = true;
        this._initialized = false; // Reset initialization flag IMMEDIATELY to prevent new operations

        // Stop timers
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }

        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }

        // Close all real JDBC connections SYNCHRONOUSLY to ensure proper shutdown
        const closePromises = Array.from(this.connectionPool.values()).map(connection =>
            this.closeRealConnection(connection).catch(error => {
                this.logger.warn('Failed to close JDBC connection during destroy', {
                    operation: 'destroy-connection-error',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            })
        );

        // Wait for ALL connections to close before continuing
        await Promise.allSettled(closePromises);
        this.connectionPool.clear();
        this.transactionSessions.clear();

        // Emit pool destroyed event
        this.emit(ConnectionEvent.POOL_DESTROYED, createEventData('pool-destroyed', {
            connectionsDestroyed: closePromises.length
        }, this.name));

        // Execute HSQLDB SHUTDOWN command to ensure database is properly closed
        if (this.jdbcFactory) {
            try {
                this.logger.info('Executing HSQLDB SHUTDOWN command to ensure clean database state', {
                    operation: 'database-shutdown'
                });
                
                // Create a temporary connection just for shutdown
                const shutdownConnection = await this.jdbcFactory.createConnectionFromManager();
                try {
                    const shutdownStatement = await shutdownConnection.createStatement();
                    await shutdownStatement.execute('SHUTDOWN');
                    this.logger.info('HSQLDB SHUTDOWN command executed successfully', {
                        operation: 'database-shutdown-success'
                    });
                } catch (shutdownError) {
                    this.logger.warn('HSQLDB SHUTDOWN command failed, but continuing cleanup', {
                        operation: 'database-shutdown-error',
                        error: shutdownError instanceof Error ? shutdownError.message : String(shutdownError)
                    });
                } finally {
                    await shutdownConnection.close();
                }
            } catch (error) {
                this.logger.warn('Could not create shutdown connection', {
                    operation: 'shutdown-connection-error',
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            // Now destroy the JDBC factory
            try {
                await this.jdbcFactory.destroy();
            } catch (error) {
                this.logger.warn('Failed to destroy JDBC factory', {
                    operation: 'destroy-factory-error',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);

        this.logger.info('ConnectionManager v1.0 destroyed successfully with database shutdown', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }

    /**
     * Closes a single pooled JDBC connection.
     * @private
     * @async
     * @param {PooledJDBCConnection} connection - The connection to close.
     * @returns {Promise<void>}
     * @throws {Error} If closing the connection fails.
     */
    private async closeRealConnection(connection: PooledJDBCConnection): Promise<void> {
        connection.state = ConnectionState.CLOSING;

        try {
            await connection.jdbcConnection.close();
            connection.state = ConnectionState.DISCONNECTED;
            this.stats.activeConnections--;

            this.logger.debug('Real JDBC connection closed', {
                operation: 'close-connection',
                connectionId: connection.id,
                jdbcConnectionId: connection.jdbcConnection.id
            });

        } catch (error) {
            this.logger.error('Failed to close real JDBC connection', {
                operation: 'close-connection-error',
                connectionId: connection.id,
                jdbcConnectionId: connection.jdbcConnection.id,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Gets the underlying JDBC connection factory instance.
     * @returns {JDBCConnectionFactory | undefined} The JDBC factory, or undefined if not initialized.
     */
    public getJDBCFactory(): JDBCConnectionFactory | undefined {
        return this.jdbcFactory;
    }

    /**
     * Adds an event listener for a connection event.
     * @param {ConnectionEvent} event - The event to listen for.
     * @param {ModuleEventListener<ConnectionEvent>} listener - The callback function.
     */
    public on(event: ConnectionEvent, listener: ModuleEventListener<ConnectionEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Adds a one-time event listener for a connection event.
     * @param {ConnectionEvent} event - The event to listen for.
     * @param {ModuleEventListener<ConnectionEvent>} listener - The callback function.
     */
    public once(event: ConnectionEvent, listener: ModuleEventListener<ConnectionEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Removes an event listener for a connection event.
     * @param {ConnectionEvent} event - The event to stop listening to.
     * @param {ModuleEventListener<ConnectionEvent>} listener - The listener to remove.
     */
    public off(event: ConnectionEvent, listener: ModuleEventListener<ConnectionEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emits an event to all registered listeners.
     * @param {ConnectionEvent} event - The event to emit.
     * @param {any} [data] - The data payload for the event.
     */
    public emit(event: ConnectionEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Removes all listeners for a specific connection event, or all listeners if no event is specified.
     * @param {ConnectionEvent} [event] - The event to remove listeners from.
     */
    public removeAllListeners(event?: ConnectionEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Gets the number of listeners for a specific connection event.
     * @param {ConnectionEvent} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    public listenerCount(event: ConnectionEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Gets an array of all connection event names that have listeners.
     * @returns {ConnectionEvent[]} An array of event names.
     */
    public eventNames(): ConnectionEvent[] {
        return this.eventEmitter.eventNames();
    }

    /**
     * Validates a connection before returning it to ensure it's still usable.
     * @private
     * @async
     * @param {PooledJDBCConnection} connection - The connection to validate.
     * @returns {Promise<boolean>} True if the connection is valid, false otherwise.
     */
    private async validateConnectionBeforeUse(connection: PooledJDBCConnection): Promise<boolean> {
        try {
            // Quick validation: check if the connection is still active
            if (!connection.jdbcConnection.isActive) {
                this.logger.debug('Connection inactive, removing from pool', {
                    operation: 'validate-connection',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id
                });
                return false;
            }

            // For critical operations, perform a lightweight ping
            const isHealthy = await connection.jdbcConnection.ping();
            if (!isHealthy) {
                this.logger.debug('Connection ping failed, removing from pool', {
                    operation: 'validate-connection',
                    connectionId: connection.id,
                    jdbcConnectionId: connection.jdbcConnection.id
                });
                return false;
            }

            // Update health status
            connection.health.isHealthy = true;
            connection.health.lastCheck = new Date();
            connection.health.consecutiveFailures = 0;

            return true;
        } catch (error) {
            this.logger.warn('Connection validation failed', {
                operation: 'validate-connection',
                connectionId: connection.id,
                jdbcConnectionId: connection.jdbcConnection.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Removes an invalid connection from the pool.
     * @private
     * @param {PooledJDBCConnection} connection - The connection to remove.
     */
    private removeInvalidConnection(connection: PooledJDBCConnection): void {
        this.logger.debug('Removing invalid connection from pool', {
            operation: 'remove-invalid-connection',
            connectionId: connection.id,
            jdbcConnectionId: connection.jdbcConnection.id
        });

        try {
            // Mark as failed and close
            connection.state = ConnectionState.FAILED;
            connection.health.isHealthy = false;
            connection.jdbcConnection.close().catch(error => {
                this.logger.debug('Error closing invalid connection', {
                    operation: 'close-invalid-connection',
                    connectionId: connection.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        } catch (error) {
            this.logger.debug('Error during connection removal', {
                operation: 'remove-invalid-connection-error',
                connectionId: connection.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }

        // Remove from pool
        this.connectionPool.delete(connection.id);
        this.stats.activeConnections--;
        this.stats.failedConnections++;
    }
}