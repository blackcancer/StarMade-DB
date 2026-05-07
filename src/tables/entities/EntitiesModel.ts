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
    SHIP = 0,
    SPACE_STATION = 1,
    PLANET = 2,
    ASTEROID = 3,
    FLOAT_ROCK = 4,
    SHIP_CORE = 5,
    ASTEROID_MANAGED = 6,
    SPACE_CREATURE = 7,
    PLANET_ICO = 8,
    ASTRONAUT = 10,
    NPC = 11,
    SHOP = 12,
    PLANET_SEGMENT = 13,
    PLANET_CORE = 14,
    BLACK_HOLE = 15,
    SUN = 16,
    VEHICLE = 17,
    DEATH_STAR = 18
}

/**
 * Known faction sentinel values
 * Based on TABLE_ENTITIES.md documentation
 */
export enum KnownFactions {
    NO_FACTION = 0,
    TRADING_GUILD = -10000000,
    OUTCASTS = -9999999,
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
    public static tableName = 'ENTITIES';
    
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
                    return require('../sectors/SectorsModel.js').SectorsModel;
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
                    return require('../ftl/FtlModel.js').FtlModel;
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
                    return require('../ftl/FtlModel.js').FtlModel;
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
                    return require('../fleet-members/FleetMembersModel.js').FleetMembersModel;
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
                    return require('../fleet-members/FleetMembersModel.js').FleetMembersModel;
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
                    return require('../fleets/FleetsModel.js').FleetsModel;
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
                    return require('../effects/EffectsModel.js').EffectsModel;
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

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getUid(): string { return this.get('UID'); }
    public setUid(uid: string): this { return this.set('UID', uid); }

    public getX(): number { return this.get('X'); }
    public setX(x: number): this { return this.set('X', x); }

    public getY(): number { return this.get('Y'); }
    public setY(y: number): this { return this.set('Y', y); }

    public getZ(): number { return this.get('Z'); }
    public setZ(z: number): this { return this.set('Z', z); }

    public getType(): EntityType { return this.get('TYPE'); }
    public setType(type: EntityType): this { return this.set('TYPE', type); }

    public getName(): string | undefined { 
        const name = this.get('NAME');
        // Trim whitespace from CHAR fields that may be padded
        return name ? name.trim() : name;
    }
    public setName(name: string | undefined): this { return this.set('NAME', name); }

    public getFaction(): number { return this.get('FACTION') || 0; }
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    public getCreator(): string | undefined { 
        const creator = this.get('CREATOR');
        // Trim whitespace from CHAR fields that may be padded
        return creator ? creator.trim() : creator;
    }
    public setCreator(creator: string | undefined): this { return this.set('CREATOR', creator); }

    public getLastMod(): string | undefined { 
        const lastMod = this.get('LAST_MOD');
        // Trim whitespace from CHAR fields that may be padded
        return lastMod ? lastMod.trim() : lastMod;
    }
    public setLastMod(lastMod: string | undefined): this { return this.set('LAST_MOD', lastMod); }

    public getSeed(): number | undefined { return this.get('SEED'); }
    public setSeed(seed: number | undefined): this { return this.set('SEED', seed); }

    public getTouched(): boolean | undefined { return this.get('TOUCHED'); }
    public setTouched(touched: boolean | undefined): this { return this.set('TOUCHED', touched); }

    public getLocalPos(): string | undefined { return this.get('LOCAL_POS'); }
    public setLocalPos(localPos: string | undefined): this { return this.set('LOCAL_POS', localPos); }

    public getDim(): string | undefined { return this.get('DIM'); }
    public setDim(dim: string | undefined): this { return this.set('DIM', dim); }

    public getGenId(): number | undefined { return this.get('GEN_ID'); }
    public setGenId(genId: number | undefined): this { return this.set('GEN_ID', genId); }

    public getDockedTo(): number { 
        const value = this.get('DOCKED_TO');
        // Handle both numeric and string versions of -1
        if (value === -1 || value === '-1' || value == -1) {
            return -1;
        }
        return typeof value === 'string' ? parseInt(value, 10) : (value || -1);
    }
    public setDockedTo(dockedTo: number): this { return this.set('DOCKED_TO', dockedTo); }

    public getDockedRoot(): number { 
        const value = this.get('DOCKED_ROOT');
        // Handle both numeric and string versions of -1
        if (value === -1 || value === '-1' || value == -1) {
            return -1;
        }
        return typeof value === 'string' ? parseInt(value, 10) : (value || -1);
    }
    public setDockedRoot(dockedRoot: number): this { return this.set('DOCKED_ROOT', dockedRoot); }

    public getSpawnedOnlyInDb(): boolean { return this.get('SPAWNED_ONLY_IN_DB') || false; }
    public setSpawnedOnlyInDb(spawnedOnlyInDb: boolean): this { return this.set('SPAWNED_ONLY_IN_DB', spawnedOnlyInDb); }

    public getTracked(): boolean { return this.get('TRACKED') || false; }
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
     * Parse local position array
     */
    public parseLocalPos(): number[] | null {
        const localPos = this.getLocalPos();
        if (!localPos) return null;

        try {
            // Handle ARRAY[...] format from HSQLDB
            const match = localPos.match(/ARRAY\[(.*?)\]/);
            if (match) {
                const content = match[1].trim();
                if (content === '') return [];
                const values = content.split(',').map(s => parseFloat(s.trim()));
                // Check if any value is NaN
                if (values.some(v => isNaN(v))) return null;
                return values;
            }
            
            // Handle JSON array format
            return JSON.parse(localPos);
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse dimensions array
     */
    public parseDim(): number[] | null {
        const dim = this.getDim();
        if (!dim) return null;

        try {
            // Handle ARRAY[...] format from HSQLDB
            const match = dim.match(/ARRAY\[(.*?)\]/);
            if (match) {
                const content = match[1].trim();
                if (content === '') return [];
                const values = content.split(',').map(s => parseFloat(s.trim()));
                // Check if any value is NaN
                if (values.some(v => isNaN(v))) return null;
                return values;
            }
            
            // Handle JSON array format
            return JSON.parse(dim);
        } catch (error) {
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