/**
 * @fileoverview Trade History Model
 * 
 * Model for the TRADE_HISTORY table designed to record all commercial trades between trading stations.
 * 
 * **IMPORTANT NOTE: This table is currently UNUSED in the StarMade game implementation.**
 * It serves as a reserved structure for potential future transaction tracking and economic analytics functionality.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    index,
    validation,
    DataType,
    type TableSchema
} from '../BaseModel.js';

// =============================================================================
// TRADE HISTORY MODEL
// =============================================================================

/**
 * Model for the TRADE_HISTORY table
 * 
 * **STATUS: UNUSED** - This table exists in the database schema but is not actively used
 * by the StarMade game engine. It represents a designed but unimplemented feature
 * for comprehensive transaction logging.
 */
export class TradeHistoryModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'TRADE_HISTORY';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'TRADE_HISTORY',
        comment: 'Transaction logging table for commercial trades (CURRENTLY UNUSED)',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Transaction ID'
            }),
            column('FROM_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Source node ID'
            }),
            column('TO_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Destination node ID'
            }),
            column('FROM_OWNER', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Source owner UID'
            }),
            column('TO_OWNER', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Destination owner UID'
            }),
            column('FROM_FACTION_ID', DataType.INTEGER, {
                nullable: false,
                comment: 'Source faction'
            }),
            column('TO_FACTION_ID', DataType.INTEGER, {
                nullable: false,
                comment: 'Destination faction'
            }),
            column('TOTAL_COST', DataType.BIGINT, {
                nullable: false,
                comment: 'Transaction value'
            }),
            column('DELIVERY_COST', DataType.BIGINT, {
                nullable: false,
                comment: 'Shipping fee'
            }),
            column('SENT', DataType.BIGINT, {
                nullable: false,
                comment: 'Dispatch timestamp'
            }),
            column('RECEIVED', DataType.BIGINT, {
                nullable: false,
                comment: 'Delivery timestamp'
            }),
            column('VOLUME', DataType.DOUBLE, {
                nullable: false,
                comment: 'Cargo volume'
            }),
            column('SUCCESS', DataType.BOOLEAN, {
                nullable: false,
                defaultValue: false,
                comment: 'Completion status'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('frTr', ['FROM_ID']),
            index('toTr', ['TO_ID']),
            index('frFacTr', ['FROM_FACTION_ID']),
            index('toFacTr', ['TO_FACTION_ID']),
            index('fromIniTr', ['FROM_OWNER']),
            index('toIniTr', ['TO_OWNER']),
            index('timeConstT', ['SENT']),
            index('timeConstEET', ['RECEIVED']),
            index('sucCon', ['SUCCESS'])
        ],

        validationRules: [
            validation('FROM_ID', 'required'),
            validation('TO_ID', 'required'),
            validation('FROM_OWNER', 'required'),
            validation('FROM_OWNER', 'maxLength', {
                value: 128,
                message: 'FROM_OWNER cannot exceed 128 characters'
            }),
            validation('TO_OWNER', 'required'),
            validation('TO_OWNER', 'maxLength', {
                value: 128,
                message: 'TO_OWNER cannot exceed 128 characters'
            }),
            validation('FROM_FACTION_ID', 'required'),
            validation('TO_FACTION_ID', 'required'),
            validation('TOTAL_COST', 'required'),
            validation('TOTAL_COST', 'min', {
                value: 0,
                message: 'TOTAL_COST cannot be negative'
            }),
            validation('DELIVERY_COST', 'required'),
            validation('DELIVERY_COST', 'min', {
                value: 0,
                message: 'DELIVERY_COST cannot be negative'
            }),
            validation('SENT', 'required'),
            validation('RECEIVED', 'required'),
            validation('VOLUME', 'required'),
            validation('VOLUME', 'min', {
                value: 0,
                message: 'VOLUME cannot be negative'
            }),
            validation('RECEIVED', 'custom', {
                validator: (received: number, data: any) => {
                    const sent = data.SENT;
                    return !sent || received >= sent || 'RECEIVED timestamp must be after SENT timestamp';
                },
                message: 'Invalid transaction timing'
            })
        ]
    };

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the TRADE_HISTORY.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the TRADE_HISTORY.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the TRADE_HISTORY.FROM_ID column from this model.
     * @returns The stored FROM_ID value.
     */
    public getFromId(): number { return this.get('FROM_ID'); }
    /**
     * Store the TRADE_HISTORY.FROM_ID column in this model and return this for chaining.
     * @param fromId New value for the FROM_ID column.
     * @returns This model for chaining.
     */
    public setFromId(fromId: number): this { return this.set('FROM_ID', fromId); }

    /**
     * Read the TRADE_HISTORY.TO_ID column from this model.
     * @returns The stored TO_ID value.
     */
    public getToId(): number { return this.get('TO_ID'); }
    /**
     * Store the TRADE_HISTORY.TO_ID column in this model and return this for chaining.
     * @param toId New value for the TO_ID column.
     * @returns This model for chaining.
     */
    public setToId(toId: number): this { return this.set('TO_ID', toId); }

    /**
     * Read the TRADE_HISTORY.FROM_OWNER column from this model.
     * @returns The stored FROM_OWNER value.
     */
    public getFromOwner(): string { return this.get('FROM_OWNER'); }
    /**
     * Store the TRADE_HISTORY.FROM_OWNER column in this model and return this for chaining.
     * @param fromOwner New value for the FROM_OWNER column.
     * @returns This model for chaining.
     */
    public setFromOwner(fromOwner: string): this { return this.set('FROM_OWNER', fromOwner); }

    /**
     * Read the TRADE_HISTORY.TO_OWNER column from this model.
     * @returns The stored TO_OWNER value.
     */
    public getToOwner(): string { return this.get('TO_OWNER'); }
    /**
     * Store the TRADE_HISTORY.TO_OWNER column in this model and return this for chaining.
     * @param toOwner New value for the TO_OWNER column.
     * @returns This model for chaining.
     */
    public setToOwner(toOwner: string): this { return this.set('TO_OWNER', toOwner); }

    /**
     * Read the TRADE_HISTORY.FROM_FACTION_ID column from this model.
     * @returns The stored FROM_FACTION_ID value.
     */
    public getFromFactionId(): number { return this.get('FROM_FACTION_ID'); }
    /**
     * Store the TRADE_HISTORY.FROM_FACTION_ID column in this model and return this for chaining.
     * @param fromFactionId New value for the FROM_FACTION_ID column.
     * @returns This model for chaining.
     */
    public setFromFactionId(fromFactionId: number): this { return this.set('FROM_FACTION_ID', fromFactionId); }

    /**
     * Read the TRADE_HISTORY.TO_FACTION_ID column from this model.
     * @returns The stored TO_FACTION_ID value.
     */
    public getToFactionId(): number { return this.get('TO_FACTION_ID'); }
    /**
     * Store the TRADE_HISTORY.TO_FACTION_ID column in this model and return this for chaining.
     * @param toFactionId New value for the TO_FACTION_ID column.
     * @returns This model for chaining.
     */
    public setToFactionId(toFactionId: number): this { return this.set('TO_FACTION_ID', toFactionId); }

    /**
     * Read the TRADE_HISTORY.TOTAL_COST column from this model.
     * @returns The stored TOTAL_COST value.
     */
    public getTotalCost(): number { return this.get('TOTAL_COST'); }
    /**
     * Store the TRADE_HISTORY.TOTAL_COST column in this model and return this for chaining.
     * @param totalCost New value for the TOTAL_COST column.
     * @returns This model for chaining.
     */
    public setTotalCost(totalCost: number): this { return this.set('TOTAL_COST', totalCost); }

    /**
     * Read the TRADE_HISTORY.DELIVERY_COST column from this model.
     * @returns The stored DELIVERY_COST value.
     */
    public getDeliveryCost(): number { return this.get('DELIVERY_COST'); }
    /**
     * Store the TRADE_HISTORY.DELIVERY_COST column in this model and return this for chaining.
     * @param deliveryCost New value for the DELIVERY_COST column.
     * @returns This model for chaining.
     */
    public setDeliveryCost(deliveryCost: number): this { return this.set('DELIVERY_COST', deliveryCost); }

    /**
     * Read the TRADE_HISTORY.SENT column from this model.
     * @returns The stored SENT value.
     */
    public getSent(): number { return this.get('SENT'); }
    /**
     * Store the TRADE_HISTORY.SENT column in this model and return this for chaining.
     * @param sent New value for the SENT column.
     * @returns This model for chaining.
     */
    public setSent(sent: number): this { return this.set('SENT', sent); }

    /**
     * Read the TRADE_HISTORY.RECEIVED column from this model.
     * @returns The stored RECEIVED value.
     */
    public getReceived(): number { return this.get('RECEIVED'); }
    /**
     * Store the TRADE_HISTORY.RECEIVED column in this model and return this for chaining.
     * @param received New value for the RECEIVED column.
     * @returns This model for chaining.
     */
    public setReceived(received: number): this { return this.set('RECEIVED', received); }

    /**
     * Read the TRADE_HISTORY.VOLUME column from this model.
     * @returns The stored VOLUME value.
     */
    public getVolume(): number { return this.get('VOLUME'); }
    /**
     * Store the TRADE_HISTORY.VOLUME column in this model and return this for chaining.
     * @param volume New value for the VOLUME column.
     * @returns This model for chaining.
     */
    public setVolume(volume: number): this { return this.set('VOLUME', volume); }

    /**
     * Read the TRADE_HISTORY.SUCCESS column from this model.
     * @returns The stored SUCCESS value.
     */
    public getSuccess(): boolean { return this.get('SUCCESS'); }
    /**
     * Store the TRADE_HISTORY.SUCCESS column in this model and return this for chaining.
     * @param success New value for the SUCCESS column.
     * @returns This model for chaining.
     */
    public setSuccess(success: boolean): this { return this.set('SUCCESS', success); }

    // =============================================================================
    // BUSINESS LOGIC METHODS
    // =============================================================================

    /**
     * Calculate net profit (total cost minus delivery cost)
     */
    public getNetProfit(): number {
        return this.getTotalCost() - this.getDeliveryCost();
    }

    /**
     * Calculate transaction duration in milliseconds
     */
    public getDuration(): number {
        return this.getReceived() - this.getSent();
    }

    /**
     * Check if transaction was successful
     */
    public isSuccessful(): boolean {
        return this.getSuccess();
    }

    /**
     * Check if transaction failed
     */
    public isFailed(): boolean {
        return !this.getSuccess();
    }

    /**
     * Get formatted timestamps for sent and received
     */
    public getFormattedTimestamps(): {
        sent: string;
        received: string;
        duration: string;
    } {
        const sentDate = new Date(this.getSent());
        const receivedDate = new Date(this.getReceived());
        const duration = this.getDuration();
        
        return {
            sent: sentDate.toISOString(),
            received: receivedDate.toISOString(),
            duration: `${duration}ms`
        };
    }

    /**
     * Check if this is an internal faction trade
     */
    public isInternalFactionTrade(): boolean {
        return this.getFromFactionId() === this.getToFactionId() && 
               this.getFromFactionId() !== 0; // Not neutral
    }

    /**
     * Check if this involves neutral parties
     */
    public involvesNeutralParty(): boolean {
        return this.getFromFactionId() === 0 || this.getToFactionId() === 0;
    }

    /**
     * Get transaction summary
     */
    public getTransactionSummary(): {
        id: number;
        fromId: number;
        toId: number;
        fromOwner: string;
        toOwner: string;
        fromFactionId: number;
        toFactionId: number;
        totalCost: number;
        deliveryCost: number;
        netProfit: number;
        volume: number;
        duration: number;
        success: boolean;
        isInternalTrade: boolean;
        involvesNeutral: boolean;
        timestamps: {
            sent: string;
            received: string;
        };
    } {
        const timestamps = this.getFormattedTimestamps();
        
        return {
            id: this.getId(),
            fromId: this.getFromId(),
            toId: this.getToId(),
            fromOwner: this.getFromOwner(),
            toOwner: this.getToOwner(),
            fromFactionId: this.getFromFactionId(),
            toFactionId: this.getToFactionId(),
            totalCost: this.getTotalCost(),
            deliveryCost: this.getDeliveryCost(),
            netProfit: this.getNetProfit(),
            volume: this.getVolume(),
            duration: this.getDuration(),
            success: this.getSuccess(),
            isInternalTrade: this.isInternalFactionTrade(),
            involvesNeutral: this.involvesNeutralParty(),
            timestamps: {
                sent: timestamps.sent,
                received: timestamps.received
            }
        };
    }
}