/**
 * Transaction Manager Module - REFACTORED VERSION
 * 
 * Comprehensive transaction management system for HSQLDB databases with support
 * for complex transaction patterns, nested transactions, and transaction recovery.
 * 
 * **Key Improvements in Refactored Version:**
 * - Simplified connection management without complex session tracking
 * - Robust error handling and cleanup mechanisms
 * - Better separation of concerns between connection management and transaction logic
 * - Improved deadlock detection and retry logic
 * - More reliable resource cleanup and transaction state management
 * 
 * @author InitSysRev
 * @version 2.0.0 - Refactored for improved reliability
 * 
 * @example
 * ```typescript
 * // Initialize with HSQLManager
 * const manager = new HSQLManager(config);
 * await manager.initialize();
 * 
 * const transactionManager = new TransactionManager();
 * await transactionManager.initialize(manager);
 * 
 * // Execute a transaction with automatic retry on deadlock
 * const result = await transactionManager.executeTransaction(async (ctx) => {
 *     await ctx.execute('INSERT INTO players (name) VALUES (?)', ['PlayerName']);
 *     await ctx.execute('UPDATE stats SET login_count = login_count + 1 WHERE player_name = ?', ['PlayerName']);
 *     return { success: true };
 * });
 * 
 * // Manual transaction control
 * const transaction = await transactionManager.beginTransaction();
 * try {
 *     await transaction.execute('INSERT INTO ...');
 *     const savepoint = await transaction.createSavepoint('sp1');
 *     await transaction.execute('UPDATE ...');
 *     await transaction.commit();
 * } catch (error) {
 *     await transaction.rollback();
 *     throw error;
 * }
 * ```
 */

import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import { 
    HSQLDBError, 
    ModuleError, 
    TransactionError,
    InactiveTransactionError,
    TransactionDeadlockError,
    ErrorFactory 
} from '../../errors.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import { createModuleEventEmitter, type ModuleEventEmitter, type ModuleEventListener, createEventData } from '../../events.js';
import type { ConnectionManager } from '../connection/ConnectionManager.js';
import type { PerformanceMonitor } from '../performance/PerformanceMonitor.js';
import { TransactionContext } from './TransactionContext.js';

// Make TransactionContext available for export
export { TransactionContext };

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Transaction isolation levels
 */
export enum IsolationLevel {
    /** Isolation level value for read uncommitted, serialized as 'READ_UNCOMMITTED'. */
    READ_UNCOMMITTED = 'READ_UNCOMMITTED',
    /** Isolation level value for read committed, serialized as 'READ_COMMITTED'. */
    READ_COMMITTED = 'READ_COMMITTED',
    /** Isolation level value for repeatable read, serialized as 'REPEATABLE_READ'. */
    REPEATABLE_READ = 'REPEATABLE_READ',
    /** Isolation level value for serializable, serialized as 'SERIALIZABLE'. */
    SERIALIZABLE = 'SERIALIZABLE'
}

/**
 * Transaction states
 */
export enum TransactionState {
    /** Transaction state value for active, serialized as 'active'. */
    ACTIVE = 'active',
    /** Transaction state value for preparing, serialized as 'preparing'. */
    PREPARING = 'preparing',
    /** Transaction state value for prepared, serialized as 'prepared'. */
    PREPARED = 'prepared',
    /** Transaction state value for committing, serialized as 'committing'. */
    COMMITTING = 'committing',
    /** Transaction state value for committed, serialized as 'committed'. */
    COMMITTED = 'committed',
    /** Transaction state value for rolling back, serialized as 'rolling_back'. */
    ROLLING_BACK = 'rolling_back',
    /** Transaction state value for rolled back, serialized as 'rolled_back'. */
    ROLLED_BACK = 'rolled_back',
    /** Transaction state value for failed, serialized as 'failed'. */
    FAILED = 'failed',
    /** Transaction state value for timeout, serialized as 'timeout'. */
    TIMEOUT = 'timeout'
}

/**
 * Transaction execution options
 */
export interface TransactionOptions {
    /** Transaction isolation level */
    isolationLevel?: IsolationLevel;
    /** Transaction timeout in milliseconds */
    timeout?: number;
    /** Whether to auto-commit on success */
    autoCommit?: boolean;
    /** Maximum total attempts on deadlock (historical API); zero disables retries. */
    maxRetries?: number;
    /** Retry delay in milliseconds */
    retryDelay?: number;
    /** Enable transaction logging */
    enableLogging?: boolean;
    /** Transaction name for identification */
    name?: string;
    /** Read-only transaction */
    readOnly?: boolean;
}

/**
 * Transaction configuration
 */
export interface TransactionConfig {
    /** Default isolation level */
    defaultIsolationLevel?: IsolationLevel;
    /** Default timeout in milliseconds */
    defaultTimeout?: number;
    /** Maximum concurrent transactions */
    maxConcurrentTransactions?: number;
    /** Enable deadlock detection */
    enableDeadlockDetection?: boolean;
    /** Deadlock detection interval in milliseconds */
    deadlockDetectionInterval?: number;
    /** Enable transaction metrics collection */
    enableMetrics?: boolean;
    /** Savepoint name prefix */
    savepointPrefix?: string;
    /** Enable nested transaction support */
    enableNestedTransactions?: boolean;
}

/**
 * Default transaction configuration
 */
export const DEFAULT_TRANSACTION_CONFIG: Required<TransactionConfig> = {
    defaultIsolationLevel: IsolationLevel.READ_COMMITTED,
    defaultTimeout: 30000, // 30 seconds
    maxConcurrentTransactions: 50, // Reduced for better stability
    enableDeadlockDetection: true,
    deadlockDetectionInterval: 5000, // 5 seconds
    enableMetrics: true,
    savepointPrefix: 'sp_',
    enableNestedTransactions: true
};

// =============================================================================
// TRANSACTION DATA STRUCTURES
// =============================================================================

/**
 * Internal transaction state tracking
 */
interface InternalTransactionInfo {
    /** Transaction ID */
    id: string;
    /** Transaction name */
    name?: string;
    /** Current state */
    state: TransactionState;
    /** Isolation level */
    isolationLevel: IsolationLevel;
    /** Start timestamp */
    startTime: Date;
    /** End timestamp */
    endTime?: Date;
    /** Duration in milliseconds */
    duration?: number;
    /** Associated connection */
    connection: any; // JDBCConnection
    /** Transaction context */
    context: TransactionContext;
    /** Read-only flag */
    readOnly: boolean;
    /** Savepoints created */
    savepoints: string[];
    /** Parent transaction ID for nested transactions */
    parentTransactionId?: string;
    /** Child transaction IDs */
    childTransactionIds: string[];
    /** Transaction timeout */
    timeout: number;
    /** Error information if failed */
    error?: HSQLDBError;
    /** Cleanup handlers */
    cleanupHandlers: (() => Promise<void>)[];
}

/**
 * Public transaction information (exposed externally)
 */
export interface TransactionInfo {
    /** Transaction ID */
    id: string;
    /** Transaction name */
    name?: string;
    /** Current state */
    state: TransactionState;
    /** Isolation level */
    isolationLevel: IsolationLevel;
    /** Start timestamp */
    startTime: Date;
    /** End timestamp */
    endTime?: Date;
    /** Duration in milliseconds */
    duration?: number;
    /** Connection ID */
    connectionId: string;
    /** Read-only flag */
    readOnly: boolean;
    /** Savepoints created */
    savepoints: string[];
    /** Parent transaction ID for nested transactions */
    parentTransactionId?: string;
    /** Child transaction IDs */
    childTransactionIds: string[];
    /** Transaction timeout */
    timeout: number;
    /** Error information if failed */
    error?: HSQLDBError;
}

/**
 * Transaction statistics
 */
export interface TransactionStatistics {
    /** Total transactions executed */
    totalTransactions: number;
    /** Successful transactions */
    successfulTransactions: number;
    /** Failed transactions */
    failedTransactions: number;
    /** Rolled back transactions */
    rolledBackTransactions: number;
    /** Average transaction duration */
    averageDuration: number;
    /** Maximum transaction duration */
    maxDuration: number;
    /** Minimum transaction duration */
    minDuration: number;
    /** Deadlocks detected */
    deadlocksDetected: number;
    /** Timeouts occurred */
    timeoutsOccurred: number;
    /** Active transactions count */
    activeTransactions: number;
    /** Statistics collection period */
    collectionPeriod: {
        start: Date;
        end: Date;
    };
}

/**
 * Deadlock information
 */
export interface DeadlockInfo {
    /** Deadlock detection timestamp */
    detectedAt: Date;
    /** Involved transactions */
    involvedTransactions: string[];
    /** Resource dependencies */
    resourceDependencies: ResourceDependency[];
    /** Victim transaction chosen for rollback */
    victimTransaction: string;
    /** Resolution strategy used */
    resolutionStrategy: 'timeout' | 'victim_selection' | 'manual';
}

/**
 * Resource dependency for deadlock analysis
 */
export interface ResourceDependency {
    /** Transaction waiting for resource */
    waitingTransaction: string;
    /** Transaction holding resource */
    holdingTransaction: string;
    /** Resource identifier */
    resource: string;
    /** Resource type */
    resourceType: 'table' | 'row' | 'index' | 'sequence';
    /** Lock type */
    lockType: 'shared' | 'exclusive' | 'update';
}

/**
 * Transaction execution function type
 */
export type TransactionExecutor<T> = (context: TransactionContext) => Promise<T>;

/**
 * Transaction event types (string literal union)
 */
export type TransactionEvent = 
    | 'transaction:started'
    | 'transaction:committed' 
    | 'transaction:rolled-back'
    | 'transaction:failed'
    | 'transaction:timeout'
    | 'deadlock:detected'
    | 'savepoint:created'
    | 'savepoint:released'
    | 'savepoint:rolled-back';

// =============================================================================
// MAIN TRANSACTION MANAGER CLASS - REFACTORED VERSION
// =============================================================================

/**
 * TransactionManager Module - Refactored Version 2.0
 * 
 * Provides comprehensive transaction management capabilities for HSQLDB
 * with improved reliability, simplified architecture, and better error handling.
 */
export class TransactionManager implements BaseModule {
    /** Stable module identifier used when registering and looking up the module. */
    public readonly name = 'TransactionManager';
    /** Version of this module implementation. */
    public readonly version = '2.0.0';
    
    /** Owning manager used to resolve configuration and module dependencies. */
    private manager!: HSQLManager;
    /** Connection pool module used to borrow and release JDBC sessions. */
    private connectionManager!: ConnectionManager;
    /** Performance module that receives query and operation measurements. */
    private performanceMonitor?: PerformanceMonitor;
    /** Module logger for operation context and diagnostic errors. */
    private logger!: ModuleLogger;
    /** Emitter that dispatches this module’s lifecycle and operation events. */
    private eventEmitter!: ModuleEventEmitter<TransactionEvent>;
    /** Effective configuration applied to this instance. */
    private config!: TransactionConfig;
    /** Whether initialization completed successfully. */
    private initialized = false;
    /** Whether shutdown has begun; prevents new work while existing transactions are rolled back. */
    private destroying = false;
    /** Identifiers reserved by transaction starts that have not yet acquired a session. */
    private pendingTransactionIds = new Set<string>();
    
    // Simplified transaction tracking
    /** Active transaction contexts indexed by transaction identifier. */
    private activeTransactions: Map<string, InternalTransactionInfo> = new Map();
    /** Accumulated operation statistics exposed by this module. */
    private statistics: TransactionStatistics;
    /** Timer that periodically examines active transactions for deadlocks. */
    private deadlockDetectionTimer?: NodeJS.Timeout;
    /** Sequence used to generate transaction identifiers. */
    private nextTransactionId = 1;
    
    /** Creates a transaction manager with default configuration and lifecycle state. */
    constructor(config: TransactionConfig = {}) {
        this.config = { ...DEFAULT_TRANSACTION_CONFIG, ...config };
        this.statistics = this.initializeStatistics();
    }

    /** Whether initialization completed and the module is available for use. */
    public get isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Initialize the TransactionManager module
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this.initialized) {
            throw new ModuleError(
                'TransactionManager',
                'initialize',
                'TransactionManager already initialized'
            );
        }

        this.manager = manager;
        this.logger = createModuleLogger(this.name);
        this.config = { ...DEFAULT_TRANSACTION_CONFIG, ...this.config };

        // Initialize event emitter
        this.eventEmitter = createModuleEventEmitter<TransactionEvent>([
            'transaction:started',
            'transaction:committed', 
            'transaction:rolled-back',
            'transaction:failed',
            'transaction:timeout',
            'deadlock:detected',
            'savepoint:created',
            'savepoint:released',
            'savepoint:rolled-back'
        ], this.logger, this.name);

        this.logger.info('Initializing TransactionManager v2.0 (Refactored)', {
            operation: 'initialize'
        });

        // Get required dependencies
        const connectionManager = manager.getModule<ConnectionManager>('connection-manager');
        if (!connectionManager) {
            throw new ModuleError(
                'TransactionManager',
                'initialize',
                'ConnectionManager module required for TransactionManager'
            );
        }
        this.connectionManager = connectionManager;

        // Get optional performance monitor
        this.performanceMonitor = manager.getModule<PerformanceMonitor>('performance-monitor');

        this.initialized = true;
        this.destroying = false;
        this.logger.info('TransactionManager v2.0 initialized successfully', {
            hasPerformanceMonitor: !!this.performanceMonitor,
            maxConcurrentTransactions: this.config.maxConcurrentTransactions
        });
    }

    /** Create zeroed transaction statistics before operations are recorded. */
    private initializeStatistics(): TransactionStatistics {
        const now = new Date();
        return {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            rolledBackTransactions: 0,
            averageDuration: 0,
            maxDuration: 0,
            minDuration: 0,
            deadlocksDetected: 0,
            timeoutsOccurred: 0,
            activeTransactions: 0,
            collectionPeriod: {
                start: now,
                end: now
            }
        };
    }

    /**
     * Begin a new transaction with simplified connection management
     */
    public async beginTransaction(transactionId?: string, options: TransactionOptions = {}): Promise<TransactionContext> {
        this.ensureCanBeginTransaction();
        
        // Check transaction limits
        if ((this.activeTransactions.size + this.pendingTransactionIds.size) >= this.config.maxConcurrentTransactions!) {
            throw new ModuleError(
                'TransactionManager',
                'beginTransaction',
                `Maximum concurrent transactions exceeded: ${this.activeTransactions.size}/${this.config.maxConcurrentTransactions!}`
            );
        }

        const id = transactionId || this.generateTransactionId();
        if (this.activeTransactions.has(id) || this.pendingTransactionIds.has(id)) {
            throw new ModuleError('TransactionManager', 'beginTransaction', `Transaction '${id}' already exists`);
        }
        const mergedOptions = { ...this.getDefaultOptions(), ...options };
        
        this.logger.info('Beginning transaction v2.0', {
            operation: 'begin-transaction',
            transactionId: id,
            options: mergedOptions
        });

        let connection: any = null;
        let context: TransactionContext | null = null;
        let previousState: {autoCommit: boolean; readOnly: boolean; isolationLevel: number} | undefined;

        this.pendingTransactionIds.add(id);
        try {
            // Get connection directly from ConnectionManager
            connection = await this.connectionManager.getConnection();
            this.ensureCanBeginTransaction();
            previousState = await connection.getSessionState?.() ?? {autoCommit: true, readOnly: false, isolationLevel: 2};
            
            // Set isolation level if specified
            if (mergedOptions.isolationLevel) {
                await this.setIsolationLevel(connection, mergedOptions.isolationLevel);
            }

            // Set read-only if specified
            await this.setReadOnly(connection, mergedOptions.readOnly ?? false);

            // Begin transaction
            await connection.setAutoCommit(false);
            this.ensureCanBeginTransaction();

            // Create transaction context
            context = new TransactionContext(
                id,
                connection,
                this,
                mergedOptions
            );

            // Create internal transaction info
            const internalInfo: InternalTransactionInfo = {
                id,
                name: mergedOptions.name || undefined,
                state: TransactionState.ACTIVE,
                isolationLevel: mergedOptions.isolationLevel || this.config.defaultIsolationLevel!,
                startTime: new Date(),
                connection,
                context,
                readOnly: mergedOptions.readOnly || false,
                savepoints: [],
                childTransactionIds: [],
                timeout: mergedOptions.timeout || this.config.defaultTimeout!,
                cleanupHandlers: []
            };

            // Add cleanup handler for connection release
            internalInfo.cleanupHandlers.push(async () => {
                if (connection) {
                    try {
                        if (internalInfo.state === TransactionState.FAILED) await connection.rollback();
                        await connection.setTransactionIsolation(previousState!.isolationLevel);
                        await connection.setReadOnly(previousState!.readOnly);
                        await connection.setAutoCommit(previousState!.autoCommit);
                        await this.connectionManager.releaseConnection(connection);
                    } catch (error) {
                        await (connection.discard ? connection.discard() : connection.close());
                        await this.connectionManager.releaseConnection(connection);
                        this.logger.warn('Failed to restore connection during cleanup', {
                            transactionId: id,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            });

            // Track transaction
            this.pendingTransactionIds.delete(id);
            this.activeTransactions.set(id, internalInfo);
            
            // Update statistics
            this.statistics.totalTransactions++;
            this.statistics.activeTransactions++;

            // Emit event
            this.eventEmitter.emit('transaction:started', createEventData('transaction:started', {
                transactionId: id,
                timestamp: new Date()
            }, this.name));

            this.logger.info('Transaction started successfully v2.0', {
                operation: 'begin-transaction-success',
                transactionId: id,
                connectionId: (connection as any).id || 'unknown'
            });

            return context;

        } catch (error) {
            // Cleanup on failure
            if (context) {
                try {
                    await context.rollback('Transaction initialization failed');
                } catch (rollbackError) {
                    this.logger.warn('Failed to rollback during transaction creation failure', {
                        transactionId: id,
                        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                    });
                    const tracked = this.activeTransactions.get(id);
                    if (tracked) {
                        if (tracked.state === TransactionState.ACTIVE) {
                            tracked.state = TransactionState.FAILED;
                            this.statistics.failedTransactions++;
                            this.statistics.activeTransactions--;
                        }
                        await this.cleanupTransaction(id);
                    }
                }
            } else if (connection) {
                try {
                    await (connection.discard ? connection.discard() : connection.close());
                    await this.connectionManager.releaseConnection(connection);
                } catch (releaseError) {
                    this.logger.warn('Failed to release connection during transaction creation failure', {
                        transactionId: id,
                        error: releaseError instanceof Error ? releaseError.message : String(releaseError)
                    });
                }
            }

            this.logger.error('Failed to begin transaction v2.0', {
                operation: 'begin-transaction-error',
                transactionId: id,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ModuleError(
                'TransactionManager',
                'beginTransaction',
                `Failed to begin transaction: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.pendingTransactionIds.delete(id);
        }
    }

    /**
     * Execute a transaction with automatic retry on deadlock
     */
    public async executeTransaction<T>(
        executor: TransactionExecutor<T>,
        options: TransactionOptions = {}
    ): Promise<T> {
        this.ensureInitialized();
        
        const requestedAttempts = options.maxRetries ?? 3;
        if (!Number.isInteger(requestedAttempts) || requestedAttempts < 0) {
            throw new ModuleError('TransactionManager', 'executeTransaction', 'Retry attempts must be a non-negative integer');
        }
        const maxRetries = Math.max(1, requestedAttempts);
        const retryDelay = options.retryDelay ?? 1000;
        if (!Number.isFinite(retryDelay) || retryDelay < 0) {
            throw new ModuleError('TransactionManager', 'executeTransaction', 'Retry delay must be a finite non-negative number');
        }
        
        for (let attempt = 1; ; attempt++) {
            const transaction = await this.beginTransaction(undefined, options);
            
            try {
                const result = await executor(transaction);
                await transaction.commit();
                return result;
                
            } catch (error) {
                if (transaction.isHealthy()) {
                    await transaction.rollback(`Transaction failed on attempt ${attempt}`);
                }
                
                // Check if this is a deadlock error that we should retry
                const isDeadlock = this.isDeadlockError(error);
                const shouldRetry = isDeadlock && attempt < maxRetries;
                
                if (shouldRetry) {
                    this.logger.warn('Deadlock detected, retrying transaction v2.0', {
                        operation: 'execute-transaction-retry',
                        attempt,
                        maxRetries,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                throw error;
            }
        }
        
    }

    /**
     * Commit a transaction
     */
    public async commitTransaction(transactionId: string): Promise<void> {
        this.ensureInitialized();
        
        const internalInfo = this.activeTransactions.get(transactionId);
        if (!internalInfo) {
            throw new InactiveTransactionError(transactionId, {
                operation: 'commit-transaction'
            });
        }

        this.logger.info('Committing transaction v2.0', {
            operation: 'commit-transaction',
            transactionId
        });

        try {
            // Update state
            internalInfo.state = TransactionState.COMMITTING;
            
            // Commit the transaction
            await internalInfo.connection.commit();
            
            // Update transaction info
            internalInfo.state = TransactionState.COMMITTED;
            internalInfo.endTime = new Date();
            internalInfo.duration = internalInfo.endTime.getTime() - internalInfo.startTime.getTime();
            
            // Update statistics
            this.statistics.successfulTransactions++;
            this.statistics.activeTransactions--;
            this.updateDurationStatistics(internalInfo.duration);
            
            // Emit event
            this.eventEmitter.emit('transaction:committed', createEventData('transaction:committed', {
                transactionId,
                timestamp: new Date(),
                duration: internalInfo.duration
            }, this.name));
            
            this.logger.info('Transaction committed successfully v2.0', {
                operation: 'commit-transaction-success',
                transactionId,
                duration: internalInfo.duration
            });

        } catch (error) {
            internalInfo.state = TransactionState.FAILED;
            internalInfo.error = error instanceof HSQLDBError ? error : 
                new TransactionError(transactionId, 'commit', error instanceof Error ? error.message : String(error));
            
            this.statistics.failedTransactions++;
            this.statistics.activeTransactions--;
            
            this.logger.error('Transaction commit failed v2.0', {
                operation: 'commit-transaction-error',
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            // Emit event
            this.eventEmitter.emit('transaction:failed', createEventData('transaction:failed', {
                transactionId,
                timestamp: new Date(),
                error: internalInfo.error
            }, this.name));
            
            throw internalInfo.error;
        } finally {
            // Always cleanup
            await this.cleanupTransaction(transactionId);
        }
    }

    /**
     * Rollback a transaction
     */
    public async rollbackTransaction(transactionId: string, reason?: string): Promise<void> {
        this.ensureInitialized();
        
        const internalInfo = this.activeTransactions.get(transactionId);
        if (!internalInfo) {
            throw new InactiveTransactionError(transactionId, {
                operation: 'rollback-transaction'
            });
        }

        this.logger.info('Rolling back transaction v2.0', {
            operation: 'rollback-transaction',
            transactionId,
            reason
        });

        try {
            // Update state
            internalInfo.state = TransactionState.ROLLING_BACK;
            
            // Do not release or reset a session while its rollback is still running.
            await internalInfo.connection.rollback();

            // Update transaction info
            internalInfo.state = TransactionState.ROLLED_BACK;
            internalInfo.endTime = new Date();
            internalInfo.duration = internalInfo.endTime.getTime() - internalInfo.startTime.getTime();
            
            // Update statistics
            this.statistics.rolledBackTransactions++;
            this.statistics.activeTransactions--;
            
            // Emit event
            this.eventEmitter.emit('transaction:rolled-back', createEventData('transaction:rolled-back', {
                transactionId,
                timestamp: new Date(),
                reason: reason || 'Manual rollback'
            }, this.name));
            
            this.logger.info('Transaction rolled back successfully v2.0', {
                operation: 'rollback-transaction-success',
                transactionId,
                reason
            });

        } catch (error) {
            // ENHANCED: Better error handling for rollback failures
            internalInfo.state = TransactionState.FAILED;
            internalInfo.error = error instanceof HSQLDBError ? error : 
                new TransactionError(transactionId, 'rollback', error instanceof Error ? error.message : String(error));
            
            this.logger.error('Transaction rollback failed v2.0', {
                operation: 'rollback-transaction-error',
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            this.statistics.failedTransactions++;
            this.statistics.activeTransactions--;
            throw internalInfo.error;
        } finally {
            await this.cleanupTransaction(transactionId);
        }
    }

    /**
     * Enhanced cleanup transaction resources
     */
    private async cleanupTransaction(transactionId: string): Promise<void> {
        const internalInfo = this.activeTransactions.get(transactionId);
        if (!internalInfo) {
            return;
        }

        this.logger.debug('Cleaning up transaction v2.0', {
            operation: 'cleanup-transaction',
            transactionId
        });

        try {
            internalInfo.context.invalidate();
            // Execute all cleanup handlers
            const cleanupPromises = internalInfo.cleanupHandlers.map(handler => 
                Promise.resolve().then(handler).catch(error => {
                    this.logger.warn('Cleanup handler failed', {
                        transactionId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                })
            );

            await Promise.allSettled(cleanupPromises);
            
            
        } finally {
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Get transaction statistics
     */
    public getStatistics(): TransactionStatistics {
        return { ...this.statistics };
    }

    /**
     * Get active transaction count
     */
    public getActiveTransactionCount(): number {
        return this.activeTransactions.size;
    }

    /**
     * Get transaction information (converted to public format)
     */
    public getTransactionInfo(transactionId: string): TransactionInfo | undefined {
        const internalInfo = this.activeTransactions.get(transactionId);
        if (!internalInfo) {
            return undefined;
        }

        return {
            id: internalInfo.id,
            name: internalInfo.name,
            state: internalInfo.state,
            isolationLevel: internalInfo.isolationLevel,
            startTime: internalInfo.startTime,
            endTime: internalInfo.endTime,
            duration: internalInfo.duration,
            connectionId: (internalInfo.connection as any).id || 'unknown',
            readOnly: internalInfo.readOnly,
            savepoints: [...internalInfo.savepoints],
            parentTransactionId: internalInfo.parentTransactionId,
            childTransactionIds: [...internalInfo.childTransactionIds],
            timeout: internalInfo.timeout,
            error: internalInfo.error
        };
    }

    /**
     * Forces cleanup of all active transactions.
     * This is intended for emergency cleanup scenarios.
     */
    public async rollbackAllTransactions(reason?: string): Promise<void> {
        const transactionIds = Array.from(this.activeTransactions.keys());
        this.logger.warn('Rolling back all active transactions', {
            operation: 'rollback-all-transactions',
            activeTransactions: transactionIds.length,
            reason: reason || 'Emergency cleanup'
        });
        // A JDBC rollback must finish before cleanup can restore or release its session.
        const results = await Promise.allSettled(transactionIds.map(id =>
            this.rollbackTransaction(id, reason || 'Forced rollback')
        ));
        const failures: unknown[] = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                failures.push(result.reason);
                this.logger.warn('Failed to rollback transaction during mass rollback', {
                    operation: 'rollback-all-error',
                    transactionId: transactionIds[index],
                    error: result.reason instanceof Error ? result.reason.message : String(result.reason)
                });
            }
        });
        this.logger.info('Mass rollback finished', {
            operation: 'rollback-all-complete',
            processedTransactions: transactionIds.length,
            remainingActive: this.activeTransactions.size
        });
        if (failures.length > 0) {
            throw new AggregateError(failures, `Failed to rollback ${failures.length} transaction(s)`);
        }
    }

    /**
     * Emergency cleanup - forces removal of all tracked transactions without attempting rollbacks
     * This should only be used in extreme situations when normal cleanup fails
     */
    public forceCleanupAllTransactions(reason: string = 'Emergency force cleanup'): void {
        this.logger.warn('Force cleaning all transactions v2.0', {
            operation: 'force-cleanup-all',
            activeTransactions: this.activeTransactions.size,
            reason
        });

        const transactionIds = Array.from(this.activeTransactions.keys());
        
        // Prevent retained contexts from executing against sessions no longer tracked here.
        for (const info of this.activeTransactions.values()) info.context.invalidate();
        // This emergency API only clears tracking; normal rollback performs session cleanup.
        this.activeTransactions.clear();
        
        // Reset statistics
        this.statistics.activeTransactions = 0;
        
        this.logger.info('Force cleanup completed v2.0', {
            operation: 'force-cleanup-complete',
            clearedTransactions: transactionIds.length
        });
    }

    /**
     * Gets debugging information about all active transactions
     */
    public getActiveTransactionsDebugInfo(): Array<{
        transactionId: string;
        state: TransactionState;
        isolationLevel: IsolationLevel;
        startTime: Date;
        duration: number;
        connectionId: string;
        queryCount: number;
    }> {
        const debugInfo: Array<any> = [];

        for (const [transactionId, internalInfo] of this.activeTransactions.entries()) {
            debugInfo.push({
                transactionId,
                state: internalInfo.state,
                isolationLevel: internalInfo.isolationLevel,
                startTime: internalInfo.startTime,
                duration: Date.now() - internalInfo.startTime.getTime(),
                connectionId: (internalInfo.connection as any).id || 'unknown',
                queryCount: internalInfo.context.getState().queryCount || 0
            });
        }

        return debugInfo;
    }

    /**
     * Update duration statistics for committed transactions, excluding failed and rolled-back attempts.
     */
    private updateDurationStatistics(duration: number): void {
        if (this.statistics.successfulTransactions <= 1) {
            this.statistics.averageDuration = duration;
            this.statistics.maxDuration = duration;
            this.statistics.minDuration = duration;
        } else {
            this.statistics.averageDuration = 
                (this.statistics.averageDuration * (this.statistics.successfulTransactions - 1) + duration) / 
                this.statistics.successfulTransactions;
            this.statistics.maxDuration = Math.max(this.statistics.maxDuration, duration);
            this.statistics.minDuration = Math.min(this.statistics.minDuration, duration);
        }
    }

    /**
     * Generate a unique transaction ID
     */
    private generateTransactionId(): string {
        return `tx_v2_${Date.now()}_${this.nextTransactionId++}`;
    }

    /**
     * Get default transaction options
     */
    private getDefaultOptions(): TransactionOptions {
        return {
            isolationLevel: this.config.defaultIsolationLevel!,
            timeout: this.config.defaultTimeout!,
            autoCommit: true,
            maxRetries: 3,
            retryDelay: 1000,
            enableLogging: true,
            readOnly: false
        };
    }

    /**
     * Set transaction isolation level
     */
    private async setIsolationLevel(connection: any, level: IsolationLevel): Promise<void> {
        try {
            // Map isolation levels to JDBC constants
            const isolationMap = {
                [IsolationLevel.READ_UNCOMMITTED]: 1, // TRANSACTION_READ_UNCOMMITTED
                [IsolationLevel.READ_COMMITTED]: 2,   // TRANSACTION_READ_COMMITTED
                [IsolationLevel.REPEATABLE_READ]: 4,  // TRANSACTION_REPEATABLE_READ
                [IsolationLevel.SERIALIZABLE]: 8      // TRANSACTION_SERIALIZABLE
            };
            
            await connection.setTransactionIsolation(isolationMap[level]);
        } catch (error) {
            this.logger.warn('Failed to set isolation level v2.0', {
                operation: 'set-isolation-level',
                level,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Set transaction read-only status
     */
    private async setReadOnly(connection: any, readOnly: boolean): Promise<void> {
        try {
            await connection.setReadOnly(readOnly);
        } catch (error) {
            this.logger.warn('Failed to set read-only status v2.0', {
                operation: 'set-read-only',
                readOnly,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Check if error is a deadlock error
     */
    private isDeadlockError(error: any): boolean {
        if (!error) return false;
        
        // Check if it's already a TransactionDeadlockError
        if (error instanceof TransactionDeadlockError) return true;
        
        const message = error.message || String(error);
        return message.toLowerCase().includes('deadlock') ||
               message.toLowerCase().includes('timeout') ||
               message.includes('40001'); // SQL State for deadlock
    }

    /**
     * Rejects transaction creation outside the initialized, non-shutdown lifecycle state.
     * @throws {ModuleError} If initialization has not completed or shutdown has started.
     * @private
     */
    private ensureCanBeginTransaction(): void {
        this.ensureInitialized();
        if (this.destroying) {
            throw new ModuleError('TransactionManager', 'beginTransaction', 'Transaction manager is shutting down');
        }
    }

    /**
     * Ensure module is initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new ModuleError(
                'TransactionManager',
                'ensureInitialized',
                'TransactionManager not initialized'
            );
        }
    }

    /**
     * Destroy the module and cleanup resources
     */
    public async destroy(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        this.destroying = true;
        this.logger.info('Destroying TransactionManager v2.0', {
            operation: 'destroy'
        });

        try {
            // Stop deadlock detection
            if (this.deadlockDetectionTimer) {
                clearInterval(this.deadlockDetectionTimer);
                this.deadlockDetectionTimer = undefined;
            }

            // Rollback all active transactions
            await this.rollbackAllTransactions('TransactionManager destruction');

            // Cleanup event emitter
            this.eventEmitter.removeAllListeners();

            this.initialized = false;

            this.logger.info('TransactionManager v2.0 destroyed successfully', {
                operation: 'destroy-complete'
            });

        } catch (error) {
            this.logger.error('Failed to destroy TransactionManager v2.0', {
                operation: 'destroy-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    // =============================================================================
    // EVENT EMITTER INTERFACE IMPLEMENTATION
    // =============================================================================

    /**
     * Add event listener
     */
    public on(event: TransactionEvent, listener: ModuleEventListener<TransactionEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Add one-time event listener
     */
    public once(event: TransactionEvent, listener: ModuleEventListener<TransactionEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Remove event listener
     */
    public off(event: TransactionEvent, listener: ModuleEventListener<TransactionEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emit event
     */
    public emit(event: TransactionEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Remove all listeners for an event or all events
     */
    public removeAllListeners(event?: TransactionEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Get listener count for an event
     */
    public listenerCount(event: TransactionEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Get all events that have listeners
     */
    public eventNames(): TransactionEvent[] {
        return this.eventEmitter.eventNames();
    }
}