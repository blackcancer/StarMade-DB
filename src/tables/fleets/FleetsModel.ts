/**
 * @fileoverview Fleets Model
 * 
 * Model for the FLEETS table managing collections of entities operating as coordinated units.
 * Provides fleet command and control with mission management and combat settings.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    foreignKey,
    index,
    validation,
    relation,
    Model,
    DataType,
    ForeignKeyAction,
    type TableSchema,
    type RelationMappings
} from '../BaseModel.js';

// =============================================================================
// FLEETS ENUMS AND TYPES
// =============================================================================

/**
 * Fleet command types — exact ordinal order from FleetCommandTypes.java.
 * Note: REPAIR_FLEET(4) was missing in the previous version, causing all
 * subsequent ordinals to be off by one.
 */
export enum FleetCommand {
    IDLE             = 0,
    MOVE_FLEET       = 1,
    PATROL_FLEET     = 2,
    TRADE_FLEET      = 3,
    REPAIR_FLEET     = 4,
    FLEET_ATTACK     = 5,
    FLEET_DEFEND     = 6,
    ESCORT           = 7,
    REPAIR           = 8,
    ARTILLERY        = 9,
    SENTRY_FORMATION = 10,
    SENTRY           = 11,
    FLEET_IDLE_FORMATION = 12,
    CALL_TO_CARRIER  = 13,
    MINE_IN_SECTOR   = 14,
    CLOAK            = 15,
    UNCLOAK          = 16,
    JAM              = 17,
    UNJAM            = 18,
    ACTIVATE_REMOTE  = 19,
    INTERDICT        = 20,
    STOP_INTERDICT   = 21,
}

/**
 * Fleet faction access levels
 */
export enum FactionAccess {
    NONE = 0,      // Only owner can access
    OFFICER = 1,   // Officers and above
    COMMANDER = 2, // Commanders and above
    MEMBER = 3,    // All faction members
    RECRUIT = 4,   // Including new recruits
    ALL = 5        // Public access
}

/**
 * Combat behavior settings
 */
export enum CombatSetting {
    PASSIVE = 'PASSIVE',
    SOMETIMES_ENGAGE = 'SOMETIMES ENGAGE',
    ALWAYS_ENGAGE = 'ALWAYS ENGAGE',
    ALWAYS_FLEE = 'ALWAYS FLEE'
}

/**
 * Active mission states
 */
export enum MissionString {
    IDLE = 'IDLE',
    IDLE_SENTRY = 'IDLE - SENTRY',
    SENTRY_FORMATION = 'SENTRY - FORMATION',
    CALLBACK_TO_CARRIER = 'CALLBACK TO CARRIER',
    MINING = 'MINING',
    PATROLLING = 'PATROLLING',
    TRADING = 'TRADING',
    MOVING = 'MOVING',
    REPAIRING = 'REPAIRING',
    STANDOFF = 'STANDOFF',
    ATTACKING = 'ATTACKING',
    SENTRY = 'SENTRY',
    DEFENDING = 'DEFENDING',
    ESCORTING = 'ESCORTING',
    CLOAKING = 'CLOAKING',
    UNCLOAKING = 'UNCLOAKING',
    JAMMING = 'JAMMING',
    STOP_JAMMING = 'STOP JAMMING',
    FTL_INTERDICTING = 'FTL INTERDICTING',
    STOP_FTL_INTERDICTION = 'STOP FTL INTERDICTION'
}

/**
 * Fleet type indicators from naming patterns
 */
export enum FleetType {
    ATTACKING = 'ATTACKING',
    DEFENDING = 'DEFENDING',
    MINING = 'MINING',
    TRADING = 'TRADING',
    SCAVENGING = 'SCAVENGING'
}

/**
 * NPC fleet prefixes
 */
export enum NPCFleetPrefix {
    STANDARD = 'NPCFLT',
    GENERAL = 'GNPCFLT'
}

/**
 * Mission categories for classification
 */
export enum FleetMissionCategory {
    IDLE = 'IDLE',
    MOVEMENT = 'MOVEMENT',
    COMBAT = 'COMBAT',
    OPERATIONS = 'OPERATIONS',
    SPECIAL = 'SPECIAL'
}

/**
 * Mission state mappings
 */
export const FLEET_MISSION_CATEGORIES = {
    [FleetMissionCategory.IDLE]: [
        MissionString.IDLE,
        MissionString.IDLE_SENTRY
    ],
    [FleetMissionCategory.MOVEMENT]: [
        MissionString.MOVING,
        MissionString.PATROLLING,
        MissionString.CALLBACK_TO_CARRIER
    ],
    [FleetMissionCategory.COMBAT]: [
        MissionString.ATTACKING,
        MissionString.DEFENDING,
        MissionString.STANDOFF,
        MissionString.ESCORTING,
        MissionString.SENTRY,
        MissionString.SENTRY_FORMATION
    ],
    [FleetMissionCategory.OPERATIONS]: [
        MissionString.MINING,
        MissionString.TRADING,
        MissionString.REPAIRING
    ],
    [FleetMissionCategory.SPECIAL]: [
        MissionString.CLOAKING,
        MissionString.UNCLOAKING,
        MissionString.JAMMING,
        MissionString.STOP_JAMMING,
        MissionString.FTL_INTERDICTING,
        MissionString.STOP_FTL_INTERDICTION
    ]
} as const;

// =============================================================================
// FLEETS MODEL
// =============================================================================

/**
 * Model for the FLEETS table - Enhanced Edition with Complete Relations
 * 
 * Advanced fleet command and control with complete bidirectional relationships,
 * comprehensive mission analytics, and hierarchical fleet management.
 */
export class FleetsModel extends BaseModel {
    public static tableName = 'FLEETS';
    
    public static schema: TableSchema = {
        tableName: 'FLEETS',
        comment: 'Fleet command and control system',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Fleet identifier'
            }),
            column('FLAGSHIP_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Leading entity ID'
            }),
            column('PARENT_FLEET', DataType.BIGINT, {
                nullable: true,
                defaultValue: -1,
                comment: 'Parent fleet for hierarchies'
            }),
            column('NAME', DataType.VARCHAR, {
                length: 128,
                nullable: true,
                comment: 'Fleet designation'
            }),
            column('OWNER', DataType.VARCHAR, {
                length: 128,
                nullable: true,
                comment: 'Controlling player UID'
            }),
            column('MISSION_STRING', DataType.VARCHAR, {
                length: 1024,
                nullable: true,
                comment: 'High-level mission description'
            }),
            column('COMMAND', DataType.BLOB, {
                nullable: true,
                comment: 'Serialized command data'
            }),
            column('FACTION_ACCESS', DataType.INTEGER, {
                nullable: true,
                defaultValue: 0,
                comment: 'Access permission level'
            }),
            column('SAVED_REMOTES', DataType.BLOB, {
                nullable: true,
                comment: 'Serialized remote control data'
            }),
            column('COMBAT_SETTING', DataType.VARCHAR, {
                length: 128,
                nullable: true,
                comment: 'Combat behavior preset'
            })
        ],

        primaryKey: ['ID'],
        
        foreignKeys: [
            // References to ENTITIES for flagship
            foreignKey('FK_FLEET_FLAGSHIP', ['FLAGSHIP_ID'], 'ENTITIES', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE,
                onUpdate: ForeignKeyAction.CASCADE
            }),
            // Self-referencing for fleet hierarchies
            foreignKey('FK_FLEET_PARENT', ['PARENT_FLEET'], 'FLEETS', ['ID'], {
                onDelete: ForeignKeyAction.SET_NULL,
                onUpdate: ForeignKeyAction.CASCADE
            })
        ],

        indexes: [
            index('fin', ['FLAGSHIP_ID']),
            index('oin', ['OWNER']),
            index('finp', ['PARENT_FLEET'])
        ],

        validationRules: [
            validation('FLAGSHIP_ID', 'required'),
            validation('NAME', 'maxLength', {
                value: 128,
                message: 'Name cannot exceed 128 characters'
            }),
            validation('OWNER', 'maxLength', {
                value: 128,
                message: 'Owner cannot exceed 128 characters'
            }),
            validation('MISSION_STRING', 'maxLength', {
                value: 1024,
                message: 'Mission string cannot exceed 1024 characters'
            }),
            validation('FACTION_ACCESS', 'custom', {
                validator: (access: number) => {
                    if (access === null || access === undefined) return true;
                    if (access < 0 || access > 5) {
                        return 'Invalid faction access level';
                    }
                    return true;
                }
            }),
            validation('COMBAT_SETTING', 'custom', {
                validator: (setting: string) => {
                    if (!setting) return true; // Nullable field
                    const validSettings = Object.values(CombatSetting);
                    return validSettings.includes(setting as CombatSetting) || 
                           `Invalid combat setting: ${setting}`;
                }
            }),
            validation('PARENT_FLEET', 'custom', {
                validator: (parentFleet: number, data: any) => {
                    if (parentFleet !== null && parentFleet !== undefined && parentFleet !== -1) {
                        // Cannot be parent of itself
                        if (data.ID && parentFleet === data.ID) {
                            return 'Fleet cannot be parent of itself';
                        }
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
            /** Flagship entity leading this fleet (FLEETS.FLAGSHIP_ID -> ENTITIES.ID) */
            flagship: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../entities/EntitiesModel.js').EntitiesModel;
                },
                {
                    from: 'FLEETS.FLAGSHIP_ID',
                    to: 'ENTITIES.ID'
                }
            ),

            /** Parent fleet in hierarchy (FLEETS.PARENT_FLEET -> FLEETS.ID) */
            parentFleet: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../fleets/FleetsModel.js').FleetsModel;
                },
                {
                    from: 'FLEETS.PARENT_FLEET',
                    to: 'FLEETS.ID'
                }
            ),

            /** Player who owns this fleet (FLEETS.OWNER -> PLAYERS.STARMADE_NAME) */
            ownerPlayer: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../players/PlayersModel.js').PlayersModel;
                },
                {
                    from: 'FLEETS.OWNER',
                    to: 'PLAYERS.STARMADE_NAME'
                }
            ),

            /** Child fleets under this fleet (FLEETS.ID -> FLEETS.PARENT_FLEET) */
            childFleets: relation(
                Model.HasManyRelation,
                () => {
                    return require('../fleets/FleetsModel.js').FleetsModel;
                },
                {
                    from: 'FLEETS.ID',
                    to: 'FLEETS.PARENT_FLEET'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getFlagshipId(): number { return this.get('FLAGSHIP_ID'); }
    public setFlagshipId(flagshipId: number): this { return this.set('FLAGSHIP_ID', flagshipId); }

    public getParentFleet(): number { const v = this.get('PARENT_FLEET'); const n = v === undefined || v === null ? -1 : (typeof v === 'string' ? parseInt(v, 10) : v); return n; }
    public setParentFleet(parentFleet: number): this { return this.set('PARENT_FLEET', parentFleet); }

    public getName(): string | undefined { return this.get('NAME'); }
    public setName(name: string | undefined): this { return this.set('NAME', name); }

    public getOwner(): string | undefined { return this.get('OWNER'); }
    public setOwner(owner: string | undefined): this { return this.set('OWNER', owner); }

    public getMissionString(): string | undefined { return this.get('MISSION_STRING'); }
    public setMissionString(missionString: string | undefined): this { return this.set('MISSION_STRING', missionString); }

    public getCommand(): Buffer | undefined { return this.get('COMMAND'); }
    public setCommand(command: Buffer | undefined): this { return this.set('COMMAND', command); }

    public getFactionAccess(): FactionAccess { return this.get('FACTION_ACCESS') || FactionAccess.NONE; }
    public setFactionAccess(factionAccess: FactionAccess): this { return this.set('FACTION_ACCESS', factionAccess); }

    public getSavedRemotes(): Buffer | undefined { return this.get('SAVED_REMOTES'); }
    public setSavedRemotes(savedRemotes: Buffer | undefined): this { return this.set('SAVED_REMOTES', savedRemotes); }

    public getCombatSetting(): CombatSetting | undefined { return this.get('COMBAT_SETTING') as CombatSetting; }
    public setCombatSetting(combatSetting: CombatSetting | undefined): this { return this.set('COMBAT_SETTING', combatSetting); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the flagship entity leading this fleet */
    public getFlagship(): any | undefined {
        return this.getRelated<any>('flagship');
    }

    /** Set the flagship entity leading this fleet */
    public setFlagship(entity: any | undefined): this {
        return this.setRelated('flagship', entity);
    }

    /** Get the parent fleet in hierarchy */
    public getParentFleetEntity(): any | undefined {
        return this.getRelated<any>('parentFleet');
    }

    /** Set the parent fleet in hierarchy */
    public setParentFleetEntity(fleet: any | undefined): this {
        return this.setRelated('parentFleet', fleet);
    }

    /** Get the player who owns this fleet */
    public getOwnerPlayer(): any | undefined {
        return this.getRelated<any>('ownerPlayer');
    }

    /** Set the player who owns this fleet */
    public setOwnerPlayer(player: any | undefined): this {
        return this.setRelated('ownerPlayer', player);
    }

    /** Get child fleets under this fleet */
    public getChildFleets(): any[] | undefined {
        return this.getRelated<any[]>('childFleets');
    }

    /** Set child fleets under this fleet */
    public setChildFleets(fleets: any[] | undefined): this {
        return this.setRelated('childFleets', fleets);
    }

    /** Check if flagship relation is loaded */
    public hasFlagshipLoaded(): boolean {
        return this.hasRelated('flagship');
    }

    /** Check if parent fleet relation is loaded */
    public hasParentFleetLoaded(): boolean {
        return this.hasRelated('parentFleet');
    }

    /** Check if owner player relation is loaded */
    public hasOwnerPlayerLoaded(): boolean {
        return this.hasRelated('ownerPlayer');
    }

    /** Check if child fleets relation is loaded */
    public hasChildFleetsLoaded(): boolean {
        return this.hasRelated('childFleets');
    }

    /** Check if all relations are loaded */
    public hasAllRelationsLoaded(): boolean {
        return this.hasFlagshipLoaded() && this.hasParentFleetLoaded() && 
               this.hasOwnerPlayerLoaded() && this.hasChildFleetsLoaded();
    }

    /** Check if critical relations are loaded (flagship and owner) */
    public hasCriticalRelationsLoaded(): boolean {
        return this.hasFlagshipLoaded() && this.hasOwnerPlayerLoaded();
    }

    // =============================================================================
    // RELATIONSHIP COUNTING METHODS
    // =============================================================================

    /** Get count of child fleets */
    public getChildFleetsCount(): number {
        const children = this.getChildFleets();
        return children ? children.length : 0;
    }

    // =============================================================================
    // ENHANCED METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get flagship name from loaded relation
     */
    public getFlagshipName(): string | undefined {
        const flagship = this.getFlagship();
        if (flagship && this.hasFlagshipLoaded()) {
            return typeof flagship.getName === 'function' ? flagship.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get owner name from loaded relation
     */
    public getOwnerName(): string | undefined {
        const ownerPlayer = this.getOwnerPlayer();
        if (ownerPlayer && this.hasOwnerPlayerLoaded()) {
            return typeof ownerPlayer.getDisplayName === 'function' 
                ? ownerPlayer.getDisplayName() 
                : (ownerPlayer.getName ? ownerPlayer.getName() : undefined);
        }
        return undefined;
    }

    /**
     * Get parent fleet name from loaded relation
     */
    public getParentFleetName(): string | undefined {
        const parentFleet = this.getParentFleetEntity();
        if (parentFleet && this.hasParentFleetLoaded()) {
            return typeof parentFleet.getName === 'function' ? parentFleet.getName() : undefined;
        }
        return undefined;
    }

    // =============================================================================
    // FLEET HIERARCHY METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Check if fleet has a parent
     */
    public hasParent(): boolean {
        return this.getParentFleet() !== -1;
    }

    /**
     * Check if fleet is a top-level fleet
     */
    public isTopLevel(): boolean {
        return !this.hasParent();
    }

    /**
     * Check if fleet has children
     */
    public hasChildren(): boolean {
        return this.getChildFleetsCount() > 0;
    }

    /**
     * Check if fleet is a leaf node (no children)
     */
    public isLeafNode(): boolean {
        return !this.hasChildren();
    }

    /**
     * Check if fleet is owned by a player
     */
    public isPlayerOwned(): boolean {
        const owner = this.getOwner();
        return owner !== null && owner !== undefined && 
               !owner.startsWith('GNPC#') && !owner.startsWith('NPC#');
    }

    /**
     * Check if fleet is NPC owned
     */
    public isNPCOwned(): boolean {
        const owner = this.getOwner();
        return owner !== null && owner !== undefined && 
               (owner.startsWith('GNPC#') || owner.startsWith('NPC#'));
    }

    // =============================================================================
    // MISSION STATE METHODS
    // =============================================================================

    /**
     * Get normalized mission state
     */
    public getMissionState(): MissionString | null {
        const mission = this.getMissionString()?.toUpperCase();
        if (!mission) return null;

        // Try exact match first
        for (const state of Object.values(MissionString)) {
            if (mission === state.toUpperCase()) {
                return state;
            }
        }

        // Try partial matches for common variations
        if (mission.includes('IDLE')) {
            if (mission.includes('SENTRY')) return MissionString.IDLE_SENTRY;
            return MissionString.IDLE;
        }
        if (mission.includes('SENTRY')) {
            if (mission.includes('FORMATION')) return MissionString.SENTRY_FORMATION;
            return MissionString.SENTRY;
        }
        if (mission.includes('ATTACK')) return MissionString.ATTACKING;
        if (mission.includes('DEFEND')) return MissionString.DEFENDING;
        if (mission.includes('MINING')) return MissionString.MINING;
        if (mission.includes('TRADING')) return MissionString.TRADING;
        if (mission.includes('PATROL')) return MissionString.PATROLLING;
        if (mission.includes('MOVING')) return MissionString.MOVING;
        if (mission.includes('REPAIR')) return MissionString.REPAIRING;
        if (mission.includes('CALLBACK') || mission.includes('CARRIER')) return MissionString.CALLBACK_TO_CARRIER;
        if (mission.includes('STANDOFF')) return MissionString.STANDOFF;
        if (mission.includes('ESCORT')) return MissionString.ESCORTING;
        if (mission.includes('CLOAK')) {
            if (mission.includes('UN')) return MissionString.UNCLOAKING;
            return MissionString.CLOAKING;
        }
        if (mission.includes('JAM')) {
            if (mission.includes('STOP')) return MissionString.STOP_JAMMING;
            return MissionString.JAMMING;
        }
        if (mission.includes('INTERDICT')) {
            if (mission.includes('STOP')) return MissionString.STOP_FTL_INTERDICTION;
            return MissionString.FTL_INTERDICTING;
        }

        return null;
    }

    /**
     * Get mission category
     */
    public getMissionCategory(): FleetMissionCategory {
        const state = this.getMissionState();
        if (!state) return FleetMissionCategory.IDLE;

        for (const [category, states] of Object.entries(FLEET_MISSION_CATEGORIES)) {
            if ((states as readonly MissionString[]).includes(state)) {
                return category as FleetMissionCategory;
            }
        }

        return FleetMissionCategory.IDLE;
    }

    /**
     * Check if fleet has a recognized mission state
     */
    public hasRecognizedMission(): boolean {
        return this.getMissionState() !== null;
    }

    /**
     * Get current mission status
     */
    public getCurrentMission(): string {
        return this.getMissionString() || 'Unknown';
    }

    /**
     * Check if fleet is idle
     */
    public isIdle(): boolean {
        const category = this.getMissionCategory();
        return category === FleetMissionCategory.IDLE;
    }

    /**
     * Check if fleet is in combat mode
     */
    public isInCombat(): boolean {
        const category = this.getMissionCategory();
        return category === FleetMissionCategory.COMBAT;
    }

    /**
     * Check if fleet is mining
     */
    public isMining(): boolean {
        const state = this.getMissionState();
        return state === MissionString.MINING;
    }

    /**
     * Check if fleet is trading
     */
    public isTrading(): boolean {
        const state = this.getMissionState();
        return state === MissionString.TRADING;
    }

    /**
     * Check if fleet is moving
     */
    public isMoving(): boolean {
        const category = this.getMissionCategory();
        return category === FleetMissionCategory.MOVEMENT;
    }

    /**
     * Check if fleet is in sentry mode
     */
    public isSentry(): boolean {
        const state = this.getMissionState();
        return state === MissionString.SENTRY || 
               state === MissionString.SENTRY_FORMATION ||
               state === MissionString.IDLE_SENTRY;
    }

    /**
     * Check if fleet is performing operations
     */
    public isPerformingOperations(): boolean {
        const category = this.getMissionCategory();
        return category === FleetMissionCategory.OPERATIONS;
    }

    /**
     * Check if fleet is in special mode
     */
    public isInSpecialMode(): boolean {
        const category = this.getMissionCategory();
        return category === FleetMissionCategory.SPECIAL;
    }

    // =============================================================================
    // FLEET NAMING AND TYPE METHODS
    // =============================================================================

    /**
     * Parse fleet type from name (according to TABLE_FLEETS.md patterns)
     */
    public getFleetType(): FleetType | null {
        const name = this.getName();
        if (!name) return null;

        // Check for NPC fleet patterns: [prefix]#[type]#[faction id]#[system x], [system y], [system z]#[index]
        const match = name.match(/^(NPCFLT|GNPCFLT)#([A-Z]+)#/);
        if (match) {
            const type = match[2] as FleetType;
            if (Object.values(FleetType).includes(type)) {
                return type;
            }
        }

        return null;
    }

    /**
     * Check if fleet is an NPC fleet based on naming
     */
    public isNPCFleet(): boolean {
        const name = this.getName();
        return name?.match(/^(NPCFLT|GNPCFLT)#/) !== null;
    }

    /**
     * Check if fleet is a General NPC fleet
     */
    public isGeneralNPCFleet(): boolean {
        const name = this.getName();
        return name?.startsWith('GNPCFLT#') || false;
    }

    /**
     * Check if fleet is a standard NPC fleet
     */
    public isStandardNPCFleet(): boolean {
        const name = this.getName();
        return name?.startsWith('NPCFLT#') || false;
    }

    /**
     * Parse faction ID from fleet name
     */
    public getFactionIdFromName(): number | null {
        const name = this.getName();
        if (!name) return null;

        const match = name.match(/^(NPCFLT|GNPCFLT)#[A-Z]+#(-?\d+)#/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Parse system coordinates from fleet name
     */
    public getSystemCoordsFromName(): { x: number; y: number; z: number } | null {
        const name = this.getName();
        if (!name) return null;

        const match = name.match(/^(NPCFLT|GNPCFLT)#[A-Z]+#-?\d+#(-?\d+),\s*(-?\d+),\s*(-?\d+)#/);
        if (match) {
            return {
                x: parseInt(match[2]),
                y: parseInt(match[3]),
                z: parseInt(match[4])
            };
        }

        return null;
    }

    /**
     * Parse fleet index from name
     */
    public getFleetIndexFromName(): number | null {
        const name = this.getName();
        if (!name) return null;

        const match = name.match(/#(\d+)$/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Generate NPC fleet name according to pattern
     */
    public static generateNPCFleetName(
        prefix: NPCFleetPrefix,
        type: FleetType,
        factionId: number,
        systemCoords: { x: number; y: number; z: number },
        index: number
    ): string {
        return `${prefix}#${type}#${factionId}#${systemCoords.x}, ${systemCoords.y}, ${systemCoords.z}#${index}`;
    }

    // =============================================================================
    // COMBAT AND ACCESS METHODS
    // =============================================================================

    /**
     * Get combat behavior description
     */
    public getCombatBehavior(): string {
        const setting = this.getCombatSetting();
        if (!setting) return 'Unknown';

        switch (setting) {
            case CombatSetting.PASSIVE:
                return 'Passive - Will not engage unless attacked';
            case CombatSetting.SOMETIMES_ENGAGE:
                return 'Sometimes Engage - Selective engagement';
            case CombatSetting.ALWAYS_ENGAGE:
                return 'Always Engage - Actively seeks enemies';
            case CombatSetting.ALWAYS_FLEE:
                return 'Always Flee - Avoids all combat';
            default:
                return `Unknown - ${setting}`;
        }
    }

    /**
     * Check if fleet will engage in combat
     */
    public willEngage(): boolean {
        const setting = this.getCombatSetting();
        return setting === CombatSetting.SOMETIMES_ENGAGE || 
               setting === CombatSetting.ALWAYS_ENGAGE;
    }

    /**
     * Check if fleet is aggressive
     */
    public isAggressive(): boolean {
        return this.getCombatSetting() === CombatSetting.ALWAYS_ENGAGE;
    }

    /**
     * Check if fleet will flee from combat
     */
    public willFlee(): boolean {
        return this.getCombatSetting() === CombatSetting.ALWAYS_FLEE;
    }

    /**
     * Check if fleet is passive
     */
    public isPassive(): boolean {
        return this.getCombatSetting() === CombatSetting.PASSIVE;
    }

    /**
     * Get faction access level description
     */
    public getAccessDescription(): string {
        switch (this.getFactionAccess()) {
            case FactionAccess.NONE:
                return 'Owner Only';
            case FactionAccess.OFFICER:
                return 'Officers and Above';
            case FactionAccess.COMMANDER:
                return 'Commanders and Above';
            case FactionAccess.MEMBER:
                return 'All Members';
            case FactionAccess.RECRUIT:
                return 'Including Recruits';
            case FactionAccess.ALL:
                return 'Public Access';
            default:
                return 'Unknown';
        }
    }

    /**
     * Check if user can access fleet
     */
    public canUserAccess(userAccessLevel: FactionAccess): boolean {
        return userAccessLevel >= this.getFactionAccess();
    }

    /**
     * Check if fleet is publicly accessible
     */
    public isPubliclyAccessible(): boolean {
        return this.getFactionAccess() === FactionAccess.ALL;
    }

    /**
     * Check if fleet is restricted to owner only
     */
    public isOwnerOnly(): boolean {
        return this.getFactionAccess() === FactionAccess.NONE;
    }

    // =============================================================================
    // REMOTE CONTROL METHODS
    // =============================================================================

    /**
     * Check if fleet has remote controls
     */
    public hasRemoteControls(): boolean {
        const remotes = this.getSavedRemotes();
        return remotes !== null && remotes !== undefined && remotes.length > 1;
    }

    /**
     * Check if fleet has command data
     */
    public hasCommandData(): boolean {
        const command = this.getCommand();
        return command !== null && command !== undefined && command.length > 0;
    }

    // =============================================================================
    // STARMADE-DECODER INTEGRATION
    // =============================================================================

    /**
     * Decodes FLEETS.COMMAND into a typed FleetCommandObject.
     *
     * Returns null when the column is empty or the data is malformed.
     * Requires starmade-decoder to be installed.
     *
     * @example
     * const cmd = fleet.decodeCommand();
     * if (cmd) console.log(cmd.commandType, cmd.firstVec3iArg);
     */
    public decodeCommand(): import('starmade-decoder').FleetCommandObject | null {
        const raw = this.getCommand();
        if (!raw || raw.length === 0) return null;
        const { FleetCommandObject } = require('starmade-decoder');
        return FleetCommandObject.fromBytes(raw);
    }

    /**
     * Decodes FLEETS.SAVED_REMOTES into a typed FleetRemotesObject.
     *
     * Handles both the network DataOutput format and the Java ObjectOutputStream
     * format (AC ED magic). Returns an empty object for null/empty input.
     *
     * @example
     * const remotes = fleet.decodeRemotes();
     * console.log(remotes.activeNames); // ['door_alpha', ...]
     */
    public decodeRemotes(): import('starmade-decoder').FleetRemotesObject {
        const raw = this.getSavedRemotes();
        const { FleetRemotesObject } = require('starmade-decoder');
        return FleetRemotesObject.fromBytes(raw ?? null);
    }

    /**
     * Encodes and stores FLEETS.COMMAND from a typed FleetCommandObject or raw
     * FleetCommand structure.
     *
     * Passing null/undefined clears the column. Object inputs are padded to 1024
     * bytes by default, matching the StarMade Java VARBINARY size.
     *
     * @example
     * const { FleetCommandObject } = require('starmade-decoder');
     * fleet.encodeCommand(FleetCommandObject.create(42n, 'IDLE'));
     */
    public encodeCommand(
        command: import('starmade-decoder').FleetCommandObject | import('starmade-decoder').FleetCommand | null | undefined,
        padTo = 1024
    ): this {
        if (!command) return this.setCommand(undefined);

        const anyCommand = command as any;
        const raw = typeof anyCommand.toBytes === 'function'
            ? anyCommand.toBytes(padTo)
            : require('starmade-decoder').encodeFleetCommand(command, padTo);

        return this.setCommand(raw);
    }

    /**
     * Encodes and stores FLEETS.SAVED_REMOTES from a FleetRemotesObject, Map, or
     * plain record. The writer always uses the portable DataOutput/network format.
     *
     * Passing null/undefined clears the column.
     *
     * @example
     * const remotes = fleet.decodeRemotes().withRemote('door_alpha', true);
     * fleet.encodeRemotes(remotes);
     */
    public encodeRemotes(
        remotes: import('starmade-decoder').FleetRemotesObject | Map<string, boolean> | Record<string, boolean> | null | undefined
    ): this {
        if (!remotes) return this.setSavedRemotes(undefined);

        const anyRemotes = remotes as any;
        if (typeof anyRemotes.toBytes === 'function') {
            return this.setSavedRemotes(anyRemotes.toBytes());
        }

        const entries = remotes instanceof Map
            ? remotes
            : new Map(Object.entries(remotes as Record<string, boolean>));
        const { encodeFleetRemotes } = require('starmade-decoder');
        return this.setSavedRemotes(encodeFleetRemotes(entries));
    }

    // =============================================================================
    // UTILITY AND ANALYSIS METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Get comprehensive fleet summary with relationship data
     */
    public getFleetSummary(): {
        id: number;
        name: string | undefined;
        flagshipName?: string;
        ownerName?: string;
        parentFleetName?: string;
        type: FleetType | null;
        mission: string;
        missionState: MissionString | null;
        missionCategory: FleetMissionCategory;
        combat: string;
        access: string;
        isNPC: boolean;
        isPlayerOwned: boolean;
        hasParent: boolean;
        hasChildren: boolean;
        childFleetsCount: number;
        hasRemotes: boolean;
        hasCommands: boolean;
        relationshipStatus: {
            hasFlagshipLoaded: boolean;
            hasOwnerPlayerLoaded: boolean;
            hasParentFleetLoaded: boolean;
            hasChildFleetsLoaded: boolean;
            hasAllRelationsLoaded: boolean;
        };
    } {
        return {
            id: this.getId(),
            name: this.getName(),
            flagshipName: this.getFlagshipName(),
            ownerName: this.getOwnerName(),
            parentFleetName: this.getParentFleetName(),
            type: this.getFleetType(),
            mission: this.getCurrentMission(),
            missionState: this.getMissionState(),
            missionCategory: this.getMissionCategory(),
            combat: this.getCombatBehavior(),
            access: this.getAccessDescription(),
            isNPC: this.isNPCFleet(),
            isPlayerOwned: this.isPlayerOwned(),
            hasParent: this.hasParent(),
            hasChildren: this.hasChildren(),
            childFleetsCount: this.getChildFleetsCount(),
            hasRemotes: this.hasRemoteControls(),
            hasCommands: this.hasCommandData(),
            relationshipStatus: {
                hasFlagshipLoaded: this.hasFlagshipLoaded(),
                hasOwnerPlayerLoaded: this.hasOwnerPlayerLoaded(),
                hasParentFleetLoaded: this.hasParentFleetLoaded(),
                hasChildFleetsLoaded: this.hasChildFleetsLoaded(),
                hasAllRelationsLoaded: this.hasAllRelationsLoaded()
            }
        };
    }

    /**
     * Generate fleet display name with enhanced info
     */
    public getDisplayName(): string {
        const name = this.getName();
        if (name) return name;

        const flagshipName = this.getFlagshipName();
        const ownerName = this.getOwnerName();
        const type = this.getFleetType();
        const id = this.getId();
        
        if (flagshipName) {
            return `Fleet ${id} (${flagshipName})`;
        }
        
        if (ownerName && type) {
            return `${ownerName}'s ${type} Fleet ${id}`;
        }
        
        if (type) {
            return `${type} Fleet ${id}`;
        }

        return `Fleet ${id}`;
    }

    /**
     * Get operational status assessment with relationship intelligence
     */
    public getOperationalStatus(): {
        isOperational: boolean;
        status: 'ACTIVE' | 'IDLE' | 'COMBAT' | 'SPECIAL' | 'UNKNOWN';
        issues: string[];
        capabilities: string[];
        intelligence?: {
            flagshipType?: string;
            ownerRole?: string;
            hierarchyDepth?: number;
            commandStructure?: string;
        };
    } {
        const issues: string[] = [];
        const capabilities: string[] = [];
        
        // Assess current state
        const mission = this.getMissionState();
        const category = this.getMissionCategory();
        
        let status: 'ACTIVE' | 'IDLE' | 'COMBAT' | 'SPECIAL' | 'UNKNOWN';
        
        switch (category) {
            case FleetMissionCategory.IDLE:
                status = 'IDLE';
                break;
            case FleetMissionCategory.COMBAT:
                status = 'COMBAT';
                capabilities.push('Combat operations');
                break;
            case FleetMissionCategory.SPECIAL:
                status = 'SPECIAL';
                capabilities.push('Special operations');
                break;
            case FleetMissionCategory.MOVEMENT:
            case FleetMissionCategory.OPERATIONS:
                status = 'ACTIVE';
                capabilities.push('Active operations');
                break;
            default:
                status = 'UNKNOWN';
                issues.push('Unknown mission state');
        }
        
        // Check for capabilities
        if (this.willEngage()) {
            capabilities.push('Combat ready');
        }
        
        if (this.hasRemoteControls()) {
            capabilities.push('Remote control');
        }
        
        if (this.hasCommandData()) {
            capabilities.push('Command system');
        }
        
        if (this.isTopLevel()) {
            capabilities.push('Independent command');
        }
        
        if (this.hasChildren()) {
            capabilities.push(`Fleet commander (${this.getChildFleetsCount()} sub-fleets)`);
        }
        
        // Check for issues
        if (!this.hasRecognizedMission()) {
            issues.push('Unrecognized mission');
        }

        // Enhanced intelligence from loaded relations
        let intelligence: any = undefined;
        if (this.hasCriticalRelationsLoaded()) {
            const flagship = this.getFlagship();
            const ownerPlayer = this.getOwnerPlayer();

            intelligence = {
                flagshipType: flagship && typeof flagship.getTypeName === 'function' ? flagship.getTypeName() : undefined,
                ownerRole: ownerPlayer && typeof ownerPlayer.getRole === 'function' ? ownerPlayer.getRole() : undefined,
                hierarchyDepth: this.getHierarchyDepth(),
                commandStructure: this.hasParent() ? 'Subordinate' : (this.hasChildren() ? 'Commander' : 'Independent')
            };
        }
        
        return {
            isOperational: issues.length === 0 || capabilities.length > 0,
            status,
            issues,
            capabilities,
            intelligence
        };
    }

    /**
     * Check if fleet can perform independent operations
     */
    public canOperateIndependently(): boolean {
        return this.isTopLevel() && this.hasRecognizedMission() && !this.isIdle();
    }

    /**
     * Get fleet hierarchy depth (0 for top-level)
     */
    public getHierarchyDepth(): number {
        return this.hasParent() ? 1 : 0; // Simplified - could be recursive for deeper hierarchies
    }

    /**
     * Check if fleet is suitable for combat
     */
    public isCombatReady(): boolean {
        return this.willEngage() && (this.isInCombat() || this.isAggressive());
    }

    /**
     * Get fleet command assessment
     */
    public getCommandAssessment(): {
        commandLevel: 'FLAGSHIP' | 'SQUADRON' | 'WING' | 'INDIVIDUAL';
        authority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
        span: number; // Number of units under command
        effectiveness: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
        recommendations: string[];
    } {
        const childCount = this.getChildFleetsCount();
        const recommendations: string[] = [];

        // Command level based on hierarchy
        let commandLevel: any = 'INDIVIDUAL';
        if (childCount >= 5) commandLevel = 'WING';
        else if (childCount >= 2) commandLevel = 'SQUADRON';
        else if (childCount >= 1 || this.hasParent()) commandLevel = 'FLAGSHIP';

        // Authority assessment
        let authority: any = 'NONE';
        if (this.isTopLevel() && childCount > 0) authority = 'HIGH';
        else if (this.hasParent() && childCount > 0) authority = 'MEDIUM';
        else if (this.isTopLevel()) authority = 'LOW';

        // Span of control
        const span = childCount + 1; // Include self

        // Effectiveness assessment
        let effectiveness: any = 'POOR';
        if (this.hasRecognizedMission() && this.willEngage() && childCount > 0) effectiveness = 'EXCELLENT';
        else if (this.hasRecognizedMission() && this.willEngage()) effectiveness = 'GOOD';
        else if (this.hasRecognizedMission()) effectiveness = 'FAIR';

        // Generate recommendations
        if (childCount === 0 && this.isTopLevel()) {
            recommendations.push('Consider organizing sub-fleets for better tactical flexibility');
        }
        if (!this.willEngage() && this.isInCombat()) {
            recommendations.push('Combat settings may be inappropriate for current mission');
        }
        if (!this.hasRemoteControls() && childCount > 0) {
            recommendations.push('Remote controls would improve fleet coordination');
        }

        return {
            commandLevel,
            authority,
            span,
            effectiveness,
            recommendations
        };
    }
}