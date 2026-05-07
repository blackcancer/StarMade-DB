/**
 * @fileoverview Base Controller System for StarMade Database Tables
 * 
 * Provides a base class for all database controllers with CRUD operations,
 * transaction management, and database query execution capabilities.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    ModuleNotInitializedError,
    QueryExecutionError,
    ValidationError,
    ErrorFactory,
    SQLRequiredFieldError,
    SQLConstraintViolationError
} from '../core/errors.js';
import { createModuleLogger, type ModuleLogger } from '../core/modules/logging/Logger.js';
import type { HSQLManager } from '../core/HSQLManager.js';
import type { ParameterizedQuery } from '../core/modules/query/ParameterizedQuery.js';
import type { CacheManager } from '../core/modules/cache/CacheManager.js';
import type { BaseModel, ValidationResult, TableSchema, ForeignKeyDefinition } from './BaseModel.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Model constructor type with static methods
 */
export interface ModelConstructor<T extends BaseModel> {
    new (data?: any): T;
    getTableName(): string;
    getSchema(): TableSchema;
    getPrimaryKeyColumns(): string[];
    getForeignKeys(): ForeignKeyDefinition[];
    fromRow(row: Record<string, any>): T;
    fromRows(rows: Record<string, any>[]): T[];
}

/**
 * Query options for database operations
 */
export interface QueryOptions {
    /** Maximum number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
    /** Sort order */
    orderBy?: string;
    /** Sort direction */
    orderDirection?: 'ASC' | 'DESC';
    /** Include inactive/soft-deleted records */
    includeInactive?: boolean;
    /** Cache TTL in milliseconds */
    cacheTtl?: number;
    /** Skip cache */
    skipCache?: boolean;
}

/**
 * Create options for new records
 */
export interface CreateOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Skip foreign key validation */
    skipForeignKeyValidation?: boolean;
    /** Return created record */
    returnRecord?: boolean;
}

/**
 * Update options for existing records
 */
export interface UpdateOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Skip foreign key validation */
    skipForeignKeyValidation?: boolean;
    /** Allow updating immutable fields */
    allowImmutableUpdates?: boolean;
    /** Skip existence check */
    skipExistenceCheck?: boolean;
    /** Return updated record */
    returnRecord?: boolean;
}

/**
 * Delete options for records
 */
export interface DeleteOptions {
    /** Force delete even with dependencies */
    forceDelete?: boolean;
    /** Handle dependent records */
    handleDependents?: 'restrict' | 'cascade' | 'setNull';
    /** Soft delete (if supported) */
    softDelete?: boolean;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
    /** Number of successful operations */
    success: number;
    /** Number of failed operations */
    failed: number;
    /** Number of skipped operations */
    skipped: number;
    /** Errors encountered */
    errors: Array<{ index: number; error: string; data?: any }>;
}

/**
 * Controller configuration
 */
export interface BaseControllerConfig {
    /** Enable caching */
    enableCaching?: boolean;
    /** Default cache TTL */
    cacheTtlMs?: number;
    /** Query timeout */
    queryTimeoutMs?: number;
    /** Maximum results per query */
    maxResults?: number;
    /** Enable foreign key validation */
    enableForeignKeyValidation?: boolean;
    /** Enable transaction support */
    enableTransactions?: boolean;
}

/**
 * Default controller configuration
 */
const DEFAULT_CONTROLLER_CONFIG: Required<BaseControllerConfig> = {
    enableCaching: true,
    cacheTtlMs: 300000, // 5 minutes
    queryTimeoutMs: 30000, // 30 seconds
    maxResults: 1000,
    enableForeignKeyValidation: true,
    enableTransactions: false
};

// =============================================================================
// BASE CONTROLLER CLASS
// =============================================================================

/**
 * Base controller class providing database operations for models
 */
export abstract class BaseController<TModel extends BaseModel> {
    /**
     * The model class this controller manages
     */
    protected abstract ModelClass: ModelConstructor<TModel>;

    /**
     * Controller name for logging
     */
    protected abstract controllerName: string;

    /**
     * HSQLManager instance
     */
    protected manager!: HSQLManager;

    /**
     * Logger instance
     */
    protected logger!: ModuleLogger;

    /**
     * Configuration
     */
    protected config: Required<BaseControllerConfig>;

    /**
     * ParameterizedQuery module
     */
    protected parameterizedQuery?: ParameterizedQuery;

    /**
     * CacheManager module
     */
    protected cacheManager?: CacheManager;

    /**
     * Whether controller is initialized
     */
    private initialized = false;

    /**
     * Create a new controller instance
     */
    constructor(config: BaseControllerConfig = {}) {
        this.config = { ...DEFAULT_CONTROLLER_CONFIG, ...config };
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    /**
     * Initialize the controller with HSQLManager
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this.initialized) {
            throw new Error(`Controller ${this.controllerName} already initialized`);
        }

        this.manager = manager;
        this.logger = createModuleLogger(this.controllerName);

        // Get optional modules
        this.parameterizedQuery = manager.getModule<ParameterizedQuery>('parameterized-query');
        this.cacheManager = manager.getModule<CacheManager>('cache-manager');

        this.logger.info(`${this.controllerName} initialized`, {
            operation: 'initialize',
            config: this.config,
            hasParameterizedQuery: !!this.parameterizedQuery,
            hasCacheManager: !!this.cacheManager
        });

        this.initialized = true;
    }

    /**
     * Ensure controller is initialized
     */
    protected ensureInitialized(): void {
        if (!this.initialized) {
            throw new ModuleNotInitializedError(this.controllerName, 'operation');
        }
    }

    // =============================================================================
    // BASIC CRUD OPERATIONS
    // =============================================================================

    /**
     * Find a record by primary key
     */
    public async findById(id: any): Promise<TModel | null> {
        this.ensureInitialized();

        const schema = this.ModelClass.getSchema();
        const pkColumns = schema.primaryKey;
        const tableName = schema.tableName;

        // Build cache key
        const cacheKey = `${tableName}:by-id:${JSON.stringify(id)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('Record retrieved from cache', {
                    operation: 'find-by-id',
                    tableName,
                    id
                });
                return this.ModelClass.fromRow(cached);
            }
        }

        // Build WHERE clause for primary key
        let whereClause: string;
        let params: any[];

        if (pkColumns.length === 1) {
            // Single primary key
            whereClause = `${pkColumns[0]} = ?`;
            params = [id];
        } else {
            // Composite primary key
            if (typeof id !== 'object') {
                throw new ValidationError('id', id, 'Composite primary key requires object with all key fields');
            }
            whereClause = pkColumns.map((col: string) => `${col} = ?`).join(' AND ');
            params = pkColumns.map((col: string) => id[col]);
        }

        const sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;

        try {
            const result = await this.executeQuery(sql, params);
            const record = result.length > 0 ? this.ModelClass.fromRow(result[0]) : null;

            // Cache result
            if (record && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, record.getData(), {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('Record retrieved by ID', {
                operation: 'find-by-id',
                tableName,
                id,
                found: !!record
            });

            return record;
        } catch (error) {
            this.logger.error('Failed to find record by ID', {
                operation: 'find-by-id',
                tableName,
                id,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find multiple records
     */
    public async findMany(options: QueryOptions = {}): Promise<TModel[]> {
        this.ensureInitialized();

        const schema = this.ModelClass.getSchema();
        const tableName = schema.tableName;

        const {
            limit = this.config.maxResults,
            offset = 0,
            orderBy,
            orderDirection = 'ASC',
            includeInactive = false,
            cacheTtl = this.config.cacheTtlMs,
            skipCache = false
        } = options;

        // Build cache key
        const cacheKey = `${tableName}:find-many:${JSON.stringify(options)}`;

        // Try cache first
        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Records retrieved from cache', {
                    operation: 'find-many',
                    tableName,
                    count: cached.length
                });
                return this.ModelClass.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = `SELECT * FROM ${tableName}`;
        const params: any[] = [];

        // Add WHERE clause if needed
        if (!includeInactive) {
            // This can be overridden by subclasses for soft delete support
            const activeCondition = this.buildActiveCondition();
            if (activeCondition) {
                sql += ` WHERE ${activeCondition.clause}`;
                params.push(...activeCondition.params);
            }
        }

        // Add ORDER BY
        if (orderBy) {
            sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        }

        // Add LIMIT and OFFSET
        if (limit > 0) {
            sql += ` LIMIT ?`;
            params.push(limit);
        }
        if (offset > 0) {
            sql += ` OFFSET ?`;
            params.push(offset);
        }

        try {
            const result = await this.executeQuery(sql, params);
            const records = this.ModelClass.fromRows(result);

            // Cache result
            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result, { ttl: cacheTtl });
            }

            this.logger.debug('Records retrieved', {
                operation: 'find-many',
                tableName,
                count: records.length,
                options
            });

            return records;
        } catch (error) {
            this.logger.error('Failed to find records', {
                operation: 'find-many',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Create a new record
     */
    public async create(data: Partial<Record<string, any>>, options: CreateOptions = {}): Promise<TModel> {
        this.ensureInitialized();

        const {
            skipValidation = false,
            skipForeignKeyValidation = false,
            returnRecord = true
        } = options;

        // Create model instance
        const model = new this.ModelClass(data);

        // Validate model
        if (!skipValidation) {
            const validation = model.validate();
            if (!validation.isValid) {
                throw new SQLRequiredFieldError(
                    this.ModelClass.getTableName(),
                    'INSERT',
                    Object.keys(validation.fieldErrors),
                    data,
                    {
                        operation: 'create',
                        validationErrors: validation.fieldErrors
                    }
                );
            }
        }

        // Validate foreign keys
        if (!skipForeignKeyValidation && this.config.enableForeignKeyValidation) {
            await this.validateForeignKeyReferences(model);
        }

        const schema = this.ModelClass.getSchema();
        const tableName = schema.tableName;

        // Build INSERT query
        const modelData = model.getData();
        const columns = Object.keys(modelData).filter(key => modelData[key] !== undefined);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(col => modelData[col]);

        const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

        try {
            const result = await this.executeQuery(sql, values);

            // Clear caches
            if (this.cacheManager && this.config.enableCaching) {
                await this.clearCachesForTable(tableName);
            }

            if (returnRecord) {
                // For auto-increment columns, try to get the generated ID
                const pkColumns = schema.primaryKey;
                const autoIncrementColumn = schema.columns.find(col => col.autoIncrement);
                
                this.logger.debug('Auto-increment detection', {
                    operation: 'create',
                    tableName,
                    pkColumns,
                    autoIncrementColumn: autoIncrementColumn ? {
                        name: autoIncrementColumn.name,
                        autoIncrement: autoIncrementColumn.autoIncrement
                    } : null,
                    isPkAutoIncrement: autoIncrementColumn && pkColumns.includes(autoIncrementColumn.name)
                });
                
                if (autoIncrementColumn && pkColumns.includes(autoIncrementColumn.name)) {
                    // Try to get the last inserted ID for auto-increment primary keys
                    try {
                        // HSQLDB uses CALL IDENTITY() function to get the last generated ID
                        const identityResult = await this.executeQuery("SELECT IDENTITY() FROM (VALUES(0)) t(x)", []);
                        
                        this.logger.debug('Identity query result', {
                            operation: 'create-identity-debug',
                            tableName,
                            identityResult,
                            autoIncrementColumn: autoIncrementColumn.name
                        });
                        
                        if (identityResult.length > 0) {
                            // HSQLDB may return IDENTITY() under different key names
                            const identityRow = identityResult[0];
                            const rawId = identityRow['IDENTITY()'] ?? identityRow['@p0'] ?? identityRow['C1'] ?? Object.values(identityRow)[0];
                            if (rawId !== null && rawId !== undefined) {
                                const generatedId = Number(rawId);
                                
                                // Update model with generated ID
                                model.set(autoIncrementColumn.name, generatedId);
                                model.markAsSaved();

                                this.logger.info('Record created successfully with auto-generated ID', {
                                    operation: 'create',
                                    tableName,
                                    generatedId,
                                    autoIncrementColumn: autoIncrementColumn.name
                                });

                                return model;
                            }
                        }
                    } catch (identityError) {
                        this.logger.warn('Failed to retrieve auto-generated ID with CALL IDENTITY(), trying SELECT IDENTITY()', {
                            operation: 'create',
                            tableName,
                            error: identityError instanceof Error ? identityError.message : String(identityError)
                        });
                        
                        // Fallback to SELECT IDENTITY()
                        try {
                            const fallbackResult = await this.executeQuery("SELECT IDENTITY() AS generated_id FROM (VALUES(0)) t(x)", []);
                            
                            this.logger.debug('Fallback identity query result', {
                                operation: 'create-identity-fallback',
                                tableName,
                                fallbackResult,
                                autoIncrementColumn: autoIncrementColumn.name
                            });
                            
                            if (fallbackResult.length > 0) {
                                const fallbackRow = fallbackResult[0];
                                const fallbackRaw = fallbackRow.generated_id ?? fallbackRow['@p0'] ?? fallbackRow['C1'] ?? Object.values(fallbackRow)[0];
                                const generatedId = fallbackRaw !== null && fallbackRaw !== undefined ? Number(fallbackRaw) : null;
                                
                                // Update model with generated ID
                                model.set(autoIncrementColumn.name, generatedId);
                                model.markAsSaved();

                                this.logger.info('Record created successfully with auto-generated ID (fallback)', {
                                    operation: 'create',
                                    tableName,
                                    generatedId,
                                    autoIncrementColumn: autoIncrementColumn.name
                                });

                                return model;
                            }
                        } catch (fallbackError) {
                            this.logger.warn('Both IDENTITY() methods failed', {
                                operation: 'create',
                                tableName,
                                error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                            });
                        }
                    }
                }

                // Fallback: Try to find the record by primary key if it was provided
                const pkValue = model.getPrimaryKeyValue();
                if (pkValue) {
                    const created = await this.findById(pkValue);
                    if (created) {
                        this.logger.info('Record created successfully', {
                            operation: 'create',
                            tableName,
                            id: pkValue
                        });
                        return created;
                    }
                }
            }

            model.markAsSaved();
            this.logger.info('Record created successfully', {
                operation: 'create',
                tableName
            });

            return model;
        } catch (error) {
            this.logger.error('Failed to create record', {
                operation: 'create',
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });

            // Check for constraint violations
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (errorMessage.includes('foreign key') ||
                    errorMessage.includes('integrity constraint') ||
                    errorMessage.includes('constraint violation')) {
                    throw ErrorFactory.createSQLConstraintError(sql, error, tableName, modelData);
                }
            }

            throw ErrorFactory.createQueryError(sql, error, values);
        }
    }

    /**
     * Update an existing record
     */
    public async update(id: any, data: Partial<Record<string, any>>, options: UpdateOptions = {}): Promise<TModel> {
        this.ensureInitialized();

        const {
            skipValidation = false,
            skipForeignKeyValidation = false,
            allowImmutableUpdates = false,
            skipExistenceCheck = false,
            returnRecord = true
        } = options;

        // Check if record exists
        let existingRecord: TModel | null = null;
        if (!skipExistenceCheck) {
            existingRecord = await this.findById(id);
            if (!existingRecord) {
                throw new ValidationError('id', id, `Record with ID ${JSON.stringify(id)} not found`);
            }
        }

        // Create updated model
        const currentData = existingRecord ? existingRecord.getData() : {};
        const updatedModel = new this.ModelClass({ ...currentData, ...data });

        // Validate model
        if (!skipValidation) {
            const validation = updatedModel.validate();
            if (!validation.isValid) {
                throw new ValidationError('data', data, `Validation failed: ${Object.values(validation.fieldErrors).flat().join(', ')}`);
            }
        }

        // Validate foreign keys
        if (!skipForeignKeyValidation && this.config.enableForeignKeyValidation) {
            await this.validateForeignKeyReferences(updatedModel);
        }

        const schema = this.ModelClass.getSchema();
        const tableName = schema.tableName;
        const pkColumns = schema.primaryKey;

        // Build UPDATE query
        const updateFields = Object.keys(data).filter(key => data[key] !== undefined);
        const setClause = updateFields.map(field => `${field} = ?`).join(', ');
        const whereClause = pkColumns.map((col: string) => `${col} = ?`).join(' AND ');

        const updateValues = updateFields.map(field => data[field]);
        const whereValues = typeof id === 'object' ? pkColumns.map((col: string) => id[col]) : [id];

        const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
        const params = [...updateValues, ...whereValues];

        try {
            await this.executeQuery(sql, params);

            // Clear caches
            if (this.cacheManager && this.config.enableCaching) {
                await this.clearCachesForTable(tableName);
            }

            if (returnRecord) {
                const updated = await this.findById(id);
                if (updated) {
                    this.logger.info('Record updated successfully', {
                        operation: 'update',
                        tableName,
                        id,
                        updatedFields: updateFields.length
                    });
                    return updated;
                }
            }

            updatedModel.markAsSaved();
            this.logger.info('Record updated successfully', {
                operation: 'update',
                tableName,
                id,
                updatedFields: updateFields.length
            });

            return updatedModel;
        } catch (error) {
            this.logger.error('Failed to update record', {
                operation: 'update',
                tableName,
                id,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Delete a record
     */
    public async delete(id: any, options: DeleteOptions = {}): Promise<boolean> {
        this.ensureInitialized();

        const { forceDelete = false, handleDependents = 'restrict', softDelete = false } = options;

        const schema = this.ModelClass.getSchema();
        const tableName = schema.tableName;
        const pkColumns = schema.primaryKey;

        // Check if record exists
        const existingRecord = await this.findById(id);
        if (!existingRecord) {
            return false; // Already doesn't exist
        }

        // Check for dependencies if not forcing delete
        if (!forceDelete) {
            await this.checkAndHandleDependencies(existingRecord, handleDependents);
        }

        // Build DELETE query
        const whereClause = pkColumns.map((col: string) => `${col} = ?`).join(' AND ');
        const whereValues = typeof id === 'object' ? pkColumns.map((col: string) => id[col]) : [id];

        const sql = softDelete && this.supportsSoftDelete() ?
            `UPDATE ${tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE ${whereClause}` :
            `DELETE FROM ${tableName} WHERE ${whereClause}`;

        try {
            await this.executeQuery(sql, whereValues);

            // Clear caches
            if (this.cacheManager && this.config.enableCaching) {
                await this.clearCachesForTable(tableName);
            }

            this.logger.info('Record deleted successfully', {
                operation: 'delete',
                tableName,
                id,
                softDelete
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to delete record', {
                operation: 'delete',
                tableName,
                id,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, whereValues);
        }
    }

    // =============================================================================
    // VALIDATION METHODS
    // =============================================================================

    /**
     * Validate foreign key references for a model
     */
    protected async validateForeignKeyReferences(model: TModel): Promise<void> {
        const schema = this.ModelClass.getSchema();
        const foreignKeys = schema.foreignKeys;

        for (const fk of foreignKeys) {
            await this.validateSingleForeignKey(model, fk);
        }
    }

    /**
     * Validate a single foreign key reference
     */
    protected async validateSingleForeignKey(model: TModel, fk: ForeignKeyDefinition): Promise<void> {
        const modelData = model.getData();

        // Check if foreign key fields have values
        const fkValues = fk.columns.map(col => modelData[col]);
        const hasValues = fkValues.some(val => val !== null && val !== undefined);

        if (!hasValues) {
            this.logger.debug('Skipping FK validation - no values', {
                operation: 'validate-foreign-key-no-values',
                tableName: this.ModelClass.getTableName(),
                fkName: fk.name,
                columns: fk.columns,
                values: fkValues
            });
            return; // No values to validate
        }

        // Check for sentinel values that indicate "no reference"
        // These are special values that mean "not linked" rather than actual foreign key values
        const hasSentinelValues = fkValues.some(val => {
            // -1 is a universal StarMade sentinel meaning "no reference" / "no parent"
            if (val == -1) return true;
            // For ENTITIES table docking references, -1 means "not docked"
            if (fk.referencedTable === 'ENTITIES') {
                return val == -1;
            }
            return false;
        });

        if (hasSentinelValues) {
            this.logger.debug('Skipping FK validation for sentinel values', {
                operation: 'validate-foreign-key-sentinel',
                tableName: this.ModelClass.getTableName(),
                fkName: fk.name,
                columns: fk.columns,
                values: fkValues,
                referencedTable: fk.referencedTable
            });
            return; // Sentinel values don't need foreign key validation
        }

        // Build validation query
        const whereClause = fk.referencedColumns.map((col, index) => `${col} = ?`).join(' AND ');
        const sql = `SELECT TOP 1 1 FROM ${fk.referencedTable} WHERE ${whereClause}`;

        try {
            const result = await this.executeQuery(sql, fkValues);
            if (result.length === 0) {
                throw new ValidationError(
                    fk.columns.join(','),
                    fkValues,
                    `Foreign key constraint ${fk.name} violated: referenced record not found in ${fk.referencedTable}`
                );
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }

            // Handle missing table gracefully
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.toLowerCase().includes('table') &&
                errorMessage.toLowerCase().includes('not found')) {
                this.logger.warn('Cannot validate foreign key - referenced table may not exist', {
                    operation: 'validate-foreign-key',
                    table: fk.referencedTable,
                    error: errorMessage
                });
                return;
            }

            throw error;
        }
    }

    // =============================================================================
    // HELPER METHODS
    // =============================================================================

    /**
     * Execute a database query
     */
    protected async executeQuery(sql: string, params: any[]): Promise<any[]> {
        if (this.parameterizedQuery) {
            const result = await this.parameterizedQuery.execute(sql, params);

            if (result && result.success && result.rows) {
                // Convert to object format
                const objects = [];
                const columns = result.columns || [];

                for (const row of result.rows) {
                    const obj: any = {};
                    for (let i = 0; i < columns.length; i++) {
                        obj[columns[i].name] = row[i];
                    }
                    objects.push(obj);
                }

                return objects;
            }

            return Array.isArray(result) ? result : [];
        } else {
            throw new Error('ParameterizedQuery module not available');
        }
    }

    /**
     * Build active condition for records (override for soft delete support)
     */
    protected buildActiveCondition(): { clause: string; params: any[] } | null {
        return null; // No soft delete by default
    }

    /**
     * Check if model supports soft delete
     */
    protected supportsSoftDelete(): boolean {
        return false; // Override in subclasses
    }

    /**
     * Check and handle dependencies before delete
     */
    protected async checkAndHandleDependencies(record: TModel, handleDependents: string): Promise<void> {
        // Override in subclasses to implement dependency checking
        // This is a placeholder for the base implementation
    }

    /**
     * Clear caches for a table
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear(`${tableName}:*`);
        }
    }
}