/**
 * @fileoverview Sectors Items Model
 * 
 * Model for the SECTORS_ITEMS table storing serialized data for items floating freely in space sectors.
 * This table manages the persistence of dropped items, salvaged materials, and other loose objects.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    validation,
    relation,
    Model,
    DataType,
    type TableSchema,
    type RelationMappings
} from '../BaseModel.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Maximum size for ITEMS binary data as per StarMade database specification
 */
export const MAX_ITEMS_SIZE = 22528;

/**
 * Size of each item record in bytes
 */
export const ITEM_RECORD_SIZE = 22;

/**
 * Maximum number of item stacks per sector
 */
export const MAX_ITEM_STACKS = Math.floor(MAX_ITEMS_SIZE / ITEM_RECORD_SIZE); // 1,024 stacks

// =============================================================================
// SECTORS ITEMS MODEL
// =============================================================================

/**
 * Model for the SECTORS_ITEMS table
 * 
 * Stores serialized binary data for items floating freely in space sectors.
 * Each record contains a fixed-size sequence of item stacks with position and metadata.
 */
export class SectorsItemsModel extends BaseModel {
    public static tableName = 'SECTORS_ITEMS';
    
    public static schema: TableSchema = {
        tableName: 'SECTORS_ITEMS',
        comment: 'Serialized data for items floating freely in space sectors',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                nullable: true,
                comment: 'Sector reference'
            }),
            column('ITEMS', DataType.BLOB, {
                nullable: false,
                comment: 'Serialized item stack data (VARBINARY 22528 bytes max)'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],
        indexes: [],

        validationRules: [
            validation('ITEMS', 'required'),
            validation('ITEMS', 'custom', {
                validator: (value: Buffer) => {
                    if (!Buffer.isBuffer(value)) {
                        return 'ITEMS must be a Buffer';
                    }
                    if (value.length > MAX_ITEMS_SIZE) {
                        return `ITEMS cannot exceed ${MAX_ITEMS_SIZE} bytes`;
                    }
                    return true;
                },
                message: 'Invalid ITEMS data'
            })
        ]
    };

    // =============================================================================
    // RELATIONSHIP MAPPINGS (similar to Objection.js)
    // =============================================================================

    /**
     * Define relationships for this model
     * Similar to Objection.js relationMappings
     */
    public static get relationMappings(): RelationMappings {
        return {
            /** Sector that references this items data (SECTORS_ITEMS.ID corresponds to SECTORS.ID) */
            sector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../sectors/SectorsModel.js').SectorsModel;
                },
                {
                    from: 'SECTORS_ITEMS.ID',
                    to: 'SECTORS.ITEMS' // SECTORS_ITEMS.ID corresponds to SECTORS.ITEMS (sector items reference)
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number | undefined { const v = this.get('ID'); if (v === undefined) return undefined; if (v === null) return null as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number | undefined): this { return this.set('ID', id); }

    public getItems(): Buffer { return this.get('ITEMS'); }
    public setItems(items: Buffer): this { return this.set('ITEMS', items); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /**
     * Get the sector that references this items data
     */
    public getSector(): any | undefined {
        return this.getRelated<any>('sector');
    }

    /**
     * Set the sector that references this items data
     */
    public setSector(sector: any | undefined): this {
        return this.setRelated('sector', sector);
    }

    /**
     * Check if sector relation is loaded
     */
    public hasSectorLoaded(): boolean {
        return this.hasRelated('sector');
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS
    // =============================================================================

    /**
     * Check if sector has any floating items
     */
    public hasItems(): boolean {
        const items = this.getItems();
        return items && items.length > 0;
    }

    /**
     * Get the number of bytes used for item data
     */
    public getItemsSize(): number {
        const items = this.getItems();
        return items ? items.length : 0;
    }

    /**
     * Calculate theoretical maximum number of item stacks based on buffer size
     */
    public getMaxPossibleStacks(): number {
        return Math.floor(this.getItemsSize() / ITEM_RECORD_SIZE);
    }

    /**
     * Check if items data is at maximum capacity
     */
    public isAtMaxCapacity(): boolean {
        return this.getItemsSize() >= MAX_ITEMS_SIZE;
    }

    /**
     * Get remaining capacity in bytes
     */
    public getRemainingCapacity(): number {
        return Math.max(0, MAX_ITEMS_SIZE - this.getItemsSize());
    }

    /**
     * Validate that items data doesn't exceed maximum size
     */
    public validateItemsSize(): boolean {
        return this.getItemsSize() <= MAX_ITEMS_SIZE;
    }

    /**
     * Calculate storage efficiency as a percentage
     */
    public getStorageEfficiency(): number {
        const used = this.getItemsSize();
        const total = MAX_ITEMS_SIZE;
        return total > 0 ? Math.round((used / total) * 100) : 0;
    }

    /**
     * Get estimated number of item stacks (assuming optimal packing)
     */
    public getEstimatedStackCount(): number {
        const items = this.getItems();
        if (!items || items.length === 0) return 0;
        
        // Each stack is ITEM_RECORD_SIZE bytes, but we can only estimate
        // since the actual structure might vary
        return Math.floor(items.length / ITEM_RECORD_SIZE);
    }

    /**
     * Check if items data appears to be valid format
     */
    public isItemsDataValid(): boolean {
        const items = this.getItems();
        if (!items || !Buffer.isBuffer(items)) return false;
        
        // Basic validation: size should be divisible by record size for structured data
        // Note: This is a heuristic, actual validation would require format knowledge
        return items.length === 0 || items.length % ITEM_RECORD_SIZE === 0;
    }

    /**
     * Get sector coordinates if sector is loaded
     */
    public getSectorCoordinates(): string | undefined {
        const sector = this.getSector();
        if (sector && typeof sector.getCoordinatesString === 'function') {
            return sector.getCoordinatesString();
        }
        return undefined;
    }

    /**
     * Get sector name if sector is loaded
     */
    public getSectorName(): string | undefined {
        const sector = this.getSector();
        if (sector && typeof sector.getName === 'function') {
            return sector.getName();
        }
        return undefined;
    }

    /**
     * Get comprehensive items summary
     */
    public getItemsSummary(): {
        id: number | undefined;
        hasItems: boolean;
        sizeBytes: number;
        maxSizeBytes: number;
        remainingBytes: number;
        storageEfficiency: number;
        maxPossibleStacks: number;
        estimatedStackCount: number;
        isAtCapacity: boolean;
        isDataValid: boolean;
        hasSectorLoaded: boolean;
        sectorCoordinates?: string;
        sectorName?: string;
    } {
        return {
            id: this.getId(),
            hasItems: this.hasItems(),
            sizeBytes: this.getItemsSize(),
            maxSizeBytes: MAX_ITEMS_SIZE,
            remainingBytes: this.getRemainingCapacity(),
            storageEfficiency: this.getStorageEfficiency(),
            maxPossibleStacks: this.getMaxPossibleStacks(),
            estimatedStackCount: this.getEstimatedStackCount(),
            isAtCapacity: this.isAtMaxCapacity(),
            isDataValid: this.isItemsDataValid(),
            hasSectorLoaded: this.hasSectorLoaded(),
            sectorCoordinates: this.getSectorCoordinates(),
            sectorName: this.getSectorName()
        };
    }

    /**
     * Compare items capacity with another SectorsItemsModel
     */
    public compareCapacityWith(other: SectorsItemsModel): {
        thisSize: number;
        otherSize: number;
        difference: number;
        thisEfficiency: number;
        otherEfficiency: number;
        moreEfficient: 'this' | 'other' | 'equal';
    } {
        const thisSize = this.getItemsSize();
        const otherSize = other.getItemsSize();
        const thisEfficiency = this.getStorageEfficiency();
        const otherEfficiency = other.getStorageEfficiency();
        
        let moreEfficient: 'this' | 'other' | 'equal' = 'equal';
        if (thisEfficiency > otherEfficiency) moreEfficient = 'this';
        else if (otherEfficiency > thisEfficiency) moreEfficient = 'other';
        
        return {
            thisSize,
            otherSize,
            difference: thisSize - otherSize,
            thisEfficiency,
            otherEfficiency,
            moreEfficient
        };
    }

    /**
     * Generate a cache key for this items data
     */
    public getCacheKey(): string {
        const sectorCoords = this.getSectorCoordinates() || 'unknown';
        const size = this.getItemsSize();
        return `sector-items:${sectorCoords}:${this.getId()}:${size}`;
    }

    /**
     * Check if items data has changed since last save
     */
    public hasItemsChanged(): boolean {
        const originalItems = this.originalData['ITEMS'];
        const currentItems = this.getItems();
        
        if (!originalItems && !currentItems) return false;
        if (!originalItems || !currentItems) return true;
        
        return !Buffer.isBuffer(originalItems) || 
               !Buffer.isBuffer(currentItems) || 
               !originalItems.equals(currentItems);
    }
}