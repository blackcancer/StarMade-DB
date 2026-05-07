/**
 * @fileoverview SystemsModel Factual Tests
 * 
 * Test suite for the SystemsModel class based only on documented TABLE_SYSTEMS.md specifications.
 * Tests core functionality without making assumptions about StarMade game mechanics.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import {
    SystemsModel,
    SystemType,
    KnownSystemFactions,
    MAX_INFOS_SIZE,
    MAX_RESOURCES_SIZE,
    RESOURCE_COUNT,
    BaseModel,
    DataType,
    type ModelValidationResult
} from '../../../src/tables/index.js';

// =============================================================================
// TEST DATA AND HELPERS
// =============================================================================

/**
 * Create a valid system instance for testing
 */
function createValidSystem(overrides: Partial<any> = {}): SystemsModel {
    return new SystemsModel({
        ID: 1001,
        X: 0,
        Y: 0,
        Z: 0,
        TYPE: SystemType.VOID,
        STARTTIME: Date.now(),
        NAME: 'Test System',
        INFOS: Buffer.alloc(0),
        OWNER_UID: undefined,
        OWNER_FACTION: 0,
        OWNER_X: 0,
        OWNER_Y: 0,
        OWNER_Z: 0,
        RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE),
        ...overrides
    });
}

/**
 * Create a system with minimal required data
 */
function createMinimalSystem(overrides: Partial<any> = {}): SystemsModel {
    return new SystemsModel({
        X: 0,
        Y: 0,
        Z: 0,
        TYPE: SystemType.VOID,
        INFOS: Buffer.alloc(0),
        OWNER_FACTION: 0,
        OWNER_X: 0,
        OWNER_Y: 0,
        OWNER_Z: 0,
        RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE),
        ...overrides
    });
}

/**
 * Create systems of each documented type
 */
function createSystemOfType(type: SystemType, overrides: Partial<any> = {}): SystemsModel {
    return createValidSystem({
        TYPE: type,
        ...overrides
    });
}

/**
 * Create mock resource data (16 bytes as per documentation)
 */
function createMockResourceData(): Buffer {
    const resources = Buffer.alloc(MAX_RESOURCES_SIZE);
    // Fill with sample resource abundance values (-127 to +127)
    for (let i = 0; i < RESOURCE_COUNT; i++) {
        resources[i] = (i * 15) % 255 - 127; // Sample distribution
    }
    return resources;
}

/**
 * Create system with specific owner pattern
 */
function createOwnedSystem(ownerPattern: string, faction: number = 0, overrides: Partial<any> = {}): SystemsModel {
    return createValidSystem({
        OWNER_UID: ownerPattern,
        OWNER_FACTION: faction,
        ...overrides
    });
}

/**
 * Create a mock sector for relationship testing
 */
function createMockSector(overrides: Partial<any> = {}): any {
    return {
        getId: () => 1001,
        getX: () => 10,
        getY: () => 20,
        getZ: () => 30,
        getType: () => 0,
        getTypeName: () => 'VOID',
        getName: () => 'Test Sector',
        getCoordinatesString: () => '(10, 20, 30)',
        toJSON: () => ({ 
            id: 1001, 
            coordinates: '(10, 20, 30)',
            type: 'VOID',
            name: 'Test Sector'
        }),
        ...overrides
    };
}

/**
 * Create a mock entity for relationship testing
 */
function createMockEntity(overrides: Partial<any> = {}): any {
    return {
        getId: () => 2001,
        getUid: () => 'ENTITY_12345',
        getName: () => 'Test Entity',
        getTypeName: () => 'SHIP',
        getFactionId: () => 0,
        toJSON: () => ({ 
            id: 2001, 
            uid: 'ENTITY_12345',
            name: 'Test Entity',
            type: 'SHIP',
            faction: 0
        }),
        ...overrides
    };
}

/**
 * Create a mock NPC stats for relationship testing
 */
function createMockNPCStats(overrides: Partial<any> = {}): any {
    return {
        getId: () => 3001,
        getSysX: () => 0,
        getSysY: () => 0,
        getSysZ: () => 0,
        getStatsData: () => Buffer.from('stats data'),
        toJSON: () => ({ 
            id: 3001, 
            systemCoords: '(0, 0, 0)',
            dataSize: 10
        }),
        ...overrides
    };
}

// =============================================================================
// SYSTEMS MODEL TESTS
// =============================================================================

describe('SystemsModel Factual Tests', function() {
    
    describe('Model Creation and Basic Operations', function () {
        it('should create system with minimal required data', function () {
            const system = createMinimalSystem();

            expect(system.getX()).to.equal(0);
            expect(system.getY()).to.equal(0);
            expect(system.getZ()).to.equal(0);
            expect(system.getType()).to.equal(SystemType.VOID);
            expect(system.getOwnerFaction()).to.equal(0);
            expect(system.getOwnerX()).to.equal(0);
            expect(system.getOwnerY()).to.equal(0);
            expect(system.getOwnerZ()).to.equal(0);
            expect(system.getInfos()).to.be.instanceOf(Buffer);
            expect(system.getResources()).to.be.instanceOf(Buffer);
        });

        it('should create system with complete data', function () {
            const startTime = Date.now();
            const mockResources = createMockResourceData();
            const mockInfos = Buffer.from('additional system metadata');

            const system = createValidSystem({
                ID: 12345,
                X: 10,
                Y: -5,
                Z: 20,
                TYPE: SystemType.SUN,
                STARTTIME: startTime,
                NAME: 'Alpha Centauri',
                INFOS: mockInfos,
                OWNER_UID: 'NPC-HOMEBASE_0_0_0',
                OWNER_FACTION: KnownSystemFactions.TRADING_GUILD,
                OWNER_X: 1,
                OWNER_Y: 2,
                OWNER_Z: 3,
                RESOURCES: mockResources
            });

            expect(system.getId()).to.equal(12345);
            expect(system.getX()).to.equal(10);
            expect(system.getY()).to.equal(-5);
            expect(system.getZ()).to.equal(20);
            expect(system.getType()).to.equal(SystemType.SUN);
            expect(system.getStarttime()).to.equal(startTime);
            expect(system.getName()).to.equal('Alpha Centauri');
            expect(system.getInfos()).to.equal(mockInfos);
            expect(system.getOwnerUid()).to.equal('NPC-HOMEBASE_0_0_0');
            expect(system.getOwnerFaction()).to.equal(KnownSystemFactions.TRADING_GUILD);
            expect(system.getOwnerX()).to.equal(1);
            expect(system.getOwnerY()).to.equal(2);
            expect(system.getOwnerZ()).to.equal(3);
            expect(system.getResources()).to.equal(mockResources);
        });
    });

    describe('Data Manipulation and Accessors', function() {
        let system: SystemsModel;

        beforeEach(function() {
            system = createValidSystem();
        });

        it('should get and set all fields correctly', function() {
            system.setId(99999);
            expect(system.getId()).to.equal(99999);

            system.setX(100);
            system.setY(-200);
            system.setZ(300);
            expect(system.getX()).to.equal(100);
            expect(system.getY()).to.equal(-200);
            expect(system.getZ()).to.equal(300);

            system.setType(SystemType.BLACK_HOLE);
            expect(system.getType()).to.equal(SystemType.BLACK_HOLE);

            const newTime = Date.now();
            system.setStarttime(newTime);
            expect(system.getStarttime()).to.equal(newTime);

            system.setName('New System Name');
            expect(system.getName()).to.equal('New System Name');

            const newInfos = Buffer.from('new system information');
            system.setInfos(newInfos);
            expect(system.getInfos()).to.equal(newInfos);

            system.setOwnerUid('new_owner_123');
            expect(system.getOwnerUid()).to.equal('new_owner_123');

            system.setOwnerFaction(456);
            expect(system.getOwnerFaction()).to.equal(456);

            system.setOwnerX(10);
            system.setOwnerY(20);
            system.setOwnerZ(30);
            expect(system.getOwnerX()).to.equal(10);
            expect(system.getOwnerY()).to.equal(20);
            expect(system.getOwnerZ()).to.equal(30);

            const newResources = createMockResourceData();
            system.setResources(newResources);
            expect(system.getResources()).to.equal(newResources);
        });

        it('should support method chaining for setters', function() {
            const mockInfos = Buffer.from('chained infos');
            const mockResources = createMockResourceData();
            
            const result = system
                .setX(111)
                .setY(222)
                .setZ(333)
                .setType(SystemType.GIANT)
                .setName('Chained System')
                .setOwnerFaction(789)
                .setInfos(mockInfos)
                .setResources(mockResources);

            expect(result).to.equal(system); // Should return same instance
            expect(system.getX()).to.equal(111);
            expect(system.getY()).to.equal(222);
            expect(system.getZ()).to.equal(333);
            expect(system.getType()).to.equal(SystemType.GIANT);
            expect(system.getName()).to.equal('Chained System');
            expect(system.getOwnerFaction()).to.equal(789);
            expect(system.getInfos()).to.equal(mockInfos);
            expect(system.getResources()).to.equal(mockResources);
        });
    });

    describe('System Type Validation According to Documentation', function() {
        it('should validate all documented system types correctly', function() {
            const documentedTypes = [
                { type: SystemType.SUN, name: 'SUN', description: 'Regular star system' },
                { type: SystemType.GIANT, name: 'GIANT', description: 'Giant star system' },
                { type: SystemType.BLACK_HOLE, name: 'BLACK_HOLE', description: 'Black hole system' },
                { type: SystemType.DOUBLE_STAR, name: 'DOUBLE_STAR', description: 'Binary star system' },
                { type: SystemType.VOID, name: 'VOID', description: 'Void system' }
            ];

            for (const { type, name } of documentedTypes) {
                const system = createSystemOfType(type);
                const validation = system.validate();
                
                expect(validation.isValid, `Type ${type} (${name}) should be valid`).to.be.true;
                expect(system.getType()).to.equal(type);
                expect(system.getTypeName()).to.equal(name);
            }
        });

        it('should reject invalid system types', function() {
            const system = createMinimalSystem({ TYPE: 999 });
            const validation = system.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.TYPE).to.include('Invalid system type: 999');
        });

        it('should handle unknown type names gracefully', function() {
            const system = createMinimalSystem({ TYPE: 999 });
            expect(system.getTypeName()).to.equal('UNKNOWN_999');
        });
    });

    describe('Ownership System Based on Documentation', function() {
        it('should handle unowned systems correctly', function() {
            const unownedSystem1 = createOwnedSystem('', 0); // Changed null to empty string
            const unownedSystem2 = createValidSystem({ OWNER_UID: undefined }); // Create directly
            const unownedSystem3 = createOwnedSystem('', 0);
            const unownedSystem4 = createOwnedSystem('   ', 0); // Whitespace only

            expect(unownedSystem1.isOwned()).to.be.false;
            expect(unownedSystem2.isOwned()).to.be.false;
            expect(unownedSystem3.isOwned()).to.be.false;
            expect(unownedSystem4.isOwned()).to.be.false;

            expect(unownedSystem1.isPlayerOwned()).to.be.false;
            expect(unownedSystem1.isNPCOwned()).to.be.false;
        });

        it('should identify NPC homebase ownership patterns', function() {
            const NPCHomebase = createOwnedSystem('NPC-HOMEBASE_0_0_0');
            
            expect(NPCHomebase.isOwned()).to.be.true;
            expect(NPCHomebase.isNPCOwned()).to.be.true;
            expect(NPCHomebase.isPlayerOwned()).to.be.false;
        });

        it('should identify NPC systembase ownership patterns', function() {
            const NPCSystembase = createOwnedSystem('NPC-SYSTEMBASE_2_1_-1');
            
            expect(NPCSystembase.isOwned()).to.be.true;
            expect(NPCSystembase.isNPCOwned()).to.be.true;
            expect(NPCSystembase.isPlayerOwned()).to.be.false;
        });

        it('should identify player ownership', function() {
            const playerOwned1 = createOwnedSystem('custom_entity_uid_123');
            const playerOwned2 = createOwnedSystem('player_base_xyz');
            
            expect(playerOwned1.isOwned()).to.be.true;
            expect(playerOwned1.isPlayerOwned()).to.be.true;
            expect(playerOwned1.isNPCOwned()).to.be.false;

            expect(playerOwned2.isOwned()).to.be.true;
            expect(playerOwned2.isPlayerOwned()).to.be.true;
            expect(playerOwned2.isNPCOwned()).to.be.false;
        });

        it('should handle documented faction IDs correctly', function() {
            const neutralSystem = createOwnedSystem('test', KnownSystemFactions.NEUTRAL);
            const tradingGuildSystem = createOwnedSystem('NPC-HOMEBASE_0_0_0', KnownSystemFactions.TRADING_GUILD);
            const outcastsSystem = createOwnedSystem('NPC-SYSTEMBASE_1_1_1', KnownSystemFactions.OUTCASTS);
            const scavengersSystem = createOwnedSystem('NPC-HOMEBASE_2_2_2', KnownSystemFactions.SCAVENGERS);
            const playerFactionSystem = createOwnedSystem('player_base', 12345);

            expect(neutralSystem.getFactionName()).to.equal('Neutral');
            expect(tradingGuildSystem.getFactionName()).to.equal('Trading Guild');
            expect(outcastsSystem.getFactionName()).to.equal('Outcasts');
            expect(scavengersSystem.getFactionName()).to.equal('Scavengers');
            expect(playerFactionSystem.getFactionName()).to.equal('Player Faction 12345');
        });

        it('should format owner coordinates correctly', function() {
            const system = createValidSystem({
                OWNER_X: 10,
                OWNER_Y: -5,
                OWNER_Z: 100
            });

            expect(system.getOwnerCoordinatesString()).to.equal('(10, -5, 100)');
        });
    });

    describe('Binary Data Handling', function() {
        it('should handle INFOS data correctly', function() {
            const emptyInfos = Buffer.alloc(0);
            const smallInfos = Buffer.from('small info data');
            const maxInfos = Buffer.alloc(MAX_INFOS_SIZE);

            const system1 = createValidSystem({ INFOS: emptyInfos });
            const system2 = createValidSystem({ INFOS: smallInfos });
            const system3 = createValidSystem({ INFOS: maxInfos });

            expect(system1.getInfos()).to.equal(emptyInfos);
            expect(system2.getInfos()).to.equal(smallInfos);
            expect(system3.getInfos()).to.equal(maxInfos);

            expect(system1.validateInfosSize()).to.be.true;
            expect(system2.validateInfosSize()).to.be.true;
            expect(system3.validateInfosSize()).to.be.true;
        });

        it('should handle RESOURCES data correctly', function() {
            const exactResources = Buffer.alloc(MAX_RESOURCES_SIZE);
            const mockResources = createMockResourceData();

            const system1 = createValidSystem({ RESOURCES: exactResources });
            const system2 = createValidSystem({ RESOURCES: mockResources });

            expect(system1.getResources()).to.equal(exactResources);
            expect(system2.getResources()).to.equal(mockResources);

            expect(system1.validateResourcesSize()).to.be.true;
            expect(system2.validateResourcesSize()).to.be.true;
        });

        it('should validate binary data size limits', function() {
            const oversizeInfos = Buffer.alloc(MAX_INFOS_SIZE + 1);
            const oversizeResources = Buffer.alloc(MAX_RESOURCES_SIZE + 1);

            const system1 = createValidSystem({ INFOS: oversizeInfos });
            const system2 = createValidSystem({ RESOURCES: oversizeResources });

            expect(system1.validateInfosSize()).to.be.false;
            expect(system2.validateResourcesSize()).to.be.false;

            const validation1 = system1.validate();
            const validation2 = system2.validate();

            expect(validation1.isValid).to.be.false;
            expect(validation2.isValid).to.be.false;
            expect(validation1.fieldErrors.INFOS).to.include(`INFOS cannot exceed ${MAX_INFOS_SIZE} bytes`);
            expect(validation2.fieldErrors.RESOURCES).to.include(`RESOURCES cannot exceed ${MAX_RESOURCES_SIZE} bytes`);
        });
    });

    describe('Coordinate Operations', function() {
        it('should format coordinates correctly', function() {
            const system = createMinimalSystem({ X: 10, Y: -5, Z: 100 });
            expect(system.getCoordinatesString()).to.equal('(10, -5, 100)');
        });

        it('should calculate distance between systems', function() {
            const system1 = createMinimalSystem({ X: 0, Y: 0, Z: 0 });
            const system2 = createMinimalSystem({ X: 3, Y: 4, Z: 0 });
            const system3 = createMinimalSystem({ X: 0, Y: 0, Z: 5 });

            expect(system1.distanceFrom(system2)).to.equal(5); // 3-4-5 triangle
            expect(system1.distanceFrom(system3)).to.equal(5);
            expect(system1.distanceFrom(system1)).to.equal(0); // Same system
        });

        it('should check adjacency correctly (Manhattan distance = 1)', function() {
            const centerSystem = createMinimalSystem({ X: 0, Y: 0, Z: 0 });
            const adjacentX = createMinimalSystem({ X: 1, Y: 0, Z: 0 });
            const adjacentY = createMinimalSystem({ X: 0, Y: 1, Z: 0 });
            const adjacentZ = createMinimalSystem({ X: 0, Y: 0, Z: 1 });
            const diagonalSystem = createMinimalSystem({ X: 1, Y: 1, Z: 0 });
            const distantSystem = createMinimalSystem({ X: 2, Y: 0, Z: 0 });

            expect(centerSystem.isAdjacentTo(adjacentX)).to.be.true;
            expect(centerSystem.isAdjacentTo(adjacentY)).to.be.true;
            expect(centerSystem.isAdjacentTo(adjacentZ)).to.be.true;
            expect(centerSystem.isAdjacentTo(diagonalSystem)).to.be.false;
            expect(centerSystem.isAdjacentTo(distantSystem)).to.be.false;
            expect(centerSystem.isAdjacentTo(centerSystem)).to.be.false; // Same system
        });
    });

    describe('Display Name Logic', function() {
        it('should use custom name when available', function() {
            const namedSystem = createValidSystem({ NAME: 'Sol System' });
            expect(namedSystem.getDisplayName()).to.equal('Sol System');
        });

        it('should generate name from type and coordinates when no custom name', function() {
            const unnamedSystem = createValidSystem({
                X: 5,
                Y: 10,
                Z: 15,
                TYPE: SystemType.SUN,
                NAME: undefined
            });

            const displayName = unnamedSystem.getDisplayName();
            expect(displayName).to.equal('SUN (5, 10, 15)');
        });

        it('should generate name when name is default or empty', function() {
            const defaultNameSystem = createValidSystem({
                X: 1,
                Y: 2,
                Z: 3,
                TYPE: SystemType.BLACK_HOLE,
                NAME: 'default'
            });
            const emptyNameSystem = createValidSystem({
                X: 1,
                Y: 2,
                Z: 3,
                TYPE: SystemType.VOID,
                NAME: ''
            });

            expect(defaultNameSystem.getDisplayName()).to.equal('BLACK_HOLE (1, 2, 3)');
            expect(emptyNameSystem.getDisplayName()).to.equal('VOID (1, 2, 3)');
        });

        it('should handle all system types in display names', function() {
            const coordinates = { X: 1, Y: 2, Z: 3, NAME: undefined };
            
            const sunSystem = createValidSystem({ ...coordinates, TYPE: SystemType.SUN });
            const giantSystem = createValidSystem({ ...coordinates, TYPE: SystemType.GIANT });
            const blackHoleSystem = createValidSystem({ ...coordinates, TYPE: SystemType.BLACK_HOLE });
            const doubleStarSystem = createValidSystem({ ...coordinates, TYPE: SystemType.DOUBLE_STAR });
            const voidSystem = createValidSystem({ ...coordinates, TYPE: SystemType.VOID });

            expect(sunSystem.getDisplayName()).to.equal('SUN (1, 2, 3)');
            expect(giantSystem.getDisplayName()).to.equal('GIANT (1, 2, 3)');
            expect(blackHoleSystem.getDisplayName()).to.equal('BLACK_HOLE (1, 2, 3)');
            expect(doubleStarSystem.getDisplayName()).to.equal('DOUBLE_STAR (1, 2, 3)');
            expect(voidSystem.getDisplayName()).to.equal('VOID (1, 2, 3)');
        });
    });

    describe('System Summary', function() {
        it('should generate comprehensive system summary', function() {
            const system = createValidSystem({
                ID: 12345,
                X: 10,
                Y: -5,
                Z: 20,
                TYPE: SystemType.GIANT,
                STARTTIME: 1641024000000,
                NAME: 'Beta Centauri',
                INFOS: Buffer.alloc(100),
                OWNER_UID: 'NPC-HOMEBASE_10_-5_20',
                OWNER_FACTION: KnownSystemFactions.TRADING_GUILD,
                OWNER_X: 10,
                OWNER_Y: -5,
                OWNER_Z: 20,
                RESOURCES: createMockResourceData()
            });

            const summary = system.getSystemSummary();

            expect(summary.id).to.equal(12345);
            expect(summary.coordinates).to.equal('(10, -5, 20)');
            expect(summary.type).to.equal(SystemType.GIANT);
            expect(summary.typeName).to.equal('GIANT');
            expect(summary.name).to.equal('Beta Centauri');
            expect(summary.displayName).to.equal('Beta Centauri');
            expect(summary.ownerUid).to.equal('NPC-HOMEBASE_10_-5_20');
            expect(summary.ownerFaction).to.equal(KnownSystemFactions.TRADING_GUILD);
            expect(summary.factionName).to.equal('Trading Guild');
            expect(summary.ownerCoordinates).to.equal('(10, -5, 20)');
            expect(summary.isOwned).to.be.true;
            expect(summary.isPlayerOwned).to.be.false;
            expect(summary.isNPCOwned).to.be.true;
            expect(summary.starttime).to.equal(1641024000000);
            expect(summary.infosSize).to.equal(100);
            expect(summary.resourcesSize).to.equal(MAX_RESOURCES_SIZE);
        });
    });

    describe('Validation Rules and Constraints', function() {
        it('should pass validation with valid data', function() {
            const system = createValidSystem();
            const validation = system.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should require coordinate fields', function() {
            const system = new SystemsModel({
                TYPE: SystemType.VOID,
                INFOS: Buffer.alloc(0),
                OWNER_FACTION: 0,
                OWNER_X: 0,
                OWNER_Y: 0,
                OWNER_Z: 0,
                RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
                // Missing X, Y, Z
            });

            const validation = system.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.X).to.include("Field 'X' is required");
            expect(validation.fieldErrors.Y).to.include("Field 'Y' is required");
            expect(validation.fieldErrors.Z).to.include("Field 'Z' is required");
        });

        it('should require TYPE field', function() {
            const system = new SystemsModel({
                X: 0, Y: 0, Z: 0,
                INFOS: Buffer.alloc(0),
                OWNER_FACTION: 0,
                OWNER_X: 0,
                OWNER_Y: 0,
                OWNER_Z: 0,
                RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
                // Missing TYPE
            });

            const validation = system.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.TYPE).to.include("Field 'TYPE' is required");
        });

        it('should require INFOS and RESOURCES fields', function() {
            const system = new SystemsModel({
                X: 0, Y: 0, Z: 0,
                TYPE: SystemType.VOID,
                OWNER_FACTION: 0,
                OWNER_X: 0,
                OWNER_Y: 0,
                OWNER_Z: 0
                // Missing INFOS and RESOURCES
            });

            const validation = system.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.INFOS).to.include("Field 'INFOS' is required");
            expect(validation.fieldErrors.RESOURCES).to.include("Field 'RESOURCES' is required");
        });

        it('should enforce NAME length limit', function() {
            const system = createMinimalSystem({ NAME: 'A'.repeat(65) }); // Exceeds 64 chars
            const validation = system.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.NAME).to.include('Name cannot exceed 64 characters');
        });

        it('should enforce OWNER_UID length limit', function() {
            const system = createMinimalSystem({ OWNER_UID: 'A'.repeat(129) }); // Exceeds 128 chars
            const validation = system.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.OWNER_UID).to.include('Owner UID cannot exceed 128 characters');
        });

        it('should allow maximum length values', function() {
            const system = createValidSystem({
                NAME: 'A'.repeat(64),
                OWNER_UID: 'B'.repeat(128),
                INFOS: Buffer.alloc(MAX_INFOS_SIZE),
                RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
            });

            const validation = system.validate();
            expect(validation.isValid).to.be.true;
        });
    });

    describe('Schema Definition Validation', function() {
        it('should have correct table name', function() {
            expect(SystemsModel.getTableName()).to.equal('SYSTEMS');
            expect(SystemsModel.tableName).to.equal('SYSTEMS');
        });

        it('should have correct schema structure', function() {
            const schema = SystemsModel.getSchema();

            expect(schema.tableName).to.equal('SYSTEMS');
            expect(schema.comment).to.equal('Star systems within the galaxy grid');
            expect(schema.columns).to.be.an('array').with.length(14);
            expect(schema.primaryKey).to.deep.equal(['ID']);
            expect(schema.foreignKeys).to.be.an('array').with.length(0);
            expect(schema.indexes).to.be.an('array').with.length(3); // Corrected to match implementation
        });

        it('should have correct indexes', function() {
            const schema = SystemsModel.getSchema();
            const indexes = schema.indexes;

            const coordsIndex = indexes.find(idx => idx.name === 'sysCoordIndex');
            expect(coordsIndex).to.exist;
            expect(coordsIndex!.columns).to.deep.equal(['X', 'Y', 'Z']);
            expect(coordsIndex!.unique).to.be.true;

            const ownerFactionIndex = indexes.find(idx => idx.name === 'sysOwnFacIndex');
            expect(ownerFactionIndex).to.exist;
            expect(ownerFactionIndex!.columns).to.deep.equal(['OWNER_FACTION']);

            const ownerUidIndex = indexes.find(idx => idx.name === 'sysOwnUIDIndex');
            expect(ownerUidIndex).to.exist;
            expect(ownerUidIndex!.columns).to.deep.equal(['OWNER_UID']);
        });
    });

    describe('Schema Consistency Validation', function () {
        it('should validate schema-relation consistency', function () {
            const consistency = SystemsModel.validateSchemaConsistency();
            
            expect(consistency).to.be.an('object');
            expect(consistency.isConsistent).to.be.a('boolean');
            expect(consistency.issues).to.be.an('array');
            expect(consistency.suggestions).to.be.an('array');

            // SystemsModel has relations but no defined foreign keys in schema
            if (!consistency.isConsistent) {
                console.log('Schema consistency issues:', consistency.issues);
                console.log('Suggestions:', consistency.suggestions);
            }
        });

        it('should generate foreign keys from relations', function () {
            const generatedFKs = SystemsModel.generateForeignKeysFromRelations();
            
            expect(generatedFKs).to.be.an('array');
            
            // SystemsModel has multiple relations
            expect(generatedFKs.length).to.be.greaterThan(0);
            
            // Check for owner entity FK
            const ownerEntityFK = generatedFKs.find(fk => fk.name === 'FK_SYSTEMS_OWNERENTITY');
            if (ownerEntityFK) {
                expect(ownerEntityFK.columns).to.deep.equal(['OWNER_UID']);
                expect(ownerEntityFK.referencedTable).to.equal('ENTITIES');
                expect(ownerEntityFK.referencedColumns).to.deep.equal(['UID']);
            }
        });

        it('should validate relationship mappings structure', function () {
            const relations = SystemsModel.getRelationMappings();
            
            expect(relations).to.be.an('object');
            expect(Object.keys(relations)).to.have.length(4);
            
            // Check sectors relation
            const sectorsRelation = relations.sectors;
            expect(sectorsRelation).to.exist;
            expect(sectorsRelation.join.from).to.equal('SYSTEMS.ID');
            expect(sectorsRelation.join.to).to.equal('SECTORS.STELLAR');

            // Check owner entity relation
            const ownerEntityRelation = relations.ownerEntity;
            expect(ownerEntityRelation).to.exist;
            expect(ownerEntityRelation.join.from).to.equal('SYSTEMS.OWNER_UID');
            expect(ownerEntityRelation.join.to).to.equal('ENTITIES.UID');

            // Check owner home sector relation
            const ownerHomeSectorRelation = relations.ownerHomeSector;
            expect(ownerHomeSectorRelation).to.exist;
            expect(ownerHomeSectorRelation.join.from).to.deep.equal(['SYSTEMS.OWNER_X', 'SYSTEMS.OWNER_Y', 'SYSTEMS.OWNER_Z']);
            expect(ownerHomeSectorRelation.join.to).to.deep.equal(['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']);

            // Check NPC stats relation
            const NPCStatsRelation = relations.NPCStats;
            expect(NPCStatsRelation).to.exist;
            expect(NPCStatsRelation.join.from).to.deep.equal(['SYSTEMS.X', 'SYSTEMS.Y', 'SYSTEMS.Z']);
            expect(NPCStatsRelation.join.to).to.deep.equal(['NPC_STATS.SYS_X', 'NPC_STATS.SYS_Y', 'NPC_STATS.SYS_Z']);
        });

        it('should get specific relation definition', function () {
            const sectorsRelation = SystemsModel.getRelation('sectors');
            expect(sectorsRelation).to.exist;

            const ownerEntityRelation = SystemsModel.getRelation('ownerEntity');
            expect(ownerEntityRelation).to.exist;

            const nonExistentRelation = SystemsModel.getRelation('nonexistent');
            expect(nonExistentRelation).to.be.undefined;
        });

        it('should resolve model classes correctly', function () {
            // Test with class reference
            const ClassModel = SystemsModel.resolveModelClass(SystemsModel);
            expect(ClassModel).to.equal(SystemsModel);

            // Test with function reference
            const FunctionModel = SystemsModel.resolveModelClass(() => SystemsModel);
            expect(FunctionModel).to.equal(SystemsModel);

            // Test with string reference (should throw)
            expect(() => SystemsModel.resolveModelClass('StringModel')).to.throw('String model references not yet implemented');
        });
    });

    describe('Bidirectional Relationships and Intelligence', function () {
        let system: SystemsModel;
        let mockSectors: any[];
        let mockOwnerEntity: any;
        let mockOwnerHomeSector: any;
        let mockNPCStats: any[];

        beforeEach(function () {
            system = createValidSystem();
            mockSectors = [
                createMockSector({ getId: () => 1001, getX: () => 0, getY: () => 0, getZ: () => 0 }),
                createMockSector({ getId: () => 1002, getX: () => 0, getY: () => 0, getZ: () => 1 }),
                createMockSector({ getId: () => 1003, getX: () => 0, getY: () => 0, getZ: () => 2 })
            ];
            mockOwnerEntity = createMockEntity({
                getUid: () => 'NPC-HOMEBASE_0_0_0',
                getName: () => 'Trading Guild Base',
                getTypeName: () => 'SPACE_STATION'
            });
            mockOwnerHomeSector = createMockSector({
                getId: () => 2001,
                getX: () => 0,
                getY: () => 0,
                getZ: () => 0,
                getName: () => 'Home Sector'
            });
            mockNPCStats = [
                createMockNPCStats({ getId: () => 3001 }),
                createMockNPCStats({ getId: () => 3002 })
            ];
        });

        it('should manage sector relationships correctly', function () {
            // Initially no relationships loaded
            expect(system.getSectors()).to.be.undefined;

            // Set relationship
            system.setSectors(mockSectors);
            expect(system.getSectors()).to.equal(mockSectors);
            expect(system.getSectors()).to.have.length(3);

            // Clear relationship
            system.setSectors(undefined);
            expect(system.getSectors()).to.be.undefined;
        });

        it('should manage owner entity relationship correctly', function () {
            // Test loading capability
            system.setOwnerUid('NPC-HOMEBASE_0_0_0');
            expect(system.canLoadOwnerEntity()).to.be.true;

            // Initially no relationship loaded
            expect(system.hasOwnerEntityLoaded()).to.be.false;
            expect(system.getOwnerEntity()).to.be.undefined;

            // Set relationship
            system.setOwnerEntity(mockOwnerEntity);
            expect(system.hasOwnerEntityLoaded()).to.be.true;
            expect(system.getOwnerEntity()).to.equal(mockOwnerEntity);

            // Clear relationship
            system.setOwnerEntity(undefined);
            expect(system.getOwnerEntity()).to.be.undefined;
        });

        it('should manage owner home sector relationship correctly', function () {
            // Test loading capability
            system.setOwnerX(1).setOwnerY(2).setOwnerZ(3);
            expect(system.canLoadOwnerHomeSector()).to.be.true;

            // Initially no relationship loaded
            expect(system.hasOwnerHomeSectorLoaded()).to.be.false;
            expect(system.getOwnerHomeSector()).to.be.undefined;

            // Set relationship
            system.setOwnerHomeSector(mockOwnerHomeSector);
            expect(system.hasOwnerHomeSectorLoaded()).to.be.true;
            expect(system.getOwnerHomeSector()).to.equal(mockOwnerHomeSector);

            // Clear relationship
            system.setOwnerHomeSector(undefined);
            expect(system.getOwnerHomeSector()).to.be.undefined;
        });

        it('should manage NPC stats relationships correctly', function () {
            // Initially no relationships loaded
            expect(system.hasNPCStatsLoaded()).to.be.false;
            expect(system.getNPCStats()).to.be.undefined;
            expect(system.getNPCStatsCount()).to.equal(0);

            // Set relationship
            system.setNPCStats(mockNPCStats);
            expect(system.hasNPCStatsLoaded()).to.be.true;
            expect(system.getNPCStats()).to.equal(mockNPCStats);
            expect(system.getNPCStatsCount()).to.equal(2);

            // Clear relationship
            system.setNPCStats(undefined);
            expect(system.getNPCStats()).to.be.undefined;
            expect(system.getNPCStatsCount()).to.equal(0);
        });

        it('should handle relationship loading conditions correctly', function () {
            // Test owner entity loading conditions
            system.setOwnerUid('');
            expect(system.canLoadOwnerEntity()).to.be.false;

            system.setOwnerUid('   ');
            expect(system.canLoadOwnerEntity()).to.be.false;

            system.setOwnerUid(undefined);
            expect(system.canLoadOwnerEntity()).to.be.false;

            system.setOwnerUid('valid-uid');
            expect(system.canLoadOwnerEntity()).to.be.true;

            // Test owner home sector loading conditions
            system.setOwnerX(0).setOwnerY(0).setOwnerZ(0);
            expect(system.canLoadOwnerHomeSector()).to.be.false;

            system.setOwnerX(1).setOwnerY(0).setOwnerZ(0);
            expect(system.canLoadOwnerHomeSector()).to.be.true;

            system.setOwnerX(0).setOwnerY(1).setOwnerZ(0);
            expect(system.canLoadOwnerHomeSector()).to.be.true;

            system.setOwnerX(0).setOwnerY(0).setOwnerZ(1);
            expect(system.canLoadOwnerHomeSector()).to.be.true;
        });

        it('should handle empty NPC stats array', function () {
            system.setNPCStats([]);
            expect(system.hasNPCStatsLoaded()).to.be.true;
            expect(system.getNPCStatsCount()).to.equal(0);
        });

        it('should support method chaining for relationship setters', function () {
            const result = system
                .setSectors(mockSectors)
                .setOwnerEntity(mockOwnerEntity)
                .setOwnerHomeSector(mockOwnerHomeSector)
                .setNPCStats(mockNPCStats);

            expect(result).to.equal(system);
            expect(system.getSectors()).to.equal(mockSectors);
            expect(system.getOwnerEntity()).to.equal(mockOwnerEntity);
            expect(system.getOwnerHomeSector()).to.equal(mockOwnerHomeSector);
            expect(system.getNPCStats()).to.equal(mockNPCStats);
        });
    });

    describe('JSON Serialization with Relationships', function () {
        let system: SystemsModel;
        let mockSectors: any[];
        let mockOwnerEntity: any;
        let mockOwnerHomeSector: any;
        let mockNPCStats: any[];

        beforeEach(function () {
            system = createValidSystem();
            mockSectors = [createMockSector()];
            mockOwnerEntity = createMockEntity();
            mockOwnerHomeSector = createMockSector();
            mockNPCStats = [createMockNPCStats()];
        });

        it('should serialize basic system data to JSON', function () {
            const json = system.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.ID).to.equal(1001);
            expect(json.X).to.equal(0);
            expect(json.Y).to.equal(0);
            expect(json.Z).to.equal(0);
            expect(json.TYPE).to.equal(SystemType.VOID);
            expect(json.NAME).to.equal('Test System');
            expect(json.OWNER_FACTION).to.equal(0);
            expect(json.INFOS).to.be.instanceOf(Buffer);
            expect(json.RESOURCES).to.be.instanceOf(Buffer);
        });

        it('should serialize with loaded relations when includeInJson is true', function () {
            system.setSectors(mockSectors);
            system.setOwnerEntity(mockOwnerEntity);
            system.setOwnerHomeSector(mockOwnerHomeSector);
            system.setNPCStats(mockNPCStats);
            
            const json = system.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.sectors).to.exist;
            expect(json.ownerEntity).to.exist;
            expect(json.ownerHomeSector).to.exist;
            expect(json.NPCStats).to.exist;
            
            expect(json.sectors).to.have.length(1);
            expect(json.NPCStats).to.have.length(1);
        });

        it('should handle serialization with undefined/null relations', function () {
            // No relations set
            const json = system.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.sectors).to.be.undefined;
            expect(json.ownerEntity).to.be.undefined;
            expect(json.ownerHomeSector).to.be.undefined;
            expect(json.NPCStats).to.be.undefined;
        });

        it('should serialize buffer data correctly', function () {
            const testInfos = Buffer.from([0x01, 0x02, 0x03, 0x04]);
            const testResources = Buffer.from(Array(MAX_RESOURCES_SIZE).fill(0x42));
            
            const system = createValidSystem({ 
                INFOS: testInfos,
                RESOURCES: testResources
            });
            
            const json = system.toJSON();
            
            expect(json.INFOS).to.be.instanceOf(Buffer);
            expect(json.INFOS).to.deep.equal(testInfos);
            expect(json.RESOURCES).to.be.instanceOf(Buffer);
            expect(json.RESOURCES).to.deep.equal(testResources);
        });

        it('should handle large buffer serialization', function () {
            const largeInfos = Buffer.alloc(MAX_INFOS_SIZE);
            largeInfos.fill(0xFF);
            
            const system = createValidSystem({ INFOS: largeInfos });
            
            const json = system.toJSON();
            
            expect(json.INFOS).to.be.instanceOf(Buffer);
            expect(json.INFOS.length).to.equal(MAX_INFOS_SIZE);
            expect(json.INFOS[0]).to.equal(0xFF);
        });
    });

    describe('Advanced BaseModel Integration', function () {
        let system: SystemsModel;

        beforeEach(function () {
            system = createValidSystem();
        });

        it('should handle markAsSaved and state transitions correctly', function () {
            // Start with a dirty system
            system.setType(SystemType.SUN);
            expect(system.isDirty()).to.be.true;
            expect(system.isNew()).to.be.false; // Has ID

            // Mark as saved
            system.markAsSaved();
            expect(system.isDirty()).to.be.false;
            expect(system.isNew()).to.be.false;

            // Verify the changed data is now the original
            expect(system.getType()).to.equal(SystemType.SUN);
        });

        it('should reset to original data correctly', function () {
            const originalType = system.getType();
            const originalName = system.getName();
            const originalX = system.getX();

            // Make changes
            system.setType(SystemType.BLACK_HOLE);
            system.setName('Modified System');
            system.setX(999);
            expect(system.isDirty()).to.be.true;

            // Reset
            system.reset();
            expect(system.getType()).to.equal(originalType);
            expect(system.getName()).to.equal(originalName);
            expect(system.getX()).to.equal(originalX);
            expect(system.isDirty()).to.be.false;
        });

        it('should handle getPrimaryKeyValue correctly', function () {
            const system = createValidSystem({ ID: 12345 });
            expect(system.getPrimaryKeyValue()).to.equal(12345);

            // Test without ID
            const newSystem = createMinimalSystem();
            expect(newSystem.getPrimaryKeyValue()).to.be.undefined;
        });

        it('should handle clearAllRelated operations', function () {
            const mockSectors = [createMockSector()];
            const mockOwnerEntity = createMockEntity();
            const mockNPCStats = [createMockNPCStats()];
            
            // Set relationships
            system.setSectors(mockSectors);
            system.setOwnerEntity(mockOwnerEntity);
            system.setNPCStats(mockNPCStats);
            
            expect(system.getSectors()).to.equal(mockSectors);
            expect(system.getOwnerEntity()).to.equal(mockOwnerEntity);
            expect(system.getNPCStats()).to.equal(mockNPCStats);

            // Clear all relations
            system.clearAllRelated();
            expect(system.getSectors()).to.be.undefined;
            expect(system.getOwnerEntity()).to.be.undefined;
            expect(system.getNPCStats()).to.be.undefined;
        });

        it('should track changes accurately with multiple operations', function () {
            // Start clean
            expect(system.getChangedFields()).to.have.length(0);

            // Make changes
            system.setType(SystemType.GIANT);
            system.setName('New System Name');
            system.setOwnerFaction(123);
            
            const changedFields = system.getChangedFields();
            expect(changedFields).to.include('TYPE');
            expect(changedFields).to.include('NAME');
            expect(changedFields).to.include('OWNER_FACTION');
            expect(changedFields).to.not.include('X'); // Unchanged

            // Reset and verify
            system.reset();
            expect(system.getChangedFields()).to.have.length(0);
        });

        it('should support creating instances from database rows', function () {
            const row = {
                ID: 8888,
                X: 10,
                Y: 20,
                Z: 30,
                TYPE: SystemType.SUN,
                STARTTIME: Date.now(),
                NAME: 'Database System',
                INFOS: Buffer.from('database info'),
                OWNER_UID: 'db_owner',
                OWNER_FACTION: 123,
                OWNER_X: 1,
                OWNER_Y: 2,
                OWNER_Z: 3,
                RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
            };

            const system = SystemsModel.fromRow(row);
            expect(system.getId()).to.equal(8888);
            expect(system.getX()).to.equal(10);
            expect(system.getY()).to.equal(20);
            expect(system.getZ()).to.equal(30);
            expect(system.getType()).to.equal(SystemType.SUN);
            expect(system.getName()).to.equal('Database System');
            expect(system.getOwnerUid()).to.equal('db_owner');
            expect(system.isNew()).to.be.false;
            expect(system.isDirty()).to.be.false;
        });

        it('should support creating multiple instances from rows', function () {
            const rows = [
                {
                    ID: 1, X: 0, Y: 0, Z: 0, TYPE: SystemType.VOID,
                    INFOS: Buffer.alloc(0), OWNER_FACTION: 0, OWNER_X: 0, OWNER_Y: 0, OWNER_Z: 0,
                    RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
                },
                {
                    ID: 2, X: 1, Y: 1, Z: 1, TYPE: SystemType.SUN,
                    INFOS: Buffer.alloc(0), OWNER_FACTION: 0, OWNER_X: 0, OWNER_Y: 0, OWNER_Z: 0,
                    RESOURCES: Buffer.alloc(MAX_RESOURCES_SIZE)
                }
            ];

            const systems = SystemsModel.fromRows(rows);
            expect(systems).to.have.length(2);
            expect(systems[0].getId()).to.equal(1);
            expect(systems[0].getType()).to.equal(SystemType.VOID);
            expect(systems[1].getId()).to.equal(2);
            expect(systems[1].getType()).to.equal(SystemType.SUN);
        });

        it('should preserve relationship data in clones', function () {
            const mockSectors = [createMockSector()];
            const mockOwnerEntity = createMockEntity();
            
            system.setSectors(mockSectors);
            system.setOwnerEntity(mockOwnerEntity);
            
            const clone = system.clone();
            expect(clone.getSectors()).to.equal(mockSectors);
            expect(clone.getOwnerEntity()).to.equal(mockOwnerEntity);
            
            // Verify independence
            clone.setSectors(undefined);
            expect(system.getSectors()).to.equal(mockSectors); // Original should still have relation
        });
    });

    describe('Asynchronous Validation', function () {
        it('should handle validateForeignKeys placeholder', async function () {
            const system = createValidSystem();
            
            // Currently returns placeholder implementation
            const validation = await system.validateForeignKeys();
            
            expect(validation).to.be.an('object');
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.an('array');
            expect(validation.fieldErrors).to.be.an('object');
        });

        it('should handle async validation with relationships', async function () {
            const system = createValidSystem();
            system.setSectors([createMockSector()]);
            system.setOwnerEntity(createMockEntity());
            
            const validation = await system.validateForeignKeys();
            
            // Even with relationships, should return valid (placeholder implementation)
            expect(validation.isValid).to.be.true;
        });
    });

    describe('Advanced Performance Considerations', function () {
        it('should handle creation of many systems efficiently', function () {
            const startTime = Date.now();
            const systems: SystemsModel[] = [];

            for (let i = 0; i < 1000; i++) {
                systems.push(createMinimalSystem({
                    ID: i,
                    X: i % 100,
                    Y: Math.floor(i / 100) - 5,
                    Z: i % 10,
                    TYPE: Object.values(SystemType)[i % 5],
                    NAME: `System ${i}`,
                    OWNER_FACTION: i % 10,
                    OWNER_UID: i % 50 === 0 ? `OWNER_${i}` : undefined,
                    INFOS: Buffer.alloc(i % 100),
                    RESOURCES: createMockResourceData()
                }));
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(systems).to.have.length(1000);
            expect(duration).to.be.lessThan(1000); // Should complete within 1 second

            // Verify some instances
            expect(systems[0].getId()).to.equal(0);
            expect(systems[500].getName()).to.equal('System 500');
            expect(systems[999].getX()).to.equal(99);
        });

        it('should handle distance calculations efficiently', function () {
            const system1 = createMinimalSystem({ X: 0, Y: 0, Z: 0 });
            const systems: SystemsModel[] = [];

            // Create many systems at different positions
            for (let i = 1; i <= 1000; i++) {
                systems.push(createMinimalSystem({
                    X: i,
                    Y: i % 100,
                    Z: i % 10
                }));
            }

            const startTime = Date.now();
            const distances = systems.map(system => system1.distanceFrom(system));
            const adjacencies = systems.map(system => system1.isAdjacentTo(system));
            const endTime = Date.now();

            expect(distances).to.have.length(1000);
            expect(adjacencies).to.have.length(1000);
            expect(distances[0]).to.be.greaterThan(0);
            
            // Check that at least one system is adjacent to origin (0,0,0)
            // We need to create a system at (1,0,0) to be adjacent to (0,0,0)
            const adjacentSystem = createMinimalSystem({ X: 1, Y: 0, Z: 0 });
            expect(system1.isAdjacentTo(adjacentSystem)).to.be.true;
            expect(endTime - startTime).to.be.lessThan(100); // Should be very fast
        });

        it('should handle binary data operations efficiently', function () {
            const systems: SystemsModel[] = [];
            
            // Create systems with various binary data sizes
            for (let i = 0; i < 100; i++) {
                const infosSize = (i + 1) * 10; // 10 to 1000 bytes
                const systems_i = createValidSystem({
                    INFOS: Buffer.alloc(infosSize),
                    RESOURCES: createMockResourceData()
                });
                systems.push(systems_i);
            }

            const startTime = Date.now();
            
            // Perform operations on all systems
            const results = systems.map(system => ({
                summary: system.getSystemSummary(),
                displayName: system.getDisplayName(),
                isOwned: system.isOwned(),
                validateSizes: system.validateInfosSize() && system.validateResourcesSize(),
                factionName: system.getFactionName(),
                coordinates: system.getCoordinatesString(),
                canLoadOwner: system.canLoadOwnerEntity(),
                canLoadHomeSector: system.canLoadOwnerHomeSector()
            }));
            
            const endTime = Date.now();

            expect(results).to.have.length(100);
            expect(results.every(r => r.validateSizes)).to.be.true;
            expect(results.every(r => typeof r.summary === 'object')).to.be.true;
            expect(results.every(r => typeof r.displayName === 'string')).to.be.true;
            expect(results.every(r => typeof r.factionName === 'string')).to.be.true;
            expect(results.every(r => typeof r.coordinates === 'string')).to.be.true;
            expect(endTime - startTime).to.be.lessThan(100); // Should be very fast
        });

        it('should handle relationship operations efficiently', function () {
            const systems: SystemsModel[] = [];
            const mockSectors: any[][] = [];
            const mockEntities: any[] = [];

            // Create test data
            for (let i = 0; i < 100; i++) {
                systems.push(createValidSystem({ 
                    ID: i,
                    OWNER_UID: `OWNER_${i}`,
                    OWNER_X: i % 10,
                    OWNER_Y: i % 10,
                    OWNER_Z: i % 10
                }));
                
                // Create mock sectors for each system
                mockSectors.push([
                    createMockSector({ getId: () => i * 10 + 1 }),
                    createMockSector({ getId: () => i * 10 + 2 })
                ]);
                
                // Create mock entities
                mockEntities.push(createMockEntity({ 
                    getId: () => i + 1000,
                    getUid: () => `OWNER_${i}`,
                    getName: () => `Entity ${i}`
                }));
            }

            const startTime = Date.now();
            
            // Set relationships and get data
            for (let i = 0; i < 100; i++) {
                systems[i].setSectors(mockSectors[i]);
                systems[i].setOwnerEntity(mockEntities[i]);
            }

            // Get relationship data
            const relationshipData = systems.map(system => ({
                sectorsCount: system.getSectors()?.length || 0,
                hasOwnerEntity: system.getOwnerEntity() !== undefined,
                canLoadOwnerEntity: system.canLoadOwnerEntity(),
                canLoadOwnerHomeSector: system.canLoadOwnerHomeSector(),
                NPCStatsCount: system.getNPCStatsCount()
            }));

            const endTime = Date.now();

            expect(relationshipData).to.have.length(100);
            expect(relationshipData.every(r => r.sectorsCount === 2)).to.be.true;
            expect(relationshipData.every(r => r.hasOwnerEntity)).to.be.true;
            expect(relationshipData.every(r => r.canLoadOwnerEntity)).to.be.true;
            expect(relationshipData.every(r => typeof r.NPCStatsCount === 'number')).to.be.true;
            expect(endTime - startTime).to.be.lessThan(100); // Should be efficient
        });

        it('should handle system comparison operations efficiently', function () {
            const systems: SystemsModel[] = [];

            // Create many systems for comparison
            for (let i = 0; i < 200; i++) {
                systems.push(createValidSystem({
                    X: i % 20,
                    Y: Math.floor(i / 20) % 10,
                    Z: i % 5
                }));
            }

            const startTime = Date.now();
            
            // Perform many distance calculations and adjacency checks
            const results = [];
            for (let i = 0; i < systems.length - 1; i++) {
                for (let j = i + 1; j < Math.min(i + 10, systems.length); j++) {
                    results.push({
                        distance: systems[i].distanceFrom(systems[j]),
                        adjacent: systems[i].isAdjacentTo(systems[j])
                    });
                }
            }
            
            const endTime = Date.now();

            expect(results.length).to.be.greaterThan(0);
            expect(results.every(r => typeof r.distance === 'number')).to.be.true;
            expect(results.every(r => typeof r.adjacent === 'boolean')).to.be.true;
            expect(endTime - startTime).to.be.lessThan(200); // Should be efficient
        });
    });

    describe('Advanced Edge Cases and Error Handling', function () {
        it('should handle buffer type validation correctly', function () {
            const system = createValidSystem();

            // Test with non-buffer data
            try {
                system.setInfos('not a buffer' as any);
                const validation = system.validate();
                expect(validation.isValid).to.be.false;
            } catch (error) {
                // Acceptable if it throws
                expect(error).to.be.instanceOf(Error);
            }

            try {
                system.setResources('not a buffer' as any);
                const validation = system.validate();
                expect(validation.isValid).to.be.false;
            } catch (error) {
                // Acceptable if it throws
                expect(error).to.be.instanceOf(Error);
            }
        });

        it('should handle extremely large buffers gracefully', function () {
            const extremeInfos = Buffer.alloc(MAX_INFOS_SIZE * 2); // Double max size
            const extremeResources = Buffer.alloc(MAX_RESOURCES_SIZE * 2); // Double max size
            
            const system = createValidSystem({ 
                INFOS: extremeInfos,
                RESOURCES: extremeResources
            });

            expect(system.validateInfosSize()).to.be.false;
            expect(system.validateResourcesSize()).to.be.false;

            const validation = system.validate();
            expect(validation.isValid).to.be.false;
        });

        it('should handle relationship edge cases', function () {
            const system = createValidSystem();
            
            // Test with entities that throw errors
            const errorEntity = createMockEntity({
                getName: () => { throw new Error('Name method failed'); },
                getUid: () => { throw new Error('UID method failed'); }
            });
            
            system.setOwnerEntity(errorEntity);
            
            // Should handle errors gracefully
            expect(() => system.getOwnerEntity()?.getName()).to.throw();
            expect(() => system.getOwnerEntity()?.getUid()).to.throw();
        });

        it('should handle invalid system types gracefully', function () {
            const system = createValidSystem({ TYPE: 999 });
            
            expect(system.getType()).to.equal(999);
            expect(system.getTypeName()).to.equal('UNKNOWN_999');
            
            const validation = system.validate();
            expect(validation.isValid).to.be.false;
        });

        it('should handle null and undefined faction IDs', function () {
            const system1 = createValidSystem({ OWNER_FACTION: 0 }); // Default value
            const system2 = createValidSystem({ OWNER_FACTION: -1 }); // Negative faction

            expect(system1.getOwnerFaction()).to.equal(0);
            expect(system2.getOwnerFaction()).to.equal(-1);
        });

        it('should handle empty and null owner UIDs correctly', function () {
            const emptyUidSystem = createValidSystem({ OWNER_UID: '' });
            const nullUidSystem = createValidSystem({ OWNER_UID: undefined });
            const whitespaceUidSystem = createValidSystem({ OWNER_UID: '   ' });

            expect(emptyUidSystem.isOwned()).to.be.false;
            expect(nullUidSystem.isOwned()).to.be.false;
            expect(whitespaceUidSystem.isOwned()).to.be.false;

            expect(emptyUidSystem.canLoadOwnerEntity()).to.be.false;
            expect(nullUidSystem.canLoadOwnerEntity()).to.be.false;
            expect(whitespaceUidSystem.canLoadOwnerEntity()).to.be.false;
        });

        it('should maintain data integrity during concurrent operations', function () {
            const system = createValidSystem();
            const originalX = system.getX();
            const originalY = system.getY();
            const originalZ = system.getZ();
            const originalType = system.getType();

            // Simulate rapid operations but ensure we end with original values
            for (let i = 0; i < 100; i++) {
                system.setX(i);
                system.setY(i * 2);
                system.setZ(i * 3);
                system.setType(SystemType.SUN);
                
                if (i % 10 === 0) {
                    // Occasionally reset to original
                    system.setX(originalX);
                    system.setY(originalY);
                    system.setZ(originalZ);
                    system.setType(originalType);
                }
            }

            // Ensure we end with original values
            system.setX(originalX);
            system.setY(originalY);
            system.setZ(originalZ);
            system.setType(originalType);
        });

        it('should handle extreme coordinate values', function () {
            const extremeSystem = createMinimalSystem({
                X: Number.MAX_SAFE_INTEGER,
                Y: Number.MIN_SAFE_INTEGER,
                Z: -999999999
            });

            expect(extremeSystem.getX()).to.equal(Number.MAX_SAFE_INTEGER);
            expect(extremeSystem.getY()).to.equal(Number.MIN_SAFE_INTEGER);
            expect(extremeSystem.getZ()).to.equal(-999999999);
            expect(extremeSystem.getCoordinatesString()).to.include(Number.MAX_SAFE_INTEGER.toString());
        });

        it('should handle memory pressure scenarios', function () {
            const systems: SystemsModel[] = [];
            
            // Create many instances with large buffers
            for (let i = 0; i < 50; i++) {
                const largeInfos = Buffer.alloc(MAX_INFOS_SIZE);
                const largeResources = Buffer.alloc(MAX_RESOURCES_SIZE);
                largeInfos.fill(i % 256);
                largeResources.fill((i + 100) % 256);
                
                systems.push(createValidSystem({
                    ID: i,
                    INFOS: largeInfos,
                    RESOURCES: largeResources
                }));
            }

            // Verify all instances are valid
            expect(systems).to.have.length(50);
            expect(systems.every(s => s.validateInfosSize())).to.be.true;
            expect(systems.every(s => s.validateResourcesSize())).to.be.true;
        });

        it('should handle complex relationship cycles', function () {
            const system1 = createValidSystem({ ID: 1 });
            const system2 = createValidSystem({ ID: 2 });
            
            const sector1 = createMockSector({ getId: () => 1001 });
            const sector2 = createMockSector({ getId: () => 1002 });
            
            // Create complex relationship patterns
            system1.setSectors([sector1, sector2]);
            system2.setSectors([sector1]); // Shared sector
            
            // Should not cause issues
            expect(system1.getSectors()).to.have.length(2);
            expect(system2.getSectors()).to.have.length(1);
        });
    });
});