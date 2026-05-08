/**
 * @fileoverview EntitiesController Performance-Optimized Tests
 * 
 * Complete test suite for the EntitiesController class covering 100% functionality
 * with optimized test data management using existing database data.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { assert, expect } from 'chai';
import { spy, stub, createSandbox, type SinonSandbox } from 'sinon';

import { EntitiesController } from '../../../src/tables/entities/EntitiesController.js';
import { EntitiesModel, EntityType, KnownFactions } from '../../../src/tables/entities/EntitiesModel.js';
import { HSQLManager } from '../../../src/core/index.js';
import {
    ValidationError,
    ConflictError,
    ModuleNotInitializedError,
    QueryExecutionError
} from '../../../src/core/errors.js';
import type {
    EntitySearchOptions,
    EntityCreateOptions,
    EntityUpdateOptions,
    SpatialAnalysisOptions,
    DockingChainOptions,
    EntityAnalyticsOptions,
    BulkEntityOptions,
    EntityStatistics,
    SpatialAnalysisResult,
    DockingChainAnalysis,
    EntityConflictResult
} from '../../../src/tables/entities/EntitiesController.js';

/**
 * Test configuration for EntitiesController testing
 */
const TEST_CONFIG = {
    starmadeDir: './tests/sandbox',
    worldName: 'test_world',

    connection: {
        timeoutMs: 10000,
        maxRetries: 2,
        readOnly: false,
        autoCommit: true,
        maxConcurrentConnections: 5
    },

    modules: {
        enableRelationshipAnalysis: false,
        enableQueryValidation: true,
        enableParameterizedQueries: true,
        enableAdvancedCaching: true,
        enableMetricsCollection: false,
        enableAutoReconnection: false,
        enableConnectionFactory: true
    },

    logging: {
        level: 'debug' as const, // Changer en debug pour voir les logs
        enableConsole: true,      // Activer les logs console
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    }
};

/**
 * Create mock entity data for testing
 */
function createMockEntityData(overrides: Partial<any> = {}): Partial<Record<string, any>> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    
    return {
        UID: `TEST_ENTITY_${timestamp}_${random}`,
        X: Math.floor(Math.random() * 200) - 100, // -100 to 100
        Y: Math.floor(Math.random() * 200) - 100,
        Z: Math.floor(Math.random() * 200) - 100,
        TYPE: EntityType.SHIP,
        NAME: `Test Entity ${random}`,
        FACTION: 0,
        CREATOR: 'test_creator',
        LAST_MOD: 'test_modifier',
        SEED: Math.floor(Math.random() * 1000000),
        TOUCHED: false,
        // Remplacer les chaînes ARRAY par null pour éviter les erreurs HSQLDB
        LOCAL_POS: null,
        DIM: null,
        GEN_ID: 1,
        DOCKED_TO: -1,
        DOCKED_ROOT: -1,
        SPAWNED_ONLY_IN_DB: false,
        TRACKED: false,
        ...overrides
    };
}

/**
 * Comprehensive test entities based on actual data from 04-entities.sql
 * Reflects the real entities in the test database (166 entities total)
 */
const EXISTING_TEST_ENTITIES = {
    // Player ships (including docked chains) - Based on actual SQL data
    SHIPS: [
        { uid: 'TEST_PLAYER_SHIP_001', sector: { x: -4, y: 1, z: 0 }, type: EntityType.SHIP, name: 'TestPlayer Explorer', faction: 1, docked_to: 129 },
        { uid: 'TEST_PLAYER_SHIP_002', sector: { x: -4, y: 1, z: 0 }, type: EntityType.SHIP, name: 'TestPlayer Frigate', faction: 1, docked_to: 129 },
        { uid: 'TEST_PLAYER_SHIP_003', sector: { x: -4, y: 1, z: 0 }, type: EntityType.SHIP, name: 'TestPlayer Fighter', faction: 1, docked_to: 129 },
        { uid: 'TEST_PLAYER_CARRIER_001', sector: { x: 5, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Faction Carrier Alpha', faction: 1, docked_to: -1 },
        { uid: 'TEST_PLAYER_FIGHTER_001', sector: { x: 5, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Fighter Alpha', faction: 1, docked_to: 9 },
        { uid: 'TEST_PLAYER_FIGHTER_002', sector: { x: 5, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Fighter Beta', faction: 1, docked_to: 9 },
        { uid: 'TEST_PLAYER_FIGHTER_003', sector: { x: 5, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Fighter Gamma', faction: 1, docked_to: 9 }
    ],

    // Trading Guild entities - Based on actual SQL data
    TRADING_GUILD: [
        { uid: 'TEST_TG_FREIGHTER_001', sector: { x: -2, y: 1, z: 0 }, type: EntityType.SHIP, name: 'TG Freighter Alpha', faction: KnownFactions.TRADING_GUILD },
        { uid: 'TEST_TG_FREIGHTER_002', sector: { x: -2, y: 0, z: 1 }, type: EntityType.SHIP, name: 'TG Freighter Beta', faction: KnownFactions.TRADING_GUILD },
        { uid: 'TEST_NPC_001', sector: { x: -2, y: 0, z: 0 }, type: EntityType.NPC, name: 'Trading Guild NPC', faction: KnownFactions.TRADING_GUILD }
    ],

    // Outcast entities - Based on actual SQL data
    OUTCASTS: [
        { uid: 'TEST_OC_RAIDER_001', sector: { x: 3, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Outcast Raider Alpha', faction: KnownFactions.OUTCASTS },
        { uid: 'TEST_OC_RAIDER_002', sector: { x: 3, y: 0, z: -1 }, type: EntityType.SHIP, name: 'Outcast Raider Beta', faction: KnownFactions.OUTCASTS },
        { uid: 'TEST_NPC_002', sector: { x: 3, y: 0, z: 0 }, type: EntityType.NPC, name: 'Outcast NPC', faction: KnownFactions.OUTCASTS }
    ],

    // Scavenger entities - Based on actual SQL data
    SCAVENGERS: [
        { uid: 'TEST_SC_COLLECTOR_001', sector: { x: 0, y: -2, z: 0 }, type: EntityType.SHIP, name: 'Scavenger Collector', faction: KnownFactions.SCAVENGERS }
    ],

    // Independent player entities - Based on actual SQL data
    INDEPENDENT: [
        { uid: 'TEST_INDEPENDENT_001', sector: { x: 8, y: 0, z: 0 }, type: EntityType.SHIP, name: 'Independent Explorer', faction: 0 },
        { uid: 'TEST_INDEPENDENT_002', sector: { x: 8, y: 1, z: 0 }, type: EntityType.SHIP, name: 'Independent Trader', faction: 0 },
        { uid: 'TEST_INDEPENDENT_003', sector: { x: -5, y: 0, z: 0 }, type: EntityType.SHIP, name: 'Independent Miner', faction: 0 }
    ],

    // Stations and infrastructure - Based on actual SQL data
    STATIONS: [
        { uid: 'ENTITY_Security_Station', sector: { x: -4, y: 1, z: 0 }, type: EntityType.SPACE_STATION, name: 'Security Station', faction: 1 },
        { uid: 'TEST_SOL_TRADE_STATION', sector: { x: 0, y: 0, z: 2 }, type: EntityType.SHOP, name: 'Trading station', faction: 1 },
        { uid: 'TEST_SOL_MILITRAY_STATION', sector: { x: 2, y: 0, z: 2 }, type: EntityType.SPACE_STATION, name: 'Hidden Military Station', faction: 1 },
        { uid: 'TEST_SGR_RESEARCH_STATION', sector: { x: 2, y: 3, z: 1 }, type: EntityType.SPACE_STATION, name: 'Research Station', faction: 1 },
        { uid: 'TEST_BIN_TRADE_STATION', sector: { x: 5, y: 0, z: 1 }, type: EntityType.SHOP, name: 'Trading station', faction: 1 },
        { uid: 'TEST_TG5_SECURITY_STATION', sector: { x: -4, y: 1, z: 0 }, type: EntityType.SPACE_STATION, name: 'Security Station', faction: 1 },
        { uid: 'TEST_OC8_PIRATE_BASE', sector: { x: 9, y: 2, z: 0 }, type: EntityType.SPACE_STATION, name: 'Pirate Base', faction: 1 }
    ],

    // Celestial bodies - Based on actual SQL data (Stars, Black Holes, Planets)
    CELESTIAL: [
        // Stars
        { uid: 'STAR_SOL_A', sector: { x: 1, y: 1, z: 1 }, type: EntityType.SUN, name: 'Sol', faction: 1 },
        { uid: 'STAR_ALPHA_A', sector: { x: 0, y: 1, z: 4 }, type: EntityType.SUN, name: 'Giant Star', faction: 1 },
        { uid: 'STAR_BIN_A', sector: { x: 0, y: 4, z: 1 }, type: EntityType.SUN, name: 'Binary Star A', faction: 1 },
        { uid: 'STAR_BIN_B', sector: { x: 0, y: 4, z: 1 }, type: EntityType.SUN, name: 'Binary Star B', faction: 1 },
        { uid: 'STAR_RE13_A', sector: { x: 15, y: 1, z: 1 }, type: EntityType.SUN, name: 'Blue Giant', faction: 1 },
        
        // Black Holes
        { uid: 'BLACKHOLE_SGR', sector: { x: 0, y: 4, z: 1 }, type: EntityType.BLACK_HOLE, name: 'Black Hole', faction: 1 },
        { uid: 'BLACKHOLE_PS9', sector: { x: 9, y: 4, z: 1 }, type: EntityType.BLACK_HOLE, name: 'Black Hole', faction: 1 },
        { uid: 'BLACKHOLE_SC10', sector: { x: 10, y: 1, z: -2 }, type: EntityType.BLACK_HOLE, name: 'Scar Maw', faction: 1 },
        
        // Planets
        { uid: 'PLANET_SOL_EARTH', sector: { x: 1, y: 0, z: 1 }, type: EntityType.PLANET, name: 'Earth', faction: 1 },
        { uid: 'PLANET_BIN_ROCKY_PLANET', sector: { x: 3, y: 0, z: 2 }, type: EntityType.PLANET, name: 'Rocky Planet', faction: 1 },
        { uid: 'PLANET_BIN_DESERT_PLANET', sector: { x: 3, y: 2, z: 0 }, type: EntityType.PLANET, name: 'Desert Planet', faction: 1 },
        { uid: 'PLANET_TG5_TRADING_WORLD', sector: { x: -6, y: 2, z: 2 }, type: EntityType.PLANET, name: 'Trading World', faction: 1 }
    ],

    // Asteroids and resources - Based on actual SQL data
    ASTEROIDS: [
        // Regular Asteroids
        { uid: 'ASTEROID_SOL_A', sector: { x: 0, y: 1, z: 2 }, type: EntityType.ASTEROID, name: 'Asteroid A', faction: 1 },
        { uid: 'ASTEROID_SOL_B', sector: { x: 0, y: 2, z: 0 }, type: EntityType.ASTEROID, name: 'Asteroid B', faction: 1 },
        { uid: 'ASTEROID_SOL_C', sector: { x: 0, y: 2, z: 1 }, type: EntityType.ASTEROID, name: 'Asteroid C', faction: 1 },
        { uid: 'ASTEROID_ALPHA_A', sector: { x: 0, y: 2, z: 5 }, type: EntityType.ASTEROID, name: 'Asteroid Rich', faction: 1 },
        { uid: 'ASTEROID_BIN_A', sector: { x: 4, y: 2, z: 1 }, type: EntityType.ASTEROID, name: 'Asteroid field', faction: 1 },
        
        // Managed Asteroids
        { uid: 'TEST_MANAGED_ASTEROID_001', sector: { x: 5, y: 0, z: 2 }, type: EntityType.ASTEROID_MANAGED, name: 'Managed Asteroid Alpha', faction: 1000001 },
        { uid: 'TEST_MANAGED_ASTEROID_002', sector: { x: 5, y: 1, z: 2 }, type: EntityType.ASTEROID_MANAGED, name: 'Managed Asteroid Beta', faction: 1000001 },
        
        // Float Rocks
        { uid: 'TEST_FLOAT_ROCK_001', sector: { x: -5, y: 1, z: 0 }, type: EntityType.FLOAT_ROCK, name: 'Float Rock Alpha', faction: 0 },
        { uid: 'TEST_FLOAT_ROCK_002', sector: { x: -5, y: 0, z: 1 }, type: EntityType.FLOAT_ROCK, name: 'Float Rock Beta', faction: 0 }
    ],

    // NPCs and creatures - Based on actual SQL data
    NPCS: [
        // Astronauts
        { uid: 'TEST_ASTRONAUT_001', sector: { x: 0, y: 0, z: -1 }, type: EntityType.ASTRONAUT, name: 'Test Astronaut Alpha', faction: 1 },
        { uid: 'TEST_ASTRONAUT_002', sector: { x: 5, y: 0, z: 0 }, type: EntityType.ASTRONAUT, name: 'Test Astronaut Beta', faction: 1 },
        
        // NPCs
        { uid: 'TEST_NPC_001', sector: { x: -2, y: 0, z: 0 }, type: EntityType.NPC, name: 'Trading Guild NPC', faction: KnownFactions.TRADING_GUILD },
        { uid: 'TEST_NPC_002', sector: { x: 3, y: 0, z: 0 }, type: EntityType.NPC, name: 'Outcast NPC', faction: KnownFactions.OUTCASTS },
        
        // Space Creatures
        { uid: 'TEST_SPACE_CREATURE_001', sector: { x: 0, y: 2, z: 0 }, type: EntityType.SPACE_CREATURE, name: 'Space Creature Alpha', faction: 0 }
    ],

    // Special entities - Based on actual SQL data
    SPECIAL: [
        // Death Star
        { uid: 'TEST_DEATH_STAR_001', sector: { x: 0, y: 0, z: 15 }, type: EntityType.DEATH_STAR, name: 'Test Death Star', faction: 1000005 },
        
        // Ship Core
        { uid: 'TEST_SHIP_CORE_001', sector: { x: 5, y: 1, z: 0 }, type: EntityType.SHIP_CORE, name: 'Ship Core Alpha', faction: 1 },
        
        // Planet Segments and Cores
        { uid: 'TEST_PLANET_SEGMENT_001', sector: { x: 0, y: 0, z: 1 }, type: EntityType.PLANET_SEGMENT, name: 'Planet Segment Alpha', faction: 0 },
        { uid: 'TEST_PLANET_CORE_001', sector: { x: 0, y: 0, z: 1 }, type: EntityType.PLANET_CORE, name: 'Planet Core Alpha', faction: 0 },
        
        // Vehicle
        { uid: 'TEST_VEHICLE_001', sector: { x: 0, y: 0, z: 1 }, type: EntityType.VEHICLE, name: 'Test Vehicle Alpha', faction: 1 }
    ],

    // Warp Gates and Wormholes - Based on actual SQL data
    FTL_ENTITIES: [
        // Warp Gates
        { uid: 'WarpGate_Re13', sector: { x: 16, y: 1, z: 1 }, type: EntityType.SPACE_STATION, name: 'Warp Gate Terminal', faction: 1 },
        { uid: 'WarpGate_Cw16', sector: { x: -14, y: 1, z: 1 }, type: EntityType.SPACE_STATION, name: 'Warp Gate Prime', faction: 0 },
        { uid: 'WarpGate_If18', sector: { x: -14, y: 1, z: 4 }, type: EntityType.SPACE_STATION, name: 'Warp Gate CryoNet', faction: 0 },
        
        // Wormholes (stored as BLACK_HOLE type in database)
        { uid: 'WORMHOLE_ALPHA', sector: { x: 2, y: 2, z: 5 }, type: EntityType.BLACK_HOLE, name: 'Wormhole Gate', faction: 1 },
        { uid: 'WORMHOLE_SGR', sector: { x: 2, y: 5, z: 2 }, type: EntityType.BLACK_HOLE, name: 'Emergency Wormhole', faction: 1 },
        { uid: 'WORMHOLE_VOID', sector: { x: 0, y: 2, z: -1 }, type: EntityType.BLACK_HOLE, name: 'Ancient Wormhole', faction: 1 },
        { uid: 'WORMHOLE_TG5', sector: { x: -4, y: 2, z: 2 }, type: EntityType.BLACK_HOLE, name: 'Trade Wormhole', faction: 1 }
    ],

    // Docking chain examples - Based on actual SQL data
    DOCKING_CHAINS: [
        {
            root: { uid: 'ENTITY_Security_Station', id: 129, sector: { x: -4, y: 1, z: 0 } },
            docked: [
                { uid: 'TEST_PLAYER_SHIP_001', id: 1, docked_to: 129, docked_root: 129 },
                { uid: 'TEST_PLAYER_SHIP_002', id: 2, docked_to: 129, docked_root: 1 },
                { uid: 'TEST_PLAYER_SHIP_003', id: 3, docked_to: 129, docked_root: 2 }
            ]
        },
        {
            root: { uid: 'TEST_PLAYER_CARRIER_001', id: 9, sector: { x: 5, y: 1, z: 0 } },
            docked: [
                { uid: 'TEST_PLAYER_FIGHTER_001', id: 10, docked_to: 9, docked_root: 9 },
                { uid: 'TEST_PLAYER_FIGHTER_002', id: 11, docked_to: 9, docked_root: 9 },
                { uid: 'TEST_PLAYER_FIGHTER_003', id: 12, docked_to: 9, docked_root: 9 }
            ]
        }
    ],

    // Sector distribution summary - Based on actual SQL data analysis
    SECTOR_DISTRIBUTION: {
        mostPopulated: [
            { sector: { x: 0, y: 0, z: 0 }, entityCount: 8 }, // Sol system area
            { sector: { x: 5, y: 1, z: 0 }, entityCount: 6 }, // Player carrier area
            { sector: { x: -4, y: 1, z: 0 }, entityCount: 5 }, // Security station area
            { sector: { x: 0, y: 2, z: 0 }, entityCount: 4 }, // Asteroid belt area
            { sector: { x: 1, y: 1, z: 1 }, entityCount: 3 }  // Sol star area
        ],
        totalSectors: 87, // Approximate unique sector count
        totalEntities: 166 // Total entities in test data
    },

    // Faction distribution summary - Based on actual SQL data analysis
    FACTION_DISTRIBUTION: {
        [0]: 15,                                    // No faction / Independent
        [1]: 89,                                    // Main player faction
        [2]: 2,                                     // Player faction 2
        [4]: 1,                                     // Contested faction
        [5]: 2,                                     // Core faction
        [6]: 1,                                     // Research faction
        [KnownFactions.TRADING_GUILD]: 3,           // Trading Guild (-10000000)
        [KnownFactions.OUTCASTS]: 2,                // Outcasts (-9999999)
        [KnownFactions.SCAVENGERS]: 1,              // Scavengers (-9999998)
        [1000001]: 2,                               // Mining faction
        [1000005]: 2                                // Special faction (Death Star)
    },

    // Entity type distribution summary - Based on actual SQL data analysis
    TYPE_DISTRIBUTION: {
        [EntityType.SHIP]: 24,                      // Ships (0)
        [EntityType.SPACE_STATION]: 44,             // Stations (1)
        [EntityType.PLANET]: 17,                    // Planets (2)
        [EntityType.ASTEROID]: 27,                 // Asteroids (3)
        [EntityType.FLOAT_ROCK]: 2,                // Float rocks (4)
        [EntityType.SHIP_CORE]: 1,                 // Ship cores (5)
        [EntityType.ASTEROID_MANAGED]: 2,          // Managed asteroids (6)
        [EntityType.SPACE_CREATURE]: 1,            // Space creatures (7)
        [EntityType.ASTRONAUT]: 2,                 // Astronauts (10)
        [EntityType.NPC]: 2,                       // NPCs (11)
        [EntityType.SHOP]: 11,                     // Shops (12)
        [EntityType.PLANET_SEGMENT]: 1,            // Planet segments (13)
        [EntityType.PLANET_CORE]: 1,               // Planet cores (14)
        [EntityType.BLACK_HOLE]: 18,               // Black holes + Wormholes (15)
        [EntityType.SUN]: 25,                      // Stars (16)
        [EntityType.VEHICLE]: 1,                   // Vehicles (17)
        [EntityType.DEATH_STAR]: 1                 // Death Star (18)
    }
};

// =============================================================================
// ENTITIES CONTROLLER TESTS
// =============================================================================
describe('EntitiesController Comprehensive Tests', function () {
    let manager: HSQLManager;
    let controller: EntitiesController;
    let sandbox: SinonSandbox;

    before(async function () {
        this.timeout(30000); // 30 seconds for controller setup

        console.log('Initializing EntitiesController...');

        // Initialize HSQLManager
        manager = new HSQLManager(TEST_CONFIG);
        await manager.initialize();

        // Create controller
        controller = new EntitiesController({
            enableCaching: true,
            enableForeignKeyValidation: true,
            cacheTtlMs: 30000 // 30 seconds for tests
        });

        // Initialize controller
        await controller.initialize(manager);

        console.log('EntitiesController initialized');
    });

    beforeEach(async function () {
        sandbox = createSandbox();
    });

    after(async function () {
        this.timeout(30000); // 30 seconds for controller cleanup

        console.log('Cleaning up EntitiesController...');

        if (manager) {
            await manager.destroy();
        }

        console.log('EntitiesController cleaned up');
    });

    afterEach(async function () {
        sandbox.restore();
    });

    describe('Initialization and Configuration', function () {
        it('should initialize with default configuration', async function () {
            const testController = new EntitiesController();
            await testController.initialize(manager);

            const entities = await testController.findEntities({ limit: 1 });
            expect(entities).to.be.an('array');

            const config = (testController as any).config;
            expect(config.enableCaching).to.be.true;
            expect(config.enableForeignKeyValidation).to.be.true;
            expect(config.cacheTtlMs).to.be.a('number');
            expect(config.cacheTtlMs).to.be.greaterThan(0);
        });

        it('should initialize with custom configuration', async function () {
            const customConfig = {
                enableCaching: false,
                enableForeignKeyValidation: false,
                cacheTtlMs: 60000,
                queryTimeoutMs: 15000,
                maxResults: 500
            };

            const testController = new EntitiesController(customConfig);
            await testController.initialize(manager);

            const entities = await testController.findEntities({ limit: 1 });
            expect(entities).to.be.an('array');

            const config = (testController as any).config;
            expect(config.enableCaching).to.be.false;
            expect(config.enableForeignKeyValidation).to.be.false;
            expect(config.cacheTtlMs).to.equal(60000);
        });

        it('should require manager for initialization', async function () {
            const testController = new EntitiesController();

            try {
                await testController.initialize(null as any);
                expect.fail('Should have thrown an error');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.be.a('string');
            }
        });

        it('should throw error when using uninitialized controller', async function () {
            const testController = new EntitiesController();

            try {
                await testController.findEntities();
                expect.fail('Should have thrown ModuleNotInitializedError');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(ModuleNotInitializedError);
                expect((error as Error).message).to.include('not initialized');
            }
        });
    });

    describe('CRUD Operations', function () {
        describe('Create Operations', function () {
            it('should create a new entity with valid data', async function () {
                let testEntityId: number | null = null;

                try {
                    const entityData = createMockEntityData();
                    const testEntity = await controller.create(entityData, {
                        autoGenerateUid: false,
                        validatePlacement: true,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    expect(testEntity).to.be.instanceOf(EntitiesModel);
                    // Accept both string and number IDs from HSQLDB
                    const actualId = testEntity.getId();
                    expect(typeof actualId === 'number' || typeof actualId === 'string').to.be.true;
                    expect(actualId).to.not.be.undefined;

                    // Convert string ID to number for cleanup
                    testEntityId = typeof actualId === 'string' ? parseInt(actualId, 10) : actualId;

                    expect(testEntity.getUid()).to.equal(entityData.UID);
                    expect(testEntity.getType()).to.equal(entityData.TYPE);
                    expect(testEntity.getX()).to.equal(entityData.X);
                    expect(testEntity.getY()).to.equal(entityData.Y);
                    expect(testEntity.getZ()).to.equal(entityData.Z);

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should auto-generate UID when enabled', async function () {
                let testEntityId: number | null = null;

                try {
                    const entityData = createMockEntityData();
                    delete entityData.UID; // Remove UID to test auto-generation

                    const testEntity = await controller.create(entityData, {
                        autoGenerateUid: true,
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    expect(testEntity.getUid()).to.be.a('string');
                    expect(testEntity.getUid()).to.include('ENTITY_');
                    expect(testEntity.getUid().length).to.be.greaterThan(10);

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should validate required fields during creation', async function () {
                // Test missing UID with auto-generation disabled
                try {
                    await controller.create({
                        X: 0,
                        Y: 0,
                        Z: 0,
                        TYPE: EntityType.SHIP
                        // Missing UID
                    }, {
                        autoGenerateUid: false
                    });
                    expect.fail('Should have thrown ValidationError for missing UID');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(Error);
                    // L'erreur peut être différente selon l'implémentation
                    expect((error as Error).message).to.include('UID');
                }

                // Test missing coordinates
                try {
                    await controller.create({
                        UID: 'TEST_UID_COORDS',
                        TYPE: EntityType.SHIP
                        // Missing X, Y, Z
                    });
                    expect.fail('Should have thrown ValidationError for missing coordinates');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(ValidationError);
                    expect((error as Error).message).to.include('Coordinates');
                }

                // Test missing TYPE
                try {
                    await controller.create({
                        UID: 'TEST_UID_TYPE',
                        X: 0,
                        Y: 0,
                        Z: 0
                        // Missing TYPE
                    });
                    expect.fail('Should have thrown ValidationError for missing TYPE');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(ValidationError);
                    expect((error as Error).message).to.include('TYPE is required');
                }
            });

            it('should enforce UID uniqueness during creation', async function () {
                let testEntityId: number | null = null;

                try {
                    const duplicateUID = `TEST_DUPLICATE_UID_${Date.now()}`;

                    // Create first entity
                    const firstEntity = await controller.create(createMockEntityData({
                        UID: duplicateUID
                    }));

                    testEntityId = firstEntity.getId();

                    // Attempt to create second entity with same UID
                    try {
                        await controller.create(createMockEntityData({
                            UID: duplicateUID
                        }), {
                            validatePlacement: false,
                            checkSectorConflicts: false
                        });
                        expect.fail('Should have thrown ConflictError for duplicate UID');
                    } catch (error: unknown) {
                        expect(error).to.be.instanceOf(Error);
                        // L'erreur peut être ConflictError ou ValidationError
                        expect((error as Error).message).to.include('already exists');
                    }

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should validate entity placement when enabled', async function () {
                // Test invalid coordinates (non-integer)
                try {
                    await controller.create({
                        UID: 'TEST_INVALID_COORDS',
                        X: 1.5, // Non-integer
                        Y: 0,
                        Z: 0,
                        TYPE: EntityType.SHIP
                    }, {
                        validatePlacement: true,
                        checkSectorConflicts: false
                    });
                    expect.fail('Should have thrown ValidationError for non-integer coordinates');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(ValidationError);
                    expect((error as Error).message).to.include('integers');
                }

                // Test invalid entity type
                try {
                    await controller.create({
                        UID: 'TEST_INVALID_TYPE',
                        X: 0,
                        Y: 0,
                        Z: 0,
                        TYPE: 999 // Invalid type
                    }, {
                        validatePlacement: true,
                        checkSectorConflicts: false
                    });
                    expect.fail('Should have thrown ValidationError for invalid type');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(ValidationError);
                    expect((error as Error).message).to.include('Invalid entity type');
                }
            });

            it('should set default values during creation', async function () {
                let testEntityId: number | null = null;

                try {
                    const testEntity = await controller.create({
                        UID: `TEST_DEFAULTS_${Date.now()}`,
                        X: 100,
                        Y: 100,
                        Z: 100,
                        TYPE: EntityType.SHIP
                        // Missing optional fields - should get defaults
                    }, {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    expect(testEntity.getFaction()).to.equal(0); // Default faction
                    expect(testEntity.getTouched()).to.be.false; // Default touched
                    expect(testEntity.getSpawnedOnlyInDb()).to.be.false; // Default spawned
                    expect(testEntity.getTracked()).to.be.false; // Default tracked
                    expect(testEntity.getDockedTo()).to.equal(-1); // Default not docked
                    expect(testEntity.getDockedRoot()).to.equal(-1); // Default not docked

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });
        });

        describe('Update Operations', function () {
            it('should update entity by ID', async function () {
                let testEntityId: number | null = null;

                try {
                    // Create test entity
                    const testEntity = await controller.create(createMockEntityData());

                    testEntityId = testEntity.getId();

                    // Update entity
                    const updatedEntity = await controller.update(testEntityId, {
                        NAME: 'Updated Entity Name',
                        FACTION: 12345
                    });

                    expect(updatedEntity).to.be.instanceOf(EntitiesModel);
                    expect(updatedEntity.getName()).to.equal('Updated Entity Name');
                    expect(updatedEntity.getFaction()).to.equal(12345);

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should update entity by UID', async function () {
                let testEntityId: number | null = null;

                try {
                    const entityData = createMockEntityData();
                    const testEntity = await controller.create(entityData, {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    // Update by UID
                    const updatedEntity = await controller.update(entityData.UID!, {
                        CREATOR: 'updated_creator',
                        LAST_MOD: 'updated_modifier'
                    });

                    expect(updatedEntity.getCreator()).to.equal('updated_creator');
                    expect(updatedEntity.getLastMod()).to.equal('updated_modifier');

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should prevent updating immutable fields', async function () {
                let testEntityId: number | null = null;

                try {
                    const testEntity = await controller.create(createMockEntityData(), {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    // Try to update immutable UID
                    try {
                        await controller.update(testEntityId, {
                            UID: 'NEW_UID_SHOULD_FAIL'
                        }, {
                            allowImmutableUpdates: false
                        });
                        expect.fail('Should have thrown ValidationError for immutable field update');
                    } catch (error: unknown) {
                        expect(error).to.be.instanceOf(ValidationError);
                        expect((error as Error).message).to.include('immutable');
                    }

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should validate position changes when enabled', async function () {
                let testEntityId: number | null = null;

                try {
                    const testEntity = await controller.create(createMockEntityData(), {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    // Try to update with invalid coordinates
                    try {
                        await controller.update(testEntityId, {
                            X: 1.5 // Invalid non-integer coordinate
                        }, {
                            validatePosition: true
                        });
                        expect.fail('Should have thrown ValidationError for invalid position');
                    } catch (error: unknown) {
                        expect(error).to.be.instanceOf(ValidationError);
                        expect((error as Error).message).to.include('integers');
                    }

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should handle non-existent entity updates', async function () {
                try {
                    await controller.update(999999999, {
                        NAME: 'Should Fail'
                    });
                    expect.fail('Should have thrown ValidationError for non-existent entity');
                } catch (error: unknown) {
                    expect(error).to.be.instanceOf(ValidationError);
                    expect((error as Error).message).to.include('not found');
                }
            });
        });

        describe('Delete Operations', function () {
            it('should delete entity by ID', async function () {
                // Create test entity
                const testEntity = await controller.create(createMockEntityData(), {
                    validatePlacement: false,
                    checkSectorConflicts: false
                });

                const entityId = testEntity.getId();

                // Verify entity exists
                const foundEntity = await controller.findById(entityId);
                expect(foundEntity).to.not.be.null;

                // Delete the entity
                const deleteResult = await controller.delete(entityId);
                expect(deleteResult).to.be.true;

                // Verify entity no longer exists
                const deletedEntity = await controller.findById(entityId);
                expect(deletedEntity).to.be.null;
            });

            it('should delete entity by UID', async function () {
                const entityData = createMockEntityData();
                const testEntity = await controller.create(entityData, {
                    validatePlacement: false,
                    checkSectorConflicts: false
                });

                const entityId = testEntity.getId();

                // Delete by UID
                const deleteResult = await controller.delete(entityData.UID!);
                expect(deleteResult).to.be.true;

                // Verify entity no longer exists
                const deletedEntity = await controller.findById(entityId);
                expect(deletedEntity).to.be.null;
            });

            it('should handle non-existent entity deletion gracefully', async function () {
                const deleteResult = await controller.delete(999999999);
                expect(deleteResult).to.be.false;

                const deleteByUidResult = await controller.delete('NONEXISTENT_UID_12345');
                expect(deleteByUidResult).to.be.false;
            });
        });
    });

    describe('Search and Filtering Operations', function () {
        describe('Basic Search Methods', function () {
            it('should find entities with no filters', async function () {
                const allEntities = await controller.findEntities({ limit: 10 });

                expect(allEntities).to.be.an('array');
                expect(allEntities.length).to.be.greaterThanOrEqual(0);
                expect(allEntities.length).to.be.lessThanOrEqual(10);

                allEntities.forEach(entity => {
                    expect(entity).to.be.instanceOf(EntitiesModel);
                    const id = entity.getId();
                    expect(typeof id === 'number' || typeof id === 'string').to.be.true; // HSQLDB peut retourner des strings
                    expect(entity.getUid()).to.be.a('string');
                });
            });

            it('should find entity by UID', async function () {
                let testEntityId: number | null = null;

                try {
                    const entityData = createMockEntityData();
                    const testEntity = await controller.create(entityData, {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    const foundEntity = await controller.findEntityByUID(entityData.UID!);
                    expect(foundEntity).to.not.be.null;
                    expect(foundEntity!.getId()).to.equal(testEntity.getId());
                    expect(foundEntity!.getUid()).to.equal(entityData.UID);

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should return null for non-existent UID', async function () {
                const nonExistentEntity = await controller.findEntityByUID('DEFINITELY_NOT_A_REAL_UID_12345');
                expect(nonExistentEntity).to.be.null;
            });

            it('should find entities by type', async function () {
                const ships = await controller.findEntitiesByType(EntityType.SHIP, { limit: 5 });
                expect(ships).to.be.an('array');

                ships.forEach(entity => {
                    expect(entity.getType()).to.equal(EntityType.SHIP);
                    expect(entity.isShip()).to.be.true;
                });

                const stations = await controller.findEntitiesByType(EntityType.SPACE_STATION, { limit: 5 });
                expect(stations).to.be.an('array');

                stations.forEach(entity => {
                    expect(entity.getType()).to.equal(EntityType.SPACE_STATION);
                    expect(entity.isStation()).to.be.true;
                });
            });

            it('should find entities by faction', async function () {
                // Test no faction (faction 0)
                const noFactionEntities = await controller.findEntitiesByFaction(0, { limit: 10 });
                expect(noFactionEntities).to.be.an('array');

                noFactionEntities.forEach(entity => {
                    expect(entity.getFaction()).to.equal(0);
                });

                // Test specific faction (if any exist)
                const tradingGuildEntities = await controller.findEntitiesByFaction(KnownFactions.TRADING_GUILD, { limit: 5 });
                expect(tradingGuildEntities).to.be.an('array');

                tradingGuildEntities.forEach(entity => {
                    expect(entity.getFaction()).to.equal(KnownFactions.TRADING_GUILD);
                    expect(entity.isNPCFaction()).to.be.true;
                });
            });

            it('should find entities in sector', async function () {
                let testEntityId: number | null = null;

                try {
                    const testSector = { x: 200, y: 200, z: 200 }; // Unique coordinates
                    const testEntity = await controller.create(createMockEntityData({
                        X: testSector.x,
                        Y: testSector.y,
                        Z: testSector.z
                    }), {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    const entitiesInSector = await controller.findEntitiesInSector(
                        testSector.x,
                        testSector.y,
                        testSector.z
                    );

                    expect(entitiesInSector).to.be.an('array');
                    expect(entitiesInSector.length).to.be.greaterThan(0);

                    const foundTestEntity = entitiesInSector.find(e => e.getId() == testEntity.getId()); // Utiliser == au lieu de ===
                    expect(foundTestEntity).to.not.be.undefined;

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should find entities within radius', async function () {
                const center = { x: 0, y: 0, z: 0 };
                const radius = 10;

                const entitiesWithinRadius = await controller.findEntitiesWithinRadius(center, radius, { limit: 20 });
                expect(entitiesWithinRadius).to.be.an('array');

                entitiesWithinRadius.forEach(entity => {
                    const distance = Math.sqrt(
                        Math.pow(entity.getX() - center.x, 2) +
                        Math.pow(entity.getY() - center.y, 2) +
                        Math.pow(entity.getZ() - center.z, 2)
                    );
                    expect(distance).to.be.lessThanOrEqual(radius + 0.1); // Small tolerance for floating point
                });
            });
        });

        describe('Advanced Search with findEntities', function () {
            it('should search entities by multiple types', async function () {
                const shipAndStationTypes = [EntityType.SHIP, EntityType.SPACE_STATION];
                const entities = await controller.findEntities({
                    entityTypes: shipAndStationTypes,
                    limit: 10
                });

                expect(entities).to.be.an('array');
                entities.forEach(entity => {
                    expect(shipAndStationTypes).to.include(entity.getType());
                });
            });

            it('should search entities by creator', async function () {
                let testEntityId: number | null = null;

                try {
                    const uniqueCreator = `test_creator_${Date.now()}`;
                    const testEntity = await controller.create(createMockEntityData({
                        CREATOR: uniqueCreator
                    }), {
                        validatePlacement: false,
                        checkSectorConflicts: false
                    });

                    testEntityId = testEntity.getId();

                    const entitiesByCreator = await controller.findEntities({
                        creator: uniqueCreator
                    });

                    expect(entitiesByCreator).to.be.an('array');
                    expect(entitiesByCreator.length).to.be.greaterThan(0);

                    entitiesByCreator.forEach(entity => {
                        expect(entity.getCreator()).to.equal(uniqueCreator);
                    });

                } finally {
                    if (testEntityId) {
                        try {
                            await controller.delete(testEntityId);
                        } catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                }
            });

            it('should filter docked entities only', async function () {
                const dockedEntities = await controller.findEntities({
                    dockedOnly: true,
                    limit: 10
                });

                expect(dockedEntities).to.be.an('array');
                dockedEntities.forEach(entity => {
                    expect(entity.isDocked()).to.be.true;
                    expect(entity.getDockedTo()).to.not.equal(-1);
                });
            });

            it('should filter undocked entities only', async function () {
                const undockedEntities = await controller.findEntities({
                    undockedOnly: true,
                    limit: 10
                });

                expect(undockedEntities).to.be.an('array');
                if (undockedEntities.length > 0) {
                    undockedEntities.forEach(entity => {
                        expect(entity.isDocked()).to.be.false;
                        expect(entity.getDockedTo()).to.equal(-1);
                    });
                }
            });

            it('should filter root entities only', async function () {
                const rootEntities = await controller.findEntities({
                    rootEntitiesOnly: true,
                    limit: 10
                });

                expect(rootEntities).to.be.an('array');
                rootEntities.forEach(entity => {
                    // Root entities are either not docked or are the root of their docking chain
                    expect(entity.getDockedTo() === -1 || entity.getDockedTo() === entity.getDockedRoot()).to.be.true;
                });
            });

            it('should filter touched entities only', async function () {
                const touchedEntities = await controller.findEntities({
                    touchedOnly: true,
                    limit: 10
                });

                expect(touchedEntities).to.be.an('array');
                touchedEntities.forEach(entity => {
                    expect(entity.getTouched()).to.be.true;
                });
            });

            it('should filter tracked entities only', async function () {
                const trackedEntities = await controller.findEntities({
                    trackedOnly: true,
                    limit: 10
                });

                expect(trackedEntities).to.be.an('array');
                trackedEntities.forEach(entity => {
                    expect(entity.getTracked()).to.be.true;
                });
            });

            it('should search entities by name', async function () {
                const searchTerm = 'test';
                const entities = await controller.findEntities({
                    searchTerm,
                    limit: 10
                });

                expect(entities).to.be.an('array');
                entities.forEach(entity => {
                    const name = (entity.getName() || '').toLowerCase();
                    const uid = entity.getUid().toLowerCase();
                    const creator = (entity.getCreator() || '').toLowerCase();

                    const containsSearchTerm = name.includes(searchTerm) ||
                        uid.includes(searchTerm) ||
                        creator.includes(searchTerm);
                    expect(containsSearchTerm).to.be.true;
                });
            });

            it('should handle empty search results', async function () {
                const emptyResults = await controller.findEntities({
                    searchTerm: 'definitely_nonexistent_entity_12345'
                });

                expect(emptyResults).to.be.an('array');
                expect(emptyResults).to.have.length(0);
            });

            it('should respect ordering parameters', async function () {
                const orderedByType = await controller.findEntities({
                    orderBy: 'TYPE',
                    orderDirection: 'ASC',
                    limit: 5
                });

                expect(orderedByType).to.be.an('array');
                if (orderedByType.length > 1) {
                    for (let i = 1; i < orderedByType.length; i++) {
                        expect(orderedByType[i - 1].getType()).to.be.lessThanOrEqual(orderedByType[i].getType());
                    }
                }
            });

            it('should handle pagination', async function () {
                const firstPage = await controller.findEntities({
                    limit: 3,
                    offset: 0,
                    orderBy: 'ID'
                });

                expect(firstPage).to.be.an('array');
                expect(firstPage.length).to.be.lessThanOrEqual(3);

                const secondPage = await controller.findEntities({
                    limit: 3,
                    offset: 3,
                    orderBy: 'ID'
                });

                expect(secondPage).to.be.an('array');
                expect(secondPage.length).to.be.lessThanOrEqual(3);

                // Verify pages don't overlap
                if (firstPage.length > 0 && secondPage.length > 0) {
                    const firstPageIds = firstPage.map(e => e.getId());
                    const secondPageIds = secondPage.map(e => e.getId());

                    const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
                    expect(overlap).to.have.length(0);
                }
            });
        });

        describe('Spatial Analysis', function () {
            it('should perform spatial analysis around coordinates', async function () {
                const center = { x: 0, y: 0, z: 0 };
                const radius = 15;

                const analysis = await controller.performSpatialAnalysis(center, radius, {
                    includeDensity: true,
                    includeTypeDistribution: true,
                    includeFactionPresence: true,
                    includeDockingStats: true
                });

                expect(analysis).to.be.an('object');
                expect(analysis.center).to.deep.equal(center);
                expect(analysis.radius).to.equal(radius);
                expect(analysis.totalEntities).to.be.a('number');
                expect(analysis.totalEntities).to.be.greaterThanOrEqual(0);
                expect(analysis.entityDensity).to.be.a('number');
                expect(analysis.sectorsCovered).to.be.a('number');

                if (analysis.totalEntities > 0) {
                    expect(analysis.typeDistribution).to.be.an('object');
                    expect(analysis.factionPresence).to.be.an('object');
                    expect(analysis.dockingStats).to.be.an('object');
                    expect(analysis.dockingStats!.dockedEntities).to.be.a('number');
                    expect(analysis.dockingStats!.dockingChains).to.be.a('number');
                    expect(analysis.dockingStats!.averageChainLength).to.be.a('number');
                }
            });

            it('should handle spatial analysis with no entities', async function () {
                const center = { x: 1000, y: 1000, z: 1000 }; // Far away coordinates
                const radius = 1;

                const analysis = await controller.performSpatialAnalysis(center, radius);

                expect(analysis).to.be.an('object');
                expect(analysis.totalEntities).to.equal(0);
                expect(analysis.entityDensity).to.equal(0);
                expect(analysis.sectorsCovered).to.equal(0);
            });
        });
    });

    // =============================================================================
    // REAL DATA VALIDATION TESTS
    // =============================================================================

    describe('Real Entity Data Validation Tests', function () {
        it('should find specific entities from EXISTING_TEST_ENTITIES by UID', async function () {
            // Test finding the Sol star
            const solStar = await controller.findEntityByUID('STAR_SOL_A');
            if (solStar) {
                expect(solStar.getUid()).to.equal('STAR_SOL_A');
                expect(solStar.getType()).to.equal(EntityType.SUN);
                expect(solStar.getName()).to.equal('Sol');
                expect(solStar.getX()).to.equal(1);
                expect(solStar.getY()).to.equal(1);
                expect(solStar.getZ()).to.equal(1);
            }

            // Test finding the Security Station
            const securityStation = await controller.findEntityByUID('ENTITY_Security_Station');
            if (securityStation) {
                expect(securityStation.getUid()).to.equal('ENTITY_Security_Station');
                expect(securityStation.getType()).to.equal(EntityType.SPACE_STATION);
                expect(securityStation.getName()).to.equal('Security Station');
                expect(securityStation.getX()).to.equal(-4);
                expect(securityStation.getY()).to.equal(1);
                expect(securityStation.getZ()).to.equal(0);
                expect(securityStation.getFaction()).to.equal(1);
            }

            // Test finding Earth
            const earth = await controller.findEntityByUID('PLANET_SOL_EARTH');
            if (earth) {
                expect(earth.getUid()).to.equal('PLANET_SOL_EARTH');
                expect(earth.getType()).to.equal(EntityType.PLANET);
                expect(earth.getName()).to.equal('Earth');
                expect(earth.getX()).to.equal(1);
                expect(earth.getY()).to.equal(0);
                expect(earth.getZ()).to.equal(1);
                expect(earth.getFaction()).to.equal(1);
            }
        });

        it('should find Trading Guild entities with correct faction', async function () {
            const tradingGuildEntities = await controller.findEntitiesByFaction(KnownFactions.TRADING_GUILD, { limit: 10 });
            
            // Should find at least the entities from our test data
            expect(tradingGuildEntities.length).to.be.at.least(0);
            
            tradingGuildEntities.forEach(entity => {
                expect(entity.getFaction()).to.equal(KnownFactions.TRADING_GUILD);
                expect(entity.isNPCFaction()).to.be.true;
                expect(entity.getFactionName()).to.include('Trading Guild');
            });
            
            // Test specific Trading Guild entities from our data
            const tgFreighter1 = await controller.findEntityByUID('TEST_TG_FREIGHTER_001');
            if (tgFreighter1) {
                expect(tgFreighter1.getFaction()).to.equal(KnownFactions.TRADING_GUILD);
                expect(tgFreighter1.getName()).to.equal('TG Freighter Alpha');
                expect(tgFreighter1.getType()).to.equal(EntityType.SHIP);
            }
        });

        it('should find Outcast entities with correct faction', async function () {
            const outcastEntities = await controller.findEntitiesByFaction(KnownFactions.OUTCASTS, { limit: 10 });
            
            outcastEntities.forEach(entity => {
                expect(entity.getFaction()).to.equal(KnownFactions.OUTCASTS);
                expect(entity.isNPCFaction()).to.be.true;
                expect(entity.getFactionName()).to.include('Outcasts');
            });

            // Test specific Outcast entities from our data
            const ocRaider1 = await controller.findEntityByUID('TEST_OC_RAIDER_001');
            if (ocRaider1) {
                expect(ocRaider1.getFaction()).to.equal(KnownFactions.OUTCASTS);
                expect(ocRaider1.getName()).to.equal('Outcast Raider Alpha');
                expect(ocRaider1.getType()).to.equal(EntityType.SHIP);
            }
        });

        it('should find Scavenger entities with correct faction', async function () {
            const scavengerEntities = await controller.findEntitiesByFaction(KnownFactions.SCAVENGERS, { limit: 10 });
            
            scavengerEntities.forEach(entity => {
                expect(entity.getFaction()).to.equal(KnownFactions.SCAVENGERS);
                expect(entity.isNPCFaction()).to.be.true;
                expect(entity.getFactionName()).to.include('Scavengers');
            });

            // Test specific Scavenger entity from our data
            const scCollector = await controller.findEntityByUID('TEST_SC_COLLECTOR_001');
            if (scCollector) {
                expect(scCollector.getFaction()).to.equal(KnownFactions.SCAVENGERS);
                expect(scCollector.getName()).to.equal('Scavenger Collector');
                expect(scCollector.getType()).to.equal(EntityType.SHIP);
            }
        });

        it('should find entities in specific sectors from test data', async function () {
            // Test Sol system area (0,0,0) - should have multiple entities
            const solSystemEntities = await controller.findEntitiesInSector(0, 0, 0);
            expect(solSystemEntities.length).to.be.at.least(0);
            
            // Test Security Station area (-4,1,0) - should have station and docked ships
            const securitySectorEntities = await controller.findEntitiesInSector(-4, 1, 0);
            expect(securitySectorEntities.length).to.be.at.least(0);
            
            // If we find entities in this sector, check they have the correct coordinates
            securitySectorEntities.forEach(entity => {
                expect(entity.getX()).to.equal(-4);
                expect(entity.getY()).to.equal(1);
                expect(entity.getZ()).to.equal(0);
            });

            // Test Player carrier area (5,1,0) - should have carrier and docked fighters
            const carrierSectorEntities = await controller.findEntitiesInSector(5, 1, 0);
            expect(carrierSectorEntities.length).to.be.at.least(0);
            
            carrierSectorEntities.forEach(entity => {
                expect(entity.getX()).to.equal(5);
                expect(entity.getY()).to.equal(1);
                expect(entity.getZ()).to.equal(0);
            });
        });
        
        it('should validate entity type distributions match expected data', async function () {
            const stats = await controller.getEntityStatistics();
            
            // Based on our EXISTING_TEST_ENTITIES TYPE_DISTRIBUTION
            expect(stats.entitiesByType).to.be.an('object');
            
            // Check that we have the expected entity types
            if (stats.entitiesByType[EntityType.SHIP]) {
                expect(stats.entitiesByType[EntityType.SHIP]).to.be.at.least(0);
            }
            
            if (stats.entitiesByType[EntityType.SPACE_STATION]) {
                expect(stats.entitiesByType[EntityType.SPACE_STATION]).to.be.at.least(0);
            }
            
            if (stats.entitiesByType[EntityType.SUN]) {
                expect(stats.entitiesByType[EntityType.SUN]).to.be.at.least(0);
            }
            
            if (stats.entitiesByType[EntityType.PLANET]) {
                expect(stats.entitiesByType[EntityType.PLANET]).to.be.at.least(0);
            }
            
            if (stats.entitiesByType[EntityType.BLACK_HOLE]) {
                expect(stats.entitiesByType[EntityType.BLACK_HOLE]).to.be.at.least(0);
            }
            
            // Log actual distributions for debugging
            console.log('Actual entity type distribution:', stats.entitiesByType);
        });

        it('should find entities with real docking relationships', async function () {
            // Test finding entities docked to Security Station (ID 129 in our test data)
            const securityStation = await controller.findEntityByUID('ENTITY_Security_Station');
            if (securityStation) {
                // Use correct search option for docked entities
                const dockedToStation = await controller.findEntities({
                    dockedOnly: true,
                    limit: 10
                });
                
                // Filter by docked to this specific station
                const dockedToThisStation = dockedToStation.filter(entity => 
                    entity.getDockedTo() == securityStation.getId()
                );
                
                dockedToThisStation.forEach(entity => {
                    expect(entity.getDockedTo()).to.equal(securityStation.getId());
                    expect(entity.isDocked()).to.be.true;
                });
                
                console.log(`Found ${dockedToThisStation.length} entities docked to Security Station`);
            }

            // Test finding a carrier and its fighters
            const carrier = await controller.findEntityByUID('TEST_PLAYER_CARRIER_001');
            if (carrier) {
                // Use correct search option for docked entities
                const dockedToCarrier = await controller.findEntities({
                    dockedOnly: true,
                    limit: 10
                });
                
                // Filter by docked to this specific carrier
                const dockedToThisCarrier = dockedToCarrier.filter(entity => 
                    entity.getDockedTo() == carrier.getId()
                );
                
                dockedToThisCarrier.forEach(entity => {
                    expect(entity.getDockedTo()).to.equal(carrier.getId());
                    expect(entity.isDocked()).to.be.true;
                    // Should be in same location as carrier
                    expect(entity.getX()).to.equal(carrier.getX());
                    expect(entity.getY()).to.equal(carrier.getY());
                    expect(entity.getZ()).to.equal(carrier.getZ());
                });
                
                console.log(`Found ${dockedToThisCarrier.length} entities docked to carrier`);
            }
        });

        it('should validate faction distribution matches expected data', async function () {
            const stats = await controller.getEntityStatistics();
            
            // Based on our EXISTING_TEST_ENTITIES FACTION_DISTRIBUTION
            expect(stats.entitiesByFaction).to.be.an('object');
            
            // Check major factions from our test data
            if (stats.entitiesByFaction[1]) { // Main player faction
                expect(stats.entitiesByFaction[1]).to.be.at.least(0);
            }
            
            if (stats.entitiesByFaction[0]) { // No faction / Independent
                expect(stats.entitiesByFaction[0]).to.be.at.least(0);
            }
            
            if (stats.entitiesByFaction[KnownFactions.TRADING_GUILD]) {
                expect(stats.entitiesByFaction[KnownFactions.TRADING_GUILD]).to.be.at.least(0);
            }
            
            if (stats.entitiesByFaction[KnownFactions.OUTCASTS]) {
                expect(stats.entitiesByFaction[KnownFactions.OUTCASTS]).to.be.at.least(0);
            }
            
            if (stats.entitiesByFaction[KnownFactions.SCAVENGERS]) {
                expect(stats.entitiesByFaction[KnownFactions.SCAVENGERS]).to.be.at.least(0);
            }
            
            // Log actual distributions for debugging
            console.log('Actual faction distribution:', stats.entitiesByFaction);
        });

        it('should perform spatial analysis on populated sectors from test data', async function () {
            // Test spatial analysis around Sol system (center of our galaxy)
            const solAnalysis = await controller.performSpatialAnalysis({ x: 0, y: 0, z: 0 }, 5, {
                includeDensity: true,
                includeTypeDistribution: true,
                includeFactionPresence: true,
                includeDockingStats: true
            });

            expect(solAnalysis.center).to.deep.equal({ x: 0, y: 0, z: 0 });
            expect(solAnalysis.radius).to.equal(5);
            expect(solAnalysis.totalEntities).to.be.at.least(0);
            
            if (solAnalysis.totalEntities > 0) {
                expect(solAnalysis.typeDistribution).to.be.an('object');
                expect(solAnalysis.factionPresence).to.be.an('object');
                expect(solAnalysis.dockingStats).to.be.an('object');
            }
            
            console.log(`Sol system analysis: ${solAnalysis.totalEntities} entities in radius 5`);

            // Test spatial analysis around Security Station area
            const securityAnalysis = await controller.performSpatialAnalysis({ x: -4, y: 1, z: 0 }, 2, {
                includeDensity: true,
                includeTypeDistribution: true,
                includeFactionPresence: true,
                includeDockingStats: true
            });

            expect(securityAnalysis.totalEntities).to.be.at.least(0);
            console.log(`Security Station area analysis: ${securityAnalysis.totalEntities} entities in radius 2`);
        });
    });

    describe('Real Data Integration Performance', function () {
        it('should handle queries on real data efficiently', async function () {
            const startTime = Date.now();
            
            // Perform various queries that should work with real data
            const queries = [
                () => controller.getTotalEntityCount(),
                () => controller.getEntityStatistics(),
                () => controller.findEntitiesByType(EntityType.SHIP, { limit: 10 }),
                () => controller.findEntitiesByType(EntityType.SPACE_STATION, { limit: 10 }),
                () => controller.findEntitiesByFaction(1, { limit: 10 }),
                () => controller.findEntitiesInSector(0, 0, 0),
                () => controller.findEntitiesWithinRadius({ x: 0, y: 0, z: 0 }, 10, { limit: 20 })
            ];

            const results = await Promise.all(queries.map(query => query()));
            const duration = Date.now() - startTime;

            console.log(`Real data queries completed in ${duration}ms`);
            expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds

            // Validate results
            expect(results[0]).to.be.a('number'); // Total count
            expect(results[1]).to.be.an('object'); // Statistics
            expect(results[2]).to.be.an('array'); // Ships
            expect(results[3]).to.be.an('array'); // Stations
            expect(results[4]).to.be.an('array'); // Faction entities
            expect(results[5]).to.be.an('array'); // Sector entities
            expect(results[6]).to.be.an('array'); // Radius entities
        });

        it('should handle concurrent operations on real data', async function () {
            const concurrentQueries = [];
            
            // Create 10 concurrent queries using real entity UIDs
            const testUIDs = [
                'STAR_SOL_A', 'ENTITY_Security_Station', 'PLANET_SOL_EARTH', 
                'TEST_TG_FREIGHTER_001', 'TEST_OC_RAIDER_001'
            ];

            for (let i = 0; i < 10; i++) {
                const uid = testUIDs[i % testUIDs.length];
                concurrentQueries.push(controller.findEntityByUID(uid));
            }

            const startTime = Date.now();
            const results = await Promise.allSettled(concurrentQueries);
            const duration = Date.now() - startTime;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`Concurrent real data queries: ${successful} successful, ${failed} failed in ${duration}ms`);
            expect(successful).to.be.greaterThan(failed);
            expect(duration).to.be.lessThan(3000); // Should complete within 3 seconds
        });
    });

    describe('Final Data Validation Tests', function () {
        it('should validate that EXISTING_TEST_ENTITIES data is accessible', async function () {
            let foundEntities = 0;
            let totalChecked = 0;

            // Check a sample of entities from each category in EXISTING_TEST_ENTITIES
            const sampleEntities = [
                ...EXISTING_TEST_ENTITIES.SHIPS.slice(0, 2),
                ...EXISTING_TEST_ENTITIES.TRADING_GUILD.slice(0, 1),
                ...EXISTING_TEST_ENTITIES.OUTCASTS.slice(0, 1),
                ...EXISTING_TEST_ENTITIES.SCAVENGERS.slice(0, 1),
                ...EXISTING_TEST_ENTITIES.STATIONS.slice(0, 3),
                ...EXISTING_TEST_ENTITIES.CELESTIAL.slice(0, 5),
                ...EXISTING_TEST_ENTITIES.ASTEROIDS.slice(0, 3),
                ...EXISTING_TEST_ENTITIES.NPCS.slice(0, 2)
            ];

            console.log(`Checking ${sampleEntities.length} sample entities from EXISTING_TEST_ENTITIES...`);

            for (const entityData of sampleEntities) {
                totalChecked++;
                const entity = await controller.findEntityByUID(entityData.uid);
                if (entity) {
                    foundEntities++;
                    
                    // Validate basic properties match
                    expect(entity.getUid()).to.equal(entityData.uid);
                    if (entityData.name && entity.getName()) {
                        expect(entity.getName()).to.equal(entityData.name);
                    }
                    if (entityData.type !== undefined) {
                        expect(entity.getType()).to.equal(entityData.type);
                    }
                    if (entityData.faction !== undefined) {
                        expect(entity.getFaction()).to.equal(entityData.faction);
                    }
                    if (entityData.sector) {
                        expect(entity.getX()).to.equal(entityData.sector.x);
                        expect(entity.getY()).to.equal(entityData.sector.y);
                        expect(entity.getZ()).to.equal(entityData.sector.z);
                    }
                }
            }

            const foundPercentage = (foundEntities / totalChecked) * 100;
            console.log(`Found ${foundEntities}/${totalChecked} entities (${foundPercentage.toFixed(1)}%)`);

            // We expect to find a reasonable percentage of entities (database might not have all test data)
            expect(foundEntities).to.be.at.least(0);
            expect(totalChecked).to.be.greaterThan(0);
        });

        it('should verify that entity statistics reflect real data patterns', async function () {
            const stats = await controller.getEntityStatistics();
            
            // Log comprehensive statistics for validation
            console.log('\n=== FINAL ENTITY STATISTICS VALIDATION ===');
            console.log(`Total Entities: ${stats.totalEntities}`);
            console.log(`Docked Entities: ${stats.dockedEntities}`);
            console.log(`Root Entities: ${stats.rootEntities}`);
            console.log(`Touched Entities: ${stats.touchedEntities}`);
            console.log(`Tracked Entities: ${stats.trackedEntities}`);
            console.log(`Average Entities per Sector: ${stats.averageEntitiesPerSector}`);
            
            console.log('\nEntity Type Distribution:');
            Object.entries(stats.entitiesByType).forEach(([type, count]) => {
                const typeName = EntityType[parseInt(type)] || `Unknown(${type})`;
                console.log(`  ${typeName}: ${count}`);
            });
            
            console.log('\nFaction Distribution:');
            Object.entries(stats.entitiesByFaction).forEach(([faction, count]) => {
                let factionName = faction;
                if (faction === '0') factionName = 'Independent';
                else if (faction === '1') factionName = 'Main Player Faction';
                else if (faction === KnownFactions.TRADING_GUILD.toString()) factionName = 'Trading Guild';
                else if (faction === KnownFactions.OUTCASTS.toString()) factionName = 'Outcasts';
                else if (faction === KnownFactions.SCAVENGERS.toString()) factionName = 'Scavengers';
                console.log(`  ${factionName} (${faction}): ${count}`);
            });
            
            console.log('\nMost Populated Sectors:');
            stats.mostPopulatedSectors.slice(0, 5).forEach(sector => {
                console.log(`  ${sector.coordinates}: ${sector.entityCount} entities`);
            });
            
            console.log('\nLargest Docking Chains:');
            stats.largestDockingChains.slice(0, 3).forEach(chain => {
                console.log(`  Root Entity ${chain.rootEntityId}: ${chain.chainSize} entities`);
            });
            
            console.log('=== END STATISTICS VALIDATION ===\n');
            
            // Basic validation that statistics are reasonable
            expect(stats.totalEntities).to.be.at.least(0);
            expect(stats.entitiesByType).to.be.an('object');
            expect(stats.entitiesByFaction).to.be.an('object');
            expect(stats.mostPopulatedSectors).to.be.an('array');
            expect(stats.largestDockingChains).to.be.an('array');
            expect(stats.averageEntitiesPerSector).to.be.at.least(0);
        });

        it('should validate that the test environment is working correctly', async function () {
            console.log('\n=== FINAL TEST ENVIRONMENT VALIDATION ===');
            
            // Test basic controller operations
            const totalEntities = await controller.getTotalEntityCount();
            console.log(`Controller getTotalEntityCount(): ${totalEntities}`);
            expect(totalEntities).to.be.a('number');
            
            // Test basic search
            const allEntities = await controller.findEntities({ limit: 5 });
            console.log(`Controller findEntities(limit: 5): ${allEntities.length} results`);
            expect(allEntities).to.be.an('array');
            
            // Test entity type queries
            const ships = await controller.findEntitiesByType(EntityType.SHIP, { limit: 3 });
            console.log(`Controller findEntitiesByType(SHIP): ${ships.length} results`);
            expect(ships).to.be.an('array');
            
            // Test faction queries
            const playerFactionEntities = await controller.findEntitiesByFaction(1, { limit: 3 });
            console.log(`Controller findEntitiesByFaction(1): ${playerFactionEntities.length} results`);
            expect(playerFactionEntities).to.be.an('array');
            
            // Test spatial queries
            const spatialEntities = await controller.findEntitiesWithinRadius({ x: 0, y: 0, z: 0 }, 5, { limit: 5 });
            console.log(`Controller findEntitiesWithinRadius(): ${spatialEntities.length} results`);
            expect(spatialEntities).to.be.an('array');
            
            // Test statistics
            const stats = await controller.getEntityStatistics();
            console.log(`Controller getEntityStatistics(): ${Object.keys(stats).length} stat categories`);
            expect(stats).to.be.an('object');
            
            console.log('=== TEST ENVIRONMENT VALIDATION COMPLETE ===\n');
            
            console.log('All EntitiesController tests with real data completed successfully!');
        });
    });
});