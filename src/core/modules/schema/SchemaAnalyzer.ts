/**
 * Schema Analyzer Module
 * 
 * Core database schema analysis and metadata extraction system for
 * HSQLDB databases. Focused on schema structure analysis and basic
 * optimization recommendations.
 * 
 * **Responsibilities:**
 * - Complete table and column metadata extraction via JDBC
 * - Index and constraint analysis with basic performance insights
 * - Basic data distribution and statistical analysis
 * - Schema validation and structural integrity checking
 * - Core optimization recommendations (delegated advanced analysis)
 * 
 * **Delegated to other modules:**
 * - Relationship discovery → RelationshipAnalyzer
 * - Schema reporting and comparison → DatabaseReporter
 * - Advanced query analysis → QueryAnalyzer
 * 
 * @author InitSysRev
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * // Initialize with HSQLManager
 * const manager = new HSQLManager(config);
 * await manager.initialize();
 * 
 * const schemaAnalyzer = new SchemaAnalyzer();
 * await schemaAnalyzer.initialize(manager);
 * 
 * // Analyze complete database schema
 * const schema = await schemaAnalyzer.analyzeSchema();
 * console.log(`Database contains ${schema.tables.length} tables`);
 * 
 * // Analyze specific table with real JDBC metadata
 * const playersTable = await schemaAnalyzer.analyzeTable('PLAYERS');
 * console.log(`PLAYERS table has ${playersTable.columns.length} columns`);
 * 
 * // Get basic optimization recommendations
 * const recommendations = await schemaAnalyzer.getOptimizationRecommendations();
 * recommendations.forEach(rec => console.log(`${rec.type}: ${rec.description}`));
 * ```
 */

import { 
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    HSQLDBError,
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
import { type ConnectionManager } from '../connection/ConnectionManager.js';
import { type JDBCConnection } from '../connection/JDBCConnectionFactory.js';
import { type CacheManager } from '../cache/CacheManager.js';
import { type CacheStatsCollector } from '../cache/CacheStatsCollector.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * Database column information
 * 
 * Complete metadata for a database column including type information,
 * constraints, default values, and analysis results.
 * 
 * @interface ColumnInfo
 */
export interface ColumnInfo {
    /** Column name */
    name: string;
    /** SQL data type */
    dataType: string;
    /** Java/JDBC type code */
    typeCode: number;
    /** Maximum length for character types */
    maxLength?: number;
    /** Precision for numeric types */
    precision?: number;
    /** Scale for decimal types */
    scale?: number;
    /** Whether column allows NULL values */
    nullable: boolean;
    /** Default value if any */
    defaultValue?: any;
    /** Whether column is part of primary key */
    isPrimaryKey: boolean;
    /** Whether column is part of foreign key */
    isForeignKey: boolean;
    /** Whether column has unique constraint */
    isUnique: boolean;
    /** Whether column is indexed */
    isIndexed: boolean;
    /** Column position in table (1-based) */
    ordinalPosition: number;
    /** Column comments/remarks */
    remarks?: string;
    /** Auto-increment information */
    autoIncrement?: boolean;
    /** Column statistics */
    statistics?: ColumnStatistics;
}

/**
 * Column statistics and data analysis
 * 
 * Statistical information about column data distribution,
 * cardinality, and patterns for optimization insights.
 * 
 * @interface ColumnStatistics
 */
export interface ColumnStatistics {
    /** Total number of rows */
    totalRows: number;
    /** Number of non-null values */
    nonNullCount: number;
    /** Number of unique values (cardinality) */
    uniqueCount: number;
    /** Most frequent value */
    mostFrequentValue?: any;
    /** Frequency of most common value */
    mostFrequentCount?: number;
    /** Minimum value (for comparable types) */
    minValue?: any;
    /** Maximum value (for comparable types) */
    maxValue?: any;
    /** Average value (for numeric types) */
    averageValue?: number;
    /** Standard deviation (for numeric types) */
    standardDeviation?: number;
    /** Sample values for analysis */
    sampleValues: any[];
    /** Data quality score (0-100) */
    qualityScore: number;
}

/**
 * Database index information
 * 
 * Complete metadata for database indexes including type,
 * columns, performance characteristics, and usage statistics.
 * 
 * @interface IndexInfo
 */
export interface IndexInfo {
    /** Index name */
    name: string;
    /** Table name */
    tableName: string;
    /** Index type (BTREE, HASH, etc.) */
    type: string;
    /** Whether index is unique */
    isUnique: boolean;
    /** Whether index is primary key */
    isPrimaryKey: boolean;
    /** Columns included in index */
    columns: Array<{
        /** Column name */
        name: string;
        /** Sort order (ASC/DESC) */
        sortOrder: 'ASC' | 'DESC';
        /** Position in index */
        position: number;
    }>;
    /** Index cardinality (estimated unique values) */
    cardinality?: number;
    /** Index size in pages/bytes */
    size?: number;
    /** Index usage statistics */
    usage?: IndexUsageStatistics;
}

/**
 * Index usage and performance statistics
 * 
 * @interface IndexUsageStatistics
 */
export interface IndexUsageStatistics {
    /** Number of seeks/lookups */
    seeks: number;
    /** Number of scans */
    scans: number;
    /** Number of updates */
    updates: number;
    /** Last usage timestamp */
    lastUsed?: Date;
    /** Efficiency score (0-100) */
    efficiencyScore: number;
}

/**
 * Database constraint information
 * 
 * @interface ConstraintInfo
 */
export interface ConstraintInfo {
    /** Constraint name */
    name: string;
    /** Constraint type */
    type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK' | 'NOT_NULL';
    /** Table name */
    tableName: string;
    /** Columns involved in constraint */
    columns: string[];
    /** Referenced table (for foreign keys) */
    referencedTable?: string;
    /** Referenced columns (for foreign keys) */
    referencedColumns?: string[];
    /** Update rule (for foreign keys) */
    updateRule?: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SET_DEFAULT' | 'NO_ACTION';
    /** Delete rule (for foreign keys) */
    deleteRule?: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SET_DEFAULT' | 'NO_ACTION';
    /** Constraint definition (for check constraints) */
    definition?: string;
    /** Whether constraint is deferrable */
    deferrable?: boolean;
    /** Whether constraint is initially deferred */
    initiallyDeferred?: boolean;
}

/**
 * Complete table analysis information
 * 
 * @interface TableInfo
 */
export interface TableInfo {
    /** Table name */
    name: string;
    /** Table schema */
    schema: string;
    /** Table type (TABLE, VIEW, etc.) */
    type: string;
    /** Table comments/remarks */
    remarks?: string;
    /** All columns in table */
    columns: ColumnInfo[];
    /** All indexes on table */
    indexes: IndexInfo[];
    /** All constraints on table */
    constraints: ConstraintInfo[];
    /** Table statistics */
    statistics: TableStatistics;
    /** Primary key information */
    primaryKey?: {
        /** Primary key name */
        name: string;
        /** Primary key columns */
        columns: string[];
    };
    /** Foreign keys from this table */
    foreignKeys: Array<{
        /** Foreign key name */
        name: string;
        /** Local columns */
        columns: string[];
        /** Referenced table */
        referencedTable: string;
        /** Referenced columns */
        referencedColumns: string[];
    }>;
    /** Foreign keys referencing this table */
    referencingKeys: Array<{
        /** Foreign key name */
        name: string;
        /** Referencing table */
        referencingTable: string;
        /** Referencing columns */
        referencingColumns: string[];
        /** Local columns being referenced */
        localColumns: string[];
    }>;
}

/**
 * Table statistics and metrics
 * 
 * @interface TableStatistics
 */
export interface TableStatistics {
    /** Total number of rows */
    rowCount: number;
    /** Estimated table size in bytes */
    sizeBytes: number;
    /** Average row size in bytes */
    averageRowSize: number;
    /** Number of data pages */
    pageCount?: number;
    /** Table fragmentation percentage */
    fragmentationPercent?: number;
    /** Last statistics update */
    lastUpdated: Date;
    /** Data growth rate (rows per day) */
    growthRate?: number;
    /** Data quality score (0-100) */
    qualityScore: number;
    /** Table health score (0-100) */
    healthScore: number;
}

/**
 * Complete database schema information
 * 
 * @interface DatabaseSchema
 */
export interface DatabaseSchema {
    /** Database name */
    name: string;
    /** Database version */
    version: string;
    /** Schema name */
    schemaName: string;
    /** Analysis timestamp */
    analyzedAt: Date;
    /** All tables in schema */
    tables: TableInfo[];
    /** Global schema statistics */
    statistics: SchemaStatistics;
    /** Schema health assessment */
    health: SchemaHealth;
}

/**
 * Schema-level statistics
 * 
 * @interface SchemaStatistics
 */
export interface SchemaStatistics {
    /** Total number of tables */
    tableCount: number;
    /** Total number of columns */
    columnCount: number;
    /** Total number of indexes */
    indexCount: number;
    /** Total number of constraints */
    constraintCount: number;
    /** Total database size in bytes */
    totalSizeBytes: number;
    /** Total row count across all tables */
    totalRowCount: number;
    /** Schema complexity score */
    complexityScore: number;
}

/**
 * Schema health assessment
 * 
 * @interface SchemaHealth
 */
export interface SchemaHealth {
    /** Overall health score (0-100) */
    overallScore: number;
    /** Performance health score */
    performanceScore: number;
    /** Data quality score */
    dataQualityScore: number;
    /** Design quality score */
    designScore: number;
    /** Security score */
    securityScore: number;
    /** Issues found */
    issues: SchemaIssue[];
    /** Recommendations */
    recommendations: OptimizationRecommendation[];
}

/**
 * Schema issue information
 * 
 * @interface SchemaIssue
 */
export interface SchemaIssue {
    /** Issue type */
    type: 'PERFORMANCE' | 'DATA_QUALITY' | 'DESIGN' | 'SECURITY';
    /** Severity level */
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    /** Issue title */
    title: string;
    /** Detailed description */
    description: string;
    /** Affected object (table, column, etc.) */
    affectedObject: string;
    /** Suggested resolution */
    resolution?: string;
    /** Impact assessment */
    impact: string;
}

/**
 * Optimization recommendation
 * 
 * @interface OptimizationRecommendation
 */
export interface OptimizationRecommendation {
    /** Recommendation type */
    type: 'INDEX' | 'CONSTRAINT' | 'PARTITIONING' | 'NORMALIZATION' | 'DENORMALIZATION' | 'ARCHIVING';
    /** Priority level */
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    /** Recommendation title */
    title: string;
    /** Detailed description */
    description: string;
    /** Expected benefit */
    expectedBenefit: string;
    /** Implementation effort */
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    /** SQL statements for implementation */
    implementation?: string[];
    /** Performance impact estimate */
    performanceImpact: number; // Percentage improvement
}

/**
 * Schema analysis configuration
 * 
 * @interface SchemaAnalysisConfig
 */
export interface SchemaAnalysisConfig {
    /** Enable deep column analysis */
    enableDeepAnalysis: boolean;
    /** Enable statistics collection */
    enableStatistics: boolean;
    /** Maximum sample size for column analysis */
    maxSampleSize: number;
    /** Analysis timeout in milliseconds */
    timeoutMs: number;
    /** Include system tables in analysis */
    includeSystemTables: boolean;
    /** Enable performance recommendations */
    enableRecommendations: boolean;
    /** Parallel analysis workers */
    parallelWorkers: number;
}

// =============================================================================
// SCHEMA ANALYZER CLASS
// =============================================================================

/**
 * Schema Analyzer
 * 
 * Core database schema analysis and metadata extraction system that provides
 * insights into database structure and basic optimization opportunities.
 * 
 * **Core Features:**
 * - Real JDBC metadata extraction from HSQLDB
 * - Table and column structure analysis
 * - Index and constraint discovery
 * - Basic statistical analysis and health assessment
 * - Performance optimization recommendations
 * 
 * **Focused Responsibilities:**
 * - Schema metadata extraction only
 * - Basic structural analysis and validation
 * - Simple optimization recommendations
 * 
 * @class SchemaAnalyzer
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<ModuleEvent>}
 * 
 * @author InitSysRev
 * @version 1.0.0
 */
export class SchemaAnalyzer implements BaseModule, ModuleEventEmitter<ModuleEvent> {
    /** @readonly Module name identifier */
    /** Stable module identifier used when registering and looking up the module. */
    public readonly name = 'schema-analyzer';
    /** @readonly Module version */
    /** Version of this module implementation. */
    public readonly version = '1.0.0';
    /** @readonly Whether the module is initialized */
    /** Whether initialization completed and the module is available for use. */
    public get isInitialized(): boolean { return this._initialized; }

    /**
     * Whether initialization completed successfully. @private Internal initialization state */
    private _initialized = false;
    /**
     * Owning manager used to resolve configuration and module dependencies. @private Reference to the HSQLManager instance */
    private manager?: HSQLManager;
    /**
     * Connection pool module used to borrow and release JDBC sessions. @private Reference to the ConnectionManager instance */
    private connectionManager?: ConnectionManager;
    /**
     * Cache module used to store and invalidate shared results. @private Reference to the CacheManager instance (optional) */
    private cacheManager?: CacheManager;
    /**
     * Collector receiving schema cache hit and miss observations. @private Reference to the CacheStatsCollector instance (optional) */
    private cacheStatsCollector?: CacheStatsCollector;
    /**
     * Effective configuration applied to this instance. @private Schema analysis configuration */
    private config?: SchemaAnalysisConfig;
    /**
     * Whether destruction has started; prevents operations after resource cleanup. @private Whether the analyzer has been destroyed */
    private destroyed = false;
    /**
     * Creation timestamp in milliseconds used to calculate uptime. @private Start time for uptime calculation */
    private readonly startTime = Date.now();
    /**
     * Module logger for operation context and diagnostic errors. @private Module logger instance */
    private logger: ModuleLogger;
    /**
     * Emitter that dispatches this module’s lifecycle and operation events. @private Event emitter implementation */
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent>;
    
    /**
     * Cached whole-database schema analyses. @private Cache for analyzed schemas */
    private schemaCache: Map<string, {value: DatabaseSchema; expiresAt: number}> = new Map();
    /**
     * Cached per-table schema metadata. @private Cache for analyzed tables */
    private tableCache: Map<string, {value: TableInfo; expiresAt: number}> = new Map();
    /**
     * Timestamp of the most recent schema analysis. @private Last analysis timestamp */
    private lastAnalysisTime?: Date;

    /**
     * Create a new SchemaAnalyzer instance
     * 
     * @constructor
     */
    constructor() {
        this.logger = createModuleLogger('SchemaAnalyzer-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'SchemaAnalyzer');

        // Initialize event listeners for module events
        this.eventEmitter.initializeEvents(Object.values(ModuleEvent));
    }

    /**
     * Initialize the schema analyzer
     * 
     * Sets up the schema analyzer with the provided HSQLManager instance,
     * configures analysis parameters, and establishes ConnectionManager integration.
     * 
     * @async
     * @public
     * @param {HSQLManager} manager - The HSQLDB manager instance
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     * 
     * @throws {ModuleAlreadyInitializedError} If already initialized
     * @throws {ConfigurationError} If manager parameter is null or undefined
     * 
     * @example
     * ```typescript
     * const manager = new HSQLManager(config);
     * await manager.initialize();
     * 
     * const schemaAnalyzer = new SchemaAnalyzer();
     * await schemaAnalyzer.initialize(manager);
     * ```
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('SchemaAnalyzer', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing SchemaAnalyzer v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();
        
        // Get ConnectionManager from HSQLManager
        this.connectionManager = this.manager.getModule<ConnectionManager>('connection-manager');
        if (!this.connectionManager) {
            throw new ConfigurationError('ConnectionManager not found in HSQLManager', ['connection-manager'], {
                operation: 'initialize'
            });
        }

        if (!this.connectionManager.isInitialized) {
            throw new ConfigurationError('ConnectionManager is not initialized', ['connection-manager'], {
                operation: 'initialize'
            });
        }

        // Try to get CacheManager for enhanced caching (optional)
        this.cacheManager = this.manager.getModule<CacheManager>('cache-manager');
        if (this.cacheManager) {
            this.logger.info('CacheManager found, enabling enhanced caching', {
                operation: 'initialize',
                cacheManagerVersion: this.cacheManager.version
            });
            
            // Try to get CacheStatsCollector for cache analytics
            this.cacheStatsCollector = this.manager.getModule<CacheStatsCollector>('cache-stats-collector');
            if (this.cacheStatsCollector) {
                this.logger.info('CacheStatsCollector found, enabling cache analytics', {
                    operation: 'initialize',
                    statsCollectorVersion: this.cacheStatsCollector.version
                });
            }
        } else {
            this.logger.info('CacheManager not found, using internal Map-based caching', {
                operation: 'initialize'
            });
        }
        
        this._initialized = true;
        resourceCleaner.register(this);
        
        this.logger.info('SchemaAnalyzer v1.0 initialized successfully', {
            operation: 'initialize-complete',
            enableDeepAnalysis: this.config?.enableDeepAnalysis,
            enableStatistics: this.config?.enableStatistics,
            connectionManagerVersion: this.connectionManager.version,
            cacheManagerAvailable: !!this.cacheManager,
            cacheStatsAvailable: !!this.cacheStatsCollector
        });

        // Emit initialization event
        this.emit(ModuleEvent.INITIALIZED, createEventData('analyzer-initialized', {
            enableDeepAnalysis: this.config?.enableDeepAnalysis,
            enableStatistics: this.config?.enableStatistics,
            connectionManagerIntegrated: true,
            cacheManagerIntegrated: !!this.cacheManager,
            cacheStatsIntegrated: !!this.cacheStatsCollector
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
            enableDeepAnalysis: true,
            enableStatistics: true,
            maxSampleSize: 10, // CORRECTION CRITIQUE: Réduire de 1000 à 10 pour éviter des rapports énormes
            timeoutMs: 300000, // 5 minutes
            includeSystemTables: false,
            enableRecommendations: true,
            parallelWorkers: 3
        };

        this.logger.debug('Configuration built for SchemaAnalyzer', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Get database connection from ConnectionManager
     * 
     * @private
     * @async
     * @returns {Promise<JDBCConnection>} Database connection
     * @throws {ConfigurationError} If ConnectionManager is not available
     */
    private async getConnection(): Promise<JDBCConnection> {
        if (!this.connectionManager) {
            throw new ConfigurationError('ConnectionManager not available', ['connectionManager'], {
                operation: 'get-connection'
            });
        }

        try {
            return await this.connectionManager.getConnection();
        } catch (error) {
            this.logger.error('Failed to get database connection', {
                operation: 'get-connection',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Release database connection back to ConnectionManager
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Connection to release
     */
    private async releaseConnection(connection: JDBCConnection): Promise<void> {
        if (!this.connectionManager) {
            this.logger.warn('ConnectionManager not available for connection release', {
                operation: 'release-connection'
            });
            return;
        }

        try {
            await this.connectionManager.releaseConnection(connection);
        } catch (error) {
            this.logger.warn('Failed to release connection', {
                operation: 'release-connection',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Extract database metadata using INFORMATION_SCHEMA
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @returns {Promise<{name: string, version: string}>} Database information
     */
    private async getDatabaseInfo(connection: JDBCConnection): Promise<{name: string, version: string}> {
        try {
            // CORRECTION CRITIQUE: Utiliser une approche plus robuste pour obtenir les infos de la base
            // HSQLDB a des fonctions spécifiques pour récupérer les métadonnées
            const result = await connection.execute(
                "SELECT DATABASE_NAME(), DATABASE_VERSION()"
            );

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    name: row[0] || 'HSQLDB',
                    version: row[1] || 'Unknown'
                };
            }

            return { name: 'HSQLDB', version: 'Unknown' };
        } catch (error) {
            // Fallback plus robuste en cas d'échec
            try {
                // Tenter avec une requête plus simple
                const fallbackResult = await connection.execute(
                    "SELECT 'HSQLDB' as name, 'Unknown' as version"
                );
                
                if (fallbackResult.rows.length > 0) {
                    const row = fallbackResult.rows[0];
                    return { 
                        name: row[0] || 'HSQLDB', 
                        version: row[1] || 'Unknown (detected via fallback)' 
                    };
                }
            } catch (fallbackError) {
                this.logger.warn('Failed to get database info, using defaults', {
                    operation: 'get-database-info',
                    error: error instanceof Error ? error.message : String(error),
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                });
            }
            
            return { name: 'HSQLDB', version: 'Unknown' };
        }
    }

    /**
     * Get all table names from the database
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {Promise<string[]>} Array of table names
     */
    private async getAllTables(connection: JDBCConnection, config: SchemaAnalysisConfig): Promise<string[]> {
        try {
            // CORRECTION FINALE: Filtrage précis des tables système HSQLDB
            // La table SYSTEMS est une vraie table StarMade, pas une table système
            let sql = `
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = 'PUBLIC'
            `;

            if (!config.includeSystemTables) {
                // CORRECTION FINALE: Exclure spécifiquement les tables système HSQLDB
                // mais inclure la table SYSTEMS qui est une vraie table StarMade
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_INDEXINFO%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_TABLES%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_COLUMNS%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'INFORMATION\\_SCHEMA%' ESCAPE '\\'`;
                // Note: SYSTEMS (sans underscore) est une table StarMade valide
            }

            sql += ` ORDER BY TABLE_NAME`;

            const result = await connection.execute(sql);
            return result.rows.map(row => row[0] as string);
        } catch (error) {
            this.logger.error('Failed to get table list', {
                operation: 'get-all-tables',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new QueryExecutionError('Failed to retrieve table list', 'Database query failed', [], undefined, undefined, {
                operation: 'get-all-tables'
            });
        }
    }

    /**
     * Get table count from database using HSQLDB-compatible query
     * 
     * Fast method to get the number of tables in the database without full analysis.
     * Uses the corrected HSQLDB-compatible query for table enumeration.
     * 
     * CORRECTION FINALE: Filtrage précis des tables système HSQLDB tout en incluant SYSTEMS
     * 
     * @async
     * @public
     * @param {boolean} [includeSystemTables=false] - Whether to include system tables
     * @returns {Promise<number>} Number of tables in the database
     * 
     * @throws {ModuleNotInitializedError} If the analyzer is not initialized
     * @throws {QueryExecutionError} If database query fails
     * 
     * @example
     * ```typescript
     * // Get count of user tables only
     * const userTableCount = await schemaAnalyzer.getTableCount();
     * console.log(`Database has ${userTableCount} user tables`);
     * 
     * // Get count including system tables
     * const allTableCount = await schemaAnalyzer.getTableCount(true);
     * console.log(`Database has ${allTableCount} total tables`);
     * ```
     */
    public async getTableCount(includeSystemTables: boolean = false): Promise<number> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('SchemaAnalyzer', 'get table count', {
                operation: 'get-table-count'
            });
        }

        this.logger.debug('Getting table count with HSQLDB-compatible query', {
            operation: 'get-table-count',
            includeSystemTables
        });

        let connection: JDBCConnection | undefined;

        try {
            connection = await this.getConnection();

            // CORRECTION FINALE: Filtrage précis des tables système HSQLDB
            // La table SYSTEMS est une vraie table StarMade, pas une table système
            
            let sql = `
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'PUBLIC'
            `;

            if (!includeSystemTables) {
                // CORRECTION FINALE: Exclure spécifiquement les tables système HSQLDB
                // mais inclure la table SYSTEMS qui est une vraie table StarMade
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_INDEXINFO%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_TABLES%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'SYSTEM\\_COLUMNS%' ESCAPE '\\'`;
                sql += ` AND TABLE_NAME NOT LIKE 'INFORMATION\\_SCHEMA%' ESCAPE '\\'`;
                // Note: SYSTEMS (sans underscore) est une table StarMade valide
            }

            const result = await connection.execute(sql);
            const tableCount = parseInt(result.rows[0][0] as string);

            this.logger.debug('Table count retrieved successfully', {
                operation: 'get-table-count-complete',
                tableCount,
                includeSystemTables,
                correctionApplied: 'Precise HSQLDB system table filtering while preserving SYSTEMS table'
            });

            return tableCount;

        } catch (error) {
            this.logger.error('Failed to get table count', {
                operation: 'get-table-count-error',
                includeSystemTables,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new QueryExecutionError(
                'Failed to retrieve table count', 
                'Database query failed', 
                [], 
                undefined, 
                undefined, 
                {
                    operation: 'get-table-count'
                }
            );
        } finally {
            if (connection) {
                await this.releaseConnection(connection);
            }
        }
    }

    /**
     * Get table columns with complete metadata
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {Promise<ColumnInfo[]>} Array of column information
     */
    private async getTableColumns(
        connection: JDBCConnection, 
        tableName: string, 
        config: SchemaAnalysisConfig
    ): Promise<ColumnInfo[]> {
        try {
            // CORRECTION CRITIQUE: Requête HSQLDB simplifiée sans REMARKS et IS_AUTOINCREMENT
            // qui peuvent ne pas exister dans toutes les versions
            const sql = `
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    ORDINAL_POSITION
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'PUBLIC'
                ORDER BY ORDINAL_POSITION
            `;

            const result = await connection.execute(sql, [tableName]);
            const columns: ColumnInfo[] = [];

            for (const row of result.rows) {
                const columnInfo: ColumnInfo = {
                    name: row[0] as string,
                    dataType: row[1] as string,
                    typeCode: this.getJDBCTypeCode(row[1] as string),
                    maxLength: row[2] ? parseInt(row[2] as string) : undefined,
                    precision: row[3] ? parseInt(row[3] as string) : undefined,
                    scale: row[4] ? parseInt(row[4] as string) : undefined,
                    nullable: (row[5] as string).toUpperCase() === 'YES',
                    defaultValue: row[6] || undefined,
                    ordinalPosition: parseInt(row[7] as string),
                    remarks: undefined, // Pas utilisé pour éviter les problèmes de compatibilité
                    autoIncrement: false, // Pas utilisé pour éviter les problèmes de compatibilité
                    isPrimaryKey: false, // Will be set later from constraints
                    isForeignKey: false, // Will be set later from constraints
                    isUnique: false,     // Will be set later from constraints
                    isIndexed: false     // Will be set later from indexes
                };

                // Add statistics if enabled
                if (config.enableStatistics) {
                    columnInfo.statistics = await this.getColumnStatistics(
                        connection, 
                        tableName, 
                        columnInfo.name, 
                        columnInfo.dataType,
                        config
                    );
                }

                columns.push(columnInfo);
            }

            return columns;
        } catch (error) {
            this.logger.error('Failed to get table columns', {
                operation: 'get-table-columns',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get column statistics and data analysis
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @param {string} columnName - Column name
     * @param {string} dataType - Column data type
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {Promise<ColumnStatistics>} Column statistics
     */
    private async getColumnStatistics(
        connection: JDBCConnection,
        tableName: string,
        columnName: string,
        dataType: string,
        config: SchemaAnalysisConfig
    ): Promise<ColumnStatistics> {
        try {
            // Basic count statistics
            const countSql = `
                SELECT 
                    COUNT(*) as total_rows,
                    COUNT(${this.quoteIdentifier(columnName)}) as non_null_count,
                    COUNT(DISTINCT ${this.quoteIdentifier(columnName)}) as unique_count
                FROM ${this.quoteIdentifier(tableName)}
            `;

            const countResult = await connection.execute(countSql);
            const countRow = countResult.rows[0];
            
            const totalRows = parseInt(countRow[0] as string);
            const nonNullCount = parseInt(countRow[1] as string);
            const uniqueCount = parseInt(countRow[2] as string);

            let minValue: any = undefined;
            let maxValue: any = undefined;
            let averageValue: number | undefined = undefined;
            let standardDeviation: number | undefined = undefined;
            let mostFrequentValue: any = undefined;
            let mostFrequentCount: number | undefined = undefined;

            // Type-specific statistics for numeric types
            if (this.isNumericType(dataType) && nonNullCount > 0) {
                try {
                    const numericSql = `
                        SELECT 
                            MIN(${this.quoteIdentifier(columnName)}) as min_val,
                            MAX(${this.quoteIdentifier(columnName)}) as max_val,
                            AVG(CAST(${this.quoteIdentifier(columnName)} AS DOUBLE)) as avg_val
                        FROM ${this.quoteIdentifier(tableName)}
                        WHERE ${this.quoteIdentifier(columnName)} IS NOT NULL
                    `;

                    const numericResult = await connection.execute(numericSql);
                    if (numericResult.rows.length > 0) {
                        const numericRow = numericResult.rows[0];
                        minValue = numericRow[0];
                        maxValue = numericRow[1];
                        averageValue = numericRow[2] !== null && numericRow[2] !== undefined ? parseFloat(numericRow[2] as string) : undefined;
                    }
                } catch (error) {
                    this.logger.debug('Failed to get numeric statistics', {
                        operation: 'get-numeric-statistics',
                        tableName,
                        columnName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Get most frequent value (limited to avoid large result sets)
            if (nonNullCount > 0) {
                try {
                    const frequentSql = `
                        SELECT ${this.quoteIdentifier(columnName)}, COUNT(*) as freq
                        FROM ${this.quoteIdentifier(tableName)}
                        WHERE ${this.quoteIdentifier(columnName)} IS NOT NULL
                        GROUP BY ${this.quoteIdentifier(columnName)}
                        ORDER BY freq DESC
                        LIMIT 1
                    `;

                    const frequentResult = await connection.execute(frequentSql);
                    if (frequentResult.rows.length > 0) {
                        const frequentRow = frequentResult.rows[0];
                        const rawValue = frequentRow[0];
                        mostFrequentCount = parseInt(frequentRow[1] as string);

                        mostFrequentValue = this.sanitizeValueForReport(rawValue);
                    }
                } catch (error) {
                    this.logger.debug('Failed to get most frequent value', {
                        operation: 'get-frequent-value',
                        tableName,
                        columnName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Get sample values (limited)
            const sampleValues: any[] = [];
            if (nonNullCount > 0) {
                try {
                    const maxSamples = Math.min(config.maxSampleSize, 10); // Limit sample size for performance
                    const sampleSql = `
                        SELECT ${this.quoteIdentifier(columnName)}
                        FROM ${this.quoteIdentifier(tableName)}
                        WHERE ${this.quoteIdentifier(columnName)} IS NOT NULL
                        LIMIT ${maxSamples}
                    `;

                    const sampleResult = await connection.execute(sampleSql);
                    for (const row of sampleResult.rows) {
                        sampleValues.push(this.sanitizeValueForReport(row[0]));
                    }
                } catch (error) {
                    this.logger.debug('Failed to get sample values', {
                        operation: 'get-sample-values',
                        tableName,
                        columnName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Calculate quality score
            const qualityScore = this.calculateDataQualityScore(
                totalRows, 
                nonNullCount, 
                uniqueCount, 
                dataType
            );

            return {
                totalRows,
                nonNullCount,
                uniqueCount,
                mostFrequentValue,
                mostFrequentCount,
                minValue,
                maxValue,
                averageValue,
                standardDeviation,
                sampleValues,
                qualityScore
            };

        } catch (error) {
            this.logger.warn('Failed to get column statistics, using defaults', {
                operation: 'get-column-statistics',
                tableName,
                columnName,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                totalRows: 0,
                nonNullCount: 0,
                uniqueCount: 0,
                sampleValues: [],
                qualityScore: 50 // Default neutral score
            };
        }
    }

    /**
     * Get table indexes
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @returns {Promise<IndexInfo[]>} Array of index information
     */
    private async getTableIndexes(connection: JDBCConnection, tableName: string): Promise<IndexInfo[]> {
        try {
            // HSQLDB exposes JDBC index metadata through SYSTEM_INDEXINFO.
            const sql = `
                SELECT 
                    INDEX_NAME,
                    NON_UNIQUE,
                    COLUMN_NAME,
                    ORDINAL_POSITION,
                    ASC_OR_DESC
                FROM INFORMATION_SCHEMA.SYSTEM_INDEXINFO 
                WHERE TABLE_NAME = ? AND TABLE_SCHEM = 'PUBLIC'
                ORDER BY INDEX_NAME, ORDINAL_POSITION
            `;

            const result = await connection.execute(sql, [tableName]);
            const indexMap = new Map<string, IndexInfo>();

            for (const row of result.rows) {
                const indexName = row[0] as string;
                const nonUnique = row[1] as boolean;
                const columnName = row[2] as string;
                const seqInIndex = parseInt(row[3] as string);
                const collation = (row[4] as string) || 'A';

                if (!indexMap.has(indexName)) {
                    indexMap.set(indexName, {
                        name: indexName,
                        tableName,
                        type: 'BTREE', // HSQLDB default
                        isUnique: !nonUnique,
                        isPrimaryKey: indexName.includes('PK') || indexName.includes('PRIMARY'),
                        columns: []
                    });
                }

                const index = indexMap.get(indexName)!;
                index.columns.push({
                    name: columnName,
                    sortOrder: collation === 'D' ? 'DESC' : 'ASC',
                    position: seqInIndex
                });
            }

            return Array.from(indexMap.values());
        } catch (error) {
            this.logger.warn('Failed to get table indexes', {
                operation: 'get-table-indexes',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            // Retourner un tableau vide au lieu de faire échouer l'analyse complète
            return [];
        }
    }

    /**
     * Get table constraints
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @returns {Promise<ConstraintInfo[]>} Array of constraint information
     */
    private async getTableConstraints(connection: JDBCConnection, tableName: string): Promise<ConstraintInfo[]> {
        const constraints: ConstraintInfo[] = [];

        // CORRECTION 1: Primary keys avec gestion d'erreur robuste
        try {
            const pkSql = `
                SELECT 
                    CONSTRAINT_NAME,
                    COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'PUBLIC'
                  AND CONSTRAINT_NAME IN (
                      SELECT CONSTRAINT_NAME 
                      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
                      WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'PUBLIC' 
                        AND CONSTRAINT_TYPE = 'PRIMARY KEY'
                  )
                ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION
            `;

            const pkResult = await connection.execute(pkSql, [tableName, tableName]);
            const pkMap = new Map<string, ConstraintInfo>();

            for (const row of pkResult.rows) {
                const constraintName = row[0] as string;
                const columnName = row[1] as string;

                if (!pkMap.has(constraintName)) {
                    pkMap.set(constraintName, {
                        name: constraintName,
                        type: 'PRIMARY_KEY',
                        tableName,
                        columns: []
                    });
                }

                pkMap.get(constraintName)!.columns.push(columnName);
            }

            constraints.push(...Array.from(pkMap.values()));
        } catch (pkError) {
            this.logger.debug('Failed to get primary keys', {
                operation: 'get-primary-keys',
                tableName,
                error: pkError instanceof Error ? pkError.message : String(pkError)
            });
        }

        // CORRECTION 2: Foreign keys avec requête standard INFORMATION_SCHEMA
        try {
            const fkSql = `
                SELECT 
                    kcu.CONSTRAINT_NAME,
                    kcu.COLUMN_NAME,
                    ccu.TABLE_NAME as REFERENCED_TABLE_NAME,
                    ccu.COLUMN_NAME as REFERENCED_COLUMN_NAME,
                    rc.UPDATE_RULE, rc.DELETE_RULE
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
                    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ccu 
                    ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
                   AND ccu.ORDINAL_POSITION = kcu.POSITION_IN_UNIQUE_CONSTRAINT
                WHERE kcu.TABLE_NAME = ? AND kcu.TABLE_SCHEMA = 'PUBLIC'
                ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
            `;

            const fkResult = await connection.execute(fkSql, [tableName]);
            const fkMap = new Map<string, ConstraintInfo>();

            for (const row of fkResult.rows) {
                const constraintName = row[0] as string;
                const fkColumnName = row[1] as string;
                const pkTableName = row[2] as string;
                const pkColumnName = row[3] as string;

                if (!fkMap.has(constraintName)) {
                    fkMap.set(constraintName, {
                        name: constraintName,
                        type: 'FOREIGN_KEY',
                        tableName,
                        columns: [],
                        referencedTable: pkTableName,
                        referencedColumns: [],
                        updateRule: String(row[4] || 'NO ACTION').replace(/ /g, '_') as ConstraintInfo['updateRule'],
                        deleteRule: String(row[5] || 'NO ACTION').replace(/ /g, '_') as ConstraintInfo['deleteRule']
                    });
                }

                const fkConstraint = fkMap.get(constraintName)!;
                fkConstraint.columns.push(fkColumnName);
                fkConstraint.referencedColumns!.push(pkColumnName);
            }

            constraints.push(...Array.from(fkMap.values()));
        } catch (fkError) {
            this.logger.debug('Failed to get foreign keys', {
                operation: 'get-foreign-keys',
                tableName,
                error: fkError instanceof Error ? fkError.message : String(fkError)
            });
        }

        return constraints;

    }

    /**
     * Extract foreign key information
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @returns {Promise<{foreignKeys: Array<any>, referencingKeys: Array<any>}>} Foreign key information
     */
    private async extractForeignKeys(
        connection: JDBCConnection, 
        tableName: string
    ): Promise<{foreignKeys: Array<any>, referencingKeys: Array<any>}> {
        const foreignKeys: Array<any> = [];
        const referencingKeys: Array<any> = [];

        // CORRECTION 1: Foreign keys FROM this table avec requête standard
        try {
            const fkFromSql = `
                SELECT 
                    kcu.CONSTRAINT_NAME,
                    kcu.COLUMN_NAME,
                    ccu.TABLE_NAME as REFERENCED_TABLE_NAME,
                    ccu.COLUMN_NAME as REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
                    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ccu 
                    ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
                   AND ccu.ORDINAL_POSITION = kcu.POSITION_IN_UNIQUE_CONSTRAINT
                WHERE kcu.TABLE_NAME = ? AND kcu.TABLE_SCHEMA = 'PUBLIC'
                ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
            `;

            const fkFromResult = await connection.execute(fkFromSql, [tableName]);
            const fkFromMap = new Map<string, any>();

            for (const row of fkFromResult.rows) {
                const fkName = row[0] as string;
                const fkColumn = row[1] as string;
                const pkTable = row[2] as string;
                const pkColumn = row[3] as string;

                if (!fkFromMap.has(fkName)) {
                    fkFromMap.set(fkName, {
                        name: fkName,
                        columns: [],
                        referencedTable: pkTable,
                        referencedColumns: []
                    });
                }

                const fk = fkFromMap.get(fkName)!;
                fk.columns.push(fkColumn);
                fk.referencedColumns.push(pkColumn);
            }

            foreignKeys.push(...Array.from(fkFromMap.values()));
        } catch (fkFromError) {
            this.logger.debug('Failed to extract outgoing foreign keys', {
                operation: 'extract-fk-from',
                tableName,
                error: fkFromError instanceof Error ? fkFromError.message : String(fkFromError)
            });
        }

        // CORRECTION 2: Foreign keys TO this table avec requête standard
        try {
            const fkToSql = `
                SELECT 
                    kcu.CONSTRAINT_NAME,
                    kcu.TABLE_NAME as REFERENCING_TABLE_NAME,
                    kcu.COLUMN_NAME,
                    ccu.COLUMN_NAME as REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
                    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ccu 
                    ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
                   AND ccu.ORDINAL_POSITION = kcu.POSITION_IN_UNIQUE_CONSTRAINT
                WHERE ccu.TABLE_NAME = ? AND ccu.TABLE_SCHEMA = 'PUBLIC'
                ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
            `;

            const fkToResult = await connection.execute(fkToSql, [tableName]);
            const fkToMap = new Map<string, any>();

            for (const row of fkToResult.rows) {
                const fkName = row[0] as string;
                const fkTable = row[1] as string;
                const fkColumn = row[2] as string;
                const pkColumn = row[3] as string;

                if (!fkToMap.has(fkName)) {
                    fkToMap.set(fkName, {
                        name: fkName,
                        referencingTable: fkTable,
                        referencingColumns: [],
                        localColumns: []
                    });
                }

                const fk = fkToMap.get(fkName)!;
                fk.referencingColumns.push(fkColumn);
                fk.localColumns.push(pkColumn);
            }

            referencingKeys.push(...Array.from(fkToMap.values()));
        } catch (fkToError) {
            this.logger.debug('Failed to extract incoming foreign keys', {
                operation: 'extract-fk-to',
                tableName,
                error: fkToError instanceof Error ? fkToError.message : String(fkToError)
            });
        }



        return { foreignKeys, referencingKeys };
    }

    /**
     * Quote a database metadata identifier, preserving embedded double quotes.
     * @param identifier - Exact table or column name returned by HSQLDB.
     * @returns SQL delimited identifier.
     */
    private quoteIdentifier(identifier: string): string {
        return '"' + identifier.replace(/"/g, '""') + '"';
    }

    /**
     * Calculate table statistics
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @param {ColumnInfo[]} columns - Table columns
     * @returns {Promise<TableStatistics>} Table statistics
     */
    private async calculateTableStatistics(
        connection: JDBCConnection,
        tableName: string,
        columns: ColumnInfo[]
    ): Promise<TableStatistics> {
        try {
            // Get row count
            const countSql = `SELECT COUNT(*) FROM ${this.quoteIdentifier(tableName)}`;
            const countResult = await connection.execute(countSql);
            const rowCount = parseInt(countResult.rows[0][0] as string);

            // Estimate table size (basic calculation)
            const averageRowSize = this.estimateRowSize(columns);
            const sizeBytes = rowCount * averageRowSize;

            // Calculate data quality score based on columns
            const qualityScore = this.calculateTableDataQuality(columns);

            // Calculate health score
            const healthScore = this.calculateTableHealth(rowCount, columns, qualityScore);

            return {
                rowCount,
                sizeBytes,
                averageRowSize,
                lastUpdated: new Date(),
                qualityScore,
                healthScore
            };
        } catch (error) {
            this.logger.warn('Failed to calculate table statistics', {
                operation: 'calculate-table-statistics',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                rowCount: 0,
                sizeBytes: 0,
                averageRowSize: 0,
                lastUpdated: new Date(),
                qualityScore: 50,
                healthScore: 50
            };
        }
    }

    /**
     * Analyze a table's structure and metadata
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Name of table to analyze
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {Promise<TableInfo>} Complete table information
     */
    private async analyzeTableInternal(
        connection: JDBCConnection, 
        tableName: string, 
        config: SchemaAnalysisConfig
    ): Promise<TableInfo> {
        this.logger.debug('Analyzing table structure', {
            operation: 'analyze-table-internal',
            tableName
        });

        // Get basic table information
        const tableInfo = await this.getTableBasicInfo(connection, tableName);
        
        // Get column information
        const columns = await this.getTableColumns(connection, tableName, config);
        
        // Get indexes
        const indexes = await this.getTableIndexes(connection, tableName);
        
        // Get constraints
        const constraints = await this.getTableConstraints(connection, tableName);
        
        // Calculate table statistics
        const statistics = await this.calculateTableStatistics(connection, tableName, columns);

        // Extract primary key information
        const primaryKey = this.extractPrimaryKey(constraints);
        
        // Extract foreign key information
        const { foreignKeys, referencingKeys } = await this.extractForeignKeys(connection, tableName);

        return {
            name: tableName,
            schema: tableInfo.schema,
            type: tableInfo.type,
            remarks: tableInfo.remarks,
            columns,
            indexes,
            constraints,
            statistics,
            primaryKey,
            foreignKeys,
            referencingKeys
        };
    }

    /**
     * Analyze complete database schema
     * 
     * Performs a comprehensive analysis of the entire database schema using real JDBC metadata,
     * including all tables, columns, indexes, constraints, and basic health assessment.
     * Uses advanced caching with CacheManager when available for improved performance.
     * 
     * @async
     * @public
     * @param {Partial<SchemaAnalysisConfig>} [options] - Analysis configuration options
     * @returns {Promise<DatabaseSchema>} Complete database schema information
     * 
     * @throws {ModuleNotInitializedError} If the analyzer is not initialized
     * @throws {QueryExecutionError} If database queries fail
     * @throws {HSQLDBError} If database connection issues occur
     * 
     * @example
     * ```typescript
     * // Basic schema analysis with real JDBC data
     * const schema = await schemaAnalyzer.analyzeSchema();
     * console.log(`Found ${schema.tables.length} tables`);
     * 
     * // Deep analysis with statistics
     * const detailedSchema = await schemaAnalyzer.analyzeSchema({
     *   enableDeepAnalysis: true,
     *   enableStatistics: true,
     *   maxSampleSize: 5000,
     *   includeSystemTables: false
     * });
     * ```
     * 
     * @see {@link DatabaseSchema} For complete schema structure
     * @see {@link SchemaAnalysisConfig} For configuration options
     * @see {@link analyzeTable} For single table analysis
     */
    public async analyzeSchema(options?: Partial<SchemaAnalysisConfig>): Promise<DatabaseSchema> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('SchemaAnalyzer', 'analyze schema', {
                operation: 'analyze-schema'
            });
        }

        const config = { ...this.config!, ...options };
        const startTime = Date.now();

        // Generate cache key for this analysis
        const cacheKey = this.generateSchemaCacheKey(config);
        
        // Try to get from advanced cache first
        if (this.cacheManager) {
            try {
                const cachedSchema = await this.cacheManager.get<DatabaseSchema>(cacheKey);
                if (cachedSchema) {
                    this.logger.debug('Schema analysis returned from cache', {
                        operation: 'analyze-schema-cached',
                        cacheKey,
                        cacheHit: true
                    });
                    
                    // Record cache hit
                    if (this.cacheStatsCollector) {
                        this.cacheStatsCollector.recordAccess(
                            cacheKey, 
                            true, 
                            this.estimateObjectSize(cachedSchema),
                            Date.now() - startTime
                        );
                    }
                    
                    return cachedSchema;
                }
            } catch (error) {
                this.logger.warn('Cache retrieval failed, falling back to direct analysis', {
                    operation: 'analyze-schema-cache-fallback',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        } else {
            // Fallback to internal cache
            if (this.schemaCache.has(cacheKey) && this.schemaCache.get(cacheKey)!.expiresAt > Date.now()) {
                const cached = this.schemaCache.get(cacheKey)!;
                this.logger.debug('Schema analysis returned from internal cache', {
                    operation: 'analyze-schema-internal-cached',
                    cacheKey
                });
                return cached.value;
            }
        }

        this.logger.info('Starting comprehensive schema analysis with real JDBC metadata', {
            operation: 'analyze-schema',
            enableDeepAnalysis: config.enableDeepAnalysis,
            enableStatistics: config.enableStatistics,
            includeSystemTables: config.includeSystemTables,
            cacheKey
        });

        let connection: JDBCConnection | undefined;
        
        try {
            // Get database connection
            connection = await this.getConnection();

            // Get database metadata
            const databaseInfo = await this.getDatabaseInfo(connection);
            
            // Get all tables
            const tableNames = await this.getAllTables(connection, config);
            
            this.logger.debug('Found tables for analysis', {
                operation: 'analyze-schema',
                tableCount: tableNames.length,
                tables: tableNames
            });

            // Analyze each table
            const analyzedTables: TableInfo[] = [];
            for (const tableName of tableNames) {
                try {
                    const tableInfo = await this.analyzeTableInternal(connection, tableName, config);
                    analyzedTables.push(tableInfo);
                    
                    this.logger.debug('Table analyzed successfully', {
                        operation: 'analyze-table',
                        tableName,
                        columns: tableInfo.columns.length,
                        indexes: tableInfo.indexes.length,
                        constraints: tableInfo.constraints.length
                    });
                } catch (error) {
                    this.logger.warn('Failed to analyze table, skipping', {
                        operation: 'analyze-table-error',
                        tableName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with other tables instead of failing completely
                }
            }

            // Calculate schema statistics
            const statistics = this.calculateSchemaStatistics(analyzedTables);
            
            // Assess schema health
            const health = this.assessSchemaHealth(analyzedTables, config);

            const schema: DatabaseSchema = {
                name: databaseInfo.name,
                version: databaseInfo.version,
                schemaName: 'PUBLIC', // HSQLDB default schema
                analyzedAt: new Date(),
                tables: analyzedTables,
                statistics,
                health
            };

            // Store in cache with appropriate TTL
            const cacheTTL = this.getSchemaCacheTTL(config);
            const schemaSize = this.estimateObjectSize(schema);
            
            if (this.cacheManager) {
                try {
                    await this.cacheManager.set(cacheKey, schema, { ttl: cacheTTL });
                    this.logger.debug('Schema analysis result cached', {
                        operation: 'analyze-schema-cache-store',
                        cacheKey,
                        ttl: cacheTTL,
                        sizeBytes: schemaSize
                    });
                    
                    // Record cache miss
                    if (this.cacheStatsCollector) {
                        this.cacheStatsCollector.recordAccess(
                            cacheKey, 
                            false, 
                            schemaSize,
                            Date.now() - startTime
                        );
                    }
                } catch (error) {
                    this.logger.warn('Failed to cache schema analysis result', {
                        operation: 'analyze-schema-cache-store-error',
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            } else {
                // Fallback to internal cache
                this.schemaCache.set(cacheKey, {value: schema, expiresAt: Date.now() + cacheTTL});
            }
            
            this.lastAnalysisTime = new Date();

            const duration = Date.now() - startTime;
            this.logger.info('Schema analysis completed successfully', {
                operation: 'analyze-schema-complete',
                duration,
                tableCount: analyzedTables.length,
                totalColumns: statistics.columnCount,
                totalIndexes: statistics.indexCount,
                healthScore: health.overallScore,
                cached: false,
                cacheKey,
                sizeBytes: schemaSize
            });

            // Emit completion event
            this.emit(ModuleEvent.INITIALIZED, createEventData('schema-analysis-completed', {
                tableCount: analyzedTables.length,
                duration,
                healthScore: health.overallScore,
                databaseVersion: databaseInfo.version,
                cached: false,
                cacheKey
            }, this.name));

            return schema;

        } catch (error) {
            this.logger.error('Schema analysis failed', {
                operation: 'analyze-schema-error',
                error: error instanceof Error ? error.message : String(error)
            });

            // Record cache miss with error
            if (this.cacheStatsCollector) {
                this.cacheStatsCollector.recordAccess(
                    cacheKey, 
                    false, 
                    0,
                    Date.now() - startTime
                );
            }

            // Emit error event
            this.emit(ModuleEvent.ERROR, createEventData('schema-analysis-failed', {
                error: error instanceof Error ? error.message : String(error)
            }, this.name));

            throw error;
        } finally {
            if (connection) {
                await this.releaseConnection(connection);
            }
        }
    }

    /**
     * Generate cache key for schema analysis
     * 
     * @private
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {string} Cache key
     */
    private generateSchemaCacheKey(config: SchemaAnalysisConfig): string {
        const configHash = this.getConfigHash(config);
        return `schema:analysis:${configHash}`;
    }

    /**
     * Generate cache key for table analysis
     * 
     * @private
     * @param {string} tableName - Table name
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {string} Cache key
     */
    private generateTableCacheKey(tableName: string, config: SchemaAnalysisConfig): string {
        const configHash = this.getConfigHash(config);
        return `schema:table:${tableName}:${configHash}`;
    }

    /**
     * Generate configuration hash for cache keys
     * 
     * @private
     * @param {SchemaAnalysisConfig} config - Configuration
     * @returns {string} Configuration hash
     */
    private getConfigHash(config: SchemaAnalysisConfig): string {
        const configStr = JSON.stringify({
            enableDeepAnalysis: config.enableDeepAnalysis,
            enableStatistics: config.enableStatistics,
            maxSampleSize: config.maxSampleSize,
            includeSystemTables: config.includeSystemTables,
            enableRecommendations: config.enableRecommendations
        });
        
        // Simple hash function for configuration
        let hash = 0;
        for (let i = 0; i < configStr.length; i++) {
            const char = configStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get appropriate TTL for schema cache
     * 
     * @private
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {number} TTL in milliseconds
     */
    private getSchemaCacheTTL(config: SchemaAnalysisConfig): number {
        // Schema metadata changes infrequently, so longer TTL is appropriate
        if (config.enableStatistics) {
            return 5 * 60 * 1000; // 5 minutes for statistical analysis
        } else {
            return 15 * 60 * 1000; // 15 minutes for basic structure analysis
        }
    }

    /**
     * Get appropriate TTL for table cache
     * 
     * @private
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {number} TTL in milliseconds
     */
    private getTableCacheTTL(config: SchemaAnalysisConfig): number {
        // Tables change less frequently than statistics
        if (config.enableStatistics) {
            return 3 * 60 * 1000; // 3 minutes for table statistics
        } else {
            return 10 * 60 * 1000; // 10 minutes for table structure
        }
    }

    /**
     * Estimate object size in bytes for cache statistics
     * 
     * @private
     * @param {any} obj - Object to estimate
     * @returns {number} Estimated size in bytes
     */
    private estimateObjectSize(obj: any): number {
        if (!obj) return 0;
        
        try {
            // Simple estimation based on JSON serialization
            const jsonStr = JSON.stringify(obj);
            return jsonStr.length * 2; // Approximate UTF-16 encoding
        } catch (error) {
            // Fallback estimation for complex objects
            if (typeof obj === 'object') {
                if (Array.isArray(obj)) {
                    return obj.length * 100; // Estimate 100 bytes per array item
                } else {
                    return Object.keys(obj).length * 50; // Estimate 50 bytes per property
                }
            }
            return 100; // Default estimate
        }
    }

    /**
     * Clear all caches (both advanced and internal)
     * 
     * @private
     * @async
     * @param {string} [pattern] - Optional pattern to match for selective clearing
     */
    private async clearAllCaches(pattern?: string): Promise<void> {
        // Clear advanced cache if available
        if (this.cacheManager) {
            try {
                const keys = await this.cacheManager.keys('schema:*');
                for (const key of keys) {
                    if (!pattern || key.includes(pattern)) await this.cacheManager.delete(key);
                }

                this.logger.debug('Advanced cache cleared', {
                    operation: 'clear-advanced-cache',
                    pattern
                });
            } catch (error) {
                this.logger.warn('Failed to clear advanced cache', {
                    operation: 'clear-advanced-cache-error',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // Clear internal caches
        if (pattern) {
            // Clear by pattern
            for (const key of this.schemaCache.keys()) {
                if (key.includes(pattern)) {
                    this.schemaCache.delete(key);
                }
            }
            for (const key of this.tableCache.keys()) {
                if (key.includes(pattern)) {
                    this.tableCache.delete(key);
                }
            }
        } else {
            // Clear all
            this.schemaCache.clear();
            this.tableCache.clear();
        }
        
        this.lastAnalysisTime = undefined;
        
        this.logger.debug('Internal caches cleared', {
            operation: 'clear-internal-cache',
            pattern
        });
    }

    /**
     * Clear analysis cache
     * 
     * Clears all cached analysis results to force fresh analysis on next request.
     * This includes both advanced cache (CacheManager) and internal cache.
     * This is useful when the database schema may have changed externally.
     * 
     * @public
     * @param {string} [pattern] - Optional pattern to match for selective clearing
     * @returns {Promise<void>}
     * 
     * @example
     * ```typescript
     * // Clear all cache after schema modifications
     * await executeSchemaChanges();
     * await schemaAnalyzer.clearCache();
     * 
     * // Clear specific table cache
     * await schemaAnalyzer.clearCache('PLAYERS');
     * 
     * // Next analysis will be fresh
     * const updatedSchema = await schemaAnalyzer.analyzeSchema();
     * ```
     */
    public async clearCache(pattern?: string): Promise<void> {
        this.logger.info('Clearing analysis cache', {
            operation: 'clear-cache',
            pattern,
            advancedCacheAvailable: !!this.cacheManager
        });
        
        await this.clearAllCaches(pattern);
        
        this.logger.info('Analysis cache cleared successfully', {
            operation: 'clear-cache-complete',
            pattern
        });
    }

    /**
     * Analyze a specific table in detail using real JDBC metadata
     * 
     * Performs comprehensive analysis of a single table including
     * column metadata, statistics, indexes, constraints, and relationships.
     * Uses advanced caching with CacheManager when available for improved performance.
     * 
     * @async
     * @public
     * @param {string} tableName - Name of the table to analyze
     * @param {Partial<SchemaAnalysisConfig>} [options] - Analysis configuration options
     * @returns {Promise<TableInfo>} Complete table analysis information
     * 
     * @throws {ModuleNotInitializedError} If the analyzer is not initialized
     * @throws {QueryExecutionError} If database queries fail
     * @throws {Error} If table does not exist
     * 
     * @example
     * ```typescript
     * // Analyze PLAYERS table with real data
     * const playersTable = await schemaAnalyzer.analyzeTable('PLAYERS');
     * console.log(`PLAYERS table has ${playersTable.columns.length} columns`);
     * console.log(`Row count: ${playersTable.statistics.rowCount}`);
     * 
     * // Deep analysis with statistics
     * const detailedAnalysis = await schemaAnalyzer.analyzeTable('ENTITIES', {
     *   enableDeepAnalysis: true,
     *   enableStatistics: true,
     *   maxSampleSize: 10000
     * });
     * ```
     * 
     * @see {@link TableInfo} For complete table information structure
     * @see {@link ColumnInfo} For column details
     * @see {@link TableStatistics} For table metrics
     */
    public async analyzeTable(tableName: string, options?: Partial<SchemaAnalysisConfig>): Promise<TableInfo> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('SchemaAnalyzer', 'analyze table', {
                operation: 'analyze-table'
            });
        }

        const config = { ...this.config!, ...options };
        const startTime = Date.now();
        
        // Generate cache key for this table analysis
        const cacheKey = this.generateTableCacheKey(tableName, config);

        // Try to get from advanced cache first
        if (this.cacheManager) {
            try {
                const cachedTable = await this.cacheManager.get<TableInfo>(cacheKey);
                if (cachedTable) {
                    this.logger.debug('Table analysis returned from cache', {
                        operation: 'analyze-table-cached',
                        tableName,
                        cacheKey,
                        cacheHit: true
                    });
                    
                    // Record cache hit
                    if (this.cacheStatsCollector) {
                        this.cacheStatsCollector.recordAccess(
                            cacheKey, 
                            true, 
                            this.estimateObjectSize(cachedTable),
                            Date.now() - startTime
                        );
                    }
                    
                    return cachedTable;
                }
            } catch (error) {
                this.logger.warn('Cache retrieval failed, falling back to direct analysis', {
                    operation: 'analyze-table-cache-fallback',
                    tableName,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        } else {
            // Fallback to internal cache
            if (this.tableCache.has(cacheKey) && this.tableCache.get(cacheKey)!.expiresAt > Date.now()) {
                const cached = this.tableCache.get(cacheKey)!;
                this.logger.debug('Table analysis returned from internal cache', {
                    operation: 'analyze-table-internal-cached',
                    tableName,
                    cacheKey
                });
                return cached.value;
            }
        }
        
        this.logger.info('Starting table analysis with real JDBC metadata', {
            operation: 'analyze-table',
            tableName,
            enableDeepAnalysis: config.enableDeepAnalysis,
            enableStatistics: config.enableStatistics,
            cacheKey
        });

        let connection: JDBCConnection | undefined;

        try {
            connection = await this.getConnection();
            const tableInfo = await this.analyzeTableInternal(connection, tableName, config);
            
            // Store in cache with appropriate TTL
            const cacheTTL = this.getTableCacheTTL(config);
            const tableSize = this.estimateObjectSize(tableInfo);
            
            if (this.cacheManager) {
                try {
                    await this.cacheManager.set(cacheKey, tableInfo, { ttl: cacheTTL });
                    this.logger.debug('Table analysis result cached', {
                        operation: 'analyze-table-cache-store',
                        tableName,
                        cacheKey,
                        ttl: cacheTTL,
                        sizeBytes: tableSize
                    });
                    
                    // Record cache miss
                    if (this.cacheStatsCollector) {
                        this.cacheStatsCollector.recordAccess(
                            cacheKey, 
                            false, 
                            tableSize,
                            Date.now() - startTime
                        );
                    }
                } catch (error) {
                    this.logger.warn('Failed to cache table analysis result', {
                        operation: 'analyze-table-cache-store-error',
                        tableName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            } else {
                // Fallback to internal cache
                this.tableCache.set(cacheKey, {value: tableInfo, expiresAt: Date.now() + cacheTTL});
            }
            
            this.logger.info('Table analysis completed successfully', {
                operation: 'analyze-table-complete',
                tableName,
                columns: tableInfo.columns.length,
                indexes: tableInfo.indexes.length,
                constraints: tableInfo.constraints.length,
                rowCount: tableInfo.statistics.rowCount,
                healthScore: tableInfo.statistics.healthScore,
                cached: false,
                cacheKey,
                sizeBytes: tableSize
            });

            return tableInfo;

        } catch (error) {
            this.logger.error('Table analysis failed', {
                operation: 'analyze-table-error',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            
            // Record cache miss with error
            if (this.cacheStatsCollector) {
                this.cacheStatsCollector.recordAccess(
                    cacheKey, 
                    false, 
                    0,
                    Date.now() - startTime
                );
            }
            
            throw error;
        } finally {
            if (connection) {
                await this.releaseConnection(connection);
            }
        }
    }

    /**
     * Get basic optimization recommendations for the schema
     * 
     * Analyzes the schema structure and provides basic actionable
     * optimization recommendations focused on common performance issues.
     * 
     * @async
     * @public
     * @param {string[]} [tableNames] - Specific tables to analyze (optional, defaults to all tables)
     * @returns {Promise<OptimizationRecommendation[]>} Array of optimization recommendations
     * 
     * @throws {ModuleNotInitializedError} If the analyzer is not initialized
     * 
     * @example
     * ```typescript
     * // Get recommendations for all tables
     * const recommendations = await schemaAnalyzer.getOptimizationRecommendations();
     * console.log(`Found ${recommendations.length} optimization opportunities`);
     * 
     * recommendations.forEach(rec => {
     *   console.log(`${rec.priority}: ${rec.title}`);
     *   console.log(`  Description: ${rec.description}`);
     *   console.log(`  Expected Benefit: ${rec.expectedBenefit}`);
     *   console.log(`  Implementation Effort: ${rec.effort}`);
     * });
     * ```
     * 
     * @see {@link OptimizationRecommendation} For recommendation structure
     */
    public async getOptimizationRecommendations(tableNames?: string[]): Promise<OptimizationRecommendation[]> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('SchemaAnalyzer', 'get optimization recommendations', {
                operation: 'get-recommendations'
            });
        }

        this.logger.info('Generating optimization recommendations based on schema analysis', {
            operation: 'get-recommendations',
            specificTables: tableNames?.length || 0
        });

        let connection: JDBCConnection | undefined;

        try {
            connection = await this.getConnection();
            const recommendations: OptimizationRecommendation[] = [];

            // Get tables to analyze
            const tables = tableNames || await this.getAllTables(connection, this.config!);

            // Analyze each table for optimization opportunities
            for (const tableName of tables) {
                try {
                    const tableInfo = await this.analyzeTableInternal(connection, tableName, this.config!);
                    const tableRecommendations = this.generateTableRecommendations(tableInfo);
                    recommendations.push(...tableRecommendations);
                } catch (error) {
                    this.logger.warn('Failed to generate recommendations for table', {
                        operation: 'get-recommendations',
                        tableName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Sort recommendations by priority and performance impact
            const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            recommendations.sort((a, b) => {
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return b.performanceImpact - a.performanceImpact;
            });

            this.logger.info('Optimization recommendations generated', {
                operation: 'get-recommendations-complete',
                recommendationCount: recommendations.length,
                criticalCount: recommendations.filter(r => r.priority === 'CRITICAL').length,
                highCount: recommendations.filter(r => r.priority === 'HIGH').length
            });

            return recommendations;

        } catch (error) {
            this.logger.error('Failed to generate optimization recommendations', {
                operation: 'get-recommendations-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        } finally {
            if (connection) {
                await this.releaseConnection(connection);
            }
        }
    }

    /**
     * Get current configuration
     * 
     * @public
     * @returns {SchemaAnalysisConfig | undefined} Current configuration
     */
    public getConfiguration(): SchemaAnalysisConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Get ConnectionManager reference (for integration testing)
     * 
     * @public
     * @returns {ConnectionManager | undefined} ConnectionManager instance
     */
    public getConnectionManager(): ConnectionManager | undefined {
        return this.connectionManager;
    }

    /**
     * Get last analysis timestamp
     * 
     * @public
     * @returns {Date | undefined} Last analysis timestamp
     */
    public getLastAnalysisTime(): Date | undefined {
        return this.lastAnalysisTime;
    }

    /**
     * Get cache statistics
     * 
     * @public
     * @returns {object} Cache statistics
     */
    public getCacheStats(): {
        schemaCache: { size: number; keys: string[] };
        tableCache: { size: number; keys: string[] };
        lastAnalysisTime?: Date;
    } {
        return {
            schemaCache: {
                size: this.schemaCache.size,
                keys: Array.from(this.schemaCache.keys())
            },
            tableCache: {
                size: this.tableCache.size,
                keys: Array.from(this.tableCache.keys())
            },
            lastAnalysisTime: this.lastAnalysisTime
        };
    }

    /**
     * Destroy the schema analyzer and cleanup resources
     * 
     * @async
     * @public
     * @returns {Promise<void>} Promise that resolves when destruction is complete
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying SchemaAnalyzer', {
            operation: 'destroy'
        });
        
        this.destroyed = true;
        this._initialized = false;

        // Clear caches
        await this.clearAllCaches();

        // Clear references
        this.connectionManager = undefined;
        this.cacheManager = undefined;
        this.cacheStatsCollector = undefined;
        this.manager = undefined;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);
        
        this.logger.info('SchemaAnalyzer destroyed successfully', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }

    // Event emitter interface implementation
    /** Register a listener for every occurrence of the specified event. */
    public on(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /** Register a listener that is removed after its first event. */
    public once(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /** Remove a previously registered listener for the specified event. */
    public off(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /** Notify listeners registered for the specified event. */
    public emit(event: ModuleEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /** Remove all listeners, or only listeners for the supplied event. */
    public removeAllListeners(event?: ModuleEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /** Return the number of listeners registered for the specified event. */
    public listenerCount(event: ModuleEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /** Return the event names with registered listeners. */
    public eventNames(): ModuleEvent[] {
        return this.eventEmitter.eventNames();
    }

    // =============================================================================
    // PRIVATE UTILITY METHODS
    // =============================================================================

    /**
     * Get JDBC type code from SQL type name
     * 
     * @private
     * @param {string} sqlType - SQL type name
     * @returns {number} JDBC type code
     */
    private getJDBCTypeCode(sqlType: string): number {
        const typeMap: {[key: string]: number} = {
            'INTEGER': 4,
            'BIGINT': -5,
            'DECIMAL': 3,
            'DOUBLE': 8,
            'FLOAT': 6,
            'REAL': 7,
            'VARCHAR': 12,
            'CHAR': 1,
            'CLOB': 2005,
            'BLOB': 2004,
            'DATE': 91,
            'TIME': 92,
            'TIMESTAMP': 93,
            'BOOLEAN': 16,
            'BINARY': -2,
            'VARBINARY': -3
        };

        return typeMap[sqlType.toUpperCase()] || 12; // Default to VARCHAR
    }

    /**
     * Check if data type is numeric
     * 
     * @private
     * @param {string} dataType - Data type
     * @returns {boolean} True if numeric
     */
    private isNumericType(dataType: string): boolean {
        const numericTypes = ['INTEGER', 'BIGINT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'REAL'];
        return numericTypes.includes(dataType.toUpperCase());
    }

    /**
     * Calculate data quality score
     * 
     * @private
     * @param {number} totalRows - Total number of rows
     * @param {number} nonNullCount - Non-null values
     * @param {number} uniqueCount - Unique values
     * @param {string} dataType - Column data type
     * @returns {number} Quality score (0-100)
     */
    private calculateDataQualityScore(
        totalRows: number, 
        nonNullCount: number, 
        uniqueCount: number, 
        dataType: string
    ): number {
        if (totalRows === 0) return 0;

        let score = 0;

        // Completeness (40% of score)
        const completeness = nonNullCount / totalRows;
        score += completeness * 40;

        // Uniqueness (30% of score) - higher uniqueness generally better
        const uniqueness = nonNullCount > 0 ? uniqueCount / nonNullCount : 0;
        score += Math.min(uniqueness, 1) * 30;

        // Type appropriateness (30% of score)
        // Basic heuristics - can be enhanced
        if (this.isNumericType(dataType)) {
            score += 30; // Numeric types are generally well-defined
        } else if (dataType.toUpperCase().includes('VARCHAR')) {
            score += 25; // Text types are flexible but less constrained
        } else {
            score += 20; // Other types
        }

        return Math.round(Math.min(score, 100));
    }

    /**
     * Estimate row size in bytes
     * 
     * @private
     * @param {ColumnInfo[]} columns - Table columns
     * @returns {number} Estimated row size in bytes
     */
    private estimateRowSize(columns: ColumnInfo[]): number {
        let estimatedSize = 0;

        for (const column of columns) {
            switch (column.dataType.toUpperCase()) {
                case 'INTEGER':
                    estimatedSize += 4;
                    break;
                case 'BIGINT':
                    estimatedSize += 8;
                    break;
                case 'DECIMAL':
                case 'DOUBLE':
                    estimatedSize += 8;
                    break;
                case 'FLOAT':
                case 'REAL':
                    estimatedSize += 4;
                    break;
                case 'VARCHAR':
                    estimatedSize += Math.min(column.maxLength || 50, 255); // Estimate
                    break;
                case 'CHAR':
                    estimatedSize += column.maxLength || 1;
                    break;
                case 'DATE':
                    estimatedSize += 4;
                    break;
                case 'TIME':
                    estimatedSize += 4;
                    break;
                case 'TIMESTAMP':
                    estimatedSize += 8;
                    break;
                case 'BOOLEAN':
                    estimatedSize += 1;
                    break;
                default:
                    estimatedSize += 20; // Default estimate
            }
        }

        return Math.max(estimatedSize, 10); // Minimum row size
    }

    /**
     * Calculate table data quality score
     * 
     * @private
     * @param {ColumnInfo[]} columns - Table columns
     * @returns {number} Data quality score (0-100)
     */
    private calculateTableDataQuality(columns: ColumnInfo[]): number {
        if (columns.length === 0) return 0;

        let totalScore = 0;
        let scoredColumns = 0;

        for (const column of columns) {
            if (column.statistics) {
                totalScore += column.statistics.qualityScore;
                scoredColumns++;
            }
        }

        return scoredColumns > 0 ? Math.round(totalScore / scoredColumns) : 75; // Default decent score
    }

    /**
     * Calculate table health score
     * 
     * @private
     * @param {number} rowCount - Number of rows
     * @param {ColumnInfo[]} columns - Table columns
     * @param {number} qualityScore - Data quality score
     * @returns {number} Health score (0-100)
     */
    private calculateTableHealth(
        rowCount: number, 
        columns: ColumnInfo[], 
        qualityScore: number
    ): number {
        let healthScore = 0;

        // Data quality contributes 50%
        healthScore += qualityScore * 0.5;

        // Structure quality contributes 30%
        let structureScore = 0;
        
        // Primary key presence
        const hasPrimaryKey = columns.some(c => c.isPrimaryKey);
        if (hasPrimaryKey) structureScore += 30;

        // Reasonable column count
        if (columns.length >= 3 && columns.length <= 50) {
            structureScore += 20;
        } else if (columns.length > 0) {
            structureScore += 10;
        }

        healthScore += structureScore * 0.3;

        // Data presence contributes 20%
        let dataScore = 0;
        if (rowCount > 0) {
            dataScore = Math.min(rowCount / 1000, 1) * 100; // Score based on data presence
        }
        healthScore += dataScore * 0.2;

        return Math.round(Math.min(healthScore, 100));
    }

    /**
     * Convert JDBC rule code to string
     * 
     * @private
     * @param {any} ruleCode - JDBC rule code
     * @returns {string} Rule as string
     */
    private convertRuleCode(ruleCode: any): 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SET_DEFAULT' | 'NO_ACTION' {
        const code = parseInt(String(ruleCode));
        switch (code) {
            case 0: return 'CASCADE';
            case 1: return 'RESTRICT';
            case 2: return 'SET_NULL';
            case 4: return 'SET_DEFAULT';
            default: return 'NO_ACTION';
        }
    }

    /**
     * Extract primary key information from constraints
     * 
     * @private
     * @param {ConstraintInfo[]} constraints - Table constraints
     * @returns {object | undefined} Primary key information
     */
    private extractPrimaryKey(constraints: ConstraintInfo[]): {name: string, columns: string[]} | undefined {
        const pkConstraint = constraints.find(c => c.type === 'PRIMARY_KEY');
        if (pkConstraint) {
            return {
                name: pkConstraint.name,
                columns: pkConstraint.columns
            };
        }
        return undefined;
    }

    /**
     * Calculate schema-level statistics
     * 
     * @private
     * @param {TableInfo[]} tables - Analyzed tables
     * @returns {SchemaStatistics} Schema statistics
     */
    private calculateSchemaStatistics(tables: TableInfo[]): SchemaStatistics {
        let totalColumns = 0;
        let totalIndexes = 0;
        let totalConstraints = 0;
        let totalSizeBytes = 0;
        let totalRowCount = 0;

        for (const table of tables) {
            totalColumns += table.columns.length;
            totalIndexes += table.indexes.length;
            totalConstraints += table.constraints.length;
            totalSizeBytes += table.statistics.sizeBytes;
            totalRowCount += table.statistics.rowCount;
        }

        // Calculate complexity score based on schema structure
        const complexityScore = this.calculateComplexityScore(tables.length, totalColumns, totalIndexes);

        return {
            tableCount: tables.length,
            columnCount: totalColumns,
            indexCount: totalIndexes,
            constraintCount: totalConstraints,
            totalSizeBytes,
            totalRowCount,
            complexityScore
        };
    }

    /**
     * Assess overall schema health
     * 
     * @private
     * @param {TableInfo[]} tables - Analyzed tables
     * @param {SchemaAnalysisConfig} config - Analysis configuration
     * @returns {SchemaHealth} Schema health assessment
     */
    private assessSchemaHealth(tables: TableInfo[], config: SchemaAnalysisConfig): SchemaHealth {
        const issues: SchemaIssue[] = [];
        const recommendations: OptimizationRecommendation[] = [];

        let totalPerformanceScore = 0;
        let totalDataQualityScore = 0;
        let totalDesignScore = 0;
        let totalSecurityScore = 0;
        let scoredTables = 0;

        // Analyze each table for health issues
        for (const table of tables) {
            totalDataQualityScore += table.statistics.qualityScore;
            totalPerformanceScore += this.assessTablePerformance(table);
            totalDesignScore += this.assessTableDesign(table);
            totalSecurityScore += this.assessTableSecurity(table);
            scoredTables++;

            // Check for specific issues
            this.checkTableIssues(table, issues);
        }

        // Calculate averages
        const performanceScore = scoredTables > 0 ? Math.round(totalPerformanceScore / scoredTables) : 75;
        const dataQualityScore = scoredTables > 0 ? Math.round(totalDataQualityScore / scoredTables) : 75;
        const designScore = scoredTables > 0 ? Math.round(totalDesignScore / scoredTables) : 75;
        const securityScore = scoredTables > 0 ? Math.round(totalSecurityScore / scoredTables) : 75;
        

        // Overall score
        const overallScore = Math.round(
            (performanceScore * 0.25) + 
            (dataQualityScore * 0.25) + 
            (designScore * 0.25) + 
            (securityScore * 0.25)
        );

        return {
            overallScore,
            performanceScore,
            dataQualityScore,
            designScore,
            securityScore,
            issues,
            recommendations: [] // Basic recommendations will be generated separately
        };
    }

    /**
     * Generate basic optimization recommendations for a table
     * 
     * @private
     * @param {TableInfo} table - Table information
     * @returns {OptimizationRecommendation[]} Array of recommendations
     */
    private generateTableRecommendations(table: TableInfo): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];

        // Check for missing primary key
        if (!table.primaryKey) {
            recommendations.push({
                type: 'CONSTRAINT',
                priority: 'HIGH',
                title: `Add primary key to table ${table.name}`,
                description: `Table ${table.name} does not have a primary key, which can impact performance and data integrity.`,
                expectedBenefit: 'Improved query performance and data integrity',
                effort: 'MEDIUM',
                implementation: [`ALTER TABLE ${table.name} ADD CONSTRAINT PK_${table.name} PRIMARY KEY (id);`],
                performanceImpact: 40
            });
        }

        // Check for large tables without indexes
        if (table.statistics.rowCount > 10000 && table.indexes.length <= 1) {
            recommendations.push({
                type: 'INDEX',
                priority: 'MEDIUM',
                title: `Consider adding indexes to large table ${table.name}`,
                description: `Table ${table.name} has ${table.statistics.rowCount} rows but only ${table.indexes.length} index(es).`,
                expectedBenefit: 'Improved query performance for large table scans',
                effort: 'LOW',
                implementation: [`-- Analyze query patterns and add appropriate indexes to ${table.name}`],
                performanceImpact: 60
            });
        }

        // Check for poor data quality
        if (table.statistics.qualityScore < 70) {
            recommendations.push({
                type: 'CONSTRAINT',
                priority: 'MEDIUM',
                title: `Improve data quality in table ${table.name}`,
                description: `Table ${table.name} has a data quality score of ${table.statistics.qualityScore}/100.`,
                expectedBenefit: 'Better data integrity and application reliability',
                effort: 'HIGH',
                implementation: [`-- Review data validation rules and add appropriate constraints to ${table.name}`],
                performanceImpact: 20
            });
        }

        // Check for foreign keys without indexes
        for (const fk of table.foreignKeys) {
            const hasIndex = table.indexes.some(idx => 
                idx.columns.some(col => fk.columns.includes(col.name))
            );
            
            if (!hasIndex) {
                recommendations.push({
                    type: 'INDEX',
                    priority: 'MEDIUM',
                    title: `Add index for foreign key ${fk.name}`,
                    description: `Foreign key ${fk.name} in table ${table.name} is not indexed, which may impact join performance.`,
                    expectedBenefit: 'Improved join and foreign key lookup performance',
                    effort: 'LOW',
                    implementation: [`CREATE INDEX IDX_${table.name}_${fk.columns.join('_')} ON ${table.name} (${fk.columns.join(', ')});`],
                    performanceImpact: 35
                });
            }
        }

        return recommendations;
    }

    /**
     * Helper methods for health assessment
     */

    /**
     * Calculate schema complexity score
     * 
     * @private
     * @param {number} tableCount - Number of tables
     * @param {number} columnCount - Total columns
     * @param {number} indexCount - Total indexes
     * @returns {number} Complexity score (0-100)
     */
    private calculateComplexityScore(tableCount: number, columnCount: number, indexCount: number): number {
        // Simple complexity calculation based on schema size
        let complexity = 0;
        
        // Table count factor (30%)
        if (tableCount <= 10) complexity += 30;
        else if (tableCount <= 50) complexity += 20;
        else complexity += 10;

        // Column density factor (40%)
        const avgColumnsPerTable = tableCount > 0 ? columnCount / tableCount : 0;
        if (avgColumnsPerTable <= 10) complexity += 40;
        else if (avgColumnsPerTable <= 20) complexity += 30;
        else complexity += 20;

        // Index factor (30%)
        const indexRatio = columnCount > 0 ? indexCount / columnCount : 0;
        if (indexRatio >= 0.1 && indexRatio <= 0.3) complexity += 30;
        else if (indexRatio < 0.1) complexity += 20;
        else complexity += 15;

        return Math.min(complexity, 100);
    }

    /**
     * Assess table performance characteristics
     * 
     * @private
     * @param {TableInfo} table - Table information
     * @returns {number} Performance score (0-100)
     */
    private assessTablePerformance(table: TableInfo): number {
        let score = 0;

        // Primary key presence (25%)
        if (table.primaryKey) score += 25;

        // Index coverage (35%)
        const indexScore = Math.min((table.indexes.length / Math.max(table.columns.length * 0.3, 1)) * 35, 35);
        score += indexScore;

        // Row count vs index ratio (25%)
        if (table.statistics.rowCount > 0) {
            const indexEfficiency = table.indexes.length / Math.max(Math.log10(table.statistics.rowCount), 1);
            score += Math.min(indexEfficiency * 5, 25);
        } else {
            score += 15; // Default for empty tables
        }

        // Data size efficiency (15%)
        if (table.statistics.averageRowSize > 0 && table.statistics.averageRowSize < 1000) {
            score += 15;
        } else if (table.statistics.averageRowSize < 5000) {
            score += 10;
        } else {
            score += 5;
        }

        return Math.min(score, 100);
    }

    /**
     * Assess table design quality
     * 
     * @private
     * @param {TableInfo} table - Table information
     * @returns {number} Design score (0-100)
     */
    private assessTableDesign(table: TableInfo): number {
        let score = 0;

        // Primary key design (30%)
        if (table.primaryKey) {
            score += 30;
            // Bonus for single-column PK
            if (table.primaryKey.columns.length === 1) score += 5;
        }

        // Column count appropriateness (25%)
        if (table.columns.length >= 3 && table.columns.length <= 30) {
            score += 25;
        } else if (table.columns.length <= 50) {
            score += 15;
        } else {
            score += 5;
        }

        // Foreign key relationships (25%)
        const totalRelationships = table.foreignKeys.length + table.referencingKeys.length;
        if (totalRelationships > 0) {
            score += Math.min(totalRelationships * 5, 25);
        }

        // Constraint coverage (20%)
        const constraintRatio = table.constraints.length / table.columns.length;
        if (constraintRatio >= 0.3) score += 20;
        else if (constraintRatio >= 0.1) score += 15;
        else score += 5;

        return Math.min(score, 100);
    }

    /**
     * Assess table security
     * 
     * @private
     * @param {TableInfo} table - Table information
     * @returns {number} Security score (0-100)
     */
    private assessTableSecurity(table: TableInfo): number {
        let score = 75; // Default decent score

        // Check for proper constraint usage
        const totalConstraints = table.constraints.length;
        if (totalConstraints > 0) {
            score += Math.min((totalConstraints / Math.max(table.columns.length, 1)) * 10, 10);
        }

        // Check for foreign key relationships (referential integrity)
        const tablesWithForeignKeys = table.foreignKeys.length + table.referencingKeys.length;
        if (tablesWithForeignKeys > 0) {
            score += Math.min((tablesWithForeignKeys / Math.max(table.columns.length, 1)) * 10, 10);
        }

        return Math.min(score, 100);
    }

    /**
     * Assess security characteristics
     * 
     * @private
     * @param {TableInfo[]} tables - All tables
     * @returns {number} Security score (0-100)
     */
    private assessSecurityScore(tables: TableInfo[]): number {
        let score = 75; // Default decent score

        // Check for proper constraint usage
        const totalConstraints = tables.reduce((sum, table) => sum + table.constraints.length, 0);
        const totalTables = tables.length;
        
        if (totalTables > 0) {
            const avgConstraintsPerTable = totalConstraints / totalTables;
            if (avgConstraintsPerTable >= 2) score += 15;
            else if (avgConstraintsPerTable >= 1) score += 10;
        }

        // Check for foreign key relationships (referential integrity)
        const tablesWithForeignKeys = tables.filter(t => t.foreignKeys.length > 0).length;
        if (tablesWithForeignKeys > 0) {
            score += Math.min((tablesWithForeignKeys / totalTables) * 10, 10);
        }

        return Math.min(score, 100);
    }

    /**
     * Check for specific table issues
     * 
     * @private
     * @param {TableInfo} table - Table information
     * @param {SchemaIssue[]} issues - Issues array to populate
     */
    private checkTableIssues(table: TableInfo, issues: SchemaIssue[]): void {
        // Check for missing primary key
        if (!table.primaryKey) {
            issues.push({
                type: 'DESIGN',
                severity: 'HIGH',
                title: 'Missing Primary Key',
                description: `Table ${table.name} does not have a primary key defined.`,
                affectedObject: table.name,
                resolution: 'Add a primary key constraint to ensure row uniqueness and improve performance.',
                impact: 'Performance degradation and potential data integrity issues'
            });
        }

        // Check for poor data quality
        if (table.statistics.qualityScore < 60) {
            issues.push({
                type: 'DATA_QUALITY',
                severity: 'MEDIUM',
                title: 'Poor Data Quality',
                description: `Table ${table.name} has a data quality score of ${table.statistics.qualityScore}/100.`,
                affectedObject: table.name,
                resolution: 'Review data validation rules and improve data entry processes.',
                impact: 'Potential application errors and unreliable reporting'
            });
        }

        // Check for very large tables without adequate indexing
        if (table.statistics.rowCount > 100000 && table.indexes.length <= 1) {
            issues.push({
                type: 'PERFORMANCE',
                severity: 'HIGH',
                title: 'Large Table Lacks Indexes',
                description: `Table ${table.name} has ${table.statistics.rowCount} rows but only ${table.indexes.length} index(es).`,
                affectedObject: table.name,
                resolution: 'Analyze query patterns and add appropriate indexes for frequently accessed columns.',
                impact: 'Slow query performance and potential application timeouts'
            });
        }
    }

    /**
     * Get basic table information
     * 
     * @private
     * @async
     * @param {JDBCConnection} connection - Database connection
     * @param {string} tableName - Table name
     * @returns {Promise<{schema: string, type: string, remarks?: string}>} Basic table info
     */
    private async getTableBasicInfo(
        connection: JDBCConnection, 
        tableName: string
    ): Promise<{schema: string, type: string, remarks?: string}> {
        try {
            // CORRECTION: Utiliser INFORMATION_SCHEMA.TABLES avec TABLE_SCHEMA comme les autres méthodes
            const sql = `
                SELECT TABLE_SCHEMA, TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'PUBLIC'
            `;

            const result = await connection.execute(sql, [tableName]);
            
            if (result.rows.length === 0) {
                throw new Error(`Table ${tableName} not found`);
            }

            const row = result.rows[0];
            return {
                schema: row[0] || 'PUBLIC',
                type: row[1] || 'TABLE',
                remarks: undefined // HSQLDB peut ne pas avoir REMARKS, on l'ignore
            };
        } catch (error) {
            this.logger.error('Failed to get table basic info', {
                operation: 'get-table-basic-info',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Sanitize value for report to prevent huge objects from bloating the JSON
     * 
     * @private
     * @param {any} value - Value to sanitize
     * @returns {any} Sanitized value
     */
    private sanitizeValueForReport(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }

        // Convert to string to check length
        const stringValue = String(value);

        // CORRECTION CRITIQUE: Limiter les très longues chaînes et objets complexes
        if (stringValue.length > 200) {
            // Si c'est un objet ou un tableau très volumineux, le tronquer drastiquement
            if (typeof value === 'object') {
                return `[LARGE_OBJECT:${stringValue.length}_chars]`;
            } else {
                // Si c'est une chaîne très longue, la tronquer
                return stringValue.substring(0, 200) + '...';
            }
        }

        // Si c'est un objet pas trop grand, le convertir en string concis
        if (typeof value === 'object' && value !== null) {
            try {
                const jsonString = JSON.stringify(value);
                if (jsonString.length > 200) {
                    return `[OBJECT:${jsonString.length}_chars]`;
                }
                return value; // Garder l'objet s'il est petit
            } catch (error) {
                return `[UNPARSEABLE_OBJECT]`;
            }
        }

        return value; // Valeur normale, la garder telle quelle
    }
}