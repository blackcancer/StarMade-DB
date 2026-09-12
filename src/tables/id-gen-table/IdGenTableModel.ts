/**
 * @fileoverview ID Gen Table Model
 * 
 * Model for the ID_GEN_TABLE table storing ID generation sequences.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    validation,
    DataType,
    type TableSchema
} from '../BaseModel.js';

/**
 * Model for the ID_GEN_TABLE table
 */
export class IdGenTableModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'ID_GEN_TABLE';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'ID_GEN_TABLE',
        comment: 'ID generation sequences',
        
        columns: [
            column('ID', DataType.VARCHAR, {
                length: 128,
                primaryKey: true,
                nullable: false,
                comment: 'Generator identifier'
            }),
            column('ID_GEN', DataType.BIGINT, {
                nullable: false,
                comment: 'Next ID value'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],
        indexes: [],

        validationRules: [
            validation('ID', 'required'),
            validation('ID', 'maxLength', {
                value: 128,
                message: 'ID cannot exceed 128 characters'
            }),
            validation('ID_GEN', 'required'),
            validation('ID_GEN', 'min', {
                value: 0,
                message: 'ID_GEN cannot be negative'
            })
        ]
    };

    // Typed accessors
    /**
     * Read the ID_GEN_TABLE.ID column from this model.
     * @returns The stored ID value.
     */
    public getId(): string { return this.get('ID'); }
    /**
     * Store the ID_GEN_TABLE.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: string): this { return this.set('ID', id); }

    /**
     * Read the ID_GEN_TABLE.ID_GEN column from this model. Numeric strings are converted to integers.
     * @returns The stored ID_GEN value, normalized to an integer when necessary.
     */
    public getIdGen(): number { 
        const value = this.get('ID_GEN');
        return typeof value === 'string' ? parseInt(value) : (value || 0);
    }
    /**
     * Store the ID_GEN_TABLE.ID_GEN column in this model and return this for chaining.
     * @param idGen New value for the ID_GEN column.
     * @returns This model for chaining.
     */
    public setIdGen(idGen: number): this { return this.set('ID_GEN', idGen); }

    // Business logic methods
    /** Return the current ID_GEN value and increment the in-memory counter by one. Persist the model to retain the increment. */
    public getNextId(): number {
        const current = this.getIdGen();
        this.setIdGen(current + 1);
        return current;
    }

    /** Advance ID_GEN by one and return this model for chaining. */
    public incrementId(amount: number = 1): this {
        const current = this.getIdGen();
        return this.setIdGen(current + amount);
    }
}