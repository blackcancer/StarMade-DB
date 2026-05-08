/**
 * QueryExecutor Module
 * 
 * Core query execution engine for StarMade HSQLDB operations.
 * Handles SQL query execution with connection pooling, caching,
 * performance monitoring, and error handling.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { BaseModule, type HSQLManager } from '../../HSQLManager.js';
import { ConnectionManager } from '../connection/ConnectionManager.js';
import { CacheManager } from '../cache/CacheManager.js';
import { PerformanceMonitor } from '../performance/PerformanceMonitor.js';
import { QueryValidator } from './QueryValidator.js';
import { ParameterizedQuery } from './ParameterizedQuery.js';
import { type JDBCConnection, type JDBCQueryResult } from '../connection/JDBCConnectionFactory.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import { 
    HSQLDBError, 
    ModuleNotInitializedError, 
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ConcurrentQueryLimitError,
    ValidationError,
    createErrorFromJDBC
} from '../../errors.js';
import { 
    ModuleEventEmitterImpl,
    ModuleEvent, 
    QueryEvent,
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Query execution configuration
 */
export interface QueryExecutionConfig {
    /** Query timeout in milliseconds */
    timeoutMs?: number;
    /** Enable query result caching */
    enableCaching?: boolean;
    /** Cache TTL for this query (overrides default) */
    cacheTtl?: number;
    /** Maximum result set size */
    maxResultSize?: number;
    /** Enable performance metrics collection */
    enableMetrics?: boolean;
    /** Query execution context/metadata */
    context?: Record<string, any>;
    /** Connection preference (auto, read-only, read-write) */
    connectionMode?: 'auto' | 'read-only' | 'read-write';
}

/**
 * Query execution result
 */
export interface QueryExecutionResult extends JDBCQueryResult {
    /** Query execution metadata */
    metadata: {
        /** Actual execution time in milliseconds */
        executionTime: number;
        /** Whether result came from cache */
        fromCache: boolean;
        /** Cache key used (if cached) */
        cacheKey?: string;
        /** Connection used for execution */
        connectionId?: string;
        /** Query hash for tracking */
        queryHash: string;
        /** Row count (for non-SELECT queries) */
        affectedRows?: number;
        /** Execution plan (if available) */
        executionPlan?: string;
    };
}

/**
 * Query execution statistics
 */
export interface QueryExecutionStats {
    /** Total queries executed */
    totalExecuted: number;
    /** Total execution time */
    totalExecutionTime: number;
    /** Average execution time */
    averageExecutionTime: number;
    /** Cache hit ratio */
    cacheHitRatio: number;
    /** Error rate */
    errorRate: number;
    /** Slowest queries */
    slowestQueries: Array<{
        query: string;
        executionTime: number;
        timestamp: Date;
    }>;
    /** Most frequent queries */
    frequentQueries: Array<{
        query: string;
        executionCount: number;
        totalTime: number;
        averageTime: number;
    }>;
}

/**
 * QueryExecutor configuration
 */
export interface QueryExecutorConfig {
    /** Default query timeout in milliseconds */
    defaultTimeoutMs: number;
    /** Maximum concurrent queries */
    maxConcurrentQueries: number;
    /** Enable query result caching */
    enableCaching: boolean;
    /** Default cache TTL in milliseconds */
    defaultCacheTtl: number;
    /** Maximum cached result size */
    maxCacheSize: number;
    /** Enable query performance tracking */
    enablePerformanceTracking: boolean;
    /** Enable query logging */
    enableQueryLogging: boolean;
    /** Maximum result set size */
    maxResultSize: number;
    /** Enable execution plan collection */
    enableExecutionPlan: boolean;
}

/**
 * Query cache entry
 */
interface QueryCacheEntry {
    /** Cached result */
    result: JDBCQueryResult;
    /** Cache timestamp */
    timestamp: Date;
    /** TTL in milliseconds */
    ttl: number;
    /** Query hash */
    queryHash: string;
    /** Hit count */
    hitCount: number;
    /** Result size in bytes (estimated) */
    sizeBytes: number;
}

/**
 * Query tracking entry
 */
interface QueryTrackingEntry {
    /** SQL query */
    query: string;
    /** Query hash */
    hash: string;
    /** Execution count */
    executionCount: number;
    /** Total execution time */
    totalTime: number;
    /** Last execution time */
    lastExecutionTime: number;
    /** First seen timestamp */
    firstSeen: Date;
    /** Last seen timestamp */
    lastSeen: Date;
    /** Error count */
    errorCount: number;
}

// =============================================================================
// QUERYEXECUTOR CLASS
// =============================================================================

/**
 * QueryExecutor - Core SQL query execution engine
 * 
 * Features:
 * - Connection pooling integration
 * - Query result caching
 * - Performance monitoring
 * - Error handling and recovery
 * - Query tracking and statistics
 * - Event emission for metrics
 */
export class QueryExecutor implements BaseModule, ModuleEventEmitter<ModuleEvent | QueryEvent> {
    public readonly name = 'query-executor';
    public readonly version = '1.0.0';
    public get isInitialized(): boolean { return this._initialized; }

    private _initialized = false;
    private manager?: HSQLManager;
    private logger: ModuleLogger | null = null;
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent | QueryEvent>;
    private connectionManager: ConnectionManager | null = null;
    private cacheManager: CacheManager | null = null;
    private performanceMonitor: PerformanceMonitor | null = null;
    private queryValidator: QueryValidator | null = null;
    private parameterizedQuery: ParameterizedQuery | null = null;

    // Configuration
    private config: QueryExecutorConfig = {
        defaultTimeoutMs: 30000,
        maxConcurrentQueries: 10,
        enableCaching: true,
        defaultCacheTtl: 300000, // 5 minutes
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        enablePerformanceTracking: true,
        enableQueryLogging: false,
        maxResultSize: 50000, // 50K rows max
        enableExecutionPlan: false
    };

    // Internal state
    private queryCache = new Map<string, QueryCacheEntry>();
    private queryTracking = new Map<string, QueryTrackingEntry>();
    private activeQueries = new Set<string>();
    private queryStats: QueryExecutionStats = {
        totalExecuted: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        cacheHitRatio: 0,
        errorRate: 0,
        slowestQueries: [],
        frequentQueries: []
    };

    private cleanupInterval: NodeJS.Timeout | null = null;

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * Create a new QueryExecutor instance
     */
    constructor() {
        this.logger = createModuleLogger('QueryExecutor');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'QueryExecutor');

        // Initialize event listeners for both module and query events
        this.eventEmitter.initializeEvents([
            ...Object.values(ModuleEvent),
            ...Object.values(QueryEvent)
        ]);
    }

    // =============================================================================
    // LIFECYCLE METHODS
    // =============================================================================

    /**
     * Initialize QueryExecutor with HSQLManager
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('QueryExecutor', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required for QueryExecutor initialization');
        }

        try {
            this.manager = manager;
            
            // Initialize logger
            this.logger = createModuleLogger(this.name);
            this.logger.info('Initializing QueryExecutor...');

            // Auto-discover ConnectionManager (required)
            this.connectionManager = manager.getModule<ConnectionManager>('connection-manager') || null;
            if (!this.connectionManager || !this.connectionManager.isInitialized) {
                throw new ConfigurationError('ConnectionManager is required but not found or not initialized');
            }

            // Auto-discover optional modules
            this.cacheManager = manager.getModule<CacheManager>('cache-manager') || null;
            this.performanceMonitor = manager.getModule<PerformanceMonitor>('performance-monitor') || null;
            this.queryValidator = manager.getModule<QueryValidator>('query-validator') || null;
            this.parameterizedQuery = manager.getModule<ParameterizedQuery>('parameterized-query') || null;

            // Start cleanup interval
            this.startCleanupInterval();

            this._initialized = true;
            this.logger.info('QueryExecutor initialized successfully');

            // Emit initialization event
            this.emit(ModuleEvent.INITIALIZED, createEventData('query-executor-initialized', {
                module: this.name,
                version: this.version,
                config: this.config,
                hasCache: !!this.cacheManager,
                hasPerformanceMonitor: !!this.performanceMonitor,
                hasQueryValidator: !!this.queryValidator,
                hasParameterizedQuery: !!this.parameterizedQuery
            }, this.name));

        } catch (error) {
            this.logger?.error('Failed to initialize QueryExecutor', { error });
            throw new HSQLDBError(
                `Failed to initialize ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
                'INIT_ERROR'
            );
        }
    }

    /**
     * Destroy QueryExecutor and cleanup resources
     */
    public async destroy(): Promise<void> {
        if (!this._initialized) {
            return; // Already destroyed or never initialized
        }

        this.logger?.info('Destroying QueryExecutor...');

        try {
            // Stop cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            // Clear caches and tracking
            this.queryCache.clear();
            this.queryTracking.clear();
            this.activeQueries.clear();

            // Reset statistics
            this.queryStats = {
                totalExecuted: 0,
                totalExecutionTime: 0,
                averageExecutionTime: 0,
                cacheHitRatio: 0,
                errorRate: 0,
                slowestQueries: [],
                frequentQueries: []
            };

            // Clear module references
            this.connectionManager = null;
            this.cacheManager = null;
            this.performanceMonitor = null;
            this.queryValidator = null;
            this.parameterizedQuery = null;

            this._initialized = false;
            this.logger?.info('QueryExecutor destroyed successfully');

            // Emit destruction event
            this.emit(ModuleEvent.DESTROYED, {
                module: this.name,
                version: this.version
            });

        } catch (error) {
            this.logger?.error('Error during QueryExecutor destruction', { error });
            throw error;
        } finally {
            this.logger = null;
        }
    }

    // =============================================================================
    // QUERY EXECUTION METHODS
    // =============================================================================

    /**
     * Execute a SQL query
     */
    public async executeQuery(
        sql: string, 
        config?: QueryExecutionConfig
    ): Promise<QueryExecutionResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryExecutor', 'executeQuery');
        }

        if (!sql || typeof sql !== 'string') {
            throw new ConfigurationError('SQL query is required and must be a string');
        }

        const executionConfig = { ...this.config, ...config };
        const queryHash = this.generateQueryHash(sql);
        const startTime = Date.now();

        this.logger?.debug('Executing query', { 
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            queryHash,
            config: executionConfig 
        });

        try {
            // Validate query if QueryValidator is available
            if (this.queryValidator && executionConfig.enableMetrics !== false) {
                try {
                    const validationResult = await this.queryValidator.validateQuery(sql);
                    
                    if (!validationResult.isValid) {
                        const errors = validationResult.errors.map(e => e.message).join('; ');
                        throw new ValidationError(
                            'query_validation',
                            sql.substring(0, 100),
                            errors,
                            `Query validation failed: ${errors}`,
                            { validationResult }
                        );
                    }
                    
                    // Log security issues as warnings
                    if (validationResult.securityIssues.length > 0) {
                        this.logger?.warn('Query security issues detected', {
                            sql: sql.substring(0, 100),
                            securityIssues: validationResult.securityIssues
                        });
                    }
                    
                    // Log performance hints
                    if (validationResult.performanceHints.length > 0) {
                        this.logger?.debug('Query performance hints', {
                            sql: sql.substring(0, 100),
                            performanceHints: validationResult.performanceHints
                        });
                    }
                } catch (validationError) {
                    // If validation fails critically, log and continue with execution
                    // unless it's a validation error we should respect
                    if (validationError instanceof ValidationError) {
                        throw validationError;
                    }
                    
                    this.logger?.warn('Query validation failed, proceeding with execution', {
                        sql: sql.substring(0, 100),
                        validationError: validationError instanceof Error ? validationError.message : String(validationError)
                    });
                }
            }
            
            // Check concurrent query limit
            if (this.activeQueries.size >= executionConfig.maxConcurrentQueries) {
                throw new ConcurrentQueryLimitError(
                    executionConfig.maxConcurrentQueries,
                    this.activeQueries.size
                );
            }

            // Add to active queries
            this.activeQueries.add(queryHash);

            // Check cache first (if enabled)
            if (executionConfig.enableCaching && this.canCacheQuery(sql)) {
                const cachedResult = this.getCachedResult(sql, queryHash);
                if (cachedResult) {
                    this.activeQueries.delete(queryHash);
                    this.updateQueryStats(sql, queryHash, Date.now() - startTime, true);
                    
                    return {
                        ...cachedResult.result,
                        metadata: {
                            executionTime: Date.now() - startTime,
                            fromCache: true,
                            cacheKey: queryHash,
                            queryHash: queryHash,
                            affectedRows: cachedResult.result.rows?.length || 0
                        }
                    };
                }
            }

            // Execute query
            const result = await this.executeQueryInternal(sql, executionConfig);
            const executionTime = Date.now() - startTime;

            // Cache result if applicable
            if (executionConfig.enableCaching && this.canCacheQuery(sql) && this.shouldCacheResult(result)) {
                this.cacheResult(sql, queryHash, result, executionConfig.cacheTtl || executionConfig.defaultCacheTtl);
            }

            // Update statistics
            this.updateQueryStats(sql, queryHash, executionTime, false);

            // Emit query executed event
            this.emit(QueryEvent.QUERY_COMPLETED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                fromCache: false,
                rowCount: result.rows?.length || 0,
                success: true
            });

            // Record performance metrics
            if (this.performanceMonitor) {
                this.performanceMonitor.recordMetric({
                    type: 'QUERY_TIME' as any,
                    value: executionTime,
                    unit: 'ms',
                    timestamp: new Date(),
                    source: this.name,
                    context: {
                        queryType: this.detectQueryType(sql),
                        queryHash,
                        cached: false
                    }
                });
            }

            return {
                ...result,
                metadata: {
                    executionTime,
                    fromCache: false,
                    queryHash: queryHash,
                    connectionId: 'auto',
                    affectedRows: result.rows?.length || 0
                }
            };

        } catch (error) {
            this.activeQueries.delete(queryHash);
            const executionTime = Date.now() - startTime;
            
            this.logger?.error('Query execution failed', { 
                sql: sql.substring(0, 100),
                queryHash,
                executionTime,
                error 
            });

            // Update error statistics
            this.updateQueryStats(sql, queryHash, executionTime, false, true);

            // Emit query error event
            this.emit(QueryEvent.QUERY_FAILED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                error: (error as Error).message,
                success: false
            });

            throw createErrorFromJDBC(sql, error, undefined, {
                queryHash,
                executionTime,
                operation: 'executeQuery'
            });
        } finally {
            this.activeQueries.delete(queryHash);
        }
    }

    /**
     * Execute multiple queries in sequence
     */
    public async executeQueries(
        queries: string[],
        config?: QueryExecutionConfig
    ): Promise<QueryExecutionResult[]> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryExecutor', 'executeQueries');
        }

        if (!Array.isArray(queries) || queries.length === 0) {
            throw new ConfigurationError('Queries array is required and must not be empty');
        }

        const results: QueryExecutionResult[] = [];
        
        for (const sql of queries) {
            const result = await this.executeQuery(sql, config);
            results.push(result);
        }

        return results;
    }

    /**
     * Execute a query with streaming results (for large result sets)
     */
    public async* executeStreamingQuery(
        sql: string,
        batchSize: number = 1000,
        config?: QueryExecutionConfig
    ): AsyncGenerator<QueryExecutionResult, void, unknown> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryExecutor', 'executeStreamingQuery');
        }

        const connection = await this.getConnection(config?.connectionMode);
        
        try {
            // This is a simplified streaming implementation
            // In a real implementation, we'd use JDBC streaming features
            const result = await this.executeQuery(sql, { ...config, enableCaching: false });
            
            // Yield results in batches
            const rows = result.rows || [];
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                yield {
                    ...result,
                    rows: batch,
                    metadata: {
                        ...result.metadata,
                        fromCache: false
                    }
                };
            }
        } finally {
            await this.releaseConnection(connection);
        }
    }

    /**
     * Execute a parameterized query (safer alternative to regular executeQuery)
     */
    public async executeParameterizedQuery(
        sql: string,
        parameters: any[],
        config?: QueryExecutionConfig
    ): Promise<QueryExecutionResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryExecutor', 'executeParameterizedQuery');
        }

        if (!this.parameterizedQuery) {
            // Fallback to regular execution with warning
            this.logger?.warn('ParameterizedQuery module not available, falling back to regular execution', {
                sql: sql.substring(0, 100)
            });
            return this.executeQuery(sql, config);
        }

        const startTime = Date.now();
        const queryHash = this.generateQueryHash(sql + JSON.stringify(parameters));

        this.logger?.debug('Executing parameterized query', { 
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            parameterCount: parameters.length,
            queryHash
        });

        try {
            // Execute using ParameterizedQuery module
            const result = await this.parameterizedQuery.execute(sql, parameters, {
                timeoutMs: config?.timeoutMs
            });

            const executionTime = Date.now() - startTime;

            // Update statistics
            this.updateQueryStats(sql, queryHash, executionTime, false);

            // Emit query completed event
            this.emit(QueryEvent.QUERY_COMPLETED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                fromCache: false,
                rowCount: result.rows?.length || 0,
                success: true,
                parameterized: true
            });

            // Convert ParameterizedQuery result to QueryExecutionResult
            return {
                columns: result.columns,
                rows: result.rows,
                executionTime,
                metadata: {
                    executionTime,
                    fromCache: false,
                    queryHash,
                    connectionId: 'parameterized',
                    affectedRows: result.rows?.length || 0
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            this.logger?.error('Parameterized query execution failed', { 
                sql: sql.substring(0, 100),
                parameterCount: parameters.length,
                queryHash,
                executionTime,
                error 
            });

            // Update error statistics
            this.updateQueryStats(sql, queryHash, executionTime, false, true);

            // Emit query error event
            this.emit(QueryEvent.QUERY_FAILED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                error: (error as Error).message,
                success: false,
                parameterized: true
            });

            throw error;
        }
    }

    /**
     * Execute a named parameter query
     */
    public async executeNamedQuery(
        sql: string,
        parameters: Record<string, any>,
        config?: QueryExecutionConfig
    ): Promise<QueryExecutionResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryExecutor', 'executeNamedQuery');
        }

        if (!this.parameterizedQuery) {
            throw new ConfigurationError('ParameterizedQuery module not available for named parameter queries');
        }

        const startTime = Date.now();
        const queryHash = this.generateQueryHash(sql + JSON.stringify(parameters));

        this.logger?.debug('Executing named parameter query', { 
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            parameterNames: Object.keys(parameters),
            queryHash
        });

        try {
            // Execute using ParameterizedQuery module
            const result = await this.parameterizedQuery.executeNamed(sql, parameters, {
                timeoutMs: config?.timeoutMs
            });

            const executionTime = Date.now() - startTime;

            // Update statistics
            this.updateQueryStats(sql, queryHash, executionTime, false);

            // Emit query completed event
            this.emit(QueryEvent.QUERY_COMPLETED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                fromCache: false,
                rowCount: result.rows?.length || 0,
                success: true,
                parameterized: true,
                namedParameters: true
            });

            // Convert ParameterizedQuery result to QueryExecutionResult
            return {
                columns: result.columns,
                rows: result.rows,
                executionTime,
                metadata: {
                    executionTime,
                    fromCache: false,
                    queryHash,
                    connectionId: 'parameterized',
                    affectedRows: result.rows?.length || 0
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            this.logger?.error('Named parameter query execution failed', { 
                sql: sql.substring(0, 100),
                parameterNames: Object.keys(parameters),
                queryHash,
                executionTime,
                error 
            });

            // Update error statistics
            this.updateQueryStats(sql, queryHash, executionTime, false, true);

            // Emit query error event
            this.emit(QueryEvent.QUERY_FAILED, {
                sql: sql.substring(0, 200),
                queryHash,
                executionTime,
                error: (error as Error).message,
                success: false,
                parameterized: true,
                namedParameters: true
            });

            throw error;
        }
    }

    // =============================================================================
    // INTERNAL EXECUTION METHODS
    // =============================================================================

    /**
     * Internal query execution logic
     */
    private async executeQueryInternal(
        sql: string,
        config: QueryExecutionConfig & QueryExecutorConfig
    ): Promise<JDBCQueryResult> {
        const connection = await this.getConnection(config.connectionMode);
        
        try {
            // Set query timeout if specified
            if (config.timeoutMs && config.timeoutMs !== this.config.defaultTimeoutMs) {
                // Note: JDBC timeout setting would go here in a real implementation
            }

            // Execute the query
            const result = await connection.execute(sql);

            // Check result size limits
            if (result.rows && result.rows.length > config.maxResultSize) {
                this.logger?.warn('Query result exceeds maximum size limit', {
                    rowCount: result.rows.length,
                    maxResultSize: config.maxResultSize
                });
                
                // Truncate results if needed
                result.rows = result.rows.slice(0, config.maxResultSize);
            }

            return result;

        } finally {
            await this.releaseConnection(connection);
        }
    }

    /**
     * Get database connection
     */
    private async getConnection(mode?: 'auto' | 'read-only' | 'read-write'): Promise<JDBCConnection> {
        if (!this.connectionManager) {
            throw new HSQLDBError('ConnectionManager not available', 'CONNECTION_MANAGER_UNAVAILABLE');
        }

        // For now, use default connection acquisition
        // In future, we could implement read-only vs read-write preference
        return await this.connectionManager.getConnection();
    }

    /**
     * Release database connection
     */
    private async releaseConnection(connection: JDBCConnection): Promise<void> {
        if (!this.connectionManager) {
            throw new HSQLDBError('ConnectionManager not available', 'CONNECTION_MANAGER_UNAVAILABLE');
        }

        await this.connectionManager.releaseConnection(connection);
    }

    // =============================================================================
    // CACHING METHODS
    // =============================================================================

    /**
     * Check if query can be cached
     */
    private canCacheQuery(sql: string): boolean {
        const trimmedSql = sql.trim().toUpperCase();
        
        // Only cache SELECT queries
        if (!trimmedSql.startsWith('SELECT')) {
            return false;
        }

        // Don't cache queries with functions that return current time/random values
        const nonCacheablePatterns = [
            /CURRENT_TIMESTAMP/i,
            /CURRENT_TIME/i,
            /CURRENT_DATE/i,
            /NOW\(\)/i,
            /RAND\(\)/i,
            /RANDOM\(\)/i,
            /UUID\(\)/i
        ];

        return !nonCacheablePatterns.some(pattern => pattern.test(sql));
    }

    /**
     * Check if result should be cached
     */
    private shouldCacheResult(result: JDBCQueryResult): boolean {
        // Don't cache empty results
        if (!result.rows || result.rows.length === 0) {
            return false;
        }

        // Don't cache very large results
        const estimatedSize = this.estimateResultSize(result);
        return estimatedSize < this.config.maxCacheSize / 10; // Max 10% of cache per query
    }

    /**
     * Get cached result
     */
    private getCachedResult(sql: string, queryHash: string): QueryCacheEntry | null {
        const cacheEntry = this.queryCache.get(queryHash);
        
        if (!cacheEntry) {
            return null;
        }

        // Check TTL
        const now = Date.now();
        const age = now - cacheEntry.timestamp.getTime();
        
        if (age > cacheEntry.ttl) {
            this.queryCache.delete(queryHash);
            return null;
        }

        // Update hit count
        cacheEntry.hitCount++;
        
        return cacheEntry;
    }

    /**
     * Cache query result
     */
    private cacheResult(
        sql: string, 
        queryHash: string, 
        result: JDBCQueryResult, 
        ttl: number
    ): void {
        const sizeBytes = this.estimateResultSize(result);
        
        const cacheEntry: QueryCacheEntry = {
            result: { ...result },
            timestamp: new Date(),
            ttl,
            queryHash,
            hitCount: 0,
            sizeBytes
        };

        this.queryCache.set(queryHash, cacheEntry);

        // Enforce cache size limits
        this.enforeCacheLimits();
    }

    /**
     * Enforce cache size limits
     */
    private enforeCacheLimits(): void {
        const totalSize = Array.from(this.queryCache.values())
            .reduce((sum, entry) => sum + entry.sizeBytes, 0);

        if (totalSize > this.config.maxCacheSize) {
            // Remove oldest entries
            const entries = Array.from(this.queryCache.entries())
                .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

            let removedSize = 0;
            const targetRemoval = totalSize - this.config.maxCacheSize * 0.8; // Remove to 80% capacity

            for (const [key, entry] of entries) {
                this.queryCache.delete(key);
                removedSize += entry.sizeBytes;
                
                if (removedSize >= targetRemoval) {
                    break;
                }
            }

            this.logger?.debug('Cache size limit enforced', {
                totalSize,
                removedSize,
                remainingEntries: this.queryCache.size
            });
        }
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Generate query hash for caching/tracking
     */
    private generateQueryHash(sql: string): string {
        // Normalize SQL for consistent hashing
        const normalized = sql
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(36);
    }

    /**
     * Detect query type from SQL
     */
    private detectQueryType(sql: string): string {
        const trimmed = sql.trim().toUpperCase();
        
        if (trimmed.startsWith('SELECT')) return 'SELECT';
        if (trimmed.startsWith('INSERT')) return 'INSERT';
        if (trimmed.startsWith('UPDATE')) return 'UPDATE';
        if (trimmed.startsWith('DELETE')) return 'DELETE';
        if (trimmed.startsWith('CREATE')) return 'CREATE';
        if (trimmed.startsWith('DROP')) return 'DROP';
        if (trimmed.startsWith('ALTER')) return 'ALTER';
        
        return 'OTHER';
    }

    /**
     * Estimate result size in bytes
     */
    private estimateResultSize(result: JDBCQueryResult): number {
        if (!result.rows || result.rows.length === 0) {
            return 100; // Base size
        }

        // Rough estimation based on row count and average row size
        const sampleRow = result.rows[0];
        const avgRowSize = Array.isArray(sampleRow) 
            ? sampleRow.reduce((sum, cell) => sum + (String(cell).length * 2), 0)
            : 100;

        return result.rows.length * avgRowSize + 1000; // Add overhead
    }

    /**
     * Update query statistics
     */
    private updateQueryStats(
        sql: string,
        queryHash: string,
        executionTime: number,
        fromCache: boolean,
        isError: boolean = false
    ): void {
        // Update global stats
        this.queryStats.totalExecuted++;
        this.queryStats.totalExecutionTime += executionTime;
        this.queryStats.averageExecutionTime = this.queryStats.totalExecutionTime / this.queryStats.totalExecuted;

        // Update cache hit ratio
        const cacheHits = Array.from(this.queryCache.values())
            .reduce((sum, entry) => sum + entry.hitCount, 0);
        this.queryStats.cacheHitRatio = cacheHits / Math.max(this.queryStats.totalExecuted, 1);

        // Update tracking entry
        let tracking = this.queryTracking.get(queryHash);
        if (!tracking) {
            tracking = {
                query: sql.substring(0, 200),
                hash: queryHash,
                executionCount: 0,
                totalTime: 0,
                lastExecutionTime: 0,
                firstSeen: new Date(),
                lastSeen: new Date(),
                errorCount: 0
            };
            this.queryTracking.set(queryHash, tracking);
        }

        tracking.executionCount++;
        tracking.totalTime += executionTime;
        tracking.lastExecutionTime = executionTime;
        tracking.lastSeen = new Date();

        if (isError) {
            tracking.errorCount++;
        }

        // Update slowest queries
        this.updateSlowestQueries(sql, executionTime);
        
        // Update frequent queries
        this.updateFrequentQueries();
        
        // Update error rate
        const totalErrors = Array.from(this.queryTracking.values())
            .reduce((sum, entry) => sum + entry.errorCount, 0);
        this.queryStats.errorRate = totalErrors / Math.max(this.queryStats.totalExecuted, 1) * 100;
    }

    /**
     * Update slowest queries list
     */
    private updateSlowestQueries(sql: string, executionTime: number): void {
        this.queryStats.slowestQueries.push({
            query: sql.substring(0, 200),
            executionTime,
            timestamp: new Date()
        });

        // Keep only top 10 slowest
        this.queryStats.slowestQueries.sort((a, b) => b.executionTime - a.executionTime);
        this.queryStats.slowestQueries = this.queryStats.slowestQueries.slice(0, 10);
    }

    /**
     * Update frequent queries list
     */
    private updateFrequentQueries(): void {
        const queries = Array.from(this.queryTracking.values())
            .map(entry => ({
                query: entry.query,
                executionCount: entry.executionCount,
                totalTime: entry.totalTime,
                averageTime: entry.totalTime / entry.executionCount
            }))
            .sort((a, b) => b.executionCount - a.executionCount)
            .slice(0, 10);

        this.queryStats.frequentQueries = queries;
    }

    /**
     * Start cleanup interval for cache and tracking
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000); // Cleanup every minute
    }

    /**
     * Perform cleanup of expired cache entries and old tracking data
     */
    private performCleanup(): void {
        const now = Date.now();

        // Clean expired cache entries
        let expiredCount = 0;
        for (const [key, entry] of this.queryCache.entries()) {
            const age = now - entry.timestamp.getTime();
            if (age > entry.ttl) {
                this.queryCache.delete(key);
                expiredCount++;
            }
        }

        // Clean old tracking entries (keep last 1000 unique queries)
        if (this.queryTracking.size > 1000) {
            const entries = Array.from(this.queryTracking.entries())
                .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime());

            const toRemove = entries.slice(0, this.queryTracking.size - 1000);
            for (const [key] of toRemove) {
                this.queryTracking.delete(key);
            }
        }

        if (expiredCount > 0) {
            this.logger?.debug('Cleanup completed', {
                expiredCacheEntries: expiredCount,
                cacheSize: this.queryCache.size,
                trackingSize: this.queryTracking.size
            });
        }
    }

    // =============================================================================
    // PUBLIC GETTERS AND UTILITIES
    // =============================================================================

    /**
     * Get query execution statistics
     */
    public getStatistics(): QueryExecutionStats {
        return { ...this.queryStats };
    }

    /**
     * Get current configuration
     */
    public getConfiguration(): QueryExecutorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfiguration(config: Partial<QueryExecutorConfig>): void {
        this.config = { ...this.config, ...config };
        
        this.logger?.info('Configuration updated', { config });
        
        this.emit(ModuleEvent.CONFIG_UPDATED, {
            module: this.name,
            config: this.config
        });
    }

    /**
     * Clear query cache
     */
    public clearCache(): void {
        const size = this.queryCache.size;
        this.queryCache.clear();
        
        this.logger?.info('Query cache cleared', { entriesRemoved: size });
        
        this.emit(ModuleEvent.STATUS_CHANGED, {
            module: this.name,
            status: 'cache-cleared',
            entriesRemoved: size
        });
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): {
        size: number;
        totalSize: number;
        hitRatio: number;
        entries: Array<{ key: string; hitCount: number; size: number; age: number }>;
    } {
        const now = Date.now();
        const entries = Array.from(this.queryCache.entries()).map(([key, entry]) => ({
            key,
            hitCount: entry.hitCount,
            size: entry.sizeBytes,
            age: now - entry.timestamp.getTime()
        }));

        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);

        return {
            size: this.queryCache.size,
            totalSize,
            hitRatio: totalHits / Math.max(this.queryStats.totalExecuted, 1),
            entries
        };
    }

    /**
     * Get connection manager instance
     */
    public getConnectionManager(): ConnectionManager | null {
        return this.connectionManager;
    }

    /**
     * Get cache manager instance
     */
    public getCacheManager(): CacheManager | null {
        return this.cacheManager;
    }

    /**
     * Get performance monitor instance
     */
    public getPerformanceMonitor(): PerformanceMonitor | null {
        return this.performanceMonitor;
    }

    /**
     * Get query validator instance
     */
    public getQueryValidator(): QueryValidator | null {
        return this.queryValidator;
    }

    /**
     * Get parameterized query instance
     */
    public getParameterizedQuery(): ParameterizedQuery | null {
        return this.parameterizedQuery;
    }

    // =============================================================================
    // EVENT EMITTER INTERFACE IMPLEMENTATION
    // =============================================================================

    /**
     * Add event listener
     */
    public on(event: ModuleEvent | QueryEvent, listener: ModuleEventListener<ModuleEvent | QueryEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Add one-time event listener
     */
    public once(event: ModuleEvent | QueryEvent, listener: ModuleEventListener<ModuleEvent | QueryEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Remove event listener
     */
    public off(event: ModuleEvent | QueryEvent, listener: ModuleEventListener<ModuleEvent | QueryEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emit event
     */
    public emit(event: ModuleEvent | QueryEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Remove all listeners for an event or all events
     */
    public removeAllListeners(event?: ModuleEvent | QueryEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Get listener count for an event
     */
    public listenerCount(event: ModuleEvent | QueryEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Get all events that have listeners
     */
    public eventNames(): (ModuleEvent | QueryEvent)[] {
        return this.eventEmitter.eventNames();
    }
}