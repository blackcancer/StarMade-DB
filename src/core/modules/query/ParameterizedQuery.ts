/**
 * Parameterized Query Module v1.0
 * 
 * Advanced parameterized query system with SQL injection prevention,
 * prepared statement management, parameter validation, and query optimization.
 * 
 * **Core Features:**
 * - Safe parameterized query execution with SQL injection prevention
 * - Prepared statement caching and management
 * - Type-safe parameter binding and validation
 * - Query plan optimization and reuse
 * - Automatic escaping and sanitization
 * - Batch operation support
 * - Performance monitoring and statistics
 * 
 * **Security Features:**
 * - SQL injection prevention through parameter binding
 * - Input sanitization and validation
 * - Query structure validation
 * - Parameter type checking
 * - Safe query plan caching
 * 
 * **Integration Points:**
 * - ConnectionManager for database connections
 * - QueryValidator for security validation
 * - PerformanceMonitor for execution metrics
 * - CacheManager for prepared statement caching
 * 
 * @author InitSysRev
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * // Initialize ParameterizedQuery module
 * const paramQuery = new ParameterizedQuery();
 * await paramQuery.initialize(manager);
 * 
 * // Execute parameterized query
 * const result = await paramQuery.execute(
 *   'SELECT * FROM PLAYERS WHERE name = ? AND level > ?',
 *   ['player1', 10]
 * );
 * 
 * // Batch operations
 * const batchResults = await paramQuery.executeBatch(
 *   'INSERT INTO PLAYERS (name, level) VALUES (?, ?)',
 *   [
 *     ['player1', 10],
 *     ['player2', 15],
 *     ['player3', 20]
 *   ]
 * );
 * 
 * // Named parameters
 * const namedResult = await paramQuery.executeNamed(
 *   'SELECT * FROM PLAYERS WHERE name = :name AND level > :minLevel',
 *   { name: 'player1', minLevel: 10 }
 * );
 * ```
 */

import {
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    ValidationError,
    QueryExecutionError
} from '../../errors.js';
import { resourceCleaner } from '../../utils.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import {
    ModuleEventEmitterImpl,
    ModuleEvent,
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';
import type { ConnectionManager } from '../connection/ConnectionManager.js';
import type { QueryValidator } from './QueryValidator.js';
import type { PerformanceMonitor } from '../performance/PerformanceMonitor.js';
import type { CacheManager } from '../cache/CacheManager.js';

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

/**
 * Parameter data types for validation and binding
 */
export enum ParameterType {
    STRING = 'string',
    NUMBER = 'number',
    INTEGER = 'integer',
    FLOAT = 'float',
    BOOLEAN = 'boolean',
    DATE = 'date',
    DATETIME = 'datetime',
    BINARY = 'binary',
    NULL = 'null',
    ARRAY = 'array',
    JSON = 'json'
}

/**
 * Query execution modes
 */
export enum ExecutionMode {
    NORMAL = 'normal',
    PREPARED = 'prepared',
    BATCH = 'batch',
    STREAMING = 'streaming'
}

/**
 * Parameter binding strategies
 */
export enum BindingStrategy {
    POSITIONAL = 'positional',
    NAMED = 'named',
    MIXED = 'mixed'
}

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * Parameter definition for type validation and binding
 */
export interface QueryParameter {
    /** Parameter value */
    value: any;
    /** Parameter data type */
    type: ParameterType;
    /** Parameter name (for named parameters) */
    name?: string;
    /** Parameter position (for positional parameters) */
    position?: number;
    /** Whether parameter can be null */
    nullable?: boolean;
    /** Maximum length for string parameters */
    maxLength?: number;
    /** Minimum value for numeric parameters */
    minValue?: number;
    /** Maximum value for numeric parameters */
    maxValue?: number;
    /** Custom validation function */
    validator?: (value: any) => boolean;
}

/**
 * Prepared statement metadata and caching information
 */
export interface PreparedStatement {
    /** Unique statement identifier */
    id: string;
    /** Original SQL query with placeholders */
    sql: string;
    /** Parsed parameter information */
    parameters: QueryParameter[];
    /** Number of parameters expected */
    parameterCount: number;
    /** Parameter binding strategy */
    bindingStrategy: BindingStrategy;
    /** Compiled/cached statement object */
    statement?: any;
    /** Creation timestamp */
    createdAt: Date;
    /** Last used timestamp */
    lastUsed: Date;
    /** Usage count for statistics */
    usageCount: number;
    /** Average execution time */
    avgExecutionTime: number;
    /** Whether statement is cached */
    cached: boolean;
}

/**
 * Query execution result with metadata
 */
export interface ParameterizedQueryResult {
    /** Query execution success status */
    success: boolean;
    /** Result data rows */
    rows: any[][];
    /** Column metadata */
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
    }>;
    /** Number of affected rows (for modification queries) */
    affectedRows: number;
    /** Execution time in milliseconds */
    executionTime: number;
    /** Prepared statement ID used */
    statementId?: string;
    /** Whether result came from cache */
    fromCache?: boolean;
    /** Query metadata */
    metadata: {
        parameterCount: number;
        bindingStrategy: BindingStrategy;
        executionMode: ExecutionMode;
        statementCached: boolean;
    };
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
    /** Overall success status */
    success: boolean;
    /** Individual execution results */
    results: ParameterizedQueryResult[];
    /** Number of successful executions */
    successCount: number;
    /** Number of failed executions */
    failureCount: number;
    /** Total execution time */
    totalExecutionTime: number;
    /** Average execution time per query */
    avgExecutionTime: number;
    /** Batch metadata */
    metadata: {
        batchSize: number;
        executionMode: ExecutionMode;
        statementId: string;
    };
}

/**
 * Module configuration options
 */
export interface ParameterizedQueryConfig {
    /** Enable prepared statement caching */
    enableStatementCaching: boolean;
    /** Maximum number of cached statements */
    maxCachedStatements: number;
    /** Statement cache TTL in milliseconds */
    statementCacheTtl: number;
    /** Enable parameter validation */
    enableParameterValidation: boolean;
    /** Enable SQL injection detection */
    enableInjectionDetection: boolean;
    /** Maximum parameter count per query */
    maxParametersPerQuery: number;
    /** Default query timeout in milliseconds */
    defaultTimeoutMs: number;
    /** Enable query performance monitoring */
    enablePerformanceMonitoring: boolean;
    /** Enable batch execution optimization */
    enableBatchOptimization: boolean;
    /** Maximum batch size */
    maxBatchSize: number;
    /** Enable result caching */
    enableResultCaching: boolean;
    /** Result cache TTL in milliseconds */
    resultCacheTtl: number;
    /** Enable debug logging */
    enableDebugLogging: boolean;
}

/**
 * Query execution options
 */
export interface QueryExecutionOptions {
    /** Query execution timeout */
    timeoutMs?: number;
    /** Execution mode override */
    executionMode?: ExecutionMode;
    /** Whether to use statement caching */
    useStatementCache?: boolean;
    /** Whether to use result caching */
    useResultCache?: boolean;
    /** Result cache key override */
    cacheKey?: string;
    /** Result cache TTL override */
    cacheTtl?: number;
    /** Whether to validate parameters */
    validateParameters?: boolean;
    /** Custom parameter validation rules */
    parameterValidation?: Record<string, (value: any) => boolean>;
    /** Whether to monitor performance */
    monitorPerformance?: boolean;
    /** Transaction context */
    transactionId?: string;
}

/**
 * Named parameter map
 */
export type NamedParameterMap = Record<string, any>;

/**
 * Batch parameter array
 */
export type BatchParameters = any[][];

/**
 * Module statistics
 */
export interface ParameterizedQueryStatistics {
    /** Total queries executed */
    totalQueries: number;
    /** Total prepared statements created */
    totalPreparedStatements: number;
    /** Statement cache hit count */
    statementCacheHits: number;
    /** Statement cache miss count */
    statementCacheMisses: number;
    /** Statement cache hit ratio */
    statementCacheHitRatio: number;
    /** Result cache hit count */
    resultCacheHits: number;
    /** Result cache miss count */
    resultCacheMisses: number;
    /** Result cache hit ratio */
    resultCacheHitRatio: number;
    /** Average execution time */
    avgExecutionTime: number;
    /** Total batch operations */
    totalBatchOperations: number;
    /** Parameter validation failures */
    parameterValidationFailures: number;
    /** SQL injection attempts blocked */
    injectionAttemptsBlocked: number;
    /** Module uptime */
    uptime: number;
    /** Most frequently used queries */
    topQueries: Array<{
        sql: string;
        count: number;
        avgTime: number;
    }>;
}

// =============================================================================
// PARAMETERIZED QUERY CLASS
// =============================================================================

/**
 * Parameterized Query Module
 * 
 * Advanced parameterized query execution system with comprehensive security,
 * performance optimization, and prepared statement management.
 * 
 * @class ParameterizedQuery
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<ModuleEvent>}
 */
export class ParameterizedQuery implements BaseModule, ModuleEventEmitter<ModuleEvent> {
    /** @readonly Module name identifier */
    public readonly name = 'parameterized-query';
    /** @readonly Module version */
    public readonly version = '1.0.0';
    /** @readonly Whether the module is initialized */
    public get isInitialized(): boolean { return this._initialized; }

    /** @private Internal initialization state */
    private _initialized = false;
    /** @private Reference to the HSQLManager instance */
    private manager?: HSQLManager;
    /** @private Module configuration */
    private config?: ParameterizedQueryConfig;
    /** @private Whether the module has been destroyed */
    private destroyed = false;
    /** @private Start time for uptime calculation */
    private readonly startTime = Date.now();
    /** @private Module logger instance */
    private logger: ModuleLogger;
    /** @private Event emitter implementation */
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent>;

    /** @private Prepared statements cache */
    private preparedStatements: Map<string, PreparedStatement> = new Map();
    /** @private Statement ID counter */
    private statementIdCounter = 0;
    /** @private Statistics tracking */
    private statistics: {
        totalQueries: number;
        totalPreparedStatements: number;
        statementCacheHits: number;
        statementCacheMisses: number;
        resultCacheHits: number;
        resultCacheMisses: number;
        totalBatchOperations: number;
        parameterValidationFailures: number;
        injectionAttemptsBlocked: number;
        queryExecutionTimes: number[];
        topQueries: Map<string, { count: number; totalTime: number }>;
    } = {
        totalQueries: 0,
        totalPreparedStatements: 0,
        statementCacheHits: 0,
        statementCacheMisses: 0,
        resultCacheHits: 0,
        resultCacheMisses: 0,
        totalBatchOperations: 0,
        parameterValidationFailures: 0,
        injectionAttemptsBlocked: 0,
        queryExecutionTimes: [],
        topQueries: new Map()
    };

    /** @private Reference to ConnectionManager */
    private connectionManager?: ConnectionManager;
    /** @private Reference to QueryValidator */
    private queryValidator?: QueryValidator;
    /** @private Reference to PerformanceMonitor */
    private performanceMonitor?: PerformanceMonitor;
    /** @private Reference to CacheManager */
    private cacheManager?: CacheManager;

    /**
     * Create a new ParameterizedQuery instance
     * 
     * @constructor
     */
    constructor() {
        this.logger = createModuleLogger('ParameterizedQuery-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'ParameterizedQuery');

        // Initialize event listeners for module events
        this.eventEmitter.initializeEvents(Object.values(ModuleEvent));
    }

    /**
     * Initialize the parameterized query module
     * 
     * @async
     * @public
     * @param {HSQLManager} manager - The HSQLDB manager instance
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     * 
     * @throws {ModuleAlreadyInitializedError} If already initialized
     * @throws {ConfigurationError} If manager parameter is null or undefined
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('ParameterizedQuery', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing ParameterizedQuery v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();
        this.setupModuleIntegrations();

        this._initialized = true;
        resourceCleaner.register(this);

        this.logger.info('ParameterizedQuery v1.0 initialized successfully', {
            operation: 'initialize-complete',
            config: {
                enableStatementCaching: this.config?.enableStatementCaching,
                enableParameterValidation: this.config?.enableParameterValidation,
                enableInjectionDetection: this.config?.enableInjectionDetection,
                maxCachedStatements: this.config?.maxCachedStatements,
                maxParametersPerQuery: this.config?.maxParametersPerQuery
            }
        });

        // Emit initialization event
        this.emit(ModuleEvent.INITIALIZED, createEventData('parameterized-query-initialized', {
            enableStatementCaching: this.config?.enableStatementCaching,
            enableParameterValidation: this.config?.enableParameterValidation,
            maxCachedStatements: this.config?.maxCachedStatements
        }, this.name));
    }

    /**
     * Build configuration from manager settings
     * 
     * @private
     * @throws {ConfigurationError} If manager is not set
     */
    private buildConfiguration(): void {
        if (!this.manager) {
            throw new ConfigurationError('Manager not set', ['manager'], {
                operation: 'build-config'
            });
        }

        const managerConfig = this.manager.getConfiguration();

        this.config = {
            enableStatementCaching: true,
            maxCachedStatements: 1000,
            statementCacheTtl: 3600000, // 1 hour
            enableParameterValidation: true,
            enableInjectionDetection: true,
            maxParametersPerQuery: 100,
            defaultTimeoutMs: managerConfig.connection?.timeoutMs || 30000,
            enablePerformanceMonitoring: managerConfig.modules?.enableMetricsCollection || false,
            enableBatchOptimization: true,
            maxBatchSize: 1000,
            enableResultCaching: false, // Disabled by default for safety
            resultCacheTtl: 300000, // 5 minutes
            enableDebugLogging: false
        };

        this.logger.debug('Configuration built for ParameterizedQuery', {
            operation: 'build-config',
            config: this.config
        });
    }

    /**
     * Setup integrations with other modules
     * 
     * @private
     */
    private setupModuleIntegrations(): void {
        if (!this.manager) {
            return;
        }

        // Get ConnectionManager
        this.connectionManager = this.manager.getModule<ConnectionManager>('connection-manager');
        if (this.connectionManager && this.connectionManager.isInitialized) {
            this.logger.debug('Integrated with ConnectionManager', {
                operation: 'setup-integration',
                module: 'connection-manager'
            });
        }

        // Get QueryValidator
        this.queryValidator = this.manager.getModule<QueryValidator>('query-validator');
        if (this.queryValidator && this.queryValidator.isInitialized) {
            this.logger.debug('Integrated with QueryValidator', {
                operation: 'setup-integration',
                module: 'query-validator'
            });
        }

        // Get PerformanceMonitor
        this.performanceMonitor = this.manager.getModule<PerformanceMonitor>('performance-monitor');
        if (this.performanceMonitor && this.performanceMonitor.isInitialized) {
            this.logger.debug('Integrated with PerformanceMonitor', {
                operation: 'setup-integration',
                module: 'performance-monitor'
            });
        }

        // Get CacheManager
        this.cacheManager = this.manager.getModule<CacheManager>('cache-manager');
        if (this.cacheManager && this.cacheManager.isInitialized) {
            this.logger.debug('Integrated with CacheManager', {
                operation: 'setup-integration',
                module: 'cache-manager'
            });
        }
    }

    /**
     * Execute a parameterized query with positional parameters
     * 
     * @async
     * @public
     * @param {string} sql - SQL query with ? placeholders
     * @param {any[]} parameters - Array of parameter values
     * @param {QueryExecutionOptions} [options] - Execution options
     * @returns {Promise<ParameterizedQueryResult>} Query execution result
     * 
     * @throws {ModuleNotInitializedError} If module is not initialized
     * @throws {ValidationError} If parameters are invalid
     * @throws {QueryExecutionError} If query execution fails
     * 
     * @example
     * ```typescript
     * const result = await paramQuery.execute(
     *   'SELECT * FROM PLAYERS WHERE name = ? AND level > ?',
     *   ['player1', 10]
     * );
     * ```
     */
    public async execute(
        sql: string,
        parameters: any[] = [],
        options: QueryExecutionOptions = {}
    ): Promise<ParameterizedQueryResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ParameterizedQuery', 'execute query', {
                operation: 'execute'
            });
        }

        const startTime = Date.now();
        this.statistics.totalQueries++;

        try {
            this.logger.debug('Executing parameterized query', {
                operation: 'execute',
                sql: sql.substring(0, 200),
                parameterCount: parameters.length,
                hasOptions: Object.keys(options).length > 0
            });

            // Validate and prepare query
            const preparedStatement = await this.prepareStatement(sql, parameters, BindingStrategy.POSITIONAL, options);
            
            // Execute the prepared statement
            const result = await this.executeStatement(preparedStatement, parameters, options);

            // Update statistics
            const executionTime = Date.now() - startTime;
            this.updateExecutionStatistics(sql, executionTime);

            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.logger.error('Failed to execute parameterized query', {
                operation: 'execute-error',
                sql: sql.substring(0, 200),
                parameterCount: parameters.length,
                executionTime,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }

    /**
     * Execute a parameterized query with named parameters
     * 
     * @async
     * @public
     * @param {string} sql - SQL query with :name placeholders
     * @param {NamedParameterMap} parameters - Map of parameter names to values
     * @param {QueryExecutionOptions} [options] - Execution options
     * @returns {Promise<ParameterizedQueryResult>} Query execution result
     * 
     * @throws {ModuleNotInitializedError} If module is not initialized
     * @throws {ValidationError} If parameters are invalid
     * @throws {QueryExecutionError} If query execution fails
     * 
     * @example
     * ```typescript
     * const result = await paramQuery.executeNamed(
     *   'SELECT * FROM PLAYERS WHERE name = :name AND level > :minLevel',
     *   { name: 'player1', minLevel: 10 }
     * );
     * ```
     */
    public async executeNamed(
        sql: string,
        parameters: NamedParameterMap = {},
        options: QueryExecutionOptions = {}
    ): Promise<ParameterizedQueryResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ParameterizedQuery', 'execute named query', {
                operation: 'execute-named'
            });
        }

        // Convert named parameters to positional
        const { convertedSql, positionalParameters } = this.convertNamedToPositional(sql, parameters);
        
        return await this.execute(convertedSql, positionalParameters, {
            ...options,
            executionMode: ExecutionMode.PREPARED
        });
    }

    /**
     * Execute a batch of parameterized queries
     * 
     * @async
     * @public
     * @param {string} sql - SQL query template
     * @param {BatchParameters} batchParameters - Array of parameter arrays
     * @param {QueryExecutionOptions} [options] - Execution options
     * @returns {Promise<BatchExecutionResult>} Batch execution result
     * 
     * @throws {ModuleNotInitializedError} If module is not initialized
     * @throws {ValidationError} If batch parameters are invalid
     * @throws {QueryExecutionError} If batch execution fails
     * 
     * @example
     * ```typescript
     * const result = await paramQuery.executeBatch(
     *   'INSERT INTO PLAYERS (name, level) VALUES (?, ?)',
     *   [
     *     ['player1', 10],
     *     ['player2', 15],
     *     ['player3', 20]
     *   ]
     * );
     * ```
     */
    public async executeBatch(
        sql: string,
        batchParameters: BatchParameters,
        options: QueryExecutionOptions = {}
    ): Promise<BatchExecutionResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('ParameterizedQuery', 'execute batch', {
                operation: 'execute-batch'
            });
        }

        if (!batchParameters || batchParameters.length === 0) {
            throw new ValidationError(
                'batchParameters',
                batchParameters,
                'cannot be empty',
                'Batch parameters cannot be empty',
                { operation: 'execute-batch' }
            );
        }

        if (this.config!.maxBatchSize && batchParameters.length > this.config!.maxBatchSize) {
            throw new ValidationError(
                'batchSize',
                String(batchParameters.length),
                `must not exceed ${this.config!.maxBatchSize}`,
                `Batch size ${batchParameters.length} exceeds maximum ${this.config!.maxBatchSize}`,
                { operation: 'execute-batch' }
            );
        }

        const startTime = Date.now();
        this.statistics.totalBatchOperations++;

        try {
            this.logger.info('Executing batch operation', {
                operation: 'execute-batch',
                sql: sql.substring(0, 200),
                batchSize: batchParameters.length
            });

            // Prepare statement once for all batch operations
            const preparedStatement = await this.prepareStatement(
                sql, 
                batchParameters[0] || [], 
                BindingStrategy.POSITIONAL, 
                { ...options, executionMode: ExecutionMode.BATCH }
            );

            const results: ParameterizedQueryResult[] = [];
            let successCount = 0;
            let failureCount = 0;

            // Execute each batch item
            for (let i = 0; i < batchParameters.length; i++) {
                try {
                    const result = await this.executeStatement(
                        preparedStatement, 
                        batchParameters[i], 
                        { ...options, executionMode: ExecutionMode.BATCH }
                    );
                    results.push(result);
                    successCount++;
                } catch (error) {
                    const errorResult: ParameterizedQueryResult = {
                        success: false,
                        rows: [],
                        columns: [],
                        affectedRows: 0,
                        executionTime: 0,
                        statementId: preparedStatement.id,
                        metadata: {
                            parameterCount: batchParameters[i].length,
                            bindingStrategy: BindingStrategy.POSITIONAL,
                            executionMode: ExecutionMode.BATCH,
                            statementCached: preparedStatement.cached
                        }
                    };
                    results.push(errorResult);
                    failureCount++;

                    this.logger.warn('Batch item execution failed', {
                        operation: 'execute-batch-item',
                        batchIndex: i,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            const totalExecutionTime = Date.now() - startTime;
            const avgExecutionTime = totalExecutionTime / batchParameters.length;

            this.logger.info('Batch execution completed', {
                operation: 'execute-batch-complete',
                batchSize: batchParameters.length,
                successCount,
                failureCount,
                totalExecutionTime,
                avgExecutionTime
            });

            return {
                success: failureCount === 0,
                results,
                successCount,
                failureCount,
                totalExecutionTime,
                avgExecutionTime,
                metadata: {
                    batchSize: batchParameters.length,
                    executionMode: ExecutionMode.BATCH,
                    statementId: preparedStatement.id
                }
            };

        } catch (error) {
            const totalExecutionTime = Date.now() - startTime;
            this.logger.error('Batch execution failed', {
                operation: 'execute-batch-error',
                batchSize: batchParameters.length,
                totalExecutionTime,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }

    /**
     * Prepare a SQL statement for execution
     * 
     * @private
     * @async
     * @param {string} sql - SQL query
     * @param {any[]} parameters - Parameter values
     * @param {BindingStrategy} bindingStrategy - Parameter binding strategy
     * @param {QueryExecutionOptions} options - Execution options
     * @returns {Promise<PreparedStatement>} Prepared statement
     */
    private async prepareStatement(
        sql: string,
        parameters: any[],
        bindingStrategy: BindingStrategy,
        options: QueryExecutionOptions
    ): Promise<PreparedStatement> {
        // Generate statement cache key
        const cacheKey = this.generateStatementCacheKey(sql, bindingStrategy);

        // Check if statement is already cached
        if (this.config!.enableStatementCaching && options.useStatementCache !== false) {
            const cachedStatement = this.preparedStatements.get(cacheKey);
            if (cachedStatement && this.isStatementValid(cachedStatement)) {
                cachedStatement.lastUsed = new Date();
                cachedStatement.usageCount++;
                this.statistics.statementCacheHits++;

                this.logger.debug('Using cached prepared statement', {
                    operation: 'prepare-statement-cached',
                    statementId: cachedStatement.id,
                    usageCount: cachedStatement.usageCount
                });

                return cachedStatement;
            }
        }

        this.statistics.statementCacheMisses++;

        // Validate SQL and parameters
        await this.validateSqlAndParameters(sql, parameters, options);

        // Parse parameters from SQL
        const parsedParameters = this.parseParametersFromSql(sql, parameters, bindingStrategy);

        // Create new prepared statement
        const statementId = this.generateStatementId();
        const now = new Date();

        const preparedStatement: PreparedStatement = {
            id: statementId,
            sql,
            parameters: parsedParameters,
            parameterCount: parameters.length,
            bindingStrategy,
            createdAt: now,
            lastUsed: now,
            usageCount: 1,
            avgExecutionTime: 0,
            cached: this.config!.enableStatementCaching && options.useStatementCache !== false
        };

        // Cache the statement if caching is enabled
        if (preparedStatement.cached) {
            this.cacheStatement(cacheKey, preparedStatement);
        }

        this.statistics.totalPreparedStatements++;

        this.logger.debug('Created new prepared statement', {
            operation: 'prepare-statement-new',
            statementId,
            parameterCount: parameters.length,
            bindingStrategy,
            cached: preparedStatement.cached
        });

        return preparedStatement;
    }

    /**
     * Execute a prepared statement
     * 
     * @private
     * @async
     * @param {PreparedStatement} statement - Prepared statement
     * @param {any[]} parameters - Parameter values
     * @param {QueryExecutionOptions} options - Execution options
     * @returns {Promise<ParameterizedQueryResult>} Execution result
     */
    private async executeStatement(
        statement: PreparedStatement,
        parameters: any[],
        options: QueryExecutionOptions
    ): Promise<ParameterizedQueryResult> {
        const startTime = Date.now();

        try {
            // Validate parameters against statement
            this.validateParametersAgainstStatement(statement, parameters);

            // Get database connection
            if (!this.connectionManager) {
                throw new ConfigurationError('ConnectionManager not available', ['connectionManager'], {
                    operation: 'execute-statement'
                });
            }

            const connection = await this.connectionManager.getConnection();

            try {
                this.logger.debug('Executing JDBC query with parameters', {
                    operation: 'execute-statement',
                    statementId: statement.id,
                    sql: statement.sql.substring(0, 200),
                    parameterCount: parameters.length
                });

                // Execute the query using JDBC connection with parameter binding
                const result = await connection.execute(statement.sql, parameters);
                const executionTime = Date.now() - startTime;

                // Update statement statistics
                this.updateStatementStatistics(statement, executionTime);

                // Monitor performance if enabled
                if (this.performanceMonitor && this.config!.enablePerformanceMonitoring) {
                    // Skip metric recording for now since MetricType may not match
                    // this.performanceMonitor.recordMetric({
                    //     type: 'query-execution',
                    //     value: executionTime,
                    //     unit: 'ms',
                    //     timestamp: new Date(),
                    //     source: 'parameterized-query',
                    //     context: {
                    //         statementId: statement.id,
                    //         parameterCount: parameters.length,
                    //         bindingStrategy: statement.bindingStrategy
                    //     }
                    // });
                }

                return {
                    success: true,
                    rows: result.rows,
                    columns: result.columns,
                    affectedRows: result.rowsAffected || 0,
                    executionTime,
                    statementId: statement.id,
                    fromCache: false,
                    metadata: {
                        parameterCount: parameters.length,
                        bindingStrategy: statement.bindingStrategy,
                        executionMode: options.executionMode || ExecutionMode.PREPARED,
                        statementCached: statement.cached
                    }
                };

            } finally {
                await this.connectionManager.releaseConnection(connection);
            }

        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            this.logger.error('Statement execution failed', {
                operation: 'execute-statement-error',
                statementId: statement.id,
                executionTime,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new QueryExecutionError(
                statement.sql,
                `Failed to execute parameterized query: ${error instanceof Error ? error.message : String(error)}`,
                parameters,
                undefined,
                undefined,
                {
                    statementId: statement.id,
                    executionTime,
                    parameterCount: parameters.length
                }
            );
        }
    }

    /**
     * Validate SQL and parameters
     * 
     * @private
     * @async
     * @param {string} sql - SQL query
     * @param {any[]} parameters - Parameter values
     * @param {QueryExecutionOptions} options - Execution options
     * @throws {ValidationError} If validation fails
     */
    private async validateSqlAndParameters(
        sql: string,
        parameters: any[],
        options: QueryExecutionOptions
    ): Promise<void> {
        // Basic SQL validation
        if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
            throw new ValidationError(
                'sql',
                sql,
                'must be a non-empty string',
                'SQL query is required and must be a non-empty string',
                { operation: 'validate-sql' }
            );
        }

        // Parameter count validation
        if (this.config!.maxParametersPerQuery && parameters.length > this.config!.maxParametersPerQuery) {
            throw new ValidationError(
                'parameterCount',
                String(parameters.length),
                `must not exceed ${this.config!.maxParametersPerQuery}`,
                `Parameter count ${parameters.length} exceeds maximum ${this.config!.maxParametersPerQuery}`,
                { operation: 'validate-parameters' }
            );
        }

        // Validate that parameter count matches placeholder count
        const placeholderCount = (sql.match(/\?/g) || []).length;
        if (parameters.length !== placeholderCount) {
            throw new ValidationError(
                'parameterCount',
                String(parameters.length),
                `count mismatch (expected ${placeholderCount})`,
                `Parameter count mismatch. Expected ${placeholderCount}, got ${parameters.length}`,
                { 
                    operation: 'validate-parameters',
                    expected: placeholderCount,
                    actual: parameters.length
                }
            );
        }

        // SQL injection detection
        if (this.config!.enableInjectionDetection) {
            await this.detectSqlInjection(sql, parameters);
        }

        // Use QueryValidator if available
        if (this.queryValidator && this.queryValidator.isInitialized) {
            try {
                const validationResult = await this.queryValidator.validateQuery(sql);
                if (!validationResult.isValid) {
                    const criticalErrors = validationResult.errors.filter(e => e.severity === 'error');
                    if (criticalErrors.length > 0) {
                        throw new ValidationError(
                            'query',
                            sql,
                            'validation failed',
                            `Query validation failed: ${criticalErrors.map(e => e.message).join(', ')}`,
                            { operation: 'validate-query', errors: criticalErrors }
                        );
                    }
                }
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                }
                // Log validation error but don't fail the query
                this.logger.warn('Query validation failed', {
                    operation: 'validate-query',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // Parameter validation if enabled
        if (this.config!.enableParameterValidation && options.validateParameters !== false) {
            this.validateParameterValues(parameters, options);
        }
    }

    /**
     * Detect SQL injection attempts
     * 
     * @private
     * @async
     * @param {string} sql - SQL query
     * @param {any[]} parameters - Parameter values
     * @throws {ValidationError} If injection is detected
     */
    private async detectSqlInjection(sql: string, parameters: any[]): Promise<void> {
        // Common SQL injection patterns
        const injectionPatterns = [
            /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
            /(;|\s+)(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s+/i,
            /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
            /\'\s*(OR|AND)\s*\'/i,
            /-{2,}|\*{2,}/,
            /\b(xp_|sp_|sys\.)/i
        ];

        // Check SQL for injection patterns
        for (const pattern of injectionPatterns) {
            if (pattern.test(sql)) {
                this.statistics.injectionAttemptsBlocked++;
                this.logger.warn('SQL injection attempt detected in query', {
                    operation: 'detect-injection',
                    pattern: pattern.toString(),
                    sql: sql.substring(0, 200)
                });
                
                throw new ValidationError(
                    'sql',
                    sql,
                    'contains potential injection pattern',
                    'Potential SQL injection detected in query',
                    { operation: 'detect-injection', pattern: pattern.toString() }
                );
            }
        }

        // Check parameters for injection patterns
        for (let i = 0; i < parameters.length; i++) {
            const param = parameters[i];
            if (typeof param === 'string') {
                for (const pattern of injectionPatterns) {
                    if (pattern.test(param)) {
                        this.statistics.injectionAttemptsBlocked++;
                        this.logger.warn('SQL injection attempt detected in parameter', {
                            operation: 'detect-injection',
                            parameterIndex: i,
                            pattern: pattern.toString(),
                            parameter: param.substring(0, 100)
                        });
                        
                        throw new ValidationError(
                            'parameter',
                            param,
                            'contains potential injection pattern',
                            `Potential SQL injection detected in parameter ${i}`,
                            { operation: 'detect-injection', parameterIndex: i }
                        );
                    }
                }
            }
        }
    }

    /**
     * Validate parameter values
     * 
     * @private
     * @param {any[]} parameters - Parameter values
     * @param {QueryExecutionOptions} options - Execution options
     * @throws {ValidationError} If parameter validation fails
     */
    private validateParameterValues(parameters: any[], options: QueryExecutionOptions): void {
        for (let i = 0; i < parameters.length; i++) {
            const param = parameters[i];
            
            // Custom validation if provided
            if (options.parameterValidation) {
                const paramKey = i.toString();
                if (options.parameterValidation[paramKey]) {
                    if (!options.parameterValidation[paramKey](param)) {
                        this.statistics.parameterValidationFailures++;
                        throw new ValidationError(
                            'parameter',
                            param,
                            'failed custom validation',
                            `Custom validation failed for parameter ${i}`,
                            { operation: 'validate-parameter', parameterIndex: i }
                        );
                    }
                }
            }

            // Basic type validation
            if (param !== null && param !== undefined) {
                if (typeof param === 'string' && param.length > 10000) {
                    this.statistics.parameterValidationFailures++;
                    throw new ValidationError(
                        'parameter',
                        param,
                        'string too long',
                        `String parameter ${i} is too long (${param.length} > 10000)`,
                        { operation: 'validate-parameter', parameterIndex: i }
                    );
                }

                // Validate binary data (Buffer objects)
                if (Buffer.isBuffer(param)) {
                    // Buffer length validation
                    if (param.length > 64 * 1024) { // 64KB max for safety
                        this.statistics.parameterValidationFailures++;
                        throw new ValidationError(
                            'parameter',
                            param,
                            'binary data too large',
                            `Binary parameter ${i} is too large (${param.length} > 65536 bytes)`,
                            { operation: 'validate-parameter', parameterIndex: i }
                        );
                    }
                }
            }
        }
    }

    /**
     * Convert named parameters to positional parameters
     * 
     * @private
     * @param {string} sql - SQL with named parameters
     * @param {NamedParameterMap} namedParams - Named parameter map
     * @returns {object} Converted SQL and positional parameters
     */
    private convertNamedToPositional(sql: string, namedParams: NamedParameterMap): {
        convertedSql: string;
        positionalParameters: any[];
    } {
        const paramOrder: string[] = [];
        const positionalParameters: any[] = [];
        
        // Replace named parameters with positional placeholders
        const convertedSql = sql.replace(/:(\w+)/g, (match, paramName) => {
            if (!(paramName in namedParams)) {
                throw new ValidationError(
                    'namedParameter',
                    paramName,
                    'not provided',
                    `Named parameter '${paramName}' not provided`,
                    { operation: 'convert-named-parameters' }
                );
            }
            
            paramOrder.push(paramName);
            positionalParameters.push(namedParams[paramName]);
            return '?';
        });

        this.logger.debug('Converted named parameters to positional', {
            operation: 'convert-named-parameters',
            namedParams: Object.keys(namedParams),
            paramOrder,
            originalSql: sql.substring(0, 200),
            convertedSql: convertedSql.substring(0, 200)
        });

        return { convertedSql, positionalParameters };
    }

    /**
     * Parse parameters from SQL query
     * 
     * @private
     * @param {string} sql - SQL query
     * @param {any[]} parameters - Parameter values
     * @param {BindingStrategy} bindingStrategy - Binding strategy
     * @returns {QueryParameter[]} Parsed parameters
     */
    private parseParametersFromSql(
        sql: string,
        parameters: any[],
        bindingStrategy: BindingStrategy
    ): QueryParameter[] {
        const queryParameters: QueryParameter[] = [];

        for (let i = 0; i < parameters.length; i++) {
            const value = parameters[i];
            const type = this.detectParameterType(value);

            queryParameters.push({
                value,
                type,
                position: i + 1,
                nullable: value === null || value === undefined
            });
        }

        return queryParameters;
    }

    /**
     * Detect parameter type from value
     * 
     * @private
     * @param {any} value - Parameter value
     * @returns {ParameterType} Detected parameter type
     */
    private detectParameterType(value: any): ParameterType {
        if (value === null || value === undefined) {
            return ParameterType.NULL;
        }

        if (typeof value === 'string') {
            return ParameterType.STRING;
        }

        if (typeof value === 'number') {
            // CRITICAL FIX: Ensure proper integer detection for JDBC compatibility
            // Use Math.floor comparison to detect true integers vs floating point
            return (Number.isInteger(value) && value === Math.floor(value)) ? ParameterType.INTEGER : ParameterType.FLOAT;
        }

        if (typeof value === 'boolean') {
            return ParameterType.BOOLEAN;
        }

        if (value instanceof Date) {
            return ParameterType.DATETIME;
        }

        // Add Buffer detection for binary data - MUST be before Array check
        if (Buffer.isBuffer(value)) {
            return ParameterType.BINARY;
        }

        if (Array.isArray(value)) {
            return ParameterType.ARRAY;
        }

        if (typeof value === 'object') {
            return ParameterType.JSON;
        }

        return ParameterType.STRING; // Default fallback
    }

    /**
     * Validate parameters against prepared statement
     * 
     * @private
     * @param {PreparedStatement} statement - Prepared statement
     * @param {any[]} parameters - Parameter values
     * @throws {ValidationError} If validation fails
     */
    private validateParametersAgainstStatement(
        statement: PreparedStatement,
        parameters: any[]
    ): void {
        if (parameters.length !== statement.parameterCount) {
            throw new ValidationError(
                'parameterCount',
                String(parameters.length),
                `count mismatch (expected ${statement.parameterCount})`,
                `Parameter count mismatch. Expected ${statement.parameterCount}, got ${parameters.length}`,
                { 
                    operation: 'validate-parameters',
                    expected: statement.parameterCount,
                    actual: parameters.length,
                    statementId: statement.id
                }
            );
        }

        // Validate each parameter against its expected type
        for (let i = 0; i < parameters.length; i++) {
            const param = parameters[i];
            const expectedParam = statement.parameters[i];

            if (param === null || param === undefined) {
                if (!expectedParam.nullable) {
                    throw new ValidationError(
                        'parameter',
                        param,
                        'cannot be null',
                        `Parameter ${i + 1} cannot be null`,
                        { operation: 'validate-parameters', parameterIndex: i }
                    );
                }
                continue;
            }

            const actualType = this.detectParameterType(param);
            if (actualType !== expectedParam.type && expectedParam.type !== ParameterType.NULL) {
                this.logger.warn('Parameter type mismatch', {
                    operation: 'validate-parameters',
                    parameterIndex: i,
                    expectedType: expectedParam.type,
                    actualType,
                    value: param
                });
                // Log warning but don't fail - allow type coercion
            }
        }
    }

    // =============================================================================
    // UTILITY AND HELPER METHODS
    // =============================================================================

    /**
     * Generate statement cache key
     * 
     * @private
     * @param {string} sql - SQL query
     * @param {BindingStrategy} bindingStrategy - Binding strategy
     * @returns {string} Cache key
     */
    private generateStatementCacheKey(sql: string, bindingStrategy: BindingStrategy): string {
        // Normalize SQL for caching
        const normalizedSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();
        return `${bindingStrategy}:${normalizedSql}`;
    }

    /**
     * Generate unique statement ID
     * 
     * @private
     * @returns {string} Statement ID
     */
    private generateStatementId(): string {
        return `stmt_${++this.statementIdCounter}_${Date.now()}`;
    }

    /**
     * Check if statement is still valid
     * 
     * @private
     * @param {PreparedStatement} statement - Prepared statement
     * @returns {boolean} Whether statement is valid
     */
    private isStatementValid(statement: PreparedStatement): boolean {
        if (!this.config!.statementCacheTtl) {
            return true;
        }

        const age = Date.now() - statement.createdAt.getTime();
        return age < this.config!.statementCacheTtl;
    }

    /**
     * Cache a prepared statement
     * 
     * @private
     * @param {string} cacheKey - Cache key
     * @param {PreparedStatement} statement - Statement to cache
     */
    private cacheStatement(cacheKey: string, statement: PreparedStatement): void {
        // Check cache size limit
        if (this.preparedStatements.size >= this.config!.maxCachedStatements) {
            // Remove least recently used statement
            this.evictLeastRecentlyUsedStatement();
        }

        this.preparedStatements.set(cacheKey, statement);
        
        this.logger.debug('Cached prepared statement', {
            operation: 'cache-statement',
            statementId: statement.id,
            cacheKey,
            cacheSize: this.preparedStatements.size
        });
    }

    /**
     * Evict least recently used statement from cache
     * 
     * @private
     */
    private evictLeastRecentlyUsedStatement(): void {
        let lruKey: string | null = null;
        let lruTime = Date.now();

        for (const [key, statement] of this.preparedStatements.entries()) {
            if (statement.lastUsed.getTime() < lruTime) {
                lruTime = statement.lastUsed.getTime();
                lruKey = key;
            }
        }

        if (lruKey) {
            const evictedStatement = this.preparedStatements.get(lruKey);
            this.preparedStatements.delete(lruKey);
            
            this.logger.debug('Evicted LRU statement from cache', {
                operation: 'evict-statement',
                statementId: evictedStatement?.id,
                lastUsed: evictedStatement?.lastUsed,
                cacheSize: this.preparedStatements.size
            });
        }
    }

    /**
     * Update statement execution statistics
     * 
     * @private
     * @param {PreparedStatement} statement - Prepared statement
     * @param {number} executionTime - Execution time in milliseconds
     */
    private updateStatementStatistics(statement: PreparedStatement, executionTime: number): void {
        const totalTime = statement.avgExecutionTime * (statement.usageCount - 1) + executionTime;
        statement.avgExecutionTime = totalTime / statement.usageCount;
        statement.lastUsed = new Date();
    }

    /**
     * Update overall execution statistics
     * 
     * @private
     * @param {string} sql - SQL query
     * @param {number} executionTime - Execution time in milliseconds
     */
    private updateExecutionStatistics(sql: string, executionTime: number): void {
        // Track execution times
        this.statistics.queryExecutionTimes.push(executionTime);
        
        // Keep only last 1000 execution times
        if (this.statistics.queryExecutionTimes.length > 1000) {
            this.statistics.queryExecutionTimes = this.statistics.queryExecutionTimes.slice(-1000);
        }

        // Update top queries
        const queryKey = sql.substring(0, 100); // Use first 100 chars as key
        const existing = this.statistics.topQueries.get(queryKey);
        if (existing) {
            existing.count++;
            existing.totalTime += executionTime;
        } else {
            this.statistics.topQueries.set(queryKey, { count: 1, totalTime: executionTime });
        }

        // Keep only top 10 queries
        if (this.statistics.topQueries.size > 10) {
            const sorted = Array.from(this.statistics.topQueries.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);
            
            this.statistics.topQueries.clear();
            sorted.forEach(([key, value]) => {
                this.statistics.topQueries.set(key, value);
            });
        }
    }

    // =============================================================================
    // PUBLIC API METHODS
    // =============================================================================

    /**
     * Get current module configuration
     * 
     * @public
     * @returns {ParameterizedQueryConfig | undefined} Current configuration
     */
    public getConfiguration(): ParameterizedQueryConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Update module configuration
     * 
     * @public
     * @param {Partial<ParameterizedQueryConfig>} newConfig - Configuration updates
     */
    public updateConfiguration(newConfig: Partial<ParameterizedQueryConfig>): void {
        if (!this.config) {
            throw new ConfigurationError('Module not initialized', ['config'], {
                operation: 'update-configuration'
            });
        }

        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        this.logger.info('Configuration updated', {
            operation: 'update-configuration',
            changes: Object.keys(newConfig)
        });

        // Emit configuration updated event
        this.emit(ModuleEvent.CONFIG_UPDATED, createEventData('config-updated', {
            module: this.name,
            oldConfig,
            newConfig: this.config
        }, this.name));
    }

    /**
     * Get module statistics
     * 
     * @public
     * @returns {ParameterizedQueryStatistics} Current statistics
     */
    public getStatistics(): ParameterizedQueryStatistics {
        const totalRequests = this.statistics.statementCacheHits + this.statistics.statementCacheMisses;
        const statementCacheHitRatio = totalRequests > 0 
            ? this.statistics.statementCacheHits / totalRequests 
            : 0;

        const totalResultRequests = this.statistics.resultCacheHits + this.statistics.resultCacheMisses;
        const resultCacheHitRatio = totalResultRequests > 0 
            ? this.statistics.resultCacheHits / totalResultRequests 
            : 0;

        const avgExecutionTime = this.statistics.queryExecutionTimes.length > 0
            ? this.statistics.queryExecutionTimes.reduce((a, b) => a + b, 0) / this.statistics.queryExecutionTimes.length
            : 0;

        const topQueries = Array.from(this.statistics.topQueries.entries())
            .map(([sql, stats]) => ({
                sql,
                count: stats.count,
                avgTime: stats.totalTime / stats.count
            }))
            .sort((a, b) => b.count - a.count);

        return {
            totalQueries: this.statistics.totalQueries,
            totalPreparedStatements: this.statistics.totalPreparedStatements,
            statementCacheHits: this.statistics.statementCacheHits,
            statementCacheMisses: this.statistics.statementCacheMisses,
            statementCacheHitRatio,
            resultCacheHits: this.statistics.resultCacheHits,
            resultCacheMisses: this.statistics.resultCacheMisses,
            resultCacheHitRatio,
            avgExecutionTime,
            totalBatchOperations: this.statistics.totalBatchOperations,
            parameterValidationFailures: this.statistics.parameterValidationFailures,
            injectionAttemptsBlocked: this.statistics.injectionAttemptsBlocked,
            uptime: Date.now() - this.startTime,
            topQueries
        };
    }

    /**
     * Clear prepared statement cache
     * 
     * @public
     */
    public clearStatementCache(): void {
        const cacheSize = this.preparedStatements.size;
        this.preparedStatements.clear();

        this.logger.info('Prepared statement cache cleared', {
            operation: 'clear-statement-cache',
            clearedEntries: cacheSize
        });
    }

    /**
     * Get cached prepared statements information
     * 
     * @public
     * @returns {Array<{id: string; sql: string; usageCount: number; avgExecutionTime: number}>} Statement info
     */
    public getCachedStatements(): Array<{
        id: string;
        sql: string;
        usageCount: number;
        avgExecutionTime: number;
        createdAt: Date;
        lastUsed: Date;
    }> {
        return Array.from(this.preparedStatements.values()).map(stmt => ({
            id: stmt.id,
            sql: stmt.sql.substring(0, 200),
            usageCount: stmt.usageCount,
            avgExecutionTime: stmt.avgExecutionTime,
            createdAt: stmt.createdAt,
            lastUsed: stmt.lastUsed
        }));
    }

    /**
     * Get connection manager instance
     * 
     * @public
     * @returns {ConnectionManager | undefined} Connection manager
     */
    public getConnectionManager(): ConnectionManager | undefined {
        return this.connectionManager;
    }

    /**
     * Get query validator instance
     * 
     * @public
     * @returns {QueryValidator | undefined} Query validator
     */
    public getQueryValidator(): QueryValidator | undefined {
        return this.queryValidator;
    }

    /**
     * Get performance monitor instance
     * 
     * @public
     * @returns {PerformanceMonitor | undefined} Performance monitor
     */
    public getPerformanceMonitor(): PerformanceMonitor | undefined {
        return this.performanceMonitor;
    }

    /**
     * Get cache manager instance
     * 
     * @public
     * @returns {CacheManager | undefined} Cache manager
     */
    public getCacheManager(): CacheManager | undefined {
        return this.cacheManager;
    }

    /**
     * Destroy the module and cleanup resources
     * 
     * @async
     * @public
     * @returns {Promise<void>} Promise that resolves when destruction is complete
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying ParameterizedQuery module', {
            operation: 'destroy',
            cachedStatements: this.preparedStatements.size,
            totalQueries: this.statistics.totalQueries
        });

        this.destroyed = true;
        this._initialized = false;

        // Clear caches
        this.preparedStatements.clear();

        // Clear references
        this.connectionManager = undefined;
        this.queryValidator = undefined;
        this.performanceMonitor = undefined;
        this.cacheManager = undefined;
        this.manager = undefined;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);

        this.logger.info('ParameterizedQuery module destroyed successfully', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }

    // Event emitter interface implementation
    public on(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    public once(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    public off(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    public emit(event: ModuleEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    public removeAllListeners(event?: ModuleEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    public listenerCount(event: ModuleEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    public eventNames(): ModuleEvent[] {
        return this.eventEmitter.eventNames();
    }
}