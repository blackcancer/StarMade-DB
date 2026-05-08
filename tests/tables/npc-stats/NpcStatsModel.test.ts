/**
 * @fileoverview NPCStatsModel Comprehensive Tests
 * 
 * Complete test suite for the NPCStatsModel class covering 100% functionality:
 * - Model creation and data manipulation
 * - NPC spawn statistics and analytics
 * - System coordinate management
 * - Faction identification and threat assessment
 * - Bidirectional relationships and intelligence
 * - Advanced BaseModel integration
 * - Schema consistency validation
 * - JSON serialization with relations
 * - Validation rules and constraints
 * - Error handling and edge cases
 * - Performance considerations
 * 
 * Following TDD principles and mirror structure as defined in AGENT.md
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import {
    NPCStatsModel,
    BaseModel,
    DataType,
    type ModelValidationResult
} from '../../../src/tables/index.js';

// Import Model helper from BaseModel
import { Model } from '../../../src/tables/BaseModel.js';

// =============================================================================
// TEST DATA AND HELPERS
// =============================================================================

/**
 * Create a valid NPC stats record for testing
 */
function createValidNPCStats(overrides: Partial<any> = {}): NPCStatsModel {
    return new NPCStatsModel({
        ID: -10000000,
        SYS_X: 0,
        SYS_Y: 0,
        SYS_Z: 0,
        FLEET_SPAWNS: 5,
        ENTITY_SPAWNS: 12,
        ...overrides
    });
}

/**
 * Create NPC stats with minimal required data
 */
function createMinimalNPCStats(overrides: Partial<any> = {}): NPCStatsModel {
    return new NPCStatsModel({
        ID: -10000000, // Now required
        SYS_X: 0,
        SYS_Y: 0,
        SYS_Z: 0,
        ...overrides
    });
}

/**
 * Create NPC stats for different faction types
 */
function createNPCStatsForFaction(factionId: number | undefined, overrides: Partial<any> = {}): NPCStatsModel {
    return createValidNPCStats({
        ID: factionId,
        ...overrides
    });
}

/**
 * Create a mock system for relationship testing
 */
function createMockSystem(overrides: Partial<any> = {}): any {
    return {
        getId: () => 1001,
        getName: () => 'Sol System',
        getTypeName: () => 'STAR',
        getX: () => 0,
        getY: () => 0,
        getZ: () => 0,
        getProtectionLevel: () => 'UNPROTECTED',
        isProtected: () => false,
        toJSON: () => ({ 
            id: overrides.getId ? overrides.getId() : 1001, 
            name: overrides.getName ? overrides.getName() : 'Sol System', 
            type: overrides.getTypeName ? overrides.getTypeName() : 'STAR',
            protection: overrides.getProtectionLevel ? overrides.getProtectionLevel() : 'UNPROTECTED'
        }),
        ...overrides
    };
}

// =============================================================================
// NPC STATS MODEL TESTS
// =============================================================================

describe('NPCStatsModel Comprehensive Tests', function() {
    
    describe('Model Creation and Basic Operations', function() {
        it('should create NPC stats with minimal required data', function() {
            const stats = createMinimalNPCStats({ ID: -10000000 }); // ID now required

            expect(stats.getId()).to.equal(-10000000);
            expect(stats.getSysX()).to.equal(0);
            expect(stats.getSysY()).to.equal(0);
            expect(stats.getSysZ()).to.equal(0);
            expect(stats.getFleetSpawns()).to.equal(0); // Default value with || 0
            expect(stats.getEntitySpawns()).to.equal(0); // Default value with || 0
        });

        it('should create NPC stats with complete data', function() {
            const stats = createValidNPCStats({
                ID: -9999999,
                SYS_X: -15,
                SYS_Y: 25,
                SYS_Z: -8,
                FLEET_SPAWNS: 3,
                ENTITY_SPAWNS: 7
            });

            expect(stats.getId()).to.equal(-9999999);
            expect(stats.getSysX()).to.equal(-15);
            expect(stats.getSysY()).to.equal(25);
            expect(stats.getSysZ()).to.equal(-8);
            expect(stats.getFleetSpawns()).to.equal(3);
            expect(stats.getEntitySpawns()).to.equal(7);
        });

        it('should handle defined ID correctly', function() {
            const stats = createValidNPCStats({ ID: -10000000 });
            
            expect(stats.getId()).to.equal(-10000000);
            stats.setId(-9999999);
            expect(stats.getId()).to.equal(-9999999);
        });
    });

    describe('Data Manipulation and Accessors', function() {
        let stats: NPCStatsModel;

        beforeEach(function() {
            stats = createValidNPCStats();
        });

        it('should get and set all fields correctly', function() {
            stats.setId(-9999998);
            expect(stats.getId()).to.equal(-9999998);

            stats.setSysX(-100);
            expect(stats.getSysX()).to.equal(-100);

            stats.setSysY(200);
            expect(stats.getSysY()).to.equal(200);

            stats.setSysZ(-50);
            expect(stats.getSysZ()).to.equal(-50);

            stats.setFleetSpawns(15);
            expect(stats.getFleetSpawns()).to.equal(15);

            stats.setEntitySpawns(25);
            expect(stats.getEntitySpawns()).to.equal(25);
        });

        it('should support method chaining for setters', function() {
            const result = stats
                .setId(-9999997)
                .setSysX(10)
                .setSysY(20)
                .setSysZ(30)
                .setFleetSpawns(8)
                .setEntitySpawns(16);

            expect(result).to.equal(stats); // Should return same instance
            expect(stats.getId()).to.equal(-9999997);
            expect(stats.getSysX()).to.equal(10);
            expect(stats.getSysY()).to.equal(20);
            expect(stats.getSysZ()).to.equal(30);
            expect(stats.getFleetSpawns()).to.equal(8);
            expect(stats.getEntitySpawns()).to.equal(16);
        });

        it('should handle zero spawn counts', function() {
            stats.setFleetSpawns(0);
            stats.setEntitySpawns(0);

            expect(stats.getFleetSpawns()).to.equal(0);
            expect(stats.getEntitySpawns()).to.equal(0);
            expect(stats.getTotalSpawns()).to.equal(0);
        });
    });

    describe('System Coordinate Methods', function() {
        it('should format system coordinates correctly', function() {
            const stats = createValidNPCStats({
                SYS_X: -15,
                SYS_Y: 25,
                SYS_Z: -8
            });

            expect(stats.getSystemCoordinatesString()).to.equal('(-15, 25, -8)');
        });

        it('should handle zero coordinates', function() {
            const stats = createValidNPCStats({
                SYS_X: 0,
                SYS_Y: 0,
                SYS_Z: 0
            });

            expect(stats.getSystemCoordinatesString()).to.equal('(0, 0, 0)');
        });

        it('should handle extreme coordinate values', function() {
            const stats = createValidNPCStats({
                SYS_X: -999999,
                SYS_Y: 999999,
                SYS_Z: -999999
            });

            expect(stats.getSystemCoordinatesString()).to.equal('(-999999, 999999, -999999)');
        });
    });

    describe('Spawn Statistics', function() {
        it('should calculate total spawns correctly', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: 5,
                ENTITY_SPAWNS: 12
            });

            expect(stats.getTotalSpawns()).to.equal(17);
        });

        it('should handle zero fleet spawns', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: 0,
                ENTITY_SPAWNS: 8
            });

            expect(stats.getTotalSpawns()).to.equal(8);
        });

        it('should handle zero entity spawns', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: 6,
                ENTITY_SPAWNS: 0
            });

            expect(stats.getTotalSpawns()).to.equal(6);
        });

        it('should handle large spawn numbers', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: 999999,
                ENTITY_SPAWNS: 888888
            });

            expect(stats.getTotalSpawns()).to.equal(1888887);
        });
    });

    describe('Faction Management', function() {
        it('should identify Trading Guild faction', function() {
            const stats = createNPCStatsForFaction(-10000000);
            expect(stats.getFactionName()).to.equal('Trading Guild');
        });

        it('should identify Outcasts faction', function() {
            const stats = createNPCStatsForFaction(-9999999);
            expect(stats.getFactionName()).to.equal('Outcasts');
        });

        it('should identify Scavengers faction', function() {
            const stats = createNPCStatsForFaction(-9999998);
            expect(stats.getFactionName()).to.equal('Scavengers');
        });

        it('should handle unknown faction IDs', function() {
            const stats = createNPCStatsForFaction(-12345);
            expect(stats.getFactionName()).to.equal('Faction -12345');
        });

        it('should handle positive faction IDs', function() {
            const stats = createNPCStatsForFaction(123);
            expect(stats.getFactionName()).to.equal('Faction 123');
        });

        it('should handle undefined faction ID correctly', function() {
            // Since ID is now required, we use a valid faction ID for this test
            const stats = createNPCStatsForFaction(-12345);
            expect(stats.getFactionName()).to.equal('Faction -12345');
        });
    });

    describe('Validation Rules and Constraints', function() {
        it('should pass validation with valid data', function() {
            const stats = createValidNPCStats();
            const validation = stats.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should require ID, system X, Y and Z coordinates', function() {
            const stats = new NPCStatsModel({
                // Missing all required fields: ID, SYS_X, SYS_Y, SYS_Z
            });

            const validation = stats.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID).to.include("Field 'ID' is required");
            expect(validation.fieldErrors.SYS_X).to.include("Field 'SYS_X' is required");
            expect(validation.fieldErrors.SYS_Y).to.include("Field 'SYS_Y' is required");
            expect(validation.fieldErrors.SYS_Z).to.include("Field 'SYS_Z' is required");
        });

        it('should require system X coordinate', function() {
            const stats = new NPCStatsModel({
                ID: -10000000, // Now required
                SYS_Y: 0,
                SYS_Z: 0
                // Missing SYS_X
            });

            const validation = stats.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.SYS_X).to.include("Field 'SYS_X' is required");
        });

        it('should require system Y coordinate', function() {
            const stats = new NPCStatsModel({
                ID: -10000000, // Now required
                SYS_X: 0,
                SYS_Z: 0
                // Missing SYS_Y
            });

            const validation = stats.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.SYS_Y).to.include("Field 'SYS_Y' is required");
        });

        it('should require system Z coordinate', function() {
            const stats = new NPCStatsModel({
                ID: -10000000, // Now required
                SYS_X: 0,
                SYS_Y: 0
                // Missing SYS_Z
            });

            const validation = stats.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.SYS_Z).to.include("Field 'SYS_Z' is required");
        });

        it('should enforce non-negative fleet spawns', function() {
            const stats = createValidNPCStats({ FLEET_SPAWNS: -1 });
            const validation = stats.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.FLEET_SPAWNS).to.include('Fleet spawns cannot be negative');
        });

        it('should enforce non-negative entity spawns', function() {
            const stats = createValidNPCStats({ ENTITY_SPAWNS: -5 });
            const validation = stats.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ENTITY_SPAWNS).to.include('Entity spawns cannot be negative');
        });

        it('should allow zero spawn values', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: 0,
                ENTITY_SPAWNS: 0
            });
            const validation = stats.validate();

            expect(validation.isValid).to.be.true;
        });
    });

    describe('Schema Definition Validation', function() {
        it('should have correct table name', function() {
            expect(NPCStatsModel.getTableName()).to.equal('NPC_STATS');
            expect(NPCStatsModel.tableName).to.equal('NPC_STATS');
        });

        it('should have correct schema structure', function() {
            const schema = NPCStatsModel.getSchema();

            expect(schema.tableName).to.equal('NPC_STATS');
            expect(schema.comment).to.equal('NPC spawn statistics by system');
            expect(schema.columns).to.be.an('array').with.length(6);
            expect(schema.primaryKey).to.deep.equal(['ID', 'SYS_X', 'SYS_Y', 'SYS_Z']);
            expect(schema.foreignKeys).to.be.an('array').with.length(0);
            expect(schema.indexes).to.be.an('array').with.length(3);
        });

        it('should have correct column definitions', function() {
            const schema = NPCStatsModel.getSchema();
            const columns = schema.columns;

            const idColumn = columns.find(col => col.name === 'ID');
            expect(idColumn).to.exist;
            expect(idColumn!.type).to.equal(DataType.INTEGER);
            expect(idColumn!.primaryKey).to.be.true;
            expect(idColumn!.nullable).to.be.false; // Now non-nullable for data integrity

            const sysXColumn = columns.find(col => col.name === 'SYS_X');
            expect(sysXColumn).to.exist;
            expect(sysXColumn!.type).to.equal(DataType.INTEGER);
            expect(sysXColumn!.primaryKey).to.be.true;
            expect(sysXColumn!.nullable).to.be.false;

            const fleetSpawnsColumn = columns.find(col => col.name === 'FLEET_SPAWNS');
            expect(fleetSpawnsColumn).to.exist;
            expect(fleetSpawnsColumn!.type).to.equal(DataType.INTEGER);
            expect(fleetSpawnsColumn!.nullable).to.be.true;
            expect(fleetSpawnsColumn!.defaultValue).to.equal(0);

            const entitySpawnsColumn = columns.find(col => col.name === 'ENTITY_SPAWNS');
            expect(entitySpawnsColumn).to.exist;
            expect(entitySpawnsColumn!.type).to.equal(DataType.INTEGER);
            expect(entitySpawnsColumn!.nullable).to.be.true;
            expect(entitySpawnsColumn!.defaultValue).to.equal(0);
        });

        it('should have correct indexes', function() {
            const schema = NPCStatsModel.getSchema();
            const indexes = schema.indexes;

            const coordsIndex = indexes.find(idx => idx.name === 'NPC_STATS_COORDS_IDX');
            expect(coordsIndex).to.exist;
            expect(coordsIndex!.columns).to.deep.equal(['SYS_X', 'SYS_Y', 'SYS_Z']);

            const fleetSpawnsIndex = indexes.find(idx => idx.name === 'NPC_STATS_FLEET_SPAWNS_IDX');
            expect(fleetSpawnsIndex).to.exist;
            expect(fleetSpawnsIndex!.columns).to.deep.equal(['FLEET_SPAWNS']);

            const entitySpawnsIndex = indexes.find(idx => idx.name === 'NPC_STATS_ENTITY_SPAWNS_IDX');
            expect(entitySpawnsIndex).to.exist;
            expect(entitySpawnsIndex!.columns).to.deep.equal(['ENTITY_SPAWNS']);
        });
    });

    describe('Model Inheritance and BaseModel Integration', function() {
        it('should extend BaseModel correctly', function() {
            const stats = createValidNPCStats();
            expect(stats).to.be.instanceOf(BaseModel);
            expect(stats).to.be.instanceOf(NPCStatsModel);
        });

        it('should support BaseModel functionality', function() {
            const stats = createValidNPCStats();

            // Test change tracking
            expect(stats.isDirty()).to.be.false;
            stats.setFleetSpawns(20);
            expect(stats.isDirty()).to.be.true;

            // Test new record detection - NPCStatsModel has composite PK with non-nullable ID
            const newStats = createMinimalNPCStats(); // ID is now provided
            expect(newStats.getId()).to.equal(-10000000);

            // Test cloning
            const clone = stats.clone();
            expect(clone.getSystemCoordinatesString()).to.equal(stats.getSystemCoordinatesString());
            expect(clone.getTotalSpawns()).to.equal(stats.getTotalSpawns());
        });
    });

    describe('Edge Cases and Error Handling', function() {
        it('should handle null spawn values gracefully', function() {
            const stats = new NPCStatsModel({
                ID: -10000000, // Now required
                SYS_X: 0,
                SYS_Y: 0,
                SYS_Z: 0,
                FLEET_SPAWNS: null,
                ENTITY_SPAWNS: null
            });

            expect(stats.getFleetSpawns()).to.equal(0); // Due to || 0
            expect(stats.getEntitySpawns()).to.equal(0); // Due to || 0
            expect(stats.getTotalSpawns()).to.equal(0);
        });

        it('should handle undefined spawn values gracefully', function() {
            const stats = new NPCStatsModel({
                ID: -10000000, // Now required
                SYS_X: 0,
                SYS_Y: 0,
                SYS_Z: 0
                // FLEET_SPAWNS and ENTITY_SPAWNS undefined
            });

            expect(stats.getFleetSpawns()).to.equal(0); // Due to || 0
            expect(stats.getEntitySpawns()).to.equal(0); // Due to || 0
            expect(stats.getTotalSpawns()).to.equal(0);
        });

        it('should maintain data integrity during operations', function() {
            const stats = createValidNPCStats();
            const originalCoords = stats.getSystemCoordinatesString();
            const originalId = stats.getId();

            // Perform multiple spawn updates
            stats.setFleetSpawns(10);
            stats.setEntitySpawns(20);
            stats.setFleetSpawns(5);

            // Core properties should remain unchanged
            expect(stats.getSystemCoordinatesString()).to.equal(originalCoords);
            expect(stats.getId()).to.equal(originalId);
        });

        it('should handle very large spawn numbers', function() {
            const stats = createValidNPCStats({
                FLEET_SPAWNS: Number.MAX_SAFE_INTEGER - 1,
                ENTITY_SPAWNS: 1
            });

            expect(stats.getFleetSpawns()).to.equal(Number.MAX_SAFE_INTEGER - 1);
            expect(stats.getEntitySpawns()).to.equal(1);
            expect(stats.getTotalSpawns()).to.equal(Number.MAX_SAFE_INTEGER);
        });
    });

    describe('Composite Primary Key Behavior', function() {
        it('should support composite primary key structure', function() {
            const schema = NPCStatsModel.getSchema();
            const primaryKey = schema.primaryKey;

            expect(primaryKey).to.be.an('array').with.length(4);
            expect(primaryKey).to.include('ID');
            expect(primaryKey).to.include('SYS_X');
            expect(primaryKey).to.include('SYS_Y');
            expect(primaryKey).to.include('SYS_Z');
        });

        it('should create different records for same faction in different systems', function() {
            const stats1 = createNPCStatsForFaction(-10000000, {
                SYS_X: 0, SYS_Y: 0, SYS_Z: 0
            });
            const stats2 = createNPCStatsForFaction(-10000000, {
                SYS_X: 1, SYS_Y: 0, SYS_Z: 0
            });

            expect(stats1.getId()).to.equal(stats2.getId());
            expect(stats1.getSystemCoordinatesString()).to.not.equal(stats2.getSystemCoordinatesString());
        });

        it('should create different records for different factions in same system', function() {
            const stats1 = createNPCStatsForFaction(-10000000, {
                SYS_X: 0, SYS_Y: 0, SYS_Z: 0
            });
            const stats2 = createNPCStatsForFaction(-9999999, {
                SYS_X: 0, SYS_Y: 0, SYS_Z: 0
            });

            expect(stats1.getSystemCoordinatesString()).to.equal(stats2.getSystemCoordinatesString());
            expect(stats1.getId()).to.not.equal(stats2.getId());
            expect(stats1.getFactionName()).to.not.equal(stats2.getFactionName());
        });
    });

    describe('Performance Considerations', function() {
        it('should handle creation of many NPC stats efficiently', function() {
            const startTime = Date.now();
            const statsRecords: NPCStatsModel[] = [];

            const factionIds = [-10000000, -9999999, -9999998];
            
            for (let i = 0; i < 1000; i++) {
                statsRecords.push(createValidNPCStats({
                    ID: factionIds[i % factionIds.length],
                    SYS_X: i % 50,
                    SYS_Y: (i % 30) - 15,
                    SYS_Z: i % 20,
                    FLEET_SPAWNS: i % 10,
                    ENTITY_SPAWNS: (i % 15) + 1
                }));
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(statsRecords).to.have.length(1000);
            expect(duration).to.be.lessThan(1000); // Should complete within 1 second

            // Verify some instances
            expect(statsRecords[0].getFactionName()).to.equal('Trading Guild');
            expect(statsRecords[500].getSystemCoordinatesString()).to.be.a('string');
            expect(statsRecords[999].getTotalSpawns()).to.be.greaterThan(0);
        });

        it('should handle spawn calculations efficiently', function() {
            const statsRecords: NPCStatsModel[] = [];
            
            // Create many stats records
            for (let i = 0; i < 100; i++) {
                statsRecords.push(createValidNPCStats({
                    FLEET_SPAWNS: i % 20,
                    ENTITY_SPAWNS: (i % 25) + 1
                }));
            }

            const startTime = Date.now();
            
            // Perform many calculations
            const results = statsRecords.map(stats => ({
                coordinates: stats.getSystemCoordinatesString(),
                factionName: stats.getFactionName(),
                totalSpawns: stats.getTotalSpawns(),
                fleetSpawns: stats.getFleetSpawns(),
                entitySpawns: stats.getEntitySpawns()
            }));
            
            const endTime = Date.now();

            expect(results).to.have.length(100);
            expect(results.every(r => r.totalSpawns >= 0)).to.be.true;
            expect(endTime - startTime).to.be.lessThan(50); // Should be very fast
        });
    });

    // =============================================================================
    // ENHANCED EDITION TESTS - COMPLETE COVERAGE
    // =============================================================================

    describe('Advanced NPC Analytics', function () {
        it('should identify high-activity systems correctly', function () {
            const lowActivity = createValidNPCStats({ FLEET_SPAWNS: 3, ENTITY_SPAWNS: 2 });
            const highActivity = createValidNPCStats({ FLEET_SPAWNS: 8, ENTITY_SPAWNS: 7 });

            expect(lowActivity.isHighActivitySystem()).to.be.false;
            expect(highActivity.isHighActivitySystem()).to.be.true;
        });

        it('should determine spawn preferences correctly', function () {
            const fleetPreferred = createValidNPCStats({ FLEET_SPAWNS: 8, ENTITY_SPAWNS: 2 });
            const entityPreferred = createValidNPCStats({ FLEET_SPAWNS: 2, ENTITY_SPAWNS: 8 });
            const noActivity = createValidNPCStats({ FLEET_SPAWNS: 0, ENTITY_SPAWNS: 0 });

            expect(fleetPreferred.prefersFleetSpawns()).to.be.true;
            expect(entityPreferred.prefersFleetSpawns()).to.be.false;
            expect(noActivity.prefersFleetSpawns()).to.be.false;
        });

        it('should calculate spawn distribution ratios correctly', function () {
            const fleetDominant = createValidNPCStats({ FLEET_SPAWNS: 8, ENTITY_SPAWNS: 2 });
            const distribution = fleetDominant.getSpawnDistribution();

            expect(distribution.fleetRatio).to.equal(0.8);
            expect(distribution.entityRatio).to.equal(0.2);
            expect(distribution.dominantType).to.equal('FLEET');
        });

        it('should handle balanced spawn distribution', function () {
            const balanced = createValidNPCStats({ FLEET_SPAWNS: 5, ENTITY_SPAWNS: 5 });
            const distribution = balanced.getSpawnDistribution();

            expect(distribution.fleetRatio).to.equal(0.5);
            expect(distribution.entityRatio).to.equal(0.5);
            expect(distribution.dominantType).to.equal('BALANCED');
        });

        it('should handle no spawn activity', function () {
            const noActivity = createValidNPCStats({ FLEET_SPAWNS: 0, ENTITY_SPAWNS: 0 });
            const distribution = noActivity.getSpawnDistribution();

            expect(distribution.fleetRatio).to.equal(0);
            expect(distribution.entityRatio).to.equal(0);
            expect(distribution.dominantType).to.equal('NONE');
        });

        it('should classify activity levels correctly', function () {
            const none = createValidNPCStats({ FLEET_SPAWNS: 0, ENTITY_SPAWNS: 0 });
            const low = createValidNPCStats({ FLEET_SPAWNS: 1, ENTITY_SPAWNS: 2 });
            const moderate = createValidNPCStats({ FLEET_SPAWNS: 5, ENTITY_SPAWNS: 3 });
            const high = createValidNPCStats({ FLEET_SPAWNS: 12, ENTITY_SPAWNS: 8 });
            const veryHigh = createValidNPCStats({ FLEET_SPAWNS: 15, ENTITY_SPAWNS: 15 });

            expect(none.getActivityLevel()).to.equal('NONE');
            expect(low.getActivityLevel()).to.equal('LOW');
            expect(moderate.getActivityLevel()).to.equal('MODERATE');
            expect(high.getActivityLevel()).to.equal('HIGH');
            expect(veryHigh.getActivityLevel()).to.equal('VERY_HIGH');
        });

        it('should assess threat levels based on faction and activity', function () {
            const tradingGuild = createNPCStatsForFaction(-10000000, { FLEET_SPAWNS: 5, ENTITY_SPAWNS: 5 });
            const outcasts = createNPCStatsForFaction(-9999999, { FLEET_SPAWNS: 20, ENTITY_SPAWNS: 10 });
            const playerFaction = createNPCStatsForFaction(123, { FLEET_SPAWNS: 8, ENTITY_SPAWNS: 7 });

            const tradingThreat = tradingGuild.getThreatAssessment();
            const outcastsThreat = outcasts.getThreatAssessment();
            const playerThreat = playerFaction.getThreatAssessment();

            expect(tradingThreat.factionThreat).to.equal('FRIENDLY');
            expect(tradingThreat.level).to.equal('SAFE');

            expect(outcastsThreat.factionThreat).to.equal('HOSTILE');
            expect(outcastsThreat.level).to.equal('CRITICAL');

            expect(playerThreat.factionThreat).to.equal('NEUTRAL');
            expect(playerThreat.level).to.equal('MODERATE');
        });

        it('should compare activity between NPC stats correctly', function () {
            const stats1 = createValidNPCStats({ FLEET_SPAWNS: 10, ENTITY_SPAWNS: 5 });
            const stats2 = createValidNPCStats({ FLEET_SPAWNS: 8, ENTITY_SPAWNS: 2 });

            const comparison = stats1.compareActivityWith(stats2);

            expect(comparison.activityDifference).to.equal(5); // 15 - 10
            expect(comparison.moreActive).to.be.true;
            expect(comparison.comparison).to.include('5 more spawns');
        });

        it('should generate comprehensive NPC statistics summary', function () {
            const stats = createValidNPCStats({
                ID: -9999999, // Outcasts
                SYS_X: 10,
                SYS_Y: -5,
                SYS_Z: 20,
                FLEET_SPAWNS: 12,
                ENTITY_SPAWNS: 8
            });

            const summary = stats.getNPCStatsSummary();

            expect(summary.basic.id).to.equal(-9999999);
            expect(summary.basic.factionName).to.equal('Outcasts');
            expect(summary.basic.systemCoordinates).to.equal('(10, -5, 20)');
            expect(summary.basic.totalSpawns).to.equal(20);
            expect(summary.analysis.activityLevel).to.equal('HIGH');
            expect(summary.analysis.threatAssessment.level).to.equal('CRITICAL');
            expect(summary.analysis.isHighActivity).to.be.true;
            expect(summary.recommendations).to.be.an('array').that.is.not.empty;
        });
    });

    describe('Bidirectional Relationships and Intelligence', function () {
        let stats: NPCStatsModel;
        let mockSystem: any;

        beforeEach(function () {
            stats = createValidNPCStats();
            mockSystem = createMockSystem();
        });

        it('should manage system relationship correctly', function () {
            // Initially no relationship loaded
            expect(stats.hasSystemLoaded()).to.be.false;
            expect(stats.getSystem()).to.be.undefined;

            // Set relationship
            stats.setSystem(mockSystem);
            expect(stats.hasSystemLoaded()).to.be.true;
            expect(stats.getSystem()).to.equal(mockSystem);

            // Clear relationship
            stats.setSystem(undefined);
            expect(stats.getSystem()).to.be.undefined;
        });

        it('should generate enhanced summary with system intelligence', function () {
            const protectedSystem = createMockSystem({
                getName: () => 'Protected System Alpha',
                getTypeName: () => 'BINARY_STAR',
                isProtected: () => true
            });

            stats.setSystem(protectedSystem);
            const summary = stats.getNPCStatsSummary();

            expect(summary.system?.hasSystemLoaded).to.be.true;
            expect(summary.system?.systemInfo).to.equal(protectedSystem);
        });

        it('should handle missing system relation gracefully', function () {
            const summary = stats.getNPCStatsSummary();
            
            expect(summary.system?.hasSystemLoaded).to.be.false;
            expect(summary.system?.systemInfo).to.be.undefined;
        });

        it('should preserve system data in enhanced analytics', function () {
            const system = createMockSystem({
                getName: () => 'Analytics Test System',
                getProtectionLevel: () => 'PROTECTED'
            });

            stats.setSystem(system);
            expect(stats.hasSystemLoaded()).to.be.true;
            
            // System intelligence should be available for enhanced analysis
            const summary = stats.getNPCStatsSummary();
            expect(summary.system?.systemInfo?.getName()).to.equal('Analytics Test System');
        });
    });

    describe('Advanced BaseModel Integration', function () {
        let stats: NPCStatsModel;

        beforeEach(function () {
            stats = createValidNPCStats();
        });

        it('should handle markAsSaved and state transitions correctly', function () {
            // Start with a dirty stats record
            stats.setFleetSpawns(15);
            expect(stats.isDirty()).to.be.true;
            expect(stats.isNew()).to.be.false; // Has composite primary key

            // Mark as saved
            stats.markAsSaved();
            expect(stats.isDirty()).to.be.false;
            expect(stats.isNew()).to.be.false;

            // Verify the changed data is now the original
            expect(stats.getFleetSpawns()).to.equal(15);
        });

        it('should reset to original data correctly', function () {
            const originalFleetSpawns = stats.getFleetSpawns();
            const originalEntitySpawns = stats.getEntitySpawns();

            // Make changes
            stats.setFleetSpawns(99);
            stats.setEntitySpawns(88);
            expect(stats.isDirty()).to.be.true;

            // Reset
            stats.reset();
            expect(stats.getFleetSpawns()).to.equal(originalFleetSpawns);
            expect(stats.getEntitySpawns()).to.equal(originalEntitySpawns);
            expect(stats.isDirty()).to.be.false;
        });

        it('should handle composite primary key correctly', function () {
            const stats = createValidNPCStats({ 
                ID: -10000000, 
                SYS_X: 5, 
                SYS_Y: -3, 
                SYS_Z: 10 
            });
            
            const pk = stats.getPrimaryKeyValue();
            expect(pk).to.be.an('object');
            expect(pk.ID).to.equal(-10000000);
            expect(pk.SYS_X).to.equal(5);
            expect(pk.SYS_Y).to.equal(-3);
            expect(pk.SYS_Z).to.equal(10);
        });

        it('should clearAllRelated operations', function () {
            const mockSystem = createMockSystem();
            
            // Set system relationship
            stats.setSystem(mockSystem);
            expect(stats.hasSystemLoaded()).to.be.true;

            // Clear all relations
            stats.clearAllRelated();
            expect(stats.hasSystemLoaded()).to.be.false;
        });

        it('should track changes accurately with multiple operations', function () {
            // Start clean
            expect(stats.getChangedFields()).to.have.length(0);

            // Make changes
            stats.setFleetSpawns(25);
            stats.setEntitySpawns(30);
            
            const changedFields = stats.getChangedFields();
            expect(changedFields).to.include('FLEET_SPAWNS');
            expect(changedFields).to.include('ENTITY_SPAWNS');
            expect(changedFields).to.not.include('ID'); // Unchanged

            // Reset and verify
            stats.reset();
            expect(stats.getChangedFields()).to.have.length(0);
        });

        it('should support creating multiple instances from rows', function () {
            const rows = [
                {
                    ID: -10000000, SYS_X: 0, SYS_Y: 0, SYS_Z: 0,
                    FLEET_SPAWNS: 5, ENTITY_SPAWNS: 10
                },
                {
                    ID: -9999999, SYS_X: 1, SYS_Y: 1, SYS_Z: 1,
                    FLEET_SPAWNS: 15, ENTITY_SPAWNS: 20
                },
                {
                    ID: -9999998, SYS_X: 2, SYS_Y: 2, SYS_Z: 2,
                    FLEET_SPAWNS: 8, ENTITY_SPAWNS: 12
                }
            ];

            const statsRecords = NPCStatsModel.fromRows(rows);
            expect(statsRecords).to.have.length(3);
            expect(statsRecords[0].getFactionName()).to.equal('Trading Guild');
            expect(statsRecords[1].getFactionName()).to.equal('Outcasts');
            expect(statsRecords[2].getFactionName()).to.equal('Scavengers');
        });

        it('should preserve relationship data in clones', function () {
            const mockSystem = createMockSystem();
            
            stats.setSystem(mockSystem);
            
            const clone = stats.clone();
            expect(clone.hasSystemLoaded()).to.be.true;
            expect(clone.getSystem()).to.equal(mockSystem);
            
            // Verify independence
            clone.setSystem(undefined);
            expect(stats.hasSystemLoaded()).to.be.true; // Original should still have relation
        });
    });

    describe('Schema Consistency Validation', function () {
        it('should validate schema-relation consistency', function () {
            const consistency = NPCStatsModel.validateSchemaConsistency();
            
            expect(consistency).to.be.an('object');
            expect(consistency.isConsistent).to.be.a('boolean');
            expect(consistency.issues).to.be.an('array');
            expect(consistency.suggestions).to.be.an('array');

            // NPCStatsModel has system relation but no defined foreign keys in schema
            if (!consistency.isConsistent) {
                console.log('Schema consistency issues:', consistency.issues);
                console.log('Suggestions:', consistency.suggestions);
            }
        });

        it('should generate foreign keys from relations', function () {
            const generatedFKs = NPCStatsModel.generateForeignKeysFromRelations();
            
            expect(generatedFKs).to.be.an('array');
            
            // NPCStatsModel has BelongsToOneRelation (system)
            expect(generatedFKs.length).to.be.greaterThan(0);
            
            const systemFK = generatedFKs.find(fk => fk.name === 'FK_NPC_STATS_SYSTEM');
            if (systemFK) {
                expect(systemFK.columns).to.deep.equal(['SYS_X', 'SYS_Y', 'SYS_Z']);
                expect(systemFK.referencedTable).to.equal('SYSTEMS');
            }
        });

        it('should validate relationship mappings structure', function () {
            const relations = NPCStatsModel.getRelationMappings();
            
            expect(relations).to.be.an('object');
            expect(Object.keys(relations)).to.have.length(1);
            
            const systemRelation = relations.system;
            expect(systemRelation).to.exist;
            expect(systemRelation.relation).to.equal(Model.BelongsToOneRelation);
            expect(systemRelation.join.from).to.deep.equal(['NPC_STATS.SYS_X', 'NPC_STATS.SYS_Y', 'NPC_STATS.SYS_Z']);
            expect(systemRelation.join.to).to.deep.equal(['SYSTEMS.X', 'SYSTEMS.Y', 'SYSTEMS.Z']);
        });

        it('should get specific relation definition', function () {
            const systemRelation = NPCStatsModel.getRelation('system');
            expect(systemRelation).to.exist;
            expect(systemRelation!.relation).to.equal(Model.BelongsToOneRelation);

            const nonExistentRelation = NPCStatsModel.getRelation('nonexistent');
            expect(nonExistentRelation).to.be.undefined;
        });

        it('should resolve model classes correctly', function () {
            // Test with class reference
            const ClassModel = NPCStatsModel.resolveModelClass(NPCStatsModel);
            expect(ClassModel).to.equal(NPCStatsModel);

            // Test with function reference
            const FunctionModel = NPCStatsModel.resolveModelClass(() => NPCStatsModel);
            expect(FunctionModel).to.equal(NPCStatsModel);

            // Test with string reference (should throw)
            expect(() => NPCStatsModel.resolveModelClass('StringModel')).to.throw('String model references not yet implemented');
        });
    });

    describe('Enhanced JSON Serialization', function () {
        let stats: NPCStatsModel;
        let mockSystem: any;

        beforeEach(function () {
            stats = createValidNPCStats();
            mockSystem = createMockSystem();
        });

        it('should serialize basic NPC stats data to JSON', function () {
            const json = stats.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.ID).to.equal(-10000000);
            expect(json.SYS_X).to.equal(0);
            expect(json.SYS_Y).to.equal(0);
            expect(json.SYS_Z).to.equal(0);
            expect(json.FLEET_SPAWNS).to.equal(5);
            expect(json.ENTITY_SPAWNS).to.equal(12);
        });

        it('should serialize with loaded system relation when includeInJson is true', function () {
            // Set system relationship
            stats.setSystem(mockSystem);
            
            const json = stats.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.system).to.exist;
            expect(json.system).to.deep.equal({
                id: 1001,
                name: 'Sol System',
                type: 'STAR',
                protection: 'UNPROTECTED'
            });
        });

        it('should handle serialization with undefined/null relations', function () {
            // No relations set
            const json = stats.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.system).to.be.undefined;
        });

        it('should serialize spawn analytics data correctly', function () {
            const highActivityStats = createValidNPCStats({
                FLEET_SPAWNS: 15,
                ENTITY_SPAWNS: 10
            });
            
            const json = highActivityStats.toJSON();
            
            expect(json.FLEET_SPAWNS).to.equal(15);
            expect(json.ENTITY_SPAWNS).to.equal(10);
        });
    });

    describe('Enhanced NPC Intelligence and Analytics', function () {
        it('should provide strategic recommendations based on threat level', function () {
            const criticalThreat = createNPCStatsForFaction(-9999999, { 
                FLEET_SPAWNS: 20, 
                ENTITY_SPAWNS: 15 
            });

            const summary = criticalThreat.getNPCStatsSummary();

            expect(summary.analysis.threatAssessment.level).to.equal('CRITICAL');
            expect(summary.recommendations).to.include('?? CRITICAL THREAT: Avoid or prepare for heavy combat');
            expect(summary.recommendations).to.include('?? High NPC activity - expect frequent encounters');
        });

        it('should analyze spawn patterns for tactical intelligence', function () {
            const fleetHeavy = createValidNPCStats({ FLEET_SPAWNS: 18, ENTITY_SPAWNS: 2 });
            const entityHeavy = createValidNPCStats({ FLEET_SPAWNS: 2, ENTITY_SPAWNS: 18 });

            const fleetSummary = fleetHeavy.getNPCStatsSummary();
            const entitySummary = entityHeavy.getNPCStatsSummary();

            expect(fleetSummary.analysis.spawnDistribution.dominantType).to.equal('FLEET');
            // Vérifier que la recommandation contient le texte principal sans les icônes
            const fleetRecommendation = fleetSummary.recommendations.find(r => r.includes('Fleet-heavy activity'));
            expect(fleetRecommendation).to.exist;

            expect(entitySummary.analysis.spawnDistribution.dominantType).to.equal('ENTITY');
            const entityRecommendation = entitySummary.recommendations.find(r => r.includes('Entity-heavy activity'));
            expect(entityRecommendation).to.exist;
        });

        it('should provide trading recommendations for friendly factions', function () {
            const tradingGuild = createNPCStatsForFaction(-10000000, { 
                FLEET_SPAWNS: 8, 
                ENTITY_SPAWNS: 12 
            });

            const summary = tradingGuild.getNPCStatsSummary();

            expect(summary.analysis.threatAssessment.factionThreat).to.equal('FRIENDLY');
            expect(summary.recommendations).to.include('?? Trading opportunities may be available');
        });

        it('should handle activity comparison edge cases', function () {
            const stats1 = createValidNPCStats({ FLEET_SPAWNS: 10, ENTITY_SPAWNS: 10 });
            const stats2 = createValidNPCStats({ FLEET_SPAWNS: 10, ENTITY_SPAWNS: 10 });
            const stats3 = createValidNPCStats({ FLEET_SPAWNS: 9, ENTITY_SPAWNS: 10 });

            const sameComparison = stats1.compareActivityWith(stats2);
            expect(sameComparison.comparison).to.equal('Same activity level');

            const similarComparison = stats1.compareActivityWith(stats3);
            expect(similarComparison.comparison).to.equal('Similar activity levels');
        });

        it('should analyze system security implications', function () {
            const hostileSystem = createNPCStatsForFaction(-9999998, { // Scavengers
                SYS_X: 100,
                SYS_Y: -50,
                SYS_Z: 75,
                FLEET_SPAWNS: 25,
                ENTITY_SPAWNS: 20
            });

            const analysis = hostileSystem.getThreatAssessment();
            const summary = hostileSystem.getNPCStatsSummary();

            expect(analysis.level).to.equal('CRITICAL');
            expect(analysis.factionThreat).to.equal('HOSTILE');
            expect(analysis.reasoning).to.include('Scavengers - hostile faction');
            expect(analysis.reasoning).to.include('High hostile NPC activity: 45 total spawns');
        });
    });

    describe('NPC Faction Intelligence', function () {
        it('should provide detailed faction analysis', function () {
            const factions = [
                { id: -10000000, expected: 'Trading Guild', threat: 'FRIENDLY' },
                { id: -9999999, expected: 'Outcasts', threat: 'HOSTILE' },
                { id: -9999998, expected: 'Scavengers', threat: 'HOSTILE' },
                { id: 123, expected: 'Faction 123', threat: 'NEUTRAL' },
                { id: -12345, expected: 'Faction -12345', threat: 'NEUTRAL' }
            ];

            for (const faction of factions) {
                const stats = createNPCStatsForFaction(faction.id, { 
                    FLEET_SPAWNS: 10, 
                    ENTITY_SPAWNS: 10 
                });
                
                expect(stats.getFactionName()).to.equal(faction.expected);
                
                const threatAssessment = stats.getThreatAssessment();
                expect(threatAssessment.factionThreat).to.equal(faction.threat);
            }
        });

        it('should handle edge cases in faction identification', function () {
            const zeroFaction = createNPCStatsForFaction(0);
            const negativeFaction = createNPCStatsForFaction(-1);
            const largeFaction = createNPCStatsForFaction(999999);

            expect(zeroFaction.getFactionName()).to.equal('Faction 0');
            expect(negativeFaction.getFactionName()).to.equal('Faction -1');
            expect(largeFaction.getFactionName()).to.equal('Faction 999999');
        });
    });

    describe('Asynchronous Validation', function () {
        it('should handle validateForeignKeys placeholder', async function () {
            const stats = createValidNPCStats();
            
            // Currently returns placeholder implementation
            const validation = await stats.validateForeignKeys();
            
            expect(validation).to.be.an('object');
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.an('array');
            expect(validation.fieldErrors).to.be.an('object');
        });
    });

    describe('NPC Statistics Lifecycle Management', function () {
        it('should track NPC activity evolution patterns', function () {
            const initialStats = createValidNPCStats({ 
                FLEET_SPAWNS: 5, 
                ENTITY_SPAWNS: 5 
            });
            
            const evolvedStats = createValidNPCStats({ 
                FLEET_SPAWNS: 15, 
                ENTITY_SPAWNS: 20 
            });

            const comparison = evolvedStats.compareActivityWith(initialStats);
            
            expect(comparison.moreActive).to.be.true;
            expect(comparison.activityDifference).to.equal(25); // (15+20) - (5+5)
            expect(comparison.comparison).to.include('25 more spawns');
        });

        it('should support multi-system faction analysis', function () {
            const systems = [
                { coords: [0, 0, 0], spawns: [5, 10] }, // 15 total = HIGH
                { coords: [1, 0, 0], spawns: [8, 12] }, // 20 total = HIGH  
                { coords: [0, 1, 0], spawns: [12, 15] }, // 27 total = VERY_HIGH
                { coords: [0, 0, 1], spawns: [1, 1] }  // 2 total = LOW
            ];

            const statsRecords = systems.map(system => 
                createNPCStatsForFaction(-10000000, {
                    SYS_X: system.coords[0],
                    SYS_Y: system.coords[1],
                    SYS_Z: system.coords[2],
                    FLEET_SPAWNS: system.spawns[0],
                    ENTITY_SPAWNS: system.spawns[1]
                })
            );

            // Verify all are Trading Guild
            expect(statsRecords.every(stats => 
                stats.getFactionName() === 'Trading Guild'
            )).to.be.true;

            // Check activity levels
            const activityLevels = statsRecords.map(stats => stats.getActivityLevel());
            expect(activityLevels).to.include('VERY_HIGH'); // System with 27 total spawns
            expect(activityLevels).to.include('LOW'); // System with 2 total spawns
        });
    });
});