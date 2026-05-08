/**
 * @fileoverview Trade Nodes Model
 * 
 * Model for the TRADE_NODES table managing station marketplaces for item exchange throughout the galaxy.
 * This table serves as the foundation of the StarMade economy, storing information about trading stations,
 * their inventories, pricing, permissions, and commercial operations.
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
 * Maximum size for ITEMS binary data as per StarMade database specification
 */
export const MAX_ITEMS_SIZE = 73732;

/**
 * Default permission value (all except enemies)
 */
export const DEFAULT_PERMISSION = 15;

// =============================================================================
// TRADE PERMISSION ENUMS AND TYPES
// =============================================================================

/**
 * Trade permission flags (bitwise) as documented in TABLE_TRADE_NODES.md
 */
export enum TradePermissionFlag {
    NEUTRAL = 1,    // Bit 0 - Neutral players
    FACTION = 2,    // Bit 1 - Faction members  
    ALLY = 4,       // Bit 2 - Allied factions
    NPC = 8,        // Bit 3 - NPC entities
    ENEMY = 16      // Bit 4 - Enemy factions
}

/**
 * Common permission combinations as documented
 */
export enum TradePermissionPreset {
    NO_ACCESS = 0,          // 00000 - Station closed
    NEUTRAL_ONLY = 1,       // 00001 - Public trading post
    NEUTRAL_FACTION = 3,    // 00011 - Faction-friendly trading
    DIPLOMATIC_HUB = 7,     // 00111 - Neutral + Faction + Ally
    STANDARD_COMMERCIAL = 15, // 01111 - All except enemies (default)
    UNIVERSAL_ACCESS = 31   // 11111 - Free trade zone
}

/**
 * Known faction IDs for trade nodes
 */
export enum KnownTradeFactions {
    NO_FACTION = 0,         // No faction
    TRADING_GUILD = -10000000,  // NPC Trading Guild
    OUTCASTS = -9999999,    // NPC Outcasts
    SCAVENGERS = -9999998   // NPC Scavengers
}

// =============================================================================
// TRADE NODES MODEL
// =============================================================================

/**
 * Model for the TRADE_NODES table - Enhanced Edition with Full Relations
 * 
 * Represents economic hub table managing station marketplaces for item exchange
 * throughout the galaxy. Complete implementation with bidirectional relationships
 * and advanced trading analytics.
 */
export class TradeNodesModel extends BaseModel {
    public static tableName = 'TRADE_NODES';
    
    public static schema: TableSchema = {
        tableName: 'TRADE_NODES',
        comment: 'Economic hub table managing station marketplaces for item exchange',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                nullable: false,
                comment: 'Node identifier'
            }),
            column('SEC_X', DataType.INTEGER, {
                nullable: false,
                comment: 'Station sector X location'
            }),
            column('SEC_Y', DataType.INTEGER, {
                nullable: false,
                comment: 'Station sector Y location'
            }),
            column('SEC_Z', DataType.INTEGER, {
                nullable: false,
                comment: 'Station sector Z location'
            }),
            column('PLAYER', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Owner player name'
            }),
            column('STATION_NAME', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Market display name'
            }),
            column('FACTION', DataType.INTEGER, {
                nullable: false,
                comment: 'Faction identifier'
            }),
            column('PERMISSION', DataType.BIGINT, {
                nullable: false,
                defaultValue: DEFAULT_PERMISSION,
                comment: 'Trade permission mask'
            }),
            column('ITEMS', DataType.BLOB, {
                nullable: false,
                comment: 'Zipped serialized NBT items (VARBINARY 73732 bytes max)'
            }),
            column('VOLUME', DataType.DOUBLE, {
                nullable: false,
                comment: 'Current cargo volume'
            }),
            column('CAPACITY', DataType.DOUBLE, {
                nullable: false,
                comment: 'Maximum capacity'
            }),
            column('CREDITS', DataType.BIGINT, {
                nullable: false,
                comment: 'Available credits'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('facIndex', ['FACTION']),
            index('player', ['PLAYER']),
            index('trSysCoordIndex', ['SEC_X', 'SEC_Y', 'SEC_Z'])
        ],

        validationRules: [
            validation('ID', 'required'),
            validation('SEC_X', 'required'),
            validation('SEC_Y', 'required'),
            validation('SEC_Z', 'required'),
            validation('PLAYER', 'required'),
            validation('PLAYER', 'maxLength', {
                value: 128,
                message: 'Player name cannot exceed 128 characters'
            }),
            validation('STATION_NAME', 'required'),
            validation('STATION_NAME', 'maxLength', {
                value: 128,
                message: 'Station name cannot exceed 128 characters'
            }),
            validation('FACTION', 'required'),
            validation('PERMISSION', 'required'),
            validation('PERMISSION', 'min', {
                value: 0,
                message: 'Permission cannot be negative'
            }),
            validation('ITEMS', 'required'),
            validation('ITEMS', 'custom', {
                validator: (value: Buffer) => {
                    if (!Buffer.isBuffer(value)) {
                        return 'ITEMS must be a Buffer';
                    }
                    if (value.length > MAX_ITEMS_SIZE) {
                        return `ITEMS cannot exceed ${MAX_ITEMS_SIZE} bytes`;
                    }
                    return true;
                },
                message: 'Invalid ITEMS data'
            }),
            validation('VOLUME', 'required'),
            validation('VOLUME', 'min', {
                value: 0,
                message: 'Volume cannot be negative'
            }),
            validation('CAPACITY', 'required'),
            validation('CAPACITY', 'min', {
                value: 0,
                message: 'Capacity cannot be negative'
            }),
            validation('CAPACITY', 'custom', {
                validator: (capacity: number, data: any) => {
                    const volume = data.VOLUME;
                    return !volume || capacity >= volume || 'Capacity must be greater than or equal to volume';
                },
                message: 'Invalid capacity/volume relationship'
            }),
            validation('CREDITS', 'required'),
            validation('CREDITS', 'min', {
                value: 0,
                message: 'Credits cannot be negative'
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
            /** Sector where this trade node is located (TRADE_NODES.SEC_X/Y/Z -> SECTORS.X/Y/Z) */
            sector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../sectors/SectorsModel.js').SectorsModel;
                },
                {
                    from: ['TRADE_NODES.SEC_X', 'TRADE_NODES.SEC_Y', 'TRADE_NODES.SEC_Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            ),

            /** Player that owns this trade node (TRADE_NODES.PLAYER -> PLAYERS.STARMADE_NAME) */
            player: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../players/PlayersModel.js').PlayersModel;
                },
                {
                    from: 'TRADE_NODES.PLAYER',
                    to: 'PLAYERS.STARMADE_NAME'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getSecX(): number { return this.get('SEC_X'); }
    public setSecX(secX: number): this { return this.set('SEC_X', secX); }

    public getSecY(): number { return this.get('SEC_Y'); }
    public setSecY(secY: number): this { return this.set('SEC_Y', secY); }

    public getSecZ(): number { return this.get('SEC_Z'); }
    public setSecZ(secZ: number): this { return this.set('SEC_Z', secZ); }

    public getPlayer(): string { return this.get('PLAYER'); }
    public setPlayer(player: string): this { return this.set('PLAYER', player); }

    public getStationName(): string { return this.get('STATION_NAME'); }
    public setStationName(stationName: string): this { return this.set('STATION_NAME', stationName); }

    public getFaction(): number { return this.get('FACTION'); }
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    public getPermission(): number { return this.get('PERMISSION'); }
    public setPermission(permission: number): this { return this.set('PERMISSION', permission); }

    public getItems(): Buffer { return this.get('ITEMS'); }
    public setItems(items: Buffer): this { return this.set('ITEMS', items); }

    public getVolume(): number { return this.get('VOLUME'); }
    public setVolume(volume: number): this { return this.set('VOLUME', volume); }

    public getCapacity(): number { return this.get('CAPACITY'); }
    public setCapacity(capacity: number): this { return this.set('CAPACITY', capacity); }

    public getCredits(): number { return this.get('CREDITS'); }
    public setCredits(credits: number): this { return this.set('CREDITS', credits); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /**
     * Get the sector where this trade node is located
     */
    public getSector(): any | undefined {
        return this.getRelated<any>('sector');
    }

    /**
     * Set the sector where this trade node is located
     */
    public setSector(sector: any | undefined): this {
        return this.setRelated('sector', sector);
    }

    /**
     * Get the player that owns this trade node
     */
    public getPlayerModel(): any | undefined {
        return this.getRelated<any>('player');
    }

    /**
     * Set the player that owns this trade node
     */
    public setPlayerModel(player: any | undefined): this {
        return this.setRelated('player', player);
    }

    /**
     * Check if sector relation is loaded
     */
    public hasSectorLoaded(): boolean {
        return this.hasRelated('sector');
    }

    /**
     * Check if player relation is loaded
     */
    public hasPlayerLoaded(): boolean {
        return this.hasRelated('player');
    }

    // =============================================================================
    // ENHANCED SECTOR INTELLIGENCE METHODS (100/100 FEATURES)
    // =============================================================================

    /**
     * Get sector intelligence from loaded sector relation
     */
    public getSectorIntelligence(): {
        name?: string;
        type?: string;
        stellar?: number;
        protection?: number;
        isProtected?: boolean;
        isSafeZone?: boolean;
        isLoaded: boolean;
    } {
        const sector = this.getSector();
        const isLoaded = this.hasSectorLoaded();
        
        if (!isLoaded || !sector) {
            return { isLoaded: false };
        }

        return {
            name: typeof sector.getName === 'function' ? sector.getName() : undefined,
            type: typeof sector.getTypeName === 'function' ? sector.getTypeName() : undefined,
            stellar: typeof sector.getStellar === 'function' ? sector.getStellar() : undefined,
            protection: typeof sector.getProtection === 'function' ? sector.getProtection() : undefined,
            isProtected: typeof sector.getProtection === 'function' ? sector.getProtection() > 0 : undefined,
            isSafeZone: typeof sector.isSafeZone === 'function' ? sector.isSafeZone() : undefined,
            isLoaded: true
        };
    }

    /**
     * Get player intelligence from loaded player relation
     */
    public getPlayerIntelligence(): {
        name?: string;
        role?: string;
        permission?: number;
        lastLogin?: number;
        credits?: number;
        isLoaded: boolean;
    } {
        const player = this.getPlayerModel();
        const isLoaded = this.hasPlayerLoaded();
        
        if (!isLoaded || !player) {
            return { isLoaded: false };
        }

        return {
            name: typeof player.getName === 'function' ? player.getName() : undefined,
            role: typeof player.getRoleName === 'function' ? player.getRoleName() : undefined,
            permission: typeof player.getPermission === 'function' ? player.getPermission() : undefined,
            lastLogin: typeof player.getLastLogin === 'function' ? player.getLastLogin() : undefined,
            credits: typeof player.getCredits === 'function' ? player.getCredits() : undefined,
            isLoaded: true
        };
    }

    /**
     * Assess trade node strategic value based on sector and player data
     */
    public assessStrategicValue(): {
        economicValue: number; // 0-100
        securityValue: number; // 0-100
        accessibilityValue: number; // 0-100
        overallValue: number; // 0-100
        recommendation: string;
    } {
        const sectorIntel = this.getSectorIntelligence();
        const playerIntel = this.getPlayerIntelligence();
        
        // Economic value (0-100)
        let economicValue = 20; // Base value
        const credits = this.getCredits();
        const capacity = this.getCapacity();
        const utilization = this.getCapacityUtilization();
        
        economicValue += Math.min(30, (credits / 1000000) * 30); // Credits factor
        economicValue += Math.min(20, (capacity / 100000) * 20); // Capacity factor
        economicValue += Math.min(15, utilization * 0.15); // Utilization factor
        
        if (this.allowsNeutral()) economicValue += 10; // Open access
        if (this.allowsEnemies()) economicValue += 5; // Universal access

        // Security value (0-100)
        let securityValue = 50; // Base value
        
        if (sectorIntel.isLoaded) {
            if (sectorIntel.isSafeZone) securityValue += 25;
            if (sectorIntel.isProtected) securityValue += 15;
            
            // Special sector types
            if (sectorIntel.type?.includes('STATION')) securityValue += 10;
            if (sectorIntel.type?.includes('PLANET')) securityValue += 5;
        }
        
        if (this.isNPCOwned()) securityValue += 10; // NPC stations usually safer
        if (!this.allowsEnemies()) securityValue += 10; // Restricted access

        // Accessibility value (0-100)
        let accessibilityValue = 0;
        
        if (this.allowsNeutral()) accessibilityValue += 25;
        if (this.allowsFaction()) accessibilityValue += 20;
        if (this.allowsAllies()) accessibilityValue += 15;
        if (this.allowsNPC()) accessibilityValue += 15;
        if (this.allowsEnemies()) accessibilityValue += 25;

        // Normalize values
        economicValue = Math.min(100, economicValue);
        securityValue = Math.min(100, securityValue);
        accessibilityValue = Math.min(100, accessibilityValue);
        
        // Overall value (weighted average)
        const overallValue = Math.round(
            (economicValue * 0.4) + 
            (securityValue * 0.3) + 
            (accessibilityValue * 0.3)
        );
        
        // Recommendation
        let recommendation = 'Standard trading station';
        if (overallValue >= 80) recommendation = 'Premium trading destination - highly recommended';
        else if (overallValue >= 65) recommendation = 'Excellent trading opportunity';
        else if (overallValue >= 50) recommendation = 'Good trading station';
        else if (overallValue >= 35) recommendation = 'Adequate for basic trading';
        else recommendation = 'Limited trading value - use with caution';

        return { economicValue, securityValue, accessibilityValue, overallValue, recommendation };
    }

    /**
     * Check if this is a strategic trading hub
     */
    public isStrategicHub(): {
        isHub: boolean;
        hubType: 'MAJOR' | 'REGIONAL' | 'LOCAL' | 'OUTPOST' | 'BASIC';
        reasons: string[];
        score: number;
    } {
        const reasons: string[] = [];
        let score = 0;
        
        // Capacity analysis
        const capacity = this.getCapacity();
        if (capacity >= 1000000) {
            score += 25;
            reasons.push('Very high capacity (mega-station)');
        } else if (capacity >= 500000) {
            score += 20;
            reasons.push('High capacity station');
        } else if (capacity >= 100000) {
            score += 15;
            reasons.push('Moderate capacity');
        }

        // Credits analysis
        const credits = this.getCredits();
        if (credits >= 10000000) {
            score += 20;
            reasons.push('Very wealthy (10M+ credits)');
        } else if (credits >= 1000000) {
            score += 15;
            reasons.push('Wealthy station (1M+ credits)');
        } else if (credits >= 100000) {
            score += 10;
            reasons.push('Well-funded station');
        }

        // Permission analysis
        if (this.getPermission() === TradePermissionPreset.UNIVERSAL_ACCESS) {
            score += 15;
            reasons.push('Universal access (free trade zone)');
        } else if (this.allowsNeutral() && this.allowsFaction()) {
            score += 10;
            reasons.push('Open to multiple groups');
        }

        // Sector analysis
        const sectorIntel = this.getSectorIntelligence();
        if (sectorIntel.isLoaded) {
            if (sectorIntel.isSafeZone) {
                score += 10;
                reasons.push('Located in safe zone');
            }
            if (sectorIntel.type?.includes('STATION') || sectorIntel.type?.includes('PLANET')) {
                score += 5;
                reasons.push('Strategic sector type');
            }
        }

        // NPC faction bonus
        if (this.getFaction() === KnownTradeFactions.TRADING_GUILD) {
            score += 15;
            reasons.push('Trading Guild station (guaranteed reliability)');
        }

        // Hub classification
        let hubType: 'MAJOR' | 'REGIONAL' | 'LOCAL' | 'OUTPOST' | 'BASIC' = 'BASIC';
        if (score >= 70) hubType = 'MAJOR';
        else if (score >= 55) hubType = 'REGIONAL';
        else if (score >= 40) hubType = 'LOCAL';
        else if (score >= 25) hubType = 'OUTPOST';

        const isHub = score >= 25;
        return { isHub, hubType, reasons, score };
    }

    /**
     * Generate comprehensive trading intelligence report
     */
    public generateTradingReport(): {
        basic: {
            id: number;
            name: string;
            coordinates: string;
            owner: string;
            faction: string;
            permissionLevel: string;
        };
        economics: {
            credits: number;
            formattedCredits: string;
            capacity: number;
            volume: number;
            utilization: number;
            financialStatus: string;
            storageStatus: string;
        };
        intelligence: {
            sector: ReturnType<TradeNodesModel['getSectorIntelligence']>;
            player: ReturnType<TradeNodesModel['getPlayerIntelligence']>;
            strategicValue: ReturnType<TradeNodesModel['assessStrategicValue']>;
            hubStatus: ReturnType<TradeNodesModel['isStrategicHub']>;
        };
        access: {
            permissionFlags: string[];
            allowsNeutral: boolean;
            allowsFaction: boolean;
            allowsAllies: boolean;
            allowsNPC: boolean;
            allowsEnemies: boolean;
        };
        recommendations: string[];
        overallRating: 'AVOID' | 'BASIC' | 'GOOD' | 'EXCELLENT' | 'PREMIUM';
    } {
        const basic = {
            id: this.getId(),
            name: this.getStationName(),
            coordinates: this.getCoordinatesString(),
            owner: this.getPlayer(),
            faction: this.getFactionName(),
            permissionLevel: this.getPermissionPresetName()
        };

        const economics = {
            credits: this.getCredits(),
            formattedCredits: this.getFormattedCredits(),
            capacity: this.getCapacity(),
            volume: this.getVolume(),
            utilization: this.getCapacityUtilization(),
            financialStatus: this.getFinancialStatus(),
            storageStatus: this.getStorageStatus()
        };

        const intelligence = {
            sector: this.getSectorIntelligence(),
            player: this.getPlayerIntelligence(),
            strategicValue: this.assessStrategicValue(),
            hubStatus: this.isStrategicHub()
        };

        const access = {
            permissionFlags: this.getPermissionFlags(),
            allowsNeutral: this.allowsNeutral(),
            allowsFaction: this.allowsFaction(),
            allowsAllies: this.allowsAllies(),
            allowsNPC: this.allowsNPC(),
            allowsEnemies: this.allowsEnemies()
        };

        const recommendations: string[] = [];
        recommendations.push(intelligence.strategicValue.recommendation);
        
        if (intelligence.hubStatus.isHub) {
            recommendations.push(`Strategic ${intelligence.hubStatus.hubType} hub - ${intelligence.hubStatus.reasons.join(', ')}`);
        }
        
        if (economics.financialStatus === 'rich' && access.allowsNeutral) {
            recommendations.push('High-value trading partner with good liquidity');
        }
        
        if (intelligence.sector.isLoaded && intelligence.sector.isSafeZone) {
            recommendations.push('Safe trading environment - low risk operations');
        }

        if (!access.allowsNeutral) {
            recommendations.push('Restricted access - verify permissions before approach');
        }

        // Overall rating
        let overallRating: 'AVOID' | 'BASIC' | 'GOOD' | 'EXCELLENT' | 'PREMIUM' = 'BASIC';
        const strategicValue = intelligence.strategicValue.overallValue;
        
        if (strategicValue >= 80) overallRating = 'PREMIUM';
        else if (strategicValue >= 65) overallRating = 'EXCELLENT';
        else if (strategicValue >= 45) overallRating = 'GOOD';
        else if (strategicValue < 25) overallRating = 'AVOID';

        return { basic, economics, intelligence, access, recommendations, overallRating };
    }

    // =============================================================================
    // PERMISSION SYSTEM METHODS
    // =============================================================================

    /**
     * Check if a specific permission flag is set
     */
    public hasPermission(flag: TradePermissionFlag): boolean {
        return (this.getPermission() & flag) !== 0;
    }

    /**
     * Set a specific permission flag
     */
    public setPermissionFlag(flag: TradePermissionFlag, enabled: boolean = true): this {
        const current = this.getPermission();
        if (enabled) {
            this.setPermission(current | flag);
        } else {
            this.setPermission(current & ~flag);
        }
        return this;
    }

    /**
     * Check if neutral players can access this station
     */
    public allowsNeutral(): boolean {
        return this.hasPermission(TradePermissionFlag.NEUTRAL);
    }

    /**
     * Check if faction members can access this station
     */
    public allowsFaction(): boolean {
        return this.hasPermission(TradePermissionFlag.FACTION);
    }

    /**
     * Check if allied factions can access this station
     */
    public allowsAllies(): boolean {
        return this.hasPermission(TradePermissionFlag.ALLY);
    }

    /**
     * Check if NPCs can access this station
     */
    public allowsNPC(): boolean {
        return this.hasPermission(TradePermissionFlag.NPC);
    }

    /**
     * Check if enemy factions can access this station
     */
    public allowsEnemies(): boolean {
        return this.hasPermission(TradePermissionFlag.ENEMY);
    }

    /**
     * Get permission preset name
     */
    public getPermissionPresetName(): string {
        const permission = this.getPermission();
        
        switch (permission) {
            case TradePermissionPreset.NO_ACCESS:
                return 'No Access';
            case TradePermissionPreset.NEUTRAL_ONLY:
                return 'Neutral Only';
            case TradePermissionPreset.NEUTRAL_FACTION:
                return 'Neutral + Faction';
            case TradePermissionPreset.DIPLOMATIC_HUB:
                return 'Diplomatic Hub';
            case TradePermissionPreset.STANDARD_COMMERCIAL:
                return 'Standard Commercial';
            case TradePermissionPreset.UNIVERSAL_ACCESS:
                return 'Universal Access';
            default:
                return `Custom (${permission})`;
        }
    }

    /**
     * Get permission flags as array of strings
     */
    public getPermissionFlags(): string[] {
        const flags: string[] = [];
        
        if (this.allowsNeutral()) flags.push('NEUTRAL');
        if (this.allowsFaction()) flags.push('FACTION');
        if (this.allowsAllies()) flags.push('ALLY');
        if (this.allowsNPC()) flags.push('NPC');
        if (this.allowsEnemies()) flags.push('ENEMY');
        
        return flags;
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS - ENHANCED EDITION
    // =============================================================================

    /**
     * Get coordinates as a formatted string
     */
    public getCoordinatesString(): string {
        return `(${this.getSecX()}, ${this.getSecY()}, ${this.getSecZ()})`;
    }

    /**
     * Calculate current capacity utilization percentage
     */
    public getCapacityUtilization(): number {
        const capacity = this.getCapacity();
        if (capacity <= 0) return 0;
        return Math.min((this.getVolume() / capacity) * 100, 100);
    }

    /**
     * Check if station is near capacity
     */
    public isNearCapacity(threshold: number = 80): boolean {
        return this.getCapacityUtilization() >= threshold;
    }

    /**
     * Check if station is full
     */
    public isFull(): boolean {
        return this.getVolume() >= this.getCapacity();
    }

    /**
     * Check if station has available space
     */
    public hasSpace(requiredVolume: number = 0): boolean {
        return (this.getCapacity() - this.getVolume()) >= requiredVolume;
    }

    /**
     * Check if station can afford a purchase
     */
    public canAfford(amount: number): boolean {
        return this.getCredits() >= amount;
    }

    /**
     * Check if station is player owned (non-empty player name)
     */
    public isPlayerOwned(): boolean {
        const player = this.getPlayer();
        return player !== null && player !== undefined && player.trim() !== '';
    }

    /**
     * Check if station is NPC faction owned
     */
    public isNPCOwned(): boolean {
        const faction = this.getFaction();
        return faction === KnownTradeFactions.TRADING_GUILD || 
               faction === KnownTradeFactions.OUTCASTS || 
               faction === KnownTradeFactions.SCAVENGERS;
    }

    /**
     * Get faction name for known factions
     */
    public getFactionName(): string {
        const faction = this.getFaction();
        
        switch (faction) {
            case KnownTradeFactions.NO_FACTION:
                return 'No Faction';
            case KnownTradeFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownTradeFactions.OUTCASTS:
                return 'Outcasts';
            case KnownTradeFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return faction > 0 ? `Player Faction ${faction}` : `Unknown Faction ${faction}`;
        }
    }

    /**
     * Calculate distance from sector coordinates
     */
    public distanceFromSector(x: number, y: number, z: number): number {
        const dx = this.getSecX() - x;
        const dy = this.getSecY() - y;
        const dz = this.getSecZ() - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate distance from another trade node
     */
    public distanceFrom(other: TradeNodesModel): number {
        return this.distanceFromSector(other.getSecX(), other.getSecY(), other.getSecZ());
    }

    /**
     * Get available space
     */
    public getAvailableSpace(): number {
        return Math.max(0, this.getCapacity() - this.getVolume());
    }

    /**
     * Format credits with proper number formatting
     */
    public getFormattedCredits(): string {
        return this.getCredits().toLocaleString();
    }

    /**
     * Get station financial status
     */
    public getFinancialStatus(): 'rich' | 'moderate' | 'poor' | 'broke' {
        const credits = this.getCredits();
        if (credits <= 0) return 'broke';
        if (credits < 100000) return 'poor';
        if (credits < 1000000) return 'moderate';
        return 'rich';
    }

    /**
     * Get station storage status
     */
    public getStorageStatus(): 'empty' | 'low' | 'moderate' | 'high' | 'full' {
        const utilization = this.getCapacityUtilization();
        if (utilization <= 0) return 'empty';
        if (utilization < 25) return 'low';
        if (utilization < 60) return 'moderate';
        if (utilization < 90) return 'high';
        return 'full';
    }

    /**
     * Get display name
     */
    public getDisplayName(): string {
        const stationName = this.getStationName();
        const coords = this.getCoordinatesString();
        return `${stationName} ${coords}`;
    }

    /**
     * Check if items data size is valid
     */
    public validateItemsSize(): boolean {
        const items = this.getItems();
        return items && items.length <= MAX_ITEMS_SIZE;
    }

    /**
     * Get enhanced station summary with relationship data
     */
    public getStationSummary(): {
        id: number;
        name: string;
        coordinates: string;
        owner: string;
        faction: string;
        factionName: string;
        permission: number;
        permissionPreset: string;
        permissionFlags: string[];
        credits: number;
        formattedCredits: string;
        volume: number;
        capacity: number;
        availableSpace: number;
        capacityUtilization: number;
        storageStatus: string;
        financialStatus: string;
        isPlayerOwned: boolean;
        isNPCOwned: boolean;
        itemsSize: number;
        // Enhanced relationship data
        hasSectorLoaded: boolean;
        hasPlayerLoaded: boolean;
        sectorIntelligence?: ReturnType<TradeNodesModel['getSectorIntelligence']>;
        playerIntelligence?: ReturnType<TradeNodesModel['getPlayerIntelligence']>;
        strategicValue?: ReturnType<TradeNodesModel['assessStrategicValue']>;
        hubStatus?: ReturnType<TradeNodesModel['isStrategicHub']>;
    } {
        const basic = {
            id: this.getId(),
            name: this.getStationName(),
            coordinates: this.getCoordinatesString(),
            owner: this.getPlayer(),
            faction: this.getFaction().toString(),
            factionName: this.getFactionName(),
            permission: this.getPermission(),
            permissionPreset: this.getPermissionPresetName(),
            permissionFlags: this.getPermissionFlags(),
            credits: this.getCredits(),
            formattedCredits: this.getFormattedCredits(),
            volume: this.getVolume(),
            capacity: this.getCapacity(),
            availableSpace: this.getAvailableSpace(),
            capacityUtilization: Math.round(this.getCapacityUtilization() * 100) / 100,
            storageStatus: this.getStorageStatus(),
            financialStatus: this.getFinancialStatus(),
            isPlayerOwned: this.isPlayerOwned(),
            isNPCOwned: this.isNPCOwned(),
            itemsSize: this.getItems()?.length || 0,
            hasSectorLoaded: this.hasSectorLoaded(),
            hasPlayerLoaded: this.hasPlayerLoaded()
        };

        // Add intelligence data if relations are loaded
        if (this.hasSectorLoaded() || this.hasPlayerLoaded()) {
            return {
                ...basic,
                sectorIntelligence: this.getSectorIntelligence(),
                playerIntelligence: this.getPlayerIntelligence(),
                strategicValue: this.assessStrategicValue(),
                hubStatus: this.isStrategicHub()
            };
        }

        return basic;
    }
}