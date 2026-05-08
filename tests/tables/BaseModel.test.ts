/**
 * @fileoverview BaseModel Comprehensive Tests
 * 
 * Complete test suite for the BaseModel class covering all functionality:
 * - Schema definition and validation
 * - Data manipulation and change tracking
 * - Validation rules and custom validators
 * - Foreign key validation
 * - Helper functions and utilities
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
    BaseModel,
    column,
    foreignKey,
    index,
    validation,
    DataType,
    ForeignKeyAction,
    type TableSchema,
    type ModelValidationResult,
    type ColumnDefinition,
    type ForeignKeyDefinition,
    type ModelValidationRule
} from '../../src/tables/BaseModel.js';
import { ValidationError } from '../../src/core/errors.js';

// =============================================================================
// TEST MODEL CLASSES
// =============================================================================

/**
 * Test model for basic functionality
 */
class TestUserModel extends BaseModel {
    public static tableName = 'TEST_USERS';
    public static schema: TableSchema = {
        tableName: 'TEST_USERS',
        comment: 'Test user table',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false
            }),
            column('USERNAME', DataType.VARCHAR, {
                length: 50,
                nullable: false,
                unique: true
            }),
            column('EMAIL', DataType.VARCHAR, {
                length: 255,
                nullable: false
            }),
            column('AGE', DataType.INTEGER, {
                nullable: true
            }),
            column('CREATED_AT', DataType.TIMESTAMP, {
                nullable: false,
                defaultValue: 'CURRENT_TIMESTAMP'
            }),
            column('IS_ACTIVE', DataType.BOOLEAN, {
                nullable: false,
                defaultValue: true
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],
        indexes: [
            index('USERNAME_IDX', ['USERNAME'], { unique: true }),
            index('EMAIL_IDX', ['EMAIL'])
        ],

        validationRules: [
            validation('USERNAME', 'required'),
            validation('USERNAME', 'minLength', {
                value: 3,
                message: 'Username must be at least 3 characters'
            }),
            validation('USERNAME', 'maxLength', {
                value: 50,
                message: 'Username cannot exceed 50 characters'
            }),
            validation('EMAIL', 'required'),
            validation('EMAIL', 'pattern', {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format'
            }),
            validation('AGE', 'min', {
                value: 0,
                message: 'Age cannot be negative'
            }),
            validation('AGE', 'max', {
                value: 150,
                message: 'Age cannot exceed 150'
            }),
            validation('EMAIL', 'custom', {
                validator: (email: string) => {
                    if (!email) return true; // Allow empty for now
                    return !email.includes('+') || 'Email cannot contain plus signs';
                },
                message: 'Custom email validation failed'
            })
        ]
    };

    // Typed accessors
    public getId(): number { return this.get('ID'); }
    public setId(id: number): this { return this.set('ID', id); }
    public getUsername(): string { return this.get('USERNAME'); }
    public setUsername(username: string): this { return this.set('USERNAME', username); }
    public getEmail(): string { return this.get('EMAIL'); }
    public setEmail(email: string): this { return this.set('EMAIL', email); }
    public getAge(): number | undefined { return this.get('AGE'); }
    public setAge(age: number | undefined): this { return this.set('AGE', age); }
    public getIsActive(): boolean { return this.get('IS_ACTIVE'); }
    public setIsActive(isActive: boolean): this { return this.set('IS_ACTIVE', isActive); }
}

/**
 * Test model with foreign keys
 */
class TestPostModel extends BaseModel {
    public static tableName = 'TEST_POSTS';
    public static schema: TableSchema = {
        tableName: 'TEST_POSTS',
        comment: 'Test post table with foreign key',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false
            }),
            column('TITLE', DataType.VARCHAR, {
                length: 200,
                nullable: false
            }),
            column('CONTENT', DataType.TEXT, {
                nullable: true
            }),
            column('USER_ID', DataType.BIGINT, {
                nullable: false
            }),
            column('CATEGORY_ID', DataType.BIGINT, {
                nullable: true
            })
        ],

        primaryKey: ['ID'],
        
        foreignKeys: [
            foreignKey('FK_POST_USER', ['USER_ID'], 'TEST_USERS', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE,
                onUpdate: ForeignKeyAction.CASCADE
            }),
            foreignKey('FK_POST_CATEGORY', ['CATEGORY_ID'], 'TEST_CATEGORIES', ['ID'], {
                onDelete: ForeignKeyAction.SET_NULL,
                onUpdate: ForeignKeyAction.CASCADE
            })
        ],

        indexes: [
            index('POST_USER_IDX', ['USER_ID']),
            index('POST_CATEGORY_IDX', ['CATEGORY_ID'])
        ],

        validationRules: [
            validation('TITLE', 'required'),
            validation('TITLE', 'maxLength', { value: 200 }),
            validation('USER_ID', 'required'),
            validation('CONTENT', 'custom', {
                validator: (content: string, data: any) => {
                    if (content && content.trim().length === 0) {
                        return 'Content cannot be empty string';
                    }
                    return true;
                }
            })
        ]
    };

    public getId(): number { return this.get('ID'); }
    public getTitle(): string { return this.get('TITLE'); }
    public setTitle(title: string): this { return this.set('TITLE', title); }
    public getContent(): string | undefined { return this.get('CONTENT'); }
    public setContent(content: string | undefined): this { return this.set('CONTENT', content); }
    public getUserId(): number { return this.get('USER_ID'); }
    public setUserId(userId: number): this { return this.set('USER_ID', userId); }
    public getCategoryId(): number | undefined { return this.get('CATEGORY_ID'); }
    public setCategoryId(categoryId: number | undefined): this { return this.set('CATEGORY_ID', categoryId); }
}

// =============================================================================
// TESTS
// =============================================================================

describe('BaseModel Tests', function() {
    this.timeout(30000);

    describe('Schema Definition', function() {
        it('should define table name correctly', function() {
            expect(TestUserModel.getTableName()).to.equal('TEST_USERS');
            expect(TestPostModel.getTableName()).to.equal('TEST_POSTS');
        });

        it('should throw error if table name not defined', function() {
            class InvalidModel extends BaseModel {}
            expect(() => InvalidModel.getTableName()).to.throw('Table name not defined');
        });

        it('should define schema correctly', function() {
            const schema = TestUserModel.getSchema();
            expect(schema).to.be.an('object');
            expect(schema.tableName).to.equal('TEST_USERS');
            expect(schema.columns).to.be.an('array').with.length(6);
            expect(schema.primaryKey).to.deep.equal(['ID']);
            expect(schema.validationRules).to.be.an('array').with.length.greaterThan(0);
        });

        it('should throw error if schema not defined', function() {
            class InvalidModel extends BaseModel {
                public static tableName = 'TEST';
            }
            expect(() => InvalidModel.getSchema()).to.throw('Schema not defined');
        });

        it('should get primary key columns correctly', function() {
            expect(TestUserModel.getPrimaryKeyColumns()).to.deep.equal(['ID']);
        });

        it('should get foreign key definitions correctly', function() {
            const foreignKeys = TestPostModel.getForeignKeys();
            expect(foreignKeys).to.be.an('array').with.length(2);
            expect(foreignKeys[0].name).to.equal('FK_POST_USER');
            expect(foreignKeys[0].columns).to.deep.equal(['USER_ID']);
            expect(foreignKeys[0].referencedTable).to.equal('TEST_USERS');
        });

        it('should get validation rules correctly', function() {
            const rules = TestUserModel.getValidationRules();
            expect(rules).to.be.an('array').with.length.greaterThan(0);
            expect(rules.some(r => r.field === 'USERNAME' && r.type === 'required')).to.be.true;
        });
    });

    describe('Data Manipulation', function() {
        let user: TestUserModel;

        beforeEach(function() {
            user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: 25,
                IS_ACTIVE: true
            });
        });

        it('should create instance with initial data', function() {
            expect(user.getUsername()).to.equal('testuser');
            expect(user.getEmail()).to.equal('test@example.com');
            expect(user.getAge()).to.equal(25);
            expect(user.getIsActive()).to.be.true;
        });

        it('should get and set individual fields', function() {
            expect(user.get('USERNAME')).to.equal('testuser');
            
            user.set('USERNAME', 'newuser');
            expect(user.get('USERNAME')).to.equal('newuser');
        });

        it('should set multiple fields with setData', function() {
            user.setData({
                USERNAME: 'updated',
                AGE: 30
            });

            expect(user.getUsername()).to.equal('updated');
            expect(user.getAge()).to.equal(30);
            expect(user.getEmail()).to.equal('test@example.com'); // Should remain unchanged
        });

        it('should get all data', function() {
            const data = user.getData();
            expect(data).to.deep.include({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: 25,
                IS_ACTIVE: true
            });
        });

        it('should track primary key value correctly', function() {
            // New record without ID
            expect(user.getPrimaryKeyValue()).to.be.undefined;

            // Set ID
            user.setId(123);
            expect(user.getPrimaryKeyValue()).to.equal(123);
        });

        it('should handle composite primary key', function() {
            class CompositeKeyModel extends BaseModel {
                public static tableName = 'COMPOSITE_TEST';
                public static schema: TableSchema = {
                    tableName: 'COMPOSITE_TEST',
                    columns: [
                        column('KEY1', DataType.INTEGER, { primaryKey: true, nullable: false }),
                        column('KEY2', DataType.INTEGER, { primaryKey: true, nullable: false }),
                        column('VALUE', DataType.VARCHAR, { nullable: true })
                    ],
                    primaryKey: ['KEY1', 'KEY2'],
                    foreignKeys: [],
                    indexes: [],
                    validationRules: []
                };
            }

            const composite = new CompositeKeyModel({
                KEY1: 1,
                KEY2: 2,
                VALUE: 'test'
            });

            expect(composite.getPrimaryKeyValue()).to.deep.equal({ KEY1: 1, KEY2: 2 });
        });
    });

    describe('Change Tracking', function() {
        let user: TestUserModel;

        beforeEach(function() {
            user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: 25
            });
        });

        it('should detect if record is dirty', function() {
            expect(user.isDirty()).to.be.false;

            user.setUsername('changed');
            expect(user.isDirty()).to.be.true;
        });

        it('should get changed fields', function() {
            user.setUsername('changed');
            user.setAge(30);

            const changed = user.getChangedFields();
            expect(changed).to.include.members(['USERNAME', 'AGE']);
            expect(changed).to.not.include('EMAIL');
        });

        it('should detect new records', function() {
            const userWithoutId = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com'
            });
            expect(userWithoutId.isNew()).to.be.true;

            const userWithId = new TestUserModel({
                ID: 123,
                USERNAME: 'testuser',
                EMAIL: 'test@example.com'
            });
            expect(userWithId.isNew()).to.be.false;
        });

        it('should reset changes', function() {
            user.setUsername('changed');
            expect(user.isDirty()).to.be.true;

            user.reset();
            expect(user.getUsername()).to.equal('testuser');
            expect(user.isDirty()).to.be.false;
        });

        it('should mark as saved', function() {
            user.setUsername('changed');
            expect(user.isDirty()).to.be.true;

            user.markAsSaved();
            expect(user.isDirty()).to.be.false;
            expect(user.isNew()).to.be.false;
        });
    });

    describe('Validation', function() {
        it('should validate required fields', function() {
            const user = new TestUserModel();
            const validation = user.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.USERNAME).to.include("Field 'USERNAME' is required");
            expect(validation.fieldErrors.EMAIL).to.include("Field 'EMAIL' is required");
        });

        it('should validate string length constraints', function() {
            const user = new TestUserModel({
                USERNAME: 'ab', // Too short
                EMAIL: 'a'.repeat(256) + '@example.com' // Too long
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.USERNAME).to.include('Username must be at least 3 characters');
        });

        it('should validate numeric constraints', function() {
            const user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: -5 // Invalid age
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.AGE).to.include('Age cannot be negative');
        });

        it('should validate pattern constraints', function() {
            const user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'invalid-email' // Invalid email format
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.EMAIL).to.include('Invalid email format');
        });

        it('should validate custom validators', function() {
            const user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test+alias@example.com' // Custom validation should fail
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.EMAIL).to.include('Email cannot contain plus signs');
        });

        it('should pass validation with valid data', function() {
            const user = new TestUserModel({
                USERNAME: 'validuser',
                EMAIL: 'valid@example.com',
                AGE: 25,
                IS_ACTIVE: true
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.true;
            expect(validation.errors).to.be.empty;
        });

        it('should validate nullable fields correctly', function() {
            const user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com'
                // AGE is nullable and not provided
            });

            const validation = user.validate();
            expect(validation.isValid).to.be.true;
        });

        it('should validate custom validation that returns boolean', function() {
            const post = new TestPostModel({
                TITLE: 'Test Post',
                CONTENT: '   ', // Empty content after trim
                USER_ID: 1
            });

            const validation = post.validate();
            expect(validation.isValid).to.be.false;
            expect(validation.fieldErrors.CONTENT).to.include('Content cannot be empty string');
        });
    });

    describe('Utility Methods', function() {
        let user: TestUserModel;

        beforeEach(function() {
            user = new TestUserModel({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: 25
            });
        });

        it('should convert to JSON', function() {
            const json = user.toJSON();
            expect(json).to.deep.include({
                USERNAME: 'testuser',
                EMAIL: 'test@example.com',
                AGE: 25
            });
        });

        it('should clone model', function() {
            user.setId(123);
            user.markAsSaved();

            const clone = user.clone();
            expect(clone.getUsername()).to.equal('testuser');
            expect(clone.getId()).to.equal(123);
            expect(clone.isNew()).to.be.false;

            // Verify independence
            clone.setUsername('changed');
            expect(user.getUsername()).to.equal('testuser');
        });

        it('should create from database row', function() {
            const row = {
                ID: 456,
                USERNAME: 'dbuser',
                EMAIL: 'db@example.com',
                AGE: 30,
                IS_ACTIVE: true
            };

            const user = TestUserModel.fromRow(row);
            expect(user.getId()).to.equal(456);
            expect(user.getUsername()).to.equal('dbuser');
            expect(user.isNew()).to.be.false;
            expect(user.isDirty()).to.be.false;
        });

        it('should create multiple from database rows', function() {
            const rows = [
                { ID: 1, USERNAME: 'user1', EMAIL: 'user1@example.com', AGE: 25, IS_ACTIVE: true },
                { ID: 2, USERNAME: 'user2', EMAIL: 'user2@example.com', AGE: 30, IS_ACTIVE: false }
            ];

            const users = TestUserModel.fromRows(rows);
            expect(users).to.have.length(2);
            expect(users[0].getId()).to.equal(1);
            expect(users[1].getId()).to.equal(2);
            expect(users[0].isNew()).to.be.false;
            expect(users[1].isNew()).to.be.false;
        });
    });

    describe('Helper Functions', function() {
        it('should create column definition', function() {
            const col = column('TEST_COLUMN', DataType.VARCHAR, {
                length: 100,
                nullable: false,
                defaultValue: 'default'
            });

            expect(col.name).to.equal('TEST_COLUMN');
            expect(col.type).to.equal(DataType.VARCHAR);
            expect(col.length).to.equal(100);
            expect(col.nullable).to.be.false;
            expect(col.defaultValue).to.equal('default');
        });

        it('should create foreign key definition', function() {
            const fk = foreignKey('FK_TEST', ['USER_ID'], 'USERS', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE
            });

            expect(fk.name).to.equal('FK_TEST');
            expect(fk.columns).to.deep.equal(['USER_ID']);
            expect(fk.referencedTable).to.equal('USERS');
            expect(fk.referencedColumns).to.deep.equal(['ID']);
            expect(fk.onDelete).to.equal(ForeignKeyAction.CASCADE);
        });

        it('should create index definition', function() {
            const idx = index('TEST_IDX', ['COLUMN1', 'COLUMN2'], {
                unique: true
            });

            expect(idx.name).to.equal('TEST_IDX');
            expect(idx.columns).to.deep.equal(['COLUMN1', 'COLUMN2']);
            expect(idx.unique).to.be.true;
        });

        it('should create validation rule', function() {
            const rule = validation('USERNAME', 'minLength', {
                value: 5,
                message: 'Too short'
            });

            expect(rule.field).to.equal('USERNAME');
            expect(rule.type).to.equal('minLength');
            expect(rule.value).to.equal(5);
            expect(rule.message).to.equal('Too short');
        });
    });

    describe('Error Handling', function() {
        it('should handle validation errors properly', function() {
            const user = new TestUserModel();
            const validation = user.validate();

            expect(validation.isValid).to.be.false;
            expect(validation.errors).to.be.an('array');
            expect(validation.errors.length).to.be.greaterThan(0);
            expect(validation.errors[0]).to.be.instanceOf(ValidationError);
        });

        it('should handle missing schema gracefully', function() {
            class IncompleteModel extends BaseModel {
                public static tableName = 'INCOMPLETE';
            }

            expect(() => IncompleteModel.getSchema()).to.throw();
        });
    });
});