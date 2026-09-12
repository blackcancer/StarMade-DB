import * as related0 from '../players/PlayersModel.js';
/**
 * @fileoverview Player Messages Model
 * 
 * Model for the PLAYER_MESSAGES table storing in-game messaging system.
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

/**
 * Model for the PLAYER_MESSAGES table - Enhanced Edition with Player Relations
 * 
 * Advanced messaging system with complete bidirectional player relationships
 * and comprehensive message analytics.
 */
export class PlayerMessagesModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'PLAYER_MESSAGES';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'PLAYER_MESSAGES',
        comment: 'In-game messaging system',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Message identifier'
            }),
            column('SENDER', DataType.VARCHAR, {
                length: 64,
                nullable: false,
                comment: 'Sender player name'
            }),
            column('RECEIVER', DataType.VARCHAR, {
                length: 64,
                nullable: false,
                comment: 'Receiver player name'
            }),
            column('TOPIC', DataType.VARCHAR, {
                length: 128,
                nullable: false,
                comment: 'Message subject/topic'
            }),
            column('MESSAGE', DataType.VARCHAR, {
                length: 1024,
                nullable: false,
                comment: 'Message content'
            }),
            column('SENT', DataType.BIGINT, {
                nullable: false,
                comment: 'Message sent timestamp'
            }),
            column('READ', DataType.BOOLEAN, {
                nullable: true,
                defaultValue: false,
                comment: 'Whether message has been read'
            }),
            column('ATT_ID', DataType.BIGINT, {
                nullable: true,
                comment: 'Attachment entity ID'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('i0', ['SENDER']),
            index('i1', ['RECEIVER']),
            index('i2', ['SENT']),
            index('i3', ['READ']),
            index('i4', ['SENDER', 'RECEIVER']),
            index('i5', ['SENDER', 'RECEIVER', 'SENT'])
        ],

        validationRules: [
            validation('SENDER', 'required'),
            validation('SENDER', 'maxLength', {
                value: 64,
                message: 'Sender name cannot exceed 64 characters'
            }),
            validation('RECEIVER', 'required'),
            validation('RECEIVER', 'maxLength', {
                value: 64,
                message: 'Receiver name cannot exceed 64 characters'
            }),
            validation('TOPIC', 'required'),
            validation('TOPIC', 'maxLength', {
                value: 128,
                message: 'Topic cannot exceed 128 characters'
            }),
            validation('MESSAGE', 'required'),
            validation('MESSAGE', 'maxLength', {
                value: 1024,
                message: 'Message cannot exceed 1024 characters'
            }),
            validation('SENT', 'required')
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
            /** Player who sent this message (PLAYER_MESSAGES.SENDER -> PLAYERS.STARMADE_NAME) */
            senderPlayer: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.PlayersModel;
                },
                {
                    from: 'PLAYER_MESSAGES.SENDER',
                    to: 'PLAYERS.STARMADE_NAME'
                }
            ),

            /** Player who received this message (PLAYER_MESSAGES.RECEIVER -> PLAYERS.STARMADE_NAME) */
            receiverPlayer: relation(
                Model.BelongsToOneRelation,
                () => {
                    return related0.PlayersModel;
                },
                {
                    from: 'PLAYER_MESSAGES.RECEIVER',
                    to: 'PLAYERS.STARMADE_NAME'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the PLAYER_MESSAGES.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { const v = this.get('ID'); if (v === undefined || v === null) return undefined as any; return typeof v === 'string' ? parseInt(v, 10) : v; }
    /**
     * Store the PLAYER_MESSAGES.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the PLAYER_MESSAGES.SENDER column from this model.
     * @returns The stored SENDER value.
     */
    public getSender(): string { return this.get('SENDER'); }
    /**
     * Store the PLAYER_MESSAGES.SENDER column in this model and return this for chaining.
     * @param sender New value for the SENDER column.
     * @returns This model for chaining.
     */
    public setSender(sender: string): this { return this.set('SENDER', sender); }

    /**
     * Read the PLAYER_MESSAGES.RECEIVER column from this model.
     * @returns The stored RECEIVER value.
     */
    public getReceiver(): string { return this.get('RECEIVER'); }
    /**
     * Store the PLAYER_MESSAGES.RECEIVER column in this model and return this for chaining.
     * @param receiver New value for the RECEIVER column.
     * @returns This model for chaining.
     */
    public setReceiver(receiver: string): this { return this.set('RECEIVER', receiver); }

    /**
     * Read the PLAYER_MESSAGES.TOPIC column from this model.
     * @returns The stored TOPIC value.
     */
    public getTopic(): string { return this.get('TOPIC'); }
    /**
     * Store the PLAYER_MESSAGES.TOPIC column in this model and return this for chaining.
     * @param topic New value for the TOPIC column.
     * @returns This model for chaining.
     */
    public setTopic(topic: string): this { return this.set('TOPIC', topic); }

    /**
     * Read the PLAYER_MESSAGES.MESSAGE column from this model.
     * @returns The stored MESSAGE value.
     */
    public getMessage(): string { return this.get('MESSAGE'); }
    /**
     * Store the PLAYER_MESSAGES.MESSAGE column in this model and return this for chaining.
     * @param message New value for the MESSAGE column.
     * @returns This model for chaining.
     */
    public setMessage(message: string): this { return this.set('MESSAGE', message); }

    /**
     * Read the PLAYER_MESSAGES.SENT column from this model.
     * @returns The stored SENT value.
     */
    public getSent(): number { return this.get('SENT'); }
    /**
     * Store the PLAYER_MESSAGES.SENT column in this model and return this for chaining.
     * @param sent New value for the SENT column.
     * @returns This model for chaining.
     */
    public setSent(sent: number): this { return this.set('SENT', sent); }

    /**
     * Read the PLAYER_MESSAGES.READ column from this model.
     * @returns The stored READ value.
     */
    public getRead(): boolean { return this.get('READ') || false; }
    /**
     * Store the PLAYER_MESSAGES.read column in this model and return this for chaining.
     * @param read New value for the read column.
     * @returns This model for chaining.
     */
    public setRead(read: boolean): this { return this.set('read', read); }

    /**
     * Read the PLAYER_MESSAGES.ATT_ID column from this model.
     * @returns The stored ATT_ID value.
     */
    public getAttId(): number | undefined { return this.get('ATT_ID'); }
    /**
     * Store the PLAYER_MESSAGES.ATT_ID column in this model and return this for chaining.
     * @param attId New value for the ATT_ID column.
     * @returns This model for chaining.
     */
    public setAttId(attId: number | undefined): this { return this.set('ATT_ID', attId); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS (typed)
    // =============================================================================

    /**
     * Get the player who sent this message
     */
    public getSenderPlayer(): any | undefined {
        return this.getRelated<any>('senderPlayer');
    }

    /**
     * Set the player who sent this message
     */
    public setSenderPlayer(player: any | undefined): this {
        return this.setRelated('senderPlayer', player);
    }

    /**
     * Get the player who received this message
     */
    public getReceiverPlayer(): any | undefined {
        return this.getRelated<any>('receiverPlayer');
    }

    /**
     * Set the player who received this message
     */
    public setReceiverPlayer(player: any | undefined): this {
        return this.setRelated('receiverPlayer', player);
    }

    /**
     * Check if sender player relation is loaded
     */
    public hasSenderPlayerLoaded(): boolean {
        return this.hasRelated('senderPlayer');
    }

    /**
     * Check if receiver player relation is loaded
     */
    public hasReceiverPlayerLoaded(): boolean {
        return this.hasRelated('receiverPlayer');
    }

    /**
     * Check if both player relations are loaded
     */
    public hasPlayersLoaded(): boolean {
        return this.hasSenderPlayerLoaded() && this.hasReceiverPlayerLoaded();
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS - ENHANCED EDITION
    // =============================================================================

    /** Whether the stored unread flag is set. */
    public isUnread(): boolean {
        return !this.getRead();
    }

    /** Whether an attachment identifier is present on this message. */
    public hasAttachment(): boolean {
        const attId = this.getAttId();
        return attId !== null && attId !== undefined;
    }

    /** Clear the unread flag and return this model for chaining. */
    public markAsRead(): this {
        return this.setRead(true);
    }

    /** Set the unread flag and return this model for chaining. */
    public markAsUnread(): this {
        return this.setRead(false);
    }

    /** Convert the stored SENT timestamp in milliseconds to a JavaScript Date. */
    public getSentDate(): Date {
        return new Date(this.getSent());
    }

    /** Format the SENT timestamp as an ISO 8601 UTC date-time string. */
    public getFormattedSentDate(): string {
        return this.getSentDate().toISOString();
    }

    /** Return the message text, truncated to maxLength characters followed by an ellipsis when necessary. */
    public getMessagePreview(maxLength: number = 50): string {
        const message = this.getMessage();
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    }

    // =============================================================================
    // ADVANCED MESSAGE ANALYTICS (100/100 FEATURES)
    // =============================================================================

    /**
     * Get message age in milliseconds
     */
    public getAgeInMilliseconds(): number {
        return Date.now() - this.getSent();
    }

    /**
     * Check if message is recent (within given time in milliseconds)
     */
    public isRecentMessage(withinMs: number = 86400000): boolean { // Default: 24 hours
        return this.getAgeInMilliseconds() <= withinMs;
    }

    /**
     * Get relative time description
     */
    public getRelativeTimeDescription(): string {
        const age = this.getAgeInMilliseconds();
        
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
     * Check if this is a self-message (same sender and receiver)
     */
    public isSelfMessage(): boolean {
        return this.getSender().toLowerCase() === this.getReceiver().toLowerCase();
    }

    /**
     * Get message priority based on topic keywords
     */
    public getMessagePriority(): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
        const topic = this.getTopic().toLowerCase();
        const message = this.getMessage().toLowerCase();
        
        // Urgent keywords
        if (topic.includes('urgent') || topic.includes('emergency') || topic.includes('attack') ||
            message.includes('urgent') || message.includes('emergency') || message.includes('help')) {
            return 'URGENT';
        }
        
        // High priority keywords
        if (topic.includes('important') || topic.includes('faction') || topic.includes('alliance') ||
            message.includes('important') || message.includes('meeting') || message.includes('war')) {
            return 'HIGH';
        }
        
        // Low priority keywords
        if (topic.includes('greet') || topic.includes('hello') || topic.includes('chat') ||
            message.includes('thanks') || message.includes('hello') || message.includes('hi')) {
            return 'LOW';
        }
        
        return 'NORMAL';
    }

    /**
     * Get message category based on content analysis
     */
    public getMessageCategory(): 'SOCIAL' | 'BUSINESS' | 'FACTION' | 'TRADE' | 'HELP' | 'SYSTEM' | 'OTHER' {
        const topic = this.getTopic().toLowerCase();
        const message = this.getMessage().toLowerCase();
        
        // Trade-related
        if (topic.includes('trade') || topic.includes('buy') || topic.includes('sell') ||
            message.includes('credits') || message.includes('price') || message.includes('market')) {
            return 'TRADE';
        }
        
        // Faction-related
        if (topic.includes('faction') || topic.includes('alliance') || topic.includes('war') ||
            message.includes('faction') || message.includes('member') || message.includes('rank')) {
            return 'FACTION';
        }
        
        // Help requests
        if (topic.includes('help') || topic.includes('question') || topic.includes('how') ||
            message.includes('help') || message.includes('how do') || message.includes('can you')) {
            return 'HELP';
        }
        
        // Business
        if (topic.includes('business') || topic.includes('contract') || topic.includes('deal') ||
            message.includes('proposal') || message.includes('agreement') || message.includes('service')) {
            return 'BUSINESS';
        }
        
        // System messages
        if (topic.includes('system') || topic.includes('admin') || topic.includes('server') ||
            this.getSender().toLowerCase().includes('system') || this.getSender().toLowerCase().includes('admin')) {
            return 'SYSTEM';
        }
        
        // Social
        if (topic.includes('greet') || topic.includes('hello') || topic.includes('chat') ||
            message.includes('how are you') || message.includes('nice to meet') || message.includes('thanks')) {
            return 'SOCIAL';
        }
        
        return 'OTHER';
    }

    /**
     * Get player intelligence from loaded relations
     */
    public getPlayersIntelligence(): {
        sender?: {
            name?: string;
            role?: string;
            faction?: number;
            isAdmin?: boolean;
            isLoaded: boolean;
        };
        receiver?: {
            name?: string;
            role?: string;
            faction?: number;
            isAdmin?: boolean;
            isLoaded: boolean;
        };
    } {
        const senderPlayer = this.getSenderPlayer();
        const receiverPlayer = this.getReceiverPlayer();
        
        const result: any = {};
        
        if (this.hasSenderPlayerLoaded() && senderPlayer) {
            result.sender = {
                name: typeof senderPlayer.getDisplayName === 'function' ? senderPlayer.getDisplayName() : undefined,
                role: typeof senderPlayer.getRole === 'function' ? senderPlayer.getRole() : undefined,
                faction: typeof senderPlayer.getFaction === 'function' ? senderPlayer.getFaction() : undefined,
                isAdmin: typeof senderPlayer.isAdmin === 'function' ? senderPlayer.isAdmin() : undefined,
                isLoaded: true
            };
        } else {
            result.sender = { isLoaded: false };
        }
        
        if (this.hasReceiverPlayerLoaded() && receiverPlayer) {
            result.receiver = {
                name: typeof receiverPlayer.getDisplayName === 'function' ? receiverPlayer.getDisplayName() : undefined,
                role: typeof receiverPlayer.getRole === 'function' ? receiverPlayer.getRole() : undefined,
                faction: typeof receiverPlayer.getFaction === 'function' ? receiverPlayer.getFaction() : undefined,
                isAdmin: typeof receiverPlayer.isAdmin === 'function' ? receiverPlayer.isAdmin() : undefined,
                isLoaded: true
            };
        } else {
            result.receiver = { isLoaded: false };
        }
        
        return result;
    }

    /**
     * Check if this is an inter-faction message
     */
    public isInterFactionMessage(): boolean {
        const playersIntel = this.getPlayersIntelligence();
        
        if (playersIntel.sender?.isLoaded && playersIntel.receiver?.isLoaded) {
            const senderFaction = playersIntel.sender.faction;
            const receiverFaction = playersIntel.receiver.faction;
            
            return senderFaction !== undefined && receiverFaction !== undefined && 
                   senderFaction !== receiverFaction && senderFaction !== 0 && receiverFaction !== 0;
        }
        
        return false;
    }

    /**
     * Check if this is an admin message
     */
    public isAdminMessage(): boolean {
        const playersIntel = this.getPlayersIntelligence();
        
        return (playersIntel.sender?.isAdmin === true) || (playersIntel.receiver?.isAdmin === true);
    }

    /**
     * Generate comprehensive message analytics
     */
    public generateMessageAnalytics(): {
        basic: {
            id: number;
            from: string;
            to: string;
            subject: string;
            preview: string;
            sent: string;
            relativeTime: string;
            isRead: boolean;
            hasAttachment: boolean;
        };
        classification: {
            priority: ReturnType<PlayerMessagesModel['getMessagePriority']>;
            category: ReturnType<PlayerMessagesModel['getMessageCategory']>;
            isRecent: boolean;
            isSelfMessage: boolean;
            isInterFaction: boolean;
            isAdminMessage: boolean;
        };
        players: {
            intelligence: ReturnType<PlayerMessagesModel['getPlayersIntelligence']>;
            hasPlayersLoaded: boolean;
        };
        metrics: {
            ageMs: number;
            messageLength: number;
            topicLength: number;
            wordCount: number;
        };
        insights: string[];
    } {
        const basic = {
            id: this.getId(),
            from: this.getSender(),
            to: this.getReceiver(),
            subject: this.getTopic(),
            preview: this.getMessagePreview(),
            sent: this.getFormattedSentDate(),
            relativeTime: this.getRelativeTimeDescription(),
            isRead: this.getRead(),
            hasAttachment: this.hasAttachment()
        };

        const classification = {
            priority: this.getMessagePriority(),
            category: this.getMessageCategory(),
            isRecent: this.isRecentMessage(),
            isSelfMessage: this.isSelfMessage(),
            isInterFaction: this.isInterFactionMessage(),
            isAdminMessage: this.isAdminMessage()
        };

        const players = {
            intelligence: this.getPlayersIntelligence(),
            hasPlayersLoaded: this.hasPlayersLoaded()
        };

        const messageText = this.getMessage();
        const metrics = {
            ageMs: this.getAgeInMilliseconds(),
            messageLength: messageText.length,
            topicLength: this.getTopic().length,
            wordCount: messageText.split(/\s+/).filter(word => word.length > 0).length
        };

        // Generate insights
        const insights: string[] = [];
        
        if (classification.priority === 'URGENT') {
            insights.push('High priority message requiring immediate attention');
        }
        
        if (classification.isInterFaction) {
            insights.push('Inter-faction communication - diplomatic significance');
        }
        
        if (classification.isAdminMessage) {
            insights.push('Administrative message - official communication');
        }
        
        if (classification.isSelfMessage) {
            insights.push('Self-message - possibly a note or reminder');
        }
        
        if (!basic.isRead && !classification.isRecent) {
            insights.push('Unread old message - may need follow-up');
        }
        
        if (metrics.messageLength > 500) {
            insights.push('Long message - detailed communication');
        }
        
        if (classification.category === 'TRADE') {
            insights.push('Trade-related communication - economic activity');
        }
        
        if (classification.category === 'FACTION') {
            insights.push('Faction-related communication - political activity');
        }

        return {
            basic,
            classification,
            players,
            metrics,
            insights
        };
    }

    /**
     * Get enhanced message summary with relationship data
     */
    public getMessageSummary(): {
        id: number;
        from: string;
        to: string;
        subject: string;
        preview: string;
        sent: string;
        relativeTime: string;
        isRead: boolean;
        hasAttachment: boolean;
        // Enhanced data
        priority: ReturnType<PlayerMessagesModel['getMessagePriority']>;
        category: ReturnType<PlayerMessagesModel['getMessageCategory']>;
        hasPlayersLoaded: boolean;
        senderIntelligence?: ReturnType<PlayerMessagesModel['getPlayersIntelligence']>['sender'];
        receiverIntelligence?: ReturnType<PlayerMessagesModel['getPlayersIntelligence']>['receiver'];
        isInterFaction?: boolean;
        isAdminMessage?: boolean;
    } {
        const basic = {
            id: this.getId(),
            from: this.getSender(),
            to: this.getReceiver(),
            subject: this.getTopic(),
            preview: this.getMessagePreview(),
            sent: this.getFormattedSentDate(),
            relativeTime: this.getRelativeTimeDescription(),
            isRead: this.getRead(),
            hasAttachment: this.hasAttachment(),
            priority: this.getMessagePriority(),
            category: this.getMessageCategory(),
            hasPlayersLoaded: this.hasPlayersLoaded()
        };

        // Add enhanced data if players are loaded
        if (this.hasPlayersLoaded()) {
            const playersIntel = this.getPlayersIntelligence();
            return {
                ...basic,
                senderIntelligence: playersIntel.sender,
                receiverIntelligence: playersIntel.receiver,
                isInterFaction: this.isInterFactionMessage(),
                isAdminMessage: this.isAdminMessage()
            };
        }

        return basic;
    }
}