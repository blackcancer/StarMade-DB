/**
 * Relationship Analyzer Module
 * 
 * Advanced relationship discovery and analysis system for HSQLDB databases.
 * Focuses on detecting, validating, and analyzing relationships between tables.
 * 
 * **Responsibilities:**
 * - Foreign key relationship discovery and validation
 * - Implicit relationship detection through data patterns
 * - Cross-table dependency analysis
 * - Relationship performance optimization suggestions
 * - Data consistency validation across relationships
 * 
 * **Integration:**
 * - Uses SchemaAnalyzer for base table/column metadata
 * - Provides relationship data to DatabaseReporter
 * - Integrates with QueryValidator for relationship-aware validation
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
 * const relationshipAnalyzer = new RelationshipAnalyzer();
 * await relationshipAnalyzer.initialize(manager);
 * 
 * // Discover all relationships
 * const relationships = await relationshipAnalyzer.discoverRelationships();
 * console.log(`Found ${relationships.length} relationships`);
 * 
 * // Analyze specific table relationships
 * const playerRelations = await relationshipAnalyzer.analyzeTableRelationships('PLAYERS');
 * 
 * // Validate relationship integrity
 * const validation = await relationshipAnalyzer.validateRelationshipIntegrity();
 * if (!validation.isValid) {
 *     console.warn('Found relationship integrity issues:', validation.issues);
 * }
 * ```
 */

import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import { ModuleEvent, type ModuleEventEmitter, type ModuleEventListener } from '../../events.js';
import { HSQLDBError, ModuleError, ErrorFactory } from '../../errors.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import type { ConnectionManager } from '../connection/ConnectionManager.js';
import type { SchemaAnalyzer, TableInfo, ColumnInfo } from './SchemaAnalyzer.js';

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Configuration for relationship discovery
 */
export interface RelationshipDiscoveryConfig {
    /** Enable implicit relationship detection */
    enableImplicitDetection?: boolean;
    /** Enable naming pattern analysis */
    enableNamingPatterns?: boolean;
    /** Enable data sampling for relationship detection */
    enableDataSampling?: boolean;
    /** Sample size for data analysis */
    sampleSize?: number;
    /** Confidence threshold for implicit relationships */
    confidenceThreshold?: number;
    /** Maximum depth for dependency analysis */
    maxDependencyDepth?: number;
    /** Enable performance analysis */
    enablePerformanceAnalysis?: boolean;
}

/**
 * Default relationship discovery configuration
 */
export const DEFAULT_RELATIONSHIP_CONFIG: Required<RelationshipDiscoveryConfig> = {
    enableImplicitDetection: true,
    enableNamingPatterns: true,
    enableDataSampling: false, // Disabled by default for performance
    sampleSize: 1000,
    confidenceThreshold: 0.8,
    maxDependencyDepth: 5,
    enablePerformanceAnalysis: true
};

// =============================================================================
// RELATIONSHIP DATA STRUCTURES
// =============================================================================

/**
 * Relationship types
 */
export enum RelationshipType {
    ONE_TO_ONE = 'one-to-one',
    ONE_TO_MANY = 'one-to-many',
    MANY_TO_ONE = 'many-to-one',
    MANY_TO_MANY = 'many-to-many'
}

/**
 * Relationship discovery methods
 */
export enum DiscoveryMethod {
    FOREIGN_KEY = 'foreign-key',
    NAMING_PATTERN = 'naming-pattern',
    DATA_ANALYSIS = 'data-analysis',
    STATISTICAL = 'statistical'
}

/**
 * Relationship pattern information
 */
export interface RelationshipPattern {
    /** Pattern name */
    name: string;
    /** Pattern description */
    description: string;
    /** Source table */
    sourceTable: string;
    /** Source columns */
    sourceColumns: string[];
    /** Target table */
    targetTable: string;
    /** Target columns */
    targetColumns: string[];
    /** Relationship type */
    type: RelationshipType;
    /** Discovery method used */
    discoveryMethod: DiscoveryMethod;
    /** Confidence score (0-1) */
    confidence: number;
    /** Whether relationship is enforced by database */
    isEnforced: boolean;
    /** Foreign key constraint name if applicable */
    constraintName?: string;
    /** Performance metrics */
    performance?: RelationshipPerformance;
    /** Validation results */
    validation?: RelationshipValidation;
}

/**
 * Relationship performance metrics
 */
export interface RelationshipPerformance {
    /** Average join time in milliseconds */
    averageJoinTime?: number;
    /** Join selectivity ratio */
    selectivity?: number;
    /** Index coverage for join */
    indexCoverage: boolean;
    /** Recommended optimizations */
    optimizations: string[];
    /** Query frequency for this relationship */
    queryFrequency?: number;
}

/**
 * Relationship validation results
 */
export interface RelationshipValidation {
    /** Whether relationship is valid */
    isValid: boolean;
    /** Data integrity issues found */
    integrityIssues: IntegrityIssue[];
    /** Orphaned records count */
    orphanedRecords?: number;
    /** Duplicate relationships found */
    duplicateRelationships?: RelationshipPattern[];
    /** Validation timestamp */
    validatedAt: Date;
}

/**
 * Data integrity issue
 */
export interface IntegrityIssue {
    /** Issue type */
    type: 'orphaned' | 'duplicate' | 'type_mismatch' | 'constraint_violation';
    /** Issue severity */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Issue description */
    description: string;
    /** Affected table */
    table: string;
    /** Affected columns */
    columns: string[];
    /** Number of affected records */
    affectedRecords: number;
    /** Suggested fix */
    suggestedFix?: string;
}

/**
 * Cross-table analysis results
 */
export interface CrossTableAnalysis {
    /** Tables analyzed */
    tables: string[];
    /** Relationships found */
    relationships: RelationshipPattern[];
    /** Dependency graph */
    dependencies: TableDependency[];
    /** Circular dependencies detected */
    circularDependencies: string[][];
    /** Analysis metrics */
    metrics: AnalysisMetrics;
}

/**
 * Table dependency information
 */
export interface TableDependency {
    /** Source table */
    sourceTable: string;
    /** Target table */
    targetTable: string;
    /** Dependency type */
    dependencyType: 'direct' | 'indirect' | 'circular';
    /** Dependency path */
    path: string[];
    /** Dependency strength (0-1) */
    strength: number;
}

/**
 * Analysis metrics
 */
export interface AnalysisMetrics {
    /** Total relationships analyzed */
    totalRelationships: number;
    /** Explicit relationships (FK constraints) */
    explicitRelationships: number;
    /** Implicit relationships discovered */
    implicitRelationships: number;
    /** Average confidence score */
    averageConfidence: number;
    /** Analysis duration in milliseconds */
    analysisDuration: number;
    /** Tables with no relationships */
    isolatedTables: string[];
}

// =============================================================================
// MAIN RELATIONSHIP ANALYZER CLASS
// =============================================================================

/**
 * RelationshipAnalyzer Module
 * 
 * Provides advanced relationship discovery and analysis capabilities
 * for HSQLDB databases with focus on data integrity and performance.
 */
export class RelationshipAnalyzer implements BaseModule {
    public readonly name = 'relationship-analyzer';
    public readonly version = '1.0.0';

    private manager!: HSQLManager;
    private connectionManager!: ConnectionManager;
    private schemaAnalyzer!: SchemaAnalyzer;
    private logger!: ModuleLogger;
    private config: Required<RelationshipDiscoveryConfig>;
    private initialized = false;
    private destroyed = false;
    private relationshipCache: Map<string, RelationshipPattern[]> = new Map();

    constructor(config: RelationshipDiscoveryConfig = {}) {
        this.config = { ...DEFAULT_RELATIONSHIP_CONFIG, ...config };
    }

    public get isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Initialize the RelationshipAnalyzer module
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this.initialized) {
            throw new ModuleError(
                'RelationshipAnalyzer',
                'initialize',
                'RelationshipAnalyzer already initialized'
            );
        }

        this.manager = manager;
        this.logger = createModuleLogger(this.name);

        this.logger.info('Initializing RelationshipAnalyzer', {
            operation: 'initialize',
            version: this.version,
            config: this.config
        });

        try {
            // Get required dependencies
            const connectionManager = manager.getModule<ConnectionManager>('connection-manager');
            if (!connectionManager) {
                throw new ModuleError(
                    'RelationshipAnalyzer',
                    'initialize',
                    'ConnectionManager module required for RelationshipAnalyzer'
                );
            }
            this.connectionManager = connectionManager;

            const schemaAnalyzer = manager.getModule<SchemaAnalyzer>('schema-analyzer');
            if (!schemaAnalyzer) {
                throw new ModuleError(
                    'RelationshipAnalyzer',
                    'initialize',
                    'SchemaAnalyzer module required for RelationshipAnalyzer'
                );
            }
            this.schemaAnalyzer = schemaAnalyzer;

            this.initialized = true;

            this.logger.info('RelationshipAnalyzer initialized successfully', {
                operation: 'initialize-complete'
            });

        } catch (error) {
            this.logger.error('Failed to initialize RelationshipAnalyzer', {
                operation: 'initialize-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Discover all relationships in the database
     */
    public async discoverRelationships(): Promise<RelationshipPattern[]> {
        this.ensureInitialized();

        const startTime = Date.now();
        this.logger.info('Starting relationship discovery', {
            operation: 'discover-relationships',
            config: this.config
        });

        try {
            const relationships: RelationshipPattern[] = [];

            // Get database schema
            const schema = await this.schemaAnalyzer.analyzeSchema();

            // 1. Discover explicit relationships (Foreign Keys)
            const explicitRelationships = await this.discoverExplicitRelationships(schema.tables);
            relationships.push(...explicitRelationships);

            // 2. Discover implicit relationships if enabled
            if (this.config.enableImplicitDetection) {
                const implicitRelationships = await this.discoverImplicitRelationships(schema.tables);
                relationships.push(...implicitRelationships);
            }

            // 3. Validate and analyze relationships
            const validatedRelationships = await this.validateRelationships(relationships);

            // 4. Analyze performance if enabled
            if (this.config.enablePerformanceAnalysis) {
                await this.analyzeRelationshipPerformance(validatedRelationships);
            }

            // Cache results
            this.relationshipCache.set('all', validatedRelationships);

            const duration = Date.now() - startTime;
            this.logger.info('Relationship discovery completed', {
                operation: 'discover-relationships-complete',
                totalRelationships: validatedRelationships.length,
                explicitCount: explicitRelationships.length,
                implicitCount: validatedRelationships.length - explicitRelationships.length,
                duration
            });

            return validatedRelationships;

        } catch (error) {
            this.logger.error('Relationship discovery failed', {
                operation: 'discover-relationships-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new ModuleError(
                'RelationshipAnalyzer',
                'discoverRelationships',
                `Relationship discovery failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Analyze relationships for a specific table
     */
    public async analyzeTableRelationships(tableName: string): Promise<RelationshipPattern[]> {
        this.ensureInitialized();

        this.logger.debug('Analyzing table relationships', {
            operation: 'analyze-table-relationships',
            tableName
        });

        try {
            // Check cache first
            const cacheKey = `table:${tableName}`;
            if (this.relationshipCache.has(cacheKey)) {
                return this.relationshipCache.get(cacheKey)!;
            }

            // Get all relationships and filter for table
            const allRelationships = await this.discoverRelationships();
            const tableRelationships = allRelationships.filter(rel =>
                rel.sourceTable === tableName || rel.targetTable === tableName
            );

            // Cache results
            this.relationshipCache.set(cacheKey, tableRelationships);

            this.logger.info('Table relationship analysis completed', {
                operation: 'analyze-table-relationships-complete',
                tableName,
                relationshipCount: tableRelationships.length
            });

            return tableRelationships;

        } catch (error) {
            this.logger.error('Table relationship analysis failed', {
                operation: 'analyze-table-relationships-error',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Validate relationship integrity across the database
     */
    public async validateRelationshipIntegrity(): Promise<RelationshipValidation> {
        this.ensureInitialized();

        this.logger.info('Starting relationship integrity validation', {
            operation: 'validate-integrity'
        });

        try {
            const relationships = await this.discoverRelationships();
            const issues: IntegrityIssue[] = [];
            let orphanedRecords = 0;

            // Validate each relationship
            for (const relationship of relationships) {
                const relationshipIssues = await this.validateSingleRelationship(relationship);
                issues.push(...relationshipIssues.integrityIssues);
                orphanedRecords += relationshipIssues.orphanedRecords || 0;
            }

            // Check for duplicate relationships
            const duplicateRelationships = this.findDuplicateRelationships(relationships);

            const validation: RelationshipValidation = {
                isValid: issues.length === 0,
                integrityIssues: issues,
                orphanedRecords,
                duplicateRelationships: duplicateRelationships.length > 0 ? duplicateRelationships : undefined,
                validatedAt: new Date()
            };

            this.logger.info('Relationship integrity validation completed', {
                operation: 'validate-integrity-complete',
                isValid: validation.isValid,
                issueCount: issues.length,
                orphanedRecords,
                duplicateCount: duplicateRelationships.length
            });

            return validation;

        } catch (error) {
            this.logger.error('Relationship integrity validation failed', {
                operation: 'validate-integrity-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Perform cross-table dependency analysis
     */
    public async performCrossTableAnalysis(tables?: string[]): Promise<CrossTableAnalysis> {
        this.ensureInitialized();

        this.logger.info('Starting cross-table analysis', {
            operation: 'cross-table-analysis',
            tableCount: tables?.length || 'all'
        });

        const startTime = Date.now();

        try {
            // Get schema if tables not specified
            if (!tables) {
                const schema = await this.schemaAnalyzer.analyzeSchema();
                tables = schema.tables.map(t => t.name);
            }

            // Discover relationships
            const relationships = await this.discoverRelationships();
            const relevantRelationships = relationships.filter(rel =>
                tables!.includes(rel.sourceTable) || tables!.includes(rel.targetTable)
            );

            // Build dependency graph
            const dependencies = this.buildDependencyGraph(relevantRelationships, tables);

            // Detect circular dependencies
            const circularDependencies = this.detectCircularDependencies(dependencies);

            // Calculate metrics
            const explicitCount = relevantRelationships.filter(r => r.discoveryMethod === DiscoveryMethod.FOREIGN_KEY).length;
            const implicitCount = relevantRelationships.length - explicitCount;
            const averageConfidence = relevantRelationships.reduce((sum, r) => sum + r.confidence, 0) / relevantRelationships.length || 0;
            const isolatedTables = tables!.filter(table =>
                !relevantRelationships.some(r => r.sourceTable === table || r.targetTable === table)
            );

            const analysis: CrossTableAnalysis = {
                tables: tables!,
                relationships: relevantRelationships,
                dependencies,
                circularDependencies,
                metrics: {
                    totalRelationships: relevantRelationships.length,
                    explicitRelationships: explicitCount,
                    implicitRelationships: implicitCount,
                    averageConfidence,
                    analysisDuration: Date.now() - startTime,
                    isolatedTables
                }
            };

            this.logger.info('Cross-table analysis completed', {
                operation: 'cross-table-analysis-complete',
                tableCount: tables!.length,
                relationshipCount: relevantRelationships.length,
                dependencyCount: dependencies.length,
                circularDependencyCount: circularDependencies.length,
                duration: analysis.metrics.analysisDuration
            });

            return analysis;

        } catch (error) {
            this.logger.error('Cross-table analysis failed', {
                operation: 'cross-table-analysis-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================

    /**
     * Discover explicit relationships through foreign key constraints
     */
    private async discoverExplicitRelationships(tables: TableInfo[]): Promise<RelationshipPattern[]> {
        this.logger.debug('Discovering explicit relationships', {
            operation: 'discover-explicit',
            tableCount: tables.length
        });

        const relationships: RelationshipPattern[] = [];
        const connection = await this.connectionManager.getConnection();

        try {
            // Get foreign key metadata for each table
            for (const table of tables) {
                const foreignKeys = await this.getForeignKeyMetadata(connection, table.name);

                for (const fk of foreignKeys) {
                    const relationship: RelationshipPattern = {
                        name: `${table.name}_${fk.targetTable}_FK`,
                        description: `Foreign key relationship from ${table.name} to ${fk.targetTable}`,
                        sourceTable: table.name,
                        sourceColumns: fk.sourceColumns,
                        targetTable: fk.targetTable,
                        targetColumns: fk.targetColumns,
                        type: RelationshipType.MANY_TO_ONE, // Default for FK relationships
                        discoveryMethod: DiscoveryMethod.FOREIGN_KEY,
                        confidence: 1.0, // FK relationships are certain
                        isEnforced: true,
                        constraintName: fk.constraintName
                    };

                    relationships.push(relationship);
                }
            }

            this.logger.debug('Explicit relationship discovery completed', {
                operation: 'discover-explicit-complete',
                relationshipCount: relationships.length
            });

            return relationships;

        } finally {
            await this.connectionManager.releaseConnection(connection);
        }
    }

    /**
     * Discover implicit relationships through naming patterns and data analysis
     */
    private async discoverImplicitRelationships(tables: TableInfo[]): Promise<RelationshipPattern[]> {
        this.logger.debug('Discovering implicit relationships', {
            operation: 'discover-implicit',
            tableCount: tables.length
        });

        const relationships: RelationshipPattern[] = [];

        if (this.config.enableNamingPatterns) {
            const namingRelationships = await this.discoverNamingPatternRelationships(tables);
            relationships.push(...namingRelationships);
        }

        if (this.config.enableDataSampling) {
            const dataRelationships = await this.discoverDataPatternRelationships(tables);
            relationships.push(...dataRelationships);
        }

        this.logger.debug('Implicit relationship discovery completed', {
            operation: 'discover-implicit-complete',
            relationshipCount: relationships.length
        });

        return relationships;
    }

    /**
     * Discover relationships through naming pattern analysis
     */
    private async discoverNamingPatternRelationships(tables: TableInfo[]): Promise<RelationshipPattern[]> {
        const relationships: RelationshipPattern[] = [];

        // Common naming patterns for foreign keys
        const patterns = [
            /^(.+)_id$/i,           // table_id pattern
            /^(.+)id$/i,            // tableid pattern
            /^id_(.+)$/i,           // id_table pattern
            /^fk_(.+)$/i            // fk_table pattern
        ];

        for (const table of tables) {
            for (const column of table.columns) {
                if (column.isPrimaryKey || column.isForeignKey) continue;

                for (const pattern of patterns) {
                    const match = column.name.match(pattern);
                    if (match) {
                        const potentialTable = match[1].toUpperCase();
                        const targetTable = tables.find(t =>
                            t.name.toUpperCase() === potentialTable ||
                            t.name.toUpperCase() === potentialTable + 'S' ||
                            t.name.toUpperCase() === potentialTable.slice(0, -1) // Remove trailing 'S'
                        );

                        if (targetTable) {
                            const relationship: RelationshipPattern = {
                                name: `${table.name}_${targetTable.name}_NAMING`,
                                description: `Implicit relationship based on naming pattern: ${column.name}`,
                                sourceTable: table.name,
                                sourceColumns: [column.name],
                                targetTable: targetTable.name,
                                targetColumns: ['ID'], // Assume ID column
                                type: RelationshipType.MANY_TO_ONE,
                                discoveryMethod: DiscoveryMethod.NAMING_PATTERN,
                                confidence: 0.7, // Medium confidence for naming patterns
                                isEnforced: false
                            };

                            relationships.push(relationship);
                        }
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Discover relationships through data pattern analysis
     */
    private async discoverDataPatternRelationships(tables: TableInfo[]): Promise<RelationshipPattern[]> {
        if (!this.config.enableDataSampling) {
            return [];
        }

        const relationships: RelationshipPattern[] = [];
        const connection = await this.connectionManager.getConnection();

        try {
            this.logger.debug('Starting data pattern analysis for implicit relationships', {
                operation: 'discover-data-patterns',
                tableCount: tables.length,
                sampleSize: this.config.sampleSize
            });

            // Analyser les relations implicites basées sur les valeurs des données
            for (const sourceTable of tables) {
                for (const sourceColumn of sourceTable.columns) {
                    // Ignorer les colonnes déjà identifiées comme FK ou PK
                    if (sourceColumn.isPrimaryKey || sourceColumn.isForeignKey) {
                        continue;
                    }

                    // Chercher des colonnes candidates dans d'autres tables
                    for (const targetTable of tables) {
                        if (sourceTable.name === targetTable.name) continue;

                        for (const targetColumn of targetTable.columns) {
                            // Vérifier si les types sont compatibles
                            if (sourceColumn.dataType !== targetColumn.dataType) {
                                continue;
                            }

                            try {
                                // Échantillonner les données pour analyser les correspondances
                                const matchRatio = await this.analyzeDataCorrelation(
                                    connection,
                                    sourceTable.name,
                                    sourceColumn.name,
                                    targetTable.name,
                                    targetColumn.name
                                );

                                // Si le ratio de correspondance est élevé, suggérer une relation
                                if (matchRatio >= this.config.confidenceThreshold) {
                                    const relationship: RelationshipPattern = {
                                        name: `${sourceTable.name}_${targetTable.name}_DATA`,
                                        description: `Data pattern relationship: ${matchRatio * 100}% value correlation`,
                                        sourceTable: sourceTable.name,
                                        sourceColumns: [sourceColumn.name],
                                        targetTable: targetTable.name,
                                        targetColumns: [targetColumn.name],
                                        type: RelationshipType.MANY_TO_ONE,
                                        discoveryMethod: DiscoveryMethod.DATA_ANALYSIS,
                                        confidence: matchRatio,
                                        isEnforced: false
                                    };

                                    relationships.push(relationship);

                                    this.logger.debug('Data pattern relationship discovered', {
                                        operation: 'data-pattern-found',
                                        sourceTable: sourceTable.name,
                                        sourceColumn: sourceColumn.name,
                                        targetTable: targetTable.name,
                                        targetColumn: targetColumn.name,
                                        confidence: matchRatio
                                    });
                                }
                            } catch (error) {
                                this.logger.debug('Failed to analyze data correlation', {
                                    operation: 'data-correlation-error',
                                    sourceTable: sourceTable.name,
                                    targetTable: targetTable.name,
                                    error: error instanceof Error ? error.message : String(error)
                                });
                            }
                        }
                    }
                }
            }

        } finally {
            await this.connectionManager.releaseConnection(connection);
        }

        this.logger.debug('Data pattern analysis completed', {
            operation: 'discover-data-patterns-complete',
            relationshipCount: relationships.length
        });

        return relationships;
    }

    /**
     * Analyze correlation between two columns by sampling data
     */
    private async analyzeDataCorrelation(
        connection: any,
        sourceTable: string,
        sourceColumn: string,
        targetTable: string,
        targetColumn: string
    ): Promise<number> {
        try {
            // Échantillonner les données des deux colonnes
            const sampleSize = Math.min(this.config.sampleSize, 1000);

            const sourceSampleSql = `
                SELECT DISTINCT ${sourceColumn} 
                FROM ${sourceTable} 
                WHERE ${sourceColumn} IS NOT NULL
                LIMIT ${sampleSize}
            `;

            const targetSampleSql = `
                SELECT DISTINCT ${targetColumn} 
                FROM ${targetTable} 
                WHERE ${targetColumn} IS NOT NULL
                LIMIT ${sampleSize}
            `;

            const [sourceResult, targetResult] = await Promise.all([
                connection.execute(sourceSampleSql),
                connection.execute(targetSampleSql)
            ]);

            const sourceValues = new Set(sourceResult.rows.map((row: any[]) => row[0]));
            const targetValues = new Set(targetResult.rows.map((row: any[]) => row[0]));

            if (sourceValues.size === 0 || targetValues.size === 0) {
                return 0;
            }

            // Calculer l'intersection
            let matches = 0;
            for (const value of sourceValues) {
                if (targetValues.has(value)) {
                    matches++;
                }
            }

            // Ratio de correspondance
            const matchRatio = matches / Math.min(sourceValues.size, targetValues.size);
            return matchRatio;

        } catch (error) {
            this.logger.debug('Data correlation analysis failed', {
                operation: 'analyze-data-correlation',
                sourceTable,
                sourceColumn,
                targetTable,
                targetColumn,
                error: error instanceof Error ? error.message : String(error)
            });
            return 0;
        }
    }

    /**
     * Get foreign key metadata from database
     */
    private async getForeignKeyMetadata(connection: any, tableName: string): Promise<Array<{
        constraintName: string;
        sourceColumns: string[];
        targetTable: string;
        targetColumns: string[];
    }>> {
        try {
            // CORRECTION CRITIQUE: Utiliser des requêtes HSQLDB-compatibles
            const sql = `
                SELECT 
                    FK_NAME,
                    FKCOLUMN_NAME,
                    PKTABLE_NAME,
                    PKCOLUMN_NAME,
                    KEY_SEQ
                FROM INFORMATION_SCHEMA.SYSTEM_CROSSREFERENCE 
                WHERE FKTABLE_NAME = ? AND FKTABLE_SCHEM = 'PUBLIC'
                ORDER BY FK_NAME, KEY_SEQ
            `;

            const result = await connection.execute(sql, [tableName]);
            const fkMap = new Map<string, {
                constraintName: string;
                sourceColumns: string[];
                targetTable: string;
                targetColumns: string[];
            }>();

            for (const row of result.rows) {
                const constraintName = row[0] as string;
                const sourceColumn = row[1] as string;
                const targetTable = row[2] as string;
                const targetColumn = row[3] as string;

                if (!fkMap.has(constraintName)) {
                    fkMap.set(constraintName, {
                        constraintName,
                        sourceColumns: [],
                        targetTable,
                        targetColumns: []
                    });
                }

                const fk = fkMap.get(constraintName)!;
                fk.sourceColumns.push(sourceColumn);
                fk.targetColumns.push(targetColumn);
            }

            return Array.from(fkMap.values());
        } catch (error) {
            this.logger.debug('Failed to get foreign key metadata', {
                operation: 'get-foreign-key-metadata',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }

    /**
     * Validate a single relationship
     */
    private async validateSingleRelationship(relationship: RelationshipPattern): Promise<RelationshipValidation> {
        try {
            const connection = await this.connectionManager.getConnection();
            const issues: IntegrityIssue[] = [];
            let orphanedRecords = 0;

            try {
                // Valider l'intégrité des données pour cette relation
                if (relationship.isEnforced) {
                    // Pour les relations avec contraintes FK, vérifier l'intégrité
                    const checkSql = `
                        SELECT COUNT(*) as orphaned_count
                        FROM ${relationship.sourceTable} s
                        LEFT JOIN ${relationship.targetTable} t 
                        ON ${relationship.sourceColumns.map((col, i) => 
                            `s.${col} = t.${relationship.targetColumns[i] || relationship.targetColumns[0]}`
                        ).join(' AND ')}
                        WHERE t.${relationship.targetColumns[0]} IS NULL 
                        AND s.${relationship.sourceColumns[0]} IS NOT NULL
                    `;

                    const result = await connection.execute(checkSql);
                    orphanedRecords = parseInt(result.rows[0][0] as string);

                    if (orphanedRecords > 0) {
                        issues.push({
                            type: 'orphaned',
                            severity: 'high',
                            description: `Found ${orphanedRecords} orphaned records in ${relationship.sourceTable}`,
                            table: relationship.sourceTable,
                            columns: relationship.sourceColumns,
                            affectedRecords: orphanedRecords,
                            suggestedFix: `Review foreign key constraints and data consistency in ${relationship.sourceTable}`
                        });
                    }
                }
            } finally {
                await this.connectionManager.releaseConnection(connection);
            }

            return {
                isValid: issues.length === 0,
                integrityIssues: issues,
                orphanedRecords,
                validatedAt: new Date()
            };
        } catch (error) {
            this.logger.debug('Failed to validate single relationship', {
                operation: 'validate-single-relationship',
                relationshipName: relationship.name,
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                isValid: false,
                integrityIssues: [],
                validatedAt: new Date()
            };
        }
    }

    /**
     * Validate a collection of relationships
     */
    private async validateRelationships(relationships: RelationshipPattern[]): Promise<RelationshipPattern[]> {
        const validatedRelationships: RelationshipPattern[] = [];

        for (const relationship of relationships) {
            try {
                const validation = await this.validateSingleRelationship(relationship);
                relationship.validation = validation;
                validatedRelationships.push(relationship);
            } catch (error) {
                this.logger.warn('Failed to validate relationship', {
                    operation: 'validate-relationship',
                    relationship: relationship.name,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return validatedRelationships;
    }

    /**
     * Analyze relationship performance
     */
    private async analyzeRelationshipPerformance(relationships: RelationshipPattern[]): Promise<void> {
        for (const relationship of relationships) {
            try {
                // Analyser la couverture d'index pour cette relation
                const sourceTableInfo = await this.schemaAnalyzer.analyzeTable(relationship.sourceTable);
                const targetTableInfo = await this.schemaAnalyzer.analyzeTable(relationship.targetTable);

                // Vérifier si les colonnes sources sont indexées
                const sourceIndexed = relationship.sourceColumns.every(col =>
                    sourceTableInfo.indexes.some(idx =>
                        idx.columns.some(idxCol => idxCol.name === col)
                    )
                );

                // Vérifier si les colonnes cibles sont indexées
                const targetIndexed = relationship.targetColumns.every(col =>
                    targetTableInfo.indexes.some(idx =>
                        idx.columns.some(idxCol => idxCol.name === col)
                    )
                );

                const indexCoverage = sourceIndexed && targetIndexed;
                const optimizations: string[] = [];

                if (!sourceIndexed) {
                    optimizations.push(`Add index on ${relationship.sourceTable}(${relationship.sourceColumns.join(', ')})`);
                }

                if (!targetIndexed) {
                    optimizations.push(`Add index on ${relationship.targetTable}(${relationship.targetColumns.join(', ')})`);
                }

                // Calculer la sélectivité basique (estimation)
                const sourceRowCount = sourceTableInfo.statistics.rowCount;
                const targetRowCount = targetTableInfo.statistics.rowCount;
                let selectivity = 1.0;

                if (sourceRowCount > 0 && targetRowCount > 0) {
                    // Estimation simple de la sélectivité
                    selectivity = Math.min(sourceRowCount / targetRowCount, 1.0);
                }

                relationship.performance = {
                    indexCoverage,
                    optimizations,
                    selectivity,
                    averageJoinTime: undefined, // Nécessiterait des mesures réelles
                    queryFrequency: undefined   // Nécessiterait des statistiques d'utilisation
                };

            } catch (error) {
                this.logger.debug('Failed to analyze relationship performance', {
                    operation: 'analyze-relationship-performance',
                    relationship: relationship.name,
                    error: error instanceof Error ? error.message : String(error)
                });

                // Valeurs par défaut en cas d'erreur
                relationship.performance = {
                    indexCoverage: false,
                    optimizations: ['Unable to analyze - add manual index review']
                };
            }
        }
    }

    /**
     * Find duplicate relationships
     */
    private findDuplicateRelationships(relationships: RelationshipPattern[]): RelationshipPattern[] {
        const seen = new Set<string>();
        const duplicates: RelationshipPattern[] = [];

        for (const relationship of relationships) {
            const key = `${relationship.sourceTable}:${relationship.sourceColumns.join(',')}:${relationship.targetTable}:${relationship.targetColumns.join(',')}`;

            if (seen.has(key)) {
                duplicates.push(relationship);
            } else {
                seen.add(key);
            }
        }

        return duplicates;
    }

    /**
     * Build dependency graph from relationships
     */
    private buildDependencyGraph(relationships: RelationshipPattern[], tables: string[]): TableDependency[] {
        const dependencies: TableDependency[] = [];

        for (const relationship of relationships) {
            dependencies.push({
                sourceTable: relationship.sourceTable,
                targetTable: relationship.targetTable,
                dependencyType: 'direct',
                path: [relationship.sourceTable, relationship.targetTable],
                strength: relationship.confidence
            });
        }

        return dependencies;
    }

    /**
     * Detect circular dependencies in the dependency graph
     */
    private detectCircularDependencies(dependencies: TableDependency[]): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        // Construire un graphe d'adjacence
        const graph = new Map<string, string[]>();
        for (const dep of dependencies) {
            if (!graph.has(dep.sourceTable)) {
                graph.set(dep.sourceTable, []);
            }
            graph.get(dep.sourceTable)!.push(dep.targetTable);
        }

        // Fonction DFS pour détecter les cycles
        const dfs = (node: string, path: string[]): void => {
            if (recursionStack.has(node)) {
                // Cycle détecté, extraire le cycle
                const cycleStart = path.indexOf(node);
                if (cycleStart >= 0) {
                    const cycle = path.slice(cycleStart);
                    cycle.push(node); // Fermer le cycle
                    cycles.push(cycle);
                }
                return;
            }

            if (visited.has(node)) {
                return;
            }

            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor, [...path]);
            }

            recursionStack.delete(node);
        };

        // Exécuter DFS depuis chaque nœud non visité
        for (const table of graph.keys()) {
            if (!visited.has(table)) {
                dfs(table, []);
            }
        }

        // Éliminer les doublons
        const uniqueCycles: string[][] = [];
        const cycleStrings = new Set<string>();

        for (const cycle of cycles) {
            const normalizedCycle = this.normalizeCycle(cycle);
            const cycleString = normalizedCycle.join('->');
            
            if (!cycleStrings.has(cycleString)) {
                cycleStrings.add(cycleString);
                uniqueCycles.push(normalizedCycle);
            }
        }

        return uniqueCycles;
    }

    /**
     * Normalize a cycle to start with the lexicographically smallest element
     * to enable duplicate detection
     */
    private normalizeCycle(cycle: string[]): string[] {
        if (cycle.length <= 1) return cycle;

        // Find the lexicographically smallest element (excluding the last duplicate)
        const uniqueCycle = cycle.slice(0, -1); // Remove last element as it's duplicate
        const minElement = uniqueCycle.reduce((min, current) => 
            current < min ? current : min
        );
        
        const minIndex = uniqueCycle.indexOf(minElement);
        const normalized = [
            ...uniqueCycle.slice(minIndex),
            ...uniqueCycle.slice(0, minIndex)
        ];
        normalized.push(normalized[0]); // Close the cycle

        return normalized;
    }

    /**
     * Ensure module is initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new ModuleError(
                'RelationshipAnalyzer',
                'ensureInitialized',
                'RelationshipAnalyzer not initialized'
            );
        }
    }

    /**
     * Destroy the module and cleanup resources
     */
    public async destroy(): Promise<void> {
        // Handle multiple destroy calls gracefully
        if (this.destroyed) {
            return;
        }

        if (!this.initialized) {
            throw new ModuleError(
                'RelationshipAnalyzer',
                'destroy',
                'RelationshipAnalyzer not initialized'
            );
        }

        this.logger.info('Destroying RelationshipAnalyzer', {
            operation: 'destroy'
        });

        try {
            // Clear caches
            this.relationshipCache.clear();

            this.destroyed = true;
            this.initialized = false;

            this.logger.info('RelationshipAnalyzer destroyed successfully', {
                operation: 'destroy-complete'
            });

        } catch (error) {
            this.logger.error('Failed to destroy RelationshipAnalyzer', {
                operation: 'destroy-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}
