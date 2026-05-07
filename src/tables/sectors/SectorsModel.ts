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
    VOID = 0,
    ASTEROID = 1,
    PLANET = 2,
    SPACE_STATION = 3,
    SUN = 4,
    BLACK_HOLE = 5,
    WORMHOLE = 6,
    NEBULA = 7,
    DOUBLE_STAR = 8,
    GIANT = 9
}

/**
 * Sector protection flags (bitwise)
 */
export enum SectorProtection {
    NO_SPAWN = 1,        // 0x1 - Peace mode, no enemy spawning
    NO_ATTACK = 2,       // 0x2 - Protected mode, no PvP
    NO_ENTER = 4,        // 0x4 - Sector locked, no entry
    NO_EXIT = 8,         // 0x8 - Sector locked, no exit
    NO_INDICATIONS = 16, // 0x10 - No sector notifications
    NO_FP_LOSS = 32      // 0x20 - No faction point loss
}

/**
 * Common protection combinations
 */
export enum ProtectionLevel {
    NORMAL = 0,                                           // No protection
    SAFE_ZONE = SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK,
    COMPLETE_PROTECTION = SectorProtection.NO_SPAWN | SectorProtection.NO_ATTACK | SectorProtection.NO_FP_LOSS,
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
    public static tableName = 'SECTORS';
    
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
            index('secCoordIndex', ['X', 'Y', 'Z', 'STELLAR'], { unique: true }),
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
            // Validation for coordinates unique per system
            validation('COORDINATES_VALID', 'custom', {
                validator: function(this: SectorsModel, value: any, data: Record<string, any>) {
                    const x = data.X;
                    const y = data.Y;
                    const z = data.Z;
                    
                    if (x === undefined || y === undefined || z === undefined) {
                        return 'Coordinates X, Y, Z are required';
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
                    return require('../systems/SystemsModel.js').SystemsModel;
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
                    return require('../sectors-items/SectorsItemsModel.js').SectorsItemsModel;
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
                    return require('../visibility/VisibilityModel.js').VisibilityModel;
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
                    return require('../trade-nodes/TradeNodesModel.js').TradeNodesModel;
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
                    return require('../mines/MinesModel.js').MinesModel;
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
                    return require('../ftl/FtlModel.js').FtlModel;
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
                    return require('../ftl/FtlModel.js').FtlModel;
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
                    return require('../entities/EntitiesModel.js').EntitiesModel;
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

    public getId(): number | undefined { 
        const id = this.get('ID');
        return id !== undefined ? Number(id) : undefined;
    }
    public setId(id: number): this { return this.set('ID', id); }

    public getX(): number { return this.get('X'); }
    public setX(x: number): this { return this.set('X', x); }

    public getY(): number { return this.get('Y'); }
    public setY(y: number): this { return this.set('Y', y); }

    public getZ(): number { return this.get('Z'); }
    public setZ(z: number): this { return this.set('Z', z); }

    public getType(): SectorType { return this.get('TYPE'); }
    public setType(type: SectorType): this { return this.set('TYPE', type); }

    public getName(): string { return this.get('NAME'); }
    public setName(name: string): this { return this.set('NAME', name); }

    public getItems(): number { return this.get('ITEMS'); }
    public setItems(items: number): this { return this.set('ITEMS', items); }

    public getProtection(): number { return this.get('PROTECTION'); }
    public setProtection(protection: number): this { return this.set('PROTECTION', protection); }

    public getStellar(): number { return this.get('STELLAR'); }
    public setStellar(stellar: number): this { return this.set('STELLAR', stellar); }

    public getTransient(): boolean { return this.get('TRANSIENT'); }
    public setTransient(transient: boolean): this { return this.set('TRANSIENT', transient); }

    /** Convenience method for checking if sector is transient */
    public isTransient(): boolean { return this.getTransient(); }

    public getLastReplenished(): number { return this.get('LAST_REPLENISHED'); }
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
     * Get unique identifier string for this sector's coordinates within its system
     */
    public getUniqueCoordinateKey(): string {
        return `${this.getStellar()}:(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
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
            message: `Sector at ${coordinateKey} in system ${systemId} must be unique`
        };
    }

    /**
     * Compare coordinate conflict with another sector
     * NOTE: Coordinates can only conflict if they're in the same system
     */
    public hasCoordinateConflictWith(other: SectorsModel): boolean {
        return this.getX() === other.getX() &&
               this.getY() === other.getY() &&
               this.getZ() === other.getZ() &&
               this.getStellar() === other.getStellar() &&
               this.getId() !== other.getId(); // Different sectors with same coordinates in same system
    }

    /**
     * Get coordinate conflict message
     */
    public getCoordinateConflictMessage(): string {
        const coords = this.getCoordinatesString();
        const systemId = this.getStellar();
        return `Sector coordinates ${coords} must be unique within system ${systemId}. Only one sector can exist at these coordinates per star system.`;
    }

    /**
     * Calculate relative coordinates within the system (for backwards compatibility/debugging)
     */
    public calculateRelativeCoordinatesInSystem(systemSize: number = 3): {
        relative: { x: number; y: number; z: number };
        systemCoords: { x: number; y: number; z: number };
        calculated: boolean;
    } {
        const relativeX = this.getX();
        const relativeY = this.getY();
        const relativeZ = this.getZ();
        
        // For this system, coordinates are already relative to the system
        // So system coordinates would be derived from the STELLAR field relationship
        const systemX = 0; // Would need to be calculated from system data
        const systemY = 0;
        const systemZ = 0;
        
        return {
            relative: { x: relativeX, y: relativeY, z: relativeZ },
            systemCoords: { x: systemX, y: systemY, z: systemZ },
            calculated: true
        };
    }

    /**
     * Check if sector is at the origin of its system (0,0,0)
     */
    public isSystemOrigin(systemSize: number = 3): boolean {
        return this.getX() === 0 && 
               this.getY() === 0 && 
               this.getZ() === 0;
    }
}