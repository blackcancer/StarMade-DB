/**
 * StarMade Database Explorer V2 - Modern Schema and Relationship Analysis
 *
 * Next-generation exploration tool leveraging HSQLManager modules for
 * comprehensive StarMade database analysis and professional reporting.
 *
 * Architecture:
 * - SchemaAnalyzer: Real JDBC metadata extraction with HSQLDB compatibility
 * - RelationshipAnalyzer: Automatic relationship discovery and validation
 * - DatabaseReporter: Professional multi-format reporting system
 * - ConnectionManager: Robust connection pooling and health monitoring
 *
 * Key Features:
 * - Complete schema structure analysis with real metadata
 * - Automatic relationship discovery (explicit + implicit)
 * - Professional reporting (JSON, Markdown, HTML)
 * - Performance optimization recommendations
 * - Event-driven progress tracking
 * - Comprehensive health assessment
 * - HSQLDB-compatible queries with proper error handling
 *
 * @author InitSysRev
 * @version 1.0.0 - stable release
 *
 * @example
 * ```bash
 * # Complete exploration with professional report
 * node tools/StarMadeExplorer.js --export report.html --format html --verbose
 *
 * # Specific table analysis
 * node tools/StarMadeExplorer.js --table PLAYERS --verbose
 *
 * # Relationship analysis only
 * node tools/StarMadeExplorer.js --relationships-only --verbose
 * ```
 */

import { HSQLManager } from '../dist/core/HSQLManager.js';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Explorer configuration optimized for StarMade databases
 */
const EXPLORER_CONFIG = {
    // Database location
    starmadeDir: resolve(process.cwd(), 'tests', 'sandbox'),
    worldName: 'test_world',

    // Connection settings
    connection: {
        timeoutMs: 30000,
        maxRetries: 3,
        readOnly: true,
        autoCommit: true,
        maxConcurrentConnections: 5
    },

    // Module configuration - enable relationship analysis for full module auto-loading
    modules: {
        enableRelationshipAnalysis: true, // Auto-loads: SchemaAnalyzer, RelationshipAnalyzer, DatabaseReporter
        enableQueryValidation: false,
        enableParameterizedQueries: false,
        enableAdvancedCaching: true,
        enableMetricsCollection: true,
        enableAutoReconnection: false,
        enableConnectionFactory: true // Auto-loads: ConnectionManager
    },

    // Logging configuration
    logging: {
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    }
};

// =============================================================================
// MAIN EXPLORER CLASS
// =============================================================================

/**
 * StarMade Database Explorer V2
 *
 * Professional database exploration tool with modular architecture
 */
class StarMadeExplorerV2 {
    constructor(options = {}) {
        this.options = {
            format: 'json',
            outputDir: './reports',
            verbose: false,
            interactive: false,
            sampleData: false,
            performanceAnalysis: true,
            relationshipsOnly: false,
            ...options
        };

        // Core modules - will be retrieved from HSQLManager after initialization
        this.manager = null;
        this.schemaAnalyzer = null;
        this.relationshipAnalyzer = null;
        this.databaseReporter = null;
        this.connectionManager = null;

        // Analysis results
        this.results = {
            schema: null,
            relationships: [],
            crossTableAnalysis: null,
            optimizations: [],
            executiveSummary: null
        };

        // State tracking
        this.initialized = false;
        this.startTime = Date.now();
        this.isDatabaseCorrupted = false;
    }

    /**
     * Initialize all modules with proper error handling
     */
    async initialize() {
        if (this.initialized) {
            throw new Error('Explorer already initialized');
        }

        console.log('Initializing StarMade Database Explorer V2...');

        try {
            // Initialize HSQLManager with auto-loaded modules
            this.manager = new HSQLManager(EXPLORER_CONFIG);
            await this.manager.initialize();

            console.log('   HSQLManager initialized, retrieving auto-loaded modules...');

            // Get all auto-loaded modules from HSQLManager
            this.connectionManager = this.manager.getModule('connection-manager');
            this.schemaAnalyzer = this.manager.getModule('schema-analyzer');
            this.relationshipAnalyzer = this.manager.getModule('relationship-analyzer');
            this.databaseReporter = this.manager.getModule('database-reporter');

            // Verify all required modules are available
            const requiredModules = [
                { name: 'ConnectionManager', module: this.connectionManager, setting: 'enableConnectionFactory' },
                { name: 'SchemaAnalyzer', module: this.schemaAnalyzer, setting: 'enableRelationshipAnalysis' },
                { name: 'RelationshipAnalyzer', module: this.relationshipAnalyzer, setting: 'enableRelationshipAnalysis' },
                { name: 'DatabaseReporter', module: this.databaseReporter, setting: 'enableRelationshipAnalysis' }
            ];

            for (const { name, module, setting } of requiredModules) {
                if (!module) {
                    throw new Error(`${name} not auto-loaded by HSQLManager - check ${setting} setting`);
                }
            }

            // Test database connectivity and detect corruption early
            await this.testDatabaseConnectivity();

            this.initialized = true;
            console.log('Explorer initialized successfully');

            if (this.options.verbose) {
                console.log(`   SchemaAnalyzer: v${this.schemaAnalyzer.version} (auto-loaded)`);
                console.log(`   RelationshipAnalyzer: v${this.relationshipAnalyzer.version} (auto-loaded)`);
                console.log(`   DatabaseReporter: v${this.databaseReporter.version} (auto-loaded)`);
                console.log(`   ConnectionManager: v${this.connectionManager.version} (auto-loaded)`);

                if (this.isDatabaseCorrupted) {
                    console.log(`   WARNING: Database corruption detected during connectivity test`);
                }
            }

        } catch (error) {
            console.error('Initialization failed:', error.message);
            if (this.options.verbose) {
                console.error('Error details:', error.stack);
                console.error('\nHSQLManager status:', this.manager?.getStatus());
                console.error('Available modules:', this.manager?.getStatus()?.modulesLoaded);
            }
            throw error;
        }
    }

    /**
     * Test database connectivity and detect corruption early
     */
    async testDatabaseConnectivity() {
        try {
            console.log('   Testing database connectivity...');

            // Use SchemaAnalyzer's simple table count method
            const tableCount = await this.schemaAnalyzer.getTableCount();
            console.log(`   Found ${tableCount} tables in database`);

            if (tableCount === 0) {
                console.log('   WARNING: Database appears to be empty or has connectivity issues');
                this.isDatabaseCorrupted = true;
            } else if (tableCount !== 16) {
                console.log(`   WARNING: Expected 16 StarMade tables, found ${tableCount}`);
                console.log('   This may indicate database corruption or incomplete data');
                this.isDatabaseCorrupted = true;
            } else {
                console.log('   Database connectivity test passed');
            }

        } catch (error) {
            console.log('   Database connectivity test failed:', error.message);
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.log('   Database corruption detected (ArrayIndexOutOfBoundsException)');
                this.isDatabaseCorrupted = true;
            } else {
                throw error; // Re-throw non-corruption errors
            }
        }
    }

    /**
     * Perform database connection diagnostics with error handling
     */
    async performDiagnostics() {
        console.log('\nConnection Diagnostics:');

        try {
            // Use ConnectionManager's testing methods
            const connectionTest = await this.connectionManager.testAllConnections();

            console.log('   Database connectivity: OK');
            console.log(`   Healthy connections: ${connectionTest.healthyConnections}/${connectionTest.totalTested}`);

            if (connectionTest.details && connectionTest.details.length > 0) {
                const validResponseTimes = connectionTest.details
                    .filter(d => d.responseTime !== undefined && d.isHealthy);

                if (validResponseTimes.length > 0) {
                    const avgResponseTime = validResponseTimes
                        .reduce((sum, d) => sum + d.responseTime, 0) / validResponseTimes.length;
                    console.log(`   Average response time: ${Math.round(avgResponseTime)}ms`);
                }
            }

            // Get connection statistics from ConnectionManager
            const stats = this.connectionManager.getStats();
            console.log(`   Pool status: ${stats.activeConnections} active, ${stats.totalConnections} total connections`);
            console.log(`   Pool utilization: ${Math.round(stats.poolUtilization)}%`);

            // Get table count using a proper database query through ConnectionManager
            try {
                const connection = await this.connectionManager.getConnection();
                const result = await connection.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SYSTEM_TABLES WHERE TABLE_SCHEM = 'PUBLIC' AND TABLE_TYPE = 'TABLE'");
                const tableCount = result.rows[0][0];
                console.log(`   Tables found via raw query: ${tableCount}`);
                await this.connectionManager.releaseConnection(connection);
            } catch (tableError) {
                console.log(`   Table count query failed: ${tableError.message}`);
                if (tableError.message.includes('ArrayIndexOutOfBoundsException')) {
                    this.isDatabaseCorrupted = true;
                }
            }

        } catch (error) {
            console.error('   Connection diagnostic failed:', error.message);
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                this.isDatabaseCorrupted = true;
                console.log('   Database corruption detected during diagnostics');
            } else {
                throw error;
            }
        }
    }

    /**
     * Analyze database schema with corruption handling
     */
    async analyzeSchema() {
        console.log('\nSchema Analysis:');

        if (this.isDatabaseCorrupted) {
            console.log('   WARNING: Database corruption detected, analysis may be limited');
        }

        try {
            if (this.options.table) {
                // Single table analysis
                console.log(`   Analyzing table: ${this.options.table}`);

                const tableInfo = await this.schemaAnalyzer.analyzeTable(this.options.table, {
                    enableDeepAnalysis: true,
                    enableStatistics: true,
                    maxSampleSize: this.options.sampleData ? 1000 : 100,
                    timeoutMs: 60000
                });

                console.log('   Table analysis completed');
                this.displayTableSummary(tableInfo);

                this.results.schema = { tables: [tableInfo] };
                return this.results.schema;

            } else {
                // Complete schema analysis
                console.log('   Analyzing complete database schema...');

                const schema = await this.schemaAnalyzer.analyzeSchema({
                    enableDeepAnalysis: !this.isDatabaseCorrupted, // Disable deep analysis if corrupted
                    enableStatistics: !this.isDatabaseCorrupted,
                    includeSystemTables: false,
                    maxSampleSize: this.options.sampleData ? 1000 : 100,
                    timeoutMs: this.isDatabaseCorrupted ? 120000 : 60000 // Longer timeout if corrupted
                });

                console.log('   Schema analysis completed');
                console.log(`   Tables analyzed: ${schema.tables.length}`);

                if (schema.tables.length === 0) {
                    console.log('   WARNING: SchemaAnalyzer found 0 tables');
                    console.log('   This indicates HSQLDB compatibility issues or database corruption');
                    console.log('   The database may be under stress from extensive testing');
                } else {
                    console.log(`   Schema analysis successful`);
                    console.log(`   Total columns: ${schema.statistics.columnCount}`);
                    console.log(`   Total indexes: ${schema.statistics.indexCount}`);
                    console.log(`   Health score: ${schema.health.overallScore}/100`);
                }

                this.results.schema = schema;
                return this.results.schema;
            }

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Schema analysis failed due to database corruption');
                console.error('   ArrayIndexOutOfBoundsException detected - database stress from testing');
                this.isDatabaseCorrupted = true;

                // Return minimal schema for graceful continuation
                this.results.schema = {
                    name: 'HSQLDB',
                    version: 'Unknown',
                    schemaName: 'PUBLIC',
                    tables: [],
                    statistics: { tableCount: 0, columnCount: 0, indexCount: 0, constraintCount: 0, totalSizeBytes: 0, totalRowCount: 0, complexityScore: 0 },
                    health: { overallScore: 0, performanceScore: 0, dataQualityScore: 0, designScore: 0, securityScore: 0, issues: [], recommendations: [] },
                    analyzedAt: new Date()
                };
                return this.results.schema;
            } else {
                console.error('   Schema analysis failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
                throw error;
            }
        }
    }

    /**
     * Discover database relationships with error handling
     */
    async discoverRelationships() {
        console.log('\nRelationship Discovery:');

        if (this.isDatabaseCorrupted) {
            console.log('   Skipping relationship discovery due to database corruption');
            this.results.relationships = [];
            return this.results.relationships;
        }

        try {
            const relationships = await this.relationshipAnalyzer.discoverRelationships();

            console.log('   Relationship discovery completed');
            console.log(`   Total relationships: ${relationships.length}`);

            const explicitCount = relationships.filter(r => r.discoveryMethod === 'foreign-key').length;
            const implicitCount = relationships.length - explicitCount;

            console.log(`   Explicit (FK): ${explicitCount}`);
            console.log(`   Implicit: ${implicitCount}`);

            this.results.relationships = relationships;
            return this.results.relationships;

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Relationship discovery failed due to database corruption');
                this.isDatabaseCorrupted = true;
                this.results.relationships = [];
                return this.results.relationships;
            } else {
                console.error('   Relationship discovery failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
                throw error;
            }
        }
    }

    /**
     * Perform cross-table analysis with error handling
     */
    async performCrossTableAnalysis() {
        console.log('\nCross-Table Analysis:');

        if (this.isDatabaseCorrupted) {
            console.log('   Skipping cross-table analysis due to database corruption');
            this.results.crossTableAnalysis = {
                tables: [],
                dependencies: [],
                circularDependencies: [],
                metrics: { isolatedTables: [] }
            };
            return this.results.crossTableAnalysis;
        }

        try {
            const analysis = await this.relationshipAnalyzer.performCrossTableAnalysis();

            console.log('   Cross-table analysis completed');
            console.log(`   Tables analyzed: ${analysis.tables.length}`);
            console.log(`   Dependencies found: ${analysis.dependencies.length}`);
            console.log(`   Circular dependencies: ${analysis.circularDependencies.length}`);
            console.log(`   Isolated tables: ${analysis.metrics.isolatedTables.length}`);

            this.results.crossTableAnalysis = analysis;
            return this.results.crossTableAnalysis;

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Cross-table analysis failed due to database corruption');
                this.isDatabaseCorrupted = true;
                this.results.crossTableAnalysis = {
                    tables: [],
                    dependencies: [],
                    circularDependencies: [],
                    metrics: { isolatedTables: [] }
                };
                return this.results.crossTableAnalysis;
            } else {
                console.error('   Cross-table analysis failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
                throw error;
            }
        }
    }

    /**
     * Analyze performance and get recommendations with error handling
     */
    async analyzePerformance() {
        console.log('\nPerformance Analysis:');

        if (this.isDatabaseCorrupted) {
            console.log('   Skipping performance analysis due to database corruption');
            this.results.optimizations = [];
            return this.results.optimizations;
        }

        try {
            const recommendations = await this.schemaAnalyzer.getOptimizationRecommendations();

            console.log('   Performance analysis completed');
            console.log(`   Optimization recommendations: ${recommendations.length}`);

            const criticalCount = recommendations.filter(r => r.priority === 'CRITICAL').length;
            const highCount = recommendations.filter(r => r.priority === 'HIGH').length;

            if (criticalCount > 0) console.log(`   Critical issues: ${criticalCount}`);
            if (highCount > 0) console.log(`   High priority: ${highCount}`);

            this.results.optimizations = recommendations;
            return this.results.optimizations;

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Performance analysis failed due to database corruption');
                this.isDatabaseCorrupted = true;
                this.results.optimizations = [];
                return this.results.optimizations;
            } else {
                console.error('   Performance analysis failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
                throw error;
            }
        }
    }

    /**
     * Generate executive summary with error handling
     */
    async generateExecutiveSummary() {
        console.log('\nGenerating Executive Summary...');

        try {
            const summary = await this.databaseReporter.generateExecutiveSummary({
                includePerformanceMetrics: this.options.performanceAnalysis && !this.isDatabaseCorrupted,
                includeDataSamples: this.options.sampleData && !this.isDatabaseCorrupted,
                includeRecommendations: true
            });

            this.results.executiveSummary = summary;
            this.displayExecutiveSummary(summary);

            return this.results.executiveSummary;

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Executive summary generation failed due to database corruption');
                this.isDatabaseCorrupted = true;

                // Generate minimal summary
                this.results.executiveSummary = {
                    overview: {
                        databaseName: 'HSQLDB',
                        databaseVersion: 'Unknown',
                        schemaName: 'PUBLIC',
                        analysisDate: new Date().toISOString()
                    },
                    keyMetrics: {
                        totalTables: 0,
                        totalColumns: 0,
                        totalIndexes: 0,
                        totalRelationships: 0,
                        totalDataSize: 0
                    },
                    healthAssessment: {
                        overallScore: 0,
                        performanceScore: 0,
                        dataQualityScore: 0
                    },
                    recommendations: []
                };
                this.displayExecutiveSummary(this.results.executiveSummary);
                return this.results.executiveSummary;
            } else {
                console.error('   Summary generation failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
            }
        }
    }

    /**
     * Export results using DatabaseReporter with error handling
     */
    async exportResults() {
        if (!this.options.export) return;

        console.log('\nExporting Results...');

        try {
            // Ensure reports directory exists
            const fs = await import('fs/promises');
            const reportsDir = this.options.outputDir || './reports';
            await fs.mkdir(reportsDir, { recursive: true });

            // Use correct enum values (lowercase) instead of uppercase format strings
            let reportFormat;
            switch (this.options.format.toLowerCase()) {
                case 'html':
                    reportFormat = 'html';
                    break;
                case 'markdown':
                case 'md':
                    reportFormat = 'markdown';
                    break;
                case 'json':
                default:
                    reportFormat = 'json';
                    break;
            }

            // Use DatabaseReporter's generateSchemaReport method with correct enum values
            const reportPath = await this.databaseReporter.generateSchemaReport({
                format: reportFormat, // Use lowercase format value
                filename: this.options.export.replace(/\.[^/.]+$/, ""), // Remove extension from filename
                outputDir: reportsDir,
                includeStatistics: !this.isDatabaseCorrupted,
                includeRelationships: true,
                includePerformance: this.options.performanceAnalysis && !this.isDatabaseCorrupted,
                includeDataSamples: this.options.sampleData && !this.isDatabaseCorrupted
            });

            console.log(`   Export completed successfully: ${reportPath}`);

        } catch (error) {
            if (error.message.includes('ArrayIndexOutOfBoundsException')) {
                console.error('   Export failed due to database corruption');
                console.error('   Report generation aborted');
            } else {
                console.error('   Export failed:', error.message);
                if (this.options.verbose) {
                    console.error('   Error details:', error.stack);
                }
            }
        }
    }

    /**
     * Main exploration workflow with comprehensive error handling
     */
    async explore() {
        console.log('\nStarting Database Exploration...');
        console.log(`Started at: ${new Date().toISOString()}`);

        try {
            // 1. Connection diagnostics
            await this.performDiagnostics();

            // 2. Schema analysis
            if (!this.options.relationshipsOnly) {
                await this.analyzeSchema();
            }

            // 3. Relationship discovery
            await this.discoverRelationships();

            // 4. Cross-table analysis
            await this.performCrossTableAnalysis();

            // 5. Performance analysis
            if (this.options.performanceAnalysis && !this.options.relationshipsOnly) {
                await this.analyzePerformance();
            }

            // 6. Executive summary
            await this.generateExecutiveSummary();

            // 7. Export results
            await this.exportResults();

            // 8. Final summary
            this.displayFinalSummary();

            // Display corruption warning if detected
            if (this.isDatabaseCorrupted) {
                console.log('\nDATABASE CORRUPTION DETECTED');
                console.log('   The database appears to be corrupted or under stress from extensive testing.');
                console.log('   Some analysis features may have been limited or skipped.');
                console.log('   Consider refreshing the test database for full functionality.');
            }

        } catch (error) {
            console.error('\nExploration failed:', error.message);
            if (this.options.verbose) {
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    /**
     * Display table summary
     */
    displayTableSummary(table) {
        console.log(`\nTable: ${table.name}`);
        console.log(`   Schema: ${table.schema}`);
        console.log(`   Type: ${table.type}`);
        console.log(`   Columns: ${table.columns.length}`);
        console.log(`   Indexes: ${table.indexes.length}`);
        console.log(`   Constraints: ${table.constraints.length}`);
        console.log(`   Rows: ${table.statistics.rowCount.toLocaleString()}`);
        console.log(`   Size: ${this.formatBytes(table.statistics.sizeBytes)}`);
        console.log(`   Health: ${table.statistics.healthScore}/100`);
    }

    /**
     * Display executive summary with null checks
     */
    displayExecutiveSummary(summary) {
        console.log('\nEXECUTIVE SUMMARY');
        console.log('='.repeat(60));

        if (summary && summary.overview) {
            console.log('\nDatabase Overview:');
            console.log(`   Name: ${summary.overview.databaseName || 'HSQLDB'}`);
            console.log(`   Version: ${summary.overview.databaseVersion || 'Unknown'}`);
            console.log(`   Schema: ${summary.overview.schemaName || 'PUBLIC'}`);
            console.log(`   Analysis: ${summary.overview.analysisDate || new Date().toISOString()}`);
        }

        if (summary && summary.keyMetrics) {
            console.log('\nKey Metrics:');
            console.log(`   Tables: ${summary.keyMetrics.totalTables || 0}`);
            console.log(`   Columns: ${summary.keyMetrics.totalColumns || 0}`);
            console.log(`   Indexes: ${summary.keyMetrics.totalIndexes || 0}`);
            console.log(`   Relationships: ${summary.keyMetrics.totalRelationships || 0}`);
            console.log(`   Data Size: ${this.formatBytes(summary.keyMetrics.totalDataSize || 0)}`);
        }

        if (summary && summary.healthAssessment) {
            console.log('\nHealth Assessment:');
            console.log(`   Overall: ${summary.healthAssessment.overallScore || 0}/100`);
            console.log(`   Performance: ${summary.healthAssessment.performanceScore || 0}/100`);
            console.log(`   Data Quality: ${summary.healthAssessment.dataQualityScore || 0}/100`);
        }

        if (summary && summary.recommendations && summary.recommendations.length > 0) {
            console.log('\nTop Recommendations:');
            summary.recommendations.slice(0, 3).forEach((rec, index) => {
                console.log(`   ${index + 1}. [${rec.priority}] ${rec.title}`);
            });
        }

        if (this.isDatabaseCorrupted) {
            console.log('\nNOTE: Some metrics may be incomplete due to database corruption');
        }

        console.log('\n' + '='.repeat(60));
    }

    /**
     * Display final exploration summary
     */
    displayFinalSummary() {
        const duration = Date.now() - this.startTime;

        console.log('\nEXPLORATION COMPLETED');
        console.log('='.repeat(60));
        console.log(`Duration: ${this.formatDuration(duration)}`);
        console.log(`Tables analyzed: ${this.results.schema?.tables?.length || (this.options.table ? 1 : 0)}`);
        console.log(`Relationships found: ${this.results.relationships?.length || 0}`);
        console.log(`Recommendations: ${this.results.optimizations?.length || 0}`);

        if (this.options.export) {
            console.log(`Report exported: ${this.options.export}`);
        }

        if (this.isDatabaseCorrupted) {
            console.log(`Status: Completed with database corruption warnings`);
        } else {
            console.log(`Status: Completed successfully`);
        }

        console.log('='.repeat(60));
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        try {
            console.log('\nCleaning up resources...');

            // Only destroy the HSQLManager - it will handle all auto-loaded modules
            if (this.manager) {
                await this.manager.destroy();
            }

            console.log('Cleanup completed');
        } catch (error) {
            console.error('Cleanup warning:', error.message);
        } finally {
            // Force exit to ensure JVM doesn't keep the process alive
            process.exit(0);
        }
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }
}

// =============================================================================
// COMMAND LINE INTERFACE
// =============================================================================

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--table':
                options.table = args[++i];
                break;
            case '--export':
                options.export = args[++i];
                break;
            case '--relationships-only':
                options.relationshipsOnly = true;
                break;
            case '--format':
                options.format = args[++i];
                break;
            case '--output-dir':
                options.outputDir = args[++i];
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--interactive':
                options.interactive = true;
                break;
            case '--sample-data':
                options.sampleData = true;
                break;
            case '--no-performance':
                options.performanceAnalysis = false;
                break;
            case '--help':
                displayHelp();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('--')) {
                    console.error(`Unknown option: ${arg}`);
                    process.exit(1);
                }
        }
    }

    return options;
}

/**
 * Display help information
 */
function displayHelp() {
    console.log(`
StarMade Database Explorer V1.0.0

Professional schema analysis and relationship discovery for StarMade databases.

USAGE:
  node tools/StarMadeExplorer.js [options]

OPTIONS:
  --table TABLE_NAME          Analyze specific table only
  --export FILE              Export professional report
  --format FORMAT            Report format: json, markdown, html (default: json)
  --output-dir DIR           Output directory (default: ./reports)
  --relationships-only       Focus on relationships only
  --verbose                  Show detailed progress and events
  --interactive              Interactive exploration mode
  --sample-data              Include data sampling in analysis
  --no-performance           Skip performance analysis
  --help                     Show this help message

EXAMPLES:
  # Complete exploration with HTML report
  node tools/StarMadeExplorer.js --export report.html --format html --verbose

  # Analyze specific table with detailed output
  node tools/StarMadeExplorer.js --table PLAYERS --verbose

  # Generate markdown documentation
  node tools/StarMadeExplorer.js --export schema.md --format markdown

  # Relationship analysis only
  node tools/StarMadeExplorer.js --relationships-only --verbose

FEATURES:
  Real JDBC metadata extraction with HSQLDB compatibility
  Automatic relationship discovery (explicit + implicit)
  Professional multi-format reporting (JSON/Markdown/HTML)
  Performance optimization recommendations
  Executive summary generation
  Comprehensive health assessment
  Event-driven progress tracking
  Database corruption detection and graceful handling
  Uses HSQLManager auto-loaded modules for reliability

DATABASE:
  Target: ${EXPLORER_CONFIG.starmadeDir}/server-database/${EXPLORER_CONFIG.worldName}

NOTES:
  - All modules (SchemaAnalyzer, RelationshipAnalyzer, DatabaseReporter, ConnectionManager)
    are automatically loaded by HSQLManager for maximum reliability
  - Detects and handles database corruption gracefully
  - Provides detailed diagnostics and progress tracking
  - Safe read-only operations with comprehensive error handling
  `);
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

/**
 * Main execution function
 */
async function main() {
    const options = parseArguments();
    const explorer = new StarMadeExplorerV2(options);

    try {
        console.log('StarMade Database Explorer V1.0.0');
        console.log('   Professional Schema Analysis & Relationship Discovery');
        console.log('   Powered by HSQLManager with auto-loaded modules');
        console.log('   Enhanced error handling and corruption detection');
        console.log('');

        // Validate database exists
        const dbPath = resolve(EXPLORER_CONFIG.starmadeDir, 'server-database', EXPLORER_CONFIG.worldName, 'index');

        if (!existsSync(dbPath)) {
            console.error(`Database not found: ${dbPath}`);
            console.log('\nMake sure you have the test database set up:');
            console.log('   tests/sandbox/server-database/test_world/index/');
            process.exit(1);
        }

        console.log(`Database found: ${dbPath}`);

        // Initialize and explore
        await explorer.initialize();
        await explorer.explore();

    } catch (error) {
        console.error('\nExploration failed:', error.message);
        if (options.verbose) {
            console.error('Error stack:', error.stack);
        }
        process.exit(1);
    } finally {
        await explorer.destroy();
    }
}

// Run if this is the main module - FIXED for Windows compatibility
const isMainModule = () => {
    try {
        // Method 1: Check if this script was called directly
        const scriptPath = fileURLToPath(import.meta.url);
        const mainPath = process.argv[1];

        // Normalize paths for cross-platform compatibility
        const normalizeWindowsPath = (path) => path.replace(/\\/g, '/').toLowerCase();

        if (process.platform === 'win32') {
            // On Windows, normalize paths and compare
            return normalizeWindowsPath(scriptPath) === normalizeWindowsPath(mainPath);
        } else {
            // On Unix systems, use original comparison
            return scriptPath === mainPath;
        }
    } catch (error) {
        // Fallback: check if process.argv[1] includes our script name
        return process.argv[1] && process.argv[1].includes('StarMadeExplorer.js');
    }
};

if (isMainModule()) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export { StarMadeExplorerV2, EXPLORER_CONFIG };
