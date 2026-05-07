/**
 * @fileoverview Player Messages Controller
 *
 * Controller for managing in-game player messages in the PLAYER_MESSAGES table.
 * Provides messaging lifecycle management, read-state tracking, and inbox analytics.
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
import { PlayerMessagesModel } from './PlayerMessagesModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for player message records
 */
export interface PlayerMessageSearchOptions extends QueryOptions {
    /** Filter by sender name */
    sender?: string;
    /** Filter by receiver name */
    receiver?: string;
    /** Filter by read status */
    isRead?: boolean;
    /** Filter messages sent after this timestamp (epoch ms) */
    sentAfter?: number;
    /** Filter messages sent before this timestamp (epoch ms) */
    sentBefore?: number;
    /** Search term in topic or message body */
    searchTerm?: string;
    /** Filter messages with an attachment */
    hasAttachment?: boolean;
}

/**
 * Player message creation options
 */
export interface PlayerMessageCreateOptions extends CreateOptions {
    /** Validate sender and receiver are different players */
    preventSelfMessage?: boolean;
    /** Validate string length limits */
    validateLengths?: boolean;
}

/**
 * Player message update options
 */
export interface PlayerMessageUpdateOptions extends UpdateOptions {
    /** Allow changing the read status */
    allowReadStatusChange?: boolean;
}

/**
 * Bulk message operation options
 */
export interface BulkMessageOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
}

/**
 * Player message statistics
 */
export interface PlayerMessageStatistics {
    /** Total messages */
    totalMessages: number;
    /** Unread messages */
    unreadMessages: number;
    /** Read messages */
    readMessages: number;
    /** Messages with attachments */
    withAttachments: number;
    /** Top senders */
    topSenders: Array<{ sender: string; count: number }>;
    /** Top receivers */
    topReceivers: Array<{ receiver: string; count: number }>;
}

// =============================================================================
// PLAYER MESSAGES CONTROLLER
// =============================================================================

/**
 * Controller for PLAYER_MESSAGES table with messaging lifecycle management
 */
export class PlayerMessagesController extends BaseController<PlayerMessagesModel> {
    protected ModelClass: ModelConstructor<PlayerMessagesModel> = PlayerMessagesModel;
    protected controllerName = 'PlayerMessagesController';

    /**
     * Create a new PlayerMessagesController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 60000, // 1 min – messages change frequently
            enableForeignKeyValidation: false,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a message exists by ID
     * @param {number} messageId - The message record ID
     * @returns {Promise<boolean>} True if the message exists
     * @throws {ErrorFactory} If the query fails
     */
    public async messageExistsById(messageId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM PLAYER_MESSAGES WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [messageId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check message existence', {
                operation: 'message-exists-by-id', messageId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [messageId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all player messages with filtering and pagination
     * @param {PlayerMessageSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<PlayerMessagesModel[]>} Array of matching message records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: PlayerMessageSearchOptions = {}): Promise<PlayerMessagesModel[]> {
        this.ensureInitialized();

        const {
            sender, receiver, isRead, sentAfter, sentBefore,
            searchTerm, hasAttachment,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'SENT',
            orderDirection = 'DESC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `PLAYER_MESSAGES:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return PlayerMessagesModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (sender !== undefined) { conditions.push('LOWER(SENDER) = ?'); params.push(sender.toLowerCase()); }
        if (receiver !== undefined) { conditions.push('LOWER(RECEIVER) = ?'); params.push(receiver.toLowerCase()); }
        if (isRead !== undefined) { conditions.push('READ = ?'); params.push(isRead); }
        if (sentAfter !== undefined) { conditions.push('SENT >= ?'); params.push(sentAfter); }
        if (sentBefore !== undefined) { conditions.push('SENT <= ?'); params.push(sentBefore); }
        if (hasAttachment !== undefined) {
            conditions.push(hasAttachment ? 'ATT_ID IS NOT NULL' : 'ATT_ID IS NULL');
        }
        if (searchTerm !== undefined) {
            conditions.push('(LOWER(TOPIC) LIKE ? OR LOWER(MESSAGE) LIKE ?)');
            params.push(`%${searchTerm.toLowerCase()}%`);
            params.push(`%${searchTerm.toLowerCase()}%`);
        }

        let sql = 'SELECT * FROM PLAYER_MESSAGES';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = PlayerMessagesModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Messages retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find messages', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single message by ID
     * @param {number} id - The message record ID
     * @returns {Promise<PlayerMessagesModel | null>} The message record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(id: number): Promise<PlayerMessagesModel | null> {
        return this.findById(id);
    }

    /**
     * Find all messages sent by a player (outbox)
     * @param {string} sender - Sender player name
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<PlayerMessagesModel[]>} Array of sent message records
     * @throws {ValidationError} If sender is empty
     */
    public async findBySender(sender: string, options: QueryOptions = {}): Promise<PlayerMessagesModel[]> {
        if (!sender || sender.trim().length === 0) {
            throw new ValidationError('sender', sender, 'Sender cannot be empty');
        }
        return this.findAll({ ...options, sender });
    }

    /**
     * Find all messages received by a player (inbox)
     * @param {string} receiver - Receiver player name
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<PlayerMessagesModel[]>} Array of received message records
     * @throws {ValidationError} If receiver is empty
     */
    public async findByReceiver(receiver: string, options: QueryOptions = {}): Promise<PlayerMessagesModel[]> {
        if (!receiver || receiver.trim().length === 0) {
            throw new ValidationError('receiver', receiver, 'Receiver cannot be empty');
        }
        return this.findAll({ ...options, receiver });
    }

    /**
     * Find all unread messages for a player
     * @param {string} receiver - Receiver player name
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<PlayerMessagesModel[]>} Array of unread message records
     */
    public async findUnread(receiver: string, options: QueryOptions = {}): Promise<PlayerMessagesModel[]> {
        return this.findAll({ ...options, receiver, isRead: false });
    }

    /**
     * Find all messages exchanged between two players
     * @param {string} playerA - First player name
     * @param {string} playerB - Second player name
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<PlayerMessagesModel[]>} Array of messages between the two players
     * @throws {ErrorFactory} If the query fails
     */
    public async findConversation(playerA: string, playerB: string, options: QueryOptions = {}): Promise<PlayerMessagesModel[]> {
        this.ensureInitialized();

        const {
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'SENT',
            orderDirection = 'ASC'
        } = options;

        const sql = `SELECT * FROM PLAYER_MESSAGES
            WHERE (LOWER(SENDER) = ? AND LOWER(RECEIVER) = ?)
               OR (LOWER(SENDER) = ? AND LOWER(RECEIVER) = ?)
            ORDER BY ${orderBy} ${orderDirection}
            ${limit > 0 ? `LIMIT ${limit}` : ''}
            ${offset > 0 ? `OFFSET ${offset}` : ''}`;

        const a = playerA.toLowerCase();
        const b = playerB.toLowerCase();
        const params = [a, b, b, a];

        try {
            const rows = await this.executeQuery(sql, params);
            return PlayerMessagesModel.fromRows(rows);
        } catch (error) {
            this.logger.error('Failed to find conversation', {
                operation: 'find-conversation', playerA, playerB,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new player message record
     * @param {Partial<Record<string, any>>} data - Message data to insert
     * @param {PlayerMessageCreateOptions} [options={}] - Creation options
     * @returns {Promise<PlayerMessagesModel>} The created message record
     * @throws {ValidationError} If data validation fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: PlayerMessageCreateOptions = {}
    ): Promise<PlayerMessagesModel> {
        const { preventSelfMessage = true } = options;

        if (!data.SENDER) {
            throw new ValidationError('SENDER', data.SENDER, 'SENDER is required');
        }
        if (!data.RECEIVER) {
            throw new ValidationError('RECEIVER', data.RECEIVER, 'RECEIVER is required');
        }
        if (!data.TOPIC) {
            throw new ValidationError('TOPIC', data.TOPIC, 'TOPIC is required');
        }
        if (!data.MESSAGE) {
            throw new ValidationError('MESSAGE', data.MESSAGE, 'MESSAGE is required');
        }

        if (preventSelfMessage && data.SENDER.toLowerCase() === data.RECEIVER.toLowerCase()) {
            throw new ValidationError('SENDER/RECEIVER', data, 'Cannot send a message to yourself');
        }

        // Set sent timestamp if not provided
        if (data.SENT === undefined) {
            data = { ...data, SENT: Date.now() };
        }

        // Default to unread
        if (data.READ === undefined) {
            data = { ...data, READ: false };
        }

        this.logger.info('Creating player message', {
            operation: 'create', sender: data.SENDER, receiver: data.RECEIVER
        });

        return super.create(data, options);
    }

    /**
     * Update an existing message record
     * @param {number} id - The message record ID
     * @param {Partial<Record<string, any>>} data - Updated message data
     * @param {PlayerMessageUpdateOptions} [options={}] - Update options
     * @returns {Promise<PlayerMessagesModel>} The updated message record
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: PlayerMessageUpdateOptions = {}
    ): Promise<PlayerMessagesModel> {
        this.logger.info('Updating player message', { operation: 'update', id });
        return super.update(id, data, options);
    }

    /**
     * Delete a message record
     * @param {number} id - The message record ID
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        const exists = await this.messageExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting player message', { operation: 'delete', id });
        return super.delete(id, options);
    }

    /**
     * Mark a message as read
     * @param {number} messageId - The message record ID
     * @returns {Promise<PlayerMessagesModel>} The updated message record
     * @throws {ValidationError} If the message does not exist
     */
    public async markAsRead(messageId: number): Promise<PlayerMessagesModel> {
        if (!await this.messageExistsById(messageId)) {
            throw new ValidationError('messageId', messageId, `Message ${messageId} does not exist`);
        }
        return this.update(messageId, { READ: true });
    }

    /**
     * Mark all unread messages for a receiver as read
     * @param {string} receiver - Receiver player name
     * @returns {Promise<number>} Number of messages marked as read
     * @throws {ErrorFactory} If the query fails
     */
    public async markAllAsRead(receiver: string): Promise<number> {
        this.ensureInitialized();

        const sql = 'UPDATE PLAYER_MESSAGES SET READ = TRUE WHERE LOWER(RECEIVER) = ? AND READ = FALSE';
        try {
            await this.executeQuery(sql, [receiver.toLowerCase()]);
            if (this.cacheManager) await this.clearCachesForTable('PLAYER_MESSAGES');

            // Count affected rows (approximate via follow-up query)
            const countResult = await this.executeQuery(
                'SELECT COUNT(*) AS cnt FROM PLAYER_MESSAGES WHERE LOWER(RECEIVER) = ? AND READ = TRUE',
                [receiver.toLowerCase()]
            );
            const marked = Number(countResult[0]?.cnt ?? 0);
            this.logger.info('Marked all messages as read', { operation: 'mark-all-as-read', receiver, marked });
            return marked;
        } catch (error) {
            this.logger.error('Failed to mark messages as read', { operation: 'mark-all-as-read', receiver });
            throw ErrorFactory.createQueryError(sql, error, [receiver.toLowerCase()]);
        }
    }

    /**
     * Delete all messages for a specific player (inbox and outbox)
     * @param {string} playerName - Player name
     * @returns {Promise<number>} Number of messages deleted
     * @throws {ErrorFactory} If the query fails
     */
    public async deleteAllForPlayer(playerName: string): Promise<number> {
        this.ensureInitialized();

        const messages = await this.findAll({
            limit: 0,
            skipCache: true
        });

        const playerMessages = messages.filter(m =>
            (m.get('SENDER') as string)?.toLowerCase() === playerName.toLowerCase() ||
            (m.get('RECEIVER') as string)?.toLowerCase() === playerName.toLowerCase()
        );

        let count = 0;
        for (const msg of playerMessages) {
            await this.delete(msg.get('ID') as number);
            count++;
        }

        this.logger.info('All player messages deleted', { operation: 'delete-all-for-player', playerName, count });
        return count;
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple player message records
     * @param {Array<Partial<Record<string, any>>>} records - Array of message data
     * @param {BulkMessageOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkMessageOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            try {
                await this.create(records[i], { skipValidation: options.skipValidation });
                result.success++;
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: records[i] });
                if (!continueOnError) throw error;
            }
        }

        this.logger.info('Bulk create completed', { operation: 'bulk-create', ...result });
        return result;
    }

    /**
     * Delete multiple message records by ID
     * @param {number[]} ids - Array of message IDs to delete
     * @param {BulkMessageOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(ids: number[], options: BulkMessageOptions = {}): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < ids.length; i++) {
            try {
                const deleted = await this.delete(ids[i]);
                if (deleted) { result.success++; } else { result.skipped++; }
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: ids[i] });
                if (!continueOnError) throw error;
            }
        }

        this.logger.info('Bulk delete completed', { operation: 'bulk-delete', ...result });
        return result;
    }

    // =============================================================================
    // ANALYTICS AND STATISTICS
    // =============================================================================

    /**
     * Get comprehensive player message statistics
     * @returns {Promise<PlayerMessageStatistics>} Message statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<PlayerMessageStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult, unreadResult, attachResult, senderResult, receiverResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS cnt FROM PLAYER_MESSAGES', []),
                this.executeQuery('SELECT COUNT(*) AS cnt FROM PLAYER_MESSAGES WHERE READ = FALSE', []),
                this.executeQuery('SELECT COUNT(*) AS cnt FROM PLAYER_MESSAGES WHERE ATT_ID IS NOT NULL', []),
                this.executeQuery('SELECT SENDER, COUNT(*) AS cnt FROM PLAYER_MESSAGES GROUP BY SENDER ORDER BY cnt DESC LIMIT 10', []),
                this.executeQuery('SELECT RECEIVER, COUNT(*) AS cnt FROM PLAYER_MESSAGES GROUP BY RECEIVER ORDER BY cnt DESC LIMIT 10', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const unread = Number(unreadResult[0]?.cnt ?? 0);

            return {
                totalMessages: total,
                unreadMessages: unread,
                readMessages: total - unread,
                withAttachments: Number(attachResult[0]?.cnt ?? 0),
                topSenders: senderResult.map((r: any) => ({ sender: String(r.SENDER), count: Number(r.cnt) })),
                topReceivers: receiverResult.map((r: any) => ({ receiver: String(r.RECEIVER), count: Number(r.cnt) }))
            };
        } catch (error) {
            this.logger.error('Failed to compute message statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Count unread messages for a specific player
     * @param {string} receiver - Receiver player name
     * @returns {Promise<number>} Number of unread messages
     * @throws {ErrorFactory} If the query fails
     */
    public async countUnread(receiver: string): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) AS cnt FROM PLAYER_MESSAGES WHERE LOWER(RECEIVER) = ? AND READ = FALSE';
        try {
            const result = await this.executeQuery(sql, [receiver.toLowerCase()]);
            return Number(result[0]?.cnt ?? 0);
        } catch (error) {
            this.logger.error('Failed to count unread messages', { operation: 'count-unread', receiver });
            throw ErrorFactory.createQueryError(sql, error, [receiver.toLowerCase()]);
        }
    }
}
