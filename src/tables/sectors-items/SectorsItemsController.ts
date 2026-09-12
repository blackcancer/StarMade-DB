/**
 * @fileoverview Sectors Items Controller
 * 
 * Controller for managing items floating freely in space sectors (SECTORS_ITEMS table).
 * Provides advanced operations for item storage, capacity management, and binary data handling.
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
    SectorsItemsModel,
    MAX_ITEMS_SIZE,
    ITEM_RECORD_SIZE,
    MAX_ITEM_STACKS
} from './SectorsItemsModel.js';
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
 * Sectors items search options
 */
export interface SectorsItemsSearchOptions extends QueryOptions {
    /** Search by sector ID */
    sectorId?: number;
    /** Filter by minimum storage efficiency percentage */
    minEfficiency?: number;
    /** Filter by maximum storage efficiency percentage */
    maxEfficiency?: number;
    /** Filter by minimum item count */
    minItemCount?: number;
    /** Filter by maximum item count */
    maxItemCount?: number;
    /** Include only items at capacity */
    atCapacityOnly?: boolean;
    /** Include only items with valid data format */
    validDataOnly?: boolean;
    /** Filter by minimum size in bytes */
    minSizeBytes?: number;
    /** Filter by maximum size in bytes */
    maxSizeBytes?: number;
    /** Include sectors with items loaded */
    withSectorLoaded?: boolean;
}

/**
 * Sectors items creation options
 */
export interface SectorsItemsCreateOptions extends CreateOptions {
    /** Validate buffer size limits */
    validateSize?: boolean;
    /** Validate buffer data format */
    validateDataFormat?: boolean;
    /** Auto-initialize empty buffer if none provided */
    autoInitializeBuffer?: boolean;
    /** Link to existing sector */
    linkToSector?: boolean;
}

/**
 * Sectors items update options
 */
export interface SectorsItemsUpdateOptions extends UpdateOptions {
    /** Allow updating buffer beyond size limits */
    allowOversizeBuffer?: boolean;
    /** Validate buffer data format */
    validateDataFormat?: boolean;
    /** Update sector relationship */
    updateSectorLink?: boolean;
    /** Preserve data integrity during update */
    preserveDataIntegrity?: boolean;
}

/**
 * Storage analysis options
 */
export interface StorageAnalysisOptions {
    /** Include detailed capacity breakdown */
    includeCapacityBreakdown?: boolean;
    /** Include efficiency metrics */
    includeEfficiencyMetrics?: boolean;
    /** Include sector relationship analysis */
    includeSectorAnalysis?: boolean;
    /** Include data validation results */
    includeDataValidation?: boolean;
    /** Performance optimization hints */
    optimizationHints?: boolean;
}

/**
 * Bulk operations options for sectors items
 */
export interface BulkSectorsItemsOptions {
    /** Skip size validation for performance */
    skipSizeValidation?: boolean;
    /** Skip data format validation */
    skipDataValidation?: boolean;
    /** Continue on buffer size errors */
    continueOnSizeError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size for processing */
    batchSize?: number;
    /** Optimize for memory usage */
    optimizeMemory?: boolean;
}

/**
 * Storage statistics result
 */
export interface StorageStatistics {
    /** Total sectors items records */
    totalRecords: number;
    /** Records with items */
    recordsWithItems: number;
    /** Records without items */
    emptyRecords: number;
    /** Total storage used in bytes */
    totalStorageUsed: number;
    /** Total storage available */
    totalStorageAvailable: number;
    /** Average storage efficiency */
    averageEfficiency: number;
    /** Records at maximum capacity */
    recordsAtCapacity: number;
    /** Storage efficiency distribution */
    efficiencyDistribution: {
        low: number;     // 0-33%
        medium: number;  // 34-66%
        high: number;    // 67-100%
    };
    /** Size distribution */
    sizeDistribution: {
        empty: number;   // 0 bytes
        small: number;   // 1-5KB
        medium: number;  // 5-15KB
        large: number;   // 15KB+
    };
    /** Data validation statistics */
    dataValidation: {
        validRecords: number;
        invalidRecords: number;
        corruptedRecords: number;
    };
}

/**
 * Storage capacity analysis result
 */
export interface CapacityAnalysis {
    /** Sectors items record */
    record: SectorsItemsModel;
    /** Current usage */
    currentUsage: {
        sizeBytes: number;
        estimatedStacks: number;
        efficiency: number;
    };
    /** Capacity information */
    capacity: {
        maxSizeBytes: number;
        maxPossibleStacks: number;
        remainingBytes: number;
        remainingStacks: number;
    };
    /** Data quality */
    dataQuality: {
        isValid: boolean;
        isStructured: boolean;
        hasCorruption: boolean;
    };
    /** Sector relationship */
    sectorInfo?: {
        isLoaded: boolean;
        coordinates?: string;
        name?: string;
    };
    /** Recommendations */
    recommendations: string[];
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
    /** Records processed */
    recordsProcessed: number;
    /** Empty records cleaned */
    emptyRecordsCleaned: number;
    /** Corrupted records fixed */
    corruptedRecordsFixed: number;
    /** Records optimized */
    recordsOptimized: number;
    /** Storage space freed in bytes */
    spaceFreed: number;
    /** Errors encountered */
    errors: Array<{
        recordId: number;
        error: string;
    }>;
    /** Total processing time */
    processingTimeMs: number;
}

// =============================================================================
// SECTORS ITEMS CONTROLLER
// =============================================================================

/**
 * Controller for SECTORS_ITEMS table with advanced storage management capabilities
 */
export class SectorsItemsController extends BaseController<SectorsItemsModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<SectorsItemsModel> = SectorsItemsModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'SectorsItemsController';

    /**
     * Create a new sectors items controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 300000, // 5 minutes - items change frequently
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with sectors items-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: SectorsItemsCreateOptions = {}
    ): Promise<SectorsItemsModel> {
        const {
            validateSize = true,
            validateDataFormat = true,
            autoInitializeBuffer = true,
            linkToSector = false,
            ...baseOptions
        } = options;

        // Auto-initialize empty buffer if none provided
        if (autoInitializeBuffer && !data.ITEMS) {
            data.ITEMS = Buffer.alloc(0);
        }

        // Enhanced validation specific to sectors items
        if (!data.ITEMS) {
            throw new ValidationError('data', data, 'ITEMS buffer is required');
        }

        if (!Buffer.isBuffer(data.ITEMS)) {
            throw new ValidationError('data', data, 'ITEMS must be a Buffer');
        }

        // Validate buffer size
        if (validateSize && data.ITEMS.length > MAX_ITEMS_SIZE) {
            throw new ValidationError(
                'data', 
                data, 
                `ITEMS buffer cannot exceed ${MAX_ITEMS_SIZE} bytes (current: ${data.ITEMS.length})`
            );
        }

        // Validate data format if requested
        if (validateDataFormat && data.ITEMS.length > 0) {
            const isValidFormat = this.validateItemsDataFormat(data.ITEMS);
            if (!isValidFormat) {
                throw new ValidationError('data', data, 'ITEMS buffer contains invalid data format');
            }
        }

        // Link to sector if requested and ID provided
        if (linkToSector && data.ID) {
            await this.validateSectorReference(data.ID);
        }

        // Call parent create method
        return await super.create(data, baseOptions);
    }

    /**
     * Override: Update with sectors items-specific validation
     */
    public async update(
        recordIdentifier: any,
        data: Partial<Record<string, any>>,
        options: SectorsItemsUpdateOptions = {}
    ): Promise<SectorsItemsModel> {
        const {
            allowOversizeBuffer = false,
            validateDataFormat = true,
            updateSectorLink = false,
            preserveDataIntegrity = true,
            ...baseOptions
        } = options;

        // Resolve record by ID
        const currentRecord = await this.resolveRecord(recordIdentifier);
        if (!currentRecord) {
            throw new ValidationError('recordIdentifier', recordIdentifier, `Sectors items record not found: ${recordIdentifier}`);
        }

        // Validate ITEMS buffer if being updated
        if (data.ITEMS !== undefined) {
            if (!Buffer.isBuffer(data.ITEMS)) {
                throw new ValidationError('data', data, 'ITEMS must be a Buffer');
            }

            // Check size limits
            if (!allowOversizeBuffer && data.ITEMS.length > MAX_ITEMS_SIZE) {
                throw new ValidationError(
                    'data', 
                    data, 
                    `ITEMS buffer cannot exceed ${MAX_ITEMS_SIZE} bytes when allowOversizeBuffer is false`
                );
            }

            // Validate data format if requested
            if (validateDataFormat && data.ITEMS.length > 0) {
                const isValidFormat = this.validateItemsDataFormat(data.ITEMS);
                if (!isValidFormat) {
                    throw new ValidationError('data', data, 'ITEMS buffer contains invalid data format');
                }
            }
        }

        // Update sector link if requested
        if (updateSectorLink && data.ID && data.ID !== currentRecord.getId()) {
            await this.validateSectorReference(data.ID);
        }

        // Call parent update method with resolved ID
        return await super.update(currentRecord.getId(), data, { returnRecord: true, ...baseOptions });
    }

    /**
     * Override: Delete with sectors items-specific cleanup
     */
    public async delete(
        recordIdentifier: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Resolve record by ID
        const record = await this.resolveRecord(recordIdentifier);
        if (!record) {
            return false; // Record doesn't exist
        }

        // Log sectors items deletion
        this.logger.info('Sectors items deletion initiated', {
            operation: 'delete-sectors-items',
            recordId: record.getId(),
            sizeBytes: record.getItemsSize(),
            hasItems: record.hasItems()
        });

        // Call parent delete method with resolved ID
        const result = await super.delete(record.getId(), options);

        if (result) {
            this.logger.info('Sectors items deleted successfully', {
                operation: 'delete-sectors-items',
                recordId: record.getId()
            });
        }

        return result;
    }

    // =============================================================================
    // SEARCH AND FILTERING OPERATIONS
    // =============================================================================

    /**
     * Find sectors items with advanced search capabilities
     */
    public async findSectorsItems(options: SectorsItemsSearchOptions = {}): Promise<SectorsItemsModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            sectorId,
            minEfficiency,
            maxEfficiency,
            minItemCount,
            maxItemCount,
            atCapacityOnly = false,
            validDataOnly = false,
            minSizeBytes,
            maxSizeBytes,
            withSectorLoaded = false,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        // Note: HSQLDB a des problèmes avec LENGTH/OCTET_LENGTH sur les BLOB
        // Nous allons récupérer les données et faire le filtrage côté application
        if (minSizeBytes !== undefined || maxSizeBytes !== undefined || atCapacityOnly) {
            // Ces filtres nécessitent une logique post-requête
            // Ne pas ajouter de conditions SQL pour éviter les erreurs HSQLDB
        } else {
            // Les autres filtres peuvent être appliqués en SQL
            if (sectorId !== undefined) {
                conditions.push('ID = ?');
                params.push(sectorId);
            }
        }

        // Build cache key
        const cacheKey = `sectors-items:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Sectors items retrieved from cache', {
                    operation: 'find-sectors-items',
                    count: cached.length
                });
                return SectorsItemsModel.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM SECTORS_ITEMS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
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
            let sectorsItems = SectorsItemsModel.fromRows(result);

            // Apply post-query filters that require model logic or BLOB size checks
            if (minSizeBytes !== undefined || maxSizeBytes !== undefined || 
                atCapacityOnly || minEfficiency !== undefined || maxEfficiency !== undefined || 
                minItemCount !== undefined || maxItemCount !== undefined || 
                validDataOnly) {
                
                sectorsItems = sectorsItems.filter(item => {
                    // Size-based filters
                    const itemSize = item.getItemsSize();
                    if (minSizeBytes !== undefined && itemSize < minSizeBytes) {
                        return false;
                    }
                    if (maxSizeBytes !== undefined && itemSize > maxSizeBytes) {
                        return false;
                    }
                    if (atCapacityOnly && itemSize < MAX_ITEMS_SIZE) {
                        return false;
                    }
                    
                    // Efficiency-based filters
                    if (minEfficiency !== undefined && item.getStorageEfficiency() < minEfficiency) {
                        return false;
                    }
                    if (maxEfficiency !== undefined && item.getStorageEfficiency() > maxEfficiency) {
                        return false;
                    }
                    
                    // Item count filters
                    if (minItemCount !== undefined && item.getEstimatedStackCount() < minItemCount) {
                        return false;
                    }
                    if (maxItemCount !== undefined && item.getEstimatedStackCount() > maxItemCount) {
                        return false;
                    }
                    
                    // Data validation filter
                    if (validDataOnly && !item.isItemsDataValid()) {
                        return false;
                    }
                    return true;
                });
            }

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Sectors items retrieved from database', {
                operation: 'find-sectors-items',
                count: sectorsItems.length
            });

            return sectorsItems;
        } catch (error) {
            this.logger.error('Failed to find sectors items', {
                operation: 'find-sectors-items',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find sectors items by sector ID
     */
    public async findBySectorId(sectorId: number): Promise<SectorsItemsModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM SECTORS_ITEMS WHERE ID = ?';
        const params = [sectorId];

        // Build cache key
        const cacheKey = `sectors-items:by-sector:${sectorId}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('Sectors items retrieved from cache by sector ID', {
                    operation: 'find-by-sector-id',
                    sectorId,
                    cached: true
                });
                return SectorsItemsModel.fromRow(cached);
            }
        }

        try {
            const result = await this.executeQuery(sql, params);
            const sectorsItems = result.length > 0 ? SectorsItemsModel.fromRow(result[0]) : null;

            // Cache result if found
            if (sectorsItems && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result[0], {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('Sectors items retrieved from database by sector ID', {
                operation: 'find-by-sector-id',
                sectorId,
                found: !!sectorsItems,
                cached: false
            });

            return sectorsItems;
        } catch (error) {
            this.logger.error('Failed to find sectors items by sector ID', {
                operation: 'find-by-sector-id',
                sectorId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find sectors items with items (non-empty)
     */
    public async findWithItems(options: QueryOptions = {}): Promise<SectorsItemsModel[]> {
        return await this.findSectorsItems({
            minSizeBytes: 1,
            ...options
        });
    }

    /**
     * Find empty sectors items
     */
    public async findEmptyItems(options: QueryOptions = {}): Promise<SectorsItemsModel[]> {
        return await this.findSectorsItems({
            maxSizeBytes: 0,
            ...options
        });
    }

    /**
     * Find sectors items at capacity
     */
    public async findAtCapacity(options: QueryOptions = {}): Promise<SectorsItemsModel[]> {
        return await this.findSectorsItems({
            atCapacityOnly: true,
            ...options
        });
    }

    /**
     * Find sectors items by efficiency range
     */
    public async findByEfficiencyRange(
        minEfficiency: number,
        maxEfficiency: number,
        options: QueryOptions = {}
    ): Promise<SectorsItemsModel[]> {
        return await this.findSectorsItems({
            minEfficiency,
            maxEfficiency,
            ...options
        });
    }

    // =============================================================================
    // STORAGE ANALYSIS
    // =============================================================================

    /**
     * Analyze storage capacity for a sectors items record
     */
    public async analyzeStorageCapacity(
        recordIdentifier: any,
        options: StorageAnalysisOptions = {}
    ): Promise<CapacityAnalysis> {
        this.ensureInitialized();

        const record = await this.resolveRecord(recordIdentifier);
        if (!record) {
            throw new ValidationError('recordIdentifier', recordIdentifier, `Sectors items record not found: ${recordIdentifier}`);
        }

        const currentUsage = {
            sizeBytes: record.getItemsSize(),
            estimatedStacks: record.getEstimatedStackCount(),
            efficiency: record.getStorageEfficiency()
        };

        const capacity = {
            maxSizeBytes: MAX_ITEMS_SIZE,
            maxPossibleStacks: record.getMaxPossibleStacks(),
            remainingBytes: record.getRemainingCapacity(),
            remainingStacks: Math.max(0, record.getMaxPossibleStacks() - record.getEstimatedStackCount())
        };

        const dataQuality = {
            isValid: record.isItemsDataValid(),
            isStructured: record.getItemsSize() === 0 || record.getItemsSize() % ITEM_RECORD_SIZE === 0,
            hasCorruption: !record.validateItemsSize()
        };

        let sectorInfo: any = undefined;
        if (options.includeSectorAnalysis && record.hasSectorLoaded()) {
            sectorInfo = {
                isLoaded: true,
                coordinates: record.getSectorCoordinates(),
                name: record.getSectorName()
            };
        } else if (options.includeSectorAnalysis) {
            sectorInfo = {
                isLoaded: false
            };
        }

        // Generate recommendations
        const recommendations: string[] = [];
        if (currentUsage.efficiency > 90) {
            recommendations.push('Consider optimizing item storage - approaching capacity limit');
        }
        if (!dataQuality.isValid) {
            recommendations.push('Data format validation failed - consider data cleanup');
        }
        if (!dataQuality.isStructured) {
            recommendations.push('Data appears unstructured - may indicate corruption');
        }
        if (currentUsage.sizeBytes === 0) {
            recommendations.push('Empty storage - consider cleanup if unused');
        }

        const analysis: CapacityAnalysis = {
            record,
            currentUsage,
            capacity,
            dataQuality,
            sectorInfo,
            recommendations
        };

        this.logger.debug('Storage capacity analysis completed', {
            operation: 'analyze-storage-capacity',
            recordId: record.getId(),
            efficiency: currentUsage.efficiency,
            isValid: dataQuality.isValid
        });

        return analysis;
    }

    /**
     * Get comprehensive storage statistics
     */
    public async getStorageStatistics(): Promise<StorageStatistics> {
        this.ensureInitialized();

        try {
            // Get total count
            const totalCountSql = 'SELECT COUNT(*) FROM SECTORS_ITEMS';
            const totalResult = await this.executeQuery(totalCountSql, []);
            const totalRecords = parseInt(String(Object.values(totalResult[0] ?? {'0': 0})[0] ?? '0'), 10);

            // Get all records and analyze them in memory instead of using SQL functions on BLOB
            const allRecordsSql = 'SELECT ID, ITEMS FROM SECTORS_ITEMS';
            const allRecordsResult = await this.executeQuery(allRecordsSql, []);
            
            let recordsWithItems = 0;
            let totalStorageUsed = 0;
            let recordsAtCapacity = 0;
            
            // Calculate distributions
            const efficiencyDistribution = { low: 0, medium: 0, high: 0 };
            const sizeDistribution = { empty: 0, small: 0, medium: 0, large: 0 };
            const dataValidation = { validRecords: 0, invalidRecords: 0, corruptedRecords: 0 };

            for (const row of allRecordsResult) {
                const itemsBuffer = row.ITEMS as Buffer;
                const sizeBytes = itemsBuffer ? itemsBuffer.length : 0;
                
                if (sizeBytes > 0) {
                    recordsWithItems++;
                }
                
                totalStorageUsed += sizeBytes;
                
                if (sizeBytes >= MAX_ITEMS_SIZE) {
                    recordsAtCapacity++;
                }
                
                const efficiency = Math.round((sizeBytes / MAX_ITEMS_SIZE) * 100);

                // Efficiency distribution
                if (efficiency <= 33) efficiencyDistribution.low++;
                else if (efficiency <= 66) efficiencyDistribution.medium++;
                else efficiencyDistribution.high++;

                // Size distribution
                if (sizeBytes === 0) sizeDistribution.empty++;
                else if (sizeBytes <= 5120) sizeDistribution.small++;  // 5KB
                else if (sizeBytes <= 15360) sizeDistribution.medium++; // 15KB
                else sizeDistribution.large++;

                // Data validation (simplified)
                if (sizeBytes === 0 || sizeBytes % ITEM_RECORD_SIZE === 0) {
                    dataValidation.validRecords++;
                } else {
                    dataValidation.invalidRecords++;
                }
            }

            const emptyRecords = totalRecords - recordsWithItems;
            const totalStorageAvailable = totalRecords * MAX_ITEMS_SIZE;
            const averageEfficiency = totalStorageAvailable > 0 
                ? Math.round((totalStorageUsed / totalStorageAvailable) * 100) 
                : 0;

            const statistics: StorageStatistics = {
                totalRecords,
                recordsWithItems,
                emptyRecords,
                totalStorageUsed,
                totalStorageAvailable,
                averageEfficiency,
                recordsAtCapacity,
                efficiencyDistribution,
                sizeDistribution,
                dataValidation
            };

            this.logger.info('Storage statistics generated', {
                operation: 'get-storage-statistics',
                statistics
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to get storage statistics', {
                operation: 'get-storage-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getStorageStatistics', error, []);
        }
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk create sectors items
     */
    public async bulkCreate(
        itemsData: Array<Partial<Record<string, any>>>,
        options: BulkSectorsItemsOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            skipSizeValidation = false,
            skipDataValidation = false,
            continueOnSizeError = true,
            batchSize = 50,
            logOperations = false,
            optimizeMemory = true
        } = options;

        if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
            throw new ValidationError('batchSize', batchSize, 'Batch size must be a positive safe integer');
        }

        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Process in batches
        batches: for (let i = 0; i < itemsData.length; i += batchSize) {
            const batch = itemsData.slice(i, i + batchSize);
            
            for (let j = 0; j < batch.length; j++) {
                const itemData = batch[j];
                const index = i + j;
                
                try {
                    const createdItem = await this.create(itemData, {
                        validateSize: !skipSizeValidation,
                        validateDataFormat: !skipDataValidation,
                        autoInitializeBuffer: true
                    } as SectorsItemsCreateOptions);
                    
                    result.success++;
                    
                    if (logOperations) {
                        this.logger.debug('Bulk create sectors items success', {
                            operation: 'bulk-create-sectors-items',
                            index,
                            recordId: createdItem.getId(),
                            sizeBytes: createdItem.getItemsSize()
                        });
                    }
                } catch (error: unknown) {
                    if (error instanceof ValidationError && error.message.includes('exceed') && continueOnSizeError) {
                        result.skipped++;
                    } else {
                        result.failed++;
                    }
                    
                    result.errors.push({
                        index,
                        error: error instanceof Error ? error.message : String(error),
                        data: itemData
                    });
                    
                    if (!continueOnSizeError && error instanceof ValidationError && error.message.includes('exceed')) {
                        break batches;
                    }
                }
                
                // Memory optimization
                if (optimizeMemory && index % 100 === 0) {
                    // Give GC a chance to run
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
        }

        this.logger.info('Bulk create sectors items completed', {
            operation: 'bulk-create-sectors-items',
            totalItems: itemsData.length,
            result
        });

        return result;
    }

    /**
     * Cleanup storage (remove empty records, fix corrupted data)
     */
    public async cleanupStorage(options: BulkSectorsItemsOptions = {}): Promise<CleanupResult> {
        this.ensureInitialized();

        const startTime = Date.now();
        const {
            skipDataValidation = false,
            logOperations = false,
            batchSize = 100
        } = options;

        if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
            throw new ValidationError('batchSize', batchSize, 'Batch size must be a positive safe integer');
        }

        const result: CleanupResult = {
            recordsProcessed: 0,
            emptyRecordsCleaned: 0,
            corruptedRecordsFixed: 0,
            recordsOptimized: 0,
            spaceFreed: 0,
            errors: [],
            processingTimeMs: 0
        };

        try {
            // Get all records for cleanup
            const allRecords = await this.findSectorsItems();
            result.recordsProcessed = allRecords.length;

            // Process in batches
            for (let i = 0; i < allRecords.length; i += batchSize) {
                const batch = allRecords.slice(i, i + batchSize);
                
                for (const record of batch) {
                    try {
                        let needsUpdate = false;
                        let newItemsBuffer = record.getItems();
                        
                        // Check for empty records
                        if (!record.hasItems()) {
                            // Could delete empty records or leave them
                            result.emptyRecordsCleaned++;
                            continue;
                        }
                        
                        // Check for data validation issues
                        if (!skipDataValidation && !record.isItemsDataValid()) {
                            // Try to fix corrupted data by truncating to valid size
                            const validSize = Math.floor(record.getItemsSize() / ITEM_RECORD_SIZE) * ITEM_RECORD_SIZE;
                            if (validSize !== record.getItemsSize() && validSize > 0) {
                                newItemsBuffer = record.getItems().slice(0, validSize);
                                needsUpdate = true;
                                result.corruptedRecordsFixed++;
                                
                                if (logOperations) {
                                    this.logger.info('Fixed corrupted data', {
                                        recordId: record.getId(),
                                        oldSize: record.getItemsSize(),
                                        newSize: validSize
                                    });
                                }
                            }
                        }
                        
                        // Apply updates if needed
                        if (needsUpdate) {
                            await this.update(record.getId(), {
                                ITEMS: newItemsBuffer
                            }, {
                                validateDataFormat: false,
                                preserveDataIntegrity: true
                            } as SectorsItemsUpdateOptions);
                            
                            result.recordsOptimized++;
                            result.spaceFreed += record.getItemsSize() - newItemsBuffer.length;
                        }
                        
                    } catch (error) {
                        result.errors.push({
                            recordId: record.getId() ?? -1,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }

        } catch (error) {
            result.errors.push({
                recordId: -1,
                error: error instanceof Error ? error.message : String(error)
            });
        }

        result.processingTimeMs = Date.now() - startTime;

        this.logger.info('Storage cleanup completed', {
            operation: 'cleanup-storage',
            result
        });

        return result;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total sectors items count
     */
    public async getTotalSectorsItemsCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as "total_count" FROM SECTORS_ITEMS';

        try {
            const result = await this.executeQuery(sql, []);
            return parseInt(result[0]?.total_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get total sectors items count', {
                operation: 'get-total-sectors-items-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    /**
     * Get total storage usage
     */
    public async getTotalStorageUsage(): Promise<{
        usedBytes: number;
        totalBytes: number;
        efficiency: number;
    }> {
        this.ensureInitialized();

        try {
            // Get all records and calculate storage usage in memory
            const allRecordsSql = 'SELECT ITEMS FROM SECTORS_ITEMS';
            const allRecordsResult = await this.executeQuery(allRecordsSql, []);
            
            let usedBytes = 0;
            const recordCount = allRecordsResult.length;
            
            for (const row of allRecordsResult) {
                const itemsBuffer = row.ITEMS as Buffer;
                usedBytes += itemsBuffer ? itemsBuffer.length : 0;
            }

            const totalBytes = recordCount * MAX_ITEMS_SIZE;
            const efficiency = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

            return {
                usedBytes,
                totalBytes,
                efficiency
            };
        } catch (error) {
            this.logger.error('Failed to get total storage usage', {
                operation: 'get-total-storage-usage',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getTotalStorageUsage', error, []);
        }
    }

    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================

    /**
     * Validate items data format
     */
    private validateItemsDataFormat(itemsBuffer: Buffer): boolean {
        if (!Buffer.isBuffer(itemsBuffer)) {
            return false;
        }

        // Basic validation: empty buffer is valid
        if (itemsBuffer.length === 0) {
            return true;
        }

        // Check if size is multiple of item record size (heuristic)
        if (itemsBuffer.length % ITEM_RECORD_SIZE !== 0) {
            return false;
        }

        // Additional validation could be added here based on known data format
        return true;
    }

    /**
     * Validate sector reference exists
     */
    private async validateSectorReference(sectorId: number): Promise<void> {
        // This would need a SectorsController or direct query to validate
        // For now, we'll do a basic existence check
        const sql = 'SELECT 1 FROM SECTORS WHERE ITEMS = ? LIMIT 1';
        const params = [sectorId];

        try {
            const result = await this.executeQuery(sql, params);
            if (result.length === 0) {
                this.logger.warn('Sector reference validation failed - sector may not exist', {
                    operation: 'validate-sector-reference',
                    sectorId
                });
            }
        } catch (error) {
            // Handle gracefully - sector table might not exist or be accessible
            this.logger.warn('Cannot validate sector reference', {
                operation: 'validate-sector-reference',
                sectorId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Resolve record by ID or other identifier
     */
    private async resolveRecord(identifier: any): Promise<SectorsItemsModel | null> {
        // If identifier is a number, try by ID
        if (typeof identifier === 'number') {
            return await this.findById(identifier);
        }

        // If identifier is a string that looks like a number, try parsing it
        if (typeof identifier === 'string' && /^\d+$/.test(identifier)) {
            const recordId = parseInt(identifier, 10);
            if (!isNaN(recordId)) {
                return await this.findById(recordId);
            }
        }

        return null;
    }

    /**
     * Clear sectors items-related caches
     */
    protected async clearSectorsItemsCaches(recordId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('sectors-items:*');
            
            if (recordId) {
                await this.cacheManager.clear(`SECTORS_ITEMS:by-id:${recordId}`);
                await this.cacheManager.clear(`sectors-items:by-sector:${recordId}`);
            }
        }
    }

    /**
     * Override cache clearing to include sectors items-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearSectorsItemsCaches();
    }
}