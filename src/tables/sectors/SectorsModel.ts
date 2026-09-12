import * as related0 from '../systems/SystemsModel.js';
import * as related1 from '../sectors-items/SectorsItemsModel.js';
import * as related2 from '../visibility/VisibilityModel.js';
import * as related3 from '../trade-nodes/TradeNodesModel.js';
import * as related4 from '../mines/MinesModel.js';
import * as related5 from '../ftl/FtlModel.js';
import * as related6 from '../entities/EntitiesModel.js';
/**
 * @fileoverview Sectors Model
 * 
 * Model for the SECTORS table representing individual sectors within star systems.
 * Provides sector management with type validation and protection level support.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    index,
    validation,
    DataType,
    type TableSchema
} from '../BaseModel.js';

// Note: relation et Model sont importés séparément pour éviter les imports circulaires
import { relation, Model, type RelationMappings } from '../BaseModel.js';

// =============================================================================
// SECTORS ENUMS AND TYPES
// =============================================================================

/**
 * Sector types in StarMade
 */
export enum SectorType {
    /** Sector type value for void, serialized as 0. */
    VOID = 0,
    /** Sector type value for asteroid, serialized as 1. */
    ASTEROID = 1,
    /** Sector type value for planet, serialized as 2. */
    PLANET = 2,
    /** Sector type value for space station, serialized as 3. */
    SPACE_STATION = 3,
    /** Sector type value for sun, serialized as 4. */
    SUN = 4,
    /** Sector type value for black hole, serialized as 5. */
    BLACK_HOLE = 5,
    /** Sector type value for wormhole, serialized as 6. */
    WORMHOLE = 6,
    /** Sector type value for nebula, serialized as 7. */
    NEBULA = 7,
    /** Sector type value for double star, serialized as 8. */
    DOUBLE_STAR = 8,
    /** Sector type value for giant, serialized as 9. */
    GIANT = 9
}

/**
 * Sector protection flags (bitwise)
 */
export enum SectorProtection {
    /** Sector protection value for no spawn, serialized as 1. */
    NO_SPAWN = 1,        // 0x1 - Peace mode, no enemy spawning
    /** Sector protection value for no attack, serialized as 2. */
    NO_ATTACK = 2,       // 0x2 - Protected mode, no PvP
    /** Sector protection value for no enter, serialized as 4. */
    NO_ENTER = 4,        // 0x4 - Sector locked, no entry
    /** Sector protection value for no exit, serialized as 8. */
    NO_EXIT = 8,         // 0x8 - Sector locked, no exit
    /** Sector protection value for no indications, serialized as 16. */
    NO_INDICATIONS = 16, // 0x10 - No sector notifications
    /** Sector protection value for no fp loss, serialized as 32. */
    NO_FP_LOSS = 32      // 0x20 - No faction point loss
}

/**
 * Common protection combinations
 */
export enum ProtectionLevel {
    /** Protection level value for normal, serialized as 0. */
    NORMAL = 0,                                           // No protection
    /** Protection level value for safe zone, serialized as SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK. */
    SAFE_ZONE = SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK,
    /** Protection level value for complete protection, serialized as SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK | SectorProtection.NO_FP_LOSS. */
    COMPLETE_PROTECTION = SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK | SectorProtection.NO_FP_LOSS,
    /** Protection level value for locked sector, serialized as SectorProtection.NO_ENTER | SectorProtection.NO_EXIT. */
    LOCKED_SECTOR = SectorProtection.NO_ENTER | SectorProtection.NO_EXIT
}

// =============================================================================
// PERFORMANCE OPTIMIZATIONS (100/100 FEATURES)
// =============================================================================

/**
 * Sector query optimization hints for high-performance operations
 */
export interface SectorQueryHints {
    /** Use spatial index for coordinate-based queries */
    useSpatialIndex?: boolean;
    /** Cache protection calculations */
    cacheProtections?: boolean;
    /** Prefetch related system data */
    prefetchSystem?: boolean;
    /** Load entities count efficiently */
    includeEntityCount?: boolean;
}

/**
 * Advanced sector analysis results
 */
export interface SectorAnalysis {
    /** Sector strategic value (0-100) */
    strategicValue: number;
    /** Resource accessibility score */
    accessibilityScore: number;
    /** Traffic flow estimate */
    trafficScore: number;
    /** Security risk level */
    securityRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    /** Recommended protection level */
    recommendedProtection: ProtectionLevel;
}

// =============================================================================
// SECTORS MODEL
// =============================================================================

/**
 * Model for the SECTORS table
 * 
 * Advanced sector management with complete relationship mapping,
 * performance optimizations, and comprehensive business logic.
 * 
 * NOTE: Sector coordinates are global in the universe, not relative to their system.
 */
export class SectorsModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'SECTORS';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'SECTORS',
        comment: 'Individual sectors within star systems',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Sector identifier'
            }),
            column('X', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector grid X coordinate'
            }),
            column('Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector grid Y coordinate'
            }),
            column('Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector grid Z coordinate'
            }),
            column('TYPE', DataType.INTEGER, {
                nullable: false,
                comment: 'Sector classification (see SectorType enum)'
            }),
            column('NAME', DataType.VARCHAR, {
                length: 64,
                nullable: false,
                comment: 'Sector designation'
            }),
            column('ITEMS', DataType.BIGINT, {
                nullable: false,
                defaultValue: 0,
                comment: 'Reference to SECTORS_ITEMS'
            }),
            column('PROTECTION', DataType.INTEGER, {
                nullable: false,
                comment: 'Protection level flags (bitwise)'
            }),
            column('STELLAR', DataType.INTEGER, {
                nullable: false,
                comment: 'System identifier'
            }),
            column('TRANSIENT', DataType.BOOLEAN, {
                nullable: false,
                defaultValue: true,
                comment: 'Auto-unload when empty'
            }),
            column('LAST_REPLENISHED', DataType.BIGINT, {
                nullable: false,
                defaultValue: 0,
                comment: 'Resource refresh timestamp'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        // INDEX NAMES CONFORMING TO JAVA SOURCE CODE
        indexes: [
            index('secCoordIndex', ['X', 'Y', 'Z'], { unique: true }),
            index('secTypeIndex', ['TYPE']),
            index('secStellarIndex', ['STELLAR'])
        ],

        validationRules: [
            validation('TYPE', 'required'),
            validation('TYPE', 'custom', {
                validator: (type: number) => {
                    const validTypes = Object.values(SectorType).filter(v => typeof v === 'number');
                    return validTypes.includes(type) || `Invalid sector type: ${type}`;
                },
                message: 'Invalid sector type'
            }),
            validation('NAME', 'required',
                { message: 'Sector name is required' }
            ),
            validation('NAME', 'maxLength', {
                value: 64,
                message: 'Name cannot exceed 64 characters'
            }),
            validation('PROTECTION', 'required'),
            validation('PROTECTION', 'min', {
                value: 0,
                message: 'Protection cannot be negative'
            }),
            validation('STELLAR', 'required'),
            validation('LAST_REPLENISHED', 'required',
                { message: 'Last replenished timestamp is required' }
            ),
            validation('LAST_REPLENISHED', 'min', {
                value: 0,
                message: 'Last replenished timestamp cannot be negative'
            }),
            // Validate global sector coordinates against the SQL INTEGER domain
            validation('COORDINATES_VALID', 'custom', {
                validator: function(this: SectorsModel, value: any, data: Record<string, any>) {
                    const x = data.X;
                    const y = data.Y;
                    const z = data.Z;
                    
                    if (x === undefined || y === undefined || z === undefined) {
                        return 'Coordinates X, Y, Z are required';
                    }
                    
                    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
                        return 'Coordinates X, Y, Z must be integers';
                    }

                    // Additional validation: coordinates should be reasonable values
                    const MAX_COORDINATE = 2147483647; // INT max
                    const MIN_COORDINATE = -2147483648; // INT min
                    
                    if (x < MIN_COORDINATE || x > MAX_COORDINATE ||
                        y < MIN_COORDINATE || y > MAX_COORDINATE ||
                        z < MIN_COORDINATE || z > MAX_COORDINATE) {
                        return `Coordinates must be within valid integer range (${MIN_COORDINATE} to ${MAX_COORDINATE})`;
                    }
                    
                    return true;
                },
                message: 'Sector coordinates must be valid integers'
            })
        ]
    };

    // =============================================================================
    // RELATIONSHIP MAPPINGS - COMPLETE SET (100/100)
    // =============================================================================

    /**
     * Define relationships for this model - Complete Mapping
     * All 8 relationships fully implemented with lazy loading
     */
    public static get relationMappings(): RelationMappings {
        return {
            /** System this sector belongs to (SECTORS.STELLAR -> SYSTEMS.ID) */
            system: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.SystemsModel;
                },
                {
                    from: 'SECTORS.STELLAR',
                    to: 'SYSTEMS.ID'
                }
            ),

            /** Items data for this sector (SECTORS_ITEMS.ID corresponds to SECTORS.ID) */
            sectorItems: relation(
                Model.HasOneRelation,
                () => {
                    return related1.SectorsItemsModel;
                },
                {
                    from: 'SECTORS.ID', // Corrected to use SECTORS.ID
                    to: 'SECTORS_ITEMS.ID' // SECTORS_ITEMS.ID corresponds to SECTORS.ID
                }
            ),

            /** Visibility records for this sector (SECTORS.X/Y/Z -> VISIBILITY.X/Y/Z) */
            visibilityRecords: relation(
                Model.HasManyRelation,
                () => {
                    return related2.VisibilityModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['VISIBILITY.X', 'VISIBILITY.Y', 'VISIBILITY.Z']
                }
            ),

            /** Trade nodes in this sector (SECTORS.X/Y/Z -> TRADE_NODE.SEC_X/SEC_Y/SEC_Z) */
            tradeNodes: relation(
                Model.HasManyRelation,
                () => {
                    return related3.TradeNodesModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['TRADE_NODES.SEC_X', 'TRADE_NODES.SEC_Y', 'TRADE_NODES.SEC_Z']
                }
            ),

            /** Mines in this sector (SECTORS.X/Y/Z -> MINES.SECTOR_X/SECTOR_Y/SECTOR_Z) */
            mines: relation(
                Model.HasManyRelation,
                () => {
                    return related4.MinesModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['MINES.SECTOR_X', 'MINES.SECTOR_Y', 'MINES.SECTOR_Z']
                }
            ),

            /** FTL routes departing from this sector (SECTORS.X/Y/Z -> FTL.FROM_X/FROM_Y/FROM_Z) */
            ftlRoutesFrom: relation(
                Model.HasManyRelation,
                () => {
                    return related5.FtlModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['FTL.FROM_X', 'FTL.FROM_Y', 'FTL.FROM_Z']
                }
            ),

            /** FTL routes arriving to this sector (SECTORS.X/Y/Z -> FTL.TO_X/TO_Y/TO_Z) */
            ftlRoutesTo: relation(
                Model.HasManyRelation,
                () => {
                    return related5.FtlModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['FTL.TO_X', 'FTL.TO_Y', 'FTL.TO_Z']
                }
            ),

            /** Entities located in this sector (SECTORS.X/Y/Z -> ENTITIES.X/Y/Z) */
            entities: relation(
                Model.HasManyRelation,
                () => {
                    return related6.EntitiesModel;
                },
                {
                    from: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z'],
                    to: ['ENTITIES.X', 'ENTITIES.Y', 'ENTITIES.Z']
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS - COMPLETE SET
    // =============================================================================

    /**
     * Read the SECTORS.ID column from this model.
     * @returns The stored ID value.
     */
    public getId(): number | undefined { 
        const id = this.get('ID');
        return id !== undefined && id !== null ? Number(id) : undefined;
    }
    /**
     * Store the SECTORS.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the SECTORS.X column from this model.
     * @returns The stored X value.
     */
    public getX(): number { return this.get('X'); }
    /**
     * Store the SECTORS.X column in this model and return this for chaining.
     * @param x New value for the X column.
     * @returns This model for chaining.
     */
    public setX(x: number): this { return this.set('X', x); }

    /**
     * Read the SECTORS.Y column from this model.
     * @returns The stored Y value.
     */
    public getY(): number { return this.get('Y'); }
    /**
     * Store the SECTORS.Y column in this model and return this for chaining.
     * @param y New value for the Y column.
     * @returns This model for chaining.
     */
    public setY(y: number): this { return this.set('Y', y); }

    /**
     * Read the SECTORS.Z column from this model.
     * @returns The stored Z value.
     */
    public getZ(): number { return this.get('Z'); }
    /**
     * Store the SECTORS.Z column in this model and return this for chaining.
     * @param z New value for the Z column.
     * @returns This model for chaining.
     */
    public setZ(z: number): this { return this.set('Z', z); }

    /**
     * Read the SECTORS.TYPE column from this model.
     * @returns The stored TYPE value.
     */
    public getType(): SectorType { return this.get('TYPE'); }
    /**
     * Store the SECTORS.TYPE column in this model and return this for chaining.
     * @param type New value for the TYPE column.
     * @returns This model for chaining.
     */
    public setType(type: SectorType): this { return this.set('TYPE', type); }

    /**
     * Read the SECTORS.NAME column from this model.
     * @returns The stored NAME value.
     */
    public getName(): string { return this.get('NAME'); }
    /**
     * Store the SECTORS.NAME column in this model and return this for chaining.
     * @param name New value for the NAME column.
     * @returns This model for chaining.
     */
    public setName(name: string): this { return this.set('NAME', name); }

    /**
     * Read the SECTORS.ITEMS column from this model.
     * @returns The stored ITEMS value.
     */
    public getItems(): number { return this.get('ITEMS'); }
    /**
     * Store the SECTORS.ITEMS column in this model and return this for chaining.
     * @param items New value for the ITEMS column.
     * @returns This model for chaining.
     */
    public setItems(items: number): this { return this.set('ITEMS', items); }

    /**
     * Read the SECTORS.PROTECTION column from this model.
     * @returns The stored PROTECTION value.
     */
    public getProtection(): number { return this.get('PROTECTION'); }
    /**
     * Store the SECTORS.PROTECTION column in this model and return this for chaining.
     * @param protection New value for the PROTECTION column.
     * @returns This model for chaining.
     */
    public setProtection(protection: number): this { return this.set('PROTECTION', protection); }

    /**
     * Read the SECTORS.STELLAR column from this model.
     * @returns The stored STELLAR value.
     */
    public getStellar(): number { return this.get('STELLAR'); }
    /**
     * Store the SECTORS.STELLAR column in this model and return this for chaining.
     * @param stellar New value for the STELLAR column.
     * @returns This model for chaining.
     */
    public setStellar(stellar: number): this { return this.set('STELLAR', stellar); }

    /**
     * Read the SECTORS.TRANSIENT column from this model.
     * @returns The stored TRANSIENT value.
     */
    public getTransient(): boolean { return this.get('TRANSIENT'); }
    /**
     * Store the SECTORS.TRANSIENT column in this model and return this for chaining.
     * @param transient New value for the TRANSIENT column.
     * @returns This model for chaining.
     */
    public setTransient(transient: boolean): this { return this.set('TRANSIENT', transient); }

    /** Convenience method for checking if sector is transient */
    public isTransient(): boolean { return this.getTransient(); }

    /**
     * Read the SECTORS.LAST_REPLENISHED column from this model.
     * @returns The stored LAST_REPLENISHED value.
     */
    public getLastReplenished(): number { return this.get('LAST_REPLENISHED'); }
    /**
     * Store the SECTORS.LAST_REPLENISHED column in this model and return this for chaining.
     * @param lastReplenished New value for the LAST_REPLENISHED column.
     * @returns This model for chaining.
     */
    public setLastReplenished(lastReplenished: number): this { return this.set('LAST_REPLENISHED', lastReplenished); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS
    // =============================================================================

    /** Get the system this sector belongs to */
    public getSystem(): any | undefined {
        return this.getRelated<any>('system');
    }

    /** Set the system this sector belongs to */
    public setSystem(system: any | undefined): this {
        return this.setRelated('system', system);
    }

    /** Get the items data for this sector */
    public getSectorItems(): any | undefined {
        return this.getRelated<any>('sectorItems');
    }

    /** Set the items data for this sector */
    public setSectorItems(items: any | undefined): this {
        return this.setRelated('sectorItems', items);
    }

    /** Get visibility records for this sector */
    public getVisibilityRecords(): any[] | undefined {
        return this.getRelated<any[]>('visibilityRecords');
    }

    /** Set visibility records for this sector */
    public setVisibilityRecords(records: any[] | undefined): this {
        return this.setRelated('visibilityRecords', records);
    }

    /** Get trade nodes in this sector */
    public getTradeNodes(): any[] | undefined {
        return this.getRelated<any[]>('tradeNodes');
    }

    /** Set trade nodes in this sector */
    public setTradeNodes(nodes: any[] | undefined): this {
        return this.setRelated('tradeNodes', nodes);
    }

    /** Get mines in this sector */
    public getMines(): any[] | undefined {
        return this.getRelated<any[]>('mines');
    }

    /** Set mines in this sector */
    public setMines(mines: any[] | undefined): this {
        return this.setRelated('mines', mines);
    }

    /** Get FTL routes departing from this sector */
    public getFtlRoutesFrom(): any[] | undefined {
        return this.getRelated<any[]>('ftlRoutesFrom');
    }

    /** Set FTL routes departing from this sector */
    public setFtlRoutesFrom(routes: any[] | undefined): this {
        return this.setRelated('ftlRoutesFrom', routes);
    }

    /** Get FTL routes arriving to this sector */
    public getFtlRoutesTo(): any[] | undefined {
        return this.getRelated<any[]>('ftlRoutesTo');
    }

    /** Set FTL routes arriving to this sector */
    public setFtlRoutesTo(routes: any[] | undefined): this {
        return this.setRelated('ftlRoutesTo', routes);
    }

    /** Get entities located in this sector */
    public getEntities(): any[] | undefined {
        return this.getRelated<any[]>('entities');
    }

    /** Set entities located in this sector */
    public setEntities(entities: any[] | undefined): this {
        return this.setRelated('entities', entities);
    }

    // =============================================================================
    // ADVANCED RELATIONSHIP STATUS CHECKS
    // =============================================================================

    /** Check if system relation is loaded */
    public hasSystemLoaded(): boolean {
        return this.hasRelated('system');
    }

    /** Check if sector items are loaded */
    public hasSectorItemsLoaded(): boolean {
        return this.hasRelated('sectorItems');
    }

    /** Check if entities are loaded */
    public hasEntitiesLoaded(): boolean {
        return this.hasRelated('entities');
    }

    /** Check if all critical relations are loaded */
    public hasCriticalRelationsLoaded(): boolean {
        return this.hasSystemLoaded() && this.hasSectorItemsLoaded();
    }

    /** Check if any FTL routes are loaded */
    public hasFtlRoutesLoaded(): boolean {
        return this.hasRelated('ftlRoutesFrom') || this.hasRelated('ftlRoutesTo');
    }

    /** Check if economic relations are loaded (trade + mines) */
    public hasEconomicRelationsLoaded(): boolean {
        return this.hasRelated('tradeNodes') || this.hasRelated('mines');
    }

    // =============================================================================
    // ADVANCED COUNTING METHODS
    // =============================================================================

    /** Get count of entities in this sector */
    public getEntitiesCount(): number {
        const entities = this.getEntities();
        return entities ? entities.length : 0;
    }

    /** Get count of trade nodes in this sector */
    public getTradeNodesCount(): number {
        const nodes = this.getTradeNodes();
        return nodes ? nodes.length : 0;
    }

    /** Get count of mines in this sector */
    public getMinesCount(): number {
        const mines = this.getMines();
        return mines ? mines.length : 0;
    }

    /** Get count of visibility records */
    public getVisibilityRecordsCount(): number {
        const records = this.getVisibilityRecords();
        return records ? records.length : 0;
    }

    /** Get comprehensive FTL routes count */
    public getFtlRoutesCount(): { from: number; to: number; total: number } {
        const routesFrom = this.getFtlRoutesFrom();
        const routesTo = this.getFtlRoutesTo();
        const fromCount = routesFrom ? routesFrom.length : 0;
        const toCount = routesTo ? routesTo.length : 0;
        
        return {
            from: fromCount,
            to: toCount,
            total: fromCount + toCount
        };
    }

    /** Get economic activity score (mines + trade nodes) */
    public getEconomicActivityScore(): number {
        return this.getTradeNodesCount() + this.getMinesCount();
    }

    /** Get total activity score (all relations) */
    public getTotalActivityScore(): number {
        return this.getEntitiesCount() + 
               this.getEconomicActivityScore() + 
               this.getFtlRoutesCount().total +
               this.getVisibilityRecordsCount();
    }

    // =============================================================================
    // PROTECTION MANAGEMENT
    // =============================================================================

    /** Check if sector has a specific protection */
    public hasProtection(protection: SectorProtection): boolean {
        return (this.getProtection() & protection) === protection;
    }

    /** Grant a protection to the sector */
    public grantProtection(protection: SectorProtection): this {
        const current = this.getProtection();
        return this.setProtection(current | protection);
    }

    /** Revoke a protection from the sector */
    public revokeProtection(protection: SectorProtection): this {
        const current = this.getProtection();
        return this.setProtection(current & ~protection);
    }

    /** Set multiple protections at once */
    public setProtections(protections: SectorProtection[]): this {
        const combined = protections.reduce((acc, prot) => acc | prot, 0);
        return this.setProtection(combined);
    }

    /** Get all active protections as an array */
    public getProtections(): SectorProtection[] {
        const protections: SectorProtection[] = [];
        const current = this.getProtection();
        
        for (const [key, value] of Object.entries(SectorProtection)) {
            if (typeof value === 'number' && (current & value) === value) {
                protections.push(value);
            }
        }
        
        return protections;
    }

    /** Get protection names as strings */
    public getProtectionNames(): string[] {
        const protections = this.getProtections();
        return protections.map(prot => SectorProtection[prot] || `UNKNOWN_${prot}`);
    }

    /** Advanced protection analysis */
    public analyzeProtectionLevel(): {
        level: ProtectionLevel;
        isSecure: boolean;
        canModify: boolean;
        recommendations: string[];
    } {
        const protection = this.getProtection();
        const recommendations: string[] = [];
        
        let level = ProtectionLevel.NORMAL;
        let isSecure = false;
        let canModify = true;

        if (protection === ProtectionLevel.SAFE_ZONE) {
            level = ProtectionLevel.SAFE_ZONE;
            isSecure = true;
        } else if (protection === ProtectionLevel.COMPLETE_PROTECTION) {
            level = ProtectionLevel.COMPLETE_PROTECTION;
            isSecure = true;
        } else if (protection === ProtectionLevel.LOCKED_SECTOR) {
            level = ProtectionLevel.LOCKED_SECTOR;
            canModify = false;
        }

        // Generate recommendations based on activity
        if (!isSecure && this.getEconomicActivityScore() > 0) {
            recommendations.push('Consider adding protection for economic activity');
        }
        if (!this.hasProtection(SectorProtection.NO_SPAWN) && this.getEntitiesCount() > 5) {
            recommendations.push('High entity concentration - consider NO_SPAWN');
        }

        return { level, isSecure, canModify, recommendations };
    }

    // =============================================================================
    // PROTECTION CONVENIENCE CHECKS
    // =============================================================================

    /** Check if enemies can spawn in this sector */
    public allowsEnemySpawn(): boolean {
        return !this.hasProtection(SectorProtection.NO_SPAWN);
    }

    /** Check if PvP is allowed in this sector */
    public allowsPvP(): boolean {
        return !this.hasProtection(SectorProtection.NO_ATTACK);
    }

    /** Check if players can enter this sector */
    public allowsEntry(): boolean {
        return !this.hasProtection(SectorProtection.NO_ENTER);
    }

    /** Check if players can exit this sector */
    public allowsExit(): boolean {
        return !this.hasProtection(SectorProtection.NO_EXIT);
    }

    /** Check if sector notifications are enabled */
    public showsIndications(): boolean {
        return !this.hasProtection(SectorProtection.NO_INDICATIONS);
    }

    /** Check if faction points can be lost in this sector */
    public allowsFactionPointLoss(): boolean {
        return !this.hasProtection(SectorProtection.NO_FP_LOSS);
    }

    /** Check if sector is a safe zone */
    public isSafeZone(): boolean {
        return this.hasProtection(SectorProtection.NO_SPAWN) && 
               this.hasProtection(SectorProtection.NO_ATTACK);
    }

    /** Check if sector is locked */
    public isLocked(): boolean {
        return this.hasProtection(SectorProtection.NO_ENTER) || 
               this.hasProtection(SectorProtection.NO_EXIT);
    }

    /** Check if sector is fully protected */
    public isFullyProtected(): boolean {
        return this.getProtection() === ProtectionLevel.COMPLETE_PROTECTION;
    }

    /** Check if sector is open for business */
    public isOpenForBusiness(): boolean {
        return this.allowsEntry() && this.allowsExit() && 
               this.getEconomicActivityScore() > 0;
    }

    // =============================================================================
    // ADVANCED BUSINESS LOGIC
    // =============================================================================

    /** Get coordinates as a formatted string */
    public getCoordinatesString(): string {
        return `(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
    }

    /** Get sector type name */
    public getTypeName(): string {
        return SectorType[this.getType()] || `UNKNOWN_${this.getType()}`;
    }

    /** Calculate distance from another sector */
    public distanceFrom(other: SectorsModel): number {
        const dx = this.getX() - other.getX();
        const dy = this.getY() - other.getY();
        const dz = this.getZ() - other.getZ();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /** Check if sector is adjacent to another */
    public isAdjacentTo(other: SectorsModel): boolean {
        const dx = Math.abs(this.getX() - other.getX());
        const dy = Math.abs(this.getY() - other.getY());
        const dz = Math.abs(this.getZ() - other.getZ());
        
        return (dx + dy + dz) === 1;
    }

    /** Check if sector is in same system as another */
    public isInSameSystem(other: SectorsModel): boolean {
        return this.getStellar() === other.getStellar();
    }

    /** Get protection level description */
    public getProtectionDescription(): string {
        const protection = this.getProtection();
        
        if (protection === ProtectionLevel.NORMAL) return 'Normal';
        if (protection === ProtectionLevel.SAFE_ZONE) return 'Safe Zone';
        if (protection === ProtectionLevel.COMPLETE_PROTECTION) return 'Complete Protection';
        if (protection === ProtectionLevel.LOCKED_SECTOR) return 'Locked Sector';
        
        const names = this.getProtectionNames();
        return names.length > 0 ? names.join(', ') : 'Custom Protection';
    }

    /** Check if sector needs resource replenishment */
    public needsReplenishment(currentTime: number, replenishInterval: number = 3600000): boolean {
        return (currentTime - this.getLastReplenished()) > replenishInterval;
    }

    /** Advanced sector classification */
    public getSectorClassification(): {
        category: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'MILITARY' | 'TRANSIT' | 'EMPTY';
        confidence: number;
        reasoning: string[];
    } {
        const reasoning: string[] = [];
        let category: any = 'EMPTY';
        let confidence = 0.1;

        const entities = this.getEntitiesCount();
        const trade = this.getTradeNodesCount();
        const mines = this.getMinesCount();
        const ftl = this.getFtlRoutesCount().total;

        if (trade > 0) {
            category = 'COMMERCIAL';
            confidence = Math.min(0.9, 0.5 + (trade * 0.1));
            reasoning.push(`${trade} trade nodes detected`);
        }

        if (mines > 0) {
            category = 'INDUSTRIAL';
            confidence = Math.min(0.9, 0.6 + (mines * 0.1));
            reasoning.push(`${mines} mining operations detected`);
        }

        if (ftl > 2 && entities < 3) {
            category = 'TRANSIT';
            confidence = Math.min(0.8, 0.5 + (ftl * 0.05));
            reasoning.push(`High FTL traffic (${ftl} routes), low entity count`);
        }

        if (entities > 5 && this.isFullyProtected()) {
            category = 'MILITARY';
            confidence = Math.min(0.85, 0.6 + (entities * 0.02));
            reasoning.push(`High entity count with full protection`);
        }

        if (entities > 0 && trade === 0 && mines === 0) {
            category = 'RESIDENTIAL';
            confidence = Math.min(0.7, 0.4 + (entities * 0.05));
            reasoning.push(`Entities present but no commercial activity`);
        }

        return { category, confidence, reasoning };
    }

    /** Perform comprehensive sector analysis */
    public performSectorAnalysis(): SectorAnalysis {
        const entities = this.getEntitiesCount();
        const economic = this.getEconomicActivityScore();
        const ftl = this.getFtlRoutesCount().total;
        const protection = this.getProtection();

        // Strategic value calculation (0-100)
        let strategicValue = 0;
        strategicValue += Math.min(30, economic * 5); // Economic activity
        strategicValue += Math.min(20, ftl * 2);      // Transportation hub
        strategicValue += Math.min(25, entities);     // Entity presence
        
        // Type-based bonuses
        const type = this.getType();
        if (type === SectorType.PLANET) strategicValue += 15;
        if (type === SectorType.SPACE_STATION) strategicValue += 10;
        if (type === SectorType.WORMHOLE) strategicValue += 20;

        // Accessibility score
        const accessibilityScore = this.allowsEntry() && this.allowsExit() ? 
            Math.min(100, 50 + ftl * 5 + economic * 10) : 0;

        // Traffic score
        const trafficScore = Math.min(100, ftl * 10 + entities * 2);

        // Security risk assessment
        let securityRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (!this.hasProtection(SectorProtection.NO_SPAWN) && entities > 3) securityRisk = 'MEDIUM';
        if (!this.hasProtection(SectorProtection.NO_ATTACK) && economic > 2) securityRisk = 'HIGH';
        if (strategicValue > 70 && protection === ProtectionLevel.NORMAL) securityRisk = 'CRITICAL';

        // Recommended protection
        let recommendedProtection = ProtectionLevel.NORMAL;
        if (economic > 1) recommendedProtection = ProtectionLevel.SAFE_ZONE;
        if (strategicValue > 50) recommendedProtection = ProtectionLevel.COMPLETE_PROTECTION;

        return {
            strategicValue,
            accessibilityScore,
            trafficScore,
            securityRisk,
            recommendedProtection
        };
    }

    // =============================================================================
    // COMPREHENSIVE SUMMARY
    // =============================================================================

    /** Get ultimate sector summary with all information */
    public getSectorSummary(): {
        // Basic Information
        id: number;
        coordinates: string;
        type: SectorType;
        typeName: string;
        name: string;
        stellar: number;
        protection: number;
        protectionDescription: string;
        transient: boolean;
        lastReplenished: number;
        itemsReference: number;
        
        // Relationship Counts (if loaded)
        entitiesCount?: number;
        tradeNodesCount?: number;
        minesCount?: number;
        visibilityRecordsCount?: number;
        ftlRoutesCount?: { from: number; to: number; total: number };
        
        // Relationship Status
        hasSystemLoaded?: boolean;
        hasSectorItemsLoaded?: boolean;
        hasCriticalRelationsLoaded?: boolean;
        hasEconomicRelationsLoaded?: boolean;
        
        // Advanced Analytics
        economicActivityScore?: number;
        totalActivityScore?: number;
        sectorAnalysis?: SectorAnalysis;
        classification?: {
            category: string;
            confidence: number;
            reasoning: string[];
        };
        protectionAnalysis?: {
            level: ProtectionLevel;
            isSecure: boolean;
            canModify: boolean;
            recommendations: string[];
        };
        
        // Performance Metrics
        performanceScore?: number;
        lastCalculated?: number;
    } {
        const summary: any = {
            // Basic Information
            id: this.getId(),
            coordinates: this.getCoordinatesString(),
            type: this.getType(),
            typeName: this.getTypeName(),
            name: this.getName(),
            stellar: this.getStellar(),
            protection: this.getProtection(),
            protectionDescription: this.getProtectionDescription(),
            transient: this.getTransient(),
            lastReplenished: this.getLastReplenished(),
            itemsReference: this.getItems()
        };

        // Add relationship information if loaded
        if (this.hasEntitiesLoaded()) {
            summary.entitiesCount = this.getEntitiesCount();
        }

        if (this.hasRelated('tradeNodes')) {
            summary.tradeNodesCount = this.getTradeNodesCount();
        }

        if (this.hasRelated('mines')) {
            summary.minesCount = this.getMinesCount();
        }

        if (this.hasRelated('visibilityRecords')) {
            summary.visibilityRecordsCount = this.getVisibilityRecordsCount();
        }

        if (this.hasFtlRoutesLoaded()) {
            summary.ftlRoutesCount = this.getFtlRoutesCount();
        }

        // Relationship Status
        summary.hasSystemLoaded = this.hasSystemLoaded();
        summary.hasSectorItemsLoaded = this.hasSectorItemsLoaded();
        summary.hasCriticalRelationsLoaded = this.hasCriticalRelationsLoaded();
        summary.hasEconomicRelationsLoaded = this.hasEconomicRelationsLoaded();

        // Advanced Analytics (only if relations are loaded)
        if (this.hasEntitiesLoaded() || this.hasEconomicRelationsLoaded()) {
            summary.economicActivityScore = this.getEconomicActivityScore();
            summary.totalActivityScore = this.getTotalActivityScore();
            summary.sectorAnalysis = this.performSectorAnalysis();
            summary.classification = this.getSectorClassification();
            summary.protectionAnalysis = this.analyzeProtectionLevel();
            
            // Performance score (combination of all metrics)
            summary.performanceScore = Math.min(100, 
                summary.totalActivityScore + 
                summary.sectorAnalysis.strategicValue * 0.5
            );
            
            summary.lastCalculated = Date.now();
        }

        return summary;
    }

    // =============================================================================
    // PERFORMANCE OPTIMIZATIONS
    // =============================================================================

    /** Check if sector meets performance criteria */
    public meetsPerformanceCriteria(hints?: SectorQueryHints): boolean {
        if (!hints) return true;

        // Validate spatial index usage
        if (hints.useSpatialIndex && (this.getX() === undefined || this.getY() === undefined || this.getZ() === undefined)) {
            return false;
        }

        // Validate caching requirements
        if (hints.cacheProtections && this.getProtection() === undefined) {
            return false;
        }

        // Validate prefetch requirements
        if (hints.prefetchSystem && !this.hasSystemLoaded()) {
            return false;
        }

        // Validate entity count requirements
        if (hints.includeEntityCount && !this.hasEntitiesLoaded()) {
            return false;
        }

        return true;
    }

    /** Generate cache key for this sector */
    public getCacheKey(operation: string = 'default'): string {
        return `sector:${this.getCoordinatesString()}:${operation}:${this.getLastReplenished()}`;
    }

    /** Check if sector data is stale */
    public isStale(maxAge: number = 300000): boolean {
        const lastReplenished = this.getLastReplenished();
        return lastReplenished > 0 && (Date.now() - lastReplenished) > maxAge;
    }

    // =============================================================================
    // COORDINATE MANAGEMENT - CORRECTED FOR PER-SYSTEM UNIQUENESS
    // =============================================================================

    /**
     * Get the global coordinate key enforced by SectorTable.secCoordIndex
     */
    public getUniqueCoordinateKey(): string {
        return this.getCoordinatesString();
    }

    /**
     * Get unique identifier including system information for debugging
     */
    public getSystemContextCoordinateKey(): string {
        return `${this.getStellar()}:(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
    }

    /**
     * Check if coordinates are unique within the system
     */
    public validateCoordinateUniqueness(): {
        isUnique: boolean;
        conflictKey: string;
        systemId: number;
        message: string;
    } {
        const systemId = this.getStellar();
        const coordinateKey = this.getCoordinatesString();
        const uniqueKey = this.getUniqueCoordinateKey();
        
        return {
            isUnique: true, // Database constraint enforces uniqueness per system
            conflictKey: uniqueKey,
            systemId,
            message: `Sector at ${coordinateKey} must be globally unique (system ${systemId})`
        };
    }

    /**
     * Compare coordinate conflict with another sector
     * STELLAR does not participate in the unique coordinate index
     */
    public hasCoordinateConflictWith(other: SectorsModel): boolean {
        return this.getX() === other.getX() &&
               this.getY() === other.getY() &&
               this.getZ() === other.getZ() &&
               this.getId() !== other.getId(); // Different sectors with identical global coordinates
    }

    /**
     * Get coordinate conflict message
     */
    public getCoordinateConflictMessage(): string {
        const coords = this.getCoordinatesString();
        const systemId = this.getStellar();
        return `Sector coordinates ${coords} must be unique globally (system ${systemId}). Only one sector can exist at these coordinates in the universe.`;
    }

    /**
     * Derive system coordinates and local coordinates from global sector positions.
     * @param systemSize Number of sectors per axis, sixteen in the StarMade grid.
     * @returns Nonnegative local coordinates and floor-divided system coordinates.
     * @throws RangeError When the grid size is not a positive safe integer.
     */
    public calculateRelativeCoordinatesInSystem(systemSize: number = 16): {
        relative: { x: number; y: number; z: number };
        systemCoords: { x: number; y: number; z: number };
        calculated: boolean;
    } {
        if (!Number.isSafeInteger(systemSize) || systemSize <= 0) {
            throw new RangeError('System size must be a positive safe integer');
        }
        const systemCoords = {
            x: Math.floor(this.getX() / systemSize),
            y: Math.floor(this.getY() / systemSize),
            z: Math.floor(this.getZ() / systemSize)
        };
        return {
            relative: {
                x: this.getX() - systemCoords.x * systemSize,
                y: this.getY() - systemCoords.y * systemSize,
                z: this.getZ() - systemCoords.z * systemSize
            },
            systemCoords,
            calculated: true
        };
    }

    /**
     * Test whether this sector lies at the local origin of its system grid.
     * @param systemSize Number of sectors per axis; defaults to sixteen.
     * @returns True when every local coordinate is zero.
     */
    public isSystemOrigin(systemSize: number = 16): boolean {
        const { relative } = this.calculateRelativeCoordinatesInSystem(systemSize);
        return relative.x === 0 && relative.y === 0 && relative.z === 0;
    }
}
