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
    public static tableName = 'ID_GEN_TABLE';
    
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
    public getId(): string { return this.get('ID'); }
    public setId(id: string): this { return this.set('ID', id); }

    public getIdGen(): number { 
        const value = this.get('ID_GEN');
        return typeof value === 'string' ? parseInt(value) : (value || 0);
    }
    public setIdGen(idGen: number): this { return this.set('ID_GEN', idGen); }

    // Business logic methods
    public getNextId(): number {
        const current = this.getIdGen();
        this.setIdGen(current + 1);
        return current;
    }

    public incrementId(amount: number = 1): this {
        const current = this.getIdGen();
        return this.setIdGen(current + amount);
    }
}