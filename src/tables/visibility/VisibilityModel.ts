/**
 * @fileoverview Visibility Model
 * 
 * Model for the VISIBILITY table implementing the "fog of war" system.
 * This table tracks which sectors have been explored by specific players or factions,
 * creating a persistent record of spatial knowledge and reconnaissance activities throughout the galaxy.
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
 * Known observer types for visibility tracking
 */
export enum KnownObserver {
    SYSTEM = 0,                     // System observer
    TRADING_GUILD = -10000000,      // Trading Guild NPC faction
    OUTCASTS = -9999999,            // Outcasts NPC faction
    SCAVENGERS = -9999998           // Scavengers NPC faction
}

// =============================================================================
// VISIBILITY MODEL
// =============================================================================

/**
 * Model for the VISIBILITY table
 * 
 * Strategic intelligence table implementing the "fog of war" system.
 * Tracks which sectors have been explored by specific players or factions,
 * creating a persistent record of spatial knowledge and reconnaissance activities.
 */
export class VisibilityModel extends BaseModel {
    public static tableName = 'VISIBILITY';
    
    public static schema: TableSchema = {
        tableName: 'VISIBILITY',
        comment: 'Strategic intelligence table implementing fog of war system',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                nullable: false,
                comment: 'Observer ID (player/faction)'
            }),
            column('X', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'Observed sector X coordinate'
            }),
            column('Y', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'Observed sector Y coordinate'
            }),
            column('Z', DataType.INTEGER, {
                primaryKey: true,
                nullable: false,
                comment: 'Observed sector Z coordinate'
            }),
            column('TIMESTAMP', DataType.BIGINT, {
                nullable: true,
                comment: 'First observation time'
            })
        ],

        primaryKey: ['ID', 'X', 'Y', 'Z'],
        foreignKeys: [],

        indexes: [
            index('vissetfull', ['ID','X', 'Y', 'Z']),
            index('vists', ['TIMESTAMP']),
            index('vispos', ['X', 'Y', 'Z'])
        ],

        validationRules: [
            validation('ID', 'required'),
            validation('X', 'required'),
            validation('Y', 'required'),
            validation('Z', 'required')
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
            /** Sector that is being observed (VISIBILITY.X/Y/Z -> SECTORS.X/Y/Z) */
            sector: relation(
                Model.BelongsToOneRelation,
                () => {
                    return require('../sectors/SectorsModel.js').SectorsModel;
                },
                {
                    from: ['VISIBILITY.X', 'VISIBILITY.Y', 'VISIBILITY.Z'],
                    to: ['SECTORS.X', 'SECTORS.Y', 'SECTORS.Z']
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    public setId(id: number): this { return this.set('ID', id); }

    public getX(): number { return this.get('X'); }
    public setX(x: number): this { return this.set('X', x); }

    public getY(): number { return this.get('Y'); }
    public setY(y: number): this { return this.set('Y', y); }

    public getZ(): number { return this.get('Z'); }
    public setZ(z: number): this { return this.set('Z', z); }

    public getTimestamp(): number | undefined { return this.get('TIMESTAMP'); }
    public setTimestamp(timestamp: number | undefined): this { return this.set('TIMESTAMP', timestamp); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /**
     * Get the sector that is being observed
     */
    public getSector(): any | undefined {
        return this.getRelated<any>('sector');
    }

    /**
     * Set the sector that is being observed
     */
    public setSector(sector: any | undefined): this {
        return this.setRelated('sector', sector);
    }

    /**
     * Check if sector relation is loaded
     */
    public hasSectorLoaded(): boolean {
        return this.hasRelated('sector');
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS - ENHANCED EDITION
    // =============================================================================

    /**
     * Get coordinates as a formatted string
     */
    public getCoordinatesString(): string {
        return `(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
    }

    /**
     * Get the observation date from timestamp
     */
    public getObservationDate(): Date | null {
        const timestamp = this.getTimestamp();
        return (timestamp !== null && timestamp !== undefined) ? new Date(timestamp) : null;
    }

    /**
     * Check if this sector has been observed
     */
    public isObserved(): boolean {
        const timestamp = this.getTimestamp();
        return timestamp !== null && timestamp !== undefined;
    }

    /**
     * Check if this is an unobserved sector (in the fog of war)
     */
    public isInFogOfWar(): boolean {
        return !this.isObserved();
    }

    /**
     * Get observer type classification
     */
    public getObserverType(): 'player' | 'system' | 'trading_guild' | 'outcasts' | 'scavengers' | 'faction' | 'unknown' {
        const id = this.getId();
        
        switch (id) {
            case KnownObserver.SYSTEM:
                return 'system';
            case KnownObserver.TRADING_GUILD:
                return 'trading_guild';
            case KnownObserver.OUTCASTS:
                return 'outcasts';
            case KnownObserver.SCAVENGERS:
                return 'scavengers';
            default:
                return id > 0 ? 'player' : 'faction';
        }
    }

    /**
     * Get observer name/description
     */
    public getObserverName(): string {
        const id = this.getId();
        
        switch (id) {
            case KnownObserver.SYSTEM:
                return 'System';
            case KnownObserver.TRADING_GUILD:
                return 'Trading Guild';
            case KnownObserver.OUTCASTS:
                return 'Outcasts';
            case KnownObserver.SCAVENGERS:
                return 'Scavengers';
            default:
                return id > 0 ? `Player ${id}` : `Faction ${id}`;
        }
    }

    /**
     * Check if this is a player observation
     */
    public isPlayerObservation(): boolean {
        const id = this.getId();
        return id > 0;
    }

    /**
     * Check if this is an NPC faction observation
     */
    public isNPCObservation(): boolean {
        const type = this.getObserverType();
        return type === 'trading_guild' || type === 'outcasts' || type === 'scavengers';
    }

    /**
     * Check if this is a system observation
     */
    public isSystemObservation(): boolean {
        return this.getObserverType() === 'system';
    }

    /**
     * Calculate distance from coordinates
     */
    public distanceFromCoordinates(x: number, y: number, z: number): number {
        const dx = this.getX() - x;
        const dy = this.getY() - y;
        const dz = this.getZ() - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate distance from another visibility record
     */
    public distanceFrom(other: VisibilityModel): number {
        return this.distanceFromCoordinates(other.getX(), other.getY(), other.getZ());
    }

    /**
     * Check if this sector is adjacent to given coordinates (Manhattan distance = 1)
     */
    public isAdjacentTo(x: number, y: number, z: number): boolean {
        const dx = Math.abs(this.getX() - x);
        const dy = Math.abs(this.getY() - y);
        const dz = Math.abs(this.getZ() - z);
        return (dx + dy + dz) === 1;
    }

    /**
     * Calculate how long ago this observation was made (in milliseconds)
     */
    public getAgeInMilliseconds(): number | null {
        const timestamp = this.getTimestamp();
        if (!timestamp) return null;
        return Date.now() - timestamp;
    }

    /**
     * Check if observation is recent (within given time in milliseconds)
     */
    public isRecentObservation(withinMs: number = 86400000): boolean { // Default: 24 hours
        const age = this.getAgeInMilliseconds();
        return age !== null && age <= withinMs;
    }

    /**
     * Format timestamp as ISO string
     */
    public getFormattedTimestamp(): string | null {
        const date = this.getObservationDate();
        return date ? date.toISOString() : null;
    }

    /**
     * Get relative time description
     */
    public getRelativeTimeDescription(): string {
        const age = this.getAgeInMilliseconds();
        
        if (age === null) {
            return 'Never observed';
        }
        
        const seconds = Math.floor(age / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        } else {
            return 'Just now';
        }
    }

    /**
     * Create observation entry for current time
     */
    public recordObservation(observerId: number, timestamp?: number): this {
        this.setId(observerId);
        this.setTimestamp(timestamp || Date.now());
        return this;
    }

    // =============================================================================
    // ADVANCED SECTOR INTELLIGENCE METHODS (100/100 FEATURES)
    // =============================================================================

    /**
     * Get sector intelligence from loaded sector relation
     */
    public getSectorIntelligence(): {
        name?: string;
        type?: string;
        stellar?: number;
        protection?: number;
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
            isLoaded: true
        };
    }

    /**
     * Get sector protection status if sector is loaded
     */
    public getSectorProtectionStatus(): {
        isProtected: boolean;
        isSafeZone: boolean;
        isLocked: boolean;
        protectionLevel?: string;
        isLoaded: boolean;
    } {
        const sector = this.getSector();
        const isLoaded = this.hasSectorLoaded();
        
        if (!isLoaded || !sector) {
            return { 
                isProtected: false, 
                isSafeZone: false, 
                isLocked: false, 
                isLoaded: false 
            };
        }

        const protection = typeof sector.getProtection === 'function' ? sector.getProtection() : 0;
        const isSafeZone = typeof sector.isSafeZone === 'function' ? sector.isSafeZone() : false;
        const isLocked = typeof sector.isLocked === 'function' ? sector.isLocked() : false;
        const protectionLevel = typeof sector.getProtectionDescription === 'function' ? 
            sector.getProtectionDescription() : undefined;

        return {
            isProtected: protection > 0,
            isSafeZone,
            isLocked,
            protectionLevel,
            isLoaded: true
        };
    }

    /**
     * Assess observation value based on sector type and timestamp
     */
    public assessObservationValue(): {
        strategicValue: number; // 0-100
        recency: number; // 0-100
        overallValue: number; // 0-100
        recommendation: string;
    } {
        const age = this.getAgeInMilliseconds();
        const sectorIntel = this.getSectorIntelligence();
        const protectionStatus = this.getSectorProtectionStatus();
        
        // Recency score (0-100)
        let recency = 0;
        if (age !== null) {
            const hoursOld = age / (1000 * 60 * 60);
            recency = Math.max(0, Math.min(100, 100 - (hoursOld / 168) * 100)); // 1 week = 0 points
        }

        // Strategic value (0-100)
        let strategicValue = 20; // Base value
        
        if (sectorIntel.isLoaded) {
            // Higher value for special sector types
            if (sectorIntel.type?.includes('PLANET')) strategicValue += 25;
            if (sectorIntel.type?.includes('STATION')) strategicValue += 20;
            if (sectorIntel.type?.includes('WORMHOLE')) strategicValue += 30;
            if (sectorIntel.type?.includes('SUN') || sectorIntel.type?.includes('BLACK_HOLE')) strategicValue += 15;
            
            // Protection adds strategic value
            if (protectionStatus.isSafeZone) strategicValue += 15;
            if (protectionStatus.isLocked) strategicValue += 10;
            if (protectionStatus.isProtected) strategicValue += 5;
        }

        // Observer type affects value
        if (this.isNPCObservation()) strategicValue += 10;
        if (this.isPlayerObservation()) strategicValue += 5;

        strategicValue = Math.min(100, strategicValue);
        
        // Overall value
        const overallValue = Math.round((strategicValue * 0.7) + (recency * 0.3));
        
        // Recommendation
        let recommendation = 'Standard intelligence value';
        if (overallValue >= 80) recommendation = 'High-priority intelligence - investigate immediately';
        else if (overallValue >= 60) recommendation = 'Valuable intelligence - consider follow-up';
        else if (overallValue >= 40) recommendation = 'Moderate intelligence value';
        else if (overallValue >= 20) recommendation = 'Low priority - outdated information';
        else recommendation = 'Minimal intelligence value - very old data';

        return { strategicValue, recency, overallValue, recommendation };
    }

    /**
     * Check if observation indicates potential threat
     */
    public isPotentialThreat(): {
        isThreat: boolean;
        threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        reasons: string[];
    } {
        const reasons: string[] = [];
        let threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE';
        
        // NPC observations can indicate hostile presence
        if (this.getObserverType() === 'outcasts') {
            reasons.push('Hostile Outcasts faction observation');
            threatLevel = 'HIGH';
        }
        
        if (this.getObserverType() === 'scavengers') {
            reasons.push('Scavenger faction activity detected');
            threatLevel = 'MEDIUM';
        }

        // Recent observations are more threatening
        if (this.isRecentObservation(3600000)) { // 1 hour
            if (threatLevel !== 'NONE') {
                reasons.push('Very recent hostile observation');
                if (threatLevel === 'HIGH') threatLevel = 'CRITICAL';
                else if (threatLevel === 'MEDIUM') threatLevel = 'HIGH';
            }
        }

        // Protected sectors under observation might indicate attack preparation
        const protection = this.getSectorProtectionStatus();
        if (protection.isLoaded && protection.isProtected && this.isNPCObservation()) {
            reasons.push('Hostile observation of protected sector');
            if (threatLevel === 'NONE') threatLevel = 'LOW';
        }

        const isThreat = threatLevel !== 'NONE';
        return { isThreat, threatLevel, reasons };
    }

    /**
     * Generate strategic intelligence report
     */
    public generateIntelligenceReport(): {
        basic: {
            coordinates: string;
            observerId: number;
            observerType: string;
            observerName: string;
            timestamp: number | undefined;
            relativeTime: string;
            isRecent: boolean;
        };
        sector: {
            intelligence: ReturnType<VisibilityModel['getSectorIntelligence']>;
            protection: ReturnType<VisibilityModel['getSectorProtectionStatus']>;
        };
        assessment: {
            value: ReturnType<VisibilityModel['assessObservationValue']>;
            threat: ReturnType<VisibilityModel['isPotentialThreat']>;
        };
        recommendations: string[];
        overallRating: 'ROUTINE' | 'INTERESTING' | 'IMPORTANT' | 'CRITICAL';
    } {
        const basic = {
            coordinates: this.getCoordinatesString(),
            observerId: this.getId(),
            observerType: this.getObserverType(),
            observerName: this.getObserverName(),
            timestamp: this.getTimestamp(),
            relativeTime: this.getRelativeTimeDescription(),
            isRecent: this.isRecentObservation()
        };

        const sector = {
            intelligence: this.getSectorIntelligence(),
            protection: this.getSectorProtectionStatus()
        };

        const assessment = {
            value: this.assessObservationValue(),
            threat: this.isPotentialThreat()
        };

        const recommendations: string[] = [];
        recommendations.push(assessment.value.recommendation);
        
        if (assessment.threat.isThreat) {
            recommendations.push(`THREAT DETECTED: ${assessment.threat.threatLevel} - ${assessment.threat.reasons.join(', ')}`);
        }
        
        if (!sector.intelligence.isLoaded) {
            recommendations.push('Load sector data for complete intelligence assessment');
        }

        // Overall rating
        let overallRating: 'ROUTINE' | 'INTERESTING' | 'IMPORTANT' | 'CRITICAL' = 'ROUTINE';
        if (assessment.threat.threatLevel === 'CRITICAL') overallRating = 'CRITICAL';
        else if (assessment.threat.threatLevel === 'HIGH' || assessment.value.overallValue >= 80) overallRating = 'IMPORTANT';
        else if (assessment.threat.threatLevel === 'MEDIUM' || assessment.value.overallValue >= 60) overallRating = 'INTERESTING';

        return { basic, sector, assessment, recommendations, overallRating };
    }

    /**
     * Get comprehensive visibility summary with intelligence data
     */
    public getVisibilitySummary(): {
        coordinates: string;
        observerId: number;
        observerType: string;
        observerName: string;
        timestamp: number | undefined;
        formattedTimestamp: string | null;
        isObserved: boolean;
        isInFogOfWar: boolean;
        ageInMs: number | null;
        relativeTime: string;
        isRecent: boolean;
        isPlayerObservation: boolean;
        isNPCObservation: boolean;
        isSystemObservation: boolean;
        // Enhanced intelligence data
        hasSectorLoaded: boolean;
        sectorIntelligence?: ReturnType<VisibilityModel['getSectorIntelligence']>;
        protectionStatus?: ReturnType<VisibilityModel['getSectorProtectionStatus']>;
        observationValue?: ReturnType<VisibilityModel['assessObservationValue']>;
        threatAssessment?: ReturnType<VisibilityModel['isPotentialThreat']>;
    } {
        const basic = {
            coordinates: this.getCoordinatesString(),
            observerId: this.getId(),
            observerType: this.getObserverType(),
            observerName: this.getObserverName(),
            timestamp: this.getTimestamp(),
            formattedTimestamp: this.getFormattedTimestamp(),
            isObserved: this.isObserved(),
            isInFogOfWar: this.isInFogOfWar(),
            ageInMs: this.getAgeInMilliseconds(),
            relativeTime: this.getRelativeTimeDescription(),
            isRecent: this.isRecentObservation(),
            isPlayerObservation: this.isPlayerObservation(),
            isNPCObservation: this.isNPCObservation(),
            isSystemObservation: this.isSystemObservation(),
            hasSectorLoaded: this.hasSectorLoaded()
        };

        // Add intelligence data if sector is loaded
        if (this.hasSectorLoaded()) {
            return {
                ...basic,
                sectorIntelligence: this.getSectorIntelligence(),
                protectionStatus: this.getSectorProtectionStatus(),
                observationValue: this.assessObservationValue(),
                threatAssessment: this.isPotentialThreat()
            };
        }

        return basic;
    }
}