/**
 * @fileoverview Systems Model
 * 
 * Model for the SYSTEMS table representing star systems within the galaxy grid.
 * Each system serves as a container for multiple sectors and defines the large-scale structure of the game universe.
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
// CONSTANTS
// =============================================================================

/**
 * Maximum size for INFOS binary data as per StarMade database specification
 */
export const MAX_INFOS_SIZE = 8192;

/**
 * Maximum size for RESOURCES binary data as per StarMade database specification.
 * Source: VoidSystem.RESOURCES = 19 (confirmed from VoidSystem.java).
 */
export const MAX_RESOURCES_SIZE = 19;

/**
 * Number of resource types tracked in RESOURCES field.
 * Source: VoidSystem.RESOURCES = 19.
 */
export const RESOURCE_COUNT = 19;

// =============================================================================
// SYSTEMS ENUMS AND TYPES
// =============================================================================

/**
 * System types as defined in TABLE_SYSTEMS.md
 */
export enum SystemType {
    SUN = 0,         // Regular star system - Standard stellar configuration (Common)
    GIANT = 1,       // Giant star system - Massive stellar body (Uncommon)
    BLACK_HOLE = 2,  // Black hole system - Gravitational anomaly (Rare)
    DOUBLE_STAR = 3, // Binary star system - Dual star configuration (Uncommon)
    VOID = 4         // Void system - Empty space, no star (Most common)
}

/**
 * Known NPC faction IDs as documented
 */
export enum KnownSystemFactions {
    NEUTRAL = 0,           // No faction (neutral)
    TRADING_GUILD = -10000000,  // NPC Trading Guild
    OUTCASTS = -9999999,   // NPC Outcasts (hostile)
    SCAVENGERS = -9999998  // NPC Scavengers
}

// =============================================================================
// SYSTEMS MODEL
// =============================================================================

/**
 * Model for the SYSTEMS table
 * 
 * Represents star systems within the galaxy grid. Each system serves as a container
 * for multiple sectors and manages territorial control, resource distribution,
 * and the fundamental organization of space.
 */
export class SystemsModel extends BaseModel {
    public static tableName = 'SYSTEMS';
    
    public static schema: TableSchema = {
        tableName: 'SYSTEMS',
        comment: 'Star systems within the galaxy grid',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'System identifier'
            }),
            column('X', DataType.INTEGER, {
                nullable: false,
                comment: 'System grid X coordinate'
            }),
            column('Y', DataType.INTEGER, {
                nullable: false,
                comment: 'System grid Y coordinate'
            }),
            column('Z', DataType.INTEGER, {
                nullable: false,
                comment: 'System grid Z coordinate'
            }),
            column('TYPE', DataType.INTEGER, {
                nullable: false,
                comment: 'System classification'
            }),
            column('STARTTIME', DataType.BIGINT, {
                nullable: true,
                comment: 'Generation timestamp'
            }),
            column('NAME', DataType.VARCHAR, {
                length: 64,
                nullable: true,
                comment: 'System name'
            }),
            column('INFOS', DataType.BLOB, {
                nullable: false,
                comment: 'Additional system data (VARBINARY 8192 bytes max)'
            }),
            column('OWNER_UID', DataType.VARCHAR, {
                length: 128,
                nullable: true,
                comment: 'Controlling entity UID'
            }),
            column('OWNER_FACTION', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Controlling faction'
            }),
            column('OWNER_X', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Owner home X coordinate'
            }),
            column('OWNER_Y', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Owner home Y coordinate'
            }),
            column('OWNER_Z', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Owner home Z coordinate'
            }),
            column('RESOURCES', DataType.BLOB, {
                nullable: false,
                comment: 'Resource richness distribution (VARBINARY 16 bytes)'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('sysCoordIndex', ['X', 'Y', 'Z'], { unique: true }),
            index('sysOwnFacIndex', ['OWNER_FACTION']),
            index('sysOwnUIDIndex', ['OWNER_UID'])
        ],

        validationRules: [
            validation('TYPE', 'required'),
            validation('TYPE', 'custom', {
                validator: (type: number) => {
                    const validTypes = Object.values(SystemType).filter(v => typeof v === 'number');
                    return validTypes.includes(type) || `Invalid system type: ${type}`;
                },
                message: 'Invalid system type'
            }),
            validation('NAME', 'maxLength', {
                value: 64,
                message: 'Name cannot exceed 64 characters'
            }),
            validation('OWNER_UID', 'maxLength', {
                value: 128,
                message: 'Owner UID cannot exceed 128 characters'
            }),
            validation('OWNER_FACTION', 'required'),
            validation('INFOS', 'required'),
            validation('INFOS', 'custom', {
                validator: (value: Buffer) => {
                    if (!Buffer.isBuffer(value)) {
                        return 'INFOS must be a Buffer';
                    }
                    if (value.length > MAX_INFOS_SIZE) {
                        return `INFOS cannot exceed ${MAX_INFOS_SIZE} bytes`;
                    }
                    return true;
                },
                message: 'Invalid INFOS data'
            }),
            validation('RESOURCES', 'required'),
            validation('RESOURCES', 'custom', {
                validator: (value: Buffer) => {
                    if (!Buffer.isBuffer(value)) {
                        return 'RESOURCES must be a Buffer';
                    }
                    if (value.length > MAX_RESOURCES_SIZE) {
                        return `RESOURCES cannot exceed ${MAX_RESOURCES_SIZE} bytes`;
                    }
                    return true;
                },
                message: 'Invalid RESOURCES data'
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
            /** Sectors belonging to this system (SECTORS.STELLAR -> SYSTEMS.ID) */
            sectors: relation(
                Model.HasManyRelation,
                () => {
                    // Lazy import to avoid circular dependencies
                    return require('../sectors/SectorsModel.js').SectorsModel;
                },
                {
                    from: 'SYSTEMS.ID',
                    to: 'SECTORS.STELLAR'
                }
            ),

            /** Owner entity that controls this system (SYSTEMS.OWNER_UID -> ENTITIES.UID) */
            ownerEntity: relation(
                Model.BelongsToOneRelation,
                () => {
                    // Lazy import to avoid circular dependencies
                    return require('../entities/EntitiesModel.js').EntitiesModel;
                },
                {
                    from: 'SYSTEMS.OWNER_UID',
                    to: 'ENTITIES.UID'
                },
                {
                    // Filter to only include when OWNER_UID is not null/empty
                    filter: {
                        'SYSTEMS.OWNER_UID': { '!=': null }
                    }
                }
            ),

            /** Owner home sector (SYSTEMS.OWNER_X/Y/Z -> SECTORS.X/Y/Z) */
            ownerHomeSector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../sectors/SectorsModel.js').SectorsModel;
                },
                {
                    from: ['SYSTEMS.OWNER_X', 'SYSTEMS.OWNER_Y', 'SYSTEMS.OWNER_Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                },
                {
                    // Only when owner coordinates are not default (0,0,0)
                    // This ensures we don't load "null" relationships for unowned systems
                    filter: {
                        $or: [
                            { 'SYSTEMS.OWNER_X': { '!=': 0 } },
                            { 'SYSTEMS.OWNER_Y': { '!=': 0 } },
                            { 'SYSTEMS.OWNER_Z': { '!=': 0 } }
                        ]
                    }
                }
            ),

            /** NPC statistics for this system (SYSTEMS.X/Y/Z -> NPC_STATS.SYS_X/SYS_Y/SYS_Z) */
            NPCStats: relation(
                Model.HasManyRelation,
                () => {
                    // Lazy import to avoid circular dependencies
                    return require('../NPC-stats/NPCStatsModel.js').NPCStatsModel;
                },
                {
                    from: ['SYSTEMS.X', 'SYSTEMS.Y', 'SYSTEMS.Z'],
                    to: ['NPC_STATS.SYS_X', 'NPC_STATS.SYS_Y', 'NPC_STATS.SYS_Z']
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getX(): number { return this.get('X'); }
    public setX(x: number): this { return this.set('X', x); }

    public getY(): number { return this.get('Y'); }
    public setY(y: number): this { return this.set('Y', y); }

    public getZ(): number { return this.get('Z'); }
    public setZ(z: number): this { return this.set('Z', z); }

    public getType(): SystemType { return this.get('TYPE'); }
    public setType(type: SystemType): this { return this.set('TYPE', type); }

    public getStarttime(): number | undefined { return this.get('STARTTIME'); }
    public setStarttime(starttime: number | undefined): this { return this.set('STARTTIME', starttime); }

    public getName(): string | undefined { return this.get('NAME'); }
    public setName(name: string | undefined): this { return this.set('NAME', name); }

    public getInfos(): Buffer { return this.get('INFOS'); }
    public setInfos(infos: Buffer): this { return this.set('INFOS', infos); }

    public getOwnerUid(): string | undefined { return this.get('OWNER_UID'); }
    public setOwnerUid(ownerUid: string | undefined): this { return this.set('OWNER_UID', ownerUid); }

    public getOwnerFaction(): number { return this.get('OWNER_FACTION'); }
    public setOwnerFaction(ownerFaction: number): this { return this.set('OWNER_FACTION', ownerFaction); }

    public getOwnerX(): number { return this.get('OWNER_X'); }
    public setOwnerX(ownerX: number): this { return this.set('OWNER_X', ownerX); }

    public getOwnerY(): number { return this.get('OWNER_Y'); }
    public setOwnerY(ownerY: number): this { return this.set('OWNER_Y', ownerY); }

    public getOwnerZ(): number { return this.get('OWNER_Z'); }
    public setOwnerZ(ownerZ: number): this { return this.set('OWNER_Z', ownerZ); }

    public getResources(): Buffer { return this.get('RESOURCES'); }
    public setResources(resources: Buffer): this { return this.set('RESOURCES', resources); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /**
     * Get sectors belonging to this system
     */
    public getSectors(): any[] | undefined {
        return this.getRelated<any[]>('sectors');
    }

    /**
     * Set sectors belonging to this system
     */
    public setSectors(sectors: any[] | undefined): this {
        return this.setRelated('sectors', sectors);
    }

    /**
     * Get the owner entity that controls this system
     */
    public getOwnerEntity(): any | undefined {
        return this.getRelated<any>('ownerEntity');
    }

    /**
     * Set the owner entity that controls this system
     */
    public setOwnerEntity(entity: any | undefined): this {
        return this.setRelated('ownerEntity', entity);
    }

    /**
     * Get the owner's home sector
     */
    public getOwnerHomeSector(): any | undefined {
        return this.getRelated<any>('ownerHomeSector');
    }

    /**
     * Set the owner's home sector
     */
    public setOwnerHomeSector(sector: any | undefined): this {
        return this.setRelated('ownerHomeSector', sector);
    }

    /**
     * Get NPC statistics for this system
     */
    public getNPCStats(): any[] | undefined {
        return this.getRelated<any[]>('NPCStats');
    }

    /**
     * Set NPC statistics for this system
     */
    public setNPCStats(stats: any[] | undefined): this {
        return this.setRelated('NPCStats', stats);
    }

    /**
     * Check if this system has an owner entity relation that can be loaded
     */
    public canLoadOwnerEntity(): boolean {
        const ownerUid = this.getOwnerUid();
        return ownerUid !== null && ownerUid !== undefined && ownerUid.trim() !== '';
    }

    /**
     * Check if this system has an owner home sector relation that can be loaded
     */
    public canLoadOwnerHomeSector(): boolean {
        const ownerX = this.getOwnerX();
        const ownerY = this.getOwnerY();
        const ownerZ = this.getOwnerZ();
        
        // Owner home sector is valid if at least one coordinate is not 0
        return ownerX !== 0 || ownerY !== 0 || ownerZ !== 0;
    }

    /**
     * Check if owner entity relation is loaded
     */
    public hasOwnerEntityLoaded(): boolean {
        return this.hasRelated('ownerEntity') && this.canLoadOwnerEntity();
    }

    /**
     * Check if owner home sector relation is loaded
     */
    public hasOwnerHomeSectorLoaded(): boolean {
        return this.hasRelated('ownerHomeSector') && this.canLoadOwnerHomeSector();
    }

    /**
     * Check if NPC statistics are loaded for this system
     */
    public hasNPCStatsLoaded(): boolean {
        return this.hasRelated('NPCStats');
    }

    /**
     * Get count of NPC statistics entries for this system
     */
    public getNPCStatsCount(): number {
        const stats = this.getNPCStats();
        return stats ? stats.length : 0;
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS
    // =============================================================================

    /**
     * Get coordinates as a formatted string
     */
    public getCoordinatesString(): string {
        return `(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
    }

    /**
     * Get system type name
     */
    public getTypeName(): string {
        return SystemType[this.getType()] || `UNKNOWN_${this.getType()}`;
    }

    /**
     * Check if system is owned (has non-empty OWNER_UID)
     */
    public isOwned(): boolean {
        const ownerUid = this.getOwnerUid();
        return ownerUid !== null && ownerUid !== undefined && ownerUid.trim() !== '';
    }

    /**
     * Check if system is player owned (owned but not NPC)
     */
    public isPlayerOwned(): boolean {
        if (!this.isOwned()) return false;
        
        const ownerUid = this.getOwnerUid()!;
        return !ownerUid.startsWith('NPC-');
    }

    /**
     * Check if system is NPC owned (starts with NPC-)
     */
    public isNPCOwned(): boolean {
        if (!this.isOwned()) return false;
        
        const ownerUid = this.getOwnerUid()!;
        return ownerUid.startsWith('NPC-');
    }

    /**
     * Get owner coordinates as string
     */
    public getOwnerCoordinatesString(): string {
        return `(${this.getOwnerX()}, ${this.getOwnerY()}, ${this.getOwnerZ()})`;
    }

    /**
     * Calculate distance from another system
     */
    public distanceFrom(other: SystemsModel): number {
        const dx = this.getX() - other.getX();
        const dy = this.getY() - other.getY();
        const dz = this.getZ() - other.getZ();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Check if system is adjacent to another (Manhattan distance = 1)
     */
    public isAdjacentTo(other: SystemsModel): boolean {
        const dx = Math.abs(this.getX() - other.getX());
        const dy = Math.abs(this.getY() - other.getY());
        const dz = Math.abs(this.getZ() - other.getZ());
        
        return (dx + dy + dz) === 1;
    }

    /**
     * Get display name (uses NAME if available, otherwise generates from type and coordinates)
     */
    public getDisplayName(): string {
        const name = this.getName();
        if (name && name.trim() !== '' && name !== 'default') {
            return name;
        }
        
        const typeName = this.getTypeName();
        const coords = this.getCoordinatesString();
        return `${typeName} ${coords}`;
    }

    /**
     * Get known faction name based on OWNER_FACTION value
     */
    public getFactionName(): string {
        const faction = this.getOwnerFaction();
        
        switch (faction) {
            case KnownSystemFactions.NEUTRAL:
                return 'Neutral';
            case KnownSystemFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownSystemFactions.OUTCASTS:
                return 'Outcasts';
            case KnownSystemFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return faction > 0 ? `Player Faction ${faction}` : `Faction ${faction}`;
        }
    }

    /**
     * Check if INFOS data size is valid
     */
    public validateInfosSize(): boolean {
        const infos = this.getInfos();
        return infos && infos.length <= MAX_INFOS_SIZE;
    }

    /**
     * Check if RESOURCES data size is valid
     */
    public validateResourcesSize(): boolean {
        const resources = this.getResources();
        return resources && resources.length <= MAX_RESOURCES_SIZE;
    }

    /**
     * Get system summary information
     */
    public getSystemSummary(): {
        id: number;
        coordinates: string;
        type: SystemType;
        typeName: string;
        name: string | undefined;
        displayName: string;
        ownerUid: string | undefined;
        ownerFaction: number;
        factionName: string;
        ownerCoordinates: string;
        isOwned: boolean;
        isPlayerOwned: boolean;
        isNPCOwned: boolean;
        starttime: number | undefined;
        infosSize: number;
        resourcesSize: number;
    } {
        return {
            id: this.getId(),
            coordinates: this.getCoordinatesString(),
            type: this.getType(),
            typeName: this.getTypeName(),
            name: this.getName(),
            displayName: this.getDisplayName(),
            ownerUid: this.getOwnerUid(),
            ownerFaction: this.getOwnerFaction(),
            factionName: this.getFactionName(),
            ownerCoordinates: this.getOwnerCoordinatesString(),
            isOwned: this.isOwned(),
            isPlayerOwned: this.isPlayerOwned(),
            isNPCOwned: this.isNPCOwned(),
            starttime: this.getStarttime(),
            infosSize: this.getInfos()?.length || 0,
            resourcesSize: this.getResources()?.length || 0
        };
    }

    // =============================================================================
    // STARMADE-DECODER INTEGRATION
    // =============================================================================

    /**
     * Decodes SYSTEMS.INFOS + SYSTEMS.RESOURCES into a typed StarSystem object.
     *
     * INFOS: 16³ × 2-byte grid of sector types and metadata (SectorType enum +
     * PlanetType for planet sectors). RESOURCES: 19-byte resource density array
     * indexed by ElementKeyMap.resources.
     *
     * Returns null when INFOS is null or undersized (< 8192 bytes).
     *
     * @example
     * const sys = system.decodeStarSystem();
     * if (sys) {
     *   console.log(sys.toString());          // StarSystem(sun=1, planets=3, ...)
     *   console.log(sys.planets);             // SectorInfo[] for all planet sectors
     *   console.log(sys.presentResources);    // SystemResource[] with density > 0
     *   sys.withResourceDensity(0, 80)        // immutable mutation
     *     .resourcesToBytes();                // re-encoded for DB write-back
     * }
     */
    public decodeStarSystem(): import('starmade-decoder').StarSystem | null {
        const infos = this.getInfos();
        const resources = this.getResources();
        const { StarSystem } = require('starmade-decoder');
        return StarSystem.fromBytes(infos ?? null, resources ?? null);
    }

    /**
     * Decodes only SYSTEMS.RESOURCES into a typed array of SystemResource.
     *
     * Convenience shortcut when sector grid data is not needed.
     * Returns resources with density > 0 by default.
     *
     * @example
     * const res = system.decodeResources();
     * res.forEach(r => console.log(r.name, r.density)); // 'Hattel Crystal', 80
     */
    public decodeResources(): import('starmade-decoder').SystemResource[] {
        const raw = this.getResources();
        if (!raw) return [];
        const { decodeSystemResources } = require('starmade-decoder');
        return decodeSystemResources(raw);
    }
}