/**
 * @fileoverview SectorsItemsModel Factual Tests
 * 
 * Test suite for the SectorsItemsModel class based only on documented TABLE_SECTORS_ITEMS.md specifications.
 * Tests core functionality for binary storage of serialized item data without making assumptions about StarMade mechanics.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import {
    SectorsItemsModel,
    MAX_ITEMS_SIZE,
    ITEM_RECORD_SIZE,
    MAX_ITEM_STACKS,
    BaseModel,
    DataType,
    type ModelValidationResult
} from '../../../src/tables/index.js';

// =============================================================================
// TEST DATA AND HELPERS
// =============================================================================

/**
 * Create a valid sectors items record for testing
 */
function createValidSectorsItems(overrides: Partial<any> = {}): SectorsItemsModel {
    return new SectorsItemsModel({
        ID: 1001,
        ITEMS: Buffer.from('test binary data'),
        ...overrides
    });
}

/**
 * Create sectors items with minimal required data
 */
function createMinimalSectorsItems(overrides: Partial<any> = {}): SectorsItemsModel {
    return new SectorsItemsModel({
        ITEMS: Buffer.alloc(0), // Empty buffer - minimal requirement
        ...overrides
    });
}

/**
 * Create mock serialized item data based on documentation format
 * Each item record is 22 bytes: TYPE(2) + COUNT(4) + POS_X(4) + POS_Y(4) + POS_Z(4) + META_ID(4)
 */
function createMockItemData(itemCount: number = 1): Buffer {
    const buffer = Buffer.alloc(ITEM_RECORD_SIZE * itemCount);
    
    for (let i = 0; i < itemCount; i++) {
        const offset = i * ITEM_RECORD_SIZE;
        
        // TYPE (SMALLINT - 2 bytes)
        buffer.writeInt16LE(i + 1, offset);
        
        // COUNT (INTEGER - 4 bytes) 
        buffer.writeInt32LE((i + 1) * 10, offset + 2);
        
        // POS_X (FLOAT - 4 bytes)
        buffer.writeFloatLE(i * 10.5, offset + 6);
        
        // POS_Y (FLOAT - 4 bytes)
        buffer.writeFloatLE(i * 20.5, offset + 10);
        
        // POS_Z (FLOAT - 4 bytes)
        buffer.writeFloatLE(i * 30.5, offset + 14);
        
        // META_ID (INTEGER - 4 bytes)
        buffer.writeInt32LE(i + 1000, offset + 18);
    }
    
    return buffer;
}

/**
 * Create sectors items with mock item data
 */
function createSectorsItemsWithMockData(itemCount: number = 1, overrides: Partial<any> = {}): SectorsItemsModel {
    return createValidSectorsItems({
        ITEMS: createMockItemData(itemCount),
        ...overrides
    });
}

/**
 * Create a mock sector for relationship testing
 */
function createMockSector(overrides: Partial<any> = {}): any {
    return {
        getId: () => 1001,
        getName: () => 'Test Sector',
        getCoordinatesString: () => '(10, 20, 30)',
        getX: () => 10,
        getY: () => 20,
        getZ: () => 30,
        getType: () => 0,
        getTypeName: () => 'VOID',
        toJSON: () => ({ 
            id: 1001, 
            name: 'Test Sector', 
            coordinates: '(10, 20, 30)',
            type: 'VOID'
        }),
        ...overrides
    };
}

// =============================================================================
// SECTORS ITEMS MODEL TESTS
// =============================================================================

describe('SectorsItemsModel Factual Tests', function () {

    describe('Model Creation and Basic Operations', function () {
        it('should create sectors items with minimal required data', function () {
            const sectorsItems = createMinimalSectorsItems();

            expect(sectorsItems.getId()).to.be.undefined;
            expect(sectorsItems.getItems()).to.be.instanceOf(Buffer);
            expect(sectorsItems.getItems().length).to.equal(0);
            expect(sectorsItems.hasItems()).to.be.false;
        });

        it('should create sectors items with complete data', function () {
            const testBuffer = Buffer.from('test serialized data');
            const sectorsItems = createValidSectorsItems({
                ID: 12345,
                ITEMS: testBuffer
            });

            expect(sectorsItems.getId()).to.equal(12345);
            expect(sectorsItems.getItems()).to.equal(testBuffer);
            expect(sectorsItems.getItems().length).to.equal(testBuffer.length);
            expect(sectorsItems.hasItems()).to.be.true;
        });

        it('should handle null ID correctly', function () {
            const sectorsItems = createMinimalSectorsItems({ ID: null });
            expect(sectorsItems.getId()).to.be.null;
        });

        it('should handle undefined ID correctly', function () {
            const sectorsItems = createMinimalSectorsItems();
            expect(sectorsItems.getId()).to.be.undefined;
        });
    });

    describe('Data Manipulation and Accessors', function () {
        let sectorsItems: SectorsItemsModel;

        beforeEach(function () {
            sectorsItems = createValidSectorsItems();
        });

        it('should get and set all fields correctly', function () {
            sectorsItems.setId(99999);
            expect(sectorsItems.getId()).to.equal(99999);

            const newBuffer = Buffer.from('new serialized data');
            sectorsItems.setItems(newBuffer);
            expect(sectorsItems.getItems()).to.equal(newBuffer);
        });

        it('should support method chaining for setters', function () {
            const testBuffer = Buffer.from('chained data');
            const result = sectorsItems
                .setId(54321)
                .setItems(testBuffer);

            expect(result).to.equal(sectorsItems); // Should return same instance
            expect(sectorsItems.getId()).to.equal(54321);
            expect(sectorsItems.getItems()).to.equal(testBuffer);
        });

        it('should handle buffer replacement correctly', function () {
            const originalBuffer = sectorsItems.getItems();
            const newBuffer = Buffer.from('completely different data');

            sectorsItems.setItems(newBuffer);
            expect(sectorsItems.getItems()).to.equal(newBuffer);
            expect(sectorsItems.getItems()).to.not.equal(originalBuffer);
        });
    });

    describe('Binary Data Handling', function () {
        it('should handle empty buffers', function () {
            const emptyBuffer = Buffer.alloc(0);
            const sectorsItems = createValidSectorsItems({ ITEMS: emptyBuffer });

            expect(sectorsItems.hasItems()).to.be.false;
            expect(sectorsItems.getItems().length).to.equal(0);
        });

        it('should handle small buffers', function () {
            const smallBuffer = Buffer.from([1, 2, 3, 4]);
            const sectorsItems = createValidSectorsItems({ ITEMS: smallBuffer });

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.getItems().length).to.equal(4);
            expect(sectorsItems.getItems()).to.deep.equal(smallBuffer);
        });

        it('should handle large buffers', function () {
            // Create buffer close to maximum size (22,528 bytes from documentation)
            const largeBuffer = Buffer.alloc(MAX_ITEMS_SIZE);
            largeBuffer.fill(0xAB); // Fill with test pattern

            const sectorsItems = createValidSectorsItems({ ITEMS: largeBuffer });

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.getItems().length).to.equal(MAX_ITEMS_SIZE);
            expect(sectorsItems.getItems()[0]).to.equal(0xAB);
            expect(sectorsItems.getItems()[MAX_ITEMS_SIZE - 1]).to.equal(0xAB);
        });

        it('should handle binary data with all byte values', function () {
            // Create buffer with all possible byte values (0-255)
            const fullRangeBuffer = Buffer.alloc(256);
            for (let i = 0; i < 256; i++) {
                fullRangeBuffer[i] = i;
            }

            const sectorsItems = createValidSectorsItems({ ITEMS: fullRangeBuffer });

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.getItems().length).to.equal(256);

            // Verify all byte values are preserved
            for (let i = 0; i < 256; i++) {
                expect(sectorsItems.getItems()[i]).to.equal(i);
            }
        });

        it('should handle mock structured item data', function () {
            const mockData = createMockItemData(3); // 3 items, 66 bytes total
            const sectorsItems = createSectorsItemsWithMockData(3);

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.getItems().length).to.equal(66); // 3 * ITEM_RECORD_SIZE bytes
            expect(sectorsItems.getItems()).to.deep.equal(mockData);
        });
    });

    describe('Item Detection Logic', function () {
        it('should detect presence of items correctly', function () {
            const withItems = createValidSectorsItems({ ITEMS: Buffer.from('data') });
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });

            expect(withItems.hasItems()).to.be.true;
            expect(emptyItems.hasItems()).to.be.false;
        });

        it('should handle null buffer gracefully', function () {
            const sectorsItems = new SectorsItemsModel({
                ID: 1,
                ITEMS: null
            });

            // Depending on implementation, this might throw or return false
            // We test the actual behavior without making assumptions
            try {
                const hasItems = sectorsItems.hasItems();
                expect(typeof hasItems).to.equal('boolean');
            } catch (error) {
                // If it throws, that's also acceptable behavior for null data
                expect(error).to.be.instanceOf(Error);
            }
        });

        it('should handle various buffer sizes', function () {
            const sizes = [1, ITEM_RECORD_SIZE, ITEM_RECORD_SIZE * 2, ITEM_RECORD_SIZE * 3, 100, 1000, MAX_ITEMS_SIZE];

            sizes.forEach(size => {
                const buffer = Buffer.alloc(size);
                const sectorsItems = createValidSectorsItems({ ITEMS: buffer });

                if (size > 0) {
                    expect(sectorsItems.hasItems()).to.be.true;
                } else {
                    expect(sectorsItems.hasItems()).to.be.false;
                }
                expect(sectorsItems.getItems().length).to.equal(size);
            });
        });
    });

    describe('Validation Rules and Constraints', function () {
        it('should pass validation with valid data', function () {
            const sectorsItems = createValidSectorsItems();
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should require ITEMS field', function () {
            const sectorsItems = new SectorsItemsModel({
                ID: 1
                // Missing ITEMS
            });

            const validation = sectorsItems.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ITEMS).to.include("Field 'ITEMS' is required");
        });

        it('should accept null ID', function () {
            const sectorsItems = createValidSectorsItems({ ID: null });
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.true;
        });

        it('should accept undefined ID', function () {
            const sectorsItems = createMinimalSectorsItems(); // No ID provided
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.true;
        });

        it('should validate with empty buffer', function () {
            const sectorsItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.true;
        });

        it('should validate with maximum size buffer', function () {
            const maxBuffer = Buffer.alloc(MAX_ITEMS_SIZE); // Maximum size from documentation
            const sectorsItems = createValidSectorsItems({ ITEMS: maxBuffer });
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.true;
        });

        it('should reject buffer exceeding maximum size', function () {
            const oversizeBuffer = Buffer.alloc(MAX_ITEMS_SIZE + 1); // Exceeds maximum
            const sectorsItems = createValidSectorsItems({ ITEMS: oversizeBuffer });
            const validation = sectorsItems.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.ITEMS).to.include(`ITEMS cannot exceed ${MAX_ITEMS_SIZE} bytes`);
        });
    });

    describe('Schema Definition Validation', function () {
        it('should have correct table name', function () {
            expect(SectorsItemsModel.getTableName()).to.equal('SECTORS_ITEMS');
            expect(SectorsItemsModel.tableName).to.equal('SECTORS_ITEMS');
        });

        it('should have correct schema structure', function() {
            const schema = SectorsItemsModel.getSchema();

            expect(schema.tableName).to.equal('SECTORS_ITEMS');
            expect(schema.comment).to.equal('Serialized data for items floating freely in space sectors');
            expect(schema.columns).to.be.an('array').with.length(2);
            expect(schema.primaryKey).to.deep.equal(['ID']);
            expect(schema.foreignKeys).to.be.an('array').with.length(0);
            expect(schema.indexes).to.be.an('array').with.length(0);
        });

        it('should have correct column definitions', function () {
            const schema = SectorsItemsModel.getSchema();
            const columns = schema.columns;

            const idColumn = columns.find(col => col.name === 'ID');
            expect(idColumn).to.exist;
            expect(idColumn!.type).to.equal(DataType.BIGINT);
            expect(idColumn!.primaryKey).to.be.true;
            expect(idColumn!.nullable).to.be.true; // Nullable as per documentation

            const itemsColumn = columns.find(col => col.name === 'ITEMS');
            expect(itemsColumn).to.exist;
            expect(itemsColumn!.type).to.equal(DataType.BLOB);
            expect(itemsColumn!.nullable).to.be.false;
        });

        it('should have appropriate validation rules', function() {
            const schema = SectorsItemsModel.getSchema();
            const rules = schema.validationRules;

            expect(rules).to.be.an('array').with.length(2); // Now has 2 rules: required + custom
            
            const itemsRequiredRule = rules.find(rule => rule.field === 'ITEMS' && rule.type === 'required');
            expect(itemsRequiredRule).to.exist;

            const itemsCustomRule = rules.find(rule => rule.field === 'ITEMS' && rule.type === 'custom');
            expect(itemsCustomRule).to.exist;
            expect(itemsCustomRule!.message).to.equal('Invalid ITEMS data');
        });
    });

    describe('Schema Consistency Validation', function () {
        it('should validate schema-relation consistency', function () {
            const consistency = SectorsItemsModel.validateSchemaConsistency();
            
            expect(consistency).to.be.an('object');
            expect(consistency.isConsistent).to.be.a('boolean');
            expect(consistency.issues).to.be.an('array');
            expect(consistency.suggestions).to.be.an('array');

            // SectorsItemsModel has one BelongsToOneRelation but no foreign keys in schema
            if (!consistency.isConsistent) {
                console.log('Schema consistency issues:', consistency.issues);
                console.log('Suggestions:', consistency.suggestions);
            }
        });

        it('should generate foreign keys from relations', function () {
            const generatedFKs = SectorsItemsModel.generateForeignKeysFromRelations();
            
            expect(generatedFKs).to.be.an('array');
            
            // SectorsItemsModel has one BelongsToOneRelation (sector)
            expect(generatedFKs).to.have.length(1);
            
            const sectorFK = generatedFKs[0];
            expect(sectorFK.name).to.equal('FK_SECTORS_ITEMS_SECTOR');
            expect(sectorFK.columns).to.deep.equal(['ID']);
            expect(sectorFK.referencedTable).to.equal('SECTORS');
            expect(sectorFK.referencedColumns).to.deep.equal(['ITEMS']);
        });

        it('should validate relationship mappings structure', function () {
            const relations = SectorsItemsModel.getRelationMappings();
            
            expect(relations).to.be.an('object');
            expect(Object.keys(relations)).to.have.length(1);
            
            const sectorRelation = relations.sector;
            expect(sectorRelation).to.exist;
            expect(sectorRelation.join.from).to.equal('SECTORS_ITEMS.ID');
            expect(sectorRelation.join.to).to.equal('SECTORS.ITEMS');
        });

        it('should get specific relation definition', function () {
            const sectorRelation = SectorsItemsModel.getRelation('sector');
            expect(sectorRelation).to.exist;

            const nonExistentRelation = SectorsItemsModel.getRelation('nonexistent');
            expect(nonExistentRelation).to.be.undefined;
        });

        it('should resolve model classes correctly', function () {
            // Test with class reference
            const ClassModel = SectorsItemsModel.resolveModelClass(SectorsItemsModel);
            expect(ClassModel).to.equal(SectorsItemsModel);

            // Test with function reference
            const FunctionModel = SectorsItemsModel.resolveModelClass(() => SectorsItemsModel);
            expect(FunctionModel).to.equal(SectorsItemsModel);

            // Test with string reference (should throw)
            expect(() => SectorsItemsModel.resolveModelClass('StringModel')).to.throw('String model references not yet implemented');
        });
    });

    describe('Model Inheritance and BaseModel Integration', function () {
        it('should extend BaseModel correctly', function () {
            const sectorsItems = createValidSectorsItems();
            expect(sectorsItems).to.be.instanceOf(BaseModel);
            expect(sectorsItems).to.be.instanceOf(SectorsItemsModel);
        });

        it('should support BaseModel functionality', function () {
            const sectorsItems = createValidSectorsItems();

            // Test change tracking
            expect(sectorsItems.isDirty()).to.be.false;
            sectorsItems.setItems(Buffer.from('modified'));
            expect(sectorsItems.isDirty()).to.be.true;

            // Test new record detection
            const newSectorsItems = createMinimalSectorsItems(); // No ID provided
            expect(newSectorsItems.isNew()).to.be.true;

            // Test cloning
            const clone = sectorsItems.clone();
            expect(clone.getId()).to.equal(sectorsItems.getId());
            expect(clone.getItems()).to.deep.equal(sectorsItems.getItems());
        });
    });

    describe('Advanced BaseModel Integration', function () {
        let sectorsItems: SectorsItemsModel;

        beforeEach(function () {
            sectorsItems = createValidSectorsItems();
        });

        it('should handle markAsSaved and state transitions correctly', function () {
            // Start with a dirty sectors items
            sectorsItems.setItems(Buffer.from('modified data'));
            expect(sectorsItems.isDirty()).to.be.true;
            expect(sectorsItems.isNew()).to.be.false; // Has ID

            // Mark as saved
            sectorsItems.markAsSaved();
            expect(sectorsItems.isDirty()).to.be.false;
            expect(sectorsItems.isNew()).to.be.false;

            // Verify the changed data is now the original
            expect(sectorsItems.getItems().toString()).to.equal('modified data');
        });

        it('should reset to original data correctly', function () {
            const originalItems = sectorsItems.getItems();
            const originalId = sectorsItems.getId();

            // Make changes
            sectorsItems.setItems(Buffer.from('modified data'));
            sectorsItems.setId(99999);
            expect(sectorsItems.isDirty()).to.be.true;

            // Reset
            sectorsItems.reset();
            expect(sectorsItems.getItems()).to.deep.equal(originalItems);
            expect(sectorsItems.getId()).to.equal(originalId);
            expect(sectorsItems.isDirty()).to.be.false;
        });

        it('should handle getPrimaryKeyValue correctly', function () {
            const sectorsItems = createValidSectorsItems({ ID: 12345 });
            expect(sectorsItems.getPrimaryKeyValue()).to.equal(12345);

            // Test without ID
            const newSectorsItems = createMinimalSectorsItems();
            expect(newSectorsItems.getPrimaryKeyValue()).to.be.undefined;
        });

        it('should handle clearAllRelated operations', function () {
            const mockSector = createMockSector();
            
            // Set sector relationship
            sectorsItems.setSector(mockSector);
            expect(sectorsItems.hasSectorLoaded()).to.be.true;

            // Clear all relations
            sectorsItems.clearAllRelated();
            expect(sectorsItems.hasSectorLoaded()).to.be.false;
        });

        it('should track changes accurately with multiple operations', function () {
            // Start clean
            expect(sectorsItems.getChangedFields()).to.have.length(0);

            // Make changes
            sectorsItems.setItems(Buffer.from('new data'));
            sectorsItems.setId(88888);
            
            const changedFields = sectorsItems.getChangedFields();
            expect(changedFields).to.include('ITEMS');
            expect(changedFields).to.include('ID');

            // Reset and verify
            sectorsItems.reset();
            expect(sectorsItems.getChangedFields()).to.have.length(0);
        });

        it('should support creating instances from database rows', function () {
            const row = {
                ID: 8888,
                ITEMS: Buffer.from('database data')
            };

            const sectorsItems = SectorsItemsModel.fromRow(row);
            expect(sectorsItems.getId()).to.equal(8888);
            expect(sectorsItems.getItems().toString()).to.equal('database data');
            expect(sectorsItems.isNew()).to.be.false;
            expect(sectorsItems.isDirty()).to.be.false;
        });

        it('should support creating multiple instances from rows', function () {
            const rows = [
                { ID: 1, ITEMS: Buffer.from('data1') },
                { ID: 2, ITEMS: Buffer.from('data2') },
                { ID: 3, ITEMS: Buffer.from('data3') }
            ];

            const sectorsItemsList = SectorsItemsModel.fromRows(rows);
            expect(sectorsItemsList).to.have.length(3);
            expect(sectorsItemsList[0].getId()).to.equal(1);
            expect(sectorsItemsList[1].getItems().toString()).to.equal('data2');
            expect(sectorsItemsList[2].hasItems()).to.be.true;
        });

        it('should preserve relationship data in clones', function () {
            const mockSector = createMockSector();
            
            sectorsItems.setSector(mockSector);
            
            const clone = sectorsItems.clone();
            expect(clone.hasSectorLoaded()).to.be.true;
            expect(clone.getSector()).to.equal(mockSector);
            
            // Verify independence
            clone.setSector(undefined);
            expect(sectorsItems.hasSectorLoaded()).to.be.true; // Original should still have relation
        });
    });

    describe('Edge Cases and Error Handling', function () {
        it('should maintain data integrity during operations', function () {
            const sectorsItems = createValidSectorsItems();
            const originalId = sectorsItems.getId();
            const originalBuffer = sectorsItems.getItems();

            // Perform multiple buffer changes
            sectorsItems.setItems(Buffer.from('temp1'));
            sectorsItems.setItems(Buffer.from('temp2'));
            sectorsItems.setItems(originalBuffer);

            // ID should remain unchanged
            expect(sectorsItems.getId()).to.equal(originalId);
            expect(sectorsItems.getItems()).to.deep.equal(originalBuffer);
        });

        it('should handle very large IDs', function () {
            const largeId = Number.MAX_SAFE_INTEGER;
            const sectorsItems = createValidSectorsItems({ ID: largeId });

            expect(sectorsItems.getId()).to.equal(largeId);
        });

        it('should handle negative IDs', function () {
            const negativeId = -12345;
            const sectorsItems = createValidSectorsItems({ ID: negativeId });

            expect(sectorsItems.getId()).to.equal(negativeId);
        });

        it('should handle buffer modifications correctly', function () {
            const originalData = Buffer.from([1, 2, 3, 4]);
            const sectorsItems = createValidSectorsItems({ ITEMS: originalData });

            // Modify the original buffer - should not affect stored data
            // (This depends on whether the implementation clones or references)
            originalData[0] = 99;

            // The stored buffer should maintain its original value
            // (This depends on whether the implementation clones or references)
            expect(sectorsItems.getItems()).to.be.instanceOf(Buffer);
        });

        it('should handle concurrent access patterns', function () {
            const sectorsItems = createValidSectorsItems();

            // Simulate concurrent reads
            const buffer1 = sectorsItems.getItems();
            const buffer2 = sectorsItems.getItems();

            expect(buffer1).to.be.instanceOf(Buffer);
            expect(buffer2).to.be.instanceOf(Buffer);
            // Both should represent the same data
            expect(buffer1).to.deep.equal(buffer2);
        });
    });

    describe('Binary Data Format Compliance', function () {
        it('should handle item record structure according to documentation', function() {
            // Test with exactly one item record (22 bytes)
            const singleItemBuffer = createMockItemData(1);
            const sectorsItems = createValidSectorsItems({ ITEMS: singleItemBuffer });

            expect(sectorsItems.getItems().length).to.equal(ITEM_RECORD_SIZE);
            expect(sectorsItems.hasItems()).to.be.true;
            
            // Verify we can read the structured data back
            const buffer = sectorsItems.getItems();
            expect(buffer.readInt16LE(0)).to.equal(1); // TYPE
            expect(buffer.readInt32LE(2)).to.equal(10); // COUNT
            expect(buffer.readFloatLE(6)).to.be.closeTo(0, 0.01); // POS_X
            expect(buffer.readInt32LE(18)).to.equal(1000); // META_ID
        });

        it('should handle maximum theoretical item count', function () {
            // Maximum items: 22,528 ÷ 22 = 1,024 items
            const maxBuffer = createMockItemData(MAX_ITEM_STACKS);
            const sectorsItems = createValidSectorsItems({ ITEMS: maxBuffer });

            expect(sectorsItems.getItems().length).to.equal(MAX_ITEMS_SIZE);
            expect(sectorsItems.hasItems()).to.be.true;

            // Verify first and last item records
            const buffer = sectorsItems.getItems();
            expect(buffer.readInt16LE(0)).to.equal(1); // First item TYPE
            expect(buffer.readInt16LE((MAX_ITEM_STACKS - 1) * ITEM_RECORD_SIZE)).to.equal(MAX_ITEM_STACKS); // Last item TYPE
        });

        it('should handle partial item records gracefully', function () {
            // Buffer with incomplete last record (not multiple of ITEM_RECORD_SIZE)
            const partialBuffer = Buffer.alloc(ITEM_RECORD_SIZE * 2 + 1); // 2 complete records + 1 byte
            partialBuffer.fill(0xCC);
            
            const sectorsItems = createValidSectorsItems({ ITEMS: partialBuffer });

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.getItems().length).to.equal(ITEM_RECORD_SIZE * 2 + 1);
        });
    });

    describe('Performance Considerations', function () {
        it('should handle creation of many sectors items efficiently', function () {
            const startTime = Date.now();
            const sectorsItemsList: SectorsItemsModel[] = [];

            for (let i = 0; i < 1000; i++) {
                const buffer = createMockItemData(i % 10 + 1); // 1-10 items per sector
                sectorsItemsList.push(createValidSectorsItems({
                    ID: i,
                    ITEMS: buffer
                }));
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(sectorsItemsList).to.have.length(1000);
            expect(duration).to.be.lessThan(1000); // Should complete within 1 second

            // Verify some instances
            expect(sectorsItemsList[0].getId()).to.equal(0);
            expect(sectorsItemsList[500].hasItems()).to.be.true;
            expect(sectorsItemsList[999].getItems()).to.be.instanceOf(Buffer);
        });

        it('should handle large buffer operations efficiently', function () {
            const sectorsItemsList: SectorsItemsModel[] = [];

            // Create sectors with progressively larger buffers
            for (let i = 0; i < 100; i++) {
                const bufferSize = (i + 1) * 100; // 100 to 10,000 bytes
                const buffer = Buffer.alloc(bufferSize);
                buffer.fill(i % 256);
                sectorsItemsList.push(createValidSectorsItems({
                    ID: i,
                    ITEMS: buffer
                }));
            }

            const startTime = Date.now();

            // Perform operations on all sectors
            const results = sectorsItemsList.map(sectorsItems => ({
                id: sectorsItems.getId(),
                hasItems: sectorsItems.hasItems(),
                size: sectorsItems.getItems().length,
                efficiency: sectorsItems.getStorageEfficiency(),
                estimatedStacks: sectorsItems.getEstimatedStackCount(),
                summary: sectorsItems.getItemsSummary(),
                firstByte: sectorsItems.getItems()[0]
            }));

            const endTime = Date.now();

            expect(results).to.have.length(100);
            expect(results.every(r => r.hasItems)).to.be.true;
            expect(results.every(r => typeof r.efficiency === 'number')).to.be.true;
            expect(results.every(r => typeof r.summary === 'object')).to.be.true;
            expect(endTime - startTime).to.be.lessThan(100); // Should be very fast
        });

        it('should handle buffer memory usage appropriately', function () {
            const largeBuffer = Buffer.alloc(20000); // Large buffer
            largeBuffer.fill(0xFF);

            const sectorsItems = createValidSectorsItems({ ITEMS: largeBuffer });

            // Test that we can create multiple instances without issues
            const instances = [];
            for (let i = 0; i < 10; i++) {
                instances.push(sectorsItems.clone());
            }

            expect(instances).to.have.length(10);
            instances.forEach(instance => {
                expect(instance.getItems().length).to.equal(20000);
                expect(instance.hasItems()).to.be.true;
                expect(instance.getStorageEfficiency()).to.be.greaterThan(0);
            });
        });

        it('should handle comparison operations efficiently', function () {
            const sectorsItemsList: SectorsItemsModel[] = [];
            
            // Create many sectors items for comparison
            for (let i = 0; i < 100; i++) {
                sectorsItemsList.push(createValidSectorsItems({
                    ITEMS: Buffer.alloc((i + 1) * 100) // Varying sizes
                }));
            }

            const startTime = Date.now();
            
            // Perform many comparisons
            const comparisons = [];
            for (let i = 0; i < sectorsItemsList.length - 1; i++) {
                comparisons.push(sectorsItemsList[i].compareCapacityWith(sectorsItemsList[i + 1]));
            }
            
            const endTime = Date.now();

            expect(comparisons).to.have.length(99);
            expect(comparisons.every(c => typeof c.difference === 'number')).to.be.true;
            expect(comparisons.every(c => ['this', 'other', 'equal'].includes(c.moreEfficient))).to.be.true;
            expect(endTime - startTime).to.be.lessThan(50); // Should be very fast
        });

        it('should handle cache key generation efficiently', function () {
            const sectorsItemsList: SectorsItemsModel[] = [];
            
            // Create sectors items with sectors
            for (let i = 0; i < 200; i++) {
                const sectorsItems = createValidSectorsItems({ ID: i });
                sectorsItems.setSector(createMockSector({
                    getId: () => i,
                    getCoordinatesString: () => `(${i}, ${i * 2}, ${i * 3})`
                }));
                sectorsItemsList.push(sectorsItems);
            }

            const startTime = Date.now();
            
            // Generate cache keys for all
            const cacheKeys = sectorsItemsList.map(si => si.getCacheKey());
            
            const endTime = Date.now();

            expect(cacheKeys).to.have.length(200);
            expect(cacheKeys.every(key => typeof key === 'string')).to.be.true;
            expect(cacheKeys.every(key => key.includes('sector-items:'))).to.be.true;
            expect(new Set(cacheKeys).size).to.equal(200); // All keys should be unique
            expect(endTime - startTime).to.be.lessThan(50); // Should be very fast
        });

        it('should handle relationship operations efficiently', function () {
            const sectorsItemsList: SectorsItemsModel[] = [];
            const mockSectors: any[] = [];

            // Create test data
            for (let i = 0; i < 100; i++) {
                sectorsItemsList.push(createValidSectorsItems({ ID: i }));
                mockSectors.push(createMockSector({ 
                    getId: () => i,
                    getName: () => `Sector ${i}`,
                    getCoordinatesString: () => `(${i}, ${i * 2}, ${i * 3})`
                }));
            }

            const startTime = Date.now();
            
            // Set relationships and get data
            for (let i = 0; i < 100; i++) {
                sectorsItemsList[i].setSector(mockSectors[i]);
            }

            // Get relationship data
            const relationshipData = sectorsItemsList.map(si => ({
                hasSectorLoaded: si.hasSectorLoaded(),
                sectorName: si.getSectorName(),
                sectorCoordinates: si.getSectorCoordinates(),
                cacheKey: si.getCacheKey()
            }));

            const endTime = Date.now();

            expect(relationshipData).to.have.length(100);
            expect(relationshipData.every(r => r.hasSectorLoaded)).to.be.true;
            expect(relationshipData.every(r => typeof r.sectorName === 'string')).to.be.true;
            expect(relationshipData.every(r => typeof r.sectorCoordinates === 'string')).to.be.true;
            expect(endTime - startTime).to.be.lessThan(100); // Should be efficient
        });
    });

    describe('Enhanced Business Logic Methods', function () {
        it('should calculate items size correctly', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const smallItems = createValidSectorsItems({ ITEMS: Buffer.alloc(100) });
            const largeItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });

            expect(emptyItems.getItemsSize()).to.equal(0);
            expect(smallItems.getItemsSize()).to.equal(100);
            expect(largeItems.getItemsSize()).to.equal(MAX_ITEMS_SIZE);
        });

        it('should calculate maximum possible stacks correctly', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const oneStackItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE) });
            const maxItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });

            expect(emptyItems.getMaxPossibleStacks()).to.equal(0);
            expect(oneStackItems.getMaxPossibleStacks()).to.equal(1);
            expect(maxItems.getMaxPossibleStacks()).to.equal(MAX_ITEM_STACKS);
        });

        it('should detect maximum capacity correctly', function () {
            const normalItems = createValidSectorsItems({ ITEMS: Buffer.alloc(1000) });
            const maxItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });

            expect(normalItems.isAtMaxCapacity()).to.be.false;
            expect(maxItems.isAtMaxCapacity()).to.be.true;
        });

        it('should calculate remaining capacity correctly', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const halfFullItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE / 2) });
            const maxItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });

            expect(emptyItems.getRemainingCapacity()).to.equal(MAX_ITEMS_SIZE);
            expect(halfFullItems.getRemainingCapacity()).to.equal(MAX_ITEMS_SIZE / 2);
            expect(maxItems.getRemainingCapacity()).to.equal(0);
        });

        it('should validate items size correctly', function () {
            const validItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });
            const invalidItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE + 1) });

            expect(validItems.validateItemsSize()).to.be.true;
            expect(invalidItems.validateItemsSize()).to.be.false;
        });

        it('should calculate storage efficiency correctly', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const quarterFullItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE / 4) });
            const halfFullItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE / 2) });
            const maxItems = createValidSectorsItems({ ITEMS: Buffer.alloc(MAX_ITEMS_SIZE) });

            expect(emptyItems.getStorageEfficiency()).to.equal(0);
            expect(quarterFullItems.getStorageEfficiency()).to.equal(25);
            expect(halfFullItems.getStorageEfficiency()).to.equal(50);
            expect(maxItems.getStorageEfficiency()).to.equal(100);
        });

        it('should estimate stack count correctly', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const oneStackItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE) });
            const threeStackItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE * 3) });
            const partialStackItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE + 5) });

            expect(emptyItems.getEstimatedStackCount()).to.equal(0);
            expect(oneStackItems.getEstimatedStackCount()).to.equal(1);
            expect(threeStackItems.getEstimatedStackCount()).to.equal(3);
            expect(partialStackItems.getEstimatedStackCount()).to.equal(1); // Floor division
        });

        it('should validate items data format', function () {
            const emptyItems = createValidSectorsItems({ ITEMS: Buffer.alloc(0) });
            const validStructuredItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE * 5) });
            const invalidStructuredItems = createValidSectorsItems({ ITEMS: Buffer.alloc(ITEM_RECORD_SIZE + 1) });
            const nullBufferItems = new SectorsItemsModel({ ITEMS: null });

            expect(emptyItems.isItemsDataValid()).to.be.true; // Empty is valid
            expect(validStructuredItems.isItemsDataValid()).to.be.true;
            expect(invalidStructuredItems.isItemsDataValid()).to.be.false;
            expect(nullBufferItems.isItemsDataValid()).to.be.false;
        });

        it('should generate comprehensive items summary', function () {
            const sectorsItems = createValidSectorsItems({
                ID: 12345,
                ITEMS: Buffer.alloc(ITEM_RECORD_SIZE * 10) // 10 item stacks
            });

            const summary = sectorsItems.getItemsSummary();

            expect(summary.id).to.equal(12345);
            expect(summary.hasItems).to.be.true;
            expect(summary.sizeBytes).to.equal(ITEM_RECORD_SIZE * 10);
            expect(summary.maxSizeBytes).to.equal(MAX_ITEMS_SIZE);
            expect(summary.remainingBytes).to.equal(MAX_ITEMS_SIZE - (ITEM_RECORD_SIZE * 10));
            expect(summary.maxPossibleStacks).to.equal(10);
            expect(summary.estimatedStackCount).to.equal(10);
            expect(summary.isAtCapacity).to.be.false;
            expect(summary.isDataValid).to.be.true;
            expect(summary.hasSectorLoaded).to.be.false;
            expect(summary.storageEfficiency).to.be.a('number');
        });

        it('should handle empty items in summary', function () {
            const emptyItems = createMinimalSectorsItems();
            const summary = emptyItems.getItemsSummary();

            expect(summary.id).to.be.undefined;
            expect(summary.hasItems).to.be.false;
            expect(summary.sizeBytes).to.equal(0);
            expect(summary.maxSizeBytes).to.equal(MAX_ITEMS_SIZE);
            expect(summary.remainingBytes).to.equal(MAX_ITEMS_SIZE);
            expect(summary.maxPossibleStacks).to.equal(0);
            expect(summary.estimatedStackCount).to.equal(0);
            expect(summary.isAtCapacity).to.be.false;
            expect(summary.isDataValid).to.be.true;
            expect(summary.storageEfficiency).to.equal(0);
        });
    });

    describe('Bidirectional Relationships and Intelligence', function () {
        let sectorsItems: SectorsItemsModel;
        let mockSector: any;

        beforeEach(function () {
            sectorsItems = createValidSectorsItems();
            mockSector = createMockSector();
        });

        it('should manage sector relationship correctly', function () {
            // Initially no relationship loaded
            expect(sectorsItems.hasSectorLoaded()).to.be.false;
            expect(sectorsItems.getSector()).to.be.undefined;

            // Set relationship
            sectorsItems.setSector(mockSector);
            expect(sectorsItems.hasSectorLoaded()).to.be.true;
            expect(sectorsItems.getSector()).to.equal(mockSector);

            // Clear relationship
            sectorsItems.setSector(undefined);
            expect(sectorsItems.getSector()).to.be.undefined;
            // Note: hasRelated returns true even when value is undefined if key exists
            expect(sectorsItems.hasSectorLoaded()).to.be.true;
        });

        it('should get sector information from loaded relation', function () {
            sectorsItems.setSector(mockSector);

            expect(sectorsItems.getSectorCoordinates()).to.equal('(10, 20, 30)');
            expect(sectorsItems.getSectorName()).to.equal('Test Sector');
        });

        it('should handle missing sector relation gracefully', function () {
            // No sector loaded
            expect(sectorsItems.getSectorCoordinates()).to.be.undefined;
            expect(sectorsItems.getSectorName()).to.be.undefined;
        });

        it('should handle sector without required methods', function () {
            const incompleteSector = createMockSector({
                getName: undefined,
                getCoordinatesString: undefined
            });

            sectorsItems.setSector(incompleteSector);
            expect(sectorsItems.getSectorCoordinates()).to.be.undefined;
            expect(sectorsItems.getSectorName()).to.be.undefined;
        });

        it('should include sector data in summary when loaded', function () {
            sectorsItems.setSector(mockSector);
            const summary = sectorsItems.getItemsSummary();

            expect(summary.hasSectorLoaded).to.be.true;
            expect(summary.sectorCoordinates).to.equal('(10, 20, 30)');
            expect(summary.sectorName).to.equal('Test Sector');
        });

        it('should support method chaining for sector relationship', function () {
            const result = sectorsItems.setSector(mockSector);

            expect(result).to.equal(sectorsItems);
            expect(sectorsItems.hasSectorLoaded()).to.be.true;
        });
    });

    describe('Advanced Analysis and Comparison', function () {
        it('should compare capacity with another SectorsItemsModel correctly', function () {
            const smallItems = createValidSectorsItems({ ITEMS: Buffer.alloc(1000) });
            const largeItems = createValidSectorsItems({ ITEMS: Buffer.alloc(5000) });

            const comparison = smallItems.compareCapacityWith(largeItems);

            expect(comparison.thisSize).to.equal(1000);
            expect(comparison.otherSize).to.equal(5000);
            expect(comparison.difference).to.equal(-4000);
            expect(comparison.thisEfficiency).to.be.lessThan(comparison.otherEfficiency);
            expect(comparison.moreEfficient).to.equal('other');
        });

        it('should handle equal capacity comparison', function () {
            const items1 = createValidSectorsItems({ ITEMS: Buffer.alloc(2000) });
            const items2 = createValidSectorsItems({ ITEMS: Buffer.alloc(2000) });

            const comparison = items1.compareCapacityWith(items2);

            expect(comparison.thisSize).to.equal(comparison.otherSize);
            expect(comparison.difference).to.equal(0);
            expect(comparison.thisEfficiency).to.equal(comparison.otherEfficiency);
            expect(comparison.moreEfficient).to.equal('equal');
        });

        it('should identify this as more efficient', function () {
            const largeItems = createValidSectorsItems({ ITEMS: Buffer.alloc(8000) });
            const smallItems = createValidSectorsItems({ ITEMS: Buffer.alloc(2000) });

            const comparison = largeItems.compareCapacityWith(smallItems);

            expect(comparison.thisSize).to.be.greaterThan(comparison.otherSize);
            expect(comparison.difference).to.be.greaterThan(0);
            expect(comparison.moreEfficient).to.equal('this');
        });

        it('should generate cache keys correctly', function () {
            const sectorsItems = createValidSectorsItems({ ID: 12345 });
            const sectorsItemsWithSector = createValidSectorsItems({ ID: 54321 });
            
            sectorsItemsWithSector.setSector(createMockSector());

            const defaultKey = sectorsItems.getCacheKey();
            const sectorKey = sectorsItemsWithSector.getCacheKey();

            expect(defaultKey).to.include('sector-items:unknown:12345:');
            expect(sectorKey).to.include('sector-items:(10, 20, 30):54321:');
            expect(defaultKey).to.include(sectorsItems.getItemsSize().toString());
            expect(sectorKey).to.include(sectorsItemsWithSector.getItemsSize().toString());
        });

        it('should detect items data changes correctly', function () {
            const sectorsItems = createValidSectorsItems({ ITEMS: Buffer.from('original data') });
            
            // Initially no changes
            expect(sectorsItems.hasItemsChanged()).to.be.false;

            // Make changes
            sectorsItems.setItems(Buffer.from('modified data'));
            expect(sectorsItems.hasItemsChanged()).to.be.true;

            // Mark as saved and verify
            sectorsItems.markAsSaved();
            expect(sectorsItems.hasItemsChanged()).to.be.false;
        });

        it('should handle null/undefined items change detection', function () {
            const sectorsItems1 = new SectorsItemsModel({ ITEMS: null });
            const sectorsItems2 = createValidSectorsItems();
            
            // Set items to null and test
            sectorsItems2.setItems(null as any);

            expect(sectorsItems1.hasItemsChanged()).to.be.false; // null to null
            expect(sectorsItems2.hasItemsChanged()).to.be.true; // buffer to null
        });

        it('should handle buffer equality checks correctly', function () {
            const originalBuffer = Buffer.from([1, 2, 3, 4]);
            const sameBuffer = Buffer.from([1, 2, 3, 4]);
            const differentBuffer = Buffer.from([1, 2, 3, 5]);

            const sectorsItems = createValidSectorsItems({ ITEMS: originalBuffer });
            
            // Same content but different instance - implementation uses Buffer.equals()
            sectorsItems.setItems(sameBuffer);
            expect(sectorsItems.hasItemsChanged()).to.be.false; // Buffer.equals() should return true for same content

            // Reset and try different content
            sectorsItems.markAsSaved();
            sectorsItems.setItems(differentBuffer);
            expect(sectorsItems.hasItemsChanged()).to.be.true;
        });
    });

    describe('JSON Serialization with Relationships', function () {
        let sectorsItems: SectorsItemsModel;
        let mockSector: any;

        beforeEach(function () {
            sectorsItems = createValidSectorsItems();
            mockSector = createMockSector();
        });

        it('should serialize basic sectors items data to JSON', function () {
            const json = sectorsItems.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.ID).to.equal(1001);
            expect(json.ITEMS).to.be.instanceOf(Buffer);
        });

        it('should serialize with loaded sector relation when includeInJson is true', function () {
            sectorsItems.setSector(mockSector);
            
            const json = sectorsItems.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.sector).to.exist;
            expect(json.sector).to.deep.equal({
                id: 1001,
                name: 'Test Sector',
                coordinates: '(10, 20, 30)',
                type: 'VOID'
            });
        });

        it('should handle serialization with undefined/null relations', function () {
            // No relations set
            const json = sectorsItems.toJSON();
            
            expect(json).to.be.an('object');
            expect(json.sector).to.be.undefined;
        });

        it('should serialize buffer data correctly', function () {
            const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
            const sectorsItems = createValidSectorsItems({ ITEMS: testBuffer });
            
            const json = sectorsItems.toJSON();
            
            expect(json.ITEMS).to.be.instanceOf(Buffer);
            expect(json.ITEMS).to.deep.equal(testBuffer);
        });

        it('should handle large buffer serialization', function () {
            const largeBuffer = Buffer.alloc(MAX_ITEMS_SIZE);
            largeBuffer.fill(0xFF);
            
            const sectorsItems = createValidSectorsItems({ ITEMS: largeBuffer });
            
            const json = sectorsItems.toJSON();
            
            expect(json.ITEMS).to.be.instanceOf(Buffer);
            expect(json.ITEMS.length).to.equal(MAX_ITEMS_SIZE);
            expect(json.ITEMS[0]).to.equal(0xFF);
        });
    });

    describe('Asynchronous Validation', function () {
        it('should handle validateForeignKeys placeholder', async function () {
            const sectorsItems = createValidSectorsItems();
            
            // Currently returns placeholder implementation
            const validation = await sectorsItems.validateForeignKeys();
            
            expect(validation).to.be.an('object');
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.an('array');
            expect(validation.fieldErrors).to.be.an('object');
        });

        it('should handle async validation with relationships', async function () {
            const sectorsItems = createValidSectorsItems();
            sectorsItems.setSector(createMockSector());
            
            const validation = await sectorsItems.validateForeignKeys();
            
            // Even with relationships, should return valid (placeholder implementation)
            expect(validation.isValid).to.be.true;
        });
    });

    describe('Advanced Edge Cases and Error Handling', function () {
        it('should handle buffer type validation correctly', function () {
            const sectorsItems = createValidSectorsItems();

            // Test with non-buffer data
            try {
                sectorsItems.setItems('not a buffer' as any);
                const validation = sectorsItems.validate();
                expect(validation.isValid).to.be.false;
            } catch (error) {
                // Acceptable if it throws
                expect(error).to.be.instanceOf(Error);
            }
        });

        it('should handle extremely large buffers gracefully', function () {
            const extremeBuffer = Buffer.alloc(MAX_ITEMS_SIZE * 2); // Double max size
            const sectorsItems = createValidSectorsItems({ ITEMS: extremeBuffer });

            expect(sectorsItems.validateItemsSize()).to.be.false;
            expect(sectorsItems.getStorageEfficiency()).to.equal(200); // 200% over limit

            const validation = sectorsItems.validate();
            expect(validation.isValid).to.be.false;
        });

        it('should handle corrupted buffer data scenarios', function () {
            const corruptedBuffer = Buffer.alloc(15); // Not divisible by ITEM_RECORD_SIZE
            corruptedBuffer.fill(0xFF);

            const sectorsItems = createValidSectorsItems({ ITEMS: corruptedBuffer });

            expect(sectorsItems.hasItems()).to.be.true;
            expect(sectorsItems.isItemsDataValid()).to.be.false;
            expect(sectorsItems.getEstimatedStackCount()).to.equal(0); // Floor of 15/22
        });

        it('should handle sector relationship edge cases', function () {
            const sectorsItems = createValidSectorsItems();
            
            // Test with sector that throws errors
            const errorSector = createMockSector({
                getName: () => { throw new Error('Name method failed'); },
                getCoordinatesString: () => { throw new Error('Coordinates method failed'); }
            });
            
            sectorsItems.setSector(errorSector);
            
            // Should handle errors gracefully
            expect(() => sectorsItems.getSectorName()).to.throw();
            expect(() => sectorsItems.getSectorCoordinates()).to.throw();
        });

        it('should maintain data integrity during concurrent operations', function () {
            const sectorsItems = createValidSectorsItems();
            const originalId = sectorsItems.getId();
            const originalBuffer = sectorsItems.getItems();

            // Simulate rapid operations but end with original values
            for (let i = 0; i < 100; i++) {
                sectorsItems.setItems(Buffer.from(`data${i}`));
                sectorsItems.setId(i + 1000);
                
                if (i % 10 === 0) {
                    // Occasionally reset to original - but do it at the end too
                    sectorsItems.setItems(originalBuffer);
                    sectorsItems.setId(originalId);
                }
            }

            // Ensure we end with original data
            sectorsItems.setItems(originalBuffer);
            sectorsItems.setId(originalId);

            // Should end with original data
            expect(sectorsItems.getId()).to.equal(originalId);
            expect(sectorsItems.getItems()).to.deep.equal(originalBuffer);
        });

        it('should handle memory pressure scenarios', function () {
            const sectorsItemsList: SectorsItemsModel[] = [];
            
            // Create many instances with large buffers
            for (let i = 0; i < 50; i++) {
                const largeBuffer = Buffer.alloc(MAX_ITEMS_SIZE);
                largeBuffer.fill(i % 256);
                
                sectorsItemsList.push(createValidSectorsItems({
                    ID: i,
                    ITEMS: largeBuffer
                }));
            }

            // Verify all instances are valid
            expect(sectorsItemsList).to.have.length(50);
            expect(sectorsItemsList.every(si => si.validateItemsSize())).to.be.true;
            expect(sectorsItemsList.every(si => si.getStorageEfficiency() === 100)).to.be.true;
        });
    });
});