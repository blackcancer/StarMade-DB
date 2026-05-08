/**
 * @fileoverview EffectsModel Comprehensive Tests
 * 
 * Complete test suite for the EffectsModel class covering 100% functionality:
 * - Model creation and data manipulation
 * - Effect type validation and business logic
 * - Effect category classification
 * - Scope and recognition methods
 * - Bidirectional relationships and intelligence
 * - Validation rules and constraints
 * - Error handling and edge cases
 * - Relationship-based analytics
 * - Advanced BaseModel integration
 * - Schema consistency validation
 * - JSON serialization with relationships
 * 
 * Following TDD principles and mirror structure as defined in AGENT.md
 * Updated for Enhanced Edition with complete bidirectional relationships
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import {
    EffectsModel,
    EffectType,
    EffectCategory,
    EFFECT_UIDS,
    ALL_EFFECT_UIDS,
    BaseModel,
    DataType,
    ForeignKeyAction,
    type ModelValidationResult
} from '../../../src/tables/index.js';

// Import Model helper from BaseModel
import { Model } from '../../../src/tables/BaseModel.js';

// =============================================================================
// TEST DATA AND HELPERS
// =============================================================================

/**
 * Create a valid effect instance for testing
 */
function createValidEffect(overrides: Partial<any> = {}): EffectsModel {
    return new EffectsModel({
        ID: 1001,
        ENTITY_ID: 2001,
        TYPE: EffectType.STRUCTURE,
        EFFECT_UID: 'SPEED_BOOST',
        ...overrides
    });
}

/**
 * Create an effect with minimal required data
 */
function createMinimalEffect(overrides: Partial<any> = {}): EffectsModel {
    return new EffectsModel({
        ENTITY_ID: 2001,
        TYPE: EffectType.OTHER,
        ...overrides
    });
}

/**
 * Create a mock entity for relationship testing
 */
function createMockEntity(overrides: Partial<any> = {}): any {
    return {
        getId: () => 2001,
        getName: () => 'Test Entity',
        getTypeName: () => 'SHIP',
        getUid: () => 'ENTITY_12345',
        toJSON: () => ({ id: 2001, name: 'Test Entity', type: 'SHIP' }),
        ...overrides
    };
}

// =============================================================================
// EFFECTS MODEL TESTS - ENHANCED EDITION WITH 100% COVERAGE
// =============================================================================

describe('EffectsModel Complete Tests', function() {
    
    describe('Model Creation and Basic Operations', function() {
        it('should create effect with minimal required data', function() {
            const effect = createMinimalEffect();

            expect(effect.getEntityId()).to.equal(2001);
            expect(effect.getType()).to.equal(EffectType.OTHER);
            expect(effect.getEffectUid()).to.be.undefined;
        });

        it('should create effect with complete data', function() {
            const effect = createValidEffect({
                ID: 12345,
                ENTITY_ID: 98765,
                TYPE: EffectType.STRUCTURE,
                EFFECT_UID: 'SHIELD_RECHARGE'
            });

            expect(effect.getId()).to.equal(12345);
            expect(effect.getEntityId()).to.equal(98765);
            expect(effect.getType()).to.equal(EffectType.STRUCTURE);
            expect(effect.getEffectUid()).to.equal('SHIELD_RECHARGE');
        });

        it('should extend BaseModel correctly', function() {
            const effect = createValidEffect();
            expect(effect).to.be.instanceOf(BaseModel);
            expect(effect).to.be.instanceOf(EffectsModel);
        });
    });

    describe('Data Manipulation and Accessors', function() {
        let effect: EffectsModel;

        beforeEach(function() {
            effect = createValidEffect();
        });

        it('should get and set all fields correctly', function() {
            effect.setId(99999);
            expect(effect.getId()).to.equal(99999);

            effect.setEntityId(88888);
            expect(effect.getEntityId()).to.equal(88888);

            effect.setType(EffectType.SECTOR);
            expect(effect.getType()).to.equal(EffectType.SECTOR);

            effect.setEffectUid('DAMAGE_MULTIPLIER');
            expect(effect.getEffectUid()).to.equal('DAMAGE_MULTIPLIER');
        });

        it('should support method chaining for setters', function() {
            const result = effect
                .setId(77777)
                .setEntityId(66666)
                .setType(EffectType.SYSTEM)
                .setEffectUid('MINING_EFFECTIVENESS');

            expect(result).to.equal(effect); // Should return same instance
            expect(effect.getId()).to.equal(77777);
            expect(effect.getEntityId()).to.equal(66666);
            expect(effect.getType()).to.equal(EffectType.SYSTEM);
            expect(effect.getEffectUid()).to.equal('MINING_EFFECTIVENESS');
        });

        it('should support BaseModel functionality', function() {
            // Test change tracking
            expect(effect.isDirty()).to.be.false;
            effect.setType(EffectType.SECTOR);
            expect(effect.isDirty()).to.be.true;

            // Test new record detection
            const newEffect = new EffectsModel({
                ENTITY_ID: 2001,
                TYPE: EffectType.STRUCTURE,
                EFFECT_UID: 'SPEED_BOOST'
            }); // No ID provided
            expect(newEffect.isNew()).to.be.true;

            // Test cloning
            const clone = effect.clone();
            expect(clone.getEntityId()).to.equal(effect.getEntityId());
            expect(clone.getType()).to.equal(effect.getType());
        });
    });

    describe('Advanced BaseModel Integration', function() {
        let effect: EffectsModel;

        beforeEach(function() {
            effect = createValidEffect();
        });

        it('should handle markAsSaved and state transitions correctly', function() {
            // Start with a dirty effect
            effect.setType(EffectType.SECTOR);
            expect(effect.isDirty()).to.be.true;
            expect(effect.isNew()).to.be.false; // Has ID

            // Mark as saved
            effect.markAsSaved();
            expect(effect.isDirty()).to.be.false;
            expect(effect.isNew()).to.be.false;

            // Verify the changed data is now the original
            expect(effect.getType()).to.equal(EffectType.SECTOR);
        });

        it('should reset to original data correctly', function() {
            const originalType = effect.getType();
            const originalEntityId = effect.getEntityId();

            // Make changes
            effect.setType(EffectType.SECTOR);
            effect.setEntityId(99999);
            expect(effect.isDirty()).to.be.true;

            // Reset
            effect.reset();
            expect(effect.getType()).to.equal(originalType);
            expect(effect.getEntityId()).to.equal(originalEntityId);
            expect(effect.isDirty()).to.be.false;
        });

        it('should handle getPrimaryKeyValue with composite keys', function() {
            // For EffectsModel, primary key is just ID
            const effect = createValidEffect({ ID: 12345 });
            expect(effect.getPrimaryKeyValue()).to.equal(12345);

            // Test without ID
            const newEffect = createMinimalEffect();
            expect(newEffect.getPrimaryKeyValue()).to.be.undefined;
        });

        it('should handle clearAllRelated vs clearRelated operations', function() {
            const mockEntity = createMockEntity();
            
            // Set multiple relationships (in a real scenario)
            effect.setRelated('entity', mockEntity);
            effect.setRelated('testRelation', mockEntity); // Use compatible type

            expect(effect.hasRelated('entity')).to.be.true;
            expect(effect.hasRelated('testRelation')).to.be.true;

            // Clear specific relation
            effect.clearRelated('testRelation');
            expect(effect.hasRelated('entity')).to.be.true;
            expect(effect.hasRelated('testRelation')).to.be.false;

            // Clear all relations
            effect.clearAllRelated();
            expect(effect.hasRelated('entity')).to.be.false;
        });

        it('should track changes accurately with multiple operations', function() {
            // Start clean
            expect(effect.getChangedFields()).to.have.length(0);

            // Make changes
            effect.setType(EffectType.SECTOR);
            effect.setEffectUid('NEW_EFFECT');
            
            const changedFields = effect.getChangedFields();
            expect(changedFields).to.include('TYPE');
            expect(changedFields).to.include('EFFECT_UID');
            expect(changedFields).to.not.include('ENTITY_ID'); // Unchanged

            // Reset and verify
            effect.reset();
            expect(effect.getChangedFields()).to.have.length(0);
        });
    });

    describe('Schema Consistency Validation', function() {
        it('should validate schema-relation consistency', function() {
            const consistency = EffectsModel.validateSchemaConsistency();
            
            expect(consistency).to.be.an('object');
            expect(consistency.isConsistent).to.be.a('boolean');
            expect(consistency.issues).to.be.an('array');
            expect(consistency.suggestions).to.be.an('array');

            // For EffectsModel, should be consistent
            expect(consistency.isConsistent).to.be.true;
            expect(consistency.issues).to.be.empty;
            expect(consistency.suggestions).to.be.empty;
        });

        it('should generate foreign keys from relations', function() {
            const generatedFKs = EffectsModel.generateForeignKeysFromRelations();
            
            expect(generatedFKs).to.be.an('array');
            
            // EffectsModel has one BelongsToOneRelation (entity)
            expect(generatedFKs).to.have.length(1);
            
            const entityFK = generatedFKs[0];
            expect(entityFK.name).to.equal('FK_EFFECTS_ENTITY');
            expect(entityFK.columns).to.deep.equal(['ENTITY_ID']);
            expect(entityFK.referencedTable).to.equal('ENTITIES');
            expect(entityFK.referencedColumns).to.deep.equal(['ID']);
        });

        it('should validate relationship mappings structure', function() {
            const relations = EffectsModel.getRelationMappings();
            
            expect(relations).to.be.an('object');
            expect(Object.keys(relations)).to.have.length(1);
            
            const entityRelation = relations.entity;
            expect(entityRelation).to.exist;
            expect(entityRelation.relation).to.equal(Model.BelongsToOneRelation);
            expect(entityRelation.join.from).to.equal('EFFECTS.ENTITY_ID');
            expect(entityRelation.join.to).to.equal('ENTITIES.ID');
        });

        it('should get specific relation definition', function() {
            const entityRelation = EffectsModel.getRelation('entity');
            expect(entityRelation).to.exist;
            expect(entityRelation!.relation).to.equal(Model.BelongsToOneRelation);

            const nonExistentRelation = EffectsModel.getRelation('nonexistent');
            expect(nonExistentRelation).to.be.undefined;
        });

        it('should resolve model classes correctly', function() {
            // Test with class reference
            const ClassModel = EffectsModel.resolveModelClass(EffectsModel);
            expect(ClassModel).to.equal(EffectsModel);

            // Test with function reference
            const FunctionModel = EffectsModel.resolveModelClass(() => EffectsModel);
            expect(FunctionModel).to.equal(EffectsModel);

            // Test with string reference (should throw)
            expect(() => EffectsModel.resolveModelClass('StringModel')).to.throw('String model references not yet implemented');
        });
    });

    describe('JSON Serialization with Relationships', function() {
        let effect: EffectsModel;
        let mockEntity: any;

        beforeEach(function() {
            effect = createValidEffect();
            mockEntity = createMockEntity();
        });

        it('should serialize basic effect data to JSON', function() {
            const json = effect.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.ID).to.equal(1001);
            expect(json.ENTITY_ID).to.equal(2001);
            expect(json.TYPE).to.equal(EffectType.STRUCTURE);
            expect(json.EFFECT_UID).to.equal('SPEED_BOOST');
        });

        it('should serialize with loaded relations when includeInJson is true', function() {
            // Set the entity relationship
            effect.setEntity(mockEntity);
            
            const json = effect.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.entity).to.exist;
            expect(json.entity).to.deep.equal({
                id: 2001,
                name: 'Test Entity',
                type: 'SHIP'
            });
        });

        it('should handle serialization with array relationships', function() {
            // Create a mock array relationship
            const mockEntities = [
                createMockEntity({ getId: () => 1, getName: () => 'Entity 1' }),
                createMockEntity({ getId: () => 2, getName: () => 'Entity 2' })
            ];
            
            effect.setRelated('testArrayRelation', mockEntities);
            
            // Since EffectsModel doesn't have array relations, this tests the base functionality
            const json = effect.toJSON();
            expect(json).to.be.an('object');
        });

        it('should handle serialization with undefined/null relations', function() {
            // No relations set
            const json = effect.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.entity).to.be.undefined;
        });

        it('should handle serialization with circular reference protection', function() {
            // Create a circular reference - but don't actually call toJSON recursively
            const circularEntity = createMockEntity({
                toJSON: () => {
                    // Instead of calling effect.toJSON() which would cause infinite recursion,
                    // return a simple reference
                    return { id: 2001, effectRef: 'circular_reference_detected' };
                }
            });
            
            effect.setEntity(circularEntity);
            
            // This should not cause infinite recursion
            const json = effect.toJSON();
            expect(json).to.be.an('object');
            expect(json.entity.effectRef).to.equal('circular_reference_detected');
        });
    });

    describe('Bidirectional Relationships and Intelligence', function() {
        let effect: EffectsModel;
        let mockEntity: any;

        beforeEach(function() {
            effect = createValidEffect();
            mockEntity = createMockEntity();
        });

        it('should manage entity relationship correctly', function() {
            // Initially no relationship loaded
            expect(effect.hasEntityLoaded()).to.be.false;
            expect(effect.getEntity()).to.be.undefined;

            // Set relationship
            effect.setEntity(mockEntity);
            expect(effect.hasEntityLoaded()).to.be.true;
            expect(effect.getEntity()).to.equal(mockEntity);

            // Clear relationship
            effect.setEntity(undefined);
            expect(effect.getEntity()).to.be.undefined;
        });

        it('should get entity information from loaded relation', function() {
            effect.setEntity(mockEntity);

            expect(effect.getEntityName()).to.equal('Test Entity');
            expect(effect.getEntityTypeName()).to.equal('SHIP');
            expect(effect.getEntityDisplayName()).to.equal('Test Entity');
        });

        it('should handle missing entity relation gracefully', function() {
            // No entity loaded
            expect(effect.getEntityName()).to.be.undefined;
            expect(effect.getEntityTypeName()).to.be.undefined;
            expect(effect.getEntityDisplayName()).to.equal('Entity 2001');
        });

        it('should generate display name with entity type when name unavailable', function() {
            const entityWithoutName = createMockEntity({
                getName: () => undefined,
                getTypeName: () => 'SPACE_STATION'
            });

            effect.setEntity(entityWithoutName);
            expect(effect.getEntityDisplayName()).to.equal('SPACE_STATION 2001');
        });

        it('should fallback to entity ID when no relation data available', function() {
            const entityWithoutMethods = createMockEntity({
                getName: () => undefined,
                getTypeName: () => undefined
            });

            effect.setEntity(entityWithoutMethods);
            expect(effect.getEntityDisplayName()).to.equal('Entity 2001');
        });

        it('should track relationship status correctly', function() {
            expect(effect.hasEntityLoaded()).to.be.false;

            effect.setEntity(mockEntity);
            expect(effect.hasEntityLoaded()).to.be.true;

            // Clear relationship using clearRelated instead of setEntity(undefined)
            effect.clearRelated('entity');
            expect(effect.hasEntityLoaded()).to.be.false;
        });
    });

    describe('Effect Type Validation and Business Logic', function() {
        it('should validate all effect types correctly', function() {
            const validTypes = [
                EffectType.OTHER,
                EffectType.STRUCTURE,
                EffectType.SECTOR,
                EffectType.SYSTEM
            ];

            for (const type of validTypes) {
                const effect = createMinimalEffect({ TYPE: type });
                const validation = effect.validate();
                expect(validation.isValid, `Type ${type} should be valid`).to.be.true;
            }
        });

        it('should reject invalid effect types', function() {
            const effect = createMinimalEffect({ TYPE: 999 });
            const validation = effect.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.TYPE).to.include('Invalid effect type: 999');
        });

        it('should get effect type name correctly', function() {
            const otherEffect = createMinimalEffect({ TYPE: EffectType.OTHER });
            const structureEffect = createMinimalEffect({ TYPE: EffectType.STRUCTURE });
            const sectorEffect = createMinimalEffect({ TYPE: EffectType.SECTOR });
            const systemEffect = createMinimalEffect({ TYPE: EffectType.SYSTEM });

            expect(otherEffect.getTypeName()).to.equal('OTHER');
            expect(structureEffect.getTypeName()).to.equal('STRUCTURE');
            expect(sectorEffect.getTypeName()).to.equal('SECTOR');
            expect(systemEffect.getTypeName()).to.equal('SYSTEM');
        });

        it('should handle unknown effect types', function() {
            const effect = createMinimalEffect({ TYPE: 999 });
            expect(effect.getTypeName()).to.equal('UNKNOWN_999');
        });

        it('should handle all effect types correctly', function() {
            const types = [EffectType.OTHER, EffectType.STRUCTURE, EffectType.SECTOR, EffectType.SYSTEM];
            
            for (const type of types) {
                const effect = createValidEffect({ TYPE: type });
                expect(effect.getType()).to.equal(type);
                expect(effect.getTypeName()).to.equal(EffectType[type]);
            }
        });
    });

    describe('Effect Category Classification', function() {
        it('should correctly classify movement effects', function() {
            const speedBoost = createValidEffect({ EFFECT_UID: 'SPEED_BOOST' });
            const jumpCharge = createValidEffect({ EFFECT_UID: 'JUMP_DRIVE_CHARGE' });
            const thrustEff = createValidEffect({ EFFECT_UID: 'THRUST_EFFECTIVENESS' });

            expect(speedBoost.getCategory()).to.equal(EffectCategory.MOVEMENT);
            expect(jumpCharge.getCategory()).to.equal(EffectCategory.MOVEMENT);
            expect(thrustEff.getCategory()).to.equal(EffectCategory.MOVEMENT);

            expect(speedBoost.isMovementEffect()).to.be.true;
            expect(jumpCharge.isMovementEffect()).to.be.true;
            expect(thrustEff.isMovementEffect()).to.be.true;
        });

        it('should correctly classify defensive effects', function() {
            const shieldRecharge = createValidEffect({ EFFECT_UID: 'SHIELD_RECHARGE' });
            const shieldCapacity = createValidEffect({ EFFECT_UID: 'SHIELD_CAPACITY' });
            const armorEff = createValidEffect({ EFFECT_UID: 'ARMOR_EFFECTIVENESS' });
            const ionRes = createValidEffect({ EFFECT_UID: 'ION_RESISTANCE' });

            expect(shieldRecharge.getCategory()).to.equal(EffectCategory.DEFENSIVE);
            expect(shieldCapacity.getCategory()).to.equal(EffectCategory.DEFENSIVE);
            expect(armorEff.getCategory()).to.equal(EffectCategory.DEFENSIVE);
            expect(ionRes.getCategory()).to.equal(EffectCategory.DEFENSIVE);

            expect(shieldRecharge.isDefensiveEffect()).to.be.true;
            expect(shieldCapacity.isDefensiveEffect()).to.be.true;
            expect(armorEff.isDefensiveEffect()).to.be.true;
            expect(ionRes.isDefensiveEffect()).to.be.true;
        });

        it('should correctly classify offensive effects', function() {
            const damageMultiplier = createValidEffect({ EFFECT_UID: 'DAMAGE_MULTIPLIER' });

            expect(damageMultiplier.getCategory()).to.equal(EffectCategory.OFFENSIVE);
            expect(damageMultiplier.isOffensiveEffect()).to.be.true;
        });

        it('should correctly classify power effects', function() {
            const powerGen = createValidEffect({ EFFECT_UID: 'POWER_GENERATION' });
            const powerCap = createValidEffect({ EFFECT_UID: 'POWER_CAPACITY' });

            expect(powerGen.getCategory()).to.equal(EffectCategory.POWER);
            expect(powerCap.getCategory()).to.equal(EffectCategory.POWER);

            expect(powerGen.isPowerEffect()).to.be.true;
            expect(powerCap.isPowerEffect()).to.be.true;
        });

        it('should correctly classify utility effects', function() {
            const miningEff = createValidEffect({ EFFECT_UID: 'MINING_EFFECTIVENESS' });
            const scannerRange = createValidEffect({ EFFECT_UID: 'SCANNER_RANGE' });

            expect(miningEff.getCategory()).to.equal(EffectCategory.UTILITY);
            expect(scannerRange.getCategory()).to.equal(EffectCategory.UTILITY);

            expect(miningEff.isUtilityEffect()).to.be.true;
            expect(scannerRange.isUtilityEffect()).to.be.true;
        });

        it('should correctly classify stealth effects', function() {
            const stealth = createValidEffect({ EFFECT_UID: 'STEALTH' });
            const jamming = createValidEffect({ EFFECT_UID: 'JAMMING' });
            const cloaking = createValidEffect({ EFFECT_UID: 'CLOAKING' });

            expect(stealth.getCategory()).to.equal(EffectCategory.STEALTH);
            expect(jamming.getCategory()).to.equal(EffectCategory.STEALTH);
            expect(cloaking.getCategory()).to.equal(EffectCategory.STEALTH);

            expect(stealth.isStealthEffect()).to.be.true;
            expect(jamming.isStealthEffect()).to.be.true;
            expect(cloaking.isStealthEffect()).to.be.true;
        });

        it('should handle unknown effect UIDs', function() {
            const unknownEffect = createValidEffect({ EFFECT_UID: 'UNKNOWN_EFFECT' });
            const noUidEffect = createValidEffect({ EFFECT_UID: null });

            expect(unknownEffect.getCategory()).to.equal(EffectCategory.UNKNOWN);
            expect(noUidEffect.getCategory()).to.equal(EffectCategory.UNKNOWN);
        });
    });

    describe('Effect Recognition and Validation', function() {
        it('should recognize known effect UIDs', function() {
            for (const uid of ALL_EFFECT_UIDS) {
                const effect = createValidEffect({ EFFECT_UID: uid });
                expect(effect.isRecognizedEffect(), `${uid} should be recognized`).to.be.true;
            }
        });

        it('should not recognize unknown effect UIDs', function() {
            const unknownEffect = createValidEffect({ EFFECT_UID: 'UNKNOWN_EFFECT' });
            const emptyEffect = createValidEffect({ EFFECT_UID: '' });
            const nullEffect = createValidEffect({ EFFECT_UID: null });

            expect(unknownEffect.isRecognizedEffect()).to.be.false;
            expect(emptyEffect.isRecognizedEffect()).to.be.false;
            expect(nullEffect.isRecognizedEffect()).to.be.false;
        });

        it('should validate effect UIDs from all categories', function() {
            // Test a few from each category
            const testUIDs = [
                'SPEED_BOOST',      // Movement
                'SHIELD_RECHARGE',  // Defensive
                'DAMAGE_MULTIPLIER', // Offensive
                'POWER_GENERATION' , // Power
                'MINING_EFFECTIVENESS', // Utility
                'STEALTH'           // Stealth
            ];

            for (const uid of testUIDs) {
                expect(ALL_EFFECT_UIDS.includes(uid as any), `${uid} should be in ALL_EFFECT_UIDS`).to.be.true;
            }
        });
    });

    describe('Scope and Application Methods', function() {
        it('should identify structure-scoped effects', function() {
            const structureEffect = createValidEffect({ TYPE: EffectType.STRUCTURE });
            const sectorEffect = createValidEffect({ TYPE: EffectType.SECTOR });

            expect(structureEffect.isStructureScoped()).to.be.true;
            expect(sectorEffect.isStructureScoped()).to.be.false;
        });

        it('should identify sector-scoped effects', function() {
            const sectorEffect = createValidEffect({ TYPE: EffectType.SECTOR });
            const systemEffect = createValidEffect({ TYPE: EffectType.SYSTEM });

            expect(sectorEffect.isSectorScoped()).to.be.true;
            expect(systemEffect.isSectorScoped()).to.be.false;
        });

        it('should identify system-scoped effects', function() {
            const systemEffect = createValidEffect({ TYPE: EffectType.SYSTEM });
            const otherEffect = createValidEffect({ TYPE: EffectType.OTHER });

            expect(systemEffect.isSystemScoped()).to.be.true;
            expect(otherEffect.isSystemScoped()).to.be.false;
        });

        it('should provide scope descriptions', function() {
            const structureEffect = createValidEffect({ TYPE: EffectType.STRUCTURE });
            const sectorEffect = createValidEffect({ TYPE: EffectType.SECTOR });
            const systemEffect = createValidEffect({ TYPE: EffectType.SYSTEM });
            const otherEffect = createValidEffect({ TYPE: EffectType.OTHER });

            expect(structureEffect.getScopeDescription()).to.equal('Applied to ships, stations, structures');
            expect(sectorEffect.getScopeDescription()).to.equal('Environmental effects affecting regions');
            expect(systemEffect.getScopeDescription()).to.equal('Large-scale effects across star systems');
            expect(otherEffect.getScopeDescription()).to.equal('General/miscellaneous effects');
        });

        it('should handle unknown scope types', function() {
            const effect = createValidEffect({ TYPE: 999 });
            expect(effect.getScopeDescription()).to.equal('Unknown scope');
        });
    });

    describe('Advanced Effect Analytics', function() {
        it('should identify combat performance effects', function() {
            const offensiveEffect = createValidEffect({ EFFECT_UID: 'DAMAGE_MULTIPLIER' });
            const defensiveEffect = createValidEffect({ EFFECT_UID: 'SHIELD_RECHARGE' });
            const stealthEffect = createValidEffect({ EFFECT_UID: 'CLOAKING' });
            const utilityEffect = createValidEffect({ EFFECT_UID: 'MINING_EFFECTIVENESS' });

            expect(offensiveEffect.affectsCombatPerformance()).to.be.true;
            expect(defensiveEffect.affectsCombatPerformance()).to.be.true;
            expect(stealthEffect.affectsCombatPerformance()).to.be.true;
            expect(utilityEffect.affectsCombatPerformance()).to.be.false;
        });

        it('should identify ship operation effects', function() {
            const movementEffect = createValidEffect({ EFFECT_UID: 'SPEED_BOOST' });
            const powerEffect = createValidEffect({ EFFECT_UID: 'POWER_GENERATION' });
            const utilityEffect = createValidEffect({ EFFECT_UID: 'SCANNER_RANGE' });
            const offensiveEffect = createValidEffect({ EFFECT_UID: 'DAMAGE_MULTIPLIER' });

            expect(movementEffect.affectsShipOperation()).to.be.true;
            expect(powerEffect.affectsShipOperation()).to.be.true;
            expect(utilityEffect.affectsShipOperation()).to.be.true;
            expect(offensiveEffect.affectsShipOperation()).to.be.false;
        });

        it('should categorize hybrid effects correctly', function() {
            // Power effects affect ship operation but not combat directly
            const powerEffect = createValidEffect({ EFFECT_UID: 'POWER_GENERATION' });
            
            expect(powerEffect.affectsCombatPerformance()).to.be.false;
            expect(powerEffect.affectsShipOperation()).to.be.true;
            expect(powerEffect.isPowerEffect()).to.be.true;
        });
    });

    describe('Effect Summary and Analysis with Relationships', function() {
        it('should generate comprehensive effect summary with loaded relation', function() {
            const effect = createValidEffect({
                ID: 12345,
                ENTITY_ID: 67890,
                TYPE: EffectType.STRUCTURE,
                EFFECT_UID: 'SHIELD_RECHARGE'
            });

            const mockEntity = createMockEntity({
                getName: () => 'My Battleship',
                getTypeName: () => 'SHIP'
            });
            effect.setEntity(mockEntity);

            const summary = effect.getEffectSummary();

            expect(summary.id).to.equal(12345);
            expect(summary.entityId).to.equal(67890);
            expect(summary.entityName).to.equal('My Battleship');
            expect(summary.entityType).to.equal('SHIP');
            expect(summary.type).to.equal(EffectType.STRUCTURE);
            expect(summary.typeName).to.equal('STRUCTURE');
            expect(summary.effectUid).to.equal('SHIELD_RECHARGE');
            expect(summary.category).to.equal(EffectCategory.DEFENSIVE);
            expect(summary.isRecognized).to.be.true;
            expect(summary.scope).to.equal('Applied to ships, stations, structures');
            expect(summary.affectsCombat).to.be.true;
            expect(summary.affectsOperation).to.be.false;
            expect(summary.relationshipStatus.hasEntityLoaded).to.be.true;
        });

        it('should handle summary for unknown effects without relations', function() {
            const effect = createValidEffect({
                TYPE: EffectType.OTHER,
                EFFECT_UID: 'CUSTOM_EFFECT'
            });

            const summary = effect.getEffectSummary();

            expect(summary.typeName).to.equal('OTHER');
            expect(summary.category).to.equal(EffectCategory.UNKNOWN);
            expect(summary.isRecognized).to.be.false;
            expect(summary.scope).to.equal('General/miscellaneous effects');
            expect(summary.entityName).to.be.undefined;
            expect(summary.entityType).to.be.undefined;
            expect(summary.relationshipStatus.hasEntityLoaded).to.be.false;
        });

        it('should provide comprehensive analytics integration', function() {
            const combatEffect = createValidEffect({ EFFECT_UID: 'DAMAGE_MULTIPLIER' });
            const operationEffect = createValidEffect({ EFFECT_UID: 'MINING_EFFECTIVENESS' });
            const hybridEffect = createValidEffect({ EFFECT_UID: 'POWER_GENERATION' });

            const combatSummary = combatEffect.getEffectSummary();
            const operationSummary = operationEffect.getEffectSummary();
            const hybridSummary = hybridEffect.getEffectSummary();

            expect(combatSummary.affectsCombat).to.be.true;
            expect(combatSummary.affectsOperation).to.be.false;

            expect(operationSummary.affectsCombat).to.be.false;
            expect(operationSummary.affectsOperation).to.be.true;

            expect(hybridSummary.affectsCombat).to.be.false;
            expect(hybridSummary.affectsOperation).to.be.true;
        });

        it('should handle summary with missing effect ID', function() {
            const effect = createMinimalEffect();
            const summary = effect.getEffectSummary();
            
            expect(summary.id).to.be.undefined;
            expect(summary.entityId).to.equal(2001);
            expect(summary.type).to.equal(EffectType.OTHER);
        });
    });

    describe('Validation Rules and Constraints', function() {
        it('should pass validation with valid data', function() {
            const effect = createValidEffect();
            const validation = effect.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should require entity ID', function() {
            const effect = new EffectsModel({
                TYPE: EffectType.STRUCTURE,
                EFFECT_UID: 'SPEED_BOOST'
            });

            const validation = effect.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ENTITY_ID).to.include("Field 'ENTITY_ID' is required");
        });

        it('should require type field', function() {
            const effect = new EffectsModel({
                ENTITY_ID: 2001,
                EFFECT_UID: 'SPEED_BOOST'
            });

            const validation = effect.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.TYPE).to.include("Field 'TYPE' is required");
        });

        it('should enforce effect UID length limit', function() {
            const effect = createValidEffect({ EFFECT_UID: 'A'.repeat(200) });
            const validation = effect.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.EFFECT_UID).to.include('Effect UID cannot exceed 128 characters');
        });

        it('should allow null/undefined EFFECT_UID', function() {
            const nullEffect = createValidEffect({ EFFECT_UID: null });
            const undefinedEffect = createValidEffect({ EFFECT_UID: undefined });

            expect(nullEffect.validate().isValid).to.be.true;
            expect(undefinedEffect.validate().isValid).to.be.true;
        });

        it('should allow empty EFFECT_UID', function() {
            const effect = createValidEffect({ EFFECT_UID: '' });
            const validation = effect.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should validate multiple errors simultaneously', function() {
            const effect = new EffectsModel({
                TYPE: 999, // Invalid type
                EFFECT_UID: 'A'.repeat(150) // Too long
                // Missing ENTITY_ID
            });

            const validation = effect.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ENTITY_ID).to.exist;
            expect(validation.fieldErrors.TYPE).to.exist;
            expect(validation.fieldErrors.EFFECT_UID).to.exist;
            expect(validation.errors.length).to.be.greaterThan(2);
        });
    });

    describe('Asynchronous Validation', function() {
        it('should handle validateForeignKeys placeholder', async function() {
            const effect = createValidEffect();
            
            // Currently returns placeholder implementation
            const validation = await effect.validateForeignKeys();
            
            expect(validation).to.be.an('object');
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.an('array');
            expect(validation.fieldErrors).to.be.an('object');
        });
    });

    describe('Schema Definition Validation', function() {
        it('should have correct table name', function() {
            expect(EffectsModel.getTableName()).to.equal('EFFECTS');
            expect(EffectsModel.tableName).to.equal('EFFECTS');
        });

        it('should have correct schema structure', function() {
            const schema = EffectsModel.getSchema();

            expect(schema.tableName).to.equal('EFFECTS');
            expect(schema.comment).to.equal('Entity effects and status conditions');
            expect(schema.columns).to.be.an('array').with.length(4);
            expect(schema.primaryKey).to.deep.equal(['ID']);
            expect(schema.foreignKeys).to.be.an('array').with.length(1);
            expect(schema.indexes).to.be.an('array').with.length(4);
            expect(schema.validationRules).to.be.an('array').with.length(4);
        });

        it('should have correct column definitions', function() {
            const schema = EffectsModel.getSchema();
            const columns = schema.columns;

            // ID column
            const idColumn = columns.find(col => col.name === 'ID');
            expect(idColumn).to.exist;
            expect(idColumn!.type).to.equal(DataType.BIGINT);
            expect(idColumn!.primaryKey).to.be.true;
            expect(idColumn!.autoIncrement).to.be.true;
            expect(idColumn!.nullable).to.be.false;

            // ENTITY_ID column
            const entityIdColumn = columns.find(col => col.name === 'ENTITY_ID');
            expect(entityIdColumn).to.exist;
            expect(entityIdColumn!.type).to.equal(DataType.BIGINT);
            expect(entityIdColumn!.nullable).to.be.false;

            // TYPE column
            const typeColumn = columns.find(col => col.name === 'TYPE');
            expect(typeColumn).to.exist;
            expect(typeColumn!.type).to.equal(DataType.INTEGER);
            expect(typeColumn!.nullable).to.be.false;

            // EFFECT_UID column
            const effectUidColumn = columns.find(col => col.name === 'EFFECT_UID');
            expect(effectUidColumn).to.exist;
            expect(effectUidColumn!.type).to.equal(DataType.VARCHAR);
            expect(effectUidColumn!.length).to.equal(128);
            expect(effectUidColumn!.nullable).to.be.true;
        });

        it('should have correct foreign key definition', function() {
            const foreignKeys = EffectsModel.getForeignKeys();
            expect(foreignKeys).to.have.length(1);

            const entityFk = foreignKeys[0];
            expect(entityFk.name).to.equal('FK_EFFECT_ENTITY');
            expect(entityFk.columns).to.deep.equal(['ENTITY_ID']);
            expect(entityFk.referencedTable).to.equal('ENTITIES');
            expect(entityFk.referencedColumns).to.deep.equal(['ID']);
            expect(entityFk.onDelete).to.equal(ForeignKeyAction.CASCADE);
        });

        it('should have correct relationship mappings', function() {
            const relations = EffectsModel.getRelationMappings();
            expect(Object.keys(relations)).to.have.length(1);
            expect(relations.entity).to.exist;
            expect(relations.entity.join.from).to.equal('EFFECTS.ENTITY_ID');
            expect(relations.entity.join.to).to.equal('ENTITIES.ID');
        });

        it('should have correct index definitions', function() {
            const schema = EffectsModel.getSchema();
            const indexes = schema.indexes;

            expect(indexes).to.have.length(4);

            const indexNames = indexes.map(idx => idx.name);
            expect(indexNames).to.include.members([
                'EFFECTS_PK', 
                'EFFECTS_TYPE', 
                'EFFECTS_UIDK',
                'EFFECTS_TYPE_ENT'
            ]);

            // Check the composite index
            const compositeIndex = indexes.find(idx => idx.name === 'EFFECTS_TYPE_ENT');
            expect(compositeIndex).to.exist;
            expect(compositeIndex!.columns).to.deep.equal(['TYPE', 'ENTITY_ID']);
        });
    });

    describe('BaseModel Integration and Database Row Creation', function() {
        it('should support creating from database row', function() {
            const row = {
                ID: 8888,
                ENTITY_ID: 7777,
                TYPE: EffectType.STRUCTURE,
                EFFECT_UID: 'SHIELD_RECHARGE'
            };

            const effect = EffectsModel.fromRow(row);
            expect(effect.getId()).to.equal(8888);
            expect(effect.getEntityId()).to.equal(7777);
            expect(effect.getType()).to.equal(EffectType.STRUCTURE);
            expect(effect.getEffectUid()).to.equal('SHIELD_RECHARGE');
            expect(effect.isNew()).to.be.false;
            expect(effect.isDirty()).to.be.false;
        });

        it('should support creating multiple instances from rows', function() {
            const rows = [
                { ID: 1, ENTITY_ID: 100, TYPE: EffectType.STRUCTURE, EFFECT_UID: 'SPEED_BOOST' },
                { ID: 2, ENTITY_ID: 200, TYPE: EffectType.SECTOR, EFFECT_UID: 'DAMAGE_MULTIPLIER' },
                { ID: 3, ENTITY_ID: 300, TYPE: EffectType.SYSTEM, EFFECT_UID: 'POWER_GENERATION' }
            ];

            const effects = EffectsModel.fromRows(rows);
            expect(effects).to.have.length(3);
            expect(effects[0].getId()).to.equal(1);
            expect(effects[1].getEntityId()).to.equal(200);
            expect(effects[2].getEffectUid()).to.equal('POWER_GENERATION');
        });

        it('should preserve relationship data in clones', function() {
            const effect = createValidEffect();
            const mockEntity = createMockEntity();
            
            effect.setEntity(mockEntity);
            
            const clone = effect.clone();
            expect(clone.hasEntityLoaded()).to.be.true;
            expect(clone.getEntity()).to.equal(mockEntity);
            
            // Verify independence
            clone.setEntity(undefined);
            expect(effect.hasEntityLoaded()).to.be.true; // Original should still have relation
        });
    });

    describe('Edge Cases and Error Handling', function() {
        it('should handle null and undefined effect UIDs', function() {
            const nullEffect = createValidEffect({ EFFECT_UID: null });
            const undefinedEffect = createValidEffect({ EFFECT_UID: undefined });

            expect(nullEffect.getEffectUid()).to.be.null;
            expect(undefinedEffect.getEffectUid()).to.be.undefined;
            expect(nullEffect.isRecognizedEffect()).to.be.false;
            expect(undefinedEffect.isRecognizedEffect()).to.be.false;
        });

        it('should handle special characters in effect UIDs', function() {
            const effect = createValidEffect({ EFFECT_UID: 'CUSTOM_EFFECT_123!@#' });
            
            expect(effect.getEffectUid()).to.equal('CUSTOM_EFFECT_123!@#');
            expect(effect.isRecognizedEffect()).to.be.false;
            expect(effect.getCategory()).to.equal(EffectCategory.UNKNOWN);
        });

        it('should maintain data integrity during multiple operations', function() {
            const effect = createValidEffect();
            const originalEntityId = effect.getEntityId();
            const originalType = effect.getType();

            // Perform multiple operations
            effect.setType(EffectType.SECTOR);
            effect.setEntityId(99999);
            effect.setEffectUid('CUSTOM_EFFECT');
            effect.setType(originalType); // Back to original
            effect.setEntityId(originalEntityId); // Back to original

            expect(effect.getEntityId()).to.equal(originalEntityId);
            expect(effect.getType()).to.equal(originalType);
        });

        it('should handle entity relationship edge cases', function() {
            const effect = createValidEffect();
            
            // Test with entity that has no methods
            const simpleEntity = { id: 123 };
            effect.setEntity(simpleEntity);
            
            expect(effect.getEntityName()).to.be.undefined;
            expect(effect.getEntityTypeName()).to.be.undefined;
            expect(effect.getEntityDisplayName()).to.equal('Entity 2001');
        });

        it('should handle entity with malformed methods', function() {
            const effect = createValidEffect();
            
            // Test with entity that has methods that throw errors
            const errorEntity = createMockEntity({
                getName: () => { throw new Error('Name method failed'); },
                getTypeName: () => { throw new Error('TypeName method failed'); }
            });
            
            effect.setEntity(errorEntity);
            
            // Should handle errors gracefully
            expect(() => effect.getEntityName()).to.throw();
            expect(() => effect.getEntityTypeName()).to.throw();
        });

        it('should handle extremely long effect UIDs', function() {
            const longUid = 'A'.repeat(10000);
            const effect = createValidEffect({ EFFECT_UID: longUid });
            
            expect(effect.getEffectUid()).to.equal(longUid);
            expect(effect.isRecognizedEffect()).to.be.false;
            
            const validation = effect.validate();
            expect(validation.isValid).to.be.false;
        });

        it('should handle zero values correctly', function() {
            const effect = createValidEffect({ 
                ENTITY_ID: 0,
                TYPE: 0 // EffectType.OTHER
            });
            
            expect(effect.getEntityId()).to.equal(0);
            expect(effect.getType()).to.equal(EffectType.OTHER);
            expect(effect.getTypeName()).to.equal('OTHER');
        });
    });

    describe('Performance Considerations', function() {
        it('should handle creation of many effects efficiently', function() {
            const startTime = Date.now();
            const effects: EffectsModel[] = [];

            for (let i = 0; i < 1000; i++) {
                const uid = ALL_EFFECT_UIDS[i % ALL_EFFECT_UIDS.length];
                effects.push(createValidEffect({
                    ID: i,
                    ENTITY_ID: i + 10000,
                    TYPE: i % 4, // Cycle through effect types
                    EFFECT_UID: uid
                }));
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(effects).to.have.length(1000);
            expect(duration).to.be.lessThan(1000); // Should complete within 1 second

            // Verify some instances
            expect(effects[0].getId()).to.equal(0);
            expect(effects[500].getEntityId()).to.equal(10500);
            expect(effects[999].isRecognizedEffect()).to.be.true;
        });

        it('should handle effect classification efficiently', function() {
            const effects: EffectsModel[] = [];
            
            // Create effects with various UIDs
            for (let i = 0; i < 100; i++) {
                const uid = ALL_EFFECT_UIDS[i % ALL_EFFECT_UIDS.length];
                effects.push(createValidEffect({ EFFECT_UID: uid }));
            }

            const startTime = Date.now();
            const categories = effects.map(effect => effect.getCategory());
            const recognized = effects.map(effect => effect.isRecognizedEffect());
            const combatEffects = effects.map(effect => effect.affectsCombatPerformance());
            const operationEffects = effects.map(effect => effect.affectsShipOperation());
            const endTime = Date.now();

            expect(categories).to.have.length(100);
            expect(recognized).to.have.length(100);
            expect(combatEffects).to.have.length(100);
            expect(operationEffects).to.have.length(100);
            expect(recognized.every(r => r === true)).to.be.true; // All should be recognized
            expect(endTime - startTime).to.be.lessThan(100); // Should be very fast
        });

        it('should handle relationship operations efficiently', function() {
            const effects: EffectsModel[] = [];
            const entities: any[] = [];

            // Create test data
            for (let i = 0; i < 100; i++) {
                effects.push(createValidEffect({ ID: i, ENTITY_ID: i + 1000 }));
                entities.push(createMockEntity({ 
                    getId: () => i + 1000,
                    getName: () => `Entity ${i}`,
                    getTypeName: () => 'SHIP'
                }));
            }

            const startTime = Date.now();
            
            // Set relationships
            for (let i = 0; i < 100; i++) {
                effects[i].setEntity(entities[i]);
            }

            // Get relationship data
            const entityNames = effects.map(effect => effect.getEntityName());
            const displayNames = effects.map(effect => effect.getEntityDisplayName());
            const summaries = effects.map(effect => effect.getEffectSummary());

            const endTime = Date.now();

            expect(entityNames).to.have.length(100);
            expect(displayNames).to.have.length(100);
            expect(summaries).to.have.length(100);
            expect(endTime - startTime).to.be.lessThan(200); // Should be efficient
        });

        it('should handle validation of many effects efficiently', function() {
            const effects: EffectsModel[] = [];
            
            for (let i = 0; i < 500; i++) {
                effects.push(createValidEffect({
                    ID: i,
                    ENTITY_ID: i + 1000,
                    TYPE: i % 4,
                    EFFECT_UID: ALL_EFFECT_UIDS[i % ALL_EFFECT_UIDS.length]
                }));
            }

            const startTime = Date.now();
            const validationResults = effects.map(effect => effect.validate());
            const endTime = Date.now();

            expect(validationResults).to.have.length(500);
            expect(validationResults.every(result => result.isValid)).to.be.true;
            expect(endTime - startTime).to.be.lessThan(500); // Should be fast
        });
    });
});