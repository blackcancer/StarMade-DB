/**
 * @fileoverview Sectors Controller
 * 
 * Controller for managing sectors in the SECTORS table with advanced operations,
 * coordinate management, protection control, and spatial analysis.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseController,
    type ModelConstructor,
    type QueryOptions,
    type CreateOptions,
    type UpdateOptions,
    type DeleteOptions,
    type BulkOperationResult,
    type BaseControllerConfig
} from '../BaseController.js';
import {
    SectorsModel,
    SectorType,
    SectorProtection,
    ProtectionLevel,
    type SectorQueryHints,
    type SectorAnalysis
} from './SectorsModel.js';
import {
    ValidationError,
    QueryExecutionError,
    ErrorFactory,
    ConflictError
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Sector search options
 */
export interface SectorSearchOptions extends QueryOptions {
    /** Search by sector name */
    searchTerm?: string;
    /** Filter by sector type */
    sectorType?: SectorType;
    /** Filter by system ID */
    stellarId?: number;
    /** Filter by protection level */
    protectionLevel?: ProtectionLevel;
    /** Filter by specific protection flags */
    hasProtection?: SectorProtection[];
    /** Include only transient sectors */
    transientOnly?: boolean;
    /** Include only non-transient sectors */
    persistentOnly?: boolean;
    /** Filter by coordinate range */
    coordinateRange?: {
        minX?: number;
        maxX?: number;
        minY?: number;
        maxY?: number;
        minZ?: number;
        maxZ?: number;
    };
    /** Filter by last replenished time */
    replenishedSince?: number;
    /** Filter by last replenished time (before) */
    replenishedBefore?: number;
    /** Performance optimization hints */
    queryHints?: SectorQueryHints;
}

/**
 * Sector creation options
 */
export interface SectorCreateOptions extends CreateOptions {
    /** Auto-generate coordinates if not provided */
    autoGenerateCoordinates?: boolean;
    /** Validate coordinate uniqueness */
    validateCoordinateUniqueness?: boolean;
    /** Initialize default protection */
    initializeProtection?: boolean;
    /** Set default transient state */
    defaultTransient?: boolean;
    /** Auto-assign to nearest system */
    autoAssignSystem?: boolean;
}

/**
 * Sector update options
 */
export interface SectorUpdateOptions extends UpdateOptions {
    /** Allow updating coordinate fields */
    allowCoordinateUpdates?: boolean;
    /** Validate coordinate uniqueness on update */
    validateCoordinateUniqueness?: boolean;
    /** Allow updating system assignment */
    allowSystemUpdates?: boolean;
    /** Update last replenished timestamp */
    updateReplenishedTime?: boolean;
}

/**
 * Protection management options
 */
export interface ProtectionManagementOptions {
    /** Force protection change even with conflicts */
    forceProtection?: boolean;
    /** Update related sectors in same system */
    updateSystemSectors?: boolean;
    /** Reason for protection change */
    reason?: string;
    /** Player/entity initiating the change */
    initiatedBy?: string;
    /** Validate protection level combinations */
    validateCombinations?: boolean;
}

/**
 * Spatial analysis options
 */
export interface SpatialAnalysisOptions {
    /** Include neighboring sectors analysis */
    includeNeighbors?: boolean;
    /** Include system-wide analysis */
    includeSystemAnalysis?: boolean;
    /** Include entity count analysis */
    includeEntityAnalysis?: boolean;
    /** Include trade route analysis */
    includeTradeAnalysis?: boolean;
    /** Maximum distance for neighbor analysis */
    maxDistance?: number;
    /** Performance optimization hints */
    optimizationHints?: SectorQueryHints;
}

/**
 * Bulk operation options for sectors
 */
export interface BulkSectorOptions {
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size for processing */
    batchSize?: number;
    /** Update replenished timestamps */
    updateTimestamps?: boolean;
    /** Performance optimization hints */
    optimizationHints?: SectorQueryHints;
}

/**
 * Sector statistics result
 */
export interface SectorStatistics {
    /** Total sectors */
    totalSectors: number;
    /** Sectors by type */
    sectorsByType: Record<SectorType, number>;
    /** Sectors by protection level */
    sectorsByProtection: Record<ProtectionLevel, number>;
    /** Sectors by system */
    sectorsBySystem: Record<number, number>;
    /** Transient vs persistent sectors */
    transientSectors: number;
    persistentSectors: number;
    /** Coordinate extents */
    coordinateExtents: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    };
    /** Most populated system */
    mostPopulatedSystem?: {
        stellarId: number;
        sectorCount: number;
        systemName?: string;
    };
    /** Security statistics */
    securityStats: {
        safeSectors: number;
        lockedSectors: number;
        openSectors: number;
        protectedSectors: number;
    };
}

/**
 * Spatial map result
 */
export interface SpatialMap {
    /** Center sector */
    center: SectorsModel;
    /** Neighboring sectors */
    neighbors: Array<{
        sector: SectorsModel;
        distance: number;
        direction: string;
        relativePosition: { x: number; y: number; z: number };
    }>;
    /** Spatial summary */
    summary: {
        totalSectors: number;
        sameSystemSectors: number;
        differentSystemSectors: number;
        protectedSectors: number;
        economicSectors: number;
        dominantType?: {
            type: SectorType;
            typeName: string;
            count: number;
        };
        securityLevel: 'SAFE' | 'MODERATE' | 'DANGEROUS' | 'HOSTILE';
    };
}

/**
 * Resource replenishment result
 */
export interface ReplenishmentResult {
    /** Sectors processed */
    sectorsProcessed: number;
    /** Sectors actually replenished */
    sectorsReplenished: number;
    /** Sectors skipped (not due) */
    sectorsSkipped: number;
    /** Errors encountered */
    errors: Array<{
        sectorId: number;
        coordinates: string;
        error: string;
    }>;
    /** Total processing time */
    processingTimeMs: number;
}

// =============================================================================
// SECTORS CONTROLLER
// =============================================================================

/**
 * Controller for SECTORS table with advanced sector management capabilities
 */
export class SectorsController extends BaseController<SectorsModel> {
    protected ModelClass: ModelConstructor<SectorsModel> = SectorsModel;
    protected controllerName = 'SectorsController';

    /**
     * Create a new sectors controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 minutes - sectors change more frequently than systems
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with sector-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: SectorCreateOptions = {}
    ): Promise<SectorsModel> {
        const {
            autoGenerateCoordinates = false,
            validateCoordinateUniqueness = true,
            initializeProtection = true,
            defaultTransient = true,
            autoAssignSystem = false,
            ...baseOptions
        } = options;

        // Enhanced validation specific to sectors
        if (!data.TYPE && data.TYPE !== 0) {
            throw new ValidationError('data', data, 'TYPE is required');
        }

        if (!data.NAME) {
            throw new ValidationError('data', data, 'NAME is required');
        }

        // Validate coordinates
        if (!autoGenerateCoordinates) {
            if (data.X === undefined || data.Y === undefined || data.Z === undefined) {
                throw new ValidationError('data', data, 'X, Y, Z coordinates are required when autoGenerateCoordinates is false');
            }
        }

        // Check coordinate uniqueness
        if (validateCoordinateUniqueness && data.X !== undefined && data.Y !== undefined && data.Z !== undefined) {
            await this.validateCoordinateUniqueness(data.X, data.Y, data.Z);
        }

        // Auto-generate coordinates if needed
        if (autoGenerateCoordinates && (data.X === undefined || data.Y === undefined || data.Z === undefined)) {
            const coordinates = await this.generateUniqueCoordinates();
            data.X = data.X ?? coordinates.x;
            data.Y = data.Y ?? coordinates.y;
            data.Z = data.Z ?? coordinates.z;
        }

        // Auto-assign system if requested
        if (autoAssignSystem && !data.STELLAR) {
            data.STELLAR = await this.findNearestSystemId(data.X!, data.Y!, data.Z!);
        }

        // Apply creation defaults
        data = this.applyCreateDefaults(data, {
            initializeProtection,
            defaultTransient
        });

        // Call parent create method
        return await super.create(data, baseOptions);
    }

    /**
     * Apply default values to sector creation data
     */
    private applyCreateDefaults(data: any, options: { initializeProtection: boolean; defaultTransient: boolean }): any {
        const defaults: any = {
            PROTECTION: options.initializeProtection ? ProtectionLevel.NORMAL : 0,
            TRANSIENT: options.defaultTransient,
            LAST_REPLENISHED: Date.now(),
            ITEMS: 0 // Default ITEMS reference
        };

        // Apply defaults for missing fields
        const result = { ...data };
        for (const [key, defaultValue] of Object.entries(defaults)) {
            if (result[key] === undefined) {
                result[key] = defaultValue;
            }
        }

        return result;
    }

    /**
     * Override: Update with sector-specific validation
     */
    public async update(
        sectorIdentifier: any,
        data: Partial<Record<string, any>>,
        options: SectorUpdateOptions = {}
    ): Promise<SectorsModel> {
        const {
            allowCoordinateUpdates = false,
            validateCoordinateUniqueness = true,
            allowSystemUpdates = true,
            updateReplenishedTime = false,
            ...baseOptions
        } = options;

        // Resolve sector by ID or coordinates
        const currentSector = await this.resolveSector(sectorIdentifier);
        if (!currentSector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        // Check for coordinate updates when not allowed
        if (!allowCoordinateUpdates) {
            const coordinateFields = ['X', 'Y', 'Z'];
            const updatingCoordinates = coordinateFields.filter(field => 
                data.hasOwnProperty(field) && data[field] !== undefined
            );
            
            if (updatingCoordinates.length > 0) {
                throw new ValidationError(
                    'data', 
                    data, 
                    `Cannot update coordinate fields [${updatingCoordinates.join(', ')}] when allowCoordinateUpdates is false`
                );
            }
        }

        // Validate coordinate uniqueness if coordinates are being updated
        if ((data.X !== undefined || data.Y !== undefined || data.Z !== undefined) && validateCoordinateUniqueness) {
            const newX = data.X ?? currentSector.getX();
            const newY = data.Y ?? currentSector.getY();
            const newZ = data.Z ?? currentSector.getZ();
            
            // Only check if coordinates actually changed
            if (newX !== currentSector.getX() || newY !== currentSector.getY() || newZ !== currentSector.getZ()) {
                await this.validateCoordinateUniqueness(newX, newY, newZ, currentSector.getId());
            }
        }

        // Check for system updates when not allowed
        if (!allowSystemUpdates && data.STELLAR !== undefined && data.STELLAR !== currentSector.getStellar()) {
            throw new ValidationError(
                'data',
                data,
                'Cannot update STELLAR field when allowSystemUpdates is false'
            );
        }

        // Update replenished time if requested
        if (updateReplenishedTime) {
            data.LAST_REPLENISHED = Date.now();
        }

        // Call parent update method with resolved ID
        return await super.update(currentSector.getId(), data, { returnRecord: true, ...baseOptions });
    }

    /**
     * Override: Delete with sector-specific validation
     */
    public async delete(
        sectorIdentifier: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Resolve sector by ID or coordinates
        const sector = await this.resolveSector(sectorIdentifier);
        if (!sector) {
            return false; // Sector doesn't exist
        }

        // Log sector deletion
        this.logger.info('Sector deletion initiated', {
            operation: 'delete-sector',
            sectorId: sector.getId(),
            coordinates: sector.getCoordinatesString(),
            sectorType: sector.getTypeName(),
            stellar: sector.getStellar()
        });

        // Call parent delete method with resolved ID
        const result = await super.delete(sector.getId(), options);

        if (result) {
            this.logger.info('Sector deleted successfully', {
                operation: 'delete-sector',
                sectorId: sector.getId(),
                coordinates: sector.getCoordinatesString()
            });
        }

        return result;
    }

    // =============================================================================
    // SEARCH AND FILTERING OPERATIONS
    // =============================================================================

    /**
     * Find sectors with advanced search capabilities
     */
    public async findSectors(options: SectorSearchOptions = {}): Promise<SectorsModel[]> {
        this.ensureInitialized();

        const {
            searchTerm,
            sectorType,
            stellarId,
            protectionLevel,
            hasProtection,
            transientOnly = false,
            persistentOnly = false,
            coordinateRange,
            replenishedSince,
            replenishedBefore,
            queryHints,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (searchTerm) {
            conditions.push('LOWER(NAME) LIKE ?');
            params.push(`%${searchTerm.toLowerCase()}%`);
        }

        if (sectorType !== undefined) {
            conditions.push('TYPE = ?');
            params.push(sectorType);
        }

        if (stellarId !== undefined) {
            conditions.push('STELLAR = ?');
            params.push(stellarId);
        }

        if (protectionLevel !== undefined) {
            conditions.push('PROTECTION = ?');
            params.push(protectionLevel);
        }

        if (hasProtection && hasProtection.length > 0) {
            // For HSQLDB compatibility, use a simple approach that works reliably
            // Instead of complex MOD operations, use basic bitwise logic that HSQLDB can handle
            try {
                const protectionChecks = hasProtection.map(prot => {
                    // Use simple integer division and remainder operations
                    return `(PROTECTION - (PROTECTION / ${prot * 2}) * ${prot * 2}) >= ${prot}`;
                }).join(' AND ');
                
                conditions.push(`(${protectionChecks})`);
            } catch (error) {
                // If even this fails, fall back to no protection filtering and log warning
                this.logger.warn('Protection filtering not supported on this database, will filter application-side', {
                    operation: 'find-sectors',
                    protections: hasProtection,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Don't add any SQL conditions, we'll filter later
            }
        }

        if (transientOnly) {
            conditions.push('TRANSIENT = true');
        } else if (persistentOnly) {
            conditions.push('TRANSIENT = false');
        }

        if (coordinateRange) {
            if (coordinateRange.minX !== undefined) {
                conditions.push('X >= ?');
                params.push(coordinateRange.minX);
            }
            if (coordinateRange.maxX !== undefined) {
                conditions.push('X <= ?');
                params.push(coordinateRange.maxX);
            }
            if (coordinateRange.minY !== undefined) {
                conditions.push('Y >= ?');
                params.push(coordinateRange.minY);
            }
            if (coordinateRange.maxY !== undefined) {
                conditions.push('Y <= ?');
                params.push(coordinateRange.maxY);
            }
            if (coordinateRange.minZ !== undefined) {
                conditions.push('Z >= ?');
                params.push(coordinateRange.minZ);
            }
            if (coordinateRange.maxZ !== undefined) {
                conditions.push('Z <= ?');
                params.push(coordinateRange.maxZ);
            }
        }

        if (replenishedSince !== undefined) {
            conditions.push('LAST_REPLENISHED >= ?');
            params.push(replenishedSince);
        }

        if (replenishedBefore !== undefined) {
            conditions.push('LAST_REPLENISHED <= ?');
            params.push(replenishedBefore);
        }

        // Build cache key
        const cacheKey = `sectors:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Sectors retrieved from cache', {
                    operation: 'find-sectors',
                    count: cached.length,
                    searchTerm,
                    sectorType
                });
                return SectorsModel.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM SECTORS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering (use spatial index if hints suggest it)
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
        } else if (queryHints?.useSpatialIndex) {
            sql += ' ORDER BY X ASC, Y ASC, Z ASC';
        } else {
            sql += ' ORDER BY ID ASC';
        }

        // Add pagination
        if (queryOptions.limit) {
            sql += ` LIMIT ${queryOptions.limit}`;
        }
        if (queryOptions.offset) {
            sql += ` OFFSET ${queryOptions.offset}`;
        }

        try {
            const result = await this.executeQuery(sql, params);
            let sectors = SectorsModel.fromRows(result);

            // Post-process filtering for protection flags if needed
            if (hasProtection && hasProtection.length > 0) {
                // Check if we successfully filtered at SQL level by checking if any conditions were added
                const hasProtectionConditions = conditions.some(condition => 
                    condition.includes('PROTECTION') && !condition.includes('PROTECTION =')
                );
                
                if (!hasProtectionConditions) {
                    // Filter application-side as fallback
                    sectors = sectors.filter(sector => {
                        return hasProtection.every(protection => sector.hasProtection(protection));
                    });
                    
                    this.logger.debug('Applied protection filtering application-side', {
                        operation: 'find-sectors',
                        originalCount: result.length,
                        filteredCount: sectors.length,
                        protections: hasProtection
                    });
                }
            }

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Sectors retrieved from database', {
                operation: 'find-sectors',
                count: sectors.length,
                searchTerm,
                sectorType
            });

            return sectors;
        } catch (error) {
            this.logger.error('Failed to find sectors', {
                operation: 'find-sectors',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a sector by coordinates
     */
    public async findByCoordinates(x: number, y: number, z: number): Promise<SectorsModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM SECTORS WHERE X = ? AND Y = ? AND Z = ?';
        const params = [x, y, z];

        // Build cache key
        const cacheKey = `sectors:by-coords:${x},${y},${z}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('Sector retrieved from cache by coordinates', {
                    operation: 'find-by-coordinates',
                    x, y, z,
                    cached: true
                });
                return SectorsModel.fromRow(cached);
            }
        }

        try {
            const result = await this.executeQuery(sql, params);
            const sector = result.length > 0 ? SectorsModel.fromRow(result[0]) : null;

            // Cache result if sector found
            if (sector && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result[0], {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('Sector retrieved from database by coordinates', {
                operation: 'find-by-coordinates',
                x, y, z,
                found: !!sector,
                cached: false
            });

            return sector;
        } catch (error) {
            this.logger.error('Failed to find sector by coordinates', {
                operation: 'find-by-coordinates',
                x, y, z,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find sectors by type
     */
    public async findByType(sectorType: SectorType, options: QueryOptions = {}): Promise<SectorsModel[]> {
        return await this.findSectors({
            sectorType,
            ...options
        });
    }

    /**
     * Find sectors by system ID
     */
    public async findBySystem(stellarId: number, options: QueryOptions = {}): Promise<SectorsModel[]> {
        return await this.findSectors({
            stellarId,
            ...options
        });
    }

    /**
     * Find sectors by protection level
     */
    public async findByProtectionLevel(protectionLevel: ProtectionLevel, options: QueryOptions = {}): Promise<SectorsModel[]> {
        return await this.findSectors({
            protectionLevel,
            ...options
        });
    }

    /**
     * Find sectors with specific protection flags
     */
    public async findWithProtection(protections: SectorProtection[], options: QueryOptions = {}): Promise<SectorsModel[]> {
        this.ensureInitialized();
        
        // For HSQLDB compatibility, use the safe approach with application-side filtering
        const allSectors = await this.findSectors({
            ...options,
            // Don't use hasProtection parameter to avoid SQL issues
        });
        
        // Filter application-side for better compatibility
        const filteredSectors = allSectors.filter(sector => {
            return protections.every(protection => sector.hasProtection(protection));
        });
        
        this.logger.debug('Sectors filtered by protection flags', {
            operation: 'find-with-protection',
            originalCount: allSectors.length,
            filteredCount: filteredSectors.length,
            protections
        });
        
        return filteredSectors;
    }

    /**
     * Find sectors within a distance from a point
     */
    public async findWithinDistance(
        centerX: number,
        centerY: number,
        centerZ: number,
        maxDistance: number,
        options: QueryOptions = {}
    ): Promise<Array<{ sector: SectorsModel; distance: number }>> {
        this.ensureInitialized();

        // Get all sectors (or use coordinate range optimization)
        const coordinateRange = {
            minX: centerX - maxDistance,
            maxX: centerX + maxDistance,
            minY: centerY - maxDistance,
            maxY: centerY + maxDistance,
            minZ: centerZ - maxDistance,
            maxZ: centerZ + maxDistance
        };

        // Check if we need to use spatial indexing based on search options  
        const sectorSearchOptions: SectorSearchOptions = {
            coordinateRange,
            queryHints: { useSpatialIndex: true },
            ...options
        };
        
        const foundSectors = await this.findSectors(sectorSearchOptions);

        // Calculate actual distances and filter
        const sectorsWithDistance = foundSectors
            .map(sector => ({
                sector,
                distance: Math.sqrt(
                    Math.pow(sector.getX() - centerX, 2) +
                    Math.pow(sector.getY() - centerY, 2) +
                    Math.pow(sector.getZ() - centerZ, 2)
                )
            }))
            .filter(item => item.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance);

        this.logger.debug('Sectors found within distance', {
            operation: 'find-within-distance',
            center: `(${centerX}, ${centerY}, ${centerZ})`,
            maxDistance,
            found: sectorsWithDistance.length
        });

        return sectorsWithDistance;
    }

    // =============================================================================
    // PROTECTION MANAGEMENT
    // =============================================================================

    /**
     * Set sector protection level
     */
    public async setProtectionLevel(
        sectorIdentifier: any,
        protectionLevel: ProtectionLevel,
        options: ProtectionManagementOptions = {}
    ): Promise<SectorsModel> {
        this.ensureInitialized();

        const sector = await this.resolveSector(sectorIdentifier);
        if (!sector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        const oldProtection = sector.getProtection();

        const updatedSector = await this.update(sector.getId(), {
            PROTECTION: protectionLevel
        }, {
            returnRecord: true
        } as SectorUpdateOptions);

        this.logger.info('Sector protection level updated', {
            operation: 'set-protection-level',
            sectorId: sector.getId(),
            coordinates: sector.getCoordinatesString(),
            oldProtection,
            newProtection: protectionLevel,
            reason: options.reason,
            initiatedBy: options.initiatedBy
        });

        return updatedSector;
    }

    /**
     * Grant protection to sector
     */
    public async grantProtection(
        sectorIdentifier: any,
        protection: SectorProtection,
        options: ProtectionManagementOptions = {}
    ): Promise<SectorsModel> {
        const sector = await this.resolveSector(sectorIdentifier);
        if (!sector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        const currentProtection = sector.getProtection();
        const newProtection = currentProtection | protection;

        return await this.update(sector.getId(), {
            PROTECTION: newProtection
        }, {
            returnRecord: true
        } as SectorUpdateOptions);
    }

    /**
     * Revoke protection from sector
     */
    public async revokeProtection(
        sectorIdentifier: any,
        protection: SectorProtection,
        options: ProtectionManagementOptions = {}
    ): Promise<SectorsModel> {
        const sector = await this.resolveSector(sectorIdentifier);
        if (!sector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        const currentProtection = sector.getProtection();
        const newProtection = currentProtection & ~protection;

        return await this.update(sector.getId(), {
            PROTECTION: newProtection
        }, {
            returnRecord: true
        } as SectorUpdateOptions);
    }

    /**
     * Create safe zone (NO_SPAWN + NO_ATTACK)
     */
    public async createSafeZone(
        sectorIdentifier: any,
        options: ProtectionManagementOptions = {}
    ): Promise<SectorsModel> {
        return await this.setProtectionLevel(sectorIdentifier, ProtectionLevel.SAFE_ZONE, options);
    }

    /**
     * Remove all protection (make normal)
     */
    public async removeAllProtection(
        sectorIdentifier: any,
        options: ProtectionManagementOptions = {}
    ): Promise<SectorsModel> {
        return await this.setProtectionLevel(sectorIdentifier, ProtectionLevel.NORMAL, options);
    }

    // =============================================================================
    // SPATIAL ANALYSIS
    // =============================================================================

    /**
     * Get spatial map around a sector
     */
    public async getSpatialMap(
        sectorIdentifier: any,
        options: SpatialAnalysisOptions = {}
    ): Promise<SpatialMap> {
        this.ensureInitialized();

        const centerSector = await this.resolveSector(sectorIdentifier);
        if (!centerSector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        const { maxDistance = 3, optimizationHints } = options;

        // Find neighboring sectors
        const neighborsWithDistance = await this.findWithinDistance(
            centerSector.getX(),
            centerSector.getY(),
            centerSector.getZ(),
            maxDistance
            // Remove the problematic queryHints parameter
        );

        // Remove the center sector from neighbors
        const neighbors = neighborsWithDistance
            .filter(item => item.sector.getId() !== centerSector.getId())
            .map(item => ({
                sector: item.sector,
                distance: item.distance,
                direction: this.calculateDirection(centerSector, item.sector),
                relativePosition: {
                    x: item.sector.getX() - centerSector.getX(),
                    y: item.sector.getY() - centerSector.getY(),
                    z: item.sector.getZ() - centerSector.getZ()
                }
            }));

        // Analyze spatial area
        const typeCounts = new Map<SectorType, number>();
        let sameSystemSectors = 0;
        let differentSystemSectors = 0;
        let protectedSectors = 0;
        let economicSectors = 0;

        for (const neighbor of neighbors) {
            const sector = neighbor.sector;
            const type = sector.getType();
            
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
            
            if (sector.getStellar() === centerSector.getStellar()) {
                sameSystemSectors++;
            } else {
                differentSystemSectors++;
            }
            
            if (sector.getProtection() > 0) {
                protectedSectors++;
            }
            
            if (sector.getEconomicActivityScore() > 0) {
                economicSectors++;
            }
        }

        // Find dominant type
        let dominantType: { type: SectorType; typeName: string; count: number } | undefined;
        if (typeCounts.size > 0) {
            const [type, count] = Array.from(typeCounts.entries())
                .sort(([, a], [, b]) => b - a)[0];
            
            dominantType = {
                type,
                typeName: SectorType[type] || `UNKNOWN_${type}`,
                count
            };
        }

        // Assess security level
        const protectionRatio = neighbors.length > 0 ? protectedSectors / neighbors.length : 0;
        let securityLevel: 'SAFE' | 'MODERATE' | 'DANGEROUS' | 'HOSTILE' = 'MODERATE';
        
        if (protectionRatio >= 0.7) securityLevel = 'SAFE';
        else if (protectionRatio >= 0.3) securityLevel = 'MODERATE';
        else if (centerSector.getProtection() > 0) securityLevel = 'MODERATE';
        else securityLevel = 'DANGEROUS';

        const spatialMap: SpatialMap = {
            center: centerSector,
            neighbors,
            summary: {
                totalSectors: neighbors.length,
                sameSystemSectors,
                differentSystemSectors,
                protectedSectors,
                economicSectors,
                dominantType,
                securityLevel
            }
        };

        this.logger.debug('Spatial map generated', {
            operation: 'get-spatial-map',
            centerSector: centerSector.getCoordinatesString(),
            neighborsFound: neighbors.length,
            dominantType: dominantType?.type,
            securityLevel
        });

        return spatialMap;
    }

    /**
     * Get adjacent sectors to a given sector
     */
    public async getAdjacentSectors(sectorIdentifier: any): Promise<SectorsModel[]> {
        const centerSector = await this.resolveSector(sectorIdentifier);
        if (!centerSector) {
            throw new ValidationError('sectorIdentifier', sectorIdentifier, `Sector not found: ${sectorIdentifier}`);
        }

        const adjacentCoordinates = [
            { x: centerSector.getX() + 1, y: centerSector.getY(), z: centerSector.getZ() },
            { x: centerSector.getX() - 1, y: centerSector.getY(), z: centerSector.getZ() },
            { x: centerSector.getX(), y: centerSector.getY() + 1, z: centerSector.getZ() },
            { x: centerSector.getX(), y: centerSector.getY() - 1, z: centerSector.getZ() },
            { x: centerSector.getX(), y: centerSector.getY(), z: centerSector.getZ() + 1 },
            { x: centerSector.getX(), y: centerSector.getY(), z: centerSector.getZ() - 1 }
        ];

        const adjacentSectors: SectorsModel[] = [];
        for (const coords of adjacentCoordinates) {
            const sector = await this.findByCoordinates(coords.x, coords.y, coords.z);
            if (sector) {
                adjacentSectors.push(sector);
            }
        }

        return adjacentSectors;
    }

    /**
     * Find empty coordinates near a sector
     */
    public async findEmptyCoordinatesNear(
        centerX: number,
        centerY: number,
        centerZ: number,
        maxDistance: number = 5
    ): Promise<Array<{ x: number; y: number; z: number; distance: number }>> {
        const emptyCoordinates: Array<{ x: number; y: number; z: number; distance: number }> = [];

        for (let distance = 1; distance <= maxDistance; distance++) {
            for (let x = centerX - distance; x <= centerX + distance; x++) {
                for (let y = centerY - distance; y <= centerY + distance; y++) {
                    for (let z = centerZ - distance; z <= centerZ + distance; z++) {
                        // Check if this is at the current distance boundary
                        if (Math.abs(x - centerX) === distance || 
                            Math.abs(y - centerY) === distance || 
                            Math.abs(z - centerZ) === distance) {
                            
                            const actualDistance = Math.sqrt(
                                Math.pow(x - centerX, 2) +
                                Math.pow(y - centerY, 2) +
                                Math.pow(z - centerZ, 2)
                            );
                            
                            if (actualDistance <= maxDistance) {
                                const exists = await this.findByCoordinates(x, y, z);
                                if (!exists) {
                                    emptyCoordinates.push({ x, y, z, distance: actualDistance });
                                }
                            }
                        }
                    }
                }
            }
            
            // If we found empty coordinates at this distance, return them
            if (emptyCoordinates.length > 0) {
                break;
            }
        }

        return emptyCoordinates.sort((a, b) => a.distance - b.distance);
    }

    // =============================================================================
    // RESOURCE MANAGEMENT
    // =============================================================================

    /**
     * Find sectors needing replenishment
     */
    public async findSectorsNeedingReplenishment(
        maxAge: number = 3600000, // 1 hour
        options: QueryOptions = {}
    ): Promise<SectorsModel[]> {
        const cutoffTime = Date.now() - maxAge;
        
        return await this.findSectors({
            replenishedBefore: cutoffTime,
            ...options
        });
    }

    /**
     * Replenish sectors
     */
    public async replenishSectors(
        sectorIdentifiers: any[],
        options: BulkSectorOptions = {}
    ): Promise<ReplenishmentResult> {
        this.ensureInitialized();

        const {
            continueOnError = true,
            logOperations = false,
            batchSize = 50
        } = options;

        const startTime = Date.now();
        const result: ReplenishmentResult = {
            sectorsProcessed: 0,
            sectorsReplenished: 0,
            sectorsSkipped: 0,
            errors: [],
            processingTimeMs: 0
        };

        // Process in batches
        for (let i = 0; i < sectorIdentifiers.length; i += batchSize) {
            const batch = sectorIdentifiers.slice(i, i + batchSize);
            
            for (const identifier of batch) {
                result.sectorsProcessed++;
                
                try {
                    const sector = await this.resolveSector(identifier);
                    if (!sector) {
                        result.errors.push({
                            sectorId: 0,
                            coordinates: String(identifier),
                            error: 'Sector not found'
                        });
                        continue;
                    }

                    // Update replenishment time
                    await this.update(sector.getId(), {
                        LAST_REPLENISHED: Date.now()
                    }, {
                        updateReplenishedTime: false // We're setting it manually
                    } as SectorUpdateOptions);
                    
                    result.sectorsReplenished++;
                    
                    if (logOperations) {
                        this.logger.debug('Sector replenished', {
                            operation: 'replenish-sectors',
                            sectorId: sector.getId(),
                            coordinates: sector.getCoordinatesString()
                        });
                    }
                } catch (error) {
                    result.errors.push({
                        sectorId: 0,
                        coordinates: String(identifier),
                        error: error instanceof Error ? error.message : String(error)
                    });
                    
                    if (!continueOnError) {
                        break;
                    }
                }
            }
        }

        result.processingTimeMs = Date.now() - startTime;

        this.logger.info('Sector replenishment completed', {
            operation: 'replenish-sectors',
            result
        });

        return result;
    }

    /**
     * Auto-replenish stale sectors
     */
    public async autoReplenishStaleSectors(
        maxAge: number = 3600000, // 1 hour
        options: BulkSectorOptions = {}
    ): Promise<ReplenishmentResult> {
        const staleSectors = await this.findSectorsNeedingReplenishment(maxAge, {
            limit: options.batchSize || 100
        });

        const sectorIds = staleSectors.map(sector => sector.getId());
        return await this.replenishSectors(sectorIds, options);
    }

    // =============================================================================
    // STATISTICS AND ANALYTICS
    // =============================================================================

    /**
     * Get comprehensive sector statistics
     */
    public async getSectorStatistics(): Promise<SectorStatistics> {
        this.ensureInitialized();

        try {
            // Get total count
            const totalCountSql = 'SELECT COUNT(*) as total_count FROM SECTORS';
            const totalResult = await this.executeQuery(totalCountSql, []);
            const totalSectors = parseInt(totalResult[0]?.total_count || '0', 10);

            // Get coordinate extents
            const extentsSql = `
                SELECT 
                    MIN(X) as min_x, MAX(X) as max_x,
                    MIN(Y) as min_y, MAX(Y) as max_y,
                    MIN(Z) as min_z, MAX(Z) as max_z
                FROM SECTORS
            `;
            const extentsResult = await this.executeQuery(extentsSql, []);
            const extents = extentsResult[0] || {};

            // Get transient vs persistent
            const transientSql = 'SELECT COUNT(*) as transient_count FROM SECTORS WHERE TRANSIENT = true';
            const transientResult = await this.executeQuery(transientSql, []);
            const transientSectors = parseInt(transientResult[0]?.transient_count || '0', 10);
            const persistentSectors = totalSectors - transientSectors;

            // Get sectors by type
            const typeStatsSql = 'SELECT TYPE, COUNT(*) as type_count FROM SECTORS GROUP BY TYPE';
            const typeStatsResult = await this.executeQuery(typeStatsSql, []);
            const sectorsByType: Record<SectorType, number> = {
                [SectorType.VOID]: 0,
                [SectorType.ASTEROID]: 0,
                [SectorType.PLANET]: 0,
                [SectorType.SPACE_STATION]: 0,
                [SectorType.SUN]: 0,
                [SectorType.BLACK_HOLE]: 0,
                [SectorType.WORMHOLE]: 0,
                [SectorType.NEBULA]: 0,
                [SectorType.DOUBLE_STAR]: 0,
                [SectorType.GIANT]: 0
            };

            typeStatsResult.forEach(row => {
                const type = parseInt(row.TYPE, 10) as SectorType;
                const count = parseInt(row.type_count || '0', 10);
                if (type in sectorsByType) {
                    sectorsByType[type] = count;
                }
            });

            // Get sectors by protection level
            const protectionStatsSql = 'SELECT PROTECTION, COUNT(*) as protection_count FROM SECTORS GROUP BY PROTECTION';
            const protectionStatsResult = await this.executeQuery(protectionStatsSql, []);
            const sectorsByProtection: Record<ProtectionLevel, number> = {
                [ProtectionLevel.NORMAL]: 0,
                [ProtectionLevel.SAFE_ZONE]: 0,
                [ProtectionLevel.COMPLETE_PROTECTION]: 0,
                [ProtectionLevel.LOCKED_SECTOR]: 0
            };

            protectionStatsResult.forEach(row => {
                const protection = parseInt(row.PROTECTION || '0', 10) as ProtectionLevel;
                const count = parseInt(row.protection_count || '0', 10);
                if (protection in sectorsByProtection) {
                    sectorsByProtection[protection] = count;
                }
            });

            // Get sectors by system
            const systemStatsSql = 'SELECT STELLAR, COUNT(*) as system_count FROM SECTORS GROUP BY STELLAR';
            const systemStatsResult = await this.executeQuery(systemStatsSql, []);
            const sectorsBySystem: Record<number, number> = {};

            systemStatsResult.forEach(row => {
                const stellar = parseInt(row.STELLAR || '0', 10);
                const count = parseInt(row.system_count || '0', 10);
                sectorsBySystem[stellar] = count;
            });

            // Find most populated system
            let mostPopulatedSystem: { stellarId: number; sectorCount: number; systemName?: string } | undefined;
            if (Object.keys(sectorsBySystem).length > 0) {
                const [stellarId, count] = Object.entries(sectorsBySystem)
                    .sort(([, a], [, b]) => (typeof b === 'string' ? parseInt(b, 10) : b) - (typeof a === 'string' ? parseInt(a, 10) : a))[0];
                
                if (stellarId && count) {
                    mostPopulatedSystem = {
                        stellarId: parseInt(stellarId, 10),
                        sectorCount: typeof count === 'string' ? parseInt(count, 10) : count,
                        systemName: `System ${stellarId}`
                    };
                }
            }

            // Calculate security statistics - Use simple approach for HSQLDB compatibility
            let securityStatsResult: any[] = [];
            try {
                const securityStatsSql = `
                    SELECT 
                        SUM(CASE WHEN PROTECTION = 0 THEN 1 ELSE 0 END) as open_sectors,
                        SUM(CASE WHEN PROTECTION > 0 THEN 1 ELSE 0 END) as protected_sectors
                    FROM SECTORS
                `;
                securityStatsResult = await this.executeQuery(securityStatsSql, []);
            } catch (error) {
                this.logger.warn('Advanced security statistics not supported, using basic counts', {
                    operation: 'get-sector-statistics',
                    error: error instanceof Error ? error.message : String(error)
                });
                // Use fallback basic counts
                securityStatsResult = [{ open_sectors: 0, protected_sectors: 0, safe_sectors: 0, locked_sectors: 0 }];
            }
            
            const securityStats = securityStatsResult[0] || {};

            const statistics: SectorStatistics = {
                totalSectors,
                sectorsByType,
                sectorsByProtection,
                sectorsBySystem,
                transientSectors,
                persistentSectors,
                coordinateExtents: {
                    minX: parseInt(extents.min_x || '0', 10),
                    maxX: parseInt(extents.max_x || '0', 10),
                    minY: parseInt(extents.min_y || '0', 10),
                    maxY: parseInt(extents.max_y || '0', 10),
                    minZ: parseInt(extents.min_z || '0', 10),
                    maxZ: parseInt(extents.max_z || '0', 10)
                },
                mostPopulatedSystem,
                securityStats: {
                    safeSectors: parseInt(securityStats.safe_sectors || '0', 10),
                    lockedSectors: parseInt(securityStats.locked_sectors || '0', 10),
                    openSectors: parseInt(securityStats.open_sectors || '0', 10),
                    protectedSectors: parseInt(securityStats.protected_sectors || '0', 10)
                }
            };

            this.logger.info('Sector statistics generated', {
                operation: 'get-sector-statistics',
                statistics
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to get sector statistics', {
                operation: 'get-sector-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getSectorStatistics', error, []);
        }
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk create sectors
     */
    public async bulkCreate(
        sectorsData: Array<Partial<Record<string, any>>>,
        options: BulkSectorOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            skipValidation = false,
            continueOnError = true,
            batchSize = 100,
            logOperations = false,
            updateTimestamps = true
        } = options;

        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Process in batches
        for (let i = 0; i < sectorsData.length; i += batchSize) {
            const batch = sectorsData.slice(i, i + batchSize);
            
            for (let j = 0; j < batch.length; j++) {
                const sectorData = batch[j];
                const index = i + j;
                
                if (updateTimestamps) {
                    sectorData.LAST_REPLENISHED = sectorData.LAST_REPLENISHED || Date.now();
                }
                
                try {
                    const createdSector = await this.create(sectorData, {
                        skipValidation,
                        validateCoordinateUniqueness: !skipValidation
                    } as SectorCreateOptions);
                    
                    result.success++;
                    
                    if (logOperations) {
                        this.logger.debug('Bulk create sector success', {
                            operation: 'bulk-create-sectors',
                            index,
                            sectorId: createdSector.getId(),
                            coordinates: createdSector.getCoordinatesString()
                        });
                    }
                } catch (error: unknown) {
                    result.failed++;
                    result.errors.push({
                        index,
                        error: error instanceof Error ? error.message : String(error),
                        data: sectorData
                    });
                    
                    if (!continueOnError) {
                        break;
                    }
                }
            }
        }

        this.logger.info('Bulk create sectors completed', {
            operation: 'bulk-create-sectors',
            totalItems: sectorsData.length,
            result
        });

        return result;
    }

    /**
     * Bulk update sector protection
     */
    public async bulkUpdateProtection(
        sectorIds: number[],
        protectionLevel: ProtectionLevel,
        options: BulkSectorOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            continueOnError = true,
            logOperations = false
        } = options;

        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < sectorIds.length; i++) {
            const sectorId = sectorIds[i];
            
            try {
                await this.update(sectorId, {
                    PROTECTION: protectionLevel
                });
                
                result.success++;
                
                if (logOperations) {
                    this.logger.debug('Bulk update protection success', {
                        operation: 'bulk-update-protection',
                        sectorId,
                        protectionLevel
                    });
                }
            } catch (error) {
                result.failed++;
                result.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                    data: { sectorId, protectionLevel }
                });
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        this.logger.info('Bulk update protection completed', {
            operation: 'bulk-update-protection',
            totalItems: sectorIds.length,
            result
        });

        return result;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total sector count
     */
    public async getTotalSectorCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as total_count FROM SECTORS';

        try {
            const result = await this.executeQuery(sql, []);
            return parseInt(result[0]?.total_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get total sector count', {
                operation: 'get-total-sector-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    /**
     * Get sector count by type
     */
    public async getSectorCountByType(sectorType: SectorType): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as type_count FROM SECTORS WHERE TYPE = ?';
        const params = [sectorType];

        try {
            const result = await this.executeQuery(sql, params);
            return parseInt(result[0]?.type_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get sector count by type', {
                operation: 'get-sector-count-by-type',
                sectorType,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if coordinates are available
     */
    public async areCoordinatesAvailable(x: number, y: number, z: number): Promise<boolean> {
        const existingSector = await this.findByCoordinates(x, y, z);
        return existingSector === null;
    }

    /**
     * Validate coordinate uniqueness
     */
    private async validateCoordinateUniqueness(x: number, y: number, z: number, excludeId?: number): Promise<void> {
        const sql = excludeId 
            ? 'SELECT 1 FROM SECTORS WHERE X = ? AND Y = ? AND Z = ? AND ID != ?'
            : 'SELECT 1 FROM SECTORS WHERE X = ? AND Y = ? AND Z = ?';
        const params = excludeId ? [x, y, z, excludeId] : [x, y, z];

        try {
            const result = await this.executeQuery(sql, params);
            if (result.length > 0) {
                throw new ConflictError(`Sector already exists at coordinates (${x}, ${y}, ${z})`);
            }
        } catch (error) {
            if (error instanceof ConflictError) {
                throw error;
            }
            this.logger.error('Failed to validate coordinate uniqueness', {
                operation: 'validate-coordinate-uniqueness',
                x, y, z, excludeId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Generate unique coordinates
     */
    private async generateUniqueCoordinates(): Promise<{ x: number; y: number; z: number }> {
        // Simple strategy: try coordinates around origin
        for (let distance = 1; distance <= 100; distance++) {
            for (let x = -distance; x <= distance; x++) {
                for (let y = -distance; y <= distance; y++) {
                    for (let z = -distance; z <= distance; z++) {
                        if (Math.abs(x) === distance || Math.abs(y) === distance || Math.abs(z) === distance) {
                            if (await this.areCoordinatesAvailable(x, y, z)) {
                                return { x, y, z };
                            }
                        }
                    }
                }
            }
        }
        
        throw new Error('Unable to generate unique coordinates after extensive search');
    }

    /**
     * Find nearest system ID for coordinates
     */
    private async findNearestSystemId(x: number, y: number, z: number): Promise<number> {
        // This would require access to systems data - for now return default
        // In a real implementation, this would query the systems table
        return 0; // Default system
    }

    /**
     * Calculate direction between two sectors
     */
    private calculateDirection(from: SectorsModel, to: SectorsModel): string {
        const dx = to.getX() - from.getX();
        const dy = to.getY() - from.getY();
        const dz = to.getZ() - from.getZ();

        const directions: string[] = [];
        
        if (dx > 0) directions.push('+X');
        else if (dx < 0) directions.push('-X');
        
        if (dy > 0) directions.push('+Y');
        else if (dy < 0) directions.push('-Y');
        
        if (dz > 0) directions.push('+Z');
        else if (dz < 0) directions.push('-Z');

        return directions.join('');
    }

    /**
     * Resolve sector by ID or coordinates
     */
    private async resolveSector(identifier: any): Promise<SectorsModel | null> {
        // If identifier is a number, try by ID first
        if (typeof identifier === 'number') {
            const sector = await this.findById(identifier);
            if (sector) return sector;
        }

        // If identifier is a string that looks like coordinates
        if (typeof identifier === 'string') {
            const coordMatch = identifier.match(/^\((-?\d+),\s*(-?\d+),\s*(-?\d+)\)$/);
            if (coordMatch) {
                const x = parseInt(coordMatch[1], 10);
                const y = parseInt(coordMatch[2], 10);
                const z = parseInt(coordMatch[3], 10);
                return await this.findByCoordinates(x, y, z);
            }

            // If identifier looks like a number but is a string, try parsing it
            if (/^\d+$/.test(identifier)) {
                const sectorId = parseInt(identifier, 10);
                if (!isNaN(sectorId)) {
                    return await this.findById(sectorId);
                }
            }
        }

        // If identifier is an object with coordinates
        if (typeof identifier === 'object' && identifier !== null) {
            if ('x' in identifier && 'y' in identifier && 'z' in identifier) {
                return await this.findByCoordinates(identifier.x, identifier.y, identifier.z);
            }
            if ('X' in identifier && 'Y' in identifier && 'Z' in identifier) {
                return await this.findByCoordinates(identifier.X, identifier.Y, identifier.Z);
            }
        }

        return null;
    }

    /**
     * Clear sector-related caches
     */
    protected async clearSectorCaches(sectorId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('sectors:*');
            
            if (sectorId) {
                await this.cacheManager.clear(`SECTORS:by-id:${sectorId}`);
            }
        }
    }

    /**
     * Override cache clearing to include sector-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearSectorCaches();
    }
}