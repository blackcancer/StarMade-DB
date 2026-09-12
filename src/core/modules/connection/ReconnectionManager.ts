/**
 * @fileoverview Reconnection Manager Module
 * 
 * This file defines the ReconnectionManager, which manages automatic reconnection
 * strategies for HSQLDB connections with intelligent retry logic, circuit breaker
 * patterns, and recovery mechanisms.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { 
    ConnectionError, 
    ConnectionTimeoutError,
    ConnectionLostError,
    ConnectionRetriesExhaustedError,
    HSQLDBError,
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    ModuleDestroyedError,
    isRecoverableError
} from '../../errors.js';
import { retry, debounce, resourceCleaner } from '../../utils.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import { ConnectionManager, ConnectionState } from './ConnectionManager.js';
import type { JDBCConnection } from './JDBCConnectionFactory.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================
/**
 * @interface ModuleEventEmitter
 * @description Base event emitter interface for all modules.
 * @template T - Event type enum
 */
export interface ModuleEventEmitter<T extends string | number | symbol> {
    /** Add event listener */
    on(event: T, listener: ModuleEventListener): void;
    /** Add one-time event listener */
    once(event: T, listener: ModuleEventListener): void;
    /** Remove event listener */
    off(event: T, listener: ModuleEventListener): void;
    /** Emit event to all listeners */
    emit(event: T, data?: any): void;
    /** Remove all listeners for an event or all events */
    removeAllListeners(event?: T): void;
    /** Get listener count for an event */
    listenerCount(event: T): number;
    /** Get all events that have listeners */
    eventNames(): T[];
}

/**
 * @typedef ModuleEventListener
 * @description Event listener function type.
 */
export type ModuleEventListener = (event: string | number | symbol, data?: any) => void;

/**
 * @class ModuleEventEmitterImpl
 * @description Event emitter implementation for modules.
 * @template T - Event type enum
 */
export class ModuleEventEmitterImpl<T extends string | number | symbol> implements ModuleEventEmitter<T> {
    /** Regular event listeners */
    private eventListeners: Map<T, Set<ModuleEventListener>> = new Map();
    /** One-time event listeners */
    private onceListeners: Map<T, Set<ModuleEventListener>> = new Map();
    /** Module logger for event errors */
    private logger?: ModuleLogger;

    /**
     * Creates a new instance of ModuleEventEmitterImpl.
     * @param {ModuleLogger} [logger] - Optional logger for event errors.
     */
    constructor(logger?: ModuleLogger) {
        this.logger = logger;
    }

    /**
     * Initialize event emitter with predefined events.
     * @param {T[]} events - Array of events to initialize.
     */
    public initializeEvents(events: T[]): void {
        events.forEach(event => {
            this.eventListeners.set(event, new Set());
            this.onceListeners.set(event, new Set());
        });
    }

    /**
     * Add event listener.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener} listener - The listener function.
     */
    public on(event: T, listener: ModuleEventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);
    }

    /**
     * Add one-time event listener.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener} listener - The listener function.
     */
    public once(event: T, listener: ModuleEventListener): void {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event)!.add(listener);
    }

    /**
     * Remove event listener.
     * @param {T} event - The event to stop listening to.
     * @param {ModuleEventListener} listener - The listener to remove.
     */
    public off(event: T, listener: ModuleEventListener): void {
        this.eventListeners.get(event)?.delete(listener);
        this.onceListeners.get(event)?.delete(listener);
    }

    /**
     * Remove all listeners for an event or all events.
     * @param {T} [event] - The event to remove listeners from.
     */
    public removeAllListeners(event?: T): void {
        if (event !== undefined) {
            this.eventListeners.get(event)?.clear();
            this.onceListeners.get(event)?.clear();
        } else {
            this.eventListeners.clear();
            this.onceListeners.clear();
        }
    }

    /**
     * Get listener count for an event.
     * @param {T} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    public listenerCount(event: T): number {
        const regularCount = this.eventListeners.get(event)?.size || 0;
        const onceCount = this.onceListeners.get(event)?.size || 0;
        return regularCount + onceCount;
    }

    /**
     * Get all events that have listeners.
     * @returns {T[]} An array of event names.
     */
    public eventNames(): T[] {
        const events = new Set<T>();
        this.eventListeners.forEach((_, event) => events.add(event));
        this.onceListeners.forEach((_, event) => events.add(event));
        return Array.from(events);
    }

    /**
     * Emit event to all listeners.
     * @param {T} event - The event to emit.
     * @param {any} [data] - The data payload for the event.
     */
    public emit(event: T, data?: any): void {
        // Handle regular listeners
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    this.logger?.error('Error in event listener', {
                        operation: 'emit-event-error',
                        event: String(event),
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }

        // Handle one-time listeners
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners && onceListeners.size > 0) {
            const listenersToCall = Array.from(onceListeners);
            onceListeners.clear();

            listenersToCall.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    this.logger?.error('Error in one-time event listener', {
                        operation: 'emit-event-error-once',
                        event: String(event),
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }
    }

    /**
     * Cleanup all listeners.
     */
    public destroy(): void {
        this.eventListeners.clear();
        this.onceListeners.clear();
    }
}

/**
 * @enum {string}
 * @description Defines reconnection strategies.
 * @readonly
 */
export enum ReconnectionStrategy {
    /** Immediate reconnection attempt */
    IMMEDIATE = 'immediate',
    /** Exponential backoff with jitter */
    EXPONENTIAL_BACKOFF = 'exponential-backoff',
    /** Fixed interval between attempts */
    FIXED_INTERVAL = 'fixed-interval',
    /** Circuit breaker pattern with cooldown */
    CIRCUIT_BREAKER = 'circuit-breaker'
}

/**
 * @enum {string}
 * @description Defines circuit breaker states.
 * @readonly
 */
export enum CircuitBreakerState {
    /** Circuit is closed, connections are allowed */
    CLOSED = 'closed',
    /** Circuit is open, connections are blocked */
    OPEN = 'open',
    /** Circuit is half-open, testing if service recovered */
    HALF_OPEN = 'half-open'
}

/**
 * @interface ReconnectionConfig
 * @description Defines the configuration for reconnection behavior.
 */
export interface ReconnectionConfig {
    /** Whether automatic reconnection is enabled */
    enabled: boolean;
    /** Reconnection strategy to use */
    strategy: ReconnectionStrategy;
    /** Maximum number of reconnection attempts */
    maxRetries: number;
    /** Base delay between reconnection attempts in milliseconds */
    baseDelayMs: number;
    /** Maximum delay between attempts in milliseconds */
    maxDelayMs: number;
    /** Timeout for each reconnection attempt in milliseconds */
    attemptTimeoutMs: number;
    /** Jitter factor for exponential backoff (0-1) */
    jitterFactor: number;
    /** Circuit breaker failure threshold */
    circuitBreakerThreshold: number;
    /** Circuit breaker cooldown period in milliseconds */
    circuitBreakerCooldownMs: number;
    /** Whether to reset the circuit breaker on successful connection */
    resetOnSuccess: boolean;
    /** Health check interval during reconnection in milliseconds */
    healthCheckIntervalMs: number;
}

/**
 * @interface ReconnectionAttempt
 * @description Represents information about a single reconnection attempt.
 */
export interface ReconnectionAttempt {
    /** Attempt number (1-based) */
    attemptNumber: number;
    /** Timestamp when attempt started */
    startTime: Date;
    /** Duration of the attempt in milliseconds */
    duration?: number;
    /** Whether the attempt was successful */
    success: boolean;
    /** Error that occurred during attempt */
    error?: HSQLDBError;
    /** Strategy used for this attempt */
    strategy: ReconnectionStrategy;
    /** Delay before this attempt in milliseconds */
    delayMs: number;
}

/**
 * @interface ReconnectionStats
 * @description Provides statistics and metrics for reconnection activity.
 */
export interface ReconnectionStats {
    /** Total number of reconnection attempts */
    totalAttempts: number;
    /** Number of successful reconnections */
    successfulReconnections: number;
    /** Number of failed reconnections */
    failedReconnections: number;
    /** Failure rate as percentage (0-100) */
    failureRate: number;
    /** Current circuit breaker state */
    circuitBreakerState: CircuitBreakerState;
    /** Time since last successful connection */
    timeSinceLastConnectionMs: number;
    /** Average reconnection time in milliseconds */
    averageReconnectionTimeMs: number;
    /** Current reconnection session (if active) */
    currentSession?: {
        sessionId: string;
        startTime: Date;
        attemptCount: number;
        lastAttemptTime: Date;
        isActive: boolean;
    };
    /** Last reconnection attempt details */
    lastAttempt?: ReconnectionAttempt;
}

/**
 * @enum {string}
 * @description Defines connection event types for reconnection management.
 * @readonly
 */
export enum ConnectionEvent {
    /** Connection was established successfully */
    CONNECTED = 'connected',
    /** Connection was lost */
    DISCONNECTED = 'disconnected',
    /** Connection attempt failed */
    CONNECTION_FAILED = 'connection-failed',
    /** Reconnection attempt started */
    RECONNECT_STARTED = 'reconnect-started',
    /** Reconnection attempt succeeded */
    RECONNECT_SUCCESS = 'reconnect-success',
    /** Reconnection attempt failed */
    RECONNECT_FAILED = 'reconnect-failed',
    /** All reconnection attempts exhausted */
    RECONNECT_EXHAUSTED = 'reconnect-exhausted',
    /** Circuit breaker opened */
    CIRCUIT_BREAKER_OPENED = 'circuit-breaker-opened',
    /** Circuit breaker closed */
    CIRCUIT_BREAKER_CLOSED = 'circuit-breaker-closed'
}

/**
 * @typedef ConnectionEventListener
 * @description Event listener function type for connection events.
 */
export type ConnectionEventListener = (event: ConnectionEvent, data?: any) => void;

// =============================================================================
// RECONNECTION MANAGER CLASS
// =============================================================================

/**
 * @class ReconnectionManager
 * @description Manages automatic reconnection for database connections using configurable
 * strategies and patterns including circuit breaker, exponential backoff, and intelligent retry logic.
 * @implements {BaseModule}
 */
export class ReconnectionManager implements BaseModule {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'reconnection-manager';
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
     * Whether initialization completed successfully. 
     * @private 
     * @type {boolean}
     */
    private _initialized = false;
    /**
     * Owning manager used to resolve configuration and module dependencies. 
     * @private 
     * @type {HSQLManager | undefined}
     */
    private manager?: HSQLManager;
    /**
     * Connection pool module used to borrow and release JDBC sessions. 
     * @private 
     * @type {ConnectionManager | undefined}
     */
    private connectionManager?: ConnectionManager;
    /**
     * Effective configuration applied to this instance. 
     * @private 
     * @type {ReconnectionConfig | undefined}
     */
    private config?: ReconnectionConfig;
    /**
     * Whether destruction has started; prevents operations after resource cleanup. 
     * @private 
     * @type {boolean}
     */
    private destroyed = false;
    /**
     * Creation timestamp in milliseconds used to calculate uptime. 
     * @private 
     * @readonly
     * @type {number}
     */
    private readonly startTime = Date.now();
    /**
     * Module logger for operation context and diagnostic errors. 
     * @private 
     * @type {ModuleLogger}
     */
    private logger: ModuleLogger;
    /**
     * Accumulated operation counters and timestamps exposed through statistics. 
     * @private 
     * @type {ReconnectionStats}
     */
    private stats: ReconnectionStats = {
        totalAttempts: 0,
        successfulReconnections: 0,
        failedReconnections: 0,
        failureRate: 0,
        circuitBreakerState: CircuitBreakerState.CLOSED as CircuitBreakerState,
        timeSinceLastConnectionMs: 0,
        averageReconnectionTimeMs: 0
    };
    /**
     * Persistent listeners indexed by event name. 
     * @private 
     * @type {Map<ConnectionEvent, Set<ConnectionEventListener>>}
     */
    private eventListeners: Map<ConnectionEvent, Set<ConnectionEventListener>> = new Map();
    /**
     * Listeners removed after their first invocation. 
     * @private 
     * @type {Map<ConnectionEvent, Set<ConnectionEventListener>>}
     */
    private onceListeners: Map<ConnectionEvent, Set<ConnectionEventListener>> = new Map();
    /**
     * Identifier of the current reconnection session. 
     * @private 
     * @type {string | undefined}
     */
    private currentSessionId?: string;
    /**
     * Timer scheduled for the next reconnection attempt. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private reconnectionTimer?: NodeJS.Timeout;
    /** Resolve the pending retry delay when shutdown cancels its timer. */
    private retryWaitResolve?: () => void;
    /** Shared reconnection operation for simultaneous manual or health triggers. */
    private activeReconnection?: Promise<boolean>;
    /** Circuit-breaker cooldown, cancelled when the manager is destroyed. */
    private circuitBreakerTimer?: NodeJS.Timeout;
    /**
     * Timer that schedules connection health checks. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private healthCheckTimer?: NodeJS.Timeout;
    /**
     * Consecutive failures used to trip the reconnection circuit breaker. 
     * @private 
     * @type {number}
     */
    private circuitBreakerFailureCount = 0;
    /**
     * Timestamp of the most recent successful connection. 
     * @private 
     * @type {number}
     */
    private lastSuccessfulConnectionTime = Date.now();
    /**
     * Number of attempts in the current reconnection session. 
     * @private 
     * @type {ReconnectionAttempt[]}
     */
    private currentSessionAttempts: ReconnectionAttempt[] = [];

    /**
     * Creates a new instance of the ReconnectionManager.
     */
    constructor() {
        this.logger = createModuleLogger('ReconnectionManager-v1.0');
    }

    /**
     * Updates statistics for testing purposes.
     * @private
     * @param {Partial<ReconnectionStats>} updates - The statistics updates to apply.
     */
    private updateStats(updates: Partial<ReconnectionStats>): void {
        Object.assign(this.stats, updates);
    }

    /**
     * Records a failure for the circuit breaker pattern.
     * @private
     */
    private recordFailure(): void {
        this.circuitBreakerFailureCount++;
        
        if (this.config?.strategy === ReconnectionStrategy.CIRCUIT_BREAKER &&
            this.circuitBreakerFailureCount >= (this.config?.circuitBreakerThreshold || 5)) {
            this.openCircuitBreaker();
        }
    }

    /**
     * Calculates the delay for the next reconnection attempt based on the strategy.
     * @private
     * @param {number} attempt - The attempt number (1-based).
     * @returns {number} The delay in milliseconds.
     */
    private calculateDelay(attempt: number): number {
        if (!this.config) return 0;

        switch (this.config.strategy) {
            case ReconnectionStrategy.IMMEDIATE:
                return 0;
            
            case ReconnectionStrategy.EXPONENTIAL_BACKOFF:
                const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
                const jitter = exponentialDelay * this.config.jitterFactor * Math.random();
                return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
            
            case ReconnectionStrategy.FIXED_INTERVAL:
                return this.config.baseDelayMs;
            
            case ReconnectionStrategy.CIRCUIT_BREAKER:
                return 0;
            
            default:
                return this.config.baseDelayMs;
        }
    }

    /**
     * Initializes the reconnection manager. This sets up configuration,
     * discovers the ConnectionManager, and starts monitoring.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the manager is invalid or ConnectionManager is not found.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('ReconnectionManager', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager is required', ['manager'], {
                operation: 'initialize',
                hasManager: !!manager
            });
        }

        this.logger.info('Initializing ReconnectionManager v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        
        // Discover ConnectionManager from HSQLManager
        const connectionManager = this.manager.getModule<ConnectionManager>('connection-manager');
        if (!connectionManager) {
            throw new ConfigurationError('ConnectionManager not found in HSQLManager', ['connection-manager'], {
                operation: 'initialize',
                availableModules: this.manager.getStatus().modulesLoaded
            });
        }
        
        this.connectionManager = connectionManager;
        this.buildConfiguration();
        
        // Initialize event listeners map
        this.initializeEventListeners();
        
        // Start health monitoring if enabled
        if (this.config?.enabled) {
            this.startHealthMonitoring();
        }
        
        this._initialized = true;
        resourceCleaner.register(this);
        
        this.logger.info('ReconnectionManager v1.0 initialized successfully', {
            operation: 'initialize-complete',
            enabled: this.config?.enabled,
            strategy: this.config?.strategy
        });
    }

    /**
     * Initializes the reconnection manager with an explicit ConnectionManager.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @param {ConnectionManager} connectionManager - The connection manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the parameters are invalid.
     */
    public async initializeWithConnectionManager(manager: HSQLManager, connectionManager: ConnectionManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('ReconnectionManager', {
                operation: 'initializeWithConnectionManager'
            });
        }

        if (!manager || !connectionManager) {
            throw new ConfigurationError('Manager and ConnectionManager are required', ['manager', 'connectionManager'], {
                operation: 'initializeWithConnectionManager',
                hasManager: !!manager,
                hasConnectionManager: !!connectionManager
            });
        }

        this.logger.info('Initializing ReconnectionManager v1.0 with explicit ConnectionManager', {
            operation: 'initializeWithConnectionManager'
        });

        this.manager = manager;
        this.connectionManager = connectionManager;
        this.buildConfiguration();
        
        // Initialize event listeners map
        this.initializeEventListeners();
        
        // Start health monitoring if enabled
        if (this.config?.enabled) {
            this.startHealthMonitoring();
        }
        
        this._initialized = true;
        resourceCleaner.register(this);
        
        this.logger.info('ReconnectionManager v1.0 initialized successfully with explicit ConnectionManager', {
            operation: 'initializeWithConnectionManager-complete',
            enabled: this.config?.enabled,
            strategy: this.config?.strategy
        });
    }

    /**
     * Builds the configuration from the HSQLManager's settings.
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
            enabled: managerConfig.modules.enableAutoReconnection ?? false,
            strategy: ReconnectionStrategy.EXPONENTIAL_BACKOFF,
            maxRetries: managerConfig.connection.maxRetries ?? 3,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            attemptTimeoutMs: managerConfig.connection.timeoutMs ?? 10000,
            jitterFactor: 0.1,
            circuitBreakerThreshold: 5,
            circuitBreakerCooldownMs: 60000,
            resetOnSuccess: true,
            healthCheckIntervalMs: 5000
        };

        this.logger.debug('Configuration built for ReconnectionManager', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Initializes the event listeners map for all connection events.
     * @private
     */
    private initializeEventListeners(): void {
        // Initialize empty sets for each event type
        Object.values(ConnectionEvent).forEach(event => {
            this.eventListeners.set(event, new Set());
            this.onceListeners.set(event, new Set());
        });
    }

    /**
     * Starts health monitoring to check connection status periodically.
     * @private
     */
    private startHealthMonitoring(): void {
        if (!this.config?.healthCheckIntervalMs) {
            return;
        }

        this.healthCheckTimer = setInterval(
            () => this.performHealthCheck(),
            this.config.healthCheckIntervalMs
        );

        this.logger.debug('Health monitoring started for reconnection', {
            operation: 'start-health-monitoring',
            interval: this.config.healthCheckIntervalMs
        });
    }

    /**
     * Performs a health check on the connection.
     * @private
     * @async
     */
    private async performHealthCheck(): Promise<void> {
        if (this.destroyed || !this.connectionManager || !this.config?.enabled) {
            return;
        }

        try {
            // Test connection health using ConnectionManager
            const testResults = await this.connectionManager.testAllConnections();
            
            if (testResults.healthyConnections === 0 && testResults.totalTested > 0) {
                // No healthy connections found, trigger reconnection
                this.logger.warn('Health check detected connection issues', {
                    operation: 'health-check-failed',
                    totalTested: testResults.totalTested,
                    healthyConnections: testResults.healthyConnections
                });
                
                this.emit(ConnectionEvent.DISCONNECTED, { 
                    reason: 'health-check-failure',
                    testResults 
                });
                
                if (!this.currentSessionId) {
                    await this.triggerReconnection();
                }
            } else {
                // Update last successful connection time
                this.lastSuccessfulConnectionTime = Date.now();
            }
            
        } catch (error) {
            this.logger.warn('Health check failed', {
                operation: 'health-check-error',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Triggers a manual reconnection attempt.
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful, false otherwise.
     * @throws {ModuleNotInitializedError} If the module is not initialized.
     * @throws {ConfigurationError} If reconnection is disabled.
     */
    public async triggerReconnection(): Promise<boolean> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ReconnectionManager', 'trigger reconnection', {
                operation: 'trigger-reconnection'
            });
        }

        if (!this.config?.enabled) {
            throw new ConfigurationError('Reconnection is disabled', ['enabled'], {
                operation: 'trigger-reconnection',
                enabled: this.config?.enabled
            });
        }

        // Check circuit breaker state
        if (this.stats.circuitBreakerState === CircuitBreakerState.OPEN) {
            this.logger.warn('Reconnection blocked by circuit breaker', {
                operation: 'trigger-reconnection-blocked',
                circuitBreakerState: this.stats.circuitBreakerState
            });
            return false;
        }

        if (this.activeReconnection) return await this.activeReconnection;
        const operation = this.startReconnectionSession();
        this.activeReconnection = operation;
        try {
            return await operation;
        } finally {
            this.activeReconnection = undefined;
        }
    }

    /**
     * Starts a new reconnection session.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async startReconnectionSession(): Promise<boolean> {
        const sessionId = `reconnect_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        this.currentSessionId = sessionId;
        this.currentSessionAttempts = [];

        this.stats.currentSession = {
            sessionId,
            startTime: new Date(),
            attemptCount: 0,
            lastAttemptTime: new Date(),
            isActive: true
        };

        this.logger.info('Starting reconnection session', {
            operation: 'start-reconnection-session',
            sessionId,
            strategy: this.config?.strategy,
            maxRetries: this.config?.maxRetries
        });

        this.emit(ConnectionEvent.RECONNECT_STARTED, { sessionId });

        try {
            const success = await this.executeReconnectionStrategy();
            
            if (success) {
                this.onReconnectionSuccess(sessionId);
            } else {
                this.onReconnectionFailure(sessionId);
            }
            
            return success;
            
        } catch (error) {
            this.logger.error('Reconnection session failed', {
                operation: 'reconnection-session-error',
                sessionId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            this.onReconnectionFailure(sessionId);
            return false;
        } finally {
            this.currentSessionId = undefined;
            if (this.stats.currentSession) {
                this.stats.currentSession.isActive = false;
            }
        }
    }

    /**
     * Executes the appropriate reconnection strategy.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async executeReconnectionStrategy(): Promise<boolean> {
        if (!this.config || !this.connectionManager) {
            return false;
        }

        switch (this.config.strategy) {
            case ReconnectionStrategy.IMMEDIATE:
                return await this.attemptImmediateReconnection();
            
            case ReconnectionStrategy.EXPONENTIAL_BACKOFF:
                return await this.attemptExponentialBackoffReconnection();
            
            case ReconnectionStrategy.FIXED_INTERVAL:
                return await this.attemptFixedIntervalReconnection();
            
            case ReconnectionStrategy.CIRCUIT_BREAKER:
                return await this.attemptCircuitBreakerReconnection();
            
            default:
                this.logger.warn('Unknown reconnection strategy', {
                    operation: 'execute-reconnection-strategy',
                    strategy: this.config.strategy
                });
                return await this.attemptExponentialBackoffReconnection();
        }
    }

    /**
     * Attempts immediate reconnection.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async attemptImmediateReconnection(): Promise<boolean> {
        this.logger.debug('Attempting immediate reconnection', {
            operation: 'immediate-reconnection'
        });

        return await this.performSingleReconnectionAttempt(1, 0);
    }

    /**
     * Attempts exponential backoff reconnection.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async attemptExponentialBackoffReconnection(): Promise<boolean> {
        if (!this.config) return false;

        this.logger.debug('Attempting exponential backoff reconnection', {
            operation: 'exponential-backoff-reconnection',
            maxRetries: this.config.maxRetries,
            baseDelayMs: this.config.baseDelayMs
        });

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            // Calculate exponential backoff delay with jitter
            const delayMs = this.calculateDelay(attempt);

            if (attempt > 1) {
                this.logger.debug('Waiting before reconnection attempt', {
                    operation: 'exponential-backoff-delay',
                    attempt,
                    delayMs: Math.round(delayMs)
                });
                
                await this.wait(delayMs);
            }

            const success = await this.performSingleReconnectionAttempt(attempt, delayMs);
            if (success) {
                return true;
            }

            // Check if we should continue
            if (this.destroyed) {
                break;
            }
            
            // Check circuit breaker state with explicit comparison
            const currentState = this.stats.circuitBreakerState;
            if (currentState === CircuitBreakerState.OPEN) {
                break;
            }
        }

        return false;
    }

    /**
     * Attempts fixed interval reconnection.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async attemptFixedIntervalReconnection(): Promise<boolean> {
        if (!this.config) return false;

        this.logger.debug('Attempting fixed interval reconnection', {
            operation: 'fixed-interval-reconnection',
            maxRetries: this.config.maxRetries,
            intervalMs: this.config.baseDelayMs
        });

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            if (attempt > 1) {
                await this.wait(this.config.baseDelayMs);
            }

            const success = await this.performSingleReconnectionAttempt(attempt, this.config.baseDelayMs);
            if (success) {
                return true;
            }

            if (this.destroyed) {
                break;
            }
            
            // Check circuit breaker state with explicit comparison
            const currentState = this.stats.circuitBreakerState;
            if (currentState === CircuitBreakerState.OPEN) {
                break;
            }
        }

        return false;
    }

    /**
     * Attempts circuit breaker reconnection.
     * @private
     * @async
     * @returns {Promise<boolean>} True if reconnection was successful.
     */
    private async attemptCircuitBreakerReconnection(): Promise<boolean> {
        if (!this.config) return false;

        // Check circuit breaker state
        const currentState = this.stats.circuitBreakerState;
        if (currentState === CircuitBreakerState.OPEN) {
            this.logger.debug('Circuit breaker is open, skipping reconnection', {
                operation: 'circuit-breaker-open'
            });
            return false;
        }

        // Attempt single reconnection in half-open state
        if (currentState === CircuitBreakerState.HALF_OPEN) {
            const success = await this.performSingleReconnectionAttempt(1, 0);
            if (!success) {
                this.recordFailure();
            }
            return success;
        }

        // Normal reconnection attempts until threshold is reached
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            const success = await this.performSingleReconnectionAttempt(attempt, 0);
            
            if (success) {
                this.resetCircuitBreaker();
                return true;
            }

            this.recordFailure();
            
            // Check circuit breaker state again after recording failure
            const newState = this.stats.circuitBreakerState;
            if (newState === CircuitBreakerState.OPEN) {
                break;
            }
        }

        return false;
    }

    /**
     * Performs a single reconnection attempt.
     * @private
     * @async
     * @param {number} attemptNumber - The current attempt number.
     * @param {number} delayMs - The delay before this attempt in milliseconds.
     * @returns {Promise<boolean>} True if the attempt was successful.
     */
    private async performSingleReconnectionAttempt(attemptNumber: number, delayMs: number): Promise<boolean> {
        if (this.destroyed) return false;
        const startTime = new Date();
        let success = false;
        let error: HSQLDBError | undefined;

        this.logger.debug('Performing reconnection attempt', {
            operation: 'reconnection-attempt',
            attemptNumber,
            delayMs,
            strategy: this.config?.strategy
        });

        this.stats.totalAttempts++;
        if (this.stats.currentSession) {
            this.stats.currentSession.attemptCount++;
            this.stats.currentSession.lastAttemptTime = startTime;
        }

        try {
            // Test if connection manager can get a working connection
            const connection = await this.connectionManager!.getConnection();
            
            try {
                await connection.execute('SELECT 1 FROM INFORMATION_SCHEMA.SYSTEM_USERS LIMIT 1', [], {
                    timeoutMs: this.config?.attemptTimeoutMs
                });
            } finally {
                await this.connectionManager!.releaseConnection(connection);
            }
            
            success = true;
            this.stats.successfulReconnections++;
            this.lastSuccessfulConnectionTime = Date.now();
            
            this.logger.info('Reconnection attempt successful', {
                operation: 'reconnection-attempt-success',
                attemptNumber,
                duration: Date.now() - startTime.getTime()
            });
            
        } catch (err) {
            error = err instanceof HSQLDBError ? err : 
                   new ConnectionError(err instanceof Error ? err.message : String(err));
            
            this.stats.failedReconnections++;
            
            this.logger.warn('Reconnection attempt failed', {
                operation: 'reconnection-attempt-failed',
                attemptNumber,
                error: error.message,
                duration: Date.now() - startTime.getTime()
            });
        }

        // Record attempt details
        const attempt: ReconnectionAttempt = {
            attemptNumber,
            startTime,
            duration: Date.now() - startTime.getTime(),
            success,
            error,
            strategy: this.config?.strategy || ReconnectionStrategy.EXPONENTIAL_BACKOFF,
            delayMs
        };

        this.currentSessionAttempts.push(attempt);
        this.stats.lastAttempt = attempt;

        // Update average reconnection time
        if (success) {
            const successfulAttempts = this.currentSessionAttempts.filter(a => a.success);
            if (successfulAttempts.length > 0) {
                this.stats.averageReconnectionTimeMs = successfulAttempts
                    .reduce((sum, a) => sum + (a.duration || 0), 0) / successfulAttempts.length;
            }
        }

        // Emit appropriate event
        if (success) {
            this.emit(ConnectionEvent.RECONNECT_SUCCESS, { attempt });
        } else {
            this.emit(ConnectionEvent.RECONNECT_FAILED, { attempt, error });
        }

        return success;
    }

    /**
     * Waits for the specified amount of time.
     * @private
     * @async
     * @param {number} ms - The number of milliseconds to wait.
     * @returns {Promise<void>}
     */
    private async wait(ms: number): Promise<void> {
        if (this.destroyed) return;
        return new Promise(resolve => {
            this.retryWaitResolve = resolve;
            this.reconnectionTimer = setTimeout(() => {
                this.reconnectionTimer = undefined;
                this.retryWaitResolve = undefined;
                resolve();
            }, ms);
        });
    }

    /**
     * Handles a successful reconnection.
     * @private
     * @param {string} sessionId - The session ID.
     */
    private onReconnectionSuccess(sessionId: string): void {
        this.logger.info('Reconnection session successful', {
            operation: 'reconnection-success',
            sessionId,
            attempts: this.currentSessionAttempts.length
        });

        if (this.config?.resetOnSuccess) {
            this.resetCircuitBreaker();
        }

        this.emit(ConnectionEvent.CONNECTED);
    }

    /**
     * Handles a failed reconnection.
     * @private
     * @param {string} sessionId - The session ID.
     */
    private onReconnectionFailure(sessionId: string): void {
        this.logger.error('Reconnection session failed', {
            operation: 'reconnection-failure',
            sessionId,
            attempts: this.currentSessionAttempts.length,
            maxRetries: this.config?.maxRetries
        });

        this.emit(ConnectionEvent.RECONNECT_EXHAUSTED, { 
            sessionId, 
            attempts: this.currentSessionAttempts.length 
        });
    }

    /**
     * Resets the circuit breaker to the closed state.
     * @private
     */
    private resetCircuitBreaker(): void {
        if (this.stats.circuitBreakerState !== CircuitBreakerState.CLOSED) {
            this.stats.circuitBreakerState = CircuitBreakerState.CLOSED;
            this.circuitBreakerFailureCount = 0;
            
            this.logger.info('Circuit breaker reset to closed state', {
                operation: 'circuit-breaker-reset'
            });
            
            this.emit(ConnectionEvent.CIRCUIT_BREAKER_CLOSED);
        }
    }

    /**
     * Opens the circuit breaker due to excessive failures.
     * @private
     */
    private openCircuitBreaker(): void {
        this.stats.circuitBreakerState = CircuitBreakerState.OPEN;
        
        this.logger.warn('Circuit breaker opened due to failures', {
            operation: 'circuit-breaker-open',
            failureCount: this.circuitBreakerFailureCount,
            threshold: this.config?.circuitBreakerThreshold
        });
        
        this.emit(ConnectionEvent.CIRCUIT_BREAKER_OPENED);

        // Schedule circuit breaker to half-open after cooldown
        if (this.config?.circuitBreakerCooldownMs) {
            if (this.circuitBreakerTimer) clearTimeout(this.circuitBreakerTimer);
            this.circuitBreakerTimer = setTimeout(() => {
                this.circuitBreakerTimer = undefined;
                if (this.stats.circuitBreakerState === CircuitBreakerState.OPEN && !this.destroyed) {
                    this.stats.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
                    this.logger.info('Circuit breaker moved to half-open state', {
                        operation: 'circuit-breaker-half-open'
                    });
                }
            }, this.config.circuitBreakerCooldownMs);
        }
    }

    /**
     * Adds an event listener for the specified connection event.
     * @param {ConnectionEvent} event - The event to listen for.
     * @param {ConnectionEventListener} listener - The listener function.
     */
    public on(event: ConnectionEvent, listener: ConnectionEventListener): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.add(listener);
        }
    }

    /**
     * Adds a one-time event listener for the specified connection event.
     * @param {ConnectionEvent} event - The event to listen for.
     * @param {ConnectionEventListener} listener - The listener function.
     */
    public once(event: ConnectionEvent, listener: ConnectionEventListener): void {
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners) {
            onceListeners.add(listener);
        }
    }

    /**
     * Removes an event listener for the specified connection event.
     * @param {ConnectionEvent} event - The event to stop listening for.
     * @param {ConnectionEventListener} listener - The listener function to remove.
     */
    public off(event: ConnectionEvent, listener: ConnectionEventListener): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
        
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners) {
            onceListeners.delete(listener);
        }
    }

    /**
     * Emits an event to all registered listeners.
     * @private
     * @param {ConnectionEvent} event - The event to emit.
     * @param {any} [data] - Optional data to pass to listeners.
     */
    private emit(event: ConnectionEvent, data?: any): void {
        // Handle regular listeners
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    this.logger.error('Error in event listener', {
                        operation: 'emit-event-error',
                        event,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }
        
        // Handle one-time listeners
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners && onceListeners.size > 0) {
            // Convert to array to avoid concurrent modification
            const listenersToCall = Array.from(onceListeners);
            onceListeners.clear(); // Clear all once listeners after calling them
            
            listenersToCall.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    this.logger.error('Error in one-time event listener', {
                        operation: 'emit-event-error-once',
                        event,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }
    }

    /**
     * Gets a snapshot of the current reconnection statistics.
     * @returns {ReconnectionStats} The current statistics including success rates and circuit breaker state.
     */
    public getStats(): ReconnectionStats {
        // Update time since last connection
        this.stats.timeSinceLastConnectionMs = Date.now() - this.lastSuccessfulConnectionTime;
        
        // Calculate failure rate
        const failureRate = this.stats.totalAttempts > 0 
            ? (this.stats.failedReconnections / this.stats.totalAttempts) * 100 
            : 0;
        
        return { 
            ...this.stats, 
            failureRate: Math.round(failureRate * 100) / 100 // Round to 2 decimal places
        };
    }

    /**
     * Resets all reconnection statistics to their initial values.
     */
    public resetStats(): void {
        this.stats = {
            totalAttempts: 0,
            successfulReconnections: 0,
            failedReconnections: 0,
            failureRate: 0,
            circuitBreakerState: this.stats.circuitBreakerState, // Preserve circuit breaker state
            timeSinceLastConnectionMs: 0,
            averageReconnectionTimeMs: 0
        };
        
        this.currentSessionAttempts = [];
        this.lastSuccessfulConnectionTime = Date.now();
        
        this.logger.info('Reconnection statistics reset', {
            operation: 'reset-stats'
        });
    }

    /**
     * Gets a copy of the current configuration.
     * @returns {ReconnectionConfig | undefined} The current configuration, or undefined if not initialized.
     */
    public getConfig(): ReconnectionConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Updates the reconnection configuration.
     * @param {Partial<ReconnectionConfig>} newConfig - The configuration updates to apply.
     * @throws {ModuleNotInitializedError} If the module is not initialized.
     */
    public updateConfig(newConfig: Partial<ReconnectionConfig>): void {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ReconnectionManager', 'update config', {
                operation: 'update-config'
            });
        }

        if (this.config) {
            Object.assign(this.config, newConfig);
            
            this.logger.info('Configuration updated', {
                operation: 'config-update',
                updates: Object.keys(newConfig)
            });
        }
    }

    /**
     * Destroys the reconnection manager, cleaning up all timers and resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying ReconnectionManager', {
            operation: 'destroy'
        });
        
        this.destroyed = true;
        this._initialized = false;

        // Stop timers
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = undefined;
            this.retryWaitResolve?.();
            this.retryWaitResolve = undefined;
        }
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }

        if (this.circuitBreakerTimer) {
            clearTimeout(this.circuitBreakerTimer);
            this.circuitBreakerTimer = undefined;
        }

        // Clear event listeners
        this.eventListeners.clear();
        this.onceListeners.clear();

        // Reset circuit breaker
        this.stats.circuitBreakerState = CircuitBreakerState.CLOSED;

        // Mark current session as inactive
        if (this.stats.currentSession) {
            this.stats.currentSession.isActive = false;
        }

        resourceCleaner.unregister(this);
        
        this.logger.info('ReconnectionManager destroyed successfully', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }
}