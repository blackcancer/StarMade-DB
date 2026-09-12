import * as related0 from '../systems/SystemsModel.js';
/**
 * @fileoverview NPC Stats Model
 * 
 * Model for the NPC_STATS table storing NPC spawn statistics.
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

/**
 * Model for the NPC_STATS table - Enhanced Edition with System Relations
 * 
 * Advanced NPC spawn statistics with complete bidirectional system relationships
 * and comprehensive analytics for faction spawn patterns.
 */
export class NPCStatsModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'NPC_STATS';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'NPC_STATS',
        comment: 'NPC spawn statistics by system',
        
        columns: [
            column('ID', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'NPC faction ID'
            }),
            column('SYS_X', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'System X coordinate'
            }),
            column('SYS_Y', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'System Y coordinate'
            }),
            column('SYS_Z', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'System Z coordinate'
            }),
            column('FLEET_SPAWNS', DataType.INTEGER, {
                nullable: true,
                defaultValue: 0,
                comment: 'Number of fleet spawns'
            }),
            column('ENTITY_SPAWNS', DataType.INTEGER, {
                nullable: true,
                defaultValue: 0,
                comment: 'Number of entity spawns'
            })
        ],

        primaryKey: ['ID', 'SYS_X', 'SYS_Y', 'SYS_Z'],
        foreignKeys: [],

        indexes: [
            index('NPC_STATS_COORDS_IDX', ['SYS_X', 'SYS_Y', 'SYS_Z']),
            index('NPC_STATS_FLEET_SPAWNS_IDX', ['FLEET_SPAWNS']),
            index('NPC_STATS_ENTITY_SPAWNS_IDX', ['ENTITY_SPAWNS'])
        ],

        validationRules: [
            validation('ID', 'required'),
            validation('SYS_X', 'required'),
            validation('SYS_Y', 'required'),
            validation('SYS_Z', 'required'),
            validation('FLEET_SPAWNS', 'min', {
                value: 0,
                message: 'Fleet spawns cannot be negative'
            }),
            validation('ENTITY_SPAWNS', 'min', {
                value: 0,
                message: 'Entity spawns cannot be negative'
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
            /** System that contains these NPC statistics (NPC_STATS.SYS_X/Y/Z -> SYSTEMS.X/Y/Z) */
            system: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.SystemsModel;
                },
                {
                    from: ['NPC_STATS.SYS_X', 'NPC_STATS.SYS_Y', 'NPC_STATS.SYS_Z'],
                    to: ['SYSTEMS.X', 'SYSTEMS.Y', 'SYSTEMS.Z']
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the NPC_STATS.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the NPC_STATS.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the NPC_STATS.SYS_X column from this model.
     * @returns The stored SYS_X value.
     */
    public getSysX(): number { return this.get('SYS_X'); }
    /**
     * Store the NPC_STATS.SYS_X column in this model and return this for chaining.
     * @param sysX New value for the SYS_X column.
     * @returns This model for chaining.
     */
    public setSysX(sysX: number): this { return this.set('SYS_X', sysX); }

    /**
     * Read the NPC_STATS.SYS_Y column from this model.
     * @returns The stored SYS_Y value.
     */
    public getSysY(): number { return this.get('SYS_Y'); }
    /**
     * Store the NPC_STATS.SYS_Y column in this model and return this for chaining.
     * @param sysY New value for the SYS_Y column.
     * @returns This model for chaining.
     */
    public setSysY(sysY: number): this { return this.set('SYS_Y', sysY); }

    /**
     * Read the NPC_STATS.SYS_Z column from this model.
     * @returns The stored SYS_Z value.
     */
    public getSysZ(): number { return this.get('SYS_Z'); }
    /**
     * Store the NPC_STATS.SYS_Z column in this model and return this for chaining.
     * @param sysZ New value for the SYS_Z column.
     * @returns This model for chaining.
     */
    public setSysZ(sysZ: number): this { return this.set('SYS_Z', sysZ); }

    /**
     * Read the NPC_STATS.FLEET_SPAWNS column from this model.
     * @returns The stored FLEET_SPAWNS value.
     */
    public getFleetSpawns(): number { return this.get('FLEET_SPAWNS') || 0; }
    /**
     * Store the NPC_STATS.FLEET_SPAWNS column in this model and return this for chaining.
     * @param fleetSpawns New value for the FLEET_SPAWNS column.
     * @returns This model for chaining.
     */
    public setFleetSpawns(fleetSpawns: number): this { return this.set('FLEET_SPAWNS', fleetSpawns); }

    /**
     * Read the NPC_STATS.ENTITY_SPAWNS column from this model.
     * @returns The stored ENTITY_SPAWNS value.
     */
    public getEntitySpawns(): number { return this.get('ENTITY_SPAWNS') || 0; }
    /**
     * Store the NPC_STATS.ENTITY_SPAWNS column in this model and return this for chaining.
     * @param entitySpawns New value for the ENTITY_SPAWNS column.
     * @returns This model for chaining.
     */
    public setEntitySpawns(entitySpawns: number): this { return this.set('ENTITY_SPAWNS', entitySpawns); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /** Get the system that contains these NPC statistics */
    public getSystem(): any | undefined {
        return this.getRelated<any>('system');
    }

    /** Set the system that contains these NPC statistics */
    public setSystem(system: any | undefined): this {
        return this.setRelated('system', system);
    }

    /** Check if system relation is loaded */
    public hasSystemLoaded(): boolean {
        return this.hasRelated('system');
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS - ENHANCED EDITION
    // =============================================================================

    /** Format the system coordinates as a parenthesized x, y, z triple. */
    public getSystemCoordinatesString(): string {
        return `(${this.getSysX()}, ${this.getSysY()}, ${this.getSysZ()})`;
    }

    /** Return the sum of fleet and individual entity spawn counts. */
    public getTotalSpawns(): number {
        return this.getFleetSpawns() + this.getEntitySpawns();
    }

    /** Resolve the three built-in NPC faction identifiers, falling back to the numeric faction identifier. */
    public getFactionName(): string {
        const id = this.getId();
        if (id === -10000000) return 'Trading Guild';
        if (id === -9999999) return 'Outcasts';
        if (id === -9999998) return 'Scavengers';
        return `Faction ${id}`;
    }

    // =============================================================================
    // ADVANCED NPC ANALYTICS (100/100 FEATURES)
    // =============================================================================

    /**
     * Check if this is a high-activity NPC system
     */
    public isHighActivitySystem(): boolean {
        return this.getTotalSpawns() > 10;
    }

    /**
     * Check if this system prefers fleet spawns over entity spawns
     */
    public prefersFleetSpawns(): boolean {
        const total = this.getTotalSpawns();
        if (total === 0) return false;
        return this.getFleetSpawns() > this.getEntitySpawns();
    }

    /**
     * Get spawn distribution ratio (fleet vs entity)
     */
    public getSpawnDistribution(): {
        fleetRatio: number;
        entityRatio: number;
        dominantType: 'FLEET' | 'ENTITY' | 'BALANCED' | 'NONE';
    } {
        const total = this.getTotalSpawns();
        
        if (total === 0) {
            return {
                fleetRatio: 0,
                entityRatio: 0,
                dominantType: 'NONE'
            };
        }

        const fleetRatio = this.getFleetSpawns() / total;
        const entityRatio = this.getEntitySpawns() / total;

        let dominantType: 'FLEET' | 'ENTITY' | 'BALANCED' = 'BALANCED';
        if (fleetRatio > 0.7) dominantType = 'FLEET';
        else if (entityRatio > 0.7) dominantType = 'ENTITY';

        return {
            fleetRatio: Math.round(fleetRatio * 100) / 100,
            entityRatio: Math.round(entityRatio * 100) / 100,
            dominantType
        };
    }

    /**
     * Get activity level based on spawn counts
     */
    public getActivityLevel(): 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
        const total = this.getTotalSpawns();
        
        if (total === 0) return 'NONE';
        if (total <= 3) return 'LOW';
        if (total <= 10) return 'MODERATE';
        if (total <= 25) return 'HIGH';
        return 'VERY_HIGH';
    }

    /**
     * Get threat assessment based on faction and spawn patterns
     */
    public getThreatAssessment(): {
        level: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
        reasoning: string[];
        factionThreat: 'FRIENDLY' | 'NEUTRAL' | 'HOSTILE' | 'UNKNOWN';
    } {
        const reasoning: string[] = [];
        const id = this.getId();
        const total = this.getTotalSpawns();
        
        // Determine faction threat level
        let factionThreat: 'FRIENDLY' | 'NEUTRAL' | 'HOSTILE' | 'UNKNOWN' = 'UNKNOWN';
        if (id === -10000000) {
            factionThreat = 'FRIENDLY';
            reasoning.push('Trading Guild - generally peaceful');
        } else if (id === -9999999) {
            factionThreat = 'HOSTILE';
            reasoning.push('Outcasts - aggressive faction');
        } else if (id === -9999998) {
            factionThreat = 'HOSTILE';
            reasoning.push('Scavengers - hostile faction');
        } else if (id < 0) {
            factionThreat = 'NEUTRAL';
            reasoning.push('Unknown NPC faction');
        } else {
            factionThreat = 'NEUTRAL';
            reasoning.push('Player or neutral faction');
        }

        // Assess threat level
        let level: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'SAFE';
        
        if (total === 0) {
            level = 'SAFE';
            reasoning.push('No NPC activity detected');
        } else if (factionThreat === 'FRIENDLY') {
            level = total > 15 ? 'LOW' : 'SAFE';
            reasoning.push('Friendly faction with manageable activity');
        } else if (factionThreat === 'HOSTILE') {
            if (total <= 5) level = 'MODERATE';
            else if (total <= 15) level = 'HIGH';
            else level = 'CRITICAL';
            reasoning.push(`High hostile NPC activity: ${total} total spawns`);
        } else {
            if (total <= 10) level = 'LOW';
            else if (total <= 20) level = 'MODERATE';
            else level = 'HIGH';
            reasoning.push('Neutral faction with varying activity levels');
        }

        return { level, reasoning, factionThreat };
    }

    /**
     * Generate comprehensive NPC statistics summary
     */
    public getNPCStatsSummary(): {
        basic: {
            id: number;
            factionName: string;
            systemCoordinates: string;
            fleetSpawns: number;
            entitySpawns: number;
            totalSpawns: number;
        };
        analysis: {
            activityLevel: ReturnType<NPCStatsModel['getActivityLevel']>;
            spawnDistribution: ReturnType<NPCStatsModel['getSpawnDistribution']>;
            threatAssessment: ReturnType<NPCStatsModel['getThreatAssessment']>;
            isHighActivity: boolean;
            prefersFleetSpawns: boolean;
        };
        system?: {
            hasSystemLoaded: boolean;
            systemInfo?: any;
        };
        recommendations: string[];
    } {
        const basic = {
            id: this.getId(),
            factionName: this.getFactionName(),
            systemCoordinates: this.getSystemCoordinatesString(),
            fleetSpawns: this.getFleetSpawns(),
            entitySpawns: this.getEntitySpawns(),
            totalSpawns: this.getTotalSpawns()
        };

        const analysis = {
            activityLevel: this.getActivityLevel(),
            spawnDistribution: this.getSpawnDistribution(),
            threatAssessment: this.getThreatAssessment(),
            isHighActivity: this.isHighActivitySystem(),
            prefersFleetSpawns: this.prefersFleetSpawns()
        };

        const system = {
            hasSystemLoaded: this.hasSystemLoaded(),
            systemInfo: this.hasSystemLoaded() ? this.getSystem() : undefined
        };

        // Generate recommendations
        const recommendations: string[] = [];
        
        if (analysis.threatAssessment.level === 'CRITICAL') {
            recommendations.push('?? CRITICAL THREAT: Avoid or prepare for heavy combat');
        } else if (analysis.threatAssessment.level === 'HIGH') {
            recommendations.push('?? HIGH THREAT: Exercise extreme caution');
        } else if (analysis.threatAssessment.level === 'MODERATE') {
            recommendations.push('? MODERATE THREAT: Be prepared for encounters');
        }

        if (analysis.isHighActivity) {
            recommendations.push('?? High NPC activity - expect frequent encounters');
        }

        if (analysis.spawnDistribution.dominantType === 'FLEET') {
            recommendations.push('?? Fleet-heavy activity - expect coordinated attacks');
        } else if (analysis.spawnDistribution.dominantType === 'ENTITY') {
            recommendations.push('?? Entity-heavy activity - expect individual encounters');
        }

        if (analysis.threatAssessment.factionThreat === 'FRIENDLY') {
            recommendations.push('?? Trading opportunities may be available');
        }

        return {
            basic,
            analysis,
            system,
            recommendations
        };
    }

    /**
     * Compare activity with another NPC stats entry
     */
    public compareActivityWith(other: NPCStatsModel): {
        activityDifference: number;
        moreActive: boolean;
        comparison: string;
    } {
        const thisTotal = this.getTotalSpawns();
        const otherTotal = other.getTotalSpawns();
        const difference = thisTotal - otherTotal;

        let comparison = '';
        if (difference === 0) {
            comparison = 'Same activity level';
        } else if (Math.abs(difference) <= 2) {
            comparison = 'Similar activity levels';
        } else if (difference > 0) {
            comparison = `${difference} more spawns than comparison`;
        } else {
            comparison = `${Math.abs(difference)} fewer spawns than comparison`;
        }

        return {
            activityDifference: difference,
            moreActive: difference > 0,
            comparison
        };
    }
}