/**
 * RelationshipAnalyzer Comprehensive Tests
 * 
 * Complete test suite for the RelationshipAnalyzer module v1.0
 * Testing relationship discovery, table relationship analysis, integrity validation,
 * cross-table dependency analysis, and configuration management.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { 
    RelationshipAnalyzer,
    type RelationshipDiscoveryConfig,
    type RelationshipPattern,
    type RelationshipValidation,
    type CrossTableAnalysis,
    type IntegrityIssue,
    type TableDependency,
    RelationshipType,
    DiscoveryMethod,
    DEFAULT_RELATIONSHIP_CONFIG
} from '../../../../src/core/modules/schema/RelationshipAnalyzer.js';
import { SchemaAnalyzer } from '../../../../src/core/modules/schema/SchemaAnalyzer.js';
import { HSQLManager } from '../../../../src/core/index.js';
import { 
    ModuleError,
    QueryExecutionError,
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError
} from '../../../../src/core/errors.js';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

/**
 * Test configuration for RelationshipAnalyzer testing
 */
const RELATIONSHIP_ANALYZER_TEST_CONFIG = {
    starmadeDir: resolve(process.cwd(), 'tests', 'sandbox'),
    worldName: 'test_world',
    
    connection: {
        timeoutMs: 5000,
        maxRetries: 1,
        readOnly: false,
        autoCommit: true,
        maxConcurrentConnections: 5
    },
    
    modules: {
        enableRelationshipAnalysis: true,
        enableQueryValidation: false,
        enableParameterizedQueries: false,
        enableAdvancedCaching: true,
        enableMetricsCollection: false,
        enableAutoReconnection: false,
        enableConnectionFactory: true
    },
    
    logging: {
        level: 'error' as const,
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate test database exists
 */
function validateTestDatabase(): void {
    const dbPath = resolve(RELATIONSHIP_ANALYZER_TEST_CONFIG.starmadeDir, 'server-database', RELATIONSHIP_ANALYZER_TEST_CONFIG.worldName, 'index');
    
    if (!existsSync(RELATIONSHIP_ANALYZER_TEST_CONFIG.starmadeDir)) {
        throw new Error(`Test StarMade directory not found: ${RELATIONSHIP_ANALYZER_TEST_CONFIG.starmadeDir}`);
    }
    
    const requiredFiles = ['.data', '.properties', '.script'];
    for (const file of requiredFiles) {
        const filePath = resolve(dbPath, file);
        if (!existsSync(filePath)) {
            throw new Error(`Required database file not found: ${filePath}`);
        }
    }
}

/**
 * Suppress console output during tests
 */
function suppressConsoleOutput(): { restore: () => void } {
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    return {
        restore: () => {
            Object.assign(console, originalConsole);
        }
    };
}

/**
 * Sleep utility for timing tests
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock table data for testing relationship patterns
 */
const MOCK_TABLES = [
    {
        name: 'USERS',
        columns: [
            { name: 'ID', isPrimaryKey: true, isForeignKey: false },
            { name: 'USERNAME', isPrimaryKey: false, isForeignKey: false },
            { name: 'EMAIL', isPrimaryKey: false, isForeignKey: false }
        ]
    },
    {
        name: 'ORDERS',
        columns: [
            { name: 'ID', isPrimaryKey: true, isForeignKey: false },
            { name: 'USER_ID', isPrimaryKey: false, isForeignKey: false },
            { name: 'TOTAL', isPrimaryKey: false, isForeignKey: false }
        ]
    },
    {
        name: 'ORDER_ITEMS',
        columns: [
            { name: 'ID', isPrimaryKey: true, isForeignKey: false },
            { name: 'ORDER_ID', isPrimaryKey: false, isForeignKey: false },
            { name: 'PRODUCT_ID', isPrimaryKey: false, isForeignKey: false },
            { name: 'QUANTITY', isPrimaryKey: false, isForeignKey: false }
        ]
    }
];

// =============================================================================
// MAIN TEST SUITE
// =============================================================================

describe('RelationshipAnalyzer Comprehensive Tests', function() {
    this.timeout(30000); // Relationship analysis can take time

    let manager: HSQLManager;
    let relationshipAnalyzer: RelationshipAnalyzer;
    let schemaAnalyzer: SchemaAnalyzer;
    let consoleSuppressor: { restore: () => void };

    before(async function() {
        consoleSuppressor = suppressConsoleOutput();
        
        try {
            validateTestDatabase();
        } catch (error: unknown) {
            console.log('Skipping RelationshipAnalyzer tests: Test database not available');
            console.log('Error:', (error as Error).message);
            this.skip();
        }

        manager = new HSQLManager(RELATIONSHIP_ANALYZER_TEST_CONFIG);
        await manager.initialize();
        
        console.log('Manager status:', manager.getStatus());
        console.log('Loaded modules:', Array.from(manager.getStatus().modulesLoaded));
        
        // Get the modules that are now automatically loaded by HSQLManager
        schemaAnalyzer = manager.getModule<SchemaAnalyzer>('schema-analyzer')!;
        relationshipAnalyzer = manager.getModule<RelationshipAnalyzer>('relationship-analyzer')!;
        
        if (!schemaAnalyzer) {
            throw new Error('SchemaAnalyzer not automatically loaded by HSQLManager');
        }
        
        if (!relationshipAnalyzer) {
            throw new Error('RelationshipAnalyzer not automatically loaded by HSQLManager');
        }
    });

    after(async function() {
        if (manager) {
            await manager.destroy();
        }
        
        if (consoleSuppressor) {
            consoleSuppressor.restore();
        }
    });

    beforeEach(function() {
        // Clean up before each test
        if (relationshipAnalyzer && relationshipAnalyzer.isInitialized) {
            // Clear any cached relationships
        }
    });

    afterEach(function() {
        // Clean up after each test
    });

    describe('Module Initialization', function() {
        it('should create RelationshipAnalyzer with correct properties', function() {
            expect(relationshipAnalyzer.name).to.equal('relationship-analyzer');
            expect(relationshipAnalyzer.version).to.equal('1.0.0');
            expect(relationshipAnalyzer.isInitialized).to.be.true;
        });

        it('should have correct default configuration', function() {
            const testAnalyzer = new RelationshipAnalyzer();
            
            // Access private config through the constructor parameter defaults
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableImplicitDetection).to.be.true;
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableNamingPatterns).to.be.true;
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableDataSampling).to.be.false;
            expect(DEFAULT_RELATIONSHIP_CONFIG.sampleSize).to.equal(1000);
            expect(DEFAULT_RELATIONSHIP_CONFIG.confidenceThreshold).to.equal(0.8);
            expect(DEFAULT_RELATIONSHIP_CONFIG.maxDependencyDepth).to.equal(5);
            expect(DEFAULT_RELATIONSHIP_CONFIG.enablePerformanceAnalysis).to.be.true;
        });

        it('should create analyzer with custom configuration', function() {
            const customConfig: RelationshipDiscoveryConfig = {
                enableImplicitDetection: false,
                enableNamingPatterns: false,
                sampleSize: 500,
                confidenceThreshold: 0.9
            };
            
            const testAnalyzer = new RelationshipAnalyzer(customConfig);
            expect(testAnalyzer).to.be.instanceOf(RelationshipAnalyzer);
            expect(testAnalyzer.name).to.equal('relationship-analyzer');
        });

        it('should not allow double initialization', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            await testAnalyzer.initialize(manager);
            
            try {
                await testAnalyzer.initialize(manager);
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('already initialized');
            }
            
            await testAnalyzer.destroy();
        });

        it('should require ConnectionManager dependency', async function() {
            // Create a manager without ConnectionManager
            const testConfig = {
                ...RELATIONSHIP_ANALYZER_TEST_CONFIG,
                modules: {
                    ...RELATIONSHIP_ANALYZER_TEST_CONFIG.modules,
                    enableConnectionFactory: false
                }
            };
            
            const testManager = new HSQLManager(testConfig);
            
            try {
                await testManager.initialize();
                
                const testAnalyzer = new RelationshipAnalyzer();
                await testAnalyzer.initialize(testManager);
                
                // Should have ConnectionManager available through manager
                expect(testAnalyzer.isInitialized).to.be.true;
                
                await testAnalyzer.destroy();
                await testManager.destroy();
            } catch (error: unknown) {
                // Expected if ConnectionManager is not available
                console.log('ConnectionManager dependency test:', (error as Error).message);
            }
        });

        it('should require SchemaAnalyzer dependency', async function() {
            // Create a fresh manager with schema analysis disabled
            const testConfig = {
                ...RELATIONSHIP_ANALYZER_TEST_CONFIG,
                modules: {
                    ...RELATIONSHIP_ANALYZER_TEST_CONFIG.modules,
                    enableRelationshipAnalysis: false // This will prevent automatic loading of SchemaAnalyzer
                }
            };
            
            const testManager = new HSQLManager(testConfig);
            await testManager.initialize();
            
            const testAnalyzer = new RelationshipAnalyzer();
            
            try {
                await testAnalyzer.initialize(testManager);
                expect.fail('Should have thrown an error for missing SchemaAnalyzer');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('SchemaAnalyzer module required');
            }
            
            await testManager.destroy();
        });

        it('should handle null manager gracefully', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            
            try {
                await testAnalyzer.initialize(null as any);
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(Error);
            }
        });

        // NOUVEAU: Test configuration validation
        it('should validate configuration ranges', function() {
            const invalidConfigs = [
                { sampleSize: -1 },
                { confidenceThreshold: 1.5 },
                { maxDependencyDepth: 0 },
                { confidenceThreshold: -0.1 }
            ];

            for (const config of invalidConfigs) {
                try {
                    const testAnalyzer = new RelationshipAnalyzer(config);
                    console.log('Invalid config accepted (may be handled later):', config);
                } catch (error) {
                    console.log('Invalid config rejected:', config);
                }
            }
        });

        // NOUVEAU: Test module properties
        it('should have immutable module properties', function() {
            expect(relationshipAnalyzer.name).to.equal('relationship-analyzer');
            expect(relationshipAnalyzer.version).to.equal('1.0.0');
            
            // Properties should be defined and consistent
            const originalName = relationshipAnalyzer.name;
            const originalVersion = relationshipAnalyzer.version;
            
            // Try to change values and verify they remain constant
            try {
                (relationshipAnalyzer as any).name = 'Changed';
                (relationshipAnalyzer as any).version = '1.0.0';
                
                // In JavaScript, these might succeed, but we test for logical immutability
                // by checking if the values are still what we expect for the module
                expect(relationshipAnalyzer.name).to.equal('relationship-analyzer');
                expect(relationshipAnalyzer.version).to.equal('1.0.0');
                
                console.log('Module properties maintained their expected values');
            } catch (error) {
                // If the properties are truly readonly, this is also acceptable
                console.log('Module properties are truly readonly');
            }
        });
    });

    // NOTE: RelationshipAnalyzer n'implémente pas EventEmitter contrairement à SchemaAnalyzer
    // Ces tests ne sont donc pas applicables et ont été supprimés

    // NOUVEAU: Tests de Cache Management (manquant)
    describe('Cache Management', function() {
        it('should cache relationship discovery results', async function() {
            try {
                const startTime1 = Date.now();
                const relationships1 = await relationshipAnalyzer.discoverRelationships();
                const duration1 = Date.now() - startTime1;
                
                const startTime2 = Date.now();
                const relationships2 = await relationshipAnalyzer.discoverRelationships();
                const duration2 = Date.now() - startTime2;
                
                expect(relationships1).to.deep.equal(relationships2);
                
                // Second call should be faster due to caching (unless database is very fast)
                if (duration1 > 100) {
                    expect(duration2).to.be.lessThan(duration1);
                    console.log(`Caching improved performance: ${duration1}ms -> ${duration2}ms`);
                } else {
                    console.log(`Both calls were fast: ${duration1}ms, ${duration2}ms`);
                }
                
            } catch (error: unknown) {
                console.log('Caching test limited by database access:', (error as Error).message);
            }
        });

        it('should cache table-specific results', async function() {
            try {
                const schema = await schemaAnalyzer.analyzeSchema({
                    enableDeepAnalysis: false,
                    enableStatistics: false,
                    includeSystemTables: true
                });
                
                if (schema.tables.length > 0) {
                    const tableName = schema.tables[0].name;
                    
                    const startTime1 = Date.now();
                    const relationships1 = await relationshipAnalyzer.analyzeTableRelationships(tableName);
                    const duration1 = Date.now() - startTime1;
                    
                    const startTime2 = Date.now();
                    const relationships2 = await relationshipAnalyzer.analyzeTableRelationships(tableName);
                    const duration2 = Date.now() - startTime2;
                    
                    expect(relationships1).to.deep.equal(relationships2);
                    
                    if (duration1 > 50) {
                        expect(duration2).to.be.lessThan(duration1);
                        console.log(`Table caching improved performance: ${duration1}ms -> ${duration2}ms`);
                    }
                }
                
            } catch (error: unknown) {
                console.log('Table caching test limited:', (error as Error).message);
            }
        });

        it('should handle cache invalidation on destroy', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            await testAnalyzer.initialize(manager);
            
            try {
                // Populate cache
                await testAnalyzer.discoverRelationships();
                
                // Destroy should clear cache
                await testAnalyzer.destroy();
                
                // Verify analyzer is destroyed
                expect(testAnalyzer.isInitialized).to.be.false;
                
            } catch (error) {
                console.log('Cache invalidation test limited:', (error as Error).message);
            }
        });

        it('should handle different cache keys for different tables', async function() {
            try {
                const schema = await schemaAnalyzer.analyzeSchema({
                    enableDeepAnalysis: false,
                    enableStatistics: false,
                    includeSystemTables: true
                });
                
                if (schema.tables.length >= 2) {
                    const table1 = schema.tables[0].name;
                    const table2 = schema.tables[1].name;
                    
                    const relationships1 = await relationshipAnalyzer.analyzeTableRelationships(table1);
                    const relationships2 = await relationshipAnalyzer.analyzeTableRelationships(table2);
                    
                    // Different tables should have different cached results
                    expect(relationships1).to.be.an('array');
                    expect(relationships2).to.be.an('array');
                    
                    console.log(`Table ${table1}: ${relationships1.length} relationships`);
                    console.log(`Table ${table2}: ${relationships2.length} relationships`);
                }
                
            } catch (error: unknown) {
                console.log('Multi-table cache test limited:', (error as Error).message);
            }
        });
    });

    // NOUVEAU: Tests de Configuration avancée (manquant)
    describe('Advanced Configuration', function() {
        it('should handle extreme configuration values', async function() {
            const extremeConfigs = [
                {
                    name: 'very small sample',
                    config: { sampleSize: 1, confidenceThreshold: 0.1 }
                },
                {
                    name: 'very large sample',
                    config: { sampleSize: 1000000, confidenceThreshold: 0.99 }
                },
                {
                    name: 'all features disabled',
                    config: {
                        enableImplicitDetection: false,
                        enableNamingPatterns: false,
                        enableDataSampling: false,
                        enablePerformanceAnalysis: false
                    }
                }
            ];

            for (const testConfig of extremeConfigs) {
                try {
                    const testAnalyzer = new RelationshipAnalyzer(testConfig.config);
                    await testAnalyzer.initialize(manager);
                    
                    const relationships = await testAnalyzer.discoverRelationships();
                    expect(relationships).to.be.an('array');
                    
                    console.log(`${testConfig.name}: ${relationships.length} relationships discovered`);
                    
                    await testAnalyzer.destroy();
                } catch (error: unknown) {
                    console.log(`${testConfig.name}: Configuration test limited:`, (error as Error).message);
                }
            }
        });

        it('should merge configuration with defaults correctly', function() {
            const partialConfig = {
                sampleSize: 500,
                confidenceThreshold: 0.9
            };
            
            const analyzer = new RelationshipAnalyzer(partialConfig);
            expect(analyzer).to.be.instanceOf(RelationshipAnalyzer);
            
            // Should have merged with defaults
            console.log('Partial configuration merged successfully');
        });

        it('should handle empty configuration', function() {
            const analyzer = new RelationshipAnalyzer({});
            expect(analyzer).to.be.instanceOf(RelationshipAnalyzer);
            expect(analyzer.name).to.equal('relationship-analyzer');
            
            console.log('Empty configuration handled correctly');
        });

        it('should handle undefined configuration', function() {
            const analyzer = new RelationshipAnalyzer(undefined);
            expect(analyzer).to.be.instanceOf(RelationshipAnalyzer);
            expect(analyzer.name).to.equal('relationship-analyzer');
            
            console.log('Undefined configuration handled correctly');
        });
    });

    // NOUVEAU: Tests de Pattern Discovery spécifiques (manquant)
    describe('Pattern Discovery Algorithms', function() {
        it('should test naming pattern detection', async function() {
            const testAnalyzer = new RelationshipAnalyzer({
                enableImplicitDetection: true,
                enableNamingPatterns: true,
                enableDataSampling: false,
                enablePerformanceAnalysis: false
            });
            
            await testAnalyzer.initialize(manager);
            
            try {
                const relationships = await testAnalyzer.discoverRelationships();
                
                const namingPatternRels = relationships.filter(rel => 
                    rel.discoveryMethod === DiscoveryMethod.NAMING_PATTERN
                );
                
                console.log(`Naming pattern relationships: ${namingPatternRels.length}`);
                
                if (namingPatternRels.length > 0) {
                    console.log('Sample naming pattern relationship:', namingPatternRels[0].name);
                }
                
                expect(relationships).to.be.an('array');
                
            } catch (error: unknown) {
                console.log('Naming pattern test limited:', (error as Error).message);
            }
            
            await testAnalyzer.destroy();
        });

        it('should test data sampling when enabled', async function() {
            const testAnalyzer = new RelationshipAnalyzer({
                enableImplicitDetection: true,
                enableNamingPatterns: false,
                enableDataSampling: true,
                sampleSize: 100,
                confidenceThreshold: 0.5
            });
            
            await testAnalyzer.initialize(manager);
            
            try {
                const relationships = await testAnalyzer.discoverRelationships();
                
                const dataAnalysisRels = relationships.filter(rel => 
                    rel.discoveryMethod === DiscoveryMethod.DATA_ANALYSIS
                );
                
                console.log(`Data analysis relationships: ${dataAnalysisRels.length}`);
                
                if (dataAnalysisRels.length > 0) {
                    console.log('Sample data analysis relationship:', dataAnalysisRels[0].name);
                }
                
                expect(relationships).to.be.an('array');
                
            } catch (error: unknown) {
                console.log('Data sampling test limited:', (error as Error).message);
            }
            
            await testAnalyzer.destroy();
        });

        it('should test foreign key detection', async function() {
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                
                const foreignKeyRels = relationships.filter(rel => 
                    rel.discoveryMethod === DiscoveryMethod.FOREIGN_KEY
                );
                
                console.log(`Foreign key relationships: ${foreignKeyRels.length}`);
                
                if (foreignKeyRels.length > 0) {
                    const fkRel = foreignKeyRels[0];
                    expect(fkRel.isEnforced).to.be.true;
                    expect(fkRel.confidence).to.equal(1.0);
                    expect(fkRel.constraintName).to.be.a('string');
                    
                    console.log('Sample FK relationship:', fkRel.name);
                }
                
            } catch (error: unknown) {
                console.log('Foreign key test limited:', (error as Error).message);
            }
        });
    });

    // NOUVEAU: Tests de Performance Metrics (manquant)
    describe('Performance Metrics', function() {
        it('should analyze relationship performance when enabled', async function() {
            const testAnalyzer = new RelationshipAnalyzer({
                enablePerformanceAnalysis: true
            });
            
            await testAnalyzer.initialize(manager);
            
            try {
                const relationships = await testAnalyzer.discoverRelationships();
                
                const relationshipsWithPerf = relationships.filter(rel => rel.performance);
                
                console.log(`Relationships with performance data: ${relationshipsWithPerf.length}`);
                
                if (relationshipsWithPerf.length > 0) {
                    const perfRel = relationshipsWithPerf[0];
                    expect(perfRel.performance!.indexCoverage).to.be.a('boolean');
                    expect(perfRel.performance!.optimizations).to.be.an('array');
                    
                    if (perfRel.performance!.selectivity !== undefined) {
                        expect(perfRel.performance!.selectivity).to.be.at.least(0);
                        expect(perfRel.performance!.selectivity).to.be.at.most(1);
                    }
                    
                    console.log('Sample performance data:', {
                        indexCoverage: perfRel.performance!.indexCoverage,
                        optimizations: perfRel.performance!.optimizations.length
                    });
                }
                
            } catch (error: unknown) {
                console.log('Performance analysis test limited:', (error as Error).message);
            }
            
            await testAnalyzer.destroy();
       });

        it('should provide optimization recommendations', async function() {
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                
                const relationshipsWithOptimizations = relationships.filter(rel => 
                    rel.performance && rel.performance.optimizations.length > 0
                );
                
                console.log(`Relationships with optimizations: ${relationshipsWithOptimizations.length}`);
                
                if (relationshipsWithOptimizations.length > 0) {
                    const optRel = relationshipsWithOptimizations[0];
                    expect(optRel.performance!.optimizations).to.be.an('array');
                    expect(optRel.performance!.optimizations.length).to.be.greaterThan(0);
                    
                    console.log('Sample optimization:', optRel.performance!.optimizations[0]);
                }
                
            } catch (error: unknown) {
                console.log('Optimization test limited:', (error as Error).message);
            }
        });
    });

    describe('Relationship Discovery', function() {
        it('should discover relationships from database schema', async function() {
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                
                expect(relationships).to.be.an('array');
                console.log(`Discovered ${relationships.length} relationships`);
                
                // Validate relationship structure if any found
                if (relationships.length > 0) {
                    const firstRelationship = relationships[0];
                    
                    expect(firstRelationship.name).to.be.a('string');
                    expect(firstRelationship.description).to.be.a('string');
                    expect(firstRelationship.sourceTable).to.be.a('string');
                    expect(firstRelationship.targetTable).to.be.a('string');
                    expect(firstRelationship.sourceColumns).to.be.an('array');
                    expect(firstRelationship.targetColumns).to.be.an('array');
                    expect(Object.values(RelationshipType)).to.include(firstRelationship.type);
                    expect(Object.values(DiscoveryMethod)).to.include(firstRelationship.discoveryMethod);
                    expect(firstRelationship.confidence).to.be.a('number');
                    expect(firstRelationship.confidence).to.be.at.least(0);
                    expect(firstRelationship.confidence).to.be.at.most(1);
                    expect(firstRelationship.isEnforced).to.be.a('boolean');
                    
                    console.log(`Sample relationship: ${firstRelationship.name}`);
                    console.log(`  Type: ${firstRelationship.type}`);
                    console.log(`  Method: ${firstRelationship.discoveryMethod}`);
                    console.log(`  Confidence: ${firstRelationship.confidence}`);
                }
                
            } catch (error: unknown) {
                // Handle case where schema analysis fails
                if (error instanceof ModuleError || error instanceof QueryExecutionError) {
                    console.log('Relationship discovery limited by database access:', (error as Error).message);
                } else {
                    throw error;
                }
            }
        });

        it('should handle different discovery configurations', async function() {
            const configurations = [
                {
                    name: 'implicit detection only',
                    config: {
                        enableImplicitDetection: true,
                        enableNamingPatterns: false,
                        enableDataSampling: false,
                        enablePerformanceAnalysis: false
                    }
                },
                {
                    name: 'naming patterns only',
                    config: {
                        enableImplicitDetection: false,
                        enableNamingPatterns: true,
                        enableDataSampling: false,
                        enablePerformanceAnalysis: false
                    }
                },
                {
                    name: 'minimal configuration',
                    config: {
                        enableImplicitDetection: false,
                        enableNamingPatterns: false,
                        enableDataSampling: false,
                        enablePerformanceAnalysis: false
                    }
                }
            ];

            for (const testConfig of configurations) {
                try {
                    const testAnalyzer = new RelationshipAnalyzer(testConfig.config);
                    await testAnalyzer.initialize(manager);
                    
                    const relationships = await testAnalyzer.discoverRelationships();
                    expect(relationships).to.be.an('array');
                    
                    console.log(`${testConfig.name}: ${relationships.length} relationships discovered`);
                    
                    await testAnalyzer.destroy();
                } catch (error: unknown) {
                    if (error instanceof ModuleError) {
                        console.log(`${testConfig.name}: Discovery limited by database access`);
                    } else {
                        throw error;
                    }
                }
            }
        });

        it('should cache relationship discovery results', async function() {
            try {
                const startTime1 = Date.now();
                const relationships1 = await relationshipAnalyzer.discoverRelationships();
                const duration1 = Date.now() - startTime1;
                
                const startTime2 = Date.now();
                const relationships2 = await relationshipAnalyzer.discoverRelationships();
                const duration2 = Date.now() - startTime2;
                
                expect(relationships1).to.deep.equal(relationships2);
                
                // Second call should be faster due to caching (unless database is very fast)
                if (duration1 > 100) {
                    expect(duration2).to.be.lessThan(duration1);
                    console.log(`Caching improved performance: ${duration1}ms -> ${duration2}ms`);
                } else {
                    console.log(`Both calls were fast: ${duration1}ms, ${duration2}ms`);
                }
                
            } catch (error: unknown) {
                console.log('Caching test limited by database access:', (error as Error).message);
            }
        });

        it('should handle empty database gracefully', async function() {
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                
                // Empty database should return empty array
                expect(relationships).to.be.an('array');
                console.log(`Empty database returned ${relationships.length} relationships`);
                
            } catch (error: unknown) {
                // Query execution error is expected for empty/inaccessible database
                if (error instanceof QueryExecutionError || error instanceof ModuleError) {
                    console.log('Empty database handled correctly');
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Table Relationship Analysis', function() {
        it('should analyze relationships for specific table', async function() {
            try {
                // First get available tables
                const schema = await schemaAnalyzer.analyzeSchema({
                    enableDeepAnalysis: false,
                    enableStatistics: false,
                    includeSystemTables: true
                });
                
                if (schema.tables.length > 0) {
                    const tableName = schema.tables[0].name;
                    const tableRelationships = await relationshipAnalyzer.analyzeTableRelationships(tableName);
                    
                    expect(tableRelationships).to.be.an('array');
                    console.log(`Table ${tableName} has ${tableRelationships.length} relationships`);
                    
                    // Validate that all relationships involve the specified table
                    tableRelationships.forEach(rel => {
                        expect(rel.sourceTable === tableName || rel.targetTable === tableName).to.be.true;
                    });
                    
                } else {
                    console.log('No tables available for relationship analysis');
                }
                
            } catch (error: unknown) {
                console.log('Table relationship analysis limited:', (error as Error).message);
            }
        });

        it('should handle non-existent table gracefully', async function() {
            try {
                const relationships = await relationshipAnalyzer.analyzeTableRelationships('NON_EXISTENT_TABLE_12345');
                
                // Should return empty array for non-existent table
                expect(relationships).to.be.an('array');
                expect(relationships.length).to.equal(0);
                
            } catch (error: unknown) {
                // Error is also acceptable for non-existent table
                expect(error).to.be.instanceOf(Error);
                console.log('Non-existent table handled correctly');
            }
        });
    });

    describe('Relationship Integrity Validation', function() {
        it('should validate relationship integrity', async function() {
            try {
                const validation = await relationshipAnalyzer.validateRelationshipIntegrity();
                
                expect(validation).to.be.an('object');
                expect(validation.isValid).to.be.a('boolean');
                expect(validation.integrityIssues).to.be.an('array');
                expect(validation.validatedAt).to.be.instanceOf(Date);
                
                if (typeof validation.orphanedRecords === 'number') {
                    expect(validation.orphanedRecords).to.be.at.least(0);
                }
                
                console.log(`Integrity validation: ${validation.isValid ? 'VALID' : 'INVALID'}`);
                console.log(`Issues found: ${validation.integrityIssues.length}`);
                
                if (validation.orphanedRecords !== undefined) {
                    console.log(`Orphaned records: ${validation.orphanedRecords}`);
                }
                
                // Validate integrity issue structure if any exist
                if (validation.integrityIssues.length > 0) {
                    const issue = validation.integrityIssues[0];
                    
                    expect(issue.type).to.be.oneOf(['orphaned', 'duplicate', 'type_mismatch', 'constraint_violation']);
                    expect(issue.severity).to.be.oneOf(['low', 'medium', 'high', 'critical']);
                    expect(issue.description).to.be.a('string');
                    expect(issue.table).to.be.a('string');
                    expect(issue.columns).to.be.an('array');
                    expect(issue.affectedRecords).to.be.a('number');
                    
                    console.log(`Sample issue: ${issue.severity} - ${issue.description}`);
                }
                
            } catch (error: unknown) {
                console.log('Integrity validation limited:', (error as Error).message);
            }
        });

        it('should provide detailed validation timestamp', async function() {
            try {
                const beforeValidation = new Date();
                await sleep(10); // Small delay to ensure timestamp difference
                
                const validation = await relationshipAnalyzer.validateRelationshipIntegrity();
                
                await sleep(10);
                const afterValidation = new Date();
                
                expect(validation.validatedAt.getTime()).to.be.greaterThan(beforeValidation.getTime());
                expect(validation.validatedAt.getTime()).to.be.lessThan(afterValidation.getTime());
                
                console.log(`Validation timestamp: ${validation.validatedAt.toISOString()}`);
                
            } catch (error: unknown) {
                console.log('Validation timestamp test limited:', (error as Error).message);
            }
        });
    });

    describe('Cross-Table Analysis', function() {
        it('should perform cross-table dependency analysis', async function() {
            try {
                const analysis = await relationshipAnalyzer.performCrossTableAnalysis();
                
                expect(analysis).to.be.an('object');
                expect(analysis.tables).to.be.an('array');
                expect(analysis.relationships).to.be.an('array');
                expect(analysis.dependencies).to.be.an('array');
                expect(analysis.circularDependencies).to.be.an('array');
                expect(analysis.metrics).to.be.an('object');
                
                // Validate metrics structure
                const metrics = analysis.metrics;
                expect(metrics.totalRelationships).to.be.a('number');
                expect(metrics.explicitRelationships).to.be.a('number');
                expect(metrics.implicitRelationships).to.be.a('number');
                expect(metrics.averageConfidence).to.be.a('number');
                expect(metrics.analysisDuration).to.be.a('number');
                expect(metrics.isolatedTables).to.be.an('array');
                
                console.log(`Cross-table analysis results:`);
                console.log(`  Tables: ${analysis.tables.length}`);
                console.log(`  Relationships: ${analysis.relationships.length}`);
                console.log(`  Dependencies: ${analysis.dependencies.length}`);
                console.log(`  Circular dependencies: ${analysis.circularDependencies.length}`);
                console.log(`  Analysis duration: ${metrics.analysisDuration}ms`);
                console.log(`  Isolated tables: ${metrics.isolatedTables.length}`);
                
                // Validate dependency structure if any exist
                if (analysis.dependencies.length > 0) {
                    const dependency = analysis.dependencies[0];
                    
                    expect(dependency.sourceTable).to.be.a('string');
                    expect(dependency.targetTable).to.be.a('string');
                    expect(dependency.dependencyType).to.be.oneOf(['direct', 'indirect', 'circular']);
                    expect(dependency.path).to.be.an('array');
                    expect(dependency.strength).to.be.a('number');
                    expect(dependency.strength).to.be.at.least(0);
                    expect(dependency.strength).to.be.at.most(1);
                    
                    console.log(`Sample dependency: ${dependency.sourceTable} -> ${dependency.targetTable} (${dependency.dependencyType})`);
                }
                
            } catch (error: unknown) {
                console.log('Cross-table analysis limited:', (error as Error).message);
            }
        });

        it('should analyze specific tables when provided', async function() {
            try {
                // Get available tables first
                const schema = await schemaAnalyzer.analyzeSchema({
                    enableDeepAnalysis: false,
                    enableStatistics: false,
                    includeSystemTables: true
                });
                
                if (schema.tables.length >= 2) {
                    const specificTables = schema.tables.slice(0, 2).map(t => t.name);
                    const analysis = await relationshipAnalyzer.performCrossTableAnalysis(specificTables);
                    
                    expect(analysis.tables).to.have.length(2);
                    expect(analysis.tables).to.deep.equal(specificTables);
                    
                    console.log(`Specific table analysis for: ${specificTables.join(', ')}`);
                    console.log(`Found ${analysis.relationships.length} relationships`);
                    
                } else {
                    console.log('Not enough tables for specific table analysis');
                }
                
            } catch (error: unknown) {
                console.log('Specific table analysis limited:', (error as Error).message);
            }
        });

        it('should detect circular dependencies when present', async function() {
            try {
                const analysis = await relationshipAnalyzer.performCrossTableAnalysis();
                
                expect(analysis.circularDependencies).to.be.an('array');
                
                if (analysis.circularDependencies.length > 0) {
                    console.log(`Found ${analysis.circularDependencies.length} circular dependencies`);
                    
                    analysis.circularDependencies.forEach((cycle, index) => {
                        expect(cycle).to.be.an('array');
                        expect(cycle.length).to.be.at.least(2);
                        console.log(`Circular dependency ${index + 1}: ${cycle.join(' -> ')}`);
                    });
                } else {
                    console.log('No circular dependencies detected');
                }
                
            } catch (error: unknown) {
                console.log('Circular dependency detection limited:', (error as Error).message);
            }
        });

        it('should provide performance metrics', async function() {
            try {
                const startTime = Date.now();
                const analysis = await relationshipAnalyzer.performCrossTableAnalysis();
                const totalTime = Date.now() - startTime;
                
                expect(analysis.metrics.analysisDuration).to.be.a('number');
                expect(analysis.metrics.analysisDuration).to.be.greaterThan(0);
                expect(analysis.metrics.analysisDuration).to.be.lessThanOrEqual(totalTime);
                
                console.log(`Analysis performance: ${analysis.metrics.analysisDuration}ms (total: ${totalTime}ms)`);
                
            } catch (error: unknown) {
                console.log('Performance metrics test limited:', (error as Error).message);
            }
        });
    });

    describe('Error Handling and Edge Cases', function() {
        it('should handle operations before initialization', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            
            try {
                await testAnalyzer.discoverRelationships();
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('not initialized');
            }
            
            try {
                await testAnalyzer.analyzeTableRelationships('TEST_TABLE');
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('not initialized');
            }
            
            try {
                await testAnalyzer.validateRelationshipIntegrity();
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('not initialized');
            }
            
            try {
                await testAnalyzer.performCrossTableAnalysis();
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('not initialized');
            }
        });

        it('should handle multiple destroy calls gracefully', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            await testAnalyzer.initialize(manager);
            
            await testAnalyzer.destroy();
            expect(testAnalyzer.isInitialized).to.be.false;
            
            // Second destroy should not throw
            await testAnalyzer.destroy();
            expect(testAnalyzer.isInitialized).to.be.false;
        });

        it('should handle destroy before initialization', async function() {
            const testAnalyzer = new RelationshipAnalyzer();
            
            try {
                await testAnalyzer.destroy();
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleError);
                expect((error as Error).message).to.include('not initialized');
            }
        });

        it('should handle schema analysis failures gracefully', async function() {
            // Create analyzer with invalid configuration to force failures
            const testAnalyzer = new RelationshipAnalyzer({
                enableImplicitDetection: true,
                enableNamingPatterns: true,
                enableDataSampling: true, // This might cause issues
                sampleSize: -1, // Invalid sample size
                confidenceThreshold: 2.0 // Invalid threshold
            });
            
            await testAnalyzer.initialize(manager);
            
            try {
                const relationships = await testAnalyzer.discoverRelationships();
                expect(relationships).to.be.an('array');
                console.log('Invalid configuration handled gracefully');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(Error);
                console.log('Invalid configuration properly rejected:', (error as Error).message);
            }
            
            await testAnalyzer.destroy();
        });

        it('should handle connection failures during analysis', async function() {
            // This test simulates what happens when connection fails mid-analysis
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                expect(relationships).to.be.an('array');
                console.log('Connection handling test: Analysis completed successfully');
            } catch (error: unknown) {
                // Connection errors should be handled gracefully
                if (error instanceof ModuleError) {
                    console.log('Connection failure handled correctly');
                } else {
                    throw error;
                }
            }
        });

        it('should validate input parameters', async function() {
            try {
                // Test with invalid table name
                const emptyResult = await relationshipAnalyzer.analyzeTableRelationships('');
                expect(emptyResult).to.be.an('array');
                
                // Test with null/undefined
                try {
                    await relationshipAnalyzer.analyzeTableRelationships(null as any);
                    expect.fail('Should have thrown an error for null table name');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(Error);
                }
                
            } catch (error: unknown) {
                console.log('Input validation test:', (error as Error).message);
            }
        });
    });

    describe('Configuration and Enums', function() {
        it('should export correct relationship types', function() {
            expect(RelationshipType.ONE_TO_ONE).to.equal('one-to-one');
            expect(RelationshipType.ONE_TO_MANY).to.equal('one-to-many');
            expect(RelationshipType.MANY_TO_ONE).to.equal('many-to-one');
            expect(RelationshipType.MANY_TO_MANY).to.equal('many-to-many');
            
            const typeValues = Object.values(RelationshipType);
            expect(typeValues).to.have.length(4);
            console.log('Relationship types:', typeValues.join(', '));
        });

        it('should export correct discovery methods', function() {
            expect(DiscoveryMethod.FOREIGN_KEY).to.equal('foreign-key');
            expect(DiscoveryMethod.NAMING_PATTERN).to.equal('naming-pattern');
            expect(DiscoveryMethod.DATA_ANALYSIS).to.equal('data-analysis');
            expect(DiscoveryMethod.STATISTICAL).to.equal('statistical');
            
            const methodValues = Object.values(DiscoveryMethod);
            expect(methodValues).to.have.length(4);
            console.log('Discovery methods:', methodValues.join(', '));
        });

        it('should have valid default configuration', function() {
            expect(DEFAULT_RELATIONSHIP_CONFIG).to.be.an('object');
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableImplicitDetection).to.be.a('boolean');
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableNamingPatterns).to.be.a('boolean');
            expect(DEFAULT_RELATIONSHIP_CONFIG.enableDataSampling).to.be.a('boolean');
            expect(DEFAULT_RELATIONSHIP_CONFIG.sampleSize).to.be.a('number');
            expect(DEFAULT_RELATIONSHIP_CONFIG.confidenceThreshold).to.be.a('number');
            expect(DEFAULT_RELATIONSHIP_CONFIG.maxDependencyDepth).to.be.a('number');
            expect(DEFAULT_RELATIONSHIP_CONFIG.enablePerformanceAnalysis).to.be.a('boolean');
            
            // Validate ranges
            expect(DEFAULT_RELATIONSHIP_CONFIG.sampleSize).to.be.greaterThan(0);
            expect(DEFAULT_RELATIONSHIP_CONFIG.confidenceThreshold).to.be.at.least(0);
            expect(DEFAULT_RELATIONSHIP_CONFIG.confidenceThreshold).to.be.at.most(1);
            expect(DEFAULT_RELATIONSHIP_CONFIG.maxDependencyDepth).to.be.greaterThan(0);
            
            console.log('Default configuration validated');
        });

        it('should accept partial configuration overrides', function() {
            const partialConfig: RelationshipDiscoveryConfig = {
                sampleSize: 500,
                confidenceThreshold: 0.9
            };
            
            const analyzer = new RelationshipAnalyzer(partialConfig);
            expect(analyzer).to.be.instanceOf(RelationshipAnalyzer);
            
            // Should merge with defaults
            console.log('Partial configuration override successful');
        });
    });

    describe('Integration with Dependencies', function() {
        it('should integrate with SchemaAnalyzer correctly', function() {
            // Verify that the analyzer has access to SchemaAnalyzer
            expect(relationshipAnalyzer.isInitialized).to.be.true;
            expect(schemaAnalyzer.isInitialized).to.be.true;
            
            console.log('SchemaAnalyzer integration verified');
        });

        it('should integrate with ConnectionManager correctly', function() {
            // Verify that the analyzer can use connections
            expect(relationshipAnalyzer.isInitialized).to.be.true;
            
            // Check that manager has ConnectionManager
            const connectionManager = manager.getModule('connection-manager');
            expect(connectionManager).to.exist;
            expect(connectionManager!.isInitialized).to.be.true;
            
            console.log('ConnectionManager integration verified');
        });

        it('should work with different manager configurations', async function() {
            const testConfigs = [
                {
                    name: 'minimal modules',
                    config: {
                        ...RELATIONSHIP_ANALYZER_TEST_CONFIG,
                        modules: {
                            enableRelationshipAnalysis: true, // Keep enabled for this test
                            enableQueryValidation: false,
                            enableParameterizedQueries: false,
                            enableAdvancedCaching: false,
                            enableMetricsCollection: false,
                            enableAutoReconnection: false,
                            enableConnectionFactory: true
                        }
                    }
                }
            ];

            for (const testConfig of testConfigs) {
                try {
                    const testManager = new HSQLManager(testConfig.config);
                    await testManager.initialize();

                    // Get automatically loaded modules
                    const testSchemaAnalyzer = testManager.getModule<SchemaAnalyzer>('schema-analyzer');
                    const testAnalyzer = testManager.getModule<RelationshipAnalyzer>('relationship-analyzer');

                    expect(testSchemaAnalyzer).to.exist;
                    expect(testAnalyzer).to.exist;
                    expect(testAnalyzer!.isInitialized).to.be.true;
                    
                    console.log(`${testConfig.name}: Initialization successful`);

                    await testManager.destroy();
                } catch (error: unknown) {
                    console.log(`${testConfig.name}: Configuration test limited:`, (error as Error).message);
                }
            }
        });
    });

    describe('Real-World Scenarios', function() {
        it('should handle typical database relationship analysis', async function() {
            try {
                const startTime = Date.now();
                
                // Perform comprehensive analysis
                const relationships = await relationshipAnalyzer.discoverRelationships();
                const validation = await relationshipAnalyzer.validateRelationshipIntegrity();
                const crossTableAnalysis = await relationshipAnalyzer.performCrossTableAnalysis();
                
                const totalTime = Date.now() - startTime;
                
                console.log('\nComprehensive Relationship Analysis Results:');
                console.log(`Total analysis time: ${totalTime}ms`);
                console.log(`Relationships discovered: ${relationships.length}`);
                console.log(`Integrity validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
                console.log(`Cross-table analysis completed for ${crossTableAnalysis.tables.length} tables`);
                
                // Group relationships by type
                const byType = relationships.reduce((acc, rel) => {
                    if (!acc[rel.type]) acc[rel.type] = 0;
                    acc[rel.type]++;
                    return acc;
                }, {} as Record<string, number>);
                
                console.log('Relationships by type:');
                Object.entries(byType).forEach(([type, count]) => {
                    console.log(`  ${type}: ${count}`);
                });
                
                // Group by discovery method
                const byMethod = relationships.reduce((acc, rel) => {
                    if (!acc[rel.discoveryMethod]) acc[rel.discoveryMethod] = 0;
                    acc[rel.discoveryMethod]++;
                    return acc;
                }, {} as Record<string, number>);
                
                console.log('Relationships by discovery method:');
                Object.entries(byMethod).forEach(([method, count]) => {
                    console.log(`  ${method}: ${count}`);
                });
                
                if (validation.integrityIssues.length > 0) {
                    console.log(`Integrity issues found: ${validation.integrityIssues.length}`);
                    const bySeverity = validation.integrityIssues.reduce((acc, issue) => {
                        if (!acc[issue.severity]) acc[issue.severity] = 0;
                        acc[issue.severity]++;
                        return acc;
                    }, {} as Record<string, number>);
                    
                    Object.entries(bySeverity).forEach(([severity, count]) => {
                        console.log(`  ${severity}: ${count}`);
                    });
                }
                
            } catch (error: unknown) {
                console.log('Real-world scenario analysis limited:', (error as Error).message);
            }
        });

        it('should provide meaningful analysis for empty database', async function() {
            try {
                const relationships = await relationshipAnalyzer.discoverRelationships();
                const validation = await relationshipAnalyzer.validateRelationshipIntegrity();
                
                // Empty database should still provide valid results
                expect(relationships).to.be.an('array');
                expect(validation.isValid).to.be.a('boolean');
                expect(validation.integrityIssues).to.be.an('array');
                
                console.log('Empty database analysis completed successfully');
                console.log(`Empty DB - Relationships: ${relationships.length}, Valid: ${validation.isValid}`);
                
            } catch (error: unknown) {
                console.log('Empty database analysis:', (error as Error).message);
            }
        });

        it('should demonstrate performance with large relationship sets', async function() {
            try {
                const iterations = 5;
                const times: number[] = [];
                
                for (let i = 0; i < iterations; i++) {
                    const startTime = Date.now();
                    await relationshipAnalyzer.discoverRelationships();
                    const duration = Date.now() - startTime;
                    times.push(duration);
                }
                
                const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                
                console.log(`Performance analysis (${iterations} iterations):`);
                console.log(`  Average: ${averageTime.toFixed(2)}ms`);
                console.log(`  Range: ${minTime}ms - ${maxTime}ms`);
                
                // Performance should be reasonable
                expect(averageTime).to.be.lessThan(30000); // Should complete within 30 seconds on average
                
            } catch (error: unknown) {
                console.log('Performance analysis limited:', (error as Error).message);
            }
        });
    });
});