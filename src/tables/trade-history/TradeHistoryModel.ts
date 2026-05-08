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
    public static tableName = 'TRADE_HISTORY';
    
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

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getFromId(): number { return this.get('FROM_ID'); }
    public setFromId(fromId: number): this { return this.set('FROM_ID', fromId); }

    public getToId(): number { return this.get('TO_ID'); }
    public setToId(toId: number): this { return this.set('TO_ID', toId); }

    public getFromOwner(): string { return this.get('FROM_OWNER'); }
    public setFromOwner(fromOwner: string): this { return this.set('FROM_OWNER', fromOwner); }

    public getToOwner(): string { return this.get('TO_OWNER'); }
    public setToOwner(toOwner: string): this { return this.set('TO_OWNER', toOwner); }

    public getFromFactionId(): number { return this.get('FROM_FACTION_ID'); }
    public setFromFactionId(fromFactionId: number): this { return this.set('FROM_FACTION_ID', fromFactionId); }

    public getToFactionId(): number { return this.get('TO_FACTION_ID'); }
    public setToFactionId(toFactionId: number): this { return this.set('TO_FACTION_ID', toFactionId); }

    public getTotalCost(): number { return this.get('TOTAL_COST'); }
    public setTotalCost(totalCost: number): this { return this.set('TOTAL_COST', totalCost); }

    public getDeliveryCost(): number { return this.get('DELIVERY_COST'); }
    public setDeliveryCost(deliveryCost: number): this { return this.set('DELIVERY_COST', deliveryCost); }

    public getSent(): number { return this.get('SENT'); }
    public setSent(sent: number): this { return this.set('SENT', sent); }

    public getReceived(): number { return this.get('RECEIVED'); }
    public setReceived(received: number): this { return this.set('RECEIVED', received); }

    public getVolume(): number { return this.get('VOLUME'); }
    public setVolume(volume: number): this { return this.set('VOLUME', volume); }

    public getSuccess(): boolean { return this.get('SUCCESS'); }
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