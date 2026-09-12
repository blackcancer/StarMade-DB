/**
 * @fileoverview Cache Manager Module
 * 
 * This file defines a high-performance caching system for HSQLDB operations.
 * It includes features like TTL (Time To Live) support, LRU (Least Recently Used)
 * eviction, memory management, and hierarchical key management.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    CacheError
} from '../../errors.js';
import { resourceCleaner } from '../../utils.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import {
    ModuleEventEmitterImpl,
    ModuleEvent,
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @interface CacheEntry
 * @description Represents a single entry in the cache, including its value and metadata.
 * @template T - The type of the cached value.
 */
export interface CacheEntry<T = any> {
    /** The cached value. */
    value: T;
    /** The timestamp when the entry was created. */
    createdAt: Date;
    /** The timestamp of the last access. */
    accessedAt: Date;
    /** The timestamp when the entry expires (if TTL is set). */
    expiresAt?: Date;
    /** The number of times the entry has been accessed, for LRU tracking. */
    accessCount: number;
    /** The estimated size of the entry in bytes. */
    sizeBytes: number;
    /** Optional tags for categorizing and filtering cache entries. */
    tags?: string[];
}

/**
 * @interface CacheOptions
 * @description Defines the options for a single cache `set` operation.
 */
export interface CacheOptions {
    /** Time to live in milliseconds. */
    ttl?: number;
    /** Alias for `ttl` for compatibility. */
    maxAge?: number;
    /** Tags for categorizing the cache entry. */
    tags?: string[];
    /** Priority level for eviction (higher value means less likely to be evicted). */
    priority?: number;
    /** Whether to compress large values (if enabled globally). */
    compress?: boolean;
}

/**
 * @interface CacheConfig
 * @description Defines the overall configuration for the CacheManager.
 */
export interface CacheConfig {
    /** The maximum total size of the cache in bytes. */
    maxSizeBytes: number;
    /** The maximum number of entries allowed in the cache. */
    maxEntries: number;
    /** The default time to live for cache entries in milliseconds. */
    defaultTtl: number;
    /** The interval in milliseconds for running the automatic cleanup process. */
    cleanupInterval: number;
    /** Whether to enable automatic memory monitoring to trigger evictions. */
    enableMemoryMonitoring: boolean;
    /** The memory usage threshold (0-1) at which to trigger aggressive eviction. */
    memoryPressureThreshold: number;
    /** Whether to enable compression for large cache values. */
    enableCompression: boolean;
    /** The size in bytes above which values should be compressed. */
    compressionThreshold: number;
    /** Whether to enable cache warming on startup (feature to be implemented). */
    enableWarmup: boolean;
}

/**
 * @interface CacheStats
 * @description Provides basic statistics about the cache's performance and state.
 */
export interface CacheStats {
    /** The total number of entries currently in the cache. */
    totalEntries: number;
    /** The total estimated memory usage of the cache in bytes. */
    totalSizeBytes: number;
    /** The number of times a requested item was found in the cache. */
    hitCount: number;
    /** The number of times a requested item was not found in the cache. */
    missCount: number;
    /** The ratio of hits to total requests (hits + misses), from 0 to 1. */
    hitRatio: number;
    /** The number of entries removed due to eviction policies (e.g., LRU, size limits). */
    evictionCount: number;
    /** The number of entries removed due to TTL expiration. */
    expirationCount: number;
    /** The timestamp of the last cleanup operation. */
    lastCleanup: Date;
    /** The total uptime of the cache in milliseconds. */
    uptime: number;
}

/**
 * @interface CachePattern
 * @description Defines a pattern for matching cache keys.
 */
export interface CachePattern {
    /** The pattern string, which supports '*' as a wildcard. */
    pattern: string;
    /** An optional namespace for hierarchical organization. */
    namespace?: string;
    /** If true, the pattern matching will include expired entries. */
    includeExpired?: boolean;
}

// =============================================================================
// CACHE MANAGER CLASS
// =============================================================================

/**
 * @class CacheManager
 * @description A high-performance caching system that provides intelligent caching with TTL support,
 * LRU eviction, and memory management for HSQLDB operations.
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<ModuleEvent>}
 */
export class CacheManager implements BaseModule, ModuleEventEmitter<ModuleEvent> {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'cache-manager';
    /** 
     * The version of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly version = '1.0.0';
    /** 
     * Indicates whether the module has been initialized.
     * @public
     * @readonly
     * @type {boolean}
     */
    public get isInitialized(): boolean { return this._initialized; }

    /**
     * Whether initialization completed successfully. 
     * @private 
     * @type {boolean}
     */
    private _initialized = false;
    /**
     * Owning manager used to resolve configuration and module dependencies. 
     * @private 
     * @type {HSQLManager | undefined}
     */
    private manager?: HSQLManager;
    /**
     * Effective configuration applied to this instance. 
     * @private 
     * @type {CacheConfig | undefined}
     */
    private config?: CacheConfig;
    /**
     * Whether destruction has started; prevents operations after resource cleanup. 
     * @private 
     * @type {boolean}
     */
    private destroyed = false;
    /**
     * Creation timestamp in milliseconds used to calculate uptime. 
     * @private 
     * @readonly
     * @type {number}
     */
    private readonly startTime = Date.now();
    /**
     * Module logger for operation context and diagnostic errors. 
     * @private 
     * @type {ModuleLogger}
     */
    private logger: ModuleLogger;
    /**
     * Emitter that dispatches this module’s lifecycle and operation events. 
     * @private 
     * @type {ModuleEventEmitterImpl<ModuleEvent>}
     */
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent>;

    /**
     * Cached entries indexed by cache key. 
     * @private 
     * @type {Map<string, CacheEntry>}
     */
    private cache: Map<string, CacheEntry> = new Map();
    /**
     * Most recent access sequence for each key, used for LRU eviction. 
     * @private 
     * @type {Map<string, number>}
     */
    private accessOrder: Map<string, number> = new Map();
    /**
     * Monotonic sequence assigned when recording a cache access. 
     * @private 
     * @type {number}
     */
    private accessCounter = 0;
    /**
     * Accumulated operation counters and timestamps exposed through statistics. 
     * @private 
     * @type {object}
     */
    private stats: {
        hitCount: number;
        missCount: number;
        evictionCount: number;
        expirationCount: number;
        lastCleanup: Date;
    } = {
        hitCount: 0,
        missCount: 0,
        evictionCount: 0,
        expirationCount: 0,
        lastCleanup: new Date()
    };
    /**
     * Periodic timer for removing expired or idle entries. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private cleanupTimer?: NodeJS.Timeout;
    /**
     * Estimated total size of the current cache contents in bytes. 
     * @private 
     * @type {number}
     */
    private currentSizeBytes = 0;

    /**
     * Creates a new instance of the CacheManager.
     */
    constructor() {
        this.logger = createModuleLogger('CacheManager-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'CacheManager');

        // Initialize event listeners for module events
        this.eventEmitter.initializeEvents(Object.values(ModuleEvent));
    }

    /**
     * Initializes the cache manager. This sets up the configuration based on the
     * HSQLManager settings and starts the automatic cleanup processes.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the provided manager is null or undefined.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('CacheManager', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing CacheManager v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();
        
        // Start cleanup timer
        this.startCleanupTimer();

        this._initialized = true;
        resourceCleaner.register(this);
        
        this.logger.info('CacheManager v1.0 initialized successfully', {
            operation: 'initialize-complete',
            maxSizeBytes: this.config?.maxSizeBytes,
            maxEntries: this.config?.maxEntries,
            defaultTtl: this.config?.defaultTtl,
            cleanupInterval: this.config?.cleanupInterval
        });

        // Emit initialization event
        this.emit(ModuleEvent.INITIALIZED, createEventData('cache-manager-initialized', {
            maxSizeBytes: this.config?.maxSizeBytes,
            maxEntries: this.config?.maxEntries,
            compressionEnabled: this.config?.enableCompression
        }, this.name));
    }

    /**
     * Builds the cache configuration from the HSQLManager's settings.
     * @private
     * @throws {ConfigurationError} If the manager reference is not set.
     */
    private buildConfiguration(): void {
        if (!this.manager) {
            throw new ConfigurationError('Manager not set', ['manager'], {
                operation: 'build-config'
            });
        }

        const managerConfig = this.manager.getConfiguration();
        
        this.config = {
            maxSizeBytes: 100 * 1024 * 1024, // 100MB default
            maxEntries: 10000,
            defaultTtl: 300000, // 5 minutes
            cleanupInterval: 60000, // 1 minute
            enableMemoryMonitoring: true,
            memoryPressureThreshold: 0.8,
            enableCompression: false, // Disabled for performance
            compressionThreshold: 1024, // 1KB
            enableWarmup: false
        };

        this.logger.debug('Configuration built for CacheManager', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Starts the timer for automatic cache cleanup based on the configured interval.
     * @private
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.performCleanup().catch(error => {
                this.logger.warn('Cleanup operation failed', {
                    operation: 'cleanup-timer',
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        }, this.config!.cleanupInterval);

        this.logger.debug('Cleanup timer started', {
            operation: 'start-cleanup-timer',
            interval: this.config!.cleanupInterval
        });
    }

    /**
     * Retrieves a value from the cache by its key. This operation performs TTL checking
     * and updates LRU tracking information.
     * @async
     * @template T - The expected type of the cached value.
     * @param {string} key - The key of the item to retrieve.
     * @returns {Promise<T | undefined>} The cached value, or undefined if not found or expired.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async get<T = any>(key: string): Promise<T | undefined> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'get cache value', {
                operation: 'cache-get'
            });
        }

        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.missCount++;
            this.logger.debug('Cache miss', {
                operation: 'cache-get',
                key,
                totalEntries: this.cache.size
            });
            return undefined;
        }

        // Check expiration
        if (entry.expiresAt && entry.expiresAt <= new Date()) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            this.currentSizeBytes -= entry.sizeBytes;
            this.stats.missCount++;
            this.stats.expirationCount++;
            
            this.logger.debug('Cache entry expired', {
                operation: 'cache-get',
                key,
                expiresAt: entry.expiresAt
            });
            return undefined;
        }

        // Update access tracking for LRU
        entry.accessedAt = new Date();
        entry.accessCount++;
        this.accessOrder.set(key, ++this.accessCounter);
        
        this.stats.hitCount++;
        
        this.logger.debug('Cache hit', {
            operation: 'cache-get',
            key,
            accessCount: entry.accessCount,
            age: Date.now() - entry.createdAt.getTime()
        });

        return entry.value as T;
    }

    /**
     * Stores a value in the cache. This operation handles memory limits by triggering
     * eviction if necessary and sets metadata like TTL.
     * @async
     * @template T - The type of the value to be cached.
     * @param {string} key - The key to store the value under.
     * @param {T} value - The value to cache.
     * @param {CacheOptions} [options] - Optional settings for this cache entry, like TTL and tags.
     * @returns {Promise<void>} A promise that resolves when the value is successfully cached.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     * @throws {CacheError} If the value cannot be cached for some reason.
     */
    public async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'set cache value', {
                operation: 'cache-set'
            });
        }

        try {
            const now = new Date();
            const ttl = options?.ttl ?? options?.maxAge ?? this.config!.defaultTtl;
            const expiresAt = ttl > 0 ? new Date(now.getTime() + ttl) : undefined;
            
            // Estimate entry size
            const sizeBytes = this.estimateSize(value);
            
            // Check if we need to evict entries
            await this.ensureCapacity(sizeBytes);
            
            const entry: CacheEntry<T> = {
                value,
                createdAt: now,
                accessedAt: now,
                expiresAt,
                accessCount: 1,
                sizeBytes,
                tags: options?.tags
            };

            // Update tracking
            const existingEntry = this.cache.get(key);
            if (existingEntry) {
                this.currentSizeBytes -= existingEntry.sizeBytes;
            }

            this.cache.set(key, entry);
            this.accessOrder.set(key, ++this.accessCounter);
            this.currentSizeBytes += sizeBytes;

            this.logger.debug('Cache entry set', {
                operation: 'cache-set',
                key,
                sizeBytes,
                ttl,
                totalEntries: this.cache.size,
                totalSizeBytes: this.currentSizeBytes
            });

        } catch (error) {
            this.logger.error('Failed to set cache entry', {
                operation: 'cache-set',
                key,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new CacheError(`Failed to cache value for key '${key}'`, 'SET_FAILED', undefined, {
                operation: 'cache-set'
            });
        }
    }

    /**
     * Deletes a value from the cache by its key.
     * @async
     * @param {string} key - The key of the item to delete.
     * @returns {Promise<boolean>} True if the item was found and deleted, false otherwise.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async delete(key: string): Promise<boolean> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'delete cache value', {
                operation: 'cache-delete'
            });
        }

        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.currentSizeBytes -= entry.sizeBytes;

        this.logger.debug('Cache entry deleted', {
            operation: 'cache-delete',
            key,
            sizeBytes: entry.sizeBytes,
            remainingEntries: this.cache.size
        });

        return true;
    }

    /**
     * Checks if a key exists in the cache and is not expired.
     * @async
     * @param {string} key - The key to check for.
     * @returns {Promise<boolean>} True if the key exists and is valid, false otherwise.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async has(key: string): Promise<boolean> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'check cache key', {
                operation: 'cache-has'
            });
        }

        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        // Check expiration
        if (entry.expiresAt && entry.expiresAt <= new Date()) {
            await this.delete(key); // Clean up expired entry
            return false;
        }

        return true;
    }

    /**
     * Clears cache entries. If a pattern is provided, only matching keys are cleared.
     * Otherwise, the entire cache is cleared.
     * @async
     * @param {string} [pattern] - An optional pattern to match keys against (supports '*' wildcard).
     * @returns {Promise<number>} The number of entries that were cleared.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async clear(pattern?: string): Promise<number> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'clear cache', {
                operation: 'cache-clear'
            });
        }

        if (!pattern) {
            // Clear all entries
            const count = this.cache.size;
            this.cache.clear();
            this.accessOrder.clear();
            this.currentSizeBytes = 0;
            
            this.logger.info('Cache cleared completely', {
                operation: 'cache-clear',
                entriesCleared: count
            });
            
            return count;
        }

        // Clear by pattern
        const regex = this.patternToRegex(pattern);
        const keysToDelete: string[] = [];
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            await this.delete(key);
        }

        this.logger.info('Cache cleared by pattern', {
            operation: 'cache-clear',
            pattern,
            entriesCleared: keysToDelete.length
        });

        return keysToDelete.length;
    }

    /**
     * Retrieves all cache keys, optionally filtering by a pattern.
     * @async
     * @param {string} [pattern] - An optional pattern to match keys against (supports '*' wildcard).
     * @returns {Promise<string[]>} An array of matching cache keys.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async keys(pattern?: string): Promise<string[]> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'get cache keys', {
                operation: 'cache-keys'
            });
        }

        if (!pattern) {
            return Array.from(this.cache.keys());
        }

        const regex = this.patternToRegex(pattern);
        return Array.from(this.cache.keys()).filter(key => regex.test(key));
    }

    /**
     * Gets the current statistics of the cache.
     * @returns {CacheStats} An object containing the current cache statistics.
     */
    public getStats(): CacheStats {
        const totalRequests = this.stats.hitCount + this.stats.missCount;
        const hitRatio = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

        return {
            totalEntries: this.cache.size,
            totalSizeBytes: this.currentSizeBytes,
            hitCount: this.stats.hitCount,
            missCount: this.stats.missCount,
            hitRatio,
            evictionCount: this.stats.evictionCount,
            expirationCount: this.stats.expirationCount,
            lastCleanup: this.stats.lastCleanup,
            uptime: Date.now() - this.startTime
        };
    }

    /**
     * Gets the current configuration of the cache manager.
     * @returns {CacheConfig | undefined} A copy of the current configuration, or undefined if not initialized.
     */
    public getConfiguration(): CacheConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Manually triggers a cache cleanup operation, removing expired and evicted entries.
     * @async
     * @returns {Promise<{ expired: number; evicted: number }>} An object with the results of the cleanup.
     * @throws {ModuleNotInitializedError} If the manager is not initialized.
     */
    public async cleanup(): Promise<{ expired: number; evicted: number }> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheManager', 'cleanup cache', {
                operation: 'cache-cleanup'
            });
        }

        return await this.performCleanup();
    }

    /**
     * Destroys the cache manager, clearing all timers and data, and cleaning up resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying CacheManager', {
            operation: 'destroy'
        });
        
        this.destroyed = true;
        this._initialized = false;

        // Stop cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }

        // Clear cache only if we were initialized
        if (this.cache.size > 0) {
            this.cache.clear();
            this.accessOrder.clear();
            this.currentSizeBytes = 0;
        }

        // Clear references
        this.manager = undefined;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);
        
        this.logger.info('CacheManager destroyed successfully', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }

    /**
     * Adds a listener for a module event.
     * @param {ModuleEvent} event - The event to listen for.
     * @param {ModuleEventListener<ModuleEvent>} listener - The callback function.
     */
    public on(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Adds a one-time listener for a module event.
     * @param {ModuleEvent} event - The event to listen for.
     * @param {ModuleEventListener<ModuleEvent>} listener - The callback function.
     */
    public once(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Removes a listener for a module event.
     * @param {ModuleEvent} event - The event to stop listening to.
     * @param {ModuleEventListener<ModuleEvent>} listener - The listener to remove.
     */
    public off(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emits a module event.
     * @param {ModuleEvent} event - The event to emit.
     * @param {any} [data] - The data payload for the event.
     */
    public emit(event: ModuleEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Removes all listeners for a specific module event, or all listeners if no event is specified.
     * @param {ModuleEvent} [event] - The event to remove listeners from.
     */
    public removeAllListeners(event?: ModuleEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Gets the number of listeners for a specific module event.
     * @param {ModuleEvent} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    public listenerCount(event: ModuleEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Gets an array of all module event names that have listeners.
     * @returns {ModuleEvent[]} An array of event names.
     */
    public eventNames(): ModuleEvent[] {
        return this.eventEmitter.eventNames();
    }

    // =============================================================================
    // PRIVATE UTILITY METHODS
    // =============================================================================

    /**
     * Ensures the cache has enough capacity for a new entry, evicting items if necessary.
     * @private
     * @async
     * @param {number} sizeBytes - The size of the new entry in bytes.
     * @returns {Promise<void>}
     */
    private async ensureCapacity(sizeBytes: number): Promise<void> {
        // Check entry count limit
        if (this.cache.size >= this.config!.maxEntries) {
            await this.evictLRU(1);
        }

        // Check size limit
        if (this.currentSizeBytes + sizeBytes > this.config!.maxSizeBytes) {
            const bytesToFree = (this.currentSizeBytes + sizeBytes) - this.config!.maxSizeBytes;
            await this.evictToFreeBytes(bytesToFree);
        }
    }

    /**
     * Evicts a specified number of the least recently used (LRU) entries.
     * @private
     * @async
     * @param {number} count - The number of entries to evict.
     * @returns {Promise<void>}
     */
    private async evictLRU(count: number): Promise<void> {
        const sortedByAccess = Array.from(this.accessOrder.entries())
            .sort((a, b) => a[1] - b[1]) // Sort by access order (oldest first)
            .slice(0, count)
            .map(([key]) => key);

        for (const key of sortedByAccess) {
            await this.delete(key);
            this.stats.evictionCount++;
        }

        this.logger.debug('LRU eviction completed', {
            operation: 'evict-lru',
            evictedCount: sortedByAccess.length
        });
    }

    /**
     * Evicts entries until a specified number of bytes is freed.
     * @private
     * @async
     * @param {number} bytesToFree - The number of bytes to free up.
     * @returns {Promise<void>}
     */
    private async evictToFreeBytes(bytesToFree: number): Promise<void> {
        let freedBytes = 0;
        const sortedByAccess = Array.from(this.accessOrder.entries())
            .sort((a, b) => a[1] - b[1]); // Sort by access order (oldest first)

        for (const [key] of sortedByAccess) {
            const entry = this.cache.get(key);
            if (entry) {
                freedBytes += entry.sizeBytes;
                await this.delete(key);
                this.stats.evictionCount++;

                if (freedBytes >= bytesToFree) {
                    break;
                }
            }
        }

        this.logger.debug('Size-based eviction completed', {
            operation: 'evict-bytes',
            bytesToFree,
            freedBytes,
            evictedCount: this.stats.evictionCount
        });
    }

    /**
     * Performs the main cleanup operation, removing expired entries and evicting based on memory pressure.
     * @private
     * @async
     * @returns {Promise<{ expired: number; evicted: number }>} An object with the cleanup results.
     */
    private async performCleanup(): Promise<{ expired: number; evicted: number }> {
        const startTime = Date.now();
        let expiredCount = 0;
        let evictedCount = 0;

        // Remove expired entries
        const now = new Date();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && entry.expiresAt <= now) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            await this.delete(key);
            expiredCount++;
            this.stats.expirationCount++;
        }

        // Check memory pressure and evict if necessary
        const memoryUsageRatio = this.currentSizeBytes / this.config!.maxSizeBytes;
        if (memoryUsageRatio > this.config!.memoryPressureThreshold) {
            const targetSize = this.config!.maxSizeBytes * (this.config!.memoryPressureThreshold - 0.1);
            const bytesToFree = this.currentSizeBytes - targetSize;
            
            const beforeEvictionCount = this.stats.evictionCount;
            await this.evictToFreeBytes(bytesToFree);
            evictedCount = this.stats.evictionCount - beforeEvictionCount;
        }

        this.stats.lastCleanup = new Date();
        const duration = Date.now() - startTime;

        this.logger.debug('Cleanup completed', {
            operation: 'cleanup',
            expiredCount,
            evictedCount,
            duration,
            totalEntries: this.cache.size,
            memoryUsageRatio
        });

        return { expired: expiredCount, evicted: evictedCount };
    }

    /**
     * Estimates the size of a given value in bytes for memory tracking.
     * @private
     * @param {any} value - The value to estimate the size of.
     * @returns {number} The estimated size in bytes.
     */
    private estimateSize(value: any): number {
        if (value === null || value === undefined) {
            return 0;
        }

        if (typeof value === 'string') {
            return value.length * 2; // UTF-16 encoding
        }

        if (typeof value === 'number') {
            return 8; // 64-bit number
        }

        if (typeof value === 'boolean') {
            return 1;
        }

        if (value instanceof Date) {
            return 8;
        }

        // For objects and arrays, use JSON length as approximation
        try {
            return JSON.stringify(value).length * 2;
        } catch {
            return 1024; // Default estimate for non-serializable objects
        }
    }

    /**
     * Converts a glob-style pattern string (with '*') into a regular expression.
     * @private
     * @param {string} pattern - The glob pattern.
     * @returns {RegExp} The corresponding regular expression.
     */
    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*'); // Convert * to .*
        
        return new RegExp(`^${escaped}$`);
    }
}