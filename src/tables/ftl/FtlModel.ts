import * as related0 from '../sectors/SectorsModel.js';
import * as related1 from '../entities/EntitiesModel.js';
/**
 * @fileoverview FTL Model
 * 
 * Model for the FTL table storing faster-than-light jump connections.
 * Provides jump gate and wormhole management with access control.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    index,
    validation,
    relation,
    Model,
    DataType,
    type TableSchema,
    type RelationMappings
} from '../BaseModel.js';

// =============================================================================
// FTL ENUMS AND TYPES
// =============================================================================

/**
 * FTL connection types according to TABLE_FTL.md
 */
export enum FtlType {
    /** Ftl type value for warp gate, serialized as 0. */
    WARP_GATE = 0,  // Fixed jump gate connection
    /** Ftl type value for worm hole, serialized as 1. */
    WORM_HOLE = 1,  // Natural space anomaly
    /** Ftl type value for race way, serialized as 2. */
    RACE_WAY = 2    // Racing/transit corridor
}

/**
 * Permission flags for FTL access control (bitwise)
 */
export enum FtlPermission {
    /** Ftl permission value for no spawn, serialized as 1. */
    NO_SPAWN = 1,       // Bit 0: No spawning allowed
    /** Ftl permission value for no attack, serialized as 2. */
    NO_ATTACK = 2,      // Bit 1: No attacks allowed
    /** Ftl permission value for no enter, serialized as 4. */
    NO_ENTER = 4,       // Bit 2: Entry prohibited
    /** Ftl permission value for no exit, serialized as 8. */
    NO_EXIT = 8,        // Bit 3: Exit prohibited
    /** Ftl permission value for no indications, serialized as 16. */
    NO_INDICATIONS = 16, // Bit 4: No notifications
    /** Ftl permission value for no fp loss, serialized as 32. */
    NO_FP_LOSS = 32     // Bit 5: No faction point loss
}

/**
 * Common permission combinations
 */
export const FTL_PERMISSION_COMBINATIONS = {
    NORMAL: 0,                                           // No restrictions
    PEACE_ZONE: FtlPermission.NO_SPAWN | FtlPermission.NO_ATTACK,   // 3
    LOCKED: FtlPermission.NO_ENTER | FtlPermission.NO_EXIT,         // 12
    FULL_PROTECTION: FtlPermission.NO_SPAWN | FtlPermission.NO_ATTACK | FtlPermission.NO_FP_LOSS // 35
} as const;

// =============================================================================
// FTL MODEL
// =============================================================================

/**
 * Model for the FTL table - Enhanced Edition with Complete Relations
 * 
 * Advanced FTL jump management with complete bidirectional relationships,
 * comprehensive jump analytics, and routing optimization.
 */
export class FtlModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'FTL';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'FTL',
        comment: 'Faster-than-light jump connections',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Jump record ID'
            }),
            column('FROM_X', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin sector X coordinate'
            }),
            column('FROM_Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin sector Y coordinate'
            }),
            column('FROM_Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin sector Z coordinate'
            }),
            column('FROM_X_LOC', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin local X position (always 0)'
            }),
            column('FROM_Y_LOC', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin local Y position (always 0)'
            }),
            column('FROM_Z_LOC', DataType.INTEGER, {
                nullable: false,
                comment: 'Origin local Z position (always 0)'
            }),
            column('FROM_UID', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Origin entity UID'
            }),
            column('TO_X', DataType.INTEGER, {
                nullable: false,
                comment: 'Destination sector X coordinate'
            }),
            column('TO_Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Destination sector Y coordinate'
            }),
            column('TO_Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Destination sector Z coordinate'
            }),
            column('TO_X_LOC', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Destination local X position'
            }),
            column('TO_Y_LOC', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Destination local Y position'
            }),
            column('TO_Z_LOC', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Destination local Z position'
            }),
            column('TO_UID', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Destination entity UID'
            }),
            column('TYPE', DataType.INTEGER, {
                nullable: false,
                comment: 'Jump type (see FtlType enum)'
            }),
            column('PERMISSION', DataType.INTEGER, {
                nullable: false,
                comment: 'Access control flags'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('fromFTLIndLoc', ["FROM_UID", 'FROM_X_LOC', 'FROM_Y_LOC', 'FROM_Z_LOC']),
            index('fromFTLInd', ['FROM_X', 'FROM_Y', 'FROM_Z']),
            index('fromUIDFTLInd', ["FROM_UID", 'FROM_X', 'FROM_Y', 'FROM_Z']),
            index('toFTLInd', ['TO_X', 'TO_Y', 'TO_Z']),
            index('fromFTLUID', ['FROM_UID']),
            index('toFTLUID', ['TO_UID']),
            index('typeFTL', ['TYPE']),
            index('permissionFTL', ['PERMISSION'])
        ],

        validationRules: [
            validation('FROM_X', 'required'),
            validation('FROM_Y', 'required'),
            validation('FROM_Z', 'required'),
            validation('FROM_X_LOC', 'required'),
            validation('FROM_Y_LOC', 'required'),
            validation('FROM_Z_LOC', 'required'),
            validation('FROM_UID', 'required'),
            validation('FROM_UID', 'maxLength', {
                value: 128,
                message: 'From UID cannot exceed 128 characters'
            }),
            validation('TO_X', 'required'),
            validation('TO_Y', 'required'),
            validation('TO_Z', 'required'),
            validation('TO_X_LOC', 'required'),
            validation('TO_Y_LOC', 'required'),
            validation('TO_Z_LOC', 'required'),
            validation('TO_UID', 'required'),
            validation('TO_UID', 'maxLength', {
                value: 128,
                message: 'To UID cannot exceed 128 characters'
            }),
            validation('TYPE', 'required'),
            validation('TYPE', 'custom', {
                validator: (type: number) => {
                    const validTypes = Object.values(FtlType).filter(v => typeof v === 'number');
                    return validTypes.includes(type) || `Invalid FTL type: ${type}`;
                },
                message: 'Invalid FTL type'
            }),
            validation('PERMISSION', 'required'),
            validation('PERMISSION', 'custom', {
                validator: (permission: number) => {
                    if (permission < 0 || permission > 63) { // Max 6 bits = 63
                        return 'Permission value out of range (0-63)';
                    }
                    return true;
                }
            })
        ]
    };

    // =============================================================================
    // RELATIONSHIP MAPPINGS (similar to Objection.js)
    // =============================================================================

    /**
     * Define relationships for this model
     * Similar to Objection.js relationMappings with optimized index usage
     */
    public static get relationMappings(): RelationMappings {
        return {
            /** Origin sector where the FTL connection starts (FTL.FROM_X/Y/Z -> SECTORS.X/Y/Z) */
            fromSector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.SectorsModel;
                },
                {
                    from: ['FTL.FROM_X', 'FTL.FROM_Y', 'FTL.FROM_Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            ),

            /** Destination sector where the FTL connection ends (FTL.TO_X/Y/Z -> SECTORS.X/Y/Z) */
            toSector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.SectorsModel;
                },
                {
                    from: ['FTL.TO_X', 'FTL.TO_Y', 'FTL.TO_Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            ),

            /** Origin entity that provides the FTL connection (FTL.FROM_UID -> ENTITIES.UID) */
            fromEntity: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related1.EntitiesModel;
                },
                {
                    from: 'FTL.FROM_UID',
                    to: 'ENTITIES.UID'
                }
            ),

            /** Destination entity that receives the FTL connection (FTL.TO_UID -> ENTITIES.UID) */
            toEntity: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related1.EntitiesModel;
                },
                {
                    from: 'FTL.TO_UID',
                    to: 'ENTITIES.UID'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the FTL.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the FTL.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the FTL.FROM_X column from this model.
     * @returns The stored FROM_X value.
     */
    public getFromX(): number { return this.get('FROM_X'); }
    /**
     * Store the FTL.FROM_X column in this model and return this for chaining.
     * @param fromX New value for the FROM_X column.
     * @returns This model for chaining.
     */
    public setFromX(fromX: number): this { return this.set('FROM_X', fromX); }

    /**
     * Read the FTL.FROM_Y column from this model.
     * @returns The stored FROM_Y value.
     */
    public getFromY(): number { return this.get('FROM_Y'); }
    /**
     * Store the FTL.FROM_Y column in this model and return this for chaining.
     * @param fromY New value for the FROM_Y column.
     * @returns This model for chaining.
     */
    public setFromY(fromY: number): this { return this.set('FROM_Y', fromY); }

    /**
     * Read the FTL.FROM_Z column from this model.
     * @returns The stored FROM_Z value.
     */
    public getFromZ(): number { return this.get('FROM_Z'); }
    /**
     * Store the FTL.FROM_Z column in this model and return this for chaining.
     * @param fromZ New value for the FROM_Z column.
     * @returns This model for chaining.
     */
    public setFromZ(fromZ: number): this { return this.set('FROM_Z', fromZ); }

    /**
     * Read the FTL.FROM_X_LOC column from this model.
     * @returns The stored FROM_X_LOC value.
     */
    public getFromXLoc(): number { return this.get('FROM_X_LOC'); }
    /**
     * Store the FTL.FROM_X_LOC column in this model and return this for chaining.
     * @param fromXLoc New value for the FROM_X_LOC column.
     * @returns This model for chaining.
     */
    public setFromXLoc(fromXLoc: number): this { return this.set('FROM_X_LOC', fromXLoc); }

    /**
     * Read the FTL.FROM_Y_LOC column from this model.
     * @returns The stored FROM_Y_LOC value.
     */
    public getFromYLoc(): number { return this.get('FROM_Y_LOC'); }
    /**
     * Store the FTL.FROM_Y_LOC column in this model and return this for chaining.
     * @param fromYLoc New value for the FROM_Y_LOC column.
     * @returns This model for chaining.
     */
    public setFromYLoc(fromYLoc: number): this { return this.set('FROM_Y_LOC', fromYLoc); }

    /**
     * Read the FTL.FROM_Z_LOC column from this model.
     * @returns The stored FROM_Z_LOC value.
     */
    public getFromZLoc(): number { return this.get('FROM_Z_LOC'); }
    /**
     * Store the FTL.FROM_Z_LOC column in this model and return this for chaining.
     * @param fromZLoc New value for the FROM_Z_LOC column.
     * @returns This model for chaining.
     */
    public setFromZLoc(fromZLoc: number): this { return this.set('FROM_Z_LOC', fromZLoc); }

    /**
     * Read the FTL.FROM_UID column from this model.
     * @returns The stored FROM_UID value.
     */
    public getFromUid(): string { return this.get('FROM_UID'); }
    /**
     * Store the FTL.FROM_UID column in this model and return this for chaining.
     * @param fromUid New value for the FROM_UID column.
     * @returns This model for chaining.
     */
    public setFromUid(fromUid: string): this { return this.set('FROM_UID', fromUid); }

    /**
     * Read the FTL.TO_X column from this model.
     * @returns The stored TO_X value.
     */
    public getToX(): number { return this.get('TO_X'); }
    /**
     * Store the FTL.TO_X column in this model and return this for chaining.
     * @param toX New value for the TO_X column.
     * @returns This model for chaining.
     */
    public setToX(toX: number): this { return this.set('TO_X', toX); }

    /**
     * Read the FTL.TO_Y column from this model.
     * @returns The stored TO_Y value.
     */
    public getToY(): number { return this.get('TO_Y'); }
    /**
     * Store the FTL.TO_Y column in this model and return this for chaining.
     * @param toY New value for the TO_Y column.
     * @returns This model for chaining.
     */
    public setToY(toY: number): this { return this.set('TO_Y', toY); }

    /**
     * Read the FTL.TO_Z column from this model.
     * @returns The stored TO_Z value.
     */
    public getToZ(): number { return this.get('TO_Z'); }
    /**
     * Store the FTL.TO_Z column in this model and return this for chaining.
     * @param toZ New value for the TO_Z column.
     * @returns This model for chaining.
     */
    public setToZ(toZ: number): this { return this.set('TO_Z', toZ); }

    /**
     * Read the FTL.TO_X_LOC column from this model.
     * @returns The stored TO_X_LOC value.
     */
    public getToXLoc(): number { return this.get('TO_X_LOC'); }
    /**
     * Store the FTL.TO_X_LOC column in this model and return this for chaining.
     * @param toXLoc New value for the TO_X_LOC column.
     * @returns This model for chaining.
     */
    public setToXLoc(toXLoc: number): this { return this.set('TO_X_LOC', toXLoc); }

    /**
     * Read the FTL.TO_Y_LOC column from this model.
     * @returns The stored TO_Y_LOC value.
     */
    public getToYLoc(): number { return this.get('TO_Y_LOC'); }
    /**
     * Store the FTL.TO_Y_LOC column in this model and return this for chaining.
     * @param toYLoc New value for the TO_Y_LOC column.
     * @returns This model for chaining.
     */
    public setToYLoc(toYLoc: number): this { return this.set('TO_Y_LOC', toYLoc); }

    /**
     * Read the FTL.TO_Z_LOC column from this model.
     * @returns The stored TO_Z_LOC value.
     */
    public getToZLoc(): number { return this.get('TO_Z_LOC'); }
    /**
     * Store the FTL.TO_Z_LOC column in this model and return this for chaining.
     * @param toZLoc New value for the TO_Z_LOC column.
     * @returns This model for chaining.
     */
    public setToZLoc(toZLoc: number): this { return this.set('TO_Z_LOC', toZLoc); }

    /**
     * Read the FTL.TO_UID column from this model.
     * @returns The stored TO_UID value.
     */
    public getToUid(): string { return this.get('TO_UID'); }
    /**
     * Store the FTL.TO_UID column in this model and return this for chaining.
     * @param toUid New value for the TO_UID column.
     * @returns This model for chaining.
     */
    public setToUid(toUid: string): this { return this.set('TO_UID', toUid); }

    /**
     * Read the FTL.TYPE column from this model.
     * @returns The stored TYPE value.
     */
    public getType(): FtlType { return this.get('TYPE'); }
    /**
     * Store the FTL.TYPE column in this model and return this for chaining.
     * @param type New value for the TYPE column.
     * @returns This model for chaining.
     */
    public setType(type: FtlType): this { return this.set('TYPE', type); }

    /**
     * Read the FTL.PERMISSION column from this model.
     * @returns The stored PERMISSION value.
     */
    public getPermission(): number { return this.get('PERMISSION'); }
    /**
     * Store the FTL.PERMISSION column in this model and return this for chaining.
     * @param permission New value for the PERMISSION column.
     * @returns This model for chaining.
     */
    public setPermission(permission: number): this { return this.set('PERMISSION', permission); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the origin sector where the FTL connection starts */
    public getFromSector(): any | undefined {
        return this.getRelated<any>('fromSector');
    }

    /** Set the origin sector where the FTL connection starts */
    public setFromSector(sector: any | undefined): this {
        return this.setRelated('fromSector', sector);
    }

    /** Get the destination sector where the FTL connection ends */
    public getToSector(): any | undefined {
        return this.getRelated<any>('toSector');
    }

    /** Set the destination sector where the FTL connection ends */
    public setToSector(sector: any | undefined): this {
        return this.setRelated('toSector', sector);
    }

    /** Get the origin entity that provides the FTL connection */
    public getFromEntity(): any | undefined {
        return this.getRelated<any>('fromEntity');
    }

    /** Set the origin entity that provides the FTL connection */
    public setFromEntity(entity: any | undefined): this {
        return this.setRelated('fromEntity', entity);
    }

    /** Get the destination entity that receives the FTL connection */
    public getToEntity(): any | undefined {
        return this.getRelated<any>('toEntity');
    }

    /** Set the destination entity that receives the FTL connection */
    public setToEntity(entity: any | undefined): this {
        return this.setRelated('toEntity', entity);
    }

    /** Check if origin sector relation is loaded */
    public hasFromSectorLoaded(): boolean {
        return this.hasRelated('fromSector');
    }

    /** Check if destination sector relation is loaded */
    public hasToSectorLoaded(): boolean {
        return this.hasRelated('toSector');
    }

    /** Check if any sector relations are loaded */
    public hasSectorRelationsLoaded(): boolean {
        return this.hasFromSectorLoaded() || this.hasToSectorLoaded();
    }

    /** Check if origin entity relation is loaded */
    public hasFromEntityLoaded(): boolean {
        return this.hasRelated('fromEntity');
    }

    /** Check if destination entity relation is loaded */
    public hasToEntityLoaded(): boolean {
        return this.hasRelated('toEntity');
    }

    /** Check if any entity relations are loaded */
    public hasEntityRelationsLoaded(): boolean {
        return this.hasFromEntityLoaded() || this.hasToEntityLoaded();
    }

    /** Check if all relations are loaded */
    public hasAllRelationsLoaded(): boolean {
        return this.hasFromSectorLoaded() && this.hasToSectorLoaded() && 
               this.hasFromEntityLoaded() && this.hasToEntityLoaded();
    }

    // =============================================================================
    // COORDINATE METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Get origin coordinates as formatted string
     */
    public getFromCoordinatesString(): string {
        return `(${this.getFromX()}, ${this.getFromY()}, ${this.getFromZ()})`;
    }

    /**
     * Get destination coordinates as formatted string
     */
    public getToCoordinatesString(): string {
        return `(${this.getToX()}, ${this.getToY()}, ${this.getToZ()})`;
    }

    /**
     * Get origin local coordinates as formatted string
     */
    public getFromLocalCoordinatesString(): string {
        return `(${this.getFromXLoc()}, ${this.getFromYLoc()}, ${this.getFromZLoc()})`;
    }

    /**
     * Get destination local coordinates as formatted string
     */
    public getToLocalCoordinatesString(): string {
        return `(${this.getToXLoc()}, ${this.getToYLoc()}, ${this.getToZLoc()})`;
    }

    /**
     * Get origin sector name from loaded relation
     */
    public getFromSectorName(): string | undefined {
        const sector = this.getFromSector();
        if (sector && this.hasFromSectorLoaded()) {
            return typeof sector.getName === 'function' ? sector.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get destination sector name from loaded relation
     */
    public getToSectorName(): string | undefined {
        const sector = this.getToSector();
        if (sector && this.hasToSectorLoaded()) {
            return typeof sector.getName === 'function' ? sector.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get origin entity name from loaded relation
     */
    public getFromEntityName(): string | undefined {
        const entity = this.getFromEntity();
        if (entity && this.hasFromEntityLoaded()) {
            return typeof entity.getName === 'function' ? entity.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get destination entity name from loaded relation
     */
    public getToEntityName(): string | undefined {
        const entity = this.getToEntity();
        if (entity && this.hasToEntityLoaded()) {
            return typeof entity.getName === 'function' ? entity.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Calculate jump distance in sectors
     */
    public getJumpDistance(): number {
        const dx = this.getToX() - this.getFromX();
        const dy = this.getToY() - this.getFromY();
        const dz = this.getToZ() - this.getFromZ();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Check if jump is local (same sector)
     */
    public isLocalJump(): boolean {
        return this.getFromX() === this.getToX() && 
               this.getFromY() === this.getToY() && 
               this.getFromZ() === this.getToZ();
    }

    /**
     * Check if jump goes through the origin (0,0,0)
     */
    public passesOrigin(): boolean {
        return (this.getFromX() === 0 && this.getFromY() === 0 && this.getFromZ() === 0) ||
               (this.getToX() === 0 && this.getToY() === 0 && this.getToZ() === 0);
    }

    // =============================================================================
    // TYPE AND CLASSIFICATION METHODS
    // =============================================================================

    /**
     * Get FTL type name
     */
    public getTypeName(): string {
        return FtlType[this.getType()] || `UNKNOWN_${this.getType()}`;
    }

    /**
     * Check if connection is a warp gate
     */
    public isWarpGate(): boolean {
        return this.getType() === FtlType.WARP_GATE;
    }

    /**
     * Check if connection is a wormhole
     */
    public isWormhole(): boolean {
        return this.getType() === FtlType.WORM_HOLE;
    }

    /**
     * Check if connection is a race way
     */
    public isRaceWay(): boolean {
        return this.getType() === FtlType.RACE_WAY;
    }

    /**
     * Check if connection is natural (wormhole)
     */
    public isNatural(): boolean {
        return this.isWormhole();
    }

    /**
     * Check if connection is player-built
     */
    public isPlayerBuilt(): boolean {
        return this.isWarpGate() || this.isRaceWay();
    }

    // =============================================================================
    // UID PATTERN ANALYSIS METHODS
    // =============================================================================

    /**
     * Parse Black Hole wormhole UID pattern
     * Pattern: "BH_[position x]_[position y]_[position z]_OO_[offset x]_[offset y]_[offset z]"
     */
    public parseBlackHoleUid(uid: string): {
        position: { x: number; y: number; z: number };
        offset: { x: number; y: number; z: number };
    } | null {
        const match = uid.match(/^BH_(-?\d+)_(-?\d+)_(-?\d+)_OO_(-?\d+)_(-?\d+)_(-?\d+)$/);
        if (!match) return null;

        return {
            position: {
                x: parseInt(match[1]),
                y: parseInt(match[2]),
                z: parseInt(match[3])
            },
            offset: {
                x: parseInt(match[4]),
                y: parseInt(match[5]),
                z: parseInt(match[6])
            }
        };
    }

    /**
     * Generate Black Hole UID for given coordinates
     */
    public static generateBlackHoleUid(
        position: { x: number; y: number; z: number },
        offset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
    ): string {
        return `BH_${position.x}_${position.y}_${position.z}_OO_${offset.x}_${offset.y}_${offset.z}`;
    }

    // =============================================================================
    // PERMISSION METHODS
    // =============================================================================

    /**
     * Check if permission flag is set
     */
    public hasPermission(flag: FtlPermission): boolean {
        return (this.getPermission() & flag) !== 0;
    }

    /**
     * Check if spawning is allowed
     */
    public allowsSpawning(): boolean {
        return !this.hasPermission(FtlPermission.NO_SPAWN);
    }

    /**
     * Check if attacks are allowed
     */
    public allowsAttacks(): boolean {
        return !this.hasPermission(FtlPermission.NO_ATTACK);
    }

    /**
     * Check if entry is allowed
     */
    public allowsEntry(): boolean {
        return !this.hasPermission(FtlPermission.NO_ENTER);
    }

    /**
     * Check if exit is allowed
     */
    public allowsExit(): boolean {
        return !this.hasPermission(FtlPermission.NO_EXIT);
    }

    /**
     * Check if notifications are shown
     */
    public showsIndications(): boolean {
        return !this.hasPermission(FtlPermission.NO_INDICATIONS);
    }

    /**
     * Check if faction points are lost
     */
    public causesFactionPointLoss(): boolean {
        return !this.hasPermission(FtlPermission.NO_FP_LOSS);
    }

    /**
     * Check if connection is a peace zone
     */
    public isPeaceZone(): boolean {
        return this.hasPermission(FtlPermission.NO_SPAWN) && 
               this.hasPermission(FtlPermission.NO_ATTACK);
    }

    /**
     * Check if connection is locked (no entry/exit)
     */
    public isLocked(): boolean {
        return this.hasPermission(FtlPermission.NO_ENTER) && 
               this.hasPermission(FtlPermission.NO_EXIT);
    }

    /**
     * Check if connection is fully protected
     */
    public isFullyProtected(): boolean {
        return this.hasPermission(FtlPermission.NO_SPAWN) && 
               this.hasPermission(FtlPermission.NO_ATTACK) && 
               this.hasPermission(FtlPermission.NO_FP_LOSS);
    }

    /**
     * Get permission level description
     */
    public getPermissionDescription(): string {
        const permissions: string[] = [];
        
        if (this.hasPermission(FtlPermission.NO_SPAWN)) permissions.push('No Spawning');
        if (this.hasPermission(FtlPermission.NO_ATTACK)) permissions.push('No Attacks');
        if (this.hasPermission(FtlPermission.NO_ENTER)) permissions.push('No Entry');
        if (this.hasPermission(FtlPermission.NO_EXIT)) permissions.push('No Exit');
        if (this.hasPermission(FtlPermission.NO_INDICATIONS)) permissions.push('Stealth');
        if (this.hasPermission(FtlPermission.NO_FP_LOSS)) permissions.push('No FP Loss');
        
        return permissions.length > 0 ? permissions.join(', ') : 'Normal Access';
    }

    /**
     * Set permission flag
     */
    public setPermissionFlag(flag: FtlPermission, enabled: boolean = true): this {
        let permission = this.getPermission();
        if (enabled) {
            permission |= flag;
        } else {
            permission &= ~flag;
        }
        return this.setPermission(permission);
    }

    // =============================================================================
    // ANALYSIS AND UTILITY METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Get comprehensive FTL connection summary with relationship data
     */
    public getConnectionSummary(): {
        id: number;
        type: FtlType;
        typeName: string;
        from: { 
            sector: string; 
            local: string; 
            uid: string;
            sectorName?: string;
            entityName?: string;
        };
        to: { 
            sector: string; 
            local: string; 
            uid: string;
            sectorName?: string;
            entityName?: string;
        };
        distance: number;
        permissions: string;
        isNatural: boolean;
        isPeaceZone: boolean;
        isLocked: boolean;
        relationshipStatus: {
            hasFromSectorLoaded: boolean;
            hasToSectorLoaded: boolean;
            hasFromEntityLoaded: boolean;
            hasToEntityLoaded: boolean;
            hasAllRelationsLoaded: boolean;
        };
    } {
        return {
            id: this.getId(),
            type: this.getType(),
            typeName: this.getTypeName(),
            from: {
                sector: this.getFromCoordinatesString(),
                local: this.getFromLocalCoordinatesString(),
                uid: this.getFromUid(),
                sectorName: this.getFromSectorName(),
                entityName: this.getFromEntityName()
            },
            to: {
                sector: this.getToCoordinatesString(),
                local: this.getToLocalCoordinatesString(),
                uid: this.getToUid(),
                sectorName: this.getToSectorName(),
                entityName: this.getToEntityName()
            },
            distance: this.getJumpDistance(),
            permissions: this.getPermissionDescription(),
            isNatural: this.isNatural(),
            isPeaceZone: this.isPeaceZone(),
            isLocked: this.isLocked(),
            relationshipStatus: {
                hasFromSectorLoaded: this.hasFromSectorLoaded(),
                hasToSectorLoaded: this.hasToSectorLoaded(),
                hasFromEntityLoaded: this.hasFromEntityLoaded(),
                hasToEntityLoaded: this.hasToEntityLoaded(),
                hasAllRelationsLoaded: this.hasAllRelationsLoaded()
            }
        };
    }

    /**
     * Check if connection is accessible (allows entry and exit)
     */
    public isAccessible(): boolean {
        return this.allowsEntry() && this.allowsExit();
    }

    /**
     * Check if connection is safe (peace zone or no attacks)
     */
    public isSafe(): boolean {
        return this.isPeaceZone() || !this.allowsAttacks();
    }

    /**
     * Get connection direction description with enhanced sector info
     */
    public getDirectionDescription(): string {
        const fromName = this.getFromSectorName();
        const toName = this.getToSectorName();
        
        const from = fromName ? `${fromName} ${this.getFromCoordinatesString()}` : this.getFromCoordinatesString();
        const to = toName ? `${toName} ${this.getToCoordinatesString()}` : this.getToCoordinatesString();
        
        return `${from} ? ${to}`;
    }

    /**
     * Check if connection is bidirectional (assumption based on typical usage)
     */
    public isBidirectional(): boolean {
        // Most FTL connections are bidirectional unless explicitly restricted
        return this.allowsEntry() && this.allowsExit();
    }

    /**
     * Get connection quality assessment with relationship intelligence
     */
    public getConnectionQuality(): {
        isOperational: boolean;
        quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'BLOCKED';
        issues: string[];
        features: string[];
        intelligence?: {
            fromSectorType?: string;
            toSectorType?: string;
            fromEntityType?: string;
            toEntityType?: string;
        };
    } {
        const issues: string[] = [];
        const features: string[] = [];
        
        // Check for blocking issues
        if (!this.allowsEntry()) issues.push('Entry blocked');
        if (!this.allowsExit()) issues.push('Exit blocked');
        
        // Check for positive features
        if (this.isPeaceZone()) features.push('Peace zone');
        if (!this.causesFactionPointLoss()) features.push('No faction point loss');
        if (!this.showsIndications()) features.push('Stealth transit');
        if (this.isNatural()) features.push('Natural wormhole');
        
        // Determine quality
        let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'BLOCKED';
        if (issues.length >= 2) {
            quality = 'BLOCKED';
        } else if (issues.length === 1) {
            quality = 'POOR';
        } else if (features.length >= 2) {
            quality = 'EXCELLENT';
        } else if (features.length === 1) {
            quality = 'GOOD';
        } else {
            quality = 'FAIR';
        }

        // Enhanced intelligence from loaded relations
        let intelligence: any = undefined;
        if (this.hasAllRelationsLoaded()) {
            const fromSector = this.getFromSector();
            const toSector = this.getToSector();
            const fromEntity = this.getFromEntity();
            const toEntity = this.getToEntity();

            intelligence = {
                fromSectorType: fromSector && typeof fromSector.getTypeName === 'function' ? fromSector.getTypeName() : undefined,
                toSectorType: toSector && typeof toSector.getTypeName === 'function' ? toSector.getTypeName() : undefined,
                fromEntityType: fromEntity && typeof fromEntity.getTypeName === 'function' ? fromEntity.getTypeName() : undefined,
                toEntityType: toEntity && typeof toEntity.getTypeName === 'function' ? toEntity.getTypeName() : undefined
            };
        }
        
        return {
            isOperational: quality !== 'BLOCKED',
            quality,
            issues,
            features,
            intelligence
        };
    }

    /**
     * Get route optimization analysis
     */
    public getRouteAnalysis(): {
        efficiency: 'OPTIMAL' | 'EFFICIENT' | 'STANDARD' | 'POOR' | 'WASTEFUL';
        distanceCategory: 'LOCAL' | 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTREME';
        strategicValue: number; // 0-100
        recommendations: string[];
        transitTime?: 'INSTANT' | 'FAST' | 'NORMAL' | 'SLOW';
    } {
        const distance = this.getJumpDistance();
        const recommendations: string[] = [];

        // Distance categorization
        let distanceCategory: any = 'LOCAL';
        if (distance > 100) distanceCategory = 'EXTREME';
        else if (distance > 50) distanceCategory = 'LONG';
        else if (distance > 20) distanceCategory = 'MEDIUM';
        else if (distance > 5) distanceCategory = 'SHORT';

        // Efficiency based on type and distance
        let efficiency: any = 'STANDARD';
        if (this.isNatural() && distance > 20) {
            efficiency = 'OPTIMAL';
            recommendations.push('Natural wormhole provides excellent long-distance transit');
        } else if (this.isWarpGate() && distance < 10) {
            efficiency = 'POOR';
            recommendations.push('Warp gate may be overkill for short distances');
        } else if (this.isRaceWay()) {
            efficiency = 'EFFICIENT';
            recommendations.push('Race way optimized for speed');
        }

        // Strategic value calculation
        let strategicValue = 50; // Base value
        if (this.passesOrigin()) strategicValue += 20; // Origin passage is strategic
        if (this.isSafe()) strategicValue += 15; // Safety adds value
        if (distance > 30) strategicValue += 15; // Long distance connections are valuable
        if (this.isNatural()) strategicValue += 10; // Natural connections are precious

        // Transit time estimation
        let transitTime: any = 'NORMAL';
        if (this.isRaceWay()) transitTime = 'FAST';
        else if (this.isNatural()) transitTime = 'INSTANT';
        else if (distance > 50) transitTime = 'SLOW';

        return {
            efficiency,
            distanceCategory,
            strategicValue: Math.min(100, strategicValue),
            recommendations,
            transitTime
        };
    }
}