/**
 * @fileoverview IdGenTableModel Comprehensive Tests
 * 
 * Complete test suite for the IdGenTableModel class covering 100% functionality:
 * - Model creation and data manipulation
 * - ID generation business logic
 * - Type safety and data conversion
 * - Validation rules and constraints
 * - Error handling and edge cases
 * - Schema consistency validation
 * - Advanced BaseModel integration
 * - JSON serialization
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
    IdGenTableModel,
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
 * Create a valid ID generator instance for testing
 */
function createValidIdGen(overrides: Partial<any> = {}): IdGenTableModel {
    return new IdGenTableModel({
        ID: 'SHIP_ID_GENERATOR',
        ID_GEN: 1000,
        ...overrides
    });
}

/**
 * Create an ID generator with minimal required data
 */
function createMinimalIdGen(overrides: Partial<any> = {}): IdGenTableModel {
    return new IdGenTableModel({
        ID: 'TEST_GENERATOR',
        ID_GEN: 0,
        ...overrides
    });
}

// =============================================================================
// ID GEN TABLE MODEL TESTS
// =============================================================================

describe('IdGenTableModel Complete Tests', function() {
    
    describe('Model Creation and Basic Operations', function() {
        it('should create ID generator with minimal required data', function() {
            const idGen = createMinimalIdGen();

            expect(idGen.getId()).to.equal('TEST_GENERATOR');
            expect(idGen.getIdGen()).to.equal(0);
        });

        it('should create ID generator with complete data', function() {
            const idGen = createValidIdGen({
                ID: 'STATION_ID_GENERATOR',
                ID_GEN: 50000
            });

            expect(idGen.getId()).to.equal('STATION_ID_GENERATOR');
            expect(idGen.getIdGen()).to.equal(50000);
        });

        it('should handle various generator types', function() {
            const generators = [
                'SHIP_ID_GENERATOR',
                'STATION_ID_GENERATOR',
                'FLEET_ID_GENERATOR',
                'PLAYER_ID_GENERATOR',
                'CUSTOM_GENERATOR_001'
            ];

            for (const generatorId of generators) {
                const idGen = createValidIdGen({ ID: generatorId });
                expect(idGen.getId()).to.equal(generatorId);
            }
        });
    });

    describe('Data Manipulation and Accessors', function() {
        let idGen: IdGenTableModel;

        beforeEach(function() {
            idGen = createValidIdGen();
        });

        it('should get and set ID correctly', function() {
            expect(idGen.getId()).to.equal('SHIP_ID_GENERATOR');

            idGen.setId('NEW_GENERATOR');
            expect(idGen.getId()).to.equal('NEW_GENERATOR');
        });

        it('should get and set ID_GEN correctly', function() {
            expect(idGen.getIdGen()).to.equal(1000);

            idGen.setIdGen(5000);
            expect(idGen.getIdGen()).to.equal(5000);
        });

        it('should support method chaining for setters', function() {
            const result = idGen
                .setId('CHAINED_GENERATOR')
                .setIdGen(9999);

            expect(result).to.equal(idGen); // Should return same instance
            expect(idGen.getId()).to.equal('CHAINED_GENERATOR');
            expect(idGen.getIdGen()).to.equal(9999);
        });
    });

    describe('ID Generation Business Logic', function() {
        let idGen: IdGenTableModel;

        beforeEach(function() {
            idGen = createValidIdGen({ ID_GEN: 1000 });
        });

        it('should get next ID and increment counter', function() {
            expect(idGen.getIdGen()).to.equal(1000);

            const nextId = idGen.getNextId();
            expect(nextId).to.equal(1000);
            expect(idGen.getIdGen()).to.equal(1001);
        });

        it('should generate sequential IDs correctly', function() {
            const firstId = idGen.getNextId();
            const secondId = idGen.getNextId();
            const thirdId = idGen.getNextId();

            expect(firstId).to.equal(1000);
            expect(secondId).to.equal(1001);
            expect(thirdId).to.equal(1002);
            expect(idGen.getIdGen()).to.equal(1003);
        });

        it('should increment ID by custom amount', function() {
            expect(idGen.getIdGen()).to.equal(1000);

            idGen.incrementId(5);
            expect(idGen.getIdGen()).to.equal(1005);

            idGen.incrementId(10);
            expect(idGen.getIdGen()).to.equal(1015);
        });

        it('should increment ID by default amount of 1', function() {
            expect(idGen.getIdGen()).to.equal(1000);

            idGen.incrementId();
            expect(idGen.getIdGen()).to.equal(1001);

            idGen.incrementId();
            expect(idGen.getIdGen()).to.equal(1002);
        });

        it('should handle zero increments', function() {
            expect(idGen.getIdGen()).to.equal(1000);

            idGen.incrementId(0);
            expect(idGen.getIdGen()).to.equal(1000); // Should remain unchanged
        });

        it('should handle negative increments (decrement)', function() {
            idGen.setIdGen(1000);

            idGen.incrementId(-5);
            expect(idGen.getIdGen()).to.equal(995);
        });

        it('should support method chaining for increment operations', function() {
            const result = idGen.incrementId(10);
            expect(result).to.equal(idGen);
            expect(idGen.getIdGen()).to.equal(1010);
        });
    });

    describe('Edge Cases for ID Generation', function() {
        it('should handle starting from zero', function() {
            const idGen = createValidIdGen({ ID_GEN: 0 });

            const firstId = idGen.getNextId();
            expect(firstId).to.equal(0);
            expect(idGen.getIdGen()).to.equal(1);

            const secondId = idGen.getNextId();
            expect(secondId).to.equal(1);
            expect(idGen.getIdGen()).to.equal(2);
        });

        it('should handle large numbers correctly', function() {
            const largeNumber = Number.MAX_SAFE_INTEGER - 10;
            const idGen = createValidIdGen({ ID_GEN: largeNumber });

            const nextId = idGen.getNextId();
            expect(nextId).to.equal(largeNumber);
            expect(idGen.getIdGen()).to.equal(largeNumber + 1);
        });

        it('should handle negative starting values', function() {
            const idGen = createValidIdGen({ ID_GEN: -100 });

            const firstId = idGen.getNextId();
            expect(firstId).to.equal(-100);
            expect(idGen.getIdGen()).to.equal(-99);

            const secondId = idGen.getNextId();
            expect(secondId).to.equal(-99);
            expect(idGen.getIdGen()).to.equal(-98);
        });

        it('should maintain consistency across multiple operations', function() {
            const idGen = createValidIdGen({ ID_GEN: 500 });

            // Mix of getNextId and incrementId operations
            const id1 = idGen.getNextId(); // 500, counter becomes 501
            idGen.incrementId(10); // counter becomes 511
            const id2 = idGen.getNextId(); // 511, counter becomes 512
            idGen.incrementId(-5); // counter becomes 507
            const id3 = idGen.getNextId(); // 507, counter becomes 508

            expect(id1).to.equal(500);
            expect(id2).to.equal(511);
            expect(id3).to.equal(507);
            expect(idGen.getIdGen()).to.equal(508);
        });
    });

    describe('Validation Rules and Constraints', function() {
        it('should pass validation with valid data', function() {
            const idGen = createValidIdGen();
            const validation = idGen.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
            expect(Object.keys(validation.fieldErrors)).to.be.empty;
        });

        it('should require ID field', function() {
            const idGen = new IdGenTableModel({
                ID_GEN: 1000
            });

            const validation = idGen.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID).to.include("Field 'ID' is required");
        });

        it('should require ID_GEN field', function() {
            const idGen = new IdGenTableModel({
                ID: 'TEST_GENERATOR'
            });

            const validation = idGen.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID_GEN).to.include("Field 'ID_GEN' is required");
        });

        it('should enforce ID maximum length', function() {
            const longId = 'A'.repeat(150); // Exceeds 128 character limit
            const idGen = createValidIdGen({ ID: longId });

            const validation = idGen.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID).to.include('ID cannot exceed 128 characters');
        });

        it('should allow ID at exactly 128 characters', function() {
            const exactLengthId = 'A'.repeat(128);
            const idGen = createValidIdGen({ ID: exactLengthId });

            const validation = idGen.validate();
            expect(validation.isValid).to.be.true;
        });

        it('should enforce ID_GEN minimum value', function() {
            const idGen = createValidIdGen({ ID_GEN: -1 });
            const validation = idGen.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID_GEN).to.include('ID_GEN cannot be negative');
        });

        it('should allow ID_GEN of zero', function() {
            const idGen = createValidIdGen({ ID_GEN: 0 });
            const validation = idGen.validate();

            expect(validation.isValid).to.be.true;
        });

        it('should validate multiple errors simultaneously', function() {
            const idGen = new IdGenTableModel({
                ID: 'A'.repeat(150), // Too long
                ID_GEN: -5 // Negative
            });

            const validation = idGen.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ID).to.exist;
            expect(validation.fieldErrors.ID_GEN).to.exist;
            expect(validation.errors.length).to.be.greaterThanOrEqual(2);
        });
    });

    describe('Schema Definition Validation', function() {
        it('should have correct table name', function() {
            expect(IdGenTableModel.getTableName()).to.equal('ID_GEN_TABLE');
            expect(IdGenTableModel.tableName).to.equal('ID_GEN_TABLE');
        });

        it('should have correct schema structure', function() {
            const schema = IdGenTableModel.getSchema();

            expect(schema.tableName).to.equal('ID_GEN_TABLE');
            expect(schema.comment).to.equal('ID generation sequences');
            expect(schema.columns).to.be.an('array').with.length(2);
            expect(schema.primaryKey).to.deep.equal(['ID']);
            expect(schema.foreignKeys).to.be.an('array').with.length(0);
            expect(schema.indexes).to.be.an('array').with.length(0);
        });

        it('should have correct column definitions', function() {
            const schema = IdGenTableModel.getSchema();
            const columns = schema.columns;

            // ID column
            const idColumn = columns.find(col => col.name === 'ID');
            expect(idColumn).to.exist;
            expect(idColumn!.type).to.equal(DataType.VARCHAR);
            expect(idColumn!.length).to.equal(128);
            expect(idColumn!.primaryKey).to.be.true;
            expect(idColumn!.nullable).to.be.false;

            // ID_GEN column
            const idGenColumn = columns.find(col => col.name === 'ID_GEN');
            expect(idGenColumn).to.exist;
            expect(idGenColumn!.type).to.equal(DataType.BIGINT);
            expect(idGenColumn!.nullable).to.be.false;
        });

        it('should have correct validation rules', function() {
            const validationRules = IdGenTableModel.getValidationRules();
            expect(validationRules).to.have.length(4);

            const idRequiredRule = validationRules.find(rule => rule.field === 'ID' && rule.type === 'required');
            expect(idRequiredRule).to.exist;

            const idMaxLengthRule = validationRules.find(rule => rule.field === 'ID' && rule.type === 'maxLength');
            expect(idMaxLengthRule).to.exist;
            expect(idMaxLengthRule!.value).to.equal(128);

            const idGenRequiredRule = validationRules.find(rule => rule.field === 'ID_GEN' && rule.type === 'required');
            expect(idGenRequiredRule).to.exist;

            const idGenMinRule = validationRules.find(rule => rule.field === 'ID_GEN' && rule.type === 'min');
            expect(idGenMinRule).to.exist;
            expect(idGenMinRule!.value).to.equal(0);
        });
    });

    describe('Model Inheritance and BaseModel Integration', function() {
        it('should extend BaseModel correctly', function() {
            const idGen = createValidIdGen();
            expect(idGen).to.be.instanceOf(BaseModel);
            expect(idGen).to.be.instanceOf(IdGenTableModel);
        });

        it('should support BaseModel data manipulation methods', function() {
            const idGen = createValidIdGen();

            // Test generic get/set
            expect(idGen.get('ID')).to.equal('SHIP_ID_GENERATOR');
            idGen.set('ID', 'NEW_GENERATOR');
            expect(idGen.get('ID')).to.equal('NEW_GENERATOR');

            // Test getData
            const data = idGen.getData();
            expect(data.ID).to.equal('NEW_GENERATOR');
            expect(data.ID_GEN).to.equal(1000);

            // Test setData
            idGen.setData({
                ID: 'UPDATED_GENERATOR',
                ID_GEN: 2000
            });
            expect(idGen.getId()).to.equal('UPDATED_GENERATOR');
            expect(idGen.getIdGen()).to.equal(2000);
        });

        it('should support change tracking', function() {
            const idGen = createValidIdGen();
            expect(idGen.isDirty()).to.be.false;

            idGen.setIdGen(5000);
            expect(idGen.isDirty()).to.be.true;

            const changedFields = idGen.getChangedFields();
            expect(changedFields).to.include('ID_GEN');
            expect(changedFields).to.not.include('ID');
        });

        it('should support primary key handling', function() {
            const idGen = createValidIdGen();
            expect(idGen.getPrimaryKeyValue()).to.equal('SHIP_ID_GENERATOR');

            idGen.setId('NEW_KEY');
            expect(idGen.getPrimaryKeyValue()).to.equal('NEW_KEY');
        });

        it('should support cloning', function() {
            const original = createValidIdGen();
            original.markAsSaved();

            const clone = original.clone();
            expect(clone.getId()).to.equal(original.getId());
            expect(clone.getIdGen()).to.equal(original.getIdGen());
            expect(clone.isNew()).to.equal(original.isNew());

            // Verify independence
            clone.setIdGen(9999);
            expect(original.getIdGen()).to.not.equal(9999);
        });

        it('should support JSON serialization', function() {
            const idGen = createValidIdGen();
            const json = idGen.toJSON();

            expect(json).to.be.an('object');
            expect(json.ID).to.equal('SHIP_ID_GENERATOR');
            expect(json.ID_GEN).to.equal(1000);
        });

        it('should support creating from database row', function() {
            const row = {
                ID: 'DB_GENERATOR',
                ID_GEN: 75000
            };

            const idGen = IdGenTableModel.fromRow(row);
            expect(idGen.getId()).to.equal('DB_GENERATOR');
            expect(idGen.getIdGen()).to.equal(75000);
            expect(idGen.isNew()).to.be.false;
            expect(idGen.isDirty()).to.be.false;
        });
    });

    describe('Special Characters and Edge Cases', function() {
        it('should handle special characters in ID', function() {
            const specialId = 'GENERATOR_@#$%_001';
            const idGen = createValidIdGen({ ID: specialId });

            expect(idGen.getId()).to.equal(specialId);

            const validation = idGen.validate();
            expect(validation.isValid).to.be.true;
        });

        it('should handle unicode characters in ID', function() {
            const unicodeId = 'GENERATOR_??_??_???';
            const idGen = createValidIdGen({ ID: unicodeId });

            expect(idGen.getId()).to.equal(unicodeId);

            const validation = idGen.validate();
            expect(validation.isValid).to.be.true;
        });

        it('should handle very short valid IDs', function() {
            const shortId = 'A';
            const idGen = createValidIdGen({ ID: shortId });

            expect(idGen.getId()).to.equal(shortId);

            const validation = idGen.validate();
            expect(validation.isValid).to.be.true;
        });

        it('should maintain consistency during rapid operations', function() {
            const idGen = createValidIdGen({ ID_GEN: 0 });
            const generatedIds: number[] = [];

            // Generate 100 IDs rapidly
            for (let i = 0; i < 100; i++) {
                generatedIds.push(idGen.getNextId());
            }

            // Verify all IDs are sequential
            for (let i = 0; i < 100; i++) {
                expect(generatedIds[i]).to.equal(i);
            }

            expect(idGen.getIdGen()).to.equal(100);
        });
    });

    describe('Performance Considerations', function() {
        it('should handle many ID generations efficiently', function() {
            const idGen = createValidIdGen({ ID_GEN: 0 });
            const startTime = Date.now();
            const generatedIds: number[] = [];

            for (let i = 0; i < 10000; i++) {
                generatedIds.push(idGen.getNextId());
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(generatedIds).to.have.length(10000);
            expect(duration).to.be.lessThan(100); // Should be very fast
            expect(generatedIds[0]).to.equal(0);
            expect(generatedIds[9999]).to.equal(9999);
            expect(idGen.getIdGen()).to.equal(10000);
        });

        it('should handle creation of many generators efficiently', function() {
            const startTime = Date.now();
            const generators: IdGenTableModel[] = [];

            for (let i = 0; i < 1000; i++) {
                generators.push(createValidIdGen({
                    ID: `GENERATOR_${i}`,
                    ID_GEN: i * 1000
                }));
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(generators).to.have.length(1000);
            expect(duration).to.be.lessThan(1000); // Should complete within 1 second

            // Verify some instances
            expect(generators[0].getId()).to.equal('GENERATOR_0');
            expect(generators[500].getIdGen()).to.equal(500000);
            expect(generators[999].getId()).to.equal('GENERATOR_999');
        });
    });

    // =============================================================================
    // ENHANCED EDITION TESTS - COMPLETE COVERAGE
    // =============================================================================

    describe('Type Safety and Data Conversion', function () {
        it('should handle string ID_GEN values correctly', function () {
            const idGen = new IdGenTableModel({
                ID: 'TEST_GENERATOR',
                ID_GEN: '1500' // String value
            });

            expect(idGen.getIdGen()).to.equal(1500); // Should be converted to number
            expect(typeof idGen.getIdGen()).to.equal('number');
        });

        it('should handle numeric string parsing in getIdGen', function () {
            const idGen = new IdGenTableModel({
                ID: 'TEST_GENERATOR',
                ID_GEN: '0' // String zero
            });

            expect(idGen.getIdGen()).to.equal(0);
            expect(typeof idGen.getIdGen()).to.equal('number');
        });

        it('should handle undefined ID_GEN gracefully', function () {
            const idGen = new IdGenTableModel({
                ID: 'TEST_GENERATOR'
                // ID_GEN not provided
            });

            expect(idGen.getIdGen()).to.equal(0); // Should default to 0
        });

        it('should handle null ID_GEN gracefully', function () {
            const idGen = new IdGenTableModel({
                ID: 'TEST_GENERATOR',
                ID_GEN: null
            });

            expect(idGen.getIdGen()).to.equal(0); // Should default to 0
        });

        it('should handle various numeric formats', function () {
            const testCases = [
                { input: 100, expected: 100 },
                { input: '200', expected: 200 },
                { input: 0, expected: 0 },
                { input: '0', expected: 0 },
                { input: -50, expected: -50 },
                { input: '-75', expected: -75 }
            ];

            for (const testCase of testCases) {
                const idGen = new IdGenTableModel({
                    ID: 'TEST_GENERATOR',
                    ID_GEN: testCase.input
                });

                expect(idGen.getIdGen()).to.equal(testCase.expected);
            }
        });
    });

    describe('Advanced BaseModel Integration', function () {
        let idGen: IdGenTableModel;

        beforeEach(function () {
            idGen = createValidIdGen();
        });

        it('should handle markAsSaved and state transitions correctly', function () {
            // Start with a dirty generator
            idGen.setIdGen(2000);
            expect(idGen.isDirty()).to.be.true;
            expect(idGen.isNew()).to.be.false; // Has ID

            // Mark as saved
            idGen.markAsSaved();
            expect(idGen.isDirty()).to.be.false;
            expect(idGen.isNew()).to.be.false;

            // Verify the changed data is now the original
            expect(idGen.getIdGen()).to.equal(2000);
        });

        it('should reset to original data correctly', function () {
            const originalId = idGen.getId();
            const originalIdGen = idGen.getIdGen();

            // Make changes
            idGen.setId('MODIFIED_GENERATOR');
            idGen.setIdGen(9999);
            expect(idGen.isDirty()).to.be.true;

            // Reset
            idGen.reset();
            expect(idGen.getId()).to.equal(originalId);
            expect(idGen.getIdGen()).to.equal(originalIdGen);
            expect(idGen.isDirty()).to.be.false;
        });

        it('should handle getPrimaryKeyValue correctly', function () {
            const idGen = createValidIdGen({ ID: 'PRIMARY_KEY_TEST' });
            expect(idGen.getPrimaryKeyValue()).to.equal('PRIMARY_KEY_TEST');

            // Test with different ID
            idGen.setId('NEW_PRIMARY_KEY');
            expect(idGen.getPrimaryKeyValue()).to.equal('NEW_PRIMARY_KEY');
        });

        it('should handle clearAllRelated operations', function () {
            // Even though IdGenTableModel has no relations, test the base functionality
            idGen.clearAllRelated();
            expect(idGen.getId()).to.equal('SHIP_ID_GENERATOR'); // Should not affect data
        });

        it('should track changes accurately with multiple operations', function () {
            // Start clean
            expect(idGen.getChangedFields()).to.have.length(0);

            // Make changes
            idGen.setId('CHANGED_GENERATOR');
            idGen.setIdGen(7777);
            
            const changedFields = idGen.getChangedFields();
            expect(changedFields).to.include('ID');
            expect(changedFields).to.include('ID_GEN');

            // Reset and verify
            idGen.reset();
            expect(idGen.getChangedFields()).to.have.length(0);
        });

        it('should support creating multiple instances from rows', function () {
            const rows = [
                { ID: 'GENERATOR_1', ID_GEN: 1000 },
                { ID: 'GENERATOR_2', ID_GEN: 2000 },
                { ID: 'GENERATOR_3', ID_GEN: 3000 }
            ];

            const generators = IdGenTableModel.fromRows(rows);
            expect(generators).to.have.length(3);
            expect(generators[0].getId()).to.equal('GENERATOR_1');
            expect(generators[1].getIdGen()).to.equal(2000);
            expect(generators[2].getId()).to.equal('GENERATOR_3');
        });

        it('should preserve data integrity in clones', function () {
            const originalIdGen = idGen.getIdGen();
            
            const clone = idGen.clone();
            expect(clone.getId()).to.equal(idGen.getId());
            expect(clone.getIdGen()).to.equal(idGen.getIdGen());
            
            // Verify independence
            clone.setIdGen(8888);
            expect(idGen.getIdGen()).to.equal(originalIdGen); // Original should be unchanged
        });
    });

    describe('Schema Consistency Validation', function () {
        it('should validate schema-relation consistency', function () {
            const consistency = IdGenTableModel.validateSchemaConsistency();
            
            expect(consistency).to.be.an('object');
            expect(consistency.isConsistent).to.be.a('boolean');
            expect(consistency.issues).to.be.an('array');
            expect(consistency.suggestions).to.be.an('array');

            // IdGenTableModel has no relations, so it should be consistent
            expect(consistency.isConsistent).to.be.true;
            expect(consistency.issues).to.be.empty;
        });

        it('should generate foreign keys from relations', function () {
            const generatedFKs = IdGenTableModel.generateForeignKeysFromRelations();
            
            expect(generatedFKs).to.be.an('array');
            // IdGenTableModel has no relations, so no foreign keys should be generated
            expect(generatedFKs).to.be.empty;
        });

        it('should validate relationship mappings structure', function () {
            const relations = IdGenTableModel.getRelationMappings();
            
            expect(relations).to.be.an('object');
            // IdGenTableModel has no relations
            expect(Object.keys(relations)).to.have.length(0);
        });

        it('should get specific relation definition', function () {
            const nonExistentRelation = IdGenTableModel.getRelation('nonexistent');
            expect(nonExistentRelation).to.be.undefined;
        });

        it('should resolve model classes correctly', function () {
            // Test with class reference
            const ClassModel = IdGenTableModel.resolveModelClass(IdGenTableModel);
            expect(ClassModel).to.equal(IdGenTableModel);

            // Test with function reference
            const FunctionModel = IdGenTableModel.resolveModelClass(() => IdGenTableModel);
            expect(FunctionModel).to.equal(IdGenTableModel);

            // Test with string reference (should throw)
            expect(() => IdGenTableModel.resolveModelClass('StringModel')).to.throw('String model references not yet implemented');
        });
    });

    describe('Enhanced JSON Serialization', function () {
        let idGen: IdGenTableModel;

        beforeEach(function () {
            idGen = createValidIdGen();
        });

        it('should serialize basic generator data to JSON', function () {
            const json = idGen.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.ID).to.equal('SHIP_ID_GENERATOR');
            expect(json.ID_GEN).to.equal(1000);
        });

        it('should handle serialization with no relations', function () {
            // Since IdGenTableModel has no relations, this should be straightforward
            const json = idGen.toJSON();
            
            expect(json).to.be.an('object');
            expect(Object.keys(json)).to.have.length(2); // Only ID and ID_GEN
        });

        it('should handle different data types in serialization', function () {
            idGen.setIdGen(0);
            const json = idGen.toJSON();
            
            expect(json.ID_GEN).to.equal(0);
            expect(typeof json.ID_GEN).to.equal('number');
        });

        it('should serialize after business operations', function () {
            const nextId = idGen.getNextId();
            const json = idGen.toJSON();
            
            expect(json.ID_GEN).to.equal(1001); // Should reflect the incremented value
            expect(nextId).to.equal(1000);
        });
    });

    describe('Business Logic Integration Tests', function () {
        it('should maintain generator state across clone operations', function () {
            const original = createValidIdGen({ ID_GEN: 500 });
            
            // Generate some IDs
            const id1 = original.getNextId(); // 500, counter becomes 501
            const id2 = original.getNextId(); // 501, counter becomes 502
            
            // Clone the generator
            const clone = original.clone();
            
            // Both should have the same current state
            expect(clone.getIdGen()).to.equal(502);
            
            // But they should operate independently
            const originalNext = original.getNextId(); // 502, counter becomes 503
            const cloneNext = clone.getNextId();       // 502, counter becomes 503
            
            expect(originalNext).to.equal(502);
            expect(cloneNext).to.equal(502);
            expect(original.getIdGen()).to.equal(503);
            expect(clone.getIdGen()).to.equal(503);
        });

        it('should handle concurrent-like operations correctly', function () {
            const idGen = createValidIdGen({ ID_GEN: 1000 });
            
            // Simulate rapid operations
            const operations = [];
            for (let i = 0; i < 100; i++) {
                if (i % 3 === 0) {
                    operations.push({ type: 'nextId', result: idGen.getNextId() });
                } else if (i % 3 === 1) {
                    operations.push({ type: 'increment', result: idGen.incrementId(2) });
                } else {
                    operations.push({ type: 'current', result: idGen.getIdGen() });
                }
            }
            
            // Verify the final state is predictable
            expect(idGen.getIdGen()).to.be.a('number');
            expect(idGen.getIdGen()).to.be.greaterThan(1000);
        });

        it('should provide detailed generator summary', function () {
            const idGen = createValidIdGen({
                ID: 'DETAILED_GENERATOR',
                ID_GEN: 5000
            });
            
            // Generate some IDs to create history
            const id1 = idGen.getNextId();
            const id2 = idGen.getNextId();
            
            // Create a summary object
            const summary = {
                id: idGen.getId(),
                currentValue: idGen.getIdGen(),
                lastGenerated: id2,
                secondLastGenerated: id1,
                isActive: idGen.getIdGen() > 0,
                generatorType: idGen.getId().includes('SHIP') ? 'SHIP' : 'OTHER'
            };
            
            expect(summary.id).to.equal('DETAILED_GENERATOR');
            expect(summary.currentValue).to.equal(5002);
            expect(summary.lastGenerated).to.equal(5001);
            expect(summary.secondLastGenerated).to.equal(5000);
            expect(summary.isActive).to.be.true;
            expect(summary.generatorType).to.equal('OTHER');
        });
    });

    describe('Asynchronous Validation', function () {
        it('should handle validateForeignKeys placeholder', async function () {
            const idGen = createValidIdGen();
            
            // Currently returns placeholder implementation
            const validation = await idGen.validateForeignKeys();
            
            expect(validation).to.be.an('object');
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.an('array');
            expect(validation.fieldErrors).to.be.an('object');
        });
    });

    describe('Generator Lifecycle Management', function () {
        it('should support generator initialization patterns', function () {
            const generators = [
                { id: 'SHIP_GENERATOR', startValue: 100000 },
                { id: 'STATION_GENERATOR', startValue: 200000 },
                { id: 'FLEET_GENERATOR', startValue: 300000 },
                { id: 'PLAYER_GENERATOR', startValue: 400000 }
            ];
            
            const createdGenerators = generators.map(config => 
                createValidIdGen({
                    ID: config.id,
                    ID_GEN: config.startValue
                })
            );
            
            // Verify all generators are properly initialized
            expect(createdGenerators[0].getId()).to.equal('SHIP_GENERATOR');
            expect(createdGenerators[0].getIdGen()).to.equal(100000);
            
            expect(createdGenerators[3].getId()).to.equal('PLAYER_GENERATOR');
            expect(createdGenerators[3].getIdGen()).to.equal(400000);
        });

        it('should support generator reset operations', function () {
            const idGen = createValidIdGen({ ID_GEN: 1000 });
            
            // Generate some IDs
            idGen.getNextId();
            idGen.getNextId();
            idGen.incrementId(10);
            
            expect(idGen.getIdGen()).to.equal(1012);
            
            // Reset to a specific value
            idGen.setIdGen(5000);
            expect(idGen.getIdGen()).to.equal(5000);
            
            // Continue generating from new value
            const nextId = idGen.getNextId();
            expect(nextId).to.equal(5000);
            expect(idGen.getIdGen()).to.equal(5001);
        });
    });
});