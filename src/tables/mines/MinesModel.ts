import * as related0 from '../players/PlayersModel.js';
import * as related1 from '../sectors/SectorsModel.js';
/**
 * @fileoverview Mines Model
 * 
 * Model for the MINES table storing deployable explosive devices.
 * Provides tactical warfare management without assuming unknown block IDs or compositions.
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
// MINES ENUMS AND TYPES
// =============================================================================

/**
 * Mine arming states based on ARMED and ARMED_IN_SECS values
 */
export enum MineArmingState {
    /** Mine arming state value for disarmed, serialized as 'DISARMED'. */
    DISARMED = 'DISARMED',     // ARMED=false, ARMED_IN_SECS=-1
    /** Mine arming state value for arming, serialized as 'ARMING'. */
    ARMING = 'ARMING',         // ARMED=false, ARMED_IN_SECS>0
    /** Mine arming state value for armed, serialized as 'ARMED'. */
    ARMED = 'ARMED',           // ARMED=true
    /** Mine arming state value for depleted, serialized as 'DEPLETED'. */
    DEPLETED = 'DEPLETED'      // AMMO=0 (but not -2)
}

/**
 * Mine operational status based on HP and AMMO
 */
export enum MineStatus {
    /** Mine status value for active, serialized as 'ACTIVE'. */
    ACTIVE = 'ACTIVE',         // HP > 0 and AMMO != 0
    /** Mine status value for destroyed, serialized as 'DESTROYED'. */
    DESTROYED = 'DESTROYED',   // HP <= 0
    /** Mine status value for expired, serialized as 'EXPIRED'. */
    EXPIRED = 'EXPIRED',       // AMMO = 0 (but not unlimited -2)
    /** Mine status value for disabled, serialized as 'DISABLED'. */
    DISABLED = 'DISABLED'      // Manually disabled or inactive
}

/**
 * Known faction IDs for mines (from EXEMPLE_MINES.md patterns)
 */
export const KnownMineFactions = {
    NO_FACTION: 0,
    TRADING_GUILD: -10000000,
    OUTCASTS: -9999999,
    SCAVENGERS: -9999998,
    PIRATES: -9999997
} as const;

/**
 * Mine component module types (slots 0-5 according to TABLE_MINES.md)
 */
export enum MineModuleType {
    /** Mine module type value for core block, serialized as 'CORE_BLOCK'. */
    CORE_BLOCK = 'CORE_BLOCK',         // Slot 0: Mine type determination
    /** Mine module type value for strength module, serialized as 'STRENGTH_MODULE'. */
    STRENGTH_MODULE = 'STRENGTH_MODULE', // Slot 1: Damage scaling
    /** Mine module type value for radius module, serialized as 'RADIUS_MODULE'. */
    RADIUS_MODULE = 'RADIUS_MODULE',     // Slot 2: Trigger range
    /** Mine module type value for stealth module, serialized as 'STEALTH_MODULE'. */
    STEALTH_MODULE = 'STEALTH_MODULE',   // Slot 3: Jamming level
    /** Mine module type value for firing module, serialized as 'FIRING_MODULE'. */
    FIRING_MODULE = 'FIRING_MODULE',     // Slot 4: Burst/seeker/contact
    /** Mine module type value for reserved, serialized as 'RESERVED'. */
    RESERVED = 'RESERVED'                // Slot 5: Future expansion
}

/**
 * Mine composition structure (6-slot array according to TABLE_MINES.md)
 */
export interface MineComposition {
    /** Slot 0: Core type (unknown block IDs). */
    coreBlock: number;
    /** Slot 1: Damage scaling. */
    strengthModule: number;
    /** Slot 2: Trigger range in meters. */
    radiusModule: number;
    /** Slot 3: Jamming/stealth level. */
    stealthModule: number;
    /** Slot 4: Burst/seeker/contact behavior. */
    firingModule: number;
    /** Slot 5: Future expansion (unused). */
    reserved: number;
}

// =============================================================================
// MINES MODEL
// =============================================================================

/**
 * Model for the MINES table - Enhanced Edition with Relations
 * 
 * Advanced mine management with complete bidirectional relationships,
 * tactical analytics, and comprehensive safety assessments.
 */
export class MinesModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'MINES';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'MINES',
        comment: 'Deployable explosive devices for tactical warfare',
        
        columns: [
            column('ID', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'Mine identifier'
            }),
            column('OWNER', DataType.BIGINT, {
                nullable: false,
                comment: 'Deploying player ID'
            }),
            column('FACTION', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: "Owner's faction"
            }),
            column('HP', DataType.INTEGER, {
                nullable: false,
                comment: 'Mine durability'
            }),
            column('COMPOSITION', DataType.TEXT, {
                nullable: false,
                comment: 'Component materials (6-element array)'
            }),
            column('SECTOR_X', DataType.INTEGER, {
                nullable: false,
                comment: 'Deployment sector X'
            }),
            column('SECTOR_Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Deployment sector Y'
            }),
            column('SECTOR_Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Deployment sector Z'
            }),
            column('LOCAL_X', DataType.DOUBLE, {
                nullable: false,
                comment: 'Local X coordinate'
            }),
            column('LOCAL_Y', DataType.DOUBLE, {
                nullable: false,
                comment: 'Local Y coordinate'
            }),
            column('LOCAL_Z', DataType.DOUBLE, {
                nullable: false,
                comment: 'Local Z coordinate'
            }),
            column('CREATION_DATE', DataType.BIGINT, {
                nullable: false,
                comment: 'Deployment timestamp'
            }),
            column('ARMED', DataType.BOOLEAN, {
                nullable: false,
                defaultValue: false,
                comment: 'Activation status'
            }),
            column('ARMED_IN_SECS', DataType.INTEGER, {
                nullable: false,
                defaultValue: -1,
                comment: 'Arming countdown'
            }),
            column('AMMO', DataType.INTEGER, {
                nullable: false,
                defaultValue: -2,
                comment: 'Remaining triggers'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('IN_OWNER', ['OWNER']),
            index('IN_FACTION', ['FACTION']),
            index('IN_SECTOR', ['SECTOR_X', 'SECTOR_Y', 'SECTOR_Z']),
            index('IN_CREATION', ['CREATION_DATE']),
            index('IN_ARMED', ['ARMED']),
            index('IN_ARMED_OWNER', ['ARMED', 'OWNER']),
            index('IN_ARMED_OWNER_SEC', ['OWNER', 'SECTOR_X', 'SECTOR_Y', 'SECTOR_Z', 'ARMED'])
        ],

        validationRules: [
            validation('OWNER', 'required'),
            validation('FACTION', 'required'),
            validation('HP', 'required'),
            validation('HP', 'min', {
                value: 0,
                message: 'HP cannot be negative'
            }),
            validation('COMPOSITION', 'required'),
            validation('SECTOR_X', 'required'),
            validation('SECTOR_Y', 'required'),
            validation('SECTOR_Z', 'required'),
            validation('LOCAL_X', 'required'),
            validation('LOCAL_Y', 'required'),
            validation('LOCAL_Z', 'required'),
            validation('CREATION_DATE', 'required'),
            validation('ARMED', 'required'),
            validation('ARMED_IN_SECS', 'required'),
            validation('AMMO', 'required'),
            validation('AMMO', 'custom', {
                validator: (ammo: number) => {
                    if (ammo < -2) {
                        return 'Invalid ammo value (must be >= -2)';
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
            /** Player who owns this mine (MINES.OWNER -> PLAYERS.ID) */
            ownerPlayer: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.PlayersModel;
                },
                {
                    from: 'MINES.OWNER',
                    to: 'PLAYERS.ID'
                }
            ),

            /** Sector where this mine is deployed (MINES.SECTOR_X/Y/Z -> SECTORS.X/Y/Z) */
            sector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related1.SectorsModel;
                },
                {
                    from: ['MINES.SECTOR_X', 'MINES.SECTOR_Y', 'MINES.SECTOR_Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the MINES.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the MINES.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the MINES.OWNER column from this model.
     * @returns The stored OWNER value.
     */
    public getOwner(): number { return this.get('OWNER'); }
    /**
     * Store the MINES.OWNER column in this model and return this for chaining.
     * @param owner New value for the OWNER column.
     * @returns This model for chaining.
     */
    public setOwner(owner: number): this { return this.set('OWNER', owner); }

    /**
     * Read the MINES.FACTION column from this model.
     * @returns The stored FACTION value.
     */
    public getFaction(): number { return this.get('FACTION'); }
    /**
     * Store the MINES.FACTION column in this model and return this for chaining.
     * @param faction New value for the FACTION column.
     * @returns This model for chaining.
     */
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    /**
     * Read the MINES.HP column from this model.
     * @returns The stored HP value.
     */
    public getHp(): number { return this.get('HP'); }
    /**
     * Store the MINES.HP column in this model and return this for chaining.
     * @param hp New value for the HP column.
     * @returns This model for chaining.
     */
    public setHp(hp: number): this { return this.set('HP', hp); }

    /**
     * Read the MINES.COMPOSITION column from this model.
     * @returns The stored COMPOSITION value.
     */
    public getComposition(): string { return this.get('COMPOSITION'); }
    /**
     * Store the MINES.COMPOSITION column in this model and return this for chaining.
     * @param composition New value for the COMPOSITION column.
     * @returns This model for chaining.
     */
    public setComposition(composition: string): this { return this.set('COMPOSITION', composition); }

    /**
     * Read the MINES.SECTOR_X column from this model.
     * @returns The stored SECTOR_X value.
     */
    public getSectorX(): number { return this.get('SECTOR_X'); }
    /**
     * Store the MINES.SECTOR_X column in this model and return this for chaining.
     * @param sectorX New value for the SECTOR_X column.
     * @returns This model for chaining.
     */
    public setSectorX(sectorX: number): this { return this.set('SECTOR_X', sectorX); }

    /**
     * Read the MINES.SECTOR_Y column from this model.
     * @returns The stored SECTOR_Y value.
     */
    public getSectorY(): number { return this.get('SECTOR_Y'); }
    /**
     * Store the MINES.SECTOR_Y column in this model and return this for chaining.
     * @param sectorY New value for the SECTOR_Y column.
     * @returns This model for chaining.
     */
    public setSectorY(sectorY: number): this { return this.set('SECTOR_Y', sectorY); }

    /**
     * Read the MINES.SECTOR_Z column from this model.
     * @returns The stored SECTOR_Z value.
     */
    public getSectorZ(): number { return this.get('SECTOR_Z'); }
    /**
     * Store the MINES.SECTOR_Z column in this model and return this for chaining.
     * @param sectorZ New value for the SECTOR_Z column.
     * @returns This model for chaining.
     */
    public setSectorZ(sectorZ: number): this { return this.set('SECTOR_Z', sectorZ); }

    /**
     * Read the MINES.LOCAL_X column from this model.
     * @returns The stored LOCAL_X value.
     */
    public getLocalX(): number { return this.get('LOCAL_X'); }
    /**
     * Store the MINES.LOCAL_X column in this model and return this for chaining.
     * @param localX New value for the LOCAL_X column.
     * @returns This model for chaining.
     */
    public setLocalX(localX: number): this { return this.set('LOCAL_X', localX); }

    /**
     * Read the MINES.LOCAL_Y column from this model.
     * @returns The stored LOCAL_Y value.
     */
    public getLocalY(): number { return this.get('LOCAL_Y'); }
    /**
     * Store the MINES.LOCAL_Y column in this model and return this for chaining.
     * @param localY New value for the LOCAL_Y column.
     * @returns This model for chaining.
     */
    public setLocalY(localY: number): this { return this.set('LOCAL_Y', localY); }

    /**
     * Read the MINES.LOCAL_Z column from this model.
     * @returns The stored LOCAL_Z value.
     */
    public getLocalZ(): number { return this.get('LOCAL_Z'); }
    /**
     * Store the MINES.LOCAL_Z column in this model and return this for chaining.
     * @param localZ New value for the LOCAL_Z column.
     * @returns This model for chaining.
     */
    public setLocalZ(localZ: number): this { return this.set('LOCAL_Z', localZ); }

    /**
     * Read the MINES.CREATION_DATE column from this model.
     * @returns The stored CREATION_DATE value.
     */
    public getCreationDate(): number { return this.get('CREATION_DATE'); }
    /**
     * Store the MINES.CREATION_DATE column in this model and return this for chaining.
     * @param creationDate New value for the CREATION_DATE column.
     * @returns This model for chaining.
     */
    public setCreationDate(creationDate: number): this { return this.set('CREATION_DATE', creationDate); }

    /**
     * Read the MINES.ARMED column from this model.
     * @returns The stored ARMED value.
     */
    public getArmed(): boolean { return this.get('ARMED'); }
    /**
     * Store the MINES.ARMED column in this model and return this for chaining.
     * @param armed New value for the ARMED column.
     * @returns This model for chaining.
     */
    public setArmed(armed: boolean): this { return this.set('ARMED', armed); }

    /**
     * Read the MINES.ARMED_IN_SECS column from this model.
     * @returns The stored ARMED_IN_SECS value.
     */
    public getArmedInSecs(): number { return this.get('ARMED_IN_SECS'); }
    /**
     * Store the MINES.ARMED_IN_SECS column in this model and return this for chaining.
     * @param armedInSecs New value for the ARMED_IN_SECS column.
     * @returns This model for chaining.
     */
    public setArmedInSecs(armedInSecs: number): this { return this.set('ARMED_IN_SECS', armedInSecs); }

    /**
     * Read the MINES.AMMO column from this model.
     * @returns The stored AMMO value.
     */
    public getAmmo(): number { return this.get('AMMO'); }
    /**
     * Store the MINES.AMMO column in this model and return this for chaining.
     * @param ammo New value for the AMMO column.
     * @returns This model for chaining.
     */
    public setAmmo(ammo: number): this { return this.set('AMMO', ammo); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the player who owns this mine */
    public getOwnerPlayer(): any | undefined {
        return this.getRelated<any>('ownerPlayer');
    }

    /** Set the player who owns this mine */
    public setOwnerPlayer(player: any | undefined): this {
        return this.setRelated('ownerPlayer', player);
    }

    /** Get the sector where this mine is deployed */
    public getSector(): any | undefined {
        return this.getRelated<any>('sector');
    }

    /** Set the sector where this mine is deployed */
    public setSector(sector: any | undefined): this {
        return this.setRelated('sector', sector);
    }

    /** Check if owner player relation is loaded */
    public hasOwnerPlayerLoaded(): boolean {
        return this.hasRelated('ownerPlayer');
    }

    /** Check if sector relation is loaded */
    public hasSectorLoaded(): boolean {
        return this.hasRelated('sector');
    }

    /** Check if all relations are loaded */
    public hasAllRelationsLoaded(): boolean {
        return this.hasOwnerPlayerLoaded() && this.hasSectorLoaded();
    }

    // =============================================================================
    // COORDINATE METHODS
    // =============================================================================

    /**
     * Get sector coordinates as formatted string
     */
    public getSectorCoordinatesString(): string {
        return `(${this.getSectorX()}, ${this.getSectorY()}, ${this.getSectorZ()})`;
    }

    /**
     * Get local coordinates as formatted string
     */
    public getLocalCoordinatesString(): string {
        return `(${this.getLocalX().toFixed(2)}, ${this.getLocalY().toFixed(2)}, ${this.getLocalZ().toFixed(2)})`;
    }

    /**
     * Get full position description
     */
    public getPositionDescription(): string {
        return `Sector ${this.getSectorCoordinatesString()} Local ${this.getLocalCoordinatesString()}`;
    }

    /**
     * Calculate distance from given coordinates
     */
    public getDistanceFrom(x: number, y: number, z: number): number {
        const dx = this.getLocalX() - x;
        const dy = this.getLocalY() - y;
        const dz = this.getLocalZ() - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // =============================================================================
    // COMPOSITION ANALYSIS METHODS
    // =============================================================================

    /**
     * Read the six signed SMALLINT composition values from JDBC ARRAY text,
     * JSON text, or a native array. Malformed and out-of-range values return null.
     * @returns Named composition slots, or null when the SQL array is invalid.
     */
    public parseComposition(): MineComposition | null {
        try {
            const raw = this.getComposition();
            const compositionData = typeof raw === 'string'
                ? JSON.parse(raw.trim().replace(/^ARRAY\s*/i, ''))
                : raw;
            if (!Array.isArray(compositionData) || compositionData.length !== 6 ||
                !compositionData.every(value => Number.isInteger(value) && value >= -32768 && value <= 32767)) {
                return null;
            }
            return {
                coreBlock: compositionData[0],
                strengthModule: compositionData[1],
                radiusModule: compositionData[2],
                stealthModule: compositionData[3],
                firingModule: compositionData[4],
                reserved: compositionData[5]
            };
        } catch {
            return null;
        }
    }

    /**
     * Set composition from structured data
     */
    public setCompositionData(composition: MineComposition): this {
        const compositionArray = [
            composition.coreBlock,
            composition.strengthModule,
            composition.radiusModule,
            composition.stealthModule,
            composition.firingModule,
            composition.reserved
        ];
        return this.setComposition(JSON.stringify(compositionArray));
    }

    /**
     * Get raw composition values (without interpretation)
     */
    public getCompositionValues(): number[] {
        const composition = this.parseComposition();
        if (!composition) return [0, 0, 0, 0, 0, 0];
        
        return [
            composition.coreBlock,
            composition.strengthModule,
            composition.radiusModule,
            composition.stealthModule,
            composition.firingModule,
            composition.reserved
        ];
    }

    /**
     * Check if composition data is valid
     */
    public hasValidComposition(): boolean {
        return this.parseComposition() !== null;
    }

    // =============================================================================
    // ARMING AND STATUS METHODS
    // =============================================================================

    /**
     * Get current arming state based on ARMED and ARMED_IN_SECS
     */
    public getArmingState(): MineArmingState {
        if (!this.getArmed()) {
            if (this.getArmedInSecs() > 0) {
                return MineArmingState.ARMING;
            }
            return MineArmingState.DISARMED;
        }

        if (this.getAmmo() === 0) {
            return MineArmingState.DEPLETED;
        }

        return MineArmingState.ARMED;
    }

    /**
     * Get mine operational status based on HP and AMMO
     */
    public getMineStatus(): MineStatus {
        if (this.getHp() <= 0) {
            return MineStatus.DESTROYED;
        }

        if (this.getAmmo() === 0) {
            return MineStatus.EXPIRED;
        }

        return MineStatus.ACTIVE;
    }

    /**
     * Check if mine is active and operational
     */
    public isActive(): boolean {
        return this.getHp() > 0 && this.getAmmo() !== 0;
    }

    /**
     * Check if mine is armed and dangerous
     */
    public isArmedAndDangerous(): boolean {
        return this.getArmed() && this.isActive();
    }

    /**
     * Check if mine is currently arming
     */
    public isArming(): boolean {
        return !this.getArmed() && this.getArmedInSecs() > 0;
    }

    /**
     * Check if mine has ammunition
     */
    public hasAmmo(): boolean {
        const ammo = this.getAmmo();
        return ammo > 0 || ammo === -2; // -2 indicates unlimited ammo
    }

    /**
     * Check if mine has unlimited ammo
     */
    public hasUnlimitedAmmo(): boolean {
        return this.getAmmo() === -2;
    }

    /**
     * Get remaining ammo count (or 'unlimited')
     */
    public getRemainingAmmo(): number | 'unlimited' {
        const ammo = this.getAmmo();
        return ammo === -2 ? 'unlimited' : ammo;
    }

    /**
     * Check if mine can be safely handled
     */
    public isSafeToHandle(): boolean {
        return !this.getArmed() && this.getArmedInSecs() <= 0;
    }

    // =============================================================================
    // FACTION AND OWNERSHIP METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Get faction name for known factions
     */
    public getFactionName(): string {
        const faction = this.getFaction();
        switch (faction) {
            case KnownMineFactions.NO_FACTION:
                return 'No Faction';
            case KnownMineFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownMineFactions.OUTCASTS:
                return 'Outcasts';
            case KnownMineFactions.SCAVENGERS:
                return 'Scavengers';
            case KnownMineFactions.PIRATES:
                return 'Pirates';
            default:
                return faction > 0 ? `Player Faction ${faction}` : `Unknown Faction ${faction}`;
        }
    }

    /**
     * Get owner name from loaded player relation
     */
    public getOwnerName(): string | undefined {
        const ownerPlayer = this.getOwnerPlayer();
        if (ownerPlayer && this.hasOwnerPlayerLoaded()) {
            // Use display name if available, fallback to login name
            return typeof ownerPlayer.getDisplayName === 'function' 
                ? ownerPlayer.getDisplayName() 
                : (ownerPlayer.getName ? ownerPlayer.getName() : undefined);
        }
        return undefined;
    }

    /**
     * Get sector name from loaded sector relation
     */
    public getSectorName(): string | undefined {
        const sector = this.getSector();
        if (sector && this.hasSectorLoaded()) {
            return typeof sector.getName === 'function' ? sector.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Check if mine belongs to NPC faction
     */
    public isNPCFaction(): boolean {
        const faction = this.getFaction();
        return faction < 0;
    }

    /**
     * Check if mine belongs to player faction
     */
    public isPlayerFaction(): boolean {
        const faction = this.getFaction();
        return faction > 0;
    }

    /**
     * Check if mine is neutral (no faction)
     */
    public isNeutral(): boolean {
        return this.getFaction() === KnownMineFactions.NO_FACTION;
    }

    // =============================================================================
    // TIME AND AGE METHODS
    // =============================================================================

    /**
     * Get age of mine in milliseconds
     */
    public getAge(): number {
        return Date.now() - this.getCreationDate();
    }

    /**
     * Get age of mine in seconds
     */
    public getAgeInSeconds(): number {
        return Math.floor(this.getAge() / 1000);
    }

    /**
     * Get age description
     */
    public getAgeDescription(): string {
        const ageSeconds = this.getAgeInSeconds();
        
        if (ageSeconds < 60) {
            return `${ageSeconds} seconds`;
        } else if (ageSeconds < 3600) {
            const minutes = Math.floor(ageSeconds / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else if (ageSeconds < 86400) {
            const hours = Math.floor(ageSeconds / 3600);
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            const days = Math.floor(ageSeconds / 86400);
            return `${days} day${days !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Get formatted creation date
     */
    public getFormattedCreationDate(): string {
        return new Date(this.getCreationDate()).toISOString();
    }

    // =============================================================================
    // TACTICAL ANALYSIS METHODS - ENHANCED EDITION (100/100 FEATURES)
    // =============================================================================

    /**
     * Get tactical threat assessment based on mine properties and relations
     */
    public getTacticalThreatAssessment(): {
        threatLevel: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
        riskFactors: string[];
        recommendations: string[];
        ownerIntelligence?: {
            name?: string;
            faction?: string;
            role?: string;
            isHostile?: boolean;
        };
        sectorIntelligence?: {
            name?: string;
            type?: string;
            protection?: string;
            isProtected?: boolean;
        };
    } {
        const riskFactors: string[] = [];
        const recommendations: string[] = [];
        let threatLevel: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';

        // Analyze mine status
        const armingState = this.getArmingState();
        const status = this.getMineStatus();

        if (armingState === MineArmingState.ARMED && status === MineStatus.ACTIVE) {
            threatLevel = 'CRITICAL';
            riskFactors.push('Mine is armed and fully operational');
            recommendations.push('DANGER: Maintain maximum safe distance');
        } else if (armingState === MineArmingState.ARMING) {
            threatLevel = 'HIGH';
            riskFactors.push('Mine is currently arming');
            recommendations.push('EVACUATE: Mine activation imminent');
        } else if (status === MineStatus.DESTROYED) {
            threatLevel = 'SAFE';
            riskFactors.push('Mine is destroyed');
            recommendations.push('Safe to approach, but verify destruction');
        } else if (status === MineStatus.EXPIRED) {
            threatLevel = 'LOW';
            riskFactors.push('Mine ammunition depleted');
            recommendations.push('Caution: Verify deactivation before approach');
        } else if (armingState === MineArmingState.DISARMED) {
            threatLevel = 'MODERATE';
            riskFactors.push('Mine is disarmed but intact');
            recommendations.push('Handle with care: Could be reactivated');
        }

        // Enhanced intelligence with loaded relations
        let ownerIntelligence: any = undefined;
        let sectorIntelligence: any = undefined;

        if (this.hasOwnerPlayerLoaded()) {
            const ownerPlayer = this.getOwnerPlayer();
            ownerIntelligence = {
                name: this.getOwnerName(),
                faction: this.getFactionName(),
                role: typeof ownerPlayer.getRole === 'function' ? ownerPlayer.getRole() : undefined,
                isHostile: this.isNPCFaction() && this.getFaction() !== KnownMineFactions.TRADING_GUILD
            };

            if (ownerIntelligence.isHostile) {
                riskFactors.push(`Hostile faction mine: ${ownerIntelligence.faction}`);
                if (threatLevel === 'MODERATE') threatLevel = 'HIGH';
            } else if (ownerIntelligence.faction === 'Trading Guild') {
                recommendations.push('Trading Guild mine - likely defensive');
            }
        }

        if (this.hasSectorLoaded()) {
            const sector = this.getSector();
            sectorIntelligence = {
                name: this.getSectorName(),
                type: typeof sector.getTypeName === 'function' ? sector.getTypeName() : undefined,
                protection: typeof sector.getProtectionDescription === 'function' ? sector.getProtectionDescription() : undefined,
                isProtected: typeof sector.isFullyProtected === 'function' ? sector.isFullyProtected() : undefined
            };

            if (sectorIntelligence.isProtected) {
                recommendations.push('Protected sector - mine likely authorized');
            } else {
                riskFactors.push('Unprotected sector - mine could be trap');
            }
        }

        // Age-based analysis
        const ageSeconds = this.getAgeInSeconds();
        if (ageSeconds > 86400) { // Older than 1 day
            riskFactors.push('Old mine - potentially unstable');
        } else if (ageSeconds < 300) { // Newer than 5 minutes
            riskFactors.push('Freshly deployed mine - high alert');
            if (threatLevel === 'LOW') threatLevel = 'MODERATE';
        }

        return {
            threatLevel,
            riskFactors,
            recommendations,
            ownerIntelligence,
            sectorIntelligence
        };
    }

    /**
     * Analyze mine composition for tactical intelligence
     */
    public analyzeComposition(): {
        hasValidData: boolean;
        modules: {
            coreBlock: number;
            strengthModule: number;
            radiusModule: number;
            stealthModule: number;
            firingModule: number;
            reserved: number;
        };
        analysis: {
            estimatedRadius: string;
            stealthLevel: string;
            damageCategory: string;
            firingType: string;
        };
        tacticalNotes: string[];
    } {
        const composition = this.parseComposition();
        const tacticalNotes: string[] = [];

        if (!composition) {
            return {
                hasValidData: false,
                modules: { coreBlock: 0, strengthModule: 0, radiusModule: 0, stealthModule: 0, firingModule: 0, reserved: 0 },
                analysis: {
                    estimatedRadius: 'Unknown',
                    stealthLevel: 'Unknown',
                    damageCategory: 'Unknown',
                    firingType: 'Unknown'
                },
                tacticalNotes: ['Corrupted composition data - cannot analyze capabilities']
            };
        }

        // Basic analysis without assuming specific block meanings
        const estimatedRadius = composition.radiusModule > 50 ? 'Large' : 
                               composition.radiusModule > 20 ? 'Medium' : 'Small';
        
        const stealthLevel = composition.stealthModule > 50 ? 'High' :
                           composition.stealthModule > 20 ? 'Medium' : 
                           composition.stealthModule > 0 ? 'Low' : 'None';
        
        const damageCategory = composition.strengthModule > 80 ? 'Heavy' :
                             composition.strengthModule > 40 ? 'Medium' : 'Light';
        
        const firingType = composition.firingModule > 0 ? 'Active Trigger' : 'Contact/Proximity';

        // Generate tactical notes
        if (composition.radiusModule > 30) {
            tacticalNotes.push('Wide-area effect mine');
        }
        if (composition.stealthModule > 40) {
            tacticalNotes.push('High stealth - difficult to detect');
        }
        if (composition.strengthModule > 60) {
            tacticalNotes.push('High-damage potential');
        }
        if (composition.firingModule > 0) {
            tacticalNotes.push('Advanced firing mechanism');
        }

        return {
            hasValidData: true,
            modules: composition,
            analysis: {
                estimatedRadius,
                stealthLevel,
                damageCategory,
                firingType
            },
            tacticalNotes
        };
    }

    // =============================================================================
    // SUMMARY AND UTILITY METHODS - ENHANCED EDITION
    // =============================================================================

    /**
     * Get comprehensive mine summary with relationship data
     */
    public getMineSummary(): {
        id: number;
        owner: number;
        ownerName?: string;
        faction: string;
        position: string;
        sectorName?: string;
        hp: number;
        armingState: MineArmingState;
        status: MineStatus;
        composition: MineComposition | null;
        compositionAnalysis: ReturnType<MinesModel['analyzeComposition']>;
        age: string;
        isActive: boolean;
        isArmed: boolean;
        hasAmmo: boolean | 'unlimited';
        remainingAmmo: number | 'unlimited';
        tacticalAssessment: ReturnType<MinesModel['getTacticalThreatAssessment']>;
        relationshipStatus: {
            hasOwnerPlayerLoaded: boolean;
            hasSectorLoaded: boolean;
            hasAllRelationsLoaded: boolean;
        };
    } {
        return {
            id: this.getId(),
            owner: this.getOwner(),
            ownerName: this.getOwnerName(),
            faction: this.getFactionName(),
            position: this.getPositionDescription(),
            sectorName: this.getSectorName(),
            hp: this.getHp(),
            armingState: this.getArmingState(),
            status: this.getMineStatus(),
            composition: this.parseComposition(),
            compositionAnalysis: this.analyzeComposition(),
            age: this.getAgeDescription(),
            isActive: this.isActive(),
            isArmed: this.getArmed(),
            hasAmmo: this.hasUnlimitedAmmo() ? 'unlimited' : this.hasAmmo(),
            remainingAmmo: this.getRemainingAmmo(),
            tacticalAssessment: this.getTacticalThreatAssessment(),
            relationshipStatus: {
                hasOwnerPlayerLoaded: this.hasOwnerPlayerLoaded(),
                hasSectorLoaded: this.hasSectorLoaded(),
                hasAllRelationsLoaded: this.hasAllRelationsLoaded()
            }
        };
    }

    /**
     * Get mine safety assessment (enhanced with relation data)
     */
    public getSafetyAssessment(): {
        isSafe: boolean;
        canHandle: boolean;
        armingState: MineArmingState;
        warnings: string[];
        recommendations: string[];
        tacticalIntelligence?: {
            ownerThreat?: string;
            sectorSafety?: string;
            estimatedCapabilities?: string;
        };
    } {
        const warnings: string[] = [];
        const recommendations: string[] = [];
        const armingState = this.getArmingState();
        
        if (this.isArmedAndDangerous()) {
            warnings.push('Mine is armed and dangerous');
            recommendations.push('Maintain safe distance');
        }
        
        if (this.isArming()) {
            warnings.push('Mine is currently arming');
            recommendations.push('Evacuate area immediately');
        }
        
        if (!this.isActive()) {
            if (this.getHp() <= 0) {
                warnings.push('Mine is destroyed');
                recommendations.push('Safe to approach, but verify status');
            } else if (this.getAmmo() === 0) {
                warnings.push('Mine ammunition depleted');
                recommendations.push('Verify deactivation before approach');
            }
        }
        
        const isSafe = armingState === MineArmingState.DISARMED && !this.isActive();
        const canHandle = this.isSafeToHandle();
        

        // Enhanced tactical intelligence
        let tacticalIntelligence: any = undefined;
        if (this.hasAllRelationsLoaded()) {
            const threatAssessment = this.getTacticalThreatAssessment();
            tacticalIntelligence = {
                ownerThreat: threatAssessment.ownerIntelligence?.isHostile ? 'HOSTILE' : 'NEUTRAL',
                sectorSafety: threatAssessment.sectorIntelligence?.isProtected ? 'PROTECTED' : 'UNPROTECTED',
                estimatedCapabilities: this.analyzeComposition().analysis.damageCategory
            };
        }
        
        return {
            isSafe,
            canHandle,
            armingState,
            warnings,
            recommendations,
            tacticalIntelligence
        };
    }

    /**
     * Create mine with custom composition (using real values, not assumptions)
     */
    public static createWithComposition(
        composition: MineComposition, 
        overrides: Partial<any> = {}
    ): MinesModel {
        const mine = new MinesModel({
            COMPOSITION: JSON.stringify([
                composition.coreBlock,
                composition.strengthModule,
                composition.radiusModule,
                composition.stealthModule,
                composition.firingModule,
                composition.reserved
            ]),
            HP: 100,
            ARMED: false,
            ARMED_IN_SECS: -1,
            AMMO: -2,
            FACTION: 0,
            CREATION_DATE: Date.now(),
            ...overrides
        });
        return mine;
    }
}