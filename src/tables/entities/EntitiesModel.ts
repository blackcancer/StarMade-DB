import * as related0 from '../sectors/SectorsModel.js';
import * as related1 from '../ftl/FtlModel.js';
import * as related2 from '../fleet-members/FleetMembersModel.js';
import * as related3 from '../fleets/FleetsModel.js';
import * as related4 from '../effects/EffectsModel.js';
/**
 * @fileoverview Entities Model
 * 
 * Model for the ENTITIES table containing all game entities (ships, stations, planets, etc.).
 * Provides comprehensive entity management with type validation and relationship support.
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
// ENTITIES ENUMS AND TYPES
// =============================================================================

/**
 * Entity types in StarMade
 * Based on TABLE_ENTITIES.md - TYPE column (TINYINT(8))
 */
export enum EntityType {
    /** Entity type value for ship, serialized as 0. */
    SHIP = 0,
    /** Entity type value for space station, serialized as 1. */
    SPACE_STATION = 1,
    /** Entity type value for planet, serialized as 2. */
    PLANET = 2,
    /** Entity type value for asteroid, serialized as 3. */
    ASTEROID = 3,
    /** Entity type value for float rock, serialized as 4. */
    FLOAT_ROCK = 4,
    /** Entity type value for ship core, serialized as 5. */
    SHIP_CORE = 5,
    /** Entity type value for asteroid managed, serialized as 6. */
    ASTEROID_MANAGED = 6,
    /** Entity type value for space creature, serialized as 7. */
    SPACE_CREATURE = 7,
    /** Entity type value for planet ico, serialized as 8. */
    PLANET_ICO = 8,
    /** Entity type value for astronaut, serialized as 10. */
    ASTRONAUT = 10,
    /** Entity type value for npc, serialized as 11. */
    NPC = 11,
    /** Entity type value for shop, serialized as 12. */
    SHOP = 12,
    /** Entity type value for planet segment, serialized as 13. */
    PLANET_SEGMENT = 13,
    /** Entity type value for planet core, serialized as 14. */
    PLANET_CORE = 14,
    /** Entity type value for black hole, serialized as 15. */
    BLACK_HOLE = 15,
    /** Entity type value for sun, serialized as 16. */
    SUN = 16,
    /** Entity type value for vehicle, serialized as 17. */
    VEHICLE = 17,
    /** Entity type value for death star, serialized as 18. */
    DEATH_STAR = 18
}

/**
 * Known faction sentinel values
 * Based on TABLE_ENTITIES.md documentation
 */
export enum KnownFactions {
    /** Known factions value for no faction, serialized as 0. */
    NO_FACTION = 0,
    /** Known factions value for trading guild, serialized as -10000000. */
    TRADING_GUILD = -10000000,
    /** Known factions value for outcasts, serialized as -9999999. */
    OUTCASTS = -9999999,
    /** Known factions value for scavengers, serialized as -9999998. */
    SCAVENGERS = -9999998
}

// =============================================================================
// ENTITIES MODEL
// =============================================================================

/**
 * Model for the ENTITIES table - Enhanced Edition with Complete Relations
 * 
 * Advanced entity management with complete bidirectional relationships,
 * comprehensive entity analytics, docking chain management, and spatial intelligence.
 */
export class EntitiesModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'ENTITIES';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'ENTITIES',
        comment: 'All game entities including ships, stations, planets, and asteroids',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Internal surrogate key'
            }),
            column('UID', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                unique: true,
                comment: 'External persistent identifier'
            }),
            column('X', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector X coordinate'
            }),
            column('Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector Y coordinate'
            }),
            column('Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector Z coordinate'
            }),
            column('TYPE', DataType.INTEGER, {
                nullable: false,
                comment: 'Entity type (TINYINT(8) - see EntityType enum)'
            }),
            column('NAME', DataType.VARCHAR, {
                length: 64,
                nullable: true,
                comment: 'Display name of the entity (CHAR(64) in database)'
            }),
            column('FACTION', DataType.INTEGER, {
                nullable: true,
                defaultValue: 0,
                comment: 'Owning faction ID'
            }),
            column('CREATOR', DataType.VARCHAR, {
                length: 64,
                nullable: true,
                comment: 'Creation author'
            }),
            column('LAST_MOD', DataType.VARCHAR, {
                length: 64,
                nullable: true,
                comment: 'Most recent modifying author'
            }),
            column('SEED', DataType.BIGINT, {
                nullable: true,
                comment: 'Procedural generation seed'
            }),
            column('TOUCHED', DataType.BOOLEAN, {
                nullable: true,
                comment: 'Whether visited/loaded since generation'
            }),
            column('LOCAL_POS', DataType.TEXT, {
                nullable: true,
                comment: 'Coordinate within the sector (array format)'
            }),
            column('DIM', DataType.TEXT, {
                nullable: true,
                comment: 'Dimensions of the entity bounding box (array format)'
            }),
            column('GEN_ID', DataType.INTEGER, {
                nullable: true,
                comment: 'Internal build version'
            }),
            column('DOCKED_TO', DataType.BIGINT, {
                nullable: true,
                defaultValue: -1,
                comment: 'Parent entity ID if docked (-1 if not docked)'
            }),
            column('DOCKED_ROOT', DataType.BIGINT, {
                nullable: true,
                defaultValue: -1,
                comment: 'Root of docking chain (-1 if not docked)'
            }),
            column('SPAWNED_ONLY_IN_DB', DataType.BOOLEAN, {
                nullable: true,
                defaultValue: false,
                comment: 'Present only in DB, not yet spawned'
            }),
            column('TRACKED', DataType.BOOLEAN, {
                nullable: true,
                defaultValue: false,
                comment: 'Marked for tracking by server tools'
            })
        ],

        primaryKey: ['ID'],
        
        foreignKeys: [
            // Self-referencing foreign keys for docking
            foreignKey('FK_ENTITY_DOCKED_TO', ['DOCKED_TO'], 'ENTITIES', ['ID'], {
                onDelete: ForeignKeyAction.SET_NULL,
                onUpdate: ForeignKeyAction.CASCADE
            }),
            foreignKey('FK_ENTITY_DOCKED_ROOT', ['DOCKED_ROOT'], 'ENTITIES', ['ID'], {
                onDelete: ForeignKeyAction.SET_NULL,
                onUpdate: ForeignKeyAction.CASCADE
            })
        ],

        indexes: [
            index('uidType', ['UID', 'TYPE']),
            index('ENTITIES_PK', ['UID'], { unique: true }),
            index('coordX', ['X']),
            index('coordY', ['Y']),
            index('coordZ', ['Z']),
            index('coordIndex', ['X', 'Y', 'Z']),
            index('coordIndexDT', ['X', 'Y', 'Z', 'DOCKED_TO']),
            index('typeIndex', ['TYPE']),
            index('dockedToIndex', ['DOCKED_TO']),
            index('dockedRootIndex', ['DOCKED_ROOT'])
        ],

        validationRules: [
            validation('UID', 'required'),
            validation('UID', 'maxLength', {
                value: 128,
                message: 'UID cannot exceed 128 characters'
            }),
            validation('TYPE', 'required'),
             validation('TYPE', 'custom', {
                validator: (type: number) => {
                    // Validate that TYPE is within TINYINT(8) range (0-255) as per TABLE_ENTITIES.md
                    if (type < 0 || type > 255) {
                        return `Entity type must be between 0 and 255 (TINYINT range), got: ${type}`;
                    }
                    const validTypes = Object.values(EntityType).filter(v => typeof v === 'number');
                    return validTypes.includes(type) || `Invalid entity type: ${type}`;
                },
                message: 'Invalid entity type'
            }),
            validation('NAME', 'maxLength', {
                value: 64,
                message: 'Name cannot exceed 64 characters'
            }),
            validation('CREATOR', 'maxLength', {
                value: 64,
                message: 'Creator cannot exceed 64 characters'
            }),
            validation('LAST_MOD', 'maxLength', {
                value: 64,
                message: 'Last modifier cannot exceed 64 characters'
            }),
            validation('DOCKED_TO', 'custom', {
                validator: (dockedTo: number, data: any) => {
                    if (dockedTo !== null && dockedTo !== undefined && dockedTo !== -1) {
                        // Cannot be docked to itself
                        if (data.ID && dockedTo === data.ID) {
                            return 'Entity cannot be docked to itself';
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
     * Complete bidirectional relationships with all connected tables
     */
    public static get relationMappings(): RelationMappings {
        return {
            // =========================================================================
            // INTERNAL SELF-REFERENTIAL RELATIONS (Docking Chain Management)
            // =========================================================================
            
            /** Parent entity this entity is docked to (ENTITIES.DOCKED_TO -> ENTITIES.ID) */
            dockedToEntity: relation(
                Model.BelongsToOneRelation,
                () => EntitiesModel,
                {
                    from: 'ENTITIES.DOCKED_TO',
                    to: 'ENTITIES.ID'
                },
                {
                    // Filter out -1 values (not docked)
                    filter: { 'ENTITIES.DOCKED_TO': { $ne: -1 } }
                }
            ),

            /** Root entity of the docking chain (ENTITIES.DOCKED_ROOT -> ENTITIES.ID) */
            dockedRootEntity: relation(
                Model.BelongsToOneRelation,
                () => EntitiesModel,
                {
                    from: 'ENTITIES.DOCKED_ROOT',
                    to: 'ENTITIES.ID'
                },
                {
                    // Filter out -1 values (not docked)
                    filter: { 'ENTITIES.DOCKED_ROOT': { $ne: -1 } }
                }
            ),

            /** Entities docked to this entity (ENTITIES.ID -> ENTITIES.DOCKED_TO) */
            dockedEntities: relation(
                Model.HasManyRelation,
                () => EntitiesModel,
                {
                    from: 'ENTITIES.ID',
                    to: 'ENTITIES.DOCKED_TO'
                }
            ),

            // =========================================================================
            // SPATIAL RELATIONS (Sector & System)
            // =========================================================================
            
            /** Sector where this entity is located (ENTITIES.X/Y/Z -> SECTORS.X/Y/Z) */
            sector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.SectorsModel;
                },
                {
                    from: ['ENTITIES.X', 'ENTITIES.Y', 'ENTITIES.Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            ),

            // =========================================================================
            // FTL RELATIONS (Jump Gates & Wormholes)
            // =========================================================================
            
            /** FTL connection originating from this entity (ENTITIES.UID -> FTL.FROM_UID) */
            ftlConnectionFrom: relation(
                Model.HasOneRelation,
                () => {
                    return related1.FtlModel;
                },
                {
                    from: 'ENTITIES.UID',
                    to: 'FTL.FROM_UID'
                }
            ),

            /** FTL connection terminating at this entity (ENTITIES.UID -> FTL.TO_UID) */
            ftlConnectionTo: relation(
                Model.HasOneRelation,
                () => {
                    return related1.FtlModel;
                },
                {
                    from: 'ENTITIES.UID',
                    to: 'FTL.TO_UID'
                }
            ),

            // =========================================================================
            // FLEET RELATIONS (Fleet Management & Combat)
            // =========================================================================
            
            /** Fleet membership where this entity is a member (ENTITIES.ID -> FLEET_MEMBERS.ENTITY_ID) */
            fleetMembership: relation(
                Model.HasOneRelation,
                () => {
                    return related2.FleetMembersModel;
                },
                {
                    from: 'ENTITIES.ID',
                    to: 'FLEET_MEMBERS.ENTITY_ID'
                }
            ),

            /** Fleet member entity docked to this entity (ENTITIES.ID -> FLEET_MEMBERS.DOCKED_TO) */
            dockedFleetMember: relation(
                Model.HasOneRelation,
                () => {
                    return related2.FleetMembersModel;
                },
                {
                    from: 'ENTITIES.ID',
                    to: 'FLEET_MEMBERS.DOCKED_TO'
                },
                {
                    // Custom filter to handle -1 values (not docked)
                    filter: { 'FLEET_MEMBERS.DOCKED_TO': { $ne: -1 } }
                }
            ),

            /** Fleet where this entity serves as flagship (ENTITIES.ID -> FLEETS.FLAGSHIP_ID) */
            fleetAsFlagship: relation(
                Model.HasOneRelation,
                () => {
                    return related3.FleetsModel;
                },
                {
                    from: 'ENTITIES.ID',
                    to: 'FLEETS.FLAGSHIP_ID'
                }
            ),

            // =========================================================================
            // EFFECTS RELATIONS (Status Effects & Modifiers)
            // =========================================================================
            
            /** Effects applied to this entity (ENTITIES.ID -> EFFECTS.ENTITY_ID)
             * OPTIMIZED BY: ENTITIES primary key + EFFECTS_PK index */
            effects: relation(
                Model.HasManyRelation,
                () => {
                    // Lazy import to avoid circular dependencies
                    return related4.EffectsModel;
                },
                {
                    from: 'ENTITIES.ID',
                    to: 'EFFECTS.ENTITY_ID'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the ENTITIES.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the ENTITIES.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the ENTITIES.UID column from this model.
     * @returns The stored UID value.
     */
    public getUid(): string { return this.get('UID'); }
    /**
     * Store the ENTITIES.UID column in this model and return this for chaining.
     * @param uid New value for the UID column.
     * @returns This model for chaining.
     */
    public setUid(uid: string): this { return this.set('UID', uid); }

    /**
     * Read the ENTITIES.X column from this model.
     * @returns The stored X value.
     */
    public getX(): number { return this.get('X'); }
    /**
     * Store the ENTITIES.X column in this model and return this for chaining.
     * @param x New value for the X column.
     * @returns This model for chaining.
     */
    public setX(x: number): this { return this.set('X', x); }

    /**
     * Read the ENTITIES.Y column from this model.
     * @returns The stored Y value.
     */
    public getY(): number { return this.get('Y'); }
    /**
     * Store the ENTITIES.Y column in this model and return this for chaining.
     * @param y New value for the Y column.
     * @returns This model for chaining.
     */
    public setY(y: number): this { return this.set('Y', y); }

    /**
     * Read the ENTITIES.Z column from this model.
     * @returns The stored Z value.
     */
    public getZ(): number { return this.get('Z'); }
    /**
     * Store the ENTITIES.Z column in this model and return this for chaining.
     * @param z New value for the Z column.
     * @returns This model for chaining.
     */
    public setZ(z: number): this { return this.set('Z', z); }

    /**
     * Read the ENTITIES.TYPE column from this model.
     * @returns The stored TYPE value.
     */
    public getType(): EntityType { return this.get('TYPE'); }
    /**
     * Store the ENTITIES.TYPE column in this model and return this for chaining.
     * @param type New value for the TYPE column.
     * @returns This model for chaining.
     */
    public setType(type: EntityType): this { return this.set('TYPE', type); }

    /**
     * Read the ENTITIES.NAME column from this model.
     * @returns The stored NAME value.
     */
    public getName(): string | undefined { 
        const name = this.get('NAME');
        // Trim whitespace from CHAR fields that may be padded
        return name ? name.trim() : name;
    }
    /**
     * Store the ENTITIES.NAME column in this model and return this for chaining.
     * @param name New value for the NAME column.
     * @returns This model for chaining.
     */
    public setName(name: string | undefined): this { return this.set('NAME', name); }

    /**
     * Read the ENTITIES.FACTION column from this model.
     * @returns The stored FACTION value.
     */
    public getFaction(): number { return this.get('FACTION') || 0; }
    /**
     * Store the ENTITIES.FACTION column in this model and return this for chaining.
     * @param faction New value for the FACTION column.
     * @returns This model for chaining.
     */
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    /**
     * Read the ENTITIES.CREATOR column from this model.
     * @returns The stored CREATOR value.
     */
    public getCreator(): string | undefined { 
        const creator = this.get('CREATOR');
        // Trim whitespace from CHAR fields that may be padded
        return creator ? creator.trim() : creator;
    }
    /**
     * Store the ENTITIES.CREATOR column in this model and return this for chaining.
     * @param creator New value for the CREATOR column.
     * @returns This model for chaining.
     */
    public setCreator(creator: string | undefined): this { return this.set('CREATOR', creator); }

    /**
     * Read the ENTITIES.LAST_MOD column from this model.
     * @returns The stored LAST_MOD value.
     */
    public getLastMod(): string | undefined { 
        const lastMod = this.get('LAST_MOD');
        // Trim whitespace from CHAR fields that may be padded
        return lastMod ? lastMod.trim() : lastMod;
    }
    /**
     * Store the ENTITIES.LAST_MOD column in this model and return this for chaining.
     * @param lastMod New value for the LAST_MOD column.
     * @returns This model for chaining.
     */
    public setLastMod(lastMod: string | undefined): this { return this.set('LAST_MOD', lastMod); }

    /**
     * Read the ENTITIES.SEED column from this model.
     * @returns The stored SEED value.
     */
    public getSeed(): number | undefined { return this.get('SEED'); }
    /**
     * Store the ENTITIES.SEED column in this model and return this for chaining.
     * @param seed New value for the SEED column.
     * @returns This model for chaining.
     */
    public setSeed(seed: number | undefined): this { return this.set('SEED', seed); }

    /**
     * Read the ENTITIES.TOUCHED column from this model.
     * @returns The stored TOUCHED value.
     */
    public getTouched(): boolean | undefined { return this.get('TOUCHED'); }
    /**
     * Store the ENTITIES.TOUCHED column in this model and return this for chaining.
     * @param touched New value for the TOUCHED column.
     * @returns This model for chaining.
     */
    public setTouched(touched: boolean | undefined): this { return this.set('TOUCHED', touched); }

    /**
     * Read the ENTITIES.LOCAL_POS column from this model.
     * @returns The stored LOCAL_POS value.
     */
    public getLocalPos(): string | undefined { return this.get('LOCAL_POS'); }
    /**
     * Store the ENTITIES.LOCAL_POS column in this model and return this for chaining.
     * @param localPos New value for the LOCAL_POS column.
     * @returns This model for chaining.
     */
    public setLocalPos(localPos: string | undefined): this { return this.set('LOCAL_POS', localPos); }

    /**
     * Read the ENTITIES.DIM column from this model.
     * @returns The stored DIM value.
     */
    public getDim(): string | undefined { return this.get('DIM'); }
    /**
     * Store the ENTITIES.DIM column in this model and return this for chaining.
     * @param dim New value for the DIM column.
     * @returns This model for chaining.
     */
    public setDim(dim: string | undefined): this { return this.set('DIM', dim); }

    /**
     * Read the ENTITIES.GEN_ID column from this model.
     * @returns The stored GEN_ID value.
     */
    public getGenId(): number | undefined { return this.get('GEN_ID'); }
    /**
     * Store the ENTITIES.GEN_ID column in this model and return this for chaining.
     * @param genId New value for the GEN_ID column.
     * @returns This model for chaining.
     */
    public setGenId(genId: number | undefined): this { return this.set('GEN_ID', genId); }

    /**
     * Read the ENTITIES.DOCKED_TO column from this model. Numeric strings are converted to integers.
     * @returns The stored DOCKED_TO value, normalized to an integer when necessary.
     */
    public getDockedTo(): number { 
        const value = this.get('DOCKED_TO');
        // Handle both numeric and string versions of -1
        if (value === -1 || value === '-1' || value == -1) {
            return -1;
        }
        return typeof value === 'string' ? parseInt(value, 10) : (value ?? -1);
    }
    /**
     * Store the ENTITIES.DOCKED_TO column in this model and return this for chaining.
     * @param dockedTo New value for the DOCKED_TO column.
     * @returns This model for chaining.
     */
    public setDockedTo(dockedTo: number): this { return this.set('DOCKED_TO', dockedTo); }

    /**
     * Read the ENTITIES.DOCKED_ROOT column from this model. Numeric strings are converted to integers.
     * @returns The stored DOCKED_ROOT value, normalized to an integer when necessary.
     */
    public getDockedRoot(): number { 
        const value = this.get('DOCKED_ROOT');
        // Handle both numeric and string versions of -1
        if (value === -1 || value === '-1' || value == -1) {
            return -1;
        }
        return typeof value === 'string' ? parseInt(value, 10) : (value ?? -1);
    }
    /**
     * Store the ENTITIES.DOCKED_ROOT column in this model and return this for chaining.
     * @param dockedRoot New value for the DOCKED_ROOT column.
     * @returns This model for chaining.
     */
    public setDockedRoot(dockedRoot: number): this { return this.set('DOCKED_ROOT', dockedRoot); }

    /**
     * Read the ENTITIES.SPAWNED_ONLY_IN_DB column from this model.
     * @returns The stored SPAWNED_ONLY_IN_DB value.
     */
    public getSpawnedOnlyInDb(): boolean { return this.get('SPAWNED_ONLY_IN_DB') || false; }
    /**
     * Store the ENTITIES.SPAWNED_ONLY_IN_DB column in this model and return this for chaining.
     * @param spawnedOnlyInDb New value for the SPAWNED_ONLY_IN_DB column.
     * @returns This model for chaining.
     */
    public setSpawnedOnlyInDb(spawnedOnlyInDb: boolean): this { return this.set('SPAWNED_ONLY_IN_DB', spawnedOnlyInDb); }

    /**
     * Read the ENTITIES.TRACKED column from this model.
     * @returns The stored TRACKED value.
     */
    public getTracked(): boolean { return this.get('TRACKED') || false; }
    /**
     * Store the ENTITIES.TRACKED column in this model and return this for chaining.
     * @param tracked New value for the TRACKED column.
     * @returns This model for chaining.
     */
    public setTracked(tracked: boolean): this { return this.set('TRACKED', tracked); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    // =========================================================================
    // INTERNAL SELF-REFERENTIAL RELATIONS
    // =========================================================================

    /** Get the entity this one is docked to */
    public getDockedToEntity(): EntitiesModel | undefined {
        return this.getRelated<EntitiesModel>('dockedToEntity');
    }

    /** Set the entity this one is docked to */
    public setDockedToEntity(entity: EntitiesModel | undefined): this {
        return this.setRelated('dockedToEntity', entity);
    }

    /** Get the root entity of the docking chain */
    public getDockedRootEntity(): EntitiesModel | undefined {
        return this.getRelated<EntitiesModel>('dockedRootEntity');
    }

    /** Set the root entity of the docking chain */
    public setDockedRootEntity(entity: EntitiesModel | undefined): this {
        return this.setRelated('dockedRootEntity', entity);
    }

    /** Get entities docked to this one */
    public getDockedEntities(): EntitiesModel[] | undefined {
        return this.getRelated<EntitiesModel[]>('dockedEntities');
    }

    /** Set entities docked to this one */
    public setDockedEntities(entities: EntitiesModel[] | undefined): this {
        return this.setRelated('dockedEntities', entities);
    }

    // =========================================================================
    // SPATIAL RELATIONS
    // =========================================================================

    /** Get the sector where this entity is located */
    public getSector(): any | undefined {
        return this.getRelated<any>('sector');
    }

    /** Set the sector where this entity is located */
    public setSector(sector: any | undefined): this {
        return this.setRelated('sector', sector);
    }

    // =========================================================================
    // FTL RELATIONS
    // =========================================================================

    /** Get FTL connection originating from this entity */
    public getFtlConnectionFrom(): any | undefined {
        return this.getRelated<any>('ftlConnectionFrom');
    }

    /** Set FTL connection originating from this entity */
    public setFtlConnectionFrom(connection: any | undefined): this {
        return this.setRelated('ftlConnectionFrom', connection);
    }

    /** Get FTL connection terminating at this entity */
    public getFtlConnectionTo(): any | undefined {
        return this.getRelated<any>('ftlConnectionTo');
    }

    /** Set FTL connection terminating at this entity */
    public setFtlConnectionTo(connection: any | undefined): this {
        return this.setRelated('ftlConnectionTo', connection);
    }

    // =========================================================================
    // FLEET RELATIONS
    // =========================================================================

    /** Get fleet membership where this entity is a member */
    public getFleetMembership(): any | undefined {
        return this.getRelated<any>('fleetMembership');
    }

    /** Set fleet membership where this entity is a member */
    public setFleetMembership(membership: any | undefined): this {
        return this.setRelated('fleetMembership', membership);
    }

    /** Get fleet member entity docked to this entity */
    public getDockedFleetMember(): any | undefined {
        return this.getRelated<any>('dockedFleetMember');
    }

    /** Set fleet member entity docked to this entity */
    public setDockedFleetMember(member: any | undefined): this {
        return this.setRelated('dockedFleetMember', member);
    }

    /** Get fleet where this entity serves as flagship */
    public getFleetAsFlagship(): any | undefined {
        return this.getRelated<any>('fleetAsFlagship');
    }

    /** Set fleet where this entity serves as flagship */
    public setFleetAsFlagship(fleet: any | undefined): this {
        return this.setRelated('fleetAsFlagship', fleet);
    }

    // =========================================================================
    // EFFECTS RELATIONS
    // =========================================================================

    /** Get effects applied to this entity */
    public getEffects(): any[] | undefined {
        return this.getRelated<any[]>('effects');
    }

    /** Set effects applied to this entity */
    public setEffects(effects: any[] | undefined): this {
        return this.setRelated('effects', effects);
    }

    // =========================================================================
    // RELATIONSHIP STATUS CHECKS
    // =========================================================================

    /** Check if docked-to entity relation is loaded */
    public hasDockedToEntityLoaded(): boolean {
        return this.hasRelated('dockedToEntity');
    }

    /** Check if docked-root entity relation is loaded */
    public hasDockedRootEntityLoaded(): boolean {
        return this.hasRelated('dockedRootEntity');
    }

    /** Check if docked entities relation is loaded */
    public hasDockedEntitiesLoaded(): boolean {
        return this.hasRelated('dockedEntities');
    }

    /** Check if sector relation is loaded */
    public hasSectorLoaded(): boolean {
        return this.hasRelated('sector');
    }

    /** Check if FTL from connection is loaded */
    public hasFtlConnectionFromLoaded(): boolean {
        return this.hasRelated('ftlConnectionFrom');
    }

    /** Check if FTL to connection is loaded */
    public hasFtlConnectionToLoaded(): boolean {
        return this.hasRelated('ftlConnectionTo');
    }

    /** Check if fleet membership is loaded */
    public hasFleetMembershipLoaded(): boolean {
        return this.hasRelated('fleetMembership');
    }

    /** Check if docked fleet member is loaded */
    public hasDockedFleetMemberLoaded(): boolean {
        return this.hasRelated('dockedFleetMember');
    }

    /** Check if fleet as flagship is loaded */
    public hasFleetAsFlagshipLoaded(): boolean {
        return this.hasRelated('fleetAsFlagship');
    }

    /** Check if effects are loaded */
    public hasEffectsLoaded(): boolean {
        return this.hasRelated('effects');
    }

    /** Check if all docking relations are loaded */
    public hasAllDockingRelationsLoaded(): boolean {
        return this.hasDockedToEntityLoaded() && this.hasDockedRootEntityLoaded() && this.hasDockedEntitiesLoaded();
    }

    /** Check if all FTL relations are loaded */
    public hasAllFtlRelationsLoaded(): boolean {
        return this.hasFtlConnectionFromLoaded() && this.hasFtlConnectionToLoaded();
    }

    /** Check if all fleet relations are loaded */
    public hasAllFleetRelationsLoaded(): boolean {
        return this.hasFleetMembershipLoaded() && this.hasDockedFleetMemberLoaded() && this.hasFleetAsFlagshipLoaded();
    }

    /** Check if all relations are loaded */
    public hasAllRelationsLoaded(): boolean {
        return this.hasAllDockingRelationsLoaded() && this.hasSectorLoaded() && 
               this.hasAllFtlRelationsLoaded() && this.hasAllFleetRelationsLoaded() && 
               this.hasEffectsLoaded();
    }

    // =============================================================================
    // ENHANCED BUSINESS LOGIC METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get sector name from loaded relation
     */
    public getSectorName(): string | undefined {
        const sector = this.getSector();
        if (sector && this.hasSectorLoaded()) {
            return typeof sector.getName === 'function' ? sector.getName() : undefined;
        }
        return undefined;
    }

    /**
     * Get coordinates as a formatted string with enhanced sector info
     */
    public getCoordinatesString(): string {
        const sectorName = this.getSectorName();
        const coords = `(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
        return sectorName ? `${sectorName} ${coords}` : coords;
    }

    /**
     * Check if entity is docked
     */
    public isDocked(): boolean {
        const dockedTo = this.getDockedTo();
        // Handle both numeric -1 and string '-1' for undocked entities
        return dockedTo !== -1 && dockedTo != -1;
    }

    /**
     * Check if entity is root of docking chain
     */
    public isDockedRoot(): boolean {
        return this.isDocked() && this.getDockedTo() === this.getDockedRoot();
    }

    /**
     * Get docked entities count from loaded relation
     */
    public getDockedEntitiesCount(): number {
        const dockedEntities = this.getDockedEntities();
        return dockedEntities ? dockedEntities.length : 0;
    }

    /**
     * Get entity type name
     */
    public getTypeName(): string {
        return EntityType[this.getType()] || `UNKNOWN_${this.getType()}`;
    }

    /**
     * Check if entity is a ship type
     */
    public isShip(): boolean {
        const shipTypes = [EntityType.SHIP, EntityType.SHIP_CORE, EntityType.VEHICLE];
        return shipTypes.includes(this.getType());
    }

    /**
     * Check if entity is a station type
     */
    public isStation(): boolean {
        const stationTypes = [EntityType.SPACE_STATION, EntityType.SHOP];
        return stationTypes.includes(this.getType());
    }

    /**
     * Check if entity is a celestial body
     */
    public isCelestialBody(): boolean {
        const celestialTypes = [
            EntityType.PLANET, EntityType.PLANET_ICO, EntityType.PLANET_SEGMENT, EntityType.PLANET_CORE,
            EntityType.SUN, EntityType.BLACK_HOLE
        ];
        return celestialTypes.includes(this.getType());
    }

    /**
     * Check if entity is an asteroid
     */
    public isAsteroid(): boolean {
        const asteroidTypes = [EntityType.ASTEROID, EntityType.ASTEROID_MANAGED, EntityType.FLOAT_ROCK];
        return asteroidTypes.includes(this.getType());
    }

    /**
     * Check if entity is a creature
     */
    public isCreature(): boolean {
        const creatureTypes = [EntityType.SPACE_CREATURE, EntityType.ASTRONAUT, EntityType.NPC];
        return creatureTypes.includes(this.getType());
    }

    /**
     * Check if entity is player-controlled
     */
    public isPlayerControlled(): boolean {
        const creator = this.getCreator();
        return creator !== null && creator !== undefined && 
               creator !== '' && creator !== '<s>' && 
               !creator.startsWith('SHIPYARD_ENTITY_');
    }

    /**
     * Check if entity belongs to NPC faction
     */
    public isNPCFaction(): boolean {
        const faction = this.getFaction();
        return faction === KnownFactions.TRADING_GUILD || 
               faction === KnownFactions.OUTCASTS || 
               faction === KnownFactions.SCAVENGERS;
    }

    /**
     * Get faction name for known factions
     */
    public getFactionName(): string {
        const faction = this.getFaction();
        switch (faction) {
            case KnownFactions.NO_FACTION:
                return 'No Faction';
            case KnownFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownFactions.OUTCASTS:
                return 'Outcasts';
            case KnownFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return faction > 0 ? `Player Faction ${faction}` : `Unknown Faction ${faction}`;
        }
    }

    /**
     * Parse LOCAL_POS from JDBC ARRAY text, JSON text, or a native numeric array.
     * @returns Finite coordinate values, or null for malformed data.
     */
    public parseLocalPos(): number[] | null {
        return this.parseNumericArray(this.getLocalPos());
    }

    /**
     * Parse DIM from JDBC ARRAY text, JSON text, or a native numeric array.
     * @returns Finite dimension values, or null for malformed data.
     */
    public parseDim(): number[] | null {
        return this.parseNumericArray(this.getDim());
    }

    /**
     * Normalize a SQL numeric array without accepting partial numbers or objects.
     * @param raw Column value received from JDBC or supplied by the caller.
     * @returns A numeric array, or null when any element is nonnumeric or nonfinite.
     */
    private parseNumericArray(raw: unknown): number[] | null {
        try {
            const values = typeof raw === 'string'
                ? JSON.parse(raw.trim().replace(/^ARRAY\s*/i, ''))
                : raw;
            return Array.isArray(values) && values.every(value => typeof value === 'number' && Number.isFinite(value))
                ? values
                : null;
        } catch {
            return null;
        }
    }

    /**
     * Calculate distance from another entity
     */
    public distanceFrom(other: EntitiesModel): number {
        const dx = this.getX() - other.getX();
        const dy = this.getY() - other.getY();
        const dz = this.getZ() - other.getZ();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate distance from specific coordinates
     */
    public distanceFromCoordinates(x: number, y: number, z: number): number {
        const dx = this.getX() - x;
        const dy = this.getY() - y;
        const dz = this.getZ() - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Check if entity is in same sector as another
     */
    public isInSameSector(other: EntitiesModel): boolean {
        return this.getX() === other.getX() && 
               this.getY() === other.getY() && 
               this.getZ() === other.getZ();
    }

    /**
     * Get complete docking chain information with relationship data
     */
    public getDockingChainInfo(): {
        isDocked: boolean;
        isRoot: boolean;
        dockedToId: number;
        rootId: number;
        dockedToName?: string;
        rootName?: string;
        dockedEntitiesCount: number;
        chainDepth?: number;
    } {
        const dockedToEntity = this.getDockedToEntity();
        const rootEntity = this.getDockedRootEntity();
        
        return {
            isDocked: this.isDocked(),
            isRoot: this.isDockedRoot(),
            dockedToId: this.getDockedTo(),
            rootId: this.getDockedRoot(),
            dockedToName: dockedToEntity && typeof dockedToEntity.getName === 'function' ? dockedToEntity.getName() : undefined,
            rootName: rootEntity && typeof rootEntity.getName === 'function' ? rootEntity.getName() : undefined,
            dockedEntitiesCount: this.getDockedEntitiesCount(),
            // chainDepth could be calculated if we have the full chain loaded
        };
    }

    // =============================================================================
    // FTL & TRANSPORT METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get FTL connection information from loaded relations
     */
    public getFtlConnectionInfo(): { 
        hasFrom: boolean; 
        hasTo: boolean; 
        hasBidirectional: boolean;
        fromConnection?: any;
        toConnection?: any;
    } {
        const fromConnection = this.getFtlConnectionFrom();
        const toConnection = this.getFtlConnectionTo();
        
        return {
            hasFrom: fromConnection !== undefined,
            hasTo: toConnection !== undefined,
            hasBidirectional: fromConnection !== undefined && toConnection !== undefined,
            fromConnection,
            toConnection
        };
    }

    /**
     * Check if entity has FTL capabilities
     */
    public hasFtlCapabilities(): boolean {
        const { hasFrom, hasTo } = this.getFtlConnectionInfo();
        return hasFrom || hasTo;
    }

    /**
     * Check if entity is an FTL hub (bidirectional connection)
     */
    public isFtlHub(): boolean {
        const { hasBidirectional } = this.getFtlConnectionInfo();
        return hasBidirectional;
    }

    // =============================================================================
    // FLEET & COMMAND METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get fleet involvement summary from loaded relations
     */
    public getFleetInvolvement(): {
        isMember: boolean;
        isFlagship: boolean;
        hasDockedMember: boolean;
        membership?: any;
        flagship?: any;
        dockedMember?: any;
    } {
        const membership = this.getFleetMembership();
        const flagship = this.getFleetAsFlagship();
        const dockedMember = this.getDockedFleetMember();
        
        return {
            isMember: membership !== undefined,
            isFlagship: flagship !== undefined,
            hasDockedMember: dockedMember !== undefined,
            membership,
            flagship,
            dockedMember
        };
    }

    /**
     * Check if entity is actively involved in fleet operations
     */
    public isFleetActive(): boolean {
        const involvement = this.getFleetInvolvement();
        return involvement.isMember || involvement.isFlagship || involvement.hasDockedMember;
    }

    /**
     * Check if entity is a fleet commander
     */
    public isFleetCommander(): boolean {
        const involvement = this.getFleetInvolvement();
        return involvement.isFlagship;
    }

    // =============================================================================
    // EFFECTS & STATUS METHODS WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get effects count from loaded relation
     */
    public getEffectsCount(): number {
        const effects = this.getEffects();
        return effects ? effects.length : 0;
    }

    /**
     * Check if entity has active effects
     */
    public hasActiveEffects(): boolean {
        return this.getEffectsCount() > 0;
    }

    /**
     * Get effects by category from loaded relation
     */
    public getEffectsByCategory(): Record<string, number> {
        const effects = this.getEffects();
        if (!effects) return {};
        
        const categories: Record<string, number> = {};
        effects.forEach(effect => {
            if (typeof effect.getCategory === 'function') {
                const category = effect.getCategory();
                categories[category] = (categories[category] || 0) + 1;
            }
        });
        
        return categories;
    }

    // =============================================================================
    // COMPREHENSIVE ENTITY SUMMARY WITH RELATIONSHIP DATA
    // =============================================================================

    /**
     * Get comprehensive entity summary with all relationship data
     */
    public getEntitySummary(): {
        // Basic entity data
        id: number;
        uid: string;
        name?: string;
        type: EntityType;
        typeName: string;
        coordinates: string;
        faction: string;
        creator?: string;
        
        // Spatial intelligence
        sectorName?: string;
        
        // Docking intelligence
        docking: {
            isDocked: boolean;
            isRoot: boolean;
            dockedToName?: string;
            rootName?: string;
            dockedEntitiesCount: number;
        };
        
        // FTL intelligence
        ftl: {
            hasCapabilities: boolean;
            isHub: boolean;
            hasFrom: boolean;
            hasTo: boolean;
            hasBidirectional: boolean;
        };
        
        // Fleet intelligence
        fleet: {
            isActive: boolean;
            isCommander: boolean;
            involvement: {
                isMember: boolean;
                isFlagship: boolean;
                hasDockedMember: boolean;
            };
        };
        
        // Effects intelligence
        effects: {
            hasActive: boolean;
            count: number;
            byCategory: Record<string, number>;
        };
        
        // Relationship status
        relationshipStatus: {
            hasSectorLoaded: boolean;
            hasAllDockingRelationsLoaded: boolean;
            hasAllFtlRelationsLoaded: boolean;
            hasAllFleetRelationsLoaded: boolean;
            hasEffectsLoaded: boolean;
            hasAllRelationsLoaded: boolean;
        };
    } {
        const dockingInfo = this.getDockingChainInfo();
        const ftlInfo = this.getFtlConnectionInfo();
        const fleetInvolvement = this.getFleetInvolvement();
        const effectsByCategory = this.getEffectsByCategory();
        
        return {
            // Basic entity data
            id: this.getId(),
            uid: this.getUid(),
            name: this.getName(),
            type: this.getType(),
            typeName: this.getTypeName(),
            coordinates: this.getCoordinatesString(),
            faction: this.getFactionName(),
            creator: this.getCreator(),
            
            // Spatial intelligence
            sectorName: this.getSectorName(),
            
            // Docking intelligence
            docking: {
                isDocked: dockingInfo.isDocked,
                isRoot: dockingInfo.isRoot,
                dockedToName: dockingInfo.dockedToName,
                rootName: dockingInfo.rootName,
                dockedEntitiesCount: dockingInfo.dockedEntitiesCount
            },
            
            // FTL intelligence
            ftl: {
                hasCapabilities: this.hasFtlCapabilities(),
                isHub: this.isFtlHub(),
                hasFrom: ftlInfo.hasFrom,
                hasTo: ftlInfo.hasTo,
                hasBidirectional: ftlInfo.hasBidirectional
            },
            
            // Fleet intelligence
            fleet: {
                isActive: this.isFleetActive(),
                isCommander: this.isFleetCommander(),
                involvement: {
                    isMember: fleetInvolvement.isMember,
                    isFlagship: fleetInvolvement.isFlagship,
                    hasDockedMember: fleetInvolvement.hasDockedMember
                }
            },
            
            // Effects intelligence
            effects: {
                hasActive: this.hasActiveEffects(),
                count: this.getEffectsCount(),
                byCategory: effectsByCategory
            },
            
            // Relationship status
            relationshipStatus: {
                hasSectorLoaded: this.hasSectorLoaded(),
                hasAllDockingRelationsLoaded: this.hasAllDockingRelationsLoaded(),
                hasAllFtlRelationsLoaded: this.hasAllFtlRelationsLoaded(),
                hasAllFleetRelationsLoaded: this.hasAllFleetRelationsLoaded(),
                hasEffectsLoaded: this.hasEffectsLoaded(),
                hasAllRelationsLoaded: this.hasAllRelationsLoaded()
            }
        };
    }
}