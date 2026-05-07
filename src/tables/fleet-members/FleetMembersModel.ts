/**
 * @fileoverview Fleet Members Model
 * 
 * Model for the FLEET_MEMBERS table establishing relationships between fleets and entities.
 * Provides fleet composition management with member-specific configurations.
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
// FLEET MEMBERS ENUMS AND TYPES
// =============================================================================

/**
 * Active mission states for fleet members
 */
export enum MemberMissionState {
    // Basic States
    IDLE = 'IDLE',
    IDLE_SENTRY = 'IDLE - SENTRY',
    SENTRY_FORMATION = 'SENTRY - FORMATION',
    CALLBACK_TO_CARRIER = 'CALLBACK TO CARRIER',
    
    // Operational States
    MINING = 'MINING',
    PATROLLING = 'PATROLLING',
    TRADING = 'TRADING',
    MOVING = 'MOVING',
    REPAIRING = 'REPAIRING',
    
    // Combat States
    STANDOFF = 'STANDOFF',
    ATTACKING = 'ATTACKING',
    SENTRY = 'SENTRY',
    DEFENDING = 'DEFENDING',
    ESCORTING = 'ESCORTING',
    
    // Special States
    CLOAKING = 'CLOAKING',
    UNCLOAKING = 'UNCLOAKING',
    JAMMING = 'JAMMING',
    STOP_JAMMING = 'STOP JAMMING',
    FTL_INTERDICTING = 'FTL INTERDICTING',
    STOP_FTL_INTERDICTION = 'STOP FTL INTERDICTION'
}

/**
 * Mission categories for classification
 */
export enum MissionCategory {
    IDLE = 'IDLE',
    MOVEMENT = 'MOVEMENT',
    COMBAT = 'COMBAT',
    OPERATIONS = 'OPERATIONS',
    SUPPORT = 'SUPPORT',
    SPECIAL = 'SPECIAL'
}

/**
 * Member priority levels based on fleet position
 */
export enum MemberPriority {
    FLAGSHIP = 'FLAGSHIP',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

/**
 * Docking status types
 */
export enum DockingStatus {
    FREE_FLOATING = 'FREE_FLOATING',
    DOCKED_TO_FLEET_MEMBER = 'DOCKED_TO_FLEET_MEMBER',
    DOCKED_TO_STATION = 'DOCKED_TO_STATION',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Known faction constants
 */
export const KnownFleetFactions = {
    NO_FACTION: 0,
    TRADING_GUILD: -10000000,
    OUTCASTS: -9999999,
    SCAVENGERS: -9999998
} as const;

/**
 * Mission state classification mappings
 */
export const MISSION_CATEGORIES = {
    [MissionCategory.IDLE]: [
        MemberMissionState.IDLE,
        MemberMissionState.IDLE_SENTRY
    ],
    [MissionCategory.MOVEMENT]: [
        MemberMissionState.MOVING,
        MemberMissionState.PATROLLING,
        MemberMissionState.CALLBACK_TO_CARRIER
    ],
    [MissionCategory.COMBAT]: [
        MemberMissionState.ATTACKING,
        MemberMissionState.DEFENDING,
        MemberMissionState.STANDOFF,
        MemberMissionState.ESCORTING,
        MemberMissionState.SENTRY,
        MemberMissionState.SENTRY_FORMATION
    ],
    [MissionCategory.OPERATIONS]: [
        MemberMissionState.MINING,
        MemberMissionState.TRADING,
        MemberMissionState.REPAIRING
    ],
    [MissionCategory.SUPPORT]: [
        MemberMissionState.REPAIRING
    ],
    [MissionCategory.SPECIAL]: [
        MemberMissionState.CLOAKING,
        MemberMissionState.UNCLOAKING,
        MemberMissionState.JAMMING,
        MemberMissionState.STOP_JAMMING,
        MemberMissionState.FTL_INTERDICTING,
        MemberMissionState.STOP_FTL_INTERDICTION
    ]
} as const;

// =============================================================================
// FLEET MEMBERS MODEL
// =============================================================================

/**
 * Model for the FLEET_MEMBERS table - Enhanced Edition with Complete Relations
 * 
 * Advanced fleet composition management with complete bidirectional relationships,
 * comprehensive member analytics, and docking chain analysis.
 */
export class FleetMembersModel extends BaseModel {
    public static tableName = 'FLEET_MEMBERS';
    
    public static schema: TableSchema = {
        tableName: 'FLEET_MEMBERS',
        comment: 'Fleet composition and member relationships',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Member record ID'
            }),
            column('FLEET_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Parent fleet ID'
            }),
            column('ENTITY_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Member entity ID'
            }),
            column('MISSION_STRING', DataType.VARCHAR, {
                length: 1024,
                nullable: true,
                comment: 'Individual member mission'
            }),
            column('LIST_INDEX', DataType.INTEGER, {
                nullable: false,
                comment: 'Position in fleet hierarchy'
            }),
            column('DOCKED_TO', DataType.BIGINT, {
                nullable: false,
                comment: 'ID of entity docked to (-1 if not docked)'
            }),
            column('FACTION', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Faction ID'
            })
        ],

        primaryKey: ['ID'],
        
        foreignKeys: [
            foreignKey('FK_FLEET_MEMBER_FLEET', ['FLEET_ID'], 'FLEETS', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE,
                onUpdate: ForeignKeyAction.CASCADE
            }),
            foreignKey('FK_FLEET_MEMBER_ENTITY', ['ENTITY_ID'], 'ENTITIES', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE,
                onUpdate: ForeignKeyAction.CASCADE
            })
        ],

        indexes: [
            index('ffid', ['FLEET_ID']),
            index('eid', ['ENTITY_ID']),
            index('ffeid', ['FLEET_ID', 'ENTITY_ID'])
        ],

        validationRules: [
            validation('FLEET_ID', 'required'),
            validation('ENTITY_ID', 'required'),
            validation('LIST_INDEX', 'required'),
            validation('LIST_INDEX', 'min', {
                value: 0,
                message: 'List index cannot be negative'
            }),
            validation('DOCKED_TO', 'required'),
            validation('FACTION', 'required'),
            validation('MISSION_STRING', 'maxLength', {
                value: 1024,
                message: 'Mission string cannot exceed 1024 characters'
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
            /** Fleet this member belongs to (FLEET_MEMBERS.FLEET_ID -> FLEETS.ID) */
            fleet: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../fleets/FleetsModel.js').FleetsModel;
                },
                {
                    from: 'FLEET_MEMBERS.FLEET_ID',
                    to: 'FLEETS.ID'
                }
            ),

            /** Entity that is a member of the fleet (FLEET_MEMBERS.ENTITY_ID -> ENTITIES.ID) */
            entity: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../entities/EntitiesModel.js').EntitiesModel;
                },
                {
                    from: 'FLEET_MEMBERS.ENTITY_ID',
                    to: 'ENTITIES.ID'
                }
            ),

            /** Entity this member is docked to (FLEET_MEMBERS.DOCKED_TO -> ENTITIES.ID) */
            dockedToEntity: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../entities/EntitiesModel.js').EntitiesModel;
                },
                {
                    from: 'FLEET_MEMBERS.DOCKED_TO',
                    to: 'ENTITIES.ID'
                },
                {
                    // Custom filter to handle -1 values (not docked)
                    filter: { 'FLEET_MEMBERS.DOCKED_TO': { $ne: -1 } }
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getFleetId(): number { return this.get('FLEET_ID'); }
    public setFleetId(fleetId: number): this { return this.set('FLEET_ID', fleetId); }

    public getEntityId(): number { return this.get('ENTITY_ID'); }
    public setEntityId(entityId: number): this { return this.set('ENTITY_ID', entityId); }

    public getMissionString(): string | undefined { return this.get('MISSION_STRING'); }
    public setMissionString(missionString: string | undefined): this { return this.set('MISSION_STRING', missionString); }

    public getListIndex(): number { return this.get('LIST_INDEX'); }
    public setListIndex(listIndex: number): this { return this.set('LIST_INDEX', listIndex); }

    public getDockedTo(): number { return this.get('DOCKED_TO'); }
    public setDockedTo(dockedTo: number): this { return this.set('DOCKED_TO', dockedTo); }

    public getFaction(): number { return this.get('FACTION'); }
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the fleet this member belongs to */
    public getFleet(): any | undefined {
        return this.getRelated<any>('fleet');
    }

    /** Set the fleet this member belongs to */
    public setFleet(fleet: any | undefined): this {
        return this.setRelated('fleet', fleet);
    }

    /** Get the entity that is a member of the fleet */
    public getEntity(): any | undefined {
        return this.getRelated<any>('entity');
    }

    /** Set the entity that is a member of the fleet */
    public setEntity(entity: any | undefined): this {
        return this.setRelated('entity', entity);
    }

    /** Get the entity this member is docked to (null if not docked) */
    public getDockedToEntity(): any | undefined {
        return this.getRelated<any>('dockedToEntity');
    }

    /** Set the entity this member is docked to */
    public setDockedToEntity(entity: any | undefined): this {
        return this.setRelated('dockedToEntity', entity);
    }

    /** Check if fleet relation is loaded */
    public hasFleetLoaded(): boolean {
        return this.hasRelated('fleet');
    }

    /** Check if entity relation is loaded */
    public hasEntityLoaded(): boolean {
        return this.hasRelated('entity');
    }

    /** Check if docked-to entity relation is loaded */
    public hasDockedToEntityLoaded(): boolean {
        return this.hasRelated('dockedToEntity');
    }

    /** Check if all relations are loaded */
    public hasAllRelationsLoaded(): boolean {
        return this.hasFleetLoaded() && this.hasEntityLoaded() && 
               (this.hasDockedToEntityLoaded() || !this.isDocked());
    }

    /** Check if critical relations are loaded (fleet and entity) */
    public hasCriticalRelationsLoaded(): boolean {
        return this.hasFleetLoaded() && this.hasEntityLoaded();
    }

    // =============================================================================
    // ENHANCED METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get fleet name from loaded relation
     */
    public getFleetName(): string | undefined {
        const fleet = this.getFleet();
        if (fleet && this.hasFleetLoaded()) {
            return typeof fleet.getName === 'function' ? fleet.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get entity name from loaded relation
     */
    public getEntityName(): string | undefined {
        const entity = this.getEntity();
        if (entity && this.hasEntityLoaded()) {
            return typeof entity.getName === 'function' ? entity.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get docked-to entity name from loaded relation
     */
    public getDockedToEntityName(): string | undefined {
        const dockedToEntity = this.getDockedToEntity();
        if (dockedToEntity && this.hasDockedToEntityLoaded()) {
            return typeof dockedToEntity.getName === 'function' ? dockedToEntity.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get fleet display name with enhanced info
     */
    public getFleetDisplayName(): string {
        const fleetName = this.getFleetName();
        if (fleetName) return fleetName;
        
        const fleetId = this.getFleetId();
        return `Fleet ${fleetId}`;
    }

    /**
     * Get entity display name with enhanced info
     */
    public getEntityDisplayName(): string {
        const entityName = this.getEntityName();
        if (entityName) return entityName;
        
        const entityId = this.getEntityId();
        return `Entity ${entityId}`;
    }

    // =============================================================================
    // MISSION STATE METHODS
    // =============================================================================

    /**
     * Get normalized mission state
     */
    public getMissionState(): MemberMissionState | null {
        const mission = this.getMissionString()?.toUpperCase();
        if (!mission) return null;

        // Try exact match first
        for (const state of Object.values(MemberMissionState)) {
            if (mission === state.toUpperCase()) {
                return state;
            }
        }

        // Try partial matches for common variations
        if (mission.includes('IDLE')) return MemberMissionState.IDLE;
        if (mission.includes('SENTRY')) {
            if (mission.includes('FORMATION')) return MemberMissionState.SENTRY_FORMATION;
            return MemberMissionState.SENTRY;
        }
        if (mission.includes('ATTACK')) return MemberMissionState.ATTACKING;
        if (mission.includes('DEFEND')) return MemberMissionState.DEFENDING;
        if (mission.includes('MINING')) return MemberMissionState.MINING;
        if (mission.includes('TRADING')) return MemberMissionState.TRADING;
        if (mission.includes('PATROL')) return MemberMissionState.PATROLLING;
        if (mission.includes('MOVING')) return MemberMissionState.MOVING;
        if (mission.includes('REPAIR')) return MemberMissionState.REPAIRING;
        if (mission.includes('CALLBACK') || mission.includes('CARRIER')) return MemberMissionState.CALLBACK_TO_CARRIER;
        if (mission.includes('STANDOFF')) return MemberMissionState.STANDOFF;
        if (mission.includes('ESCORT')) return MemberMissionState.ESCORTING;
        if (mission.includes('CLOAK')) {
            if (mission.includes('UN')) return MemberMissionState.UNCLOAKING;
            return MemberMissionState.CLOAKING;
        }
        if (mission.includes('JAM')) {
            if (mission.includes('STOP')) return MemberMissionState.STOP_JAMMING;
            return MemberMissionState.JAMMING;
        }
        if (mission.includes('INTERDICT')) {
            if (mission.includes('STOP')) return MemberMissionState.STOP_FTL_INTERDICTION;
            return MemberMissionState.FTL_INTERDICTING;
        }

        return null;
    }

    /**
     * Get mission category
     */
    public getMissionCategory(): MissionCategory {
        const state = this.getMissionState();
        if (!state) return MissionCategory.IDLE;

        for (const [category, states] of Object.entries(MISSION_CATEGORIES)) {
            if ((states as readonly MemberMissionState[]).includes(state)) {
                return category as MissionCategory;
            }
        }

        return MissionCategory.IDLE;
    }

    /**
     * Check if member has a recognized mission state
     */
    public hasRecognizedMission(): boolean {
        return this.getMissionState() !== null;
    }

    /**
     * Check if this member has an individual mission
     */
    public hasIndividualMission(): boolean {
        const mission = this.getMissionString();
        return mission !== null && mission !== undefined && mission.trim() !== '';
    }

    /**
     * Get current mission status (with fallback)
     */
    public getCurrentMission(): string {
        return this.getMissionString() || 'No Mission';
    }

    // =============================================================================
    // STATE CHECK METHODS
    // =============================================================================

    /**
     * Check if member is idle
     */
    public isIdle(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.IDLE;
    }

    /**
     * Check if member is in combat mode
     */
    public isInCombat(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.COMBAT;
    }

    /**
     * Check if member is mining
     */
    public isMining(): boolean {
        const state = this.getMissionState();
        return state === MemberMissionState.MINING;
    }

    /**
     * Check if member is trading
     */
    public isTrading(): boolean {
        const state = this.getMissionState();
        return state === MemberMissionState.TRADING;
    }

    /**
     * Check if member is moving
     */
    public isMoving(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.MOVEMENT;
    }

    /**
     * Check if member is in sentry mode
     */
    public isSentry(): boolean {
        const state = this.getMissionState();
        return state === MemberMissionState.SENTRY || 
               state === MemberMissionState.SENTRY_FORMATION ||
               state === MemberMissionState.IDLE_SENTRY;
    }

    /**
     * Check if member is performing operations
     */
    public isPerformingOperations(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.OPERATIONS;
    }

    /**
     * Check if member is in special mode (stealth/EW)
     */
    public isInSpecialMode(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.SPECIAL;
    }

    /**
     * Check if member is providing support
     */
    public isProvidingSupport(): boolean {
        const category = this.getMissionCategory();
        return category === MissionCategory.SUPPORT;
    }

    // =============================================================================
    // DOCKING AND POSITION METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Check if this member is docked
     */
    public isDocked(): boolean {
        return this.getDockedTo() !== -1;
    }

    /**
     * Check if member is flagship (index 0)
     */
    public isFlagship(): boolean {
        return this.getListIndex() === 0;
    }

    /**
     * Check if member is docked to another fleet member
     */
    public isDockedToFleetMember(): boolean {
        return this.isDocked() && this.getDockedTo() > 0;
    }

    /**
     * Get docking status with enhanced entity information
     */
    public getDockingStatus(): DockingStatus {
        if (!this.isDocked()) return DockingStatus.FREE_FLOATING;
        
        const dockedTo = this.getDockedTo();
        if (dockedTo > 0) {
            // Enhanced with relationship data
            const dockedToEntity = this.getDockedToEntity();
            if (dockedToEntity && this.hasDockedToEntityLoaded()) {
                // Could analyze entity type to determine if it's a station or fleet member
                return DockingStatus.DOCKED_TO_FLEET_MEMBER;
            }
            return DockingStatus.DOCKED_TO_FLEET_MEMBER;
        }
        
        return DockingStatus.UNKNOWN;
    }

    /**
     * Get docking status description with enhanced info
     */
    public getDockingStatusDescription(): string {
        if (!this.isDocked()) return 'Free-floating';
        
        const dockedTo = this.getDockedTo();
        if (dockedTo === -1) return 'Not docked';
        
        const dockedToEntityName = this.getDockedToEntityName();
        if (dockedToEntityName) {
            return `Docked to ${dockedToEntityName}`;
        }
        
        return `Docked to entity ${dockedTo}`;
    }

    /**
     * Get member priority based on list index
     */
    public getPriority(): MemberPriority {
        const index = this.getListIndex();
        if (index === 0) return MemberPriority.FLAGSHIP;
        if (index <= 2) return MemberPriority.HIGH;
        if (index <= 5) return MemberPriority.MEDIUM;
        return MemberPriority.LOW;
    }

    /**
     * Check if member is suitable for flagship role
     */
    public isSuitableForFlagship(): boolean {
        // Flagship should not be docked and should have low index
        return !this.isDocked() && this.getListIndex() <= 1;
    }

    // =============================================================================
    // FACTION METHODS
    // =============================================================================

    /**
     * Get faction name for known factions
     */
    public getFactionName(): string {
        const faction = this.getFaction();
        switch (faction) {
            case KnownFleetFactions.NO_FACTION:
                return 'No Faction';
            case KnownFleetFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownFleetFactions.OUTCASTS:
                return 'Outcasts';
            case KnownFleetFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return faction > 0 ? `Player Faction ${faction}` : `Unknown Faction ${faction}`;
        }
    }

    /**
     * Check if member belongs to NPC faction
     */
    public isNPCFaction(): boolean {
        const faction = this.getFaction();
        return faction < 0;
    }

    /**
     * Check if member belongs to player faction
     */
    public isPlayerFaction(): boolean {
        const faction = this.getFaction();
        return faction > 0;
    }

    /**
     * Check if member is neutral (no faction)
     */
    public isNeutral(): boolean {
        return this.getFaction() === KnownFleetFactions.NO_FACTION;
    }

    // =============================================================================
    // CAPABILITY METHODS
    // =============================================================================

    /**
     * Check if member can perform independent actions
     */
    public canActIndependently(): boolean {
        return this.hasIndividualMission() && !this.isDocked();
    }

    /**
     * Check if member can engage in combat
     */
    public canEngageInCombat(): boolean {
        const state = this.getMissionState();
        const combatStates = [
            MemberMissionState.ATTACKING,
            MemberMissionState.DEFENDING,
            MemberMissionState.ESCORTING,
            MemberMissionState.SENTRY,
            MemberMissionState.SENTRY_FORMATION
        ];
        return combatStates.includes(state as any);
    }

    /**
     * Check if member is available for assignment
     */
    public isAvailableForAssignment(): boolean {
        return this.isIdle() && !this.isDocked();
    }

    /**
     * Check if member is in formation
     */
    public isInFormation(): boolean {
        const state = this.getMissionState();
        return state === MemberMissionState.SENTRY_FORMATION;
    }

    // =============================================================================
    // SUMMARY AND ANALYSIS METHODS - ENHANCED WITH RELATIONS
    // =============================================================================

    /**
     * Get comprehensive member status summary with relationship data
     */
    public getStatusSummary(): {
        id: number;
        fleetId: number;
        fleetName?: string;
        entityId: number;
        entityName?: string;
        position: number;
        mission: string;
        missionState: MemberMissionState | null;
        missionCategory: MissionCategory;
        isDocked: boolean;
        dockedToEntityName?: string;
        dockingStatus: DockingStatus;
        dockingDescription: string;
        isIdle: boolean;
        priority: MemberPriority;
        faction: string;
        canActIndependently: boolean;
        isRecognizedMission: boolean;
        relationshipStatus: {
            hasFleetLoaded: boolean;
            hasEntityLoaded: boolean;
            hasDockedToEntityLoaded: boolean;
            hasCriticalRelationsLoaded: boolean;
            hasAllRelationsLoaded: boolean;
        };
    } {
        return {
            id: this.getId(),
            fleetId: this.getFleetId(),
            fleetName: this.getFleetName(),
            entityId: this.getEntityId(),
            entityName: this.getEntityName(),
            position: this.getListIndex(),
            mission: this.getCurrentMission(),
            missionState: this.getMissionState(),
            missionCategory: this.getMissionCategory(),
            isDocked: this.isDocked(),
            dockedToEntityName: this.getDockedToEntityName(),
            dockingStatus: this.getDockingStatus(),
            dockingDescription: this.getDockingStatusDescription(),
            isIdle: this.isIdle(),
            priority: this.getPriority(),
            faction: this.getFactionName(),
            canActIndependently: this.canActIndependently(),
            isRecognizedMission: this.hasRecognizedMission(),
            relationshipStatus: {
                hasFleetLoaded: this.hasFleetLoaded(),
                hasEntityLoaded: this.hasEntityLoaded(),
                hasDockedToEntityLoaded: this.hasDockedToEntityLoaded(),
                hasCriticalRelationsLoaded: this.hasCriticalRelationsLoaded(),
                hasAllRelationsLoaded: this.hasAllRelationsLoaded()
            }
        };
    }

    /**
     * Get operational readiness assessment with relationship intelligence
     */
    public getOperationalReadiness(): {
        isOperational: boolean;
        readinessLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
        issues: string[];
        capabilities: string[];
        intelligence?: {
            entityType?: string;
            fleetType?: string;
            dockingChain?: string;
        };
    } {
        const issues: string[] = [];
        const capabilities: string[] = [];
        
        // Check for issues
        if (this.isDocked()) {
            const dockedToName = this.getDockedToEntityName();
            if (dockedToName) {
                issues.push(`Docked to ${dockedToName}`);
            } else {
                issues.push('Currently docked');
            }
        }
        
        if (!this.hasRecognizedMission()) {
            issues.push('Unknown mission state');
        }
        
        // Assess capabilities
        if (this.canEngageInCombat()) {
            capabilities.push('Combat ready');
        }
        
        if (this.canActIndependently()) {
            capabilities.push('Independent operation');
        }
        
        if (this.isFlagship()) {
            capabilities.push('Fleet command');
        }
        
        // Determine readiness level
        let readinessLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
        if (issues.length === 0 && capabilities.length > 0) {
            readinessLevel = 'HIGH';
        } else if (issues.length === 1 || capabilities.length > 0) {
            readinessLevel = 'MEDIUM';
        } else if (issues.length > 1) {
            readinessLevel = 'LOW';
        } else {
            readinessLevel = 'UNAVAILABLE';
        }

        // Enhanced intelligence from loaded relations
        let intelligence: any = undefined;
        if (this.hasCriticalRelationsLoaded()) {
            const entity = this.getEntity();
            const fleet = this.getFleet();
            const dockedToEntity = this.getDockedToEntity();

            intelligence = {
                entityType: entity && typeof entity.getTypeName === 'function' ? entity.getTypeName() : undefined,
                fleetType: fleet && typeof fleet.getFleetType === 'function' ? fleet.getFleetType() : undefined,
                dockingChain: dockedToEntity ? 'Connected' : 'Independent'
            };
        }
        
        return {
            isOperational: readinessLevel !== 'UNAVAILABLE',
            readinessLevel,
            issues,
            capabilities,
            intelligence
        };
    }

    /**
     * Get docking chain analysis with relationship data
     */
    public getDockingChainAnalysis(): {
        isDocked: boolean;
        dockedToId: number;
        dockedToName?: string;
        dockingDepth: number; // Always 1 for this member, but useful for consistency
        chainLength: number; // Known length from this member down
        recommendations: string[];
    } {
        const recommendations: string[] = [];
        const isDocked = this.isDocked();
        const dockedToId = this.getDockedTo();
        const dockedToName = this.getDockedToEntityName();

        // Basic docking analysis
        let dockingDepth = 0;
        let chainLength = 1; // This member

        if (isDocked) {
            dockingDepth = 1;
            
            if (this.isFlagship()) {
                recommendations.push('?? Warning: Flagship is docked - may affect fleet command');
            }
            
            if (this.canEngageInCombat() && isDocked) {
                recommendations.push('?? Consider undocking for combat operations');
            }
        } else {
            if (this.isAvailableForAssignment()) {
                recommendations.push('? Available for independent operations');
            }
        }

        return {
            isDocked,
            dockedToId,
            dockedToName,
            dockingDepth,
            chainLength,
            recommendations
        };
    }

    /**
     * Get member tactical assessment with enhanced relationship data
     */
    public getTacticalAssessment(): {
        role: 'FLAGSHIP' | 'COMBATANT' | 'SUPPORT' | 'SPECIALIST' | 'LOGISTICS' | 'UNKNOWN';
        effectiveness: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'INEFFECTIVE';
        deploymentStatus: 'READY' | 'PREPARING' | 'ENGAGED' | 'UNAVAILABLE';
        tacticalValue: number; // 0-100
        recommendations: string[];
        intelligence?: {
            fleetRole?: string;
            entityCapabilities?: string;
            optimalPosition?: number;
        };
    } {
        const recommendations: string[] = [];

        // Role assessment
        let role: any = 'UNKNOWN';
        if (this.isFlagship()) role = 'FLAGSHIP';
        else if (this.canEngageInCombat()) role = 'COMBATANT';
        else if (this.isProvidingSupport()) role = 'SUPPORT';
        else if (this.isInSpecialMode()) role = 'SPECIALIST';
        else if (this.isMining() || this.isTrading()) role = 'LOGISTICS';

        // Effectiveness assessment
        let effectiveness: any = 'POOR';
        if (this.hasRecognizedMission() && this.canActIndependently() && !this.isDocked()) {
            effectiveness = 'EXCELLENT';
        } else if (this.hasRecognizedMission() && this.canActIndependently()) {
            effectiveness = 'GOOD';
        } else if (this.hasRecognizedMission()) {
            effectiveness = 'FAIR';
        } else if (this.isDocked()) {
            effectiveness = 'INEFFECTIVE';
        }

        // Deployment status
        let deploymentStatus: any = 'UNAVAILABLE';
        if (this.isAvailableForAssignment()) deploymentStatus = 'READY';
        else if (this.isIdle()) deploymentStatus = 'PREPARING';
        else if (this.isInCombat() || this.isPerformingOperations()) deploymentStatus = 'ENGAGED';

        // Tactical value calculation
        let tacticalValue = 30; // Base value
        if (this.isFlagship()) tacticalValue += 30;
        if (this.canEngageInCombat()) tacticalValue += 20;
        if (this.canActIndependently()) tacticalValue += 15;
        if (this.hasRecognizedMission()) tacticalValue += 10;
        if (this.isDocked()) tacticalValue -= 20;
        if (!this.hasRecognizedMission()) tacticalValue -= 15;

        // Generate recommendations
        if (this.isDocked() && this.canEngageInCombat()) {
            recommendations.push('Undock for combat readiness');
        }
        if (!this.hasIndividualMission() && this.canActIndependently()) {
            recommendations.push('Assign individual mission for better tactical flexibility');
        }
        if (this.isFlagship() && this.isDocked()) {
            recommendations.push('Critical: Flagship should be undocked for command effectiveness');
        }

        // Enhanced intelligence
        let intelligence: any = undefined;
        if (this.hasCriticalRelationsLoaded()) {
            const entity = this.getEntity();
            const fleet = this.getFleet();

            intelligence = {
                fleetRole: fleet && typeof fleet.getMissionCategory === 'function' ? fleet.getMissionCategory() : undefined,
                entityCapabilities: entity && typeof entity.getTypeName === 'function' ? entity.getTypeName() : undefined,
                optimalPosition: this.isFlagship() ? 0 : (this.canEngageInCombat() ? 1 : this.getListIndex())
            };
        }

        return {
            role,
            effectiveness,
            deploymentStatus,
            tacticalValue: Math.max(0, Math.min(100, tacticalValue)),
            recommendations,
            intelligence
        };
    }
}