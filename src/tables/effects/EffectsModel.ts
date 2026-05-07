/**
 * @fileoverview Effects Model
 * 
 * Model for the EFFECTS table storing entity effects and status conditions.
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
// EFFECTS ENUMS AND TYPES
// =============================================================================

/**
 * Effect types in StarMade
 */
export enum EffectType {
    OTHER = 0,
    STRUCTURE = 1,
    SECTOR = 2,
    SYSTEM = 3
}

/**
 * Effect categories for functional classification
 */
export enum EffectCategory {
    MOVEMENT = 'MOVEMENT',
    DEFENSIVE = 'DEFENSIVE', 
    OFFENSIVE = 'OFFENSIVE',
    POWER = 'POWER',
    UTILITY = 'UTILITY',
    STEALTH = 'STEALTH',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Known effect UIDs organized by category
 */
export const EFFECT_UIDS = {
    MOVEMENT: ['SPEED_BOOST', 'JUMP_DRIVE_CHARGE', 'THRUST_EFFECTIVENESS'] as const,
    DEFENSIVE: ['SHIELD_RECHARGE', 'SHIELD_CAPACITY', 'ARMOR_EFFECTIVENESS', 'ION_RESISTANCE'] as const,
    OFFENSIVE: ['DAMAGE_MULTIPLIER'] as const,
    POWER: ['POWER_GENERATION', 'POWER_CAPACITY'] as const,
    UTILITY: ['MINING_EFFECTIVENESS', 'SCANNER_RANGE'] as const,
    STEALTH: ['STEALTH', 'JAMMING', 'CLOAKING'] as const
} as const;

/**
 * All known effect UIDs as a flat array
 */
export const ALL_EFFECT_UIDS = [
    ...EFFECT_UIDS.MOVEMENT,
    ...EFFECT_UIDS.DEFENSIVE,
    ...EFFECT_UIDS.OFFENSIVE,
    ...EFFECT_UIDS.POWER,
    ...EFFECT_UIDS.UTILITY,
    ...EFFECT_UIDS.STEALTH
] as const;

// =============================================================================
// EFFECTS MODEL
// =============================================================================

/**
 * Model for the EFFECTS table - Enhanced Edition with Complete Relations
 * 
 * Simple entity effects management with bidirectional relationships,
 * based on actual StarMade database structure.
 */
export class EffectsModel extends BaseModel {
    public static tableName = 'EFFECTS';
    
    public static schema: TableSchema = {
        tableName: 'EFFECTS',
        comment: 'Entity effects and status conditions',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Effect identifier'
            }),
            column('ENTITY_ID', DataType.BIGINT, {
                nullable: false,
                comment: 'Target entity ID'
            }),
            column('TYPE', DataType.INTEGER, {
                nullable: false,
                comment: 'Effect type (see EffectType enum)'
            }),
            column('EFFECT_UID', DataType.VARCHAR, {
                length: 128,
                nullable: true,
                comment: 'Effect unique identifier'
            })
        ],

        primaryKey: ['ID'],
        
        foreignKeys: [
            foreignKey('FK_EFFECT_ENTITY', ['ENTITY_ID'], 'ENTITIES', ['ID'], {
                onDelete: ForeignKeyAction.CASCADE,
                onUpdate: ForeignKeyAction.CASCADE
            })
        ],

        indexes: [
            index('EFFECTS_PK', ['ENTITY_ID']),
            index('EFFECTS_TYPE', ['TYPE']),
            index('EFFECTS_UIDK', ['EFFECT_UID']),
            index('EFFECTS_TYPE_ENT', ['TYPE', 'ENTITY_ID'])
        ],

        validationRules: [
            validation('ENTITY_ID', 'required'),
            validation('TYPE', 'required'),
            validation('TYPE', 'custom', {
                validator: (type: number) => {
                    const validTypes = Object.values(EffectType).filter(v => typeof v === 'number');
                    return validTypes.includes(type) || `Invalid effect type: ${type}`;
                },
                message: 'Invalid effect type'
            }),
            validation('EFFECT_UID', 'maxLength', {
                value: 128,
                message: 'Effect UID cannot exceed 128 characters'
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
            /** Entity affected by this effect (EFFECTS.ENTITY_ID -> ENTITIES.ID) */
            entity: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../entities/EntitiesModel.js').EntitiesModel;
                },
                {
                    from: 'EFFECTS.ENTITY_ID',
                    to: 'ENTITIES.ID'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { 
        const id = this.get('ID');
        return typeof id === 'string' ? parseInt(id, 10) : id;
    }
    public setId(id: number): this { return this.set('ID', id); }

    public getEntityId(): number { 
        const entityId = this.get('ENTITY_ID');
        return typeof entityId === 'string' ? parseInt(entityId, 10) : entityId;
    }
    public setEntityId(entityId: number): this { return this.set('ENTITY_ID', entityId); }

    public getType(): EffectType { return this.get('TYPE'); }
    public setType(type: EffectType): this { return this.set('TYPE', type); }

    public getEffectUid(): string | undefined { return this.get('EFFECT_UID'); }
    public setEffectUid(effectUid: string | undefined): this { return this.set('EFFECT_UID', effectUid); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the entity affected by this effect */
    public getEntity(): any | undefined {
        return this.getRelated<any>('entity');
    }

    /** Set the entity affected by this effect */
    public setEntity(entity: any | undefined): this {
        return this.setRelated('entity', entity);
    }

    /** Check if entity relation is loaded */
    public hasEntityLoaded(): boolean {
        return this.hasRelated('entity');
    }

    // =============================================================================
    // ENHANCED METHODS WITH RELATIONSHIP DATA
    // =============================================================================

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
     * Get entity type from loaded relation
     */
    public getEntityTypeName(): string | undefined {
        const entity = this.getEntity();
        if (entity && this.hasEntityLoaded()) {
            return typeof entity.getTypeName === 'function' ? entity.getTypeName() : undefined;
        }
        return undefined;
    }

    /**
     * Get entity display name with enhanced info
     */
    public getEntityDisplayName(): string {
        const entityName = this.getEntityName();
        if (entityName) return entityName;
        
        const entityId = this.getEntityId();
        const entityType = this.getEntityTypeName();
        if (entityType) {
            return `${entityType} ${entityId}`;
        }
        
        return `Entity ${entityId}`;
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS
    // =============================================================================

    /**
     * Get effect type name
     */
    public getTypeName(): string {
        return EffectType[this.getType()] || `UNKNOWN_${this.getType()}`;
    }

    /**
     * Check if effect UID is recognized
     */
    public isRecognizedEffect(): boolean {
        const uid = this.getEffectUid();
        return uid ? (ALL_EFFECT_UIDS as readonly string[]).includes(uid) : false;
    }

    /**
     * Get effect category based on UID
     */
    public getCategory(): EffectCategory {
        const uid = this.getEffectUid();
        if (!uid) return EffectCategory.UNKNOWN;

        for (const [category, uids] of Object.entries(EFFECT_UIDS)) {
            if ((uids as readonly string[]).includes(uid)) {
                return category as EffectCategory;
            }
        }

        return EffectCategory.UNKNOWN;
    }

    /**
     * Check if effect is movement-related
     */
    public isMovementEffect(): boolean {
        return this.getCategory() === EffectCategory.MOVEMENT;
    }

    /**
     * Check if effect is defensive
     */
    public isDefensiveEffect(): boolean {
        return this.getCategory() === EffectCategory.DEFENSIVE;
    }

    /**
     * Check if effect is offensive
     */
    public isOffensiveEffect(): boolean {
        return this.getCategory() === EffectCategory.OFFENSIVE;
    }

    /**
     * Check if effect is power-related
     */
    public isPowerEffect(): boolean {
        return this.getCategory() === EffectCategory.POWER;
    }

    /**
     * Check if effect is utility-related
     */
    public isUtilityEffect(): boolean {
        return this.getCategory() === EffectCategory.UTILITY;
    }

    /**
     * Check if effect is stealth-related
     */
    public isStealthEffect(): boolean {
        return this.getCategory() === EffectCategory.STEALTH;
    }

    /**
     * Check if effect is structure-scoped
     */
    public isStructureScoped(): boolean {
        return this.getType() === EffectType.STRUCTURE;
    }

    /**
     * Check if effect is sector-scoped
     */
    public isSectorScoped(): boolean {
        return this.getType() === EffectType.SECTOR;
    }

    /**
     * Check if effect is system-scoped
     */
    public isSystemScoped(): boolean {
        return this.getType() === EffectType.SYSTEM;
    }

    /**
     * Check if effect affects combat performance
     */
    public affectsCombatPerformance(): boolean {
        return this.isOffensiveEffect() || this.isDefensiveEffect() || this.isStealthEffect();
    }

    /**
     * Check if effect affects ship operation
     */
    public affectsShipOperation(): boolean {
        return this.isMovementEffect() || this.isPowerEffect() || this.isUtilityEffect();
    }

    /**
     * Get scope description
     */
    public getScopeDescription(): string {
        switch (this.getType()) {
            case EffectType.STRUCTURE:
                return 'Applied to ships, stations, structures';
            case EffectType.SECTOR:
                return 'Environmental effects affecting regions';
            case EffectType.SYSTEM:
                return 'Large-scale effects across star systems';
            case EffectType.OTHER:
                return 'General/miscellaneous effects';
            default:
                return 'Unknown scope';
        }
    }

    // =============================================================================
    // SUMMARY METHODS
    // =============================================================================

    /**
     * Get effect summary with relationship data
     */
    public getEffectSummary(): {
        id: number;
        entityId: number;
        entityName?: string;
        entityType?: string;
        type: EffectType;
        typeName: string;
        effectUid?: string;
        category: EffectCategory;
        isRecognized: boolean;
        scope: string;
        affectsCombat: boolean;
        affectsOperation: boolean;
        relationshipStatus: {
            hasEntityLoaded: boolean;
        };
    } {
        return {
            id: this.getId(),
            entityId: this.getEntityId(),
            entityName: this.getEntityName(),
            entityType: this.getEntityTypeName(),
            type: this.getType(),
            typeName: this.getTypeName(),
            effectUid: this.getEffectUid(),
            category: this.getCategory(),
            isRecognized: this.isRecognizedEffect(),
            scope: this.getScopeDescription(),
            affectsCombat: this.affectsCombatPerformance(),
            affectsOperation: this.affectsShipOperation(),
            relationshipStatus: {
                hasEntityLoaded: this.hasEntityLoaded()
            }
        };
    }
}