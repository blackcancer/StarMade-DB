/**
 * @fileoverview ID Gen Table Controller
 * 
 * Controller for managing ID generation sequences in the ID_GEN_TABLE.
 * Provides atomic operations for ID generation, sequence management, and thread-safe increments.
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
    type BaseControllerConfig
} from '../BaseController.js';
import { IdGenTableModel } from './IdGenTableModel.js';
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
 * Sequence initialization options
 */
export interface SequenceInitOptions {
    /** Starting value for the sequence */
    startValue?: number;
    /** Force reset if sequence already exists */
    forceReset?: boolean;
    /** Initialize with specific increment step */
    incrementStep?: number;
}

/**
 * Batch ID generation options
 */
export interface BatchIdOptions {
    /** Number of IDs to generate */
    count: number;
    /** Return generated IDs as array */
    returnIds?: boolean;
    /** Skip existence check for performance */
    skipExistenceCheck?: boolean;
}

/**
 * Sequence status information
 */
export interface SequenceStatus {
    /** Sequence identifier */
    id: string;
    /** Current next ID value */
    currentValue: number;
    /** Whether sequence exists */
    exists: boolean;
    /** Last update timestamp (if available) */
    lastUpdated?: Date;
}

/**
 * Atomic ID generation result
 */
export interface AtomicIdResult {
    /** Generated ID value */
    id: number;
    /** New sequence value after generation */
    newSequenceValue: number;
    /** Sequence identifier */
    sequenceId: string;
}

/**
 * Batch ID generation result
 */
export interface BatchIdResult {
    /** Starting ID value */
    startId: number;
    /** Ending ID value */
    endId: number;
    /** Array of generated IDs (if requested) */
    ids?: number[];
    /** Number of IDs generated */
    count: number;
    /** New sequence value after generation */
    newSequenceValue: number;
}

// =============================================================================
// ID GEN TABLE CONTROLLER
// =============================================================================

/**
 * Controller for ID_GEN_TABLE providing atomic ID generation and sequence management
 */
export class IdGenTableController extends BaseController<IdGenTableModel> {
    protected ModelClass: ModelConstructor<IdGenTableModel> = IdGenTableModel;
    protected controllerName = 'IdGenTableController';

    /**
     * Create a new ID generator controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: false, // Disable caching for sequence tables to ensure consistency
            enableTransactions: true, // Enable transactions for atomic operations
            ...config
        });
    }

    // =============================================================================
    // SEQUENCE MANAGEMENT
    // =============================================================================

    /**
     * Initialize a new sequence generator
     */
    public async initializeSequence(
        sequenceId: string,
        options: SequenceInitOptions = {}
    ): Promise<IdGenTableModel> {
        this.ensureInitialized();

        const { startValue = 0, forceReset = false, incrementStep = 1 } = options;

        this.logger.info('Initializing sequence', {
            operation: 'initialize-sequence',
            sequenceId,
            startValue,
            forceReset
        });

        // Check if sequence already exists
        const existing = await this.findById(sequenceId);
        
        if (existing && !forceReset) {
            throw new ConflictError(
                `Sequence '${sequenceId}' already exists. Use forceReset=true to reinitialize.`,
                { sequenceId, currentValue: existing.getIdGen() }
            );
        }

        if (existing && forceReset) {
            // Update existing sequence
            return await this.update(sequenceId, { ID_GEN: startValue }, {
                skipValidation: false,
                returnRecord: true
            });
        } else {
            // Create new sequence
            return await this.create({
                ID: sequenceId,
                ID_GEN: startValue
            }, {
                skipValidation: false,
                returnRecord: true
            });
        }
    }

    /**
     * Safe conversion of database values to numbers
     */
    private parseNumber(value: any): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    /**
     * Get the current status of a sequence
     */
    public async getSequenceStatus(sequenceId: string): Promise<SequenceStatus> {
        this.ensureInitialized();

        const sequence = await this.findById(sequenceId);

        return {
            id: sequenceId,
            currentValue: sequence ? this.parseNumber(sequence.getIdGen()) : 0,
            exists: !!sequence,
            lastUpdated: sequence ? new Date() : undefined
        };
    }

    /**
     * List all available sequences
     */
    public async listSequences(options: QueryOptions = {}): Promise<SequenceStatus[]> {
        this.ensureInitialized();

        const sequences = await this.findMany(options);

        return sequences.map(seq => ({
            id: seq.getId(),
            currentValue: this.parseNumber(seq.getIdGen()),
            exists: true,
            lastUpdated: new Date()
        }));
    }

    /**
     * Delete a sequence generator
     */
    public async deleteSequence(sequenceId: string): Promise<boolean> {
        this.ensureInitialized();

        this.logger.warn('Deleting sequence', {
            operation: 'delete-sequence',
            sequenceId
        });

        return await this.delete(sequenceId);
    }

    // =============================================================================
    // ATOMIC ID GENERATION
    // =============================================================================

    /**
     * Generate a single ID atomically
     */
    public async generateId(sequenceId: string): Promise<AtomicIdResult> {
        this.ensureInitialized();

        // Try atomic SQL first (with RETURNING clause)
        try {
            const sql = `
                UPDATE ID_GEN_TABLE 
                SET ID_GEN = ID_GEN + 1 
                WHERE ID = ? 
                RETURNING ID_GEN - 1 as generated_id, ID_GEN as new_value
            `;

            const result = await this.executeQuery(sql, [sequenceId]);

            if (result.length === 0) {
                throw new ValidationError(
                    'sequenceId',
                    sequenceId,
                    `Sequence '${sequenceId}' not found. Initialize it first.`
                );
            }

            const row = result[0];
            const generatedId = this.parseNumber(row.generated_id || row.GENERATED_ID);
            const newValue = this.parseNumber(row.new_value || row.NEW_VALUE);

            this.logger.debug('ID generated atomically', {
                operation: 'generate-id',
                sequenceId,
                generatedId,
                newValue
            });

            return {
                id: generatedId,
                newSequenceValue: newValue,
                sequenceId
            };
        } catch (error) {
            // Fallback to optimized atomic UPDATE without RETURNING
            return await this.generateIdFallbackAtomic(sequenceId);
        }
    }

    /**
     * Atomic fallback ID generation method using single UPDATE
     */
    private async generateIdFallbackAtomic(sequenceId: string): Promise<AtomicIdResult> {
        // Use a more atomic approach with HSQLDB compatible SQL
        const updateSql = `UPDATE ID_GEN_TABLE SET ID_GEN = ID_GEN + 1 WHERE ID = ?`;
        const selectSql = `SELECT ID_GEN FROM ID_GEN_TABLE WHERE ID = ?`;

        try {
            // First, increment atomically
            await this.executeQuery(updateSql, [sequenceId]);
            
            // Then get the new value
            const result = await this.executeQuery(selectSql, [sequenceId]);
            
            if (result.length === 0) {
                throw new ValidationError(
                    'sequenceId',
                    sequenceId,
                    `Sequence '${sequenceId}' not found. Initialize it first.`
                );
            }

            const newValue = this.parseNumber(result[0].ID_GEN);
            const generatedId = newValue - 1;

            this.logger.debug('ID generated (atomic fallback)', {
                operation: 'generate-id-atomic-fallback',
                sequenceId,
                generatedId,
                newValue
            });

            return {
                id: generatedId,
                newSequenceValue: newValue,
                sequenceId
            };
        } catch (error) {
            // Final fallback with retry mechanism for high concurrency
            return await this.generateIdWithRetry(sequenceId, 3);
        }
    }

    /**
     * ID generation with retry mechanism for high concurrency scenarios
     */
    private async generateIdWithRetry(sequenceId: string, maxRetries: number): Promise<AtomicIdResult> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Get current value
                const sequence = await this.findById(sequenceId);
                
                if (!sequence) {
                    throw new ValidationError(
                        'sequenceId',
                        sequenceId,
                        `Sequence '${sequenceId}' not found. Initialize it first.`
                    );
                }

                const currentValue = this.parseNumber(sequence.getIdGen());
                const newValue = currentValue + 1;

                // Try to update with WHERE clause including the current value (optimistic locking)
                const updateSql = `UPDATE ID_GEN_TABLE SET ID_GEN = ? WHERE ID = ? AND ID_GEN = ?`;
                await this.executeQuery(updateSql, [newValue, sequenceId, currentValue]);

                // Verify the update actually happened by checking the new value
                const verifySequence = await this.findById(sequenceId);
                const verifiedValue = verifySequence ? this.parseNumber(verifySequence.getIdGen()) : 0;

                if (verifiedValue === newValue) {
                    // Update succeeded
                    this.logger.debug('ID generated (retry method)', {
                        operation: 'generate-id-retry',
                        sequenceId,
                        generatedId: currentValue,
                        newValue,
                        attempt: attempt + 1
                    });

                    return {
                        id: currentValue,
                        newSequenceValue: newValue,
                        sequenceId
                    };
                } else {
                    // Someone else updated, try again
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 1)); // Small random delay
                        continue;
                    }
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 1)); // Small random delay
                    continue;
                }
            }
        }

        throw lastError || new Error(`Failed to generate ID after ${maxRetries} attempts`);
    }

    /**
     * Generate multiple IDs in a batch
     */
    public async generateBatchIds(
        sequenceId: string,
        options: BatchIdOptions
    ): Promise<BatchIdResult> {
        this.ensureInitialized();

        const { count, returnIds = false, skipExistenceCheck = false } = options;

        if (count <= 0) {
            throw new ValidationError('count', count, 'Count must be greater than 0');
        }

        if (count > 10000) {
            throw new ValidationError('count', count, 'Count cannot exceed 10000 for performance reasons');
        }

        this.logger.info('Generating batch IDs', {
            operation: 'generate-batch-ids',
            sequenceId,
            count
        });

        // Try atomic SQL first
        try {
            const sql = `
                UPDATE ID_GEN_TABLE 
                SET ID_GEN = ID_GEN + ? 
                WHERE ID = ? 
                RETURNING ID_GEN - ? as start_id, ID_GEN as new_value
            `;

            const result = await this.executeQuery(sql, [count, sequenceId, count]);

            if (result.length === 0) {
                throw new ValidationError(
                    'sequenceId',
                    sequenceId,
                    `Sequence '${sequenceId}' not found. Initialize it first.`
                );
            }

            const row = result[0];
            const startId = this.parseNumber(row.start_id || row.START_ID);
            const newValue = this.parseNumber(row.new_value || row.NEW_VALUE);
            const endId = startId + count - 1;

            const result_obj: BatchIdResult = {
                startId,
                endId,
                count,
                newSequenceValue: newValue
            };

            if (returnIds) {
                result_obj.ids = [];
                for (let i = startId; i <= endId; i++) {
                    result_obj.ids.push(i);
                }
            }

            this.logger.debug('Batch IDs generated', {
                operation: 'generate-batch-ids',
                sequenceId,
                startId,
                endId,
                count,
                newValue
            });

            return result_obj;
        } catch (error) {
            // Fallback to atomic batch generation
            return await this.generateBatchIdsFallbackAtomic(sequenceId, options);
        }
    }

    /**
     * Atomic fallback batch ID generation method
     */
    private async generateBatchIdsFallbackAtomic(
        sequenceId: string,
        options: BatchIdOptions
    ): Promise<BatchIdResult> {
        const { count, returnIds = false } = options;

        // Use optimistic locking approach for batch generation
        let lastError: Error | null = null;
        const maxRetries = 3;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const sequence = await this.findById(sequenceId);
                
                if (!sequence) {
                    throw new ValidationError(
                        'sequenceId',
                        sequenceId,
                        `Sequence '${sequenceId}' not found. Initialize it first.`
                    );
                }

                const startId = this.parseNumber(sequence.getIdGen());
                const endId = startId + count - 1;
                const newValue = startId + count;

                // Try to update with WHERE clause including the current value (optimistic locking)
                const updateSql = `UPDATE ID_GEN_TABLE SET ID_GEN = ? WHERE ID = ? AND ID_GEN = ?`;
                await this.executeQuery(updateSql, [newValue, sequenceId, startId]);

                // Verify the update actually happened
                const verifySequence = await this.findById(sequenceId);
                const verifiedValue = verifySequence ? this.parseNumber(verifySequence.getIdGen()) : 0;

                if (verifiedValue === newValue) {
                    const result_obj: BatchIdResult = {
                        startId,
                        endId,
                        count,
                        newSequenceValue: newValue
                    };

                    if (returnIds) {
                        result_obj.ids = [];
                        for (let i = startId; i <= endId; i++) {
                            result_obj.ids.push(i);
                        }
                    }

                    this.logger.debug('Batch IDs generated (atomic fallback)', {
                        operation: 'generate-batch-ids-atomic-fallback',
                        sequenceId,
                        startId,
                        endId,
                        count,
                        newValue,
                        attempt: attempt + 1
                    });

                    return result_obj;
                } else {
                    // Someone else updated, try again
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 1));
                        continue;
                    }
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 1));
                    continue;
                }
            }
        }

        throw lastError || new Error(`Failed to generate batch IDs after ${maxRetries} attempts`);
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Reset a sequence to a specific value
     */
    public async resetSequence(sequenceId: string, newValue: number): Promise<IdGenTableModel> {
        this.ensureInitialized();

        if (newValue < 0) {
            throw new ValidationError('newValue', newValue, 'New value cannot be negative');
        }

        this.logger.warn('Resetting sequence value', {
            operation: 'reset-sequence',
            sequenceId,
            newValue
        });

        return await this.update(sequenceId, { ID_GEN: newValue }, {
            returnRecord: true
        });
    }

    /**
     * Increment sequence by a specific amount
     */
    public async incrementSequence(sequenceId: string, incrementBy: number = 1): Promise<IdGenTableModel> {
        this.ensureInitialized();

        const sequence = await this.findById(sequenceId);
        
        if (!sequence) {
            throw new ValidationError(
                'sequenceId',
                sequenceId,
                `Sequence '${sequenceId}' not found. Initialize it first.`
            );
        }

        const currentValue = this.parseNumber(sequence.getIdGen());
        const newValue = currentValue + incrementBy;

        if (newValue < 0) {
            throw new ValidationError(
                'incrementBy',
                incrementBy,
                `Increment would result in negative value: ${newValue}`
            );
        }

        this.logger.debug('Incrementing sequence', {
            operation: 'increment-sequence',
            sequenceId,
            incrementBy,
            oldValue: currentValue,
            newValue
        });

        return await this.update(sequenceId, { ID_GEN: newValue }, {
            returnRecord: true
        });
    }

    /**
     * Get the next ID value without consuming it
     */
    public async peekNextId(sequenceId: string): Promise<number> {
        this.ensureInitialized();

        const sequence = await this.findById(sequenceId);
        
        if (!sequence) {
            throw new ValidationError(
                'sequenceId',
                sequenceId,
                `Sequence '${sequenceId}' not found. Initialize it first.`
            );
        }

        return this.parseNumber(sequence.getIdGen());
    }

    /**
     * Check if a sequence exists
     */
    public async sequenceExists(sequenceId: string): Promise<boolean> {
        this.ensureInitialized();

        const sequence = await this.findById(sequenceId);
        return !!sequence;
    }

    // =============================================================================
    // SPECIALIZED SEQUENCES
    // =============================================================================

    /**
     * Get the next mine ID
     */
    public async getNextMineId(): Promise<number> {
        await this.ensureSequenceExists('MINE_GEN', 1);
        const result = await this.generateId('MINE_GEN');
        return result.id;
    }

    /**
     * Ensure a sequence exists, creating it if necessary
     */
    private async ensureSequenceExists(sequenceId: string, startValue: number): Promise<void> {
        const exists = await this.sequenceExists(sequenceId);
        if (!exists) {
            await this.initializeSequence(sequenceId, { startValue });
            this.logger.info('Auto-created sequence', {
                operation: 'ensure-sequence-exists',
                sequenceId,
                startValue
            });
        }
    }
}