/**
 * @fileoverview Base Model System for StarMade Database Tables
 * 
 * Provides a base class for all database models with validation, foreign key relationships,
 * and schema definition capabilities inspired by Objection.js.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import type { ModuleLogger } from '../core/modules/logging/Logger.js';
import { ValidationError } from '../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Data types supported by the schema system
 */
export enum DataType {
    /** Data type value for bigint, serialized as 'BIGINT'. */
    BIGINT = 'BIGINT',
    /** Data type value for integer, serialized as 'INTEGER'. */
    INTEGER = 'INTEGER',
    /** Data type value for varchar, serialized as 'VARCHAR'. */
    VARCHAR = 'VARCHAR',
    /** Data type value for text, serialized as 'TEXT'. */
    TEXT = 'TEXT',
    /** Data type value for boolean, serialized as 'BOOLEAN'. */
    BOOLEAN = 'BOOLEAN',
    /** Data type value for timestamp, serialized as 'TIMESTAMP'. */
    TIMESTAMP = 'TIMESTAMP',
    /** Data type value for decimal, serialized as 'DECIMAL'. */
    DECIMAL = 'DECIMAL',
    /** Data type value for double, serialized as 'DOUBLE'. */
    DOUBLE = 'DOUBLE',
    /** Data type value for blob, serialized as 'BLOB'. */
    BLOB = 'BLOB'
}

/**
 * Foreign key action types
 */
export enum ForeignKeyAction {
    /** Foreign key action value for cascade, serialized as 'CASCADE'. */
    CASCADE = 'CASCADE',
    /** Foreign key action value for restrict, serialized as 'RESTRICT'. */
    RESTRICT = 'RESTRICT',
    /** Foreign key action value for set null, serialized as 'SET NULL'. */
    SET_NULL = 'SET NULL',
    /** Foreign key action value for no action, serialized as 'NO ACTION'. */
    NO_ACTION = 'NO ACTION'
}

/**
 * Relation types - mirroring Objection.js
 */
export enum RelationType {
    /** Relation type value for belongs to one relation, serialized as 'BelongsToOneRelation'. */
    BelongsToOneRelation = 'BelongsToOneRelation',
    /** Relation type value for has one relation, serialized as 'HasOneRelation'. */
    HasOneRelation = 'HasOneRelation',
    /** Relation type value for has many relation, serialized as 'HasManyRelation'. */
    HasManyRelation = 'HasManyRelation',
    /** Relation type value for many to many relation, serialized as 'ManyToManyRelation'. */
    ManyToManyRelation = 'ManyToManyRelation',
    /** Relation type value for has one through relation, serialized as 'HasOneThroughRelation'. */
    HasOneThroughRelation = 'HasOneThroughRelation'
}

/**
 * Column definition for schema
 */
export interface ColumnDefinition {
    /** Column name */
    name: string;
    /** Data type */
    type: DataType;
    /** Maximum length for VARCHAR types */
    length?: number;
    /** Whether column is nullable */
    nullable?: boolean;
    /** Default value */
    defaultValue?: any;
    /** Whether this is a primary key */
    primaryKey?: boolean;
    /** Whether this is auto-increment */
    autoIncrement?: boolean;
    /** Whether this column has a unique constraint */
    unique?: boolean;
    /** Comment for the column */
    comment?: string;
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
    /** Name of the foreign key constraint */
    name: string;
    /** Local column(s) */
    columns: string[];
    /** Referenced table */
    referencedTable: string;
    /** Referenced column(s) */
    referencedColumns: string[];
    /** On delete action */
    onDelete?: ForeignKeyAction;
    /** On update action */
    onUpdate?: ForeignKeyAction;
}

/**
 * Index definition
 */
export interface IndexDefinition {
    /** Index name */
    name: string;
    /** Columns in the index */
    columns: string[];
    /** Whether index is unique */
    unique?: boolean;
    /** Index type (e.g., BTREE, HASH) */
    type?: string;
}

/**
 * Validation result for models
 */
export interface ModelValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** Validation errors */
    errors: ValidationError[];
    /** Field-specific errors */
    fieldErrors: Record<string, string[]>;
}

/**
 * Validation rule definition for models
 */
export interface ModelValidationRule {
    /** Field name to validate */
    field: string;
    /** Validation type */
    type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
    /** Value for the validation (e.g., min value, pattern) */
    value?: any;
    /** Custom validation function */
    validator?: (value: any, data: any) => boolean | string;
    /** Error message */
    message?: string;
}

/**
 * Table schema definition
 */
export interface TableSchema {
    /** Table name */
    tableName: string;
    /** Column definitions */
    columns: ColumnDefinition[];
    /** Primary key columns */
    primaryKey: string[];
    /** Foreign key definitions */
    foreignKeys: ForeignKeyDefinition[];
    /** Index definitions */
    indexes: IndexDefinition[];
    /** Validation rules */
    validationRules: ModelValidationRule[];
    /** Table comment */
    comment?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** Validation errors */
    errors: ValidationError[];
    /** Field-specific errors */
    fieldErrors: Record<string, string[]>;
}

/**
 * Join configuration for relationships
 */
export interface JoinConfig {
    /** Source column(s) */
    from: string | string[];
    /** Target column(s) */
    to: string | string[];
}

/**
 * Through configuration for many-to-many relationships
 */
export interface ThroughConfig {
    /** Join table name */
    table?: string;
    /** Join configuration for source to through table */
    from: string | string[];
    /** Join configuration for through table to target */
    to: string | string[];
    /** Additional through table columns to include */
    extra?: string[];
}

/**
 * Relationship definition - inspired by Objection.js
 */
export interface RelationshipDefinition {
    /** Relationship type */
    relation: RelationType;
    /** Related model class - can be string for lazy loading */
    modelClass: typeof BaseModel | string | (() => typeof BaseModel);
    /** Join configuration */
    join: JoinConfig;
    /** Through configuration for many-to-many */
    through?: ThroughConfig;
    /** Custom filter for the relationship */
    filter?: Record<string, any>;
    /** Whether to include this relationship in JSON serialization */
    includeInJson?: boolean;
}

/**
 * Relationship mappings - similar to Objection.js relationMappings
 */
export type RelationMappings = Record<string, RelationshipDefinition>;

// =============================================================================
// BASE MODEL CLASS
// =============================================================================

/**
 * Base model class providing schema definition, validation, and basic CRUD operations
 */
export abstract class BaseModel {
    /**
     * The table name for this model
     */
    public static tableName: string;

    /**
     * Schema definition for the table
     */
    public static schema: TableSchema;

    /**
     * Relationship mappings - similar to Objection.js
     * Override this getter in subclasses to define relationships
     */
    public static get relationMappings(): RelationMappings {
        return {};
    }

    /**
     * Logger instance
     */
    protected static logger?: ModuleLogger;

    /**
     * Model data
     */
    protected data: Record<string, any> = {};

    /**
     * Original data (for tracking changes)
     */
    protected originalData: Record<string, any> = {};

    /**
     * Whether this is a new record
     */
    protected isNewRecord: boolean = true;

    /**
     * Loaded relationships data
     */
    protected relationships: Record<string, any> = Object.create(null);

    /**
     * Create a new model instance
     */
    constructor(data: Partial<Record<string, any>> = {}) {
        this.data = { ...data };
        this.originalData = { ...data };
        this.isNewRecord = !this.getPrimaryKeyValue();
    }

    // =============================================================================
    // STATIC SCHEMA METHODS
    // =============================================================================

    /**
     * Get the table name for this model
     */
    public static getTableName(): string {
        if (!this.tableName) {
            throw new Error(`Table name not defined for model ${this.name}`);
        }
        return this.tableName;
    }

    /**
     * Get the schema for this model
     */
    public static getSchema(): TableSchema {
        if (!this.schema) {
            throw new Error(`Schema not defined for model ${this.name}`);
        }
        return this.schema;
    }

    /**
     * Get the primary key columns
     */
    public static getPrimaryKeyColumns(): string[] {
        return this.getSchema().primaryKey;
    }

    /**
     * Get foreign key definitions
     */
    public static getForeignKeys(): ForeignKeyDefinition[] {
        return this.getSchema().foreignKeys;
    }

    /**
     * Get validation rules
     */
    public static getValidationRules(): ModelValidationRule[] {
        return this.getSchema().validationRules;
    }

    /**
     * Get relationships mappings
     */
    public static getRelationMappings(): RelationMappings {
        return this.relationMappings;
    }

    /**
     * Get a specific relationship definition
     */
    public static getRelation(name: string): RelationshipDefinition | undefined {
        return Object.hasOwn(this.relationMappings, name) ? this.relationMappings[name] : undefined;
    }

    /**
     * Resolve a model class or lazy factory; reject invalid targets and preserve factory errors.
     */
    public static resolveModelClass(modelClass: typeof BaseModel | string | (() => typeof BaseModel)): typeof BaseModel {
        if (typeof modelClass === 'string') {
            throw new Error(`String model references not yet implemented: ${modelClass}`);
        }
        if (typeof modelClass !== 'function') {
            throw new TypeError('Relationship target must be a model class or a model factory');
        }
        if (modelClass === BaseModel || modelClass.prototype instanceof BaseModel) {
            return modelClass as typeof BaseModel;
        }
        const resolved = (modelClass as () => typeof BaseModel)();
        if (typeof resolved === 'function' && (resolved === BaseModel || resolved.prototype instanceof BaseModel)) {
            return resolved;
        }
        throw new TypeError('Function did not return a valid model class');
    }

    /**
     * Extract a column name from a relationship reference, rejecting incomplete references.
     * @param reference - Column name, optionally qualified by its table.
     * @returns The final nonempty column identifier.
     */
    private static columnNameFromReference(reference: string): string {
        const column = reference.split('.').pop()!;
        if (!column) throw new TypeError('Relationship reference must contain a column name');
        return column;
    }

    /**
     * Auto-generate foreign keys from relationMappings
     * This method can be used to keep foreignKeys and relationMappings in sync
     */
    public static generateForeignKeysFromRelations(): ForeignKeyDefinition[] {
        const relations = this.getRelationMappings();
        const foreignKeys: ForeignKeyDefinition[] = [];
        
        for (const [relationName, relation] of Object.entries(relations)) {
            // Only generate FKs for BelongsToOneRelation
            if (relation.relation === RelationType.BelongsToOneRelation) {
                const from = Array.isArray(relation.join.from) ? relation.join.from : [relation.join.from];
                const to = Array.isArray(relation.join.to) ? relation.join.to : [relation.join.to];
                
                // Extract table and column names
                const fromColumns = from.map(col => this.columnNameFromReference(col));
                const toTableColumn = to[0].split('.');
                const toTable = toTableColumn[0];
                const toColumns = to.map(col => this.columnNameFromReference(col));
                
                const fkName = `FK_${this.tableName}_${relationName.toUpperCase()}`;
                
                foreignKeys.push({
                    name: fkName,
                    columns: fromColumns,
                    referencedTable: toTable,
                    referencedColumns: toColumns,
                    onDelete: ForeignKeyAction.SET_NULL, // Default
                    onUpdate: ForeignKeyAction.CASCADE   // Default
                });
            }
        }
        
        return foreignKeys;
    }

    /**
     * Validate that foreignKeys and relationMappings are consistent
     */
    public static validateSchemaConsistency(): {
        isConsistent: boolean;
        issues: string[];
        suggestions: string[];
    } {
        const issues: string[] = [];
        const suggestions: string[] = [];
        
        const schema = this.getSchema();
        const relations = this.getRelationMappings();
        const foreignKeys = schema.foreignKeys;
        
        // Check if relationMappings have corresponding foreignKeys
        for (const [relationName, relation] of Object.entries(relations)) {
            if (relation.relation === RelationType.BelongsToOneRelation) {
                const from = Array.isArray(relation.join.from) ? relation.join.from : [relation.join.from];
                const fromColumns = from.map(col => this.columnNameFromReference(col));
                
                const hasMatchingForeignKey = foreignKeys.some(fk => 
                    fk.columns.length === fromColumns.length &&
                    fk.columns.every((col, index) => col === fromColumns[index])
                );
                
                if (!hasMatchingForeignKey) {
                    issues.push(`Relation '${relationName}' has no corresponding foreign key constraint`);
                    suggestions.push(`Add foreign key constraint for columns: ${fromColumns.join(', ')}`);
                }
            }
        }
        
        // Check if foreignKeys have corresponding relationMappings
        for (const fk of foreignKeys) {
            const hasMatchingRelation = Object.values(relations).some(relation => {
                const from = Array.isArray(relation.join.from) ? relation.join.from : [relation.join.from];
                const fromColumns = from.map(col => this.columnNameFromReference(col));
                
                return relation.relation === RelationType.BelongsToOneRelation &&
                       fk.columns.length === fromColumns.length &&
                       fk.columns.every((col, index) => col === fromColumns[index]);
            });
            
            if (!hasMatchingRelation) {
                issues.push(`Foreign key '${fk.name}' has no corresponding relation mapping`);
                suggestions.push(`Add relation mapping for foreign key: ${fk.columns.join(', ')}`);
            }
        }
        
        return {
            isConsistent: issues.length === 0,
            issues,
            suggestions
        };
    }

    // =============================================================================
    // INSTANCE METHODS
    // ==============================================================================

    /**
     * Get a field value
     */
    public get(field: string): any {
        return this.data[field];
    }

    /**
     * Set a field value
     */
    public set(field: string, value: any): this {
        this.data[field] = value;
        return this;
    }

    /**
     * Set multiple field values
     */
    public setData(data: Partial<Record<string, any>>): this {
        Object.assign(this.data, data);
        return this;
    }

    /**
     * Get all data
     */
    public getData(): Record<string, any> {
        return { ...this.data };
    }

    /**
     * Get the primary key value
     */
    public getPrimaryKeyValue(): any {
        const pkColumns = (this.constructor as typeof BaseModel).getPrimaryKeyColumns();
        if (pkColumns.length === 1) {
            return this.data[pkColumns[0]];
        }
        // Composite primary key
        return pkColumns.reduce((pk, col) => {
            pk[col] = this.data[col];
            return pk;
        }, {} as Record<string, any>);
    }

    /**
     * Whether this record has changes
     */
    public isDirty(): boolean {
        return JSON.stringify(this.data) !== JSON.stringify(this.originalData);
    }

    /**
     * Get changed fields
     */
    public getChangedFields(): string[] {
        const changed: string[] = [];
        for (const [key, value] of Object.entries(this.data)) {
            if (JSON.stringify(value) !== JSON.stringify(this.originalData[key])) {
                changed.push(key);
            }
        }
        return changed;
    }

    /**
     * Whether this is a new record
     */
    public isNew(): boolean {
        return this.isNewRecord;
    }

    // =============================================================================
    // RELATIONSHIP METHODS
    // =============================================================================

    /**
     * Get a loaded relationship
     */
    public getRelated<T = BaseModel | BaseModel[]>(relationName: string): T | undefined {
        return this.relationships[relationName] as T | undefined;
    }

    /**
     * Set a relationship value
     */
    public setRelated(relationName: string, value: BaseModel | BaseModel[] | undefined): this {
        this.relationships[relationName] = value;
        return this;
    }

    /**
     * Check if a relationship is loaded
     */
    public hasRelated(relationName: string): boolean {
        return Object.hasOwn(this.relationships, relationName);
    }

    /**
     * Clear a loaded relationship
     */
    public clearRelated(relationName: string): this {
        delete this.relationships[relationName];
        return this;
    }

    /**
     * Clear all loaded relationships
     */
    public clearAllRelated(): this {
        this.relationships = Object.create(null);
        return this;
    }

    // =============================================================================
    // VALIDATION METHODS
    // =============================================================================

    /**
     * Validate the model data
     */
    public validate(): ModelValidationResult {
        const schema = (this.constructor as typeof BaseModel).getSchema();
        const errors: ValidationError[] = [];
        const fieldErrors: Record<string, string[]> = {};

        // Validate each rule
        for (const rule of schema.validationRules) {
            const value = this.data[rule.field];
            const error = this.validateField(rule, value, this.data);
            
            if (error) {
                const validationError = new ValidationError(rule.field, value, error);
                errors.push(validationError);
                
                if (!fieldErrors[rule.field]) {
                    fieldErrors[rule.field] = [];
                }
                fieldErrors[rule.field].push(error);
            }
        }

        // Check required fields from schema
        for (const column of schema.columns) {
            if (!column.nullable && column.defaultValue === undefined && !column.autoIncrement) {
                const value = this.data[column.name];
                if (value === null || value === undefined || value === '') {
                    const error = `Field '${column.name}' is required`;
                    const validationError = new ValidationError(column.name, value, error);
                    errors.push(validationError);
                    
                    if (!fieldErrors[column.name]) {
                        fieldErrors[column.name] = [];
                    }
                    fieldErrors[column.name].push(error);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            fieldErrors
        };
    }

    /**
     * Validate a single field
     */
    private validateField(rule: ModelValidationRule, value: any, data: Record<string, any>): string | null {
        switch (rule.type) {
            case 'required':
                if (value === null || value === undefined || value === '') {
                    return rule.message || `Field '${rule.field}' is required`;
                }
                break;

            case 'minLength':
                if (typeof value === 'string' && value.length < rule.value) {
                    return rule.message || `Field '${rule.field}' must be at least ${rule.value} characters`;
                }
                break;

            case 'maxLength':
                if (typeof value === 'string' && value.length > rule.value) {
                    return rule.message || `Field '${rule.field}' must be at most ${rule.value} characters`;
                }
                break;

            case 'min':
                if (typeof value === 'number' && value < rule.value) {
                    return rule.message || `Field '${rule.field}' must be at least ${rule.value}`;
                }
                break;

            case 'max':
                if (typeof value === 'number' && value > rule.value) {
                    return rule.message || `Field '${rule.field}' must be at most ${rule.value}`;
                }
                break;

            case 'pattern':
                if (typeof value === 'string' && !rule.value.test(value)) {
                    return rule.message || `Field '${rule.field}' has invalid format`;
                }
                break;

            case 'custom':
                if (rule.validator) {
                    const result = rule.validator(value, data);
                    if (typeof result === 'string') {
                        return result;
                    }
                    if (result === false) {
                        return rule.message || `Field '${rule.field}' is invalid`;
                    }
                }
                break;
        }

        return null;
    }

    /**
     * Validate foreign key references
     * This should be implemented by controllers that have access to the database
     */
    public async validateForeignKeys(): Promise<ModelValidationResult> {
        // This is a placeholder - actual implementation should be in controllers
        // that have access to the database connection
        return {
            isValid: true,
            errors: [],
            fieldErrors: {}
        };
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Convert model to JSON
     */
    public toJSON(): Record<string, any> {
        const result = { ...this.getData() };
        
        // Include relationships in JSON if configured
        const relationMappings = (this.constructor as typeof BaseModel).getRelationMappings();
        for (const [relationName, relationDef] of Object.entries(relationMappings)) {
            if (relationDef.includeInJson !== false && this.hasRelated(relationName)) {
                const related = this.getRelated(relationName);
                if (related) {
                    if (Array.isArray(related)) {
                        result[relationName] = related.map(r => r.toJSON());
                    } else {
                        result[relationName] = related.toJSON();
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * Create a copy of this model
     */
    public clone(): this {
        const Constructor = this.constructor as new (data: any) => this;
        const cloned = new Constructor(this.data);
        cloned.originalData = { ...this.originalData };
        cloned.isNewRecord = this.isNewRecord;
        cloned.relationships = { ...this.relationships };
        return cloned;
    }

    /**
     * Reset changes
     */
    public reset(): this {
        this.data = { ...this.originalData };
        return this;
    }

    /**
     * Mark as saved (update original data)
     */
    public markAsSaved(): this {
        this.originalData = { ...this.data };
        this.isNewRecord = false;
        return this;
    }

    /**
     * Create a model instance from database row
     */
    public static fromRow<T extends BaseModel>(this: new (data?: any) => T, row: Record<string, any>): T {
        const instance = new this(row);
        instance.data = { ...row };
        instance.originalData = { ...row };
        instance.isNewRecord = false;
        return instance;
    }

    /**
     * Create multiple model instances from database rows
     */
    public static fromRows<T extends BaseModel>(this: new (data?: any) => T, rows: Record<string, any>[]): T[] {
        return rows.map(row => (this as any).fromRow(row));
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Helper function to create a column definition
 */
export function column(name: string, type: DataType, options: Partial<ColumnDefinition> = {}): ColumnDefinition {
    return {
        name,
        type,
        nullable: true,
        ...options
    };
}

/**
 * Helper function to create a foreign key definition
 */
export function foreignKey(
    name: string,
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    options: Partial<ForeignKeyDefinition> = {}
): ForeignKeyDefinition {
    return {
        name,
        columns,
        referencedTable,
        referencedColumns,
        onDelete: ForeignKeyAction.RESTRICT,
        onUpdate: ForeignKeyAction.CASCADE,
        ...options
    };
}

/**
 * Helper function to create an index definition
 */
export function index(name: string, columns: string[], options: Partial<IndexDefinition> = {}): IndexDefinition {
    return {
        name,
        columns,
        unique: false,
        ...options
    };
}

/**
 * Helper function to create a validation rule
 */
export function validation(
    field: string,
    type: ModelValidationRule['type'],
    options: Partial<ModelValidationRule> = {}
): ModelValidationRule {
    return {
        field,
        type,
        ...options
    };
}

/**
 * Helper function to create a relationship definition
 */
export function relation(
    type: RelationType,
    modelClass: typeof BaseModel | string | (() => typeof BaseModel),
    join: JoinConfig,
    options: Partial<RelationshipDefinition> = {}
): RelationshipDefinition {
    return {
        relation: type,
        modelClass,
        join,
        includeInJson: true,
        ...options
    };
}

// =============================================================================
// CONSTANTS FOR EASY ACCESS
// =============================================================================

/**
 * Relation types for easier access (similar to Objection.js Model.BelongsToOneRelation)
 */
export const Model = {
    BelongsToOneRelation: RelationType.BelongsToOneRelation,
    HasOneRelation: RelationType.HasOneRelation,
    HasManyRelation: RelationType.HasManyRelation,
    ManyToManyRelation: RelationType.ManyToManyRelation,
    HasOneThroughRelation: RelationType.HasOneThroughRelation
} as const;