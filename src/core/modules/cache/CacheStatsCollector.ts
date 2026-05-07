/**
 * @fileoverview Cache Statistics Collector Module
 * 
 * This file defines an advanced statistics collection and analytics system for
 * cache operations. It provides detailed metrics, performance analysis, and
 * historical data tracking for cache optimization and monitoring.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleAlreadyRegisteredError,
    ModuleNotInitializedError,
    PerformanceError
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
import type { CacheManager, CacheStats } from './CacheManager.js';
import type { MetricsCollector } from '../performance/MetricsCollector.js';
import { PerformanceMetric, MetricType } from '../performance/PerformanceMonitor.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @interface CacheStatsConfig
 * @description Defines the configuration for the cache statistics collector.
 */
export interface CacheStatsConfig {
    /** The interval in milliseconds at which to collect statistics. */
    collectionInterval: number;
    /** If true, enables detailed tracking of statistics for individual keys. */
    enableKeyTracking: boolean;
    /** The maximum number of individual keys to track. */
    maxTrackedKeys: number;
    /** If true, enables correlation analysis with performance metrics. */
    enablePerformanceCorrelation: boolean;
    /** The retention period in milliseconds for historical metrics data. */
    dataRetentionMs: number;
    /** If true, enables real-time alerting for performance issues. */
    enableAlerting: boolean;
    /** The cache efficiency score threshold (0-1) below which an alert is triggered. */
    efficiencyThreshold: number;
    /** The memory usage ratio threshold (0-1) above which an alert is triggered. */
    memoryThreshold: number;
}

/**
 * @interface KeyStatistics
 * @description Holds detailed statistics for a single cache key.
 */
export interface KeyStatistics {
    /** The cache key. */
    key: string;
    /** The total number of times the key has been accessed. */
    totalAccesses: number;
    /** The number of times the key resulted in a cache hit. */
    hitCount: number;
    /** The number of times the key resulted in a cache miss. */
    missCount: number;
    /** The hit ratio for the key (hits / total accesses), from 0 to 1. */
    hitRatio: number;
    /** The average time in milliseconds between accesses to this key. */
    averageAccessInterval: number;
    /** The timestamp of the most recent access. */
    lastAccessed: Date;
    /** The timestamp of the first recorded access. */
    firstAccessed: Date;
    /** The current size of the cached value in bytes. */
    currentSizeBytes: number;
    /** The average size of the cached value in bytes over time. */
    averageSizeBytes: number;
    /** The total number of bytes transferred for this key. */
    totalBytesTransferred: number;
    /** The frequency of access, measured in accesses per hour. */
    accessFrequency: number;
    /** A measure of how effectively the TTL is being used, from 0 to 1. */
    ttlUtilization: number;
}

/**
 * @interface CachePerformanceMetrics
 * @description Represents a snapshot of cache performance metrics at a specific point in time.
 */
export interface CachePerformanceMetrics {
    /** The timestamp when the metrics were recorded. */
    timestamp: Date;
    /** The cache hit ratio at the time of recording, from 0 to 1. */
    hitRatio: number;
    /** The total number of entries in the cache. */
    entryCount: number;
    /** The total memory usage of the cache in bytes. */
    memoryUsageBytes: number;
    /** The ratio of current memory usage to the maximum allowed size, from 0 to 1. */
    memoryUtilization: number;
    /** The rate of evictions, measured in evictions per minute. */
    evictionRate: number;
    /** The rate of expirations, measured in expirations per minute. */
    expirationRate: number;
    /** The average response time for cache operations in milliseconds. */
    averageResponseTime: number;
    /** The number of cache operations (gets, sets) per second. */
    throughput: number;
    /** The ratio of failed cache operations to total operations, from 0 to 1. */
    errorRate: number;
}

/**
 * @interface CacheEfficiencyAnalysis
 * @description Provides an analysis of the cache's overall efficiency.
 */
export interface CacheEfficiencyAnalysis {
    /** An overall efficiency score from 0 to 100. */
    score: number;
    /** A score based on the cache's hit ratio, from 0 to 100. */
    hitRatioScore: number;
    /** A score based on how effectively memory is being used, from 0 to 100. */
    memoryEfficiencyScore: number;
    /** A score indicating how well TTLs are optimized, from 0 to 100. */
    ttlEfficiencyScore: number;
    /** A score for the effectiveness of the current eviction strategy, from 0 to 100. */
    evictionEfficiencyScore: number;
    /** The performance trend of the cache ('improving', 'degrading', or 'stable'). */
    trend: 'improving' | 'degrading' | 'stable';
    /** A list of identified issues affecting cache performance. */
    issues: string[];
    /** A list of recommendations to improve cache efficiency. */
    recommendations: string[];
}

/**
 * @interface CacheUsagePattern
 * @description Represents a detected usage pattern in the cache.
 */
export interface CacheUsagePattern {
    /** The type of pattern detected (e.g., 'hotspot', 'cold_data'). */
    type: 'hotspot' | 'cold_data' | 'temporal' | 'size_outlier' | 'ttl_mismatch';
    /** A description of the detected pattern. */
    description: string;
    /** A list of keys affected by this pattern. */
    affectedKeys: string[];
    /** The severity of the pattern's impact on performance. */
    severity: 'low' | 'medium' | 'high';
    /** The confidence level of the pattern detection, from 0 to 1. */
    confidence: number;
    /** A list of suggested actions to address the pattern. */
    suggestedActions: string[];
}

/**
 * @interface CacheAnalytics
 * @description Provides a comprehensive set of analytics for the cache.
 */
export interface CacheAnalytics {
    /** The timestamp when the analytics were generated. */
    timestamp: Date;
    /** The time period in milliseconds that was analyzed. */
    periodMs: number;
    /** The basic cache statistics for the period. */
    basicStats: CacheStats;
    /** An analysis of the cache's efficiency. */
    efficiency: CacheEfficiencyAnalysis;
    /** A list of the top-performing keys. */
    topKeys: KeyStatistics[];
    /** A list of the most underperforming keys. */
    underperformingKeys: KeyStatistics[];
    /** A list of detected usage patterns. */
    patterns: CacheUsagePattern[];
    /** An analysis of performance trends. */
    trends: {
        hitRatio: 'improving' | 'degrading' | 'stable';
        memoryUsage: 'increasing' | 'decreasing' | 'stable';
        throughput: 'improving' | 'degrading' | 'stable';
    };
    /** A list of active alerts and warnings. */
    alerts: CacheAlert[];
}

/**
 * @interface CacheAlert
 * @description Defines an alert related to cache performance or state.
 */
export interface CacheAlert {
    /** The type of the alert (e.g., 'efficiency', 'memory'). */
    type: 'efficiency' | 'memory' | 'performance' | 'pattern';
    /** The severity level of the alert. */
    severity: 'info' | 'warning' | 'error' | 'critical';
    /** The alert message. */
    message: string;
    /** The timestamp when the alert was triggered. */
    timestamp: Date;
    /** The metric value that triggered the alert. */
    value?: number;
    /** The threshold that was crossed to trigger the alert. */
    threshold?: number;
    /** A list of recommended actions to resolve the alert. */
    actions: string[];
}

/**
 * @interface CacheStatsReport
 * @description Represents a detailed, structured report of cache statistics over a period.
 */
export interface CacheStatsReport {
    /** The timestamp when the report was generated. */
    generatedAt: Date;
    /** The start timestamp of the report period. */
    periodStart: Date;
    /** The end timestamp of the report period. */
    periodEnd: Date;
    /** A summary of key statistics over the period. */
    summary: {
        totalOperations: number;
        averageHitRatio: number;
        peakMemoryUsage: number;
        totalEvictions: number;
        totalExpirations: number;
    };
    /** The performance metrics at their peak during the period. */
    peakMetrics: CachePerformanceMetrics;
    /** The minimum performance metrics observed during the period. */
    minMetrics: CachePerformanceMetrics;
    /** The average performance metrics over the period. */
    avgMetrics: CachePerformanceMetrics;
    /** A list of the most frequently accessed keys. */
    mostAccessedKeys: KeyStatistics[];
    /** A list of the largest keys by size. */
    largestKeys: KeyStatistics[];
    /** An analysis of performance trends over the period. */
    trends: Array<{
        metric: string;
        trend: 'improving' | 'degrading' | 'stable';
        changePercent: number;
    }>;
    /** A list of key insights derived from the report data. */
    insights: string[];
}

// =============================================================================
// CACHE STATISTICS COLLECTOR CLASS
// =============================================================================

/**
 * @class CacheStatsCollector
 * @description An advanced statistics collection and analytics system that provides comprehensive
 * cache monitoring, performance analysis, and optimization insights.
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<ModuleEvent>}
 */
export class CacheStatsCollector implements BaseModule, ModuleEventEmitter<ModuleEvent> {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'cache-stats-collector';
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
     * @private 
     * @type {boolean}
     */
    private _initialized = false;
    /** 
     * @private 
     * @type {HSQLManager | undefined}
     */
    private manager?: HSQLManager;
    /** 
     * @private 
     * @type {CacheManager | undefined}
     */
    private cacheManager?: CacheManager;
    /** 
     * @private 
     * @type {MetricsCollector | undefined}
     */
    private metricsCollector?: MetricsCollector;
    /** 
     * @private 
     * @type {CacheStatsConfig | undefined}
     */
    private config?: CacheStatsConfig;
    /** 
     * @private 
     * @type {boolean}
     */
    private destroyed = false;
    /** 
     * @private 
     * @readonly
     * @type {number}
     */
    private readonly startTime = Date.now();
    /** 
     * @private 
     * @type {ModuleLogger}
     */
    private logger: ModuleLogger;
    /** 
     * @private 
     * @type {ModuleEventEmitterImpl<ModuleEvent>}
     */
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent>;

    /** 
     * @private 
     * @type {boolean}
     */
    private collecting = false;
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private collectionTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {Map<string, KeyStatistics>}
     */
    private keyStats: Map<string, KeyStatistics> = new Map();
    /** 
     * @private 
     * @type {CachePerformanceMetrics[]}
     */
    private metricsHistory: CachePerformanceMetrics[] = [];
    /** 
     * @private 
     * @type {Map<string, CacheAlert>}
     */
    private activeAlerts: Map<string, CacheAlert> = new Map();
    /** 
     * @private 
     * @type {number}
     */
    private lastCollection = Date.now();

    /**
     * Creates a new instance of the CacheStatsCollector.
     */
    constructor() {
        this.logger = createModuleLogger('CacheStatsCollector-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'CacheStatsCollector');

        // Initialize event listeners for module events
        this.eventEmitter.initializeEvents(Object.values(ModuleEvent));
    }

    /**
     * Initializes the cache statistics collector. This sets up configuration,
     * discovers related modules, and prepares for statistics gathering.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the provided manager is invalid.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('CacheStatsCollector', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing CacheStatsCollector v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();
        
        // Try to auto-discover related modules
        this.discoverRelatedModules();

        this._initialized = true;
        
        // Register with manager only if not already registered
        try {
            this.manager.registerModule(this);
        } catch (error) {
            if (error instanceof ModuleAlreadyRegisteredError) {
                this.logger.debug('Module already registered with manager', {
                    operation: 'initialize',
                    moduleName: this.name
                });
            } else {
                throw error;
            }
        }
        
        resourceCleaner.register(this);
        
        this.logger.info('CacheStatsCollector v1.0 initialized successfully', {
            operation: 'initialize-complete',
            collectionInterval: this.config?.collectionInterval,
            keyTrackingEnabled: this.config?.enableKeyTracking,
            maxTrackedKeys: this.config?.maxTrackedKeys
        });

        // Emit initialization event
        this.emit(ModuleEvent.INITIALIZED, createEventData('cache-stats-collector-initialized', {
            collectionInterval: this.config?.collectionInterval,
            keyTrackingEnabled: this.config?.enableKeyTracking,
            alertingEnabled: this.config?.enableAlerting
        }, this.name));
    }

    /**
     * Builds the collector's configuration from the HSQLManager's settings.
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
            collectionInterval: 30000, // 30 seconds
            enableKeyTracking: true,
            maxTrackedKeys: 1000,
            enablePerformanceCorrelation: true,
            dataRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
            enableAlerting: true,
            efficiencyThreshold: 0.7, // 70% hit ratio
            memoryThreshold: 0.9 // 90% memory usage
        };

        this.logger.debug('Configuration built for CacheStatsCollector', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Automatically discovers and links related modules like CacheManager and MetricsCollector.
     * @private
     */
    private discoverRelatedModules(): void {
        if (!this.manager) return;

        // Try to find CacheManager
        this.cacheManager = this.manager.getModule<CacheManager>('cache-manager');
        if (this.cacheManager) {
            this.logger.info('Auto-discovered CacheManager', {
                operation: 'discover-modules',
                module: 'cache-manager'
            });
        }

        // Try to find MetricsCollector
        this.metricsCollector = this.manager.getModule<MetricsCollector>('metrics-collector');
        if (this.metricsCollector) {
            this.logger.info('Auto-discovered MetricsCollector', {
                operation: 'discover-modules',
                module: 'metrics-collector'
            });
        }
    }

    /**
     * Sets the CacheManager instance to be monitored.
     * @param {CacheManager} cacheManager - The CacheManager instance.
     */
    public setCacheManager(cacheManager: CacheManager): void {
        this.cacheManager = cacheManager;
        this.logger.info('CacheManager set for statistics collection', {
            operation: 'set-cache-manager'
        });
    }

    /**
     * Sets the MetricsCollector instance for storing time-series data.
     * @param {MetricsCollector} metricsCollector - The MetricsCollector instance.
     */
    public setMetricsCollector(metricsCollector: MetricsCollector): void {
        this.metricsCollector = metricsCollector;
        this.logger.info('MetricsCollector set for time-series data', {
            operation: 'set-metrics-collector'
        });
    }

    /**
     * Starts the periodic collection of cache statistics.
     * @async
     * @returns {Promise<void>} A promise that resolves when collection has started.
     * @throws {ModuleNotInitializedError} If the collector is not initialized.
     * @throws {ConfigurationError} If the CacheManager has not been set.
     */
    public async startCollection(): Promise<void> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheStatsCollector', 'start collection', {
                operation: 'start-collection'
            });
        }

        if (!this.cacheManager) {
            throw new ConfigurationError('CacheManager not set', ['cacheManager'], {
                operation: 'start-collection'
            });
        }

        if (this.collecting) {
            this.logger.warn('Collection already started', {
                operation: 'start-collection'
            });
            return;
        }

        this.collecting = true;
        this.startCollectionTimer();

        this.logger.info('Cache statistics collection started', {
            operation: 'start-collection',
            interval: this.config?.collectionInterval
        });

        this.emit(ModuleEvent.STATUS_CHANGED, createEventData('collection-started', {
            interval: this.config?.collectionInterval,
            status: 'collecting'
        }, this.name));
    }

    /**
     * Stops the periodic collection of cache statistics.
     * @async
     * @returns {Promise<void>} A promise that resolves when collection has stopped.
     */
    public async stopCollection(): Promise<void> {
        if (!this.collecting) {
            return;
        }

        this.collecting = false;
        this.stopCollectionTimer();

        this.logger.info('Cache statistics collection stopped', {
            operation: 'stop-collection'
        });

        this.emit(ModuleEvent.STATUS_CHANGED, createEventData('collection-stopped', {
            status: 'stopped'
        }, this.name));
    }

    /**
     * Retrieves a comprehensive analytics report for the cache.
     * @async
     * @param {number} [periodMs=3600000] - The analysis period in milliseconds (default: 1 hour).
     * @returns {Promise<CacheAnalytics>} A promise that resolves with the cache analytics report.
     * @throws {ModuleNotInitializedError} If the collector is not initialized.
     * @throws {ConfigurationError} If the CacheManager has not been set.
     */
    public async getCacheAnalytics(periodMs: number = 60 * 60 * 1000): Promise<CacheAnalytics> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheStatsCollector', 'get analytics', {
                operation: 'get-analytics'
            });
        }

        if (!this.cacheManager) {
            throw new ConfigurationError('CacheManager not set', ['cacheManager'], {
                operation: 'get-analytics'
            });
        }

        const now = new Date();
        const basicStats = this.cacheManager.getStats();
        
        // Analyze efficiency
        const efficiency = this.analyzeEfficiency(basicStats, periodMs);
        
        // Get top and underperforming keys
        const topKeys = this.getTopKeys(10);
        const underperformingKeys = this.getUnderperformingKeys(10);
        
        // Detect usage patterns
        const patterns = this.detectUsagePatterns();
        
        // Analyze trends
        const trends = this.analyzeTrends(periodMs);
        
        // Get current alerts
        const alerts = Array.from(this.activeAlerts.values());

        return {
            timestamp: now,
            periodMs,
            basicStats,
            efficiency,
            topKeys,
            underperformingKeys,
            patterns,
            trends,
            alerts
        };
    }

    /**
     * Generates a detailed, structured report of cache statistics over a specified period.
     * @async
     * @param {'last_hour' | 'last_24h' | 'last_7d'} [period='last_24h'] - The reporting period.
     * @returns {Promise<CacheStatsReport>} A promise that resolves with the detailed statistics report.
     * @throws {ModuleNotInitializedError} If the collector is not initialized.
     * @throws {PerformanceError} If no metrics data is available for the period.
     */
    public async generateReport(period: 'last_hour' | 'last_24h' | 'last_7d' = 'last_24h'): Promise<CacheStatsReport> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('CacheStatsCollector', 'generate report', {
                operation: 'generate-report'
            });
        }

        const periodMs = this.getPeriodMs(period);
        const now = new Date();
        const periodStart = new Date(now.getTime() - periodMs);
        
        // Filter metrics for the period
        const periodMetrics = this.metricsHistory.filter(m => 
            m.timestamp >= periodStart && m.timestamp <= now
        );

        if (periodMetrics.length === 0) {
            throw new PerformanceError('No metrics data available for the specified period');
        }

        // Calculate summary statistics
        const summary = this.calculateSummaryStats(periodMetrics);
        
        // Find peak, min, and average metrics
        const peakMetrics = this.findPeakMetrics(periodMetrics);
        const minMetrics = this.findMinMetrics(periodMetrics);
        const avgMetrics = this.calculateAverageMetrics(periodMetrics);
        
        // Get top keys
        const mostAccessedKeys = this.getTopKeys(10);
        const largestKeys = this.getLargestKeys(10);
        
        // Analyze trends
        const trends = this.calculateTrends(periodMetrics);
        
        // Generate insights
        const insights = this.generateInsights(summary, trends, mostAccessedKeys);

        return {
            generatedAt: now,
            periodStart,
            periodEnd: now,
            summary,
            peakMetrics,
            minMetrics,
            avgMetrics,
            mostAccessedKeys,
            largestKeys,
            trends,
            insights
        };
    }

    /**
     * Gets the current statistics for individual keys, optionally filtered by a pattern.
     * @param {string} [keyPattern] - An optional pattern to filter keys (supports '*' wildcard).
     * @returns {KeyStatistics[]} An array of key statistics objects.
     */
    public getKeyStatistics(keyPattern?: string): KeyStatistics[] {
        let stats = Array.from(this.keyStats.values());
        
        if (keyPattern) {
            const regex = this.patternToRegex(keyPattern);
            stats = stats.filter(stat => regex.test(stat.key));
        }
        
        return stats.sort((a, b) => b.totalAccesses - a.totalAccesses);
    }

    /**
     * Records a cache access event to update key-level statistics.
     * @param {string} key - The cache key that was accessed.
     * @param {boolean} hit - True if the access was a cache hit.
     * @param {number} [sizeBytes] - The size of the cached value in bytes.
     * @param {number} [responseTime] - The response time of the cache operation in milliseconds.
     */
    public recordAccess(key: string, hit: boolean, sizeBytes?: number, responseTime?: number): void {
        if (!this.config?.enableKeyTracking) {
            return;
        }

        // Check if we're tracking too many keys
        if (this.keyStats.size >= this.config.maxTrackedKeys && !this.keyStats.has(key)) {
            // Remove least accessed key to make room
            this.evictLeastAccessedKey();
        }

        const now = new Date();
        let keyStats = this.keyStats.get(key);
        
        if (!keyStats) {
            keyStats = {
                key,
                totalAccesses: 0,
                hitCount: 0,
                missCount: 0,
                hitRatio: 0,
                averageAccessInterval: 0,
                lastAccessed: now,
                firstAccessed: now,
                currentSizeBytes: sizeBytes || 0,
                averageSizeBytes: sizeBytes || 0,
                totalBytesTransferred: 0,
                accessFrequency: 0,
                ttlUtilization: 0
            };
            this.keyStats.set(key, keyStats);
        }

        // Update statistics
        keyStats.totalAccesses++;
        if (hit) {
            keyStats.hitCount++;
        } else {
            keyStats.missCount++;
        }
        
        keyStats.hitRatio = keyStats.hitCount / keyStats.totalAccesses;
        
        // Update access interval
        const timeSinceLastAccess = now.getTime() - keyStats.lastAccessed.getTime();
        keyStats.averageAccessInterval = (keyStats.averageAccessInterval * (keyStats.totalAccesses - 1) + timeSinceLastAccess) / keyStats.totalAccesses;
        
        keyStats.lastAccessed = now;
        
        // Update size statistics
        if (sizeBytes !== undefined) {
            keyStats.currentSizeBytes = sizeBytes;
            keyStats.averageSizeBytes = (keyStats.averageSizeBytes * (keyStats.totalAccesses - 1) + sizeBytes) / keyStats.totalAccesses;
            keyStats.totalBytesTransferred += sizeBytes;
        }
        
        // Calculate access frequency (accesses per hour)
        const timeSpan = now.getTime() - keyStats.firstAccessed.getTime();
        keyStats.accessFrequency = timeSpan > 0 ? (keyStats.totalAccesses / timeSpan) * (60 * 60 * 1000) : 0;
    }

    /**
     * Clears all collected statistics, including key stats and historical data.
     */
    public clearStatistics(): void {
        this.keyStats.clear();
        this.metricsHistory.length = 0;
        this.activeAlerts.clear();
        
        this.logger.info('All cache statistics cleared', {
            operation: 'clear-statistics'
        });
    }

    /**
     * Gets the current configuration of the statistics collector.
     * @returns {CacheStatsConfig | undefined} A copy of the current configuration, or undefined if not initialized.
     */
    public getConfiguration(): CacheStatsConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Destroys the collector, stopping all timers and cleaning up resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying CacheStatsCollector', {
            operation: 'destroy'
        });
        
        this.destroyed = true;
        this._initialized = false;

        // Stop collection
        await this.stopCollection();

        // Clear data
        this.clearStatistics();

        // Clear references
        this.manager = undefined;
        this.cacheManager = undefined;
        this.metricsCollector = undefined;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);
        
        this.logger.info('CacheStatsCollector destroyed successfully', {
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
    // PRIVATE IMPLEMENTATION METHODS
    // =============================================================================

    /**
     * Starts the timer for periodic statistics collection.
     * @private
     */
    private startCollectionTimer(): void {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
        }

        this.collectionTimer = setInterval(() => {
            this.performCollection().catch(error => {
                this.logger.error('Statistics collection failed', {
                    operation: 'collection-timer',
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        }, this.config!.collectionInterval);
    }

    /**
     * Stops the timer for periodic statistics collection.
     * @private
     */
    private stopCollectionTimer(): void {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = undefined;
        }
    }

    /**
     * Performs a single statistics collection cycle.
     * @private
     * @async
     */
    private async performCollection(): Promise<void> {
        if (!this.cacheManager) {
            return;
        }

        const now = new Date();
        const basicStats = this.cacheManager.getStats();
        
        // Calculate performance metrics
        const timeSinceLastCollection = now.getTime() - this.lastCollection;
        const metrics: CachePerformanceMetrics = {
            timestamp: now,
            hitRatio: basicStats.hitRatio,
            entryCount: basicStats.totalEntries,
            memoryUsageBytes: basicStats.totalSizeBytes,
            memoryUtilization: basicStats.totalSizeBytes / (100 * 1024 * 1024), // Assuming 100MB max
            evictionRate: (basicStats.evictionCount / timeSinceLastCollection) * 60 * 1000, // per minute
            expirationRate: (basicStats.expirationCount / timeSinceLastCollection) * 60 * 1000, // per minute
            averageResponseTime: 0, // Would need integration with performance monitoring
            throughput: ((basicStats.hitCount + basicStats.missCount) / timeSinceLastCollection) * 1000, // per second
            errorRate: 0 // Would need error tracking
        };

        // Store metrics
        this.metricsHistory.push(metrics);
        
        // Cleanup old metrics based on retention period
        this.cleanupOldMetrics();
        
        // Check for alerts
        this.checkAlerts(metrics, basicStats);
        
        // Store to MetricsCollector if available
        if (this.metricsCollector) {
            try {
                // Store key metrics as time-series data using collectMetric method
                const hitRatioMetric: PerformanceMetric = {
                    type: MetricType.OPERATIONS_PER_SECOND, // Using closest available metric type
                    value: metrics.hitRatio,
                    unit: 'ratio',
                    timestamp: now,
                    source: 'cache-stats-collector',
                    context: { module: 'cache', metricType: 'hit-ratio' },
                    tags: ['cache', 'hit-ratio', 'performance']
                };
                
                const memoryMetric: PerformanceMetric = {
                    type: MetricType.MEMORY_USAGE,
                    value: metrics.memoryUsageBytes,
                    unit: 'bytes',
                    timestamp: now,
                    source: 'cache-stats-collector',
                    context: { module: 'cache' },
                    tags: ['cache', 'memory', 'usage']
                };
                
                this.metricsCollector.collectMetric(hitRatioMetric);
                this.metricsCollector.collectMetric(memoryMetric);
            } catch (error) {
                this.logger.warn('Failed to store metrics to MetricsCollector', {
                    operation: 'store-metrics',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        this.lastCollection = now.getTime();
    }

    /**
     * Analyzes the efficiency of the cache based on current statistics.
     * @private
     * @param {CacheStats} stats - The current cache statistics.
     * @param {number} periodMs - The analysis period in milliseconds.
     * @returns {CacheEfficiencyAnalysis} The results of the efficiency analysis.
     */
    private analyzeEfficiency(stats: CacheStats, periodMs: number): CacheEfficiencyAnalysis {
        // Calculate component scores
        const hitRatioScore = Math.min(100, stats.hitRatio * 100);
        const memoryEfficiencyScore = 100 - (stats.totalSizeBytes / (100 * 1024 * 1024)) * 100;
        const ttlEfficiencyScore = 80; // Placeholder - would need TTL analysis
        const evictionEfficiencyScore = stats.evictionCount < 10 ? 100 : Math.max(0, 100 - stats.evictionCount);
        
        // Overall score is weighted average
        const score = (hitRatioScore * 0.4 + memoryEfficiencyScore * 0.3 + ttlEfficiencyScore * 0.2 + evictionEfficiencyScore * 0.1);
        
        // Determine trend
        const recentMetrics = this.metricsHistory.slice(-10);
        let trend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (recentMetrics.length >= 5) {
            const oldAvg = recentMetrics.slice(0, 5).reduce((sum, m) => sum + m.hitRatio, 0) / 5;
            const newAvg = recentMetrics.slice(-5).reduce((sum, m) => sum + m.hitRatio, 0) / 5;
            if (newAvg > oldAvg + 0.05) trend = 'improving';
            else if (newAvg < oldAvg - 0.05) trend = 'degrading';
        }
        
        // Identify issues and recommendations
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        if (hitRatioScore < 70) {
            issues.push('Low cache hit ratio');
            recommendations.push('Review cache TTL settings and access patterns');
        }
        
        if (memoryEfficiencyScore < 50) {
            issues.push('High memory usage');
            recommendations.push('Consider reducing cache size or implementing compression');
        }
        
        if (stats.evictionCount > 100) {
            issues.push('High eviction rate');
            recommendations.push('Increase cache size or optimize eviction strategy');
        }

        return {
            score,
            hitRatioScore,
            memoryEfficiencyScore,
            ttlEfficiencyScore,
            evictionEfficiencyScore,
            trend,
            issues,
            recommendations
        };
    }

    /**
     * Gets the top-performing keys based on a combined score of hit ratio and access frequency.
     * @private
     * @param {number} limit - The number of keys to return.
     * @returns {KeyStatistics[]} An array of the top-performing keys.
     */
    private getTopKeys(limit: number): KeyStatistics[] {
        return Array.from(this.keyStats.values())
            .sort((a, b) => {
                // Sort by combined score: hit ratio * access frequency
                const scoreA = a.hitRatio * a.accessFrequency;
                const scoreB = b.hitRatio * b.accessFrequency;
                return scoreB - scoreA;
            })
            .slice(0, limit);
    }

    /**
     * Gets the most underperforming keys, typically those with a low hit ratio or infrequent access.
     * @private
     * @param {number} limit - The number of keys to return.
     * @returns {KeyStatistics[]} An array of the underperforming keys.
     */
    private getUnderperformingKeys(limit: number): KeyStatistics[] {
        return Array.from(this.keyStats.values())
            .filter(stat => stat.hitRatio < 0.5 || stat.accessFrequency < 1) // Low hit ratio or infrequent access
            .sort((a, b) => a.hitRatio - b.hitRatio) // Sort by worst hit ratio first
            .slice(0, limit);
    }

    /**
     * Gets the largest keys currently in the cache by their value size.
     * @private
     * @param {number} limit - The number of keys to return.
     * @returns {KeyStatistics[]} An array of the largest keys.
     */
    private getLargestKeys(limit: number): KeyStatistics[] {
        return Array.from(this.keyStats.values())
            .sort((a, b) => b.currentSizeBytes - a.currentSizeBytes)
            .slice(0, limit);
    }

    /**
     * Detects common usage patterns in the cache, such as hotspots and cold data.
     * @private
     * @returns {CacheUsagePattern[]} An array of detected usage patterns.
     */
    private detectUsagePatterns(): CacheUsagePattern[] {
        const patterns: CacheUsagePattern[] = [];
        
        // Detect hotspots (very frequently accessed keys)
        const hotspotKeys = Array.from(this.keyStats.values())
            .filter(stat => stat.accessFrequency > 100) // More than 100 accesses per hour
            .map(stat => stat.key);
        
        if (hotspotKeys.length > 0) {
            patterns.push({
                type: 'hotspot',
                description: `${hotspotKeys.length} keys are being accessed very frequently`,
                affectedKeys: hotspotKeys,
                severity: hotspotKeys.length > 10 ? 'high' : 'medium',
                confidence: 0.9,
                suggestedActions: ['Consider increasing TTL for hotspot keys', 'Optimize hotspot key data structures']
            });
        }
        
        // Detect cold data (rarely accessed keys)
        const coldKeys = Array.from(this.keyStats.values())
            .filter(stat => stat.accessFrequency < 1 && stat.totalAccesses > 10) // Less than 1 access per hour but has been accessed
            .map(stat => stat.key);
        
        if (coldKeys.length > 0) {
            patterns.push({
                type: 'cold_data',
                description: `${coldKeys.length} keys are rarely accessed and may be candidates for removal`,
                affectedKeys: coldKeys,
                severity: 'low',
                confidence: 0.8,
                suggestedActions: ['Consider shorter TTL for cold data', 'Review if cold data is still needed']
            });
        }
        
        // Detect size outliers (unusually large cached values)
        const avgSize = Array.from(this.keyStats.values())
            .reduce((sum, stat) => sum + stat.currentSizeBytes, 0) / this.keyStats.size;
        
        const sizeOutliers = Array.from(this.keyStats.values())
            .filter(stat => stat.currentSizeBytes > avgSize * 10) // 10x larger than average
            .map(stat => stat.key);
        
        if (sizeOutliers.length > 0) {
            patterns.push({
                type: 'size_outlier',
                description: `${sizeOutliers.length} keys have unusually large cached values`,
                affectedKeys: sizeOutliers,
                severity: 'medium',
                confidence: 0.9,
                suggestedActions: ['Consider compression for large values', 'Review if full data needs to be cached']
            });
        }
        
        return patterns;
    }

    /**
     * Analyzes performance trends over a given period.
     * @private
     * @param {number} periodMs - The analysis period in milliseconds.
     * @returns {object} An object containing trend analysis for key metrics.
     */
    private analyzeTrends(periodMs: number): {
        hitRatio: 'improving' | 'degrading' | 'stable';
        memoryUsage: 'increasing' | 'decreasing' | 'stable';
        throughput: 'improving' | 'degrading' | 'stable';
    } {
        const recentMetrics = this.metricsHistory.slice(-20); // Last 20 data points
        
        if (recentMetrics.length < 10) {
            return {
                hitRatio: 'stable',
                memoryUsage: 'stable',
                throughput: 'stable'
            };
        }
        
        const midPoint = Math.floor(recentMetrics.length / 2);
        const firstHalf = recentMetrics.slice(0, midPoint);
        const secondHalf = recentMetrics.slice(midPoint);
        
        // Hit ratio trend
        const firstHitRatio = firstHalf.reduce((sum, m) => sum + m.hitRatio, 0) / firstHalf.length;
        const secondHitRatio = secondHalf.reduce((sum, m) => sum + m.hitRatio, 0) / secondHalf.length;
        const hitRatioTrend = secondHitRatio > firstHitRatio + 0.05 ? 'improving' :
                             secondHitRatio < firstHitRatio - 0.05 ? 'degrading' : 'stable';
        
        // Memory usage trend
        const firstMemory = firstHalf.reduce((sum, m) => sum + m.memoryUsageBytes, 0) / firstHalf.length;
        const secondMemory = secondHalf.reduce((sum, m) => sum + m.memoryUsageBytes, 0) / secondHalf.length;
        const memoryTrend = secondMemory > firstMemory * 1.1 ? 'increasing' :
                           secondMemory < firstMemory * 0.9 ? 'decreasing' : 'stable';
        
        // Throughput trend
        const firstThroughput = firstHalf.reduce((sum, m) => sum + m.throughput, 0) / firstHalf.length;
        const secondThroughput = secondHalf.reduce((sum, m) => sum + m.throughput, 0) / secondHalf.length;
        const throughputTrend = secondThroughput > firstThroughput * 1.1 ? 'improving' :
                               secondThroughput < firstThroughput * 0.9 ? 'degrading' : 'stable';
        
        return {
            hitRatio: hitRatioTrend,
            memoryUsage: memoryTrend,
            throughput: throughputTrend
        };
    }

    /**
     * Checks for and creates alerts based on predefined thresholds.
     * @private
     * @param {CachePerformanceMetrics} metrics - The current performance metrics.
     * @param {CacheStats} stats - The current basic cache statistics.
     */
    private checkAlerts(metrics: CachePerformanceMetrics, stats: CacheStats): void {
        const now = new Date();
        
        // Check efficiency alert
        if (metrics.hitRatio < this.config!.efficiencyThreshold) {
            const alertKey = 'low-efficiency';
            if (!this.activeAlerts.has(alertKey)) {
                const alert: CacheAlert = {
                    type: 'efficiency',
                    severity: metrics.hitRatio < 0.5 ? 'critical' : 'warning',
                    message: `Cache hit ratio (${(metrics.hitRatio * 100).toFixed(1)}%) is below threshold (${(this.config!.efficiencyThreshold * 100).toFixed(1)}%)`,
                    timestamp: now,
                    value: metrics.hitRatio,
                    threshold: this.config!.efficiencyThreshold,
                    actions: ['Review cache TTL settings', 'Analyze access patterns', 'Consider cache warming']
                };
                this.activeAlerts.set(alertKey, alert);
                
                this.logger.warn('Cache efficiency alert triggered', {
                    operation: 'alert-check',
                    alertType: 'efficiency',
                    hitRatio: metrics.hitRatio,
                    threshold: this.config!.efficiencyThreshold
                });
            }
        } else {
            this.activeAlerts.delete('low-efficiency');
        }
        
        // Check memory alert
        if (metrics.memoryUtilization > this.config!.memoryThreshold) {
            const alertKey = 'high-memory';
            if (!this.activeAlerts.has(alertKey)) {
                const alert: CacheAlert = {
                    type: 'memory',
                    severity: metrics.memoryUtilization > 0.95 ? 'critical' : 'warning',
                    message: `Cache memory usage (${(metrics.memoryUtilization * 100).toFixed(1)}%) is above threshold (${(this.config!.memoryThreshold * 100).toFixed(1)}%)`,
                    timestamp: now,
                    value: metrics.memoryUtilization,
                    threshold: this.config!.memoryThreshold,
                    actions: ['Increase cache size', 'Reduce TTL values', 'Enable compression']
                };
                this.activeAlerts.set(alertKey, alert);
                
                this.logger.warn('Cache memory alert triggered', {
                    operation: 'alert-check',
                    alertType: 'memory',
                    memoryUtilization: metrics.memoryUtilization,
                    threshold: this.config!.memoryThreshold
                });
            }
        } else {
            this.activeAlerts.delete('high-memory');
        }
    }

    /**
     * Cleans up old metrics from the history based on the configured retention period.
     * @private
     */
    private cleanupOldMetrics(): void {
        const cutoffTime = new Date(Date.now() - this.config!.dataRetentionMs);
        const initialCount = this.metricsHistory.length;
        
        this.metricsHistory = this.metricsHistory.filter(metric => 
            metric.timestamp >= cutoffTime
        );
        
        const removedCount = initialCount - this.metricsHistory.length;
        if (removedCount > 0) {
            this.logger.debug('Old metrics cleaned up', {
                operation: 'cleanup-metrics',
                removedCount,
                remainingCount: this.metricsHistory.length
            });
        }
    }

    /**
     * Evicts the least accessed key from the statistics tracking to make room for new keys.
     * @private
     */
    private evictLeastAccessedKey(): void {
        let leastAccessedKey: string | null = null;
        let minAccesses = Infinity;
        
        for (const [key, stats] of this.keyStats.entries()) {
            if (stats.totalAccesses < minAccesses) {
                minAccesses = stats.totalAccesses;
                leastAccessedKey = key;
            }
        }
        
        if (leastAccessedKey) {
            this.keyStats.delete(leastAccessedKey);
            this.logger.debug('Evicted least accessed key from statistics', {
                operation: 'evict-key-stats',
                key: leastAccessedKey,
                accesses: minAccesses
            });
        }
    }

    /**
     * Converts a period string (e.g., 'last_hour') into milliseconds.
     * @private
     * @param {string} period - The period string.
     * @returns {number} The period in milliseconds.
     */
    private getPeriodMs(period: string): number {
        switch (period) {
            case 'last_hour': return 60 * 60 * 1000;
            case 'last_24h': return 24 * 60 * 60 * 1000;
            case 'last_7d': return 7 * 24 * 60 * 60 * 1000;
            default: return 24 * 60 * 60 * 1000;
        }
    }

    /**
     * Calculates summary statistics from a set of performance metrics.
     * @private
     * @param {CachePerformanceMetrics[]} metrics - The metrics to summarize.
     * @returns {object} An object containing the summary statistics.
     */
    private calculateSummaryStats(metrics: CachePerformanceMetrics[]): {
        totalOperations: number;
        averageHitRatio: number;
        peakMemoryUsage: number;
        totalEvictions: number;
        totalExpirations: number;
    } {
        const totalOperations = metrics.reduce((sum, m) => sum + m.throughput, 0);
        const averageHitRatio = metrics.reduce((sum, m) => sum + m.hitRatio, 0) / metrics.length;
        const peakMemoryUsage = Math.max(...metrics.map(m => m.memoryUsageBytes));
        
        return {
            totalOperations,
            averageHitRatio,
            peakMemoryUsage,
            totalEvictions: 0, // Would need tracking
            totalExpirations: 0 // Would need tracking
        };
    }

    /**
     * Finds the peak performance metrics from a set of historical data.
     * @private
     * @param {CachePerformanceMetrics[]} metrics - The metrics to analyze.
     * @returns {CachePerformanceMetrics} The set of metrics from the peak performance point.
     */
    private findPeakMetrics(metrics: CachePerformanceMetrics[]): CachePerformanceMetrics {
        return metrics.reduce((peak, current) => {
            return current.throughput > peak.throughput ? current : peak;
        });
    }

    /**
     * Finds the minimum performance metrics from a set of historical data.
     * @private
     * @param {CachePerformanceMetrics[]} metrics - The metrics to analyze.
     * @returns {CachePerformanceMetrics} The set of metrics from the lowest performance point.
     */
    private findMinMetrics(metrics: CachePerformanceMetrics[]): CachePerformanceMetrics {
        return metrics.reduce((min, current) => {
            return current.hitRatio < min.hitRatio ? current : min;
        });
    }

    /**
     * Calculates the average performance metrics over a given set of data.
     * @private
     * @param {CachePerformanceMetrics[]} metrics - The metrics to average.
     * @returns {CachePerformanceMetrics} An object containing the average of each metric.
     */
    private calculateAverageMetrics(metrics: CachePerformanceMetrics[]): CachePerformanceMetrics {
        const count = metrics.length;
        return {
            timestamp: new Date(), // Current time for average
            hitRatio: metrics.reduce((sum, m) => sum + m.hitRatio, 0) / count,
            entryCount: metrics.reduce((sum, m) => sum + m.entryCount, 0) / count,
            memoryUsageBytes: metrics.reduce((sum, m) => sum + m.memoryUsageBytes, 0) / count,
            memoryUtilization: metrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / count,
            evictionRate: metrics.reduce((sum, m) => sum + m.evictionRate, 0) / count,
            expirationRate: metrics.reduce((sum, m) => sum + m.expirationRate, 0) / count,
            averageResponseTime: metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / count,
            throughput: metrics.reduce((sum, m) => sum + m.throughput, 0) / count,
            errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / count
        };
    }

    /**
     * Calculates performance trends from a set of historical metrics.
     * @private
     * @param {CachePerformanceMetrics[]} metrics - The metrics to analyze.
     * @returns {Array} An array of objects describing the trend for each key metric.
     */
    private calculateTrends(metrics: CachePerformanceMetrics[]): Array<{
        metric: string;
        trend: 'improving' | 'degrading' | 'stable';
        changePercent: number;
    }> {
        if (metrics.length < 2) {
            return [];
        }
        
        const first = metrics[0];
        const last = metrics[metrics.length - 1];
        
        const trends = [
            {
                metric: 'Hit Ratio',
                trend: this.getTrend(first.hitRatio, last.hitRatio),
                changePercent: ((last.hitRatio - first.hitRatio) / first.hitRatio) * 100
            },
            {
                metric: 'Memory Usage',
                trend: this.getTrend(first.memoryUsageBytes, last.memoryUsageBytes, true), // Reverse for memory (lower is better)
                changePercent: ((last.memoryUsageBytes - first.memoryUsageBytes) / first.memoryUsageBytes) * 100
            },
            {
                metric: 'Throughput',
                trend: this.getTrend(first.throughput, last.throughput),
                changePercent: ((last.throughput - first.throughput) / first.throughput) * 100
            }
        ];
        
        return trends;
    }

    /**
     * Determines the trend direction ('improving', 'degrading', 'stable') between two values.
     * @private
     * @param {number} oldValue - The starting value.
     * @param {number} newValue - The ending value.
     * @param {boolean} [reverse=false] - If true, a decrease is considered an improvement (e.g., for memory usage).
     * @returns {'improving' | 'degrading' | 'stable'} The trend direction.
     */
    private getTrend(oldValue: number, newValue: number, reverse: boolean = false): 'improving' | 'degrading' | 'stable' {
        const changePercent = Math.abs((newValue - oldValue) / oldValue);
        
        if (changePercent < 0.05) { // Less than 5% change
            return 'stable';
        }
        
        const improving = newValue > oldValue;
        return reverse ? (improving ? 'degrading' : 'improving') : (improving ? 'improving' : 'degrading');
    }

    /**
     * Generates human-readable insights from the analyzed statistics and trends.
     * @private
     * @param {object} summary - The summary statistics.
     * @param {Array} trends - The calculated performance trends.
     * @param {KeyStatistics[]} topKeys - The top-performing keys.
     * @returns {string[]} An array of insight strings.
     */
    private generateInsights(summary: any, trends: any[], topKeys: KeyStatistics[]): string[] {
        const insights: string[] = [];
        
        // Hit ratio insights
        if (summary.averageHitRatio > 0.8) {
            insights.push('Cache is performing well with high hit ratio');
        } else if (summary.averageHitRatio < 0.5) {
            insights.push('Cache hit ratio is low, consider reviewing cache strategy');
        }
        
        // Top keys insights
        if (topKeys.length > 0) {
            const topKey = topKeys[0];
            insights.push(`Most accessed key: "${topKey.key}" with ${topKey.totalAccesses} accesses`);
        }
        
        // Trend insights
        const hitRatioTrend = trends.find(t => t.metric === 'Hit Ratio');
        if (hitRatioTrend) {
            if (hitRatioTrend.trend === 'improving') {
                insights.push('Cache hit ratio is improving over time');
            } else if (hitRatioTrend.trend === 'degrading') {
                insights.push('Cache hit ratio is declining, investigation needed');
            }
        }
        
        return insights;
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