/**
 * @fileoverview Systems Controller
 * 
 * Controller for managing star systems in the SYSTEMS table with advanced operations,
 * coordinate management, ownership tracking, and territorial analysis.
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
    SystemsModel,
    SystemType,
    KnownSystemFactions,
    MAX_INFOS_SIZE,
    MAX_RESOURCES_SIZE
} from './SystemsModel.js';
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
 * System search options
 */
export interface SystemSearchOptions extends QueryOptions {
    /** Search by system name */
    searchTerm?: string;
    /** Filter by system type */
    systemType?: SystemType;
    /** Filter by owner faction */
    ownerFaction?: number;
    /** Filter by owner UID */
    ownerUid?: string;
    /** Include only owned systems */
    ownedOnly?: boolean;
    /** Include only player-owned systems */
    playerOwnedOnly?: boolean;
    /** Include only NPC-owned systems */
    npcOwnedOnly?: boolean;
    /** Filter by coordinate range */
    coordinateRange?: {
        minX?: number;
        maxX?: number;
        minY?: number;
        maxY?: number;
        minZ?: number;
        maxZ?: number;
    };
}

/**
 * System creation options
 */
export interface SystemCreateOptions extends CreateOptions {
    /** Auto-generate coordinates if not provided */
    autoGenerateCoordinates?: boolean;
    /** Validate coordinate uniqueness */
    validateCoordinateUniqueness?: boolean;
    /** Initialize default binary data */
    initializeDefaults?: boolean;
}

/**
 * System update options
 */
export interface SystemUpdateOptions extends UpdateOptions {
    /** Allow updating coordinate fields */
    allowCoordinateUpdates?: boolean;
    /** Validate coordinate uniqueness on update */
    validateCoordinateUniqueness?: boolean;
    /** Allow updating binary data fields */
    allowBinaryUpdates?: boolean;
}

/**
 * Ownership transfer options
 */
export interface OwnershipTransferOptions {
    /** Force transfer even if system has dependencies */
    forceTransfer?: boolean;
    /** Update related sectors' ownership */
    updateSectors?: boolean;
    /** Reason for transfer */
    reason?: string;
    /** Player/entity initiating the transfer */
    initiatedBy?: string;
}

/**
 * Territory analysis options
 */
export interface TerritoryAnalysisOptions {
    /** Include neighboring systems analysis */
    includeNeighbors?: boolean;
    /** Include resource analysis */
    includeResources?: boolean;
    /** Include NPC statistics */
    includeNPCStats?: boolean;
    /** Maximum distance for neighbor analysis */
    maxDistance?: number;
}

/**
 * Bulk operation options for systems
 */
export interface BulkSystemOptions {
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size for processing */
    batchSize?: number;
    /** Update timestamps */
    updateTimestamps?: boolean;
}

/**
 * System statistics result
 */
export interface SystemStatistics {
    /** Total systems */
    totalSystems: number;
    /** Systems by type */
    systemsByType: Record<SystemType, number>;
    /** Owned systems */
    ownedSystems: number;
    /** Player-owned systems */
    playerOwnedSystems: number;
    /** NPC-owned systems */
    npcOwnedSystems: number;
    /** Neutral systems */
    neutralSystems: number;
    /** Systems by faction */
    systemsByFaction: Record<number, number>;
    /** Coordinate extents */
    coordinateExtents: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    };
    /** Most active faction */
    mostActiveFaction?: {
        id: number;
        systemCount: number;
        factionName: string;
    };
}

/**
 * Territory map result
 */
export interface TerritoryMap {
    /** Center system */
    center: SystemsModel;
    /** Neighboring systems */
    neighbors: Array<{
        system: SystemsModel;
        distance: number;
        direction: string;
    }>;
    /** Territory summary */
    summary: {
        totalSystems: number;
        ownedBySameFaction: number;
        ownedByDifferentFactions: number;
        neutral: number;
        dominantFaction?: {
            id: number;
            name: string;
            systemCount: number;
        };
    };
}

// =============================================================================
// SYSTEMS CONTROLLER
// =============================================================================

/**
 * Controller for SYSTEMS table with advanced system management capabilities
 */
export class SystemsController extends BaseController<SystemsModel> {
    protected ModelClass: ModelConstructor<SystemsModel> = SystemsModel;
    protected controllerName = 'SystemsController';

    /**
     * Create a new systems controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 900000, // 15 minutes - systems change less frequently
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with system-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: SystemCreateOptions = {}
    ): Promise<SystemsModel> {
        const {
            autoGenerateCoordinates = false,
            validateCoordinateUniqueness = true,
            initializeDefaults = true,
            ...baseOptions
        } = options;

        // Enhanced validation specific to systems
        if (!data.TYPE && data.TYPE !== 0) {
            throw new ValidationError('data', data, 'TYPE is required');
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

        // Initialize defaults if requested
        if (options.initializeDefaults) {
            data = this.applyCreateDefaults(data);
        }

        // Call parent create method
        return await super.create(data, baseOptions);
    }

    /**
     * Apply default values to system creation data
     */
    private applyCreateDefaults(data: any): any {
        const defaults: any = {
            NAME: null,
            STARTTIME: Math.floor(Date.now()), // Use regular number instead of BigInt
            OWNER_UID: null,
            OWNER_FACTION: KnownSystemFactions.NEUTRAL,
            OWNER_X: 0,
            OWNER_Y: 0,
            OWNER_Z: 0,
            INFOS: Buffer.alloc(4, 0), // Default 4-byte buffer for INFOS
            RESOURCES: Buffer.alloc(16, 0) // Default 16-byte buffer for RESOURCES
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
     * Override: Update with system-specific validation
     */
    public async update(
        systemIdentifier: any,
        data: Partial<Record<string, any>>,
        options: SystemUpdateOptions = {}
    ): Promise<SystemsModel> {
        const {
            allowCoordinateUpdates = false,
            validateCoordinateUniqueness = true,
            allowBinaryUpdates = true,
            ...baseOptions
        } = options;

        // Resolve system by ID or coordinates
        const currentSystem = await this.resolveSystem(systemIdentifier);
        if (!currentSystem) {
            throw new ValidationError('systemIdentifier', systemIdentifier, `System not found: ${systemIdentifier}`);
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
            const newX = data.X ?? currentSystem.getX();
            const newY = data.Y ?? currentSystem.getY();
            const newZ = data.Z ?? currentSystem.getZ();
            
            // Only check if coordinates actually changed
            if (newX !== currentSystem.getX() || newY !== currentSystem.getY() || newZ !== currentSystem.getZ()) {
                await this.validateCoordinateUniqueness(newX, newY, newZ, currentSystem.getId());
            }
        }

        // Validate binary data sizes
        if (!allowBinaryUpdates) {
            const binaryFields = ['INFOS', 'RESOURCES'];
            const updatingBinary = binaryFields.filter(field => 
                data.hasOwnProperty(field) && data[field] !== undefined
            );
            
            if (updatingBinary.length > 0) {
                throw new ValidationError(
                    'data', 
                    data, 
                    `Cannot update binary fields [${updatingBinary.join(', ')}] when allowBinaryUpdates is false`
                );
            }
        }

        // Accept both Buffer and hex string formats for HSQLDB compatibility
        if (data.INFOS && !Buffer.isBuffer(data.INFOS) && typeof data.INFOS !== 'string') {
            throw new ValidationError('INFOS', data.INFOS, 'INFOS must be a Buffer or hex string');
        }

        if (data.RESOURCES && !Buffer.isBuffer(data.RESOURCES) && typeof data.RESOURCES !== 'string') {
            throw new ValidationError('RESOURCES', data.RESOURCES, 'RESOURCES must be a Buffer or hex string');
        }

        // Call parent update method with resolved ID
        return await super.update(currentSystem.getId(), data, { returnRecord: true, ...baseOptions });
    }

    /**
     * Override: Delete with system-specific validation
     */
    public async delete(
        systemIdentifier: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Resolve system by ID or coordinates
        const system = await this.resolveSystem(systemIdentifier);
        if (!system) {
            return false; // System doesn't exist
        }

        // Log system deletion
        this.logger.info('System deletion initiated', {
            operation: 'delete-system',
            systemId: system.getId(),
            coordinates: system.getCoordinatesString(),
            systemType: system.getTypeName(),
            ownerFaction: system.getOwnerFaction()
        });

        // Call parent delete method with resolved ID
        const result = await super.delete(system.getId(), options);

        if (result) {
            this.logger.info('System deleted successfully', {
                operation: 'delete-system',
                systemId: system.getId(),
                coordinates: system.getCoordinatesString()
            });
        }

        return result;
    }

    // =============================================================================
    // SEARCH AND FILTERING OPERATIONS
    // =============================================================================

    /**
     * Find systems with advanced search capabilities
     */
    public async findSystems(options: SystemSearchOptions = {}): Promise<SystemsModel[]> {
        this.ensureInitialized();

        const {
            searchTerm,
            systemType,
            ownerFaction,
            ownerUid,
            ownedOnly = false,
            playerOwnedOnly = false,
            npcOwnedOnly = false,
            coordinateRange,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (searchTerm) {
            conditions.push('(LOWER(NAME) LIKE ? OR LOWER(OWNER_UID) LIKE ?)');
            const searchPattern = `%${searchTerm.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (systemType !== undefined) {
            conditions.push('TYPE = ?');
            params.push(systemType);
        }

        if (ownerFaction !== undefined) {
            conditions.push('OWNER_FACTION = ?');
            params.push(ownerFaction);
        }

        if (ownerUid) {
            conditions.push('LOWER(OWNER_UID) LIKE ?');
            params.push(`%${ownerUid.toLowerCase()}%`);
        }

        if (ownedOnly) {
            conditions.push('(OWNER_UID IS NOT NULL AND OWNER_UID != \'\')');
        }

        if (playerOwnedOnly) {
            conditions.push('(OWNER_UID IS NOT NULL AND OWNER_UID != \'\' AND OWNER_UID NOT LIKE \'NPC-%\')');
        }

        if (npcOwnedOnly) {
            conditions.push('(OWNER_UID IS NOT NULL AND OWNER_UID LIKE \'NPC-%\')');
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

        // Build cache key
        const cacheKey = `systems:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Systems retrieved from cache', {
                    operation: 'find-systems',
                    count: cached.length,
                    searchTerm,
                    systemType
                });
                return SystemsModel.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM SYSTEMS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
        } else {
            sql += ' ORDER BY X ASC, Y ASC, Z ASC';
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
            const systems = SystemsModel.fromRows(result);

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Systems retrieved from database', {
                operation: 'find-systems',
                count: systems.length,
                searchTerm,
                systemType
            });

            return systems;
        } catch (error) {
            this.logger.error('Failed to find systems', {
                operation: 'find-systems',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a system by coordinates
     */
    public async findByCoordinates(x: number, y: number, z: number): Promise<SystemsModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM SYSTEMS WHERE X = ? AND Y = ? AND Z = ?';
        const params = [x, y, z];

        // Build cache key
        const cacheKey = `systems:by-coords:${x},${y},${z}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('System retrieved from cache by coordinates', {
                    operation: 'find-by-coordinates',
                    x, y, z,
                    cached: true
                });
                return SystemsModel.fromRow(cached);
            }
        }

        try {
            const result = await this.executeQuery(sql, params);
            const system = result.length > 0 ? SystemsModel.fromRow(result[0]) : null;

            // Cache result if system found
            if (system && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result[0], {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('System retrieved from database by coordinates', {
                operation: 'find-by-coordinates',
                x, y, z,
                found: !!system,
                cached: false
            });

            return system;
        } catch (error) {
            this.logger.error('Failed to find system by coordinates', {
                operation: 'find-by-coordinates',
                x, y, z,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find systems by type
     */
    public async findByType(systemType: SystemType, options: QueryOptions = {}): Promise<SystemsModel[]> {
        return await this.findSystems({
            systemType,
            ...options
        });
    }

    /**
     * Find systems by owner faction
     */
    public async findByOwnerFaction(ownerFaction: number, options: QueryOptions = {}): Promise<SystemsModel[]> {
        return await this.findSystems({
            ownerFaction,
            ...options
        });
    }

    /**
     * Find systems by owner UID
     */
    public async findByOwnerUid(ownerUid: string, options: QueryOptions = {}): Promise<SystemsModel[]> {
        return await this.findSystems({
            ownerUid,
            ...options
        });
    }

    /**
     * Find systems within a distance from a point
     */
    public async findWithinDistance(
        centerX: number,
        centerY: number,
        centerZ: number,
        maxDistance: number,
        options: QueryOptions = {}
    ): Promise<Array<{ system: SystemsModel; distance: number }>> {
        this.ensureInitialized();

        // Get all systems (or use coordinate range optimization)
        const coordinateRange = {
            minX: centerX - maxDistance,
            maxX: centerX + maxDistance,
            minY: centerY - maxDistance,
            maxY: centerY + maxDistance,
            minZ: centerZ - maxDistance,
            maxZ: centerZ + maxDistance
        };

        const systems = await this.findSystems({
            coordinateRange,
            ...options
        });

        // Calculate actual distances and filter
        const systemsWithDistance = systems
            .map(system => ({
                system,
                distance: Math.sqrt(
                    Math.pow(system.getX() - centerX, 2) +
                    Math.pow(system.getY() - centerY, 2) +
                    Math.pow(system.getZ() - centerZ, 2)
                )
            }))
            .filter(item => item.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance);

        this.logger.debug('Systems found within distance', {
            operation: 'find-within-distance',
            center: `(${centerX}, ${centerY}, ${centerZ})`,
            maxDistance,
            found: systemsWithDistance.length
        });

        return systemsWithDistance;
    }

    // =============================================================================
    // OWNERSHIP MANAGEMENT
    // ==============================================================================

    /**
     * Transfer system ownership
     */
    public async transferOwnership(
        systemIdentifier: any,
        newOwnerUid: string | null,
        newOwnerFaction: number,
        newOwnerCoordinates: { x: number; y: number; z: number },
        options: OwnershipTransferOptions = {}
    ): Promise<SystemsModel> {
        this.ensureInitialized();

        const system = await this.resolveSystem(systemIdentifier);
        if (!system) {
            throw new ValidationError('systemIdentifier', systemIdentifier, `System not found: ${systemIdentifier}`);
        }

        const oldOwnerUid = system.getOwnerUid();
        const oldOwnerFaction = system.getOwnerFaction();

        const updatedSystem = await this.update(system.getId(), {
            OWNER_UID: newOwnerUid,
            OWNER_FACTION: newOwnerFaction,
            OWNER_X: newOwnerCoordinates.x,
            OWNER_Y: newOwnerCoordinates.y,
            OWNER_Z: newOwnerCoordinates.z
        }, {
            returnRecord: true
        } as SystemUpdateOptions);

        this.logger.info('System ownership transferred', {
            operation: 'transfer-ownership',
            systemId: system.getId(),
            coordinates: system.getCoordinatesString(),
            oldOwnerUid,
            newOwnerUid,
            oldOwnerFaction,
            newOwnerFaction,
            reason: options.reason,
            initiatedBy: options.initiatedBy
        });

        return updatedSystem;
    }

    /**
     * Release system ownership (make neutral)
     */
    public async releaseOwnership(
        systemIdentifier: any,
        options: OwnershipTransferOptions = {}
    ): Promise<SystemsModel> {
        return await this.transferOwnership(
            systemIdentifier,
            null,
            KnownSystemFactions.NEUTRAL,
            { x: 0, y: 0, z: 0 },
            options
        );
    }

    /**
     * Claim system for faction
     */
    public async claimSystem(
        systemIdentifier: any,
        ownerUid: string,
        ownerFaction: number,
        homeCoordinates: { x: number; y: number; z: number },
        options: OwnershipTransferOptions = {}
    ): Promise<SystemsModel> {
        const system = await this.resolveSystem(systemIdentifier);
        if (!system) {
            throw new ValidationError('systemIdentifier', systemIdentifier, `System not found: ${systemIdentifier}`);
        }

        // Check if system is already owned (unless forcing)
        if (system.isOwned() && !options.forceTransfer) {
            throw new ConflictError(`System ${system.getCoordinatesString()} is already owned by ${system.getOwnerUid()}`);
        }

        return await this.transferOwnership(
            systemIdentifier,
            ownerUid,
            ownerFaction,
            homeCoordinates,
            options
        );
    }

    // =============================================================================
    // TERRITORY ANALYSIS
    // =============================================================================

    /**
     * Get territory map around a system
     */
    public async getTerritoryMap(
        systemIdentifier: any,
        options: TerritoryAnalysisOptions = {}
    ): Promise<TerritoryMap> {
        this.ensureInitialized();

        const centerSystem = await this.resolveSystem(systemIdentifier);
        if (!centerSystem) {
            throw new ValidationError('systemIdentifier', systemIdentifier, `System not found: ${systemIdentifier}`);
        }

        const { maxDistance = 3 } = options;

        // Find neighboring systems
        const neighborsWithDistance = await this.findWithinDistance(
            centerSystem.getX(),
            centerSystem.getY(),
            centerSystem.getZ(),
            maxDistance
        );

        // Remove the center system from neighbors
        const neighbors = neighborsWithDistance
            .filter(item => item.system.getId() !== centerSystem.getId())
            .map(item => ({
                system: item.system,
                distance: item.distance,
                direction: this.calculateDirection(centerSystem, item.system)
            }));

        // Analyze territory
        const factionCounts = new Map<number, number>();
        let ownedBySameFaction = 0;
        let ownedByDifferentFactions = 0;
        let neutral = 0;

        for (const neighbor of neighbors) {
            const system = neighbor.system;
            const faction = system.getOwnerFaction();
            
            if (system.isOwned()) {
                if (faction === centerSystem.getOwnerFaction()) {
                    ownedBySameFaction++;
                } else {
                    ownedByDifferentFactions++;
                }
                factionCounts.set(faction, (factionCounts.get(faction) || 0) + 1);
            } else {
                neutral++;
            }
        }

        // Find dominant faction
        let dominantFaction: { id: number; name: string; systemCount: number } | undefined;
        if (factionCounts.size > 0) {
            const [dominantFactionId, count] = Array.from(factionCounts.entries())
                .sort(([, a], [, b]) => b - a)[0];
            
            dominantFaction = {
                id: dominantFactionId,
                name: this.getFactionNameById(dominantFactionId),
                systemCount: count
            };
        }

        const territoryMap: TerritoryMap = {
            center: centerSystem,
            neighbors,
            summary: {
                totalSystems: neighbors.length,
                ownedBySameFaction,
                ownedByDifferentFactions,
                neutral,
                dominantFaction
            }
        };

        this.logger.debug('Territory map generated', {
            operation: 'get-territory-map',
            centerSystem: centerSystem.getCoordinatesString(),
            neighborsFound: neighbors.length,
            dominantFaction: dominantFaction?.id
        });

        return territoryMap;
    }

    /**
     * Get systems owned by a faction
     */
    public async getFactionTerritory(ownerFaction: number, options: QueryOptions = {}): Promise<SystemsModel[]> {
        return await this.findByOwnerFaction(ownerFaction, options);
    }

    /**
     * Get adjacent systems to a given system
     */
    public async getAdjacentSystems(systemIdentifier: any): Promise<SystemsModel[]> {
        const centerSystem = await this.resolveSystem(systemIdentifier);
        if (!centerSystem) {
            throw new ValidationError('systemIdentifier', systemIdentifier, `System not found: ${systemIdentifier}`);
        }

        const adjacentCoordinates = [
            { x: centerSystem.getX() + 1, y: centerSystem.getY(), z: centerSystem.getZ() },
            { x: centerSystem.getX() - 1, y: centerSystem.getY(), z: centerSystem.getZ() },
            { x: centerSystem.getX(), y: centerSystem.getY() + 1, z: centerSystem.getZ() },
            { x: centerSystem.getX(), y: centerSystem.getY() - 1, z: centerSystem.getZ() },
            { x: centerSystem.getX(), y: centerSystem.getY(), z: centerSystem.getZ() + 1 },
            { x: centerSystem.getX(), y: centerSystem.getY(), z: centerSystem.getZ() - 1 }
        ];

        const adjacentSystems: SystemsModel[] = [];
        for (const coords of adjacentCoordinates) {
            const system = await this.findByCoordinates(coords.x, coords.y, coords.z);
            if (system) {
                adjacentSystems.push(system);
            }
        }

        return adjacentSystems;
    }

    // =============================================================================
    // STATISTICS AND ANALYTICS
    // =============================================================================

    /**
     * Get comprehensive system statistics
     */
    public async getSystemStatistics(): Promise<SystemStatistics> {
        this.ensureInitialized();

        try {
            // Get total count first
            const totalCountSql = 'SELECT COUNT(*) as total_count FROM SYSTEMS';
            const totalResult = await this.executeQuery(totalCountSql, []);
            const totalSystems = parseInt(totalResult[0]?.total_count || '0', 10);

            // Get coordinate extents
            const extentsSql = `
                SELECT 
                    MIN(X) as min_x, MAX(X) as max_x,
                    MIN(Y) as min_y, MAX(Y) as max_y,
                    MIN(Z) as min_z, MAX(Z) as max_z
                FROM SYSTEMS
            `;
            const extentsResult = await this.executeQuery(extentsSql, []);
            const extents = extentsResult[0] || {};

            // Get owned systems count
            const ownedSql = `SELECT COUNT(*) as owned_count FROM SYSTEMS WHERE OWNER_UID IS NOT NULL AND OWNER_UID != ''`;
            const ownedResult = await this.executeQuery(ownedSql, []);
            const ownedSystems = parseInt(ownedResult[0]?.owned_count || '0', 10);

            // Get player-owned systems count
            const playerOwnedSql = `SELECT COUNT(*) as player_count FROM SYSTEMS WHERE OWNER_UID IS NOT NULL AND OWNER_UID != '' AND OWNER_UID NOT LIKE 'NPC-%'`;
            const playerOwnedResult = await this.executeQuery(playerOwnedSql, []);
            const playerOwnedSystems = parseInt(playerOwnedResult[0]?.player_count || '0', 10);

            // Get NPC-owned systems count
            const npcOwnedSql = `SELECT COUNT(*) as npc_count FROM SYSTEMS WHERE OWNER_UID IS NOT NULL AND OWNER_UID LIKE 'NPC-%'`;
            const npcOwnedResult = await this.executeQuery(npcOwnedSql, []);
            const npcOwnedSystems = parseInt(npcOwnedResult[0]?.npc_count || '0', 10);

            const neutralSystems = totalSystems - ownedSystems;

            // Get systems by type
            const typeStatsSql = 'SELECT TYPE, COUNT(*) as type_count FROM SYSTEMS GROUP BY TYPE';
            const typeStatsResult = await this.executeQuery(typeStatsSql, []);
            const systemsByType: Record<SystemType, number> = {
                [SystemType.SUN]: 0,
                [SystemType.GIANT]: 0,
                [SystemType.BLACK_HOLE]: 0,
                [SystemType.DOUBLE_STAR]: 0,
                [SystemType.VOID]: 0
            };

            typeStatsResult.forEach(row => {
                const type = parseInt(row.TYPE, 10) as SystemType;
                const count = parseInt(row.type_count || '0', 10);
                if (type in systemsByType) {
                    systemsByType[type] = count;
                }
            });

            // Get systems by faction
            const factionStatsSql = 'SELECT OWNER_FACTION, COUNT(*) as faction_count FROM SYSTEMS GROUP BY OWNER_FACTION';
            const factionStatsResult = await this.executeQuery(factionStatsSql, []);
            const systemsByFaction: Record<number, number> = {};

            factionStatsResult.forEach(row => {
                const faction = parseInt(row.OWNER_FACTION || '0', 10);
                const count = parseInt(row.faction_count || '0', 10);
                systemsByFaction[faction] = count;
            });

            // Find most active faction
            let mostActiveFaction: { id: number; systemCount: number; factionName: string } | undefined;
            if (Object.keys(systemsByFaction).length > 0) {
                const [factionId, count] = Object.entries(systemsByFaction)
                    .filter(([id]) => parseInt(id, 10) !== KnownSystemFactions.NEUTRAL)
                    .sort(([, a], [, b]) => (typeof b === 'string' ? parseInt(b, 10) : b) - (typeof a === 'string' ? parseInt(a, 10) : a))[0];
                
                if (factionId && count) {
                    mostActiveFaction = {
                        id: parseInt(factionId, 10),
                        systemCount: typeof count === 'string' ? parseInt(count, 10) : count,
                        factionName: this.getFactionNameById(parseInt(factionId, 10))
                    };
                }
            }

            const statistics: SystemStatistics = {
                totalSystems,
                systemsByType,
                ownedSystems,
                playerOwnedSystems,
                npcOwnedSystems,
                neutralSystems,
                systemsByFaction,
                coordinateExtents: {
                    minX: parseInt(extents.min_x || '0', 10),
                    maxX: parseInt(extents.max_x || '0', 10),
                    minY: parseInt(extents.min_y || '0', 10),
                    maxY: parseInt(extents.max_y || '0', 10),
                    minZ: parseInt(extents.min_z || '0', 10),
                    maxZ: parseInt(extents.max_z || '0', 10)
                },
                mostActiveFaction
            };

            this.logger.info('System statistics generated', {
                operation: 'get-system-statistics',
                statistics
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to get system statistics', {
                operation: 'get-system-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getSystemStatistics', error, []);
        }
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk create systems
     */
    public async bulkCreate(
        systemsData: Array<Partial<Record<string, any>>>,
        options: BulkSystemOptions = {}
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
        for (let i = 0; i < systemsData.length; i += batchSize) {
            const batch = systemsData.slice(i, i + batchSize);
            
            for (let j = 0; j < batch.length; j++) {
                const systemData = batch[j];
                const index = i + j;
                
                if (updateTimestamps) {
                    systemData.STARTTIME = systemData.STARTTIME || Math.floor(Date.now());
                }
                
                try {
                    const createdSystem = await this.create(systemData, {
                        skipValidation,
                        validateCoordinateUniqueness: !skipValidation
                    } as SystemCreateOptions);
                    
                    result.success++;
                    
                    if (logOperations) {
                        this.logger.debug('Bulk create system success', {
                            operation: 'bulk-create-systems',
                            index,
                            systemId: createdSystem.getId(),
                            coordinates: createdSystem.getCoordinatesString()
                        });
                    }
                } catch (error: unknown) {
                    result.failed++;
                    result.errors.push({
                        index,
                        error: error instanceof Error ? error.message : String(error),
                        data: systemData
                    });
                    
                    if (!continueOnError) {
                        break;
                    }
                }
            }
        }

        this.logger.info('Bulk create systems completed', {
            operation: 'bulk-create-systems',
            totalItems: systemsData.length,
            result
        });

        return result;
    }

    /**
     * Bulk update system ownership
     */
    public async bulkUpdateOwnership(
        systemIds: number[],
        newOwnerUid: string | null,
        newOwnerFaction: number,
        options: BulkSystemOptions = {}
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

        for (let i = 0; i < systemIds.length; i++) {
            const systemId = systemIds[i];
            
            try {
                await this.update(systemId, {
                    OWNER_UID: newOwnerUid,
                    OWNER_FACTION: newOwnerFaction
                });
                
                result.success++;
                
                if (logOperations) {
                    this.logger.debug('Bulk update ownership success', {
                        operation: 'bulk-update-ownership',
                        systemId,
                        newOwnerUid,
                        newOwnerFaction
                    });
                }
            } catch (error) {
                result.failed++;
                result.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                    data: { systemId, newOwnerUid, newOwnerFaction }
                });
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        this.logger.info('Bulk update ownership completed', {
            operation: 'bulk-update-ownership',
            totalItems: systemIds.length,
            result
        });

        return result;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total system count
     */
    public async getTotalSystemCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as total_count FROM SYSTEMS';

        try {
            const result = await this.executeQuery(sql, []);
            return parseInt(result[0]?.total_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get total system count', {
                operation: 'get-total-system-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    /**
     * Get system count by type
     */
    public async getSystemCountByType(systemType: SystemType): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as type_count FROM SYSTEMS WHERE TYPE = ?';
        const params = [systemType];

        try {
            const result = await this.executeQuery(sql, params);
            return parseInt(result[0]?.type_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get system count by type', {
                operation: 'get-system-count-by-type',
                systemType,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if coordinates are available
     */
    public async areCoordinatesAvailable(x: number, y: number, z: number): Promise<boolean> {
        const existingSystem = await this.findByCoordinates(x, y, z);
        return existingSystem === null;
    }

    /**
     * Validate coordinate uniqueness
     */
    private async validateCoordinateUniqueness(x: number, y: number, z: number, excludeId?: number): Promise<void> {
        const sql = excludeId 
            ? 'SELECT 1 FROM SYSTEMS WHERE X = ? AND Y = ? AND Z = ? AND ID != ?'
            : 'SELECT 1 FROM SYSTEMS WHERE X = ? AND Y = ? AND Z = ?';
        const params = excludeId ? [x, y, z, excludeId] : [x, y, z];

        try {
            const result = await this.executeQuery(sql, params);
            if (result.length > 0) {
                throw new ConflictError(`System already exists at coordinates (${x}, ${y}, ${z})`);
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
     * Calculate direction between two systems
     */
    private calculateDirection(from: SystemsModel, to: SystemsModel): string {
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
     * Get faction name by ID
     */
    private getFactionNameById(factionId: number): string {
        switch (factionId) {
            case KnownSystemFactions.NEUTRAL:
                return 'Neutral';
            case KnownSystemFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownSystemFactions.OUTCASTS:
                return 'Outcasts';
            case KnownSystemFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return factionId > 0 ? `Player Faction ${factionId}` : `Faction ${factionId}`;
        }
    }

    /**
     * Resolve system by ID or coordinates
     */
    private async resolveSystem(identifier: any): Promise<SystemsModel | null> {
        // If identifier is a number, try by ID first
        if (typeof identifier === 'number') {
            const system = await this.findById(identifier);
            if (system) return system;
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
                const systemId = parseInt(identifier, 10);
                if (!isNaN(systemId)) {
                    return await this.findById(systemId);
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
     * Clear system-related caches
     */
    protected async clearSystemCaches(systemId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('systems:*');
            
            if (systemId) {
                await this.cacheManager.clear(`SYSTEMS:by-id:${systemId}`);
            }
        }
    }

    /**
     * Override cache clearing to include system-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearSystemCaches();
    }
}