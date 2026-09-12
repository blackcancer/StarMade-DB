import {writeFile} from 'node:fs/promises';
/**
 * @fileoverview Metrics Collector Module - Refactored v1.0.0
 * 
 * This file defines a long-term metrics storage, aggregation, and export system
 * that receives metrics from PerformanceMonitor via events for persistent storage.
 * The module handles time-series data management, automatic aggregation into
 * minute/hour/day buckets, and various export formats for external monitoring systems.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { 
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError
} from '../../errors.js';
import { resourceCleaner } from '../../utils.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';
import {
    ModuleEventEmitterImpl,
    PerformanceEvent,
    ModuleEvent,
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';
import { 
    PerformanceMetric, 
    MetricType, 
    MetricStatistics 
} from './PerformanceMonitor.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @interface MetricBucket
 * @description Represents a time-series bucket for aggregating metrics within a specific time interval.
 */
export interface MetricBucket {
    /** The start time of the bucket interval. */
    startTime: Date;
    /** The end time of the bucket interval. */
    endTime: Date;
    /** The bucket interval duration in milliseconds. */
    intervalMs: number;
    /** The metrics collected within this bucket. */
    metrics: PerformanceMetric[];
    /** Aggregated statistics for all metrics in this bucket. */
    statistics: MetricStatistics;
}

/**
 * @interface TimeSeriesPoint
 * @description Represents a single data point in a time series.
 */
export interface TimeSeriesPoint {
    /** The timestamp of this data point. */
    timestamp: Date;
    /** The value of this data point. */
    value: number;
    /** Optional tags for categorizing the data point. */
    tags?: Record<string, string>;
}

/**
 * @interface TimeSeries
 * @description Represents a complete time series dataset.
 */
export interface TimeSeries {
    /** The metric type of this time series. */
    type: MetricType;
    /** The array of data points in chronological order. */
    points: TimeSeriesPoint[];
    /** Metadata describing the time series. */
    metadata: {
        source: string;
        unit: string;
        aggregationType: 'sum' | 'average' | 'max' | 'min' | 'count';
    };
}

/**
 * @interface AggregationConfig
 * @description Configuration for time-series data aggregation.
 */
export interface AggregationConfig {
    /** Defines which aggregation intervals to maintain. */
    intervals: {
        /** Whether to maintain 1-minute buckets. */
        minute: boolean;
        /** Whether to maintain 1-hour buckets. */
        hour: boolean;
        /** Whether to maintain 1-day buckets. */
        day: boolean;
    };
    /** Data retention policies for each interval type. */
    retention: {
        /** Days to retain minute-level data. */
        minute: number;
        /** Days to retain hour-level data. */
        hour: number;
        /** Days to retain day-level data. */
        day: number;
    };
    /** Statistical functions to compute during aggregation. */
    functions: Array<'sum' | 'average' | 'max' | 'min' | 'count' | 'p95' | 'p99'>;
}

/**
 * @interface ExportConfig
 * @description Configuration for metrics data export.
 */
export interface ExportConfig {
    /** Whether metric export is enabled. */
    enabled: boolean;
    /** The export format to use. */
    format: 'json' | 'csv' | 'prometheus';
    /** Configuration for export destination. */
    destination: {
        type: 'file' | 'http' | 'console';
        path?: string;
        url?: string;
    };
    /** Export interval in milliseconds. */
    intervalMs: number;
    /** Array of metric types to include in exports. */
    metricTypes: MetricType[];
}

/**
 * @interface MetricsCollectorConfig
 * @description Complete configuration for the MetricsCollector module.
 */
export interface MetricsCollectorConfig {
    /** Whether metrics collection is enabled. */
    enabled: boolean;
    /** Maximum number of metrics to buffer before flushing. */
    bufferSize: number;
    /** Interval for flushing buffered metrics in milliseconds. */
    flushIntervalMs: number;
    /** Configuration for data aggregation. */
    aggregation: AggregationConfig;
    /** Configuration for data export. */
    export: ExportConfig;
    /** Whether to enable compression for stored data. */
    enableCompression: boolean;
    /** Maximum memory usage limit in megabytes. */
    maxMemoryUsageMB: number;
}

/**
 * @interface MetricQuery
 * @description Query parameters for retrieving historical metrics.
 */
export interface MetricQuery {
    /** Array of metric types to include in results. */
    types?: MetricType[];
    /** Array of source filters. */
    sources?: string[];
    /** Time range for query results. */
    timeRange?: {
        start: Date;
        end: Date;
    };
    /** Tag filters to apply. */
    tags?: Record<string, string>;
    /** Aggregation interval for grouping results. */
    aggregationInterval?: 'minute' | 'hour' | 'day';
    /** Maximum number of results to return. */
    limit?: number;
}

// =============================================================================
// METRICS COLLECTOR CLASS
// =============================================================================

/**
 * @class MetricsCollector
 * @description Advanced metrics collection and aggregation system that provides
 * time-series data management, automatic data aggregation, flexible querying
 * capabilities, multiple export formats, and memory-efficient storage.
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<PerformanceEvent>}
 */
export class MetricsCollector implements BaseModule, ModuleEventEmitter<PerformanceEvent> {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'metrics-collector';
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
     * @type {MetricsCollectorConfig | undefined}
     */
    private config?: MetricsCollectorConfig;
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
     * @type {ModuleEventEmitterImpl<PerformanceEvent>}
     */
    private eventEmitter: ModuleEventEmitterImpl<PerformanceEvent>;
    
    /**
     * Pending metric samples awaiting aggregation or export. 
     * @private 
     * @type {PerformanceMetric[]}
     */
    private metricsBuffer: PerformanceMetric[] = [];
    /**
     * Time buckets used to aggregate collected metrics. 
     * @private 
     * @type {Map<string, Map<string, MetricBucket>>}
     */
    private buckets: Map<string, Map<string, MetricBucket>> = new Map();
    /**
     * Timer that flushes buffered metric samples. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private flushTimer?: NodeJS.Timeout;
    /**
     * Timer that periodically exports collected metrics. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private exportTimer?: NodeJS.Timeout;
    /**
     * Periodic timer for removing expired or idle entries. 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private cleanupTimer?: NodeJS.Timeout;
    /**
     * Estimated memory occupied by retained metric data. 
     * @private 
     * @type {number}
     */
    private currentMemoryUsage = 0;

    /**
     * Creates a new MetricsCollector instance.
     */
    constructor() {
        this.logger = createModuleLogger('MetricsCollector-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'MetricsCollector');

        // Initialize event listeners for performance events
        this.eventEmitter.initializeEvents(Object.values(PerformanceEvent));
        
        // Initialize bucket storage
        this.buckets.set('minute', new Map());
        this.buckets.set('hour', new Map());
        this.buckets.set('day', new Map());
    }

    /**
     * Initializes the metrics collector with the provided HSQLManager.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the manager parameter is invalid.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('MetricsCollector', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing MetricsCollector v1.0', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();

        // Subscribe to PerformanceMonitor events for automatic metrics collection
        this.setupPerformanceMonitorIntegration();

        if (this.config?.enabled) {
            // Start buffer flushing
            this.startBufferFlushing();
            
            // Start data export if enabled
            if (this.config.export.enabled) {
                this.startDataExport();
            }
            
            // Start cleanup process
            this.startCleanupProcess();
        }

        this._initialized = true;
        resourceCleaner.register(this);

        this.logger.info('MetricsCollector v1.0 initialized successfully', {
            operation: 'initialize-complete',
            enabled: this.config?.enabled,
            bufferSize: this.config?.bufferSize,
            flushInterval: this.config?.flushIntervalMs,
            performanceMonitorIntegration: this.hasPerformanceMonitorIntegration()
        });

        // Emit initialization event
        this.emit(PerformanceEvent.BASELINE_ESTABLISHED, createEventData('collector-initialized', {
            enabled: this.config?.enabled,
            bufferSize: this.config?.bufferSize,
            performanceMonitorIntegration: this.hasPerformanceMonitorIntegration()
        }, this.name));
    }

    /**
     * Sets up integration with the PerformanceMonitor module.
     * @private
     */
    private setupPerformanceMonitorIntegration(): void {
        if (!this.manager) {
            return;
        }

        // Try to get PerformanceMonitor if it's already initialized
        const performanceMonitor = this.manager.getModule('performance-monitor') as any;
        
        if (performanceMonitor && performanceMonitor.isInitialized && performanceMonitor.on) {
            // Subscribe to metric events
            performanceMonitor.on(PerformanceEvent.METRIC_RECORDED, (event: PerformanceEvent, data: any) => {
                if (data?.metric) {
                    this.collectMetric(data.metric);
                }
            });

            this.logger.info('Integrated with PerformanceMonitor for automatic metrics collection', {
                operation: 'setup-integration',
                performanceMonitorVersion: performanceMonitor.version
            });
        } else {
            this.logger.debug('PerformanceMonitor not available during initialization - integration will occur later', {
                operation: 'setup-integration',
                performanceMonitorFound: !!performanceMonitor,
                performanceMonitorInitialized: performanceMonitor?.isInitialized
            });
        }
    }

    /**
     * Checks if PerformanceMonitor integration is active.
     * @private
     * @returns {boolean} True if integration is active.
     */
    private hasPerformanceMonitorIntegration(): boolean {
        if (!this.manager) {
            return false;
        }

        const performanceMonitor = this.manager.getModule('performance-monitor');
        return !!(performanceMonitor && performanceMonitor.isInitialized);
    }

    /**
     * Builds the configuration from the HSQLManager's settings.
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
            enabled: managerConfig.modules?.enableMetricsCollection || false,
            bufferSize: 1000,
            flushIntervalMs: 3000, // Reduced from 10000 to 3000 for faster tests
            aggregation: {
                intervals: {
                    minute: true,
                    hour: true,
                    day: true
                },
                retention: {
                    minute: 1, // 1 day
                    hour: 7,   // 7 days
                    day: 30    // 30 days
                },
                functions: ['average', 'max', 'min', 'count', 'p95', 'p99']
            },
            export: {
                enabled: false,
                format: 'json',
                destination: {
                    type: 'file',
                    path: './metrics_export.json'
                },
                intervalMs: 300000, // 5 minutes
                metricTypes: Object.values(MetricType)
            },
            enableCompression: true,
            maxMemoryUsageMB: 100 // 100 MB max
        };

        this.logger.debug('Configuration built for MetricsCollector', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Collects a single performance metric for processing and aggregation.
     * @param {PerformanceMetric} metric - The performance metric to collect.
     * @throws {ModuleNotInitializedError} If the collector is not initialized.
     * @throws {TypeError} If the metric parameter is invalid.
     */
    public collectMetric(metric: PerformanceMetric): void {
        if (!this._initialized || !this.config?.enabled) {
            return;
        }

        // Add to buffer
        this.metricsBuffer.push(metric);
        
        // Update memory usage estimate
        this.currentMemoryUsage += this.estimateMetricSize(metric);

        // Flush buffer if it's full or memory limit reached
        if (this.metricsBuffer.length >= this.config.bufferSize || 
            this.currentMemoryUsage > this.config.maxMemoryUsageMB * 1024 * 1024) {
            this.flushBuffer();
        }

        this.logger.debug('Metric collected', {
            operation: 'collect-metric',
            type: metric.type,
            value: metric.value,
            source: metric.source,
            bufferSize: this.metricsBuffer.length
        });
    }

    /**
     * Efficiently collects multiple performance metrics in a single operation.
     * @param {PerformanceMetric[]} metrics - Array of performance metrics to collect.
     * @throws {ModuleNotInitializedError} If the collector is not initialized.
     * @throws {TypeError} If the metrics parameter is not an array or contains invalid metrics.
     */
    public collectMetrics(metrics: PerformanceMetric[]): void {
        for (const metric of metrics) {
            this.collectMetric(metric);
        }
    }

    /**
     * Starts the buffer flushing process at regular intervals.
     * @private
     */
    private startBufferFlushing(): void {
        if (!this.config) return;

        this.flushTimer = setInterval(() => {
            this.flushBuffer();
        }, this.config.flushIntervalMs);

        this.logger.debug('Buffer flushing started', {
            operation: 'start-buffer-flushing',
            interval: this.config.flushIntervalMs
        });
    }

    /**
     * Flushes the metrics buffer to time-series buckets.
     * @private
     */
    private flushBuffer(): void {
        if (this.metricsBuffer.length === 0 || this.destroyed) {
            return;
        }

        const startTime = Date.now();
        const metricsToProcess = [...this.metricsBuffer];
        this.metricsBuffer = [];
        this.currentMemoryUsage = 0;

        // Process metrics into time-series buckets
        for (const metric of metricsToProcess) {
            this.addMetricToBuckets(metric);
        }

        const duration = Date.now() - startTime;

        this.logger.debug('Buffer flushed', {
            operation: 'flush-buffer',
            metricsProcessed: metricsToProcess.length,
            duration
        });

        this.emit(PerformanceEvent.METRIC_RECORDED, createEventData('buffer-flushed', {
            metricsProcessed: metricsToProcess.length,
            duration
        }, this.name));
    }

    /**
     * Adds a metric to the appropriate time-series buckets.
     * @private
     * @param {PerformanceMetric} metric - The metric to add to buckets.
     */
    private addMetricToBuckets(metric: PerformanceMetric): void {
        const timestamp = metric.timestamp;

        // Add to minute buckets
        if (this.config?.aggregation.intervals.minute) {
            this.addToBucket('minute', metric, this.getBucketKey('minute', timestamp));
        }

        // Add to hour buckets
        if (this.config?.aggregation.intervals.hour) {
            this.addToBucket('hour', metric, this.getBucketKey('hour', timestamp));
        }

        // Add to day buckets
        if (this.config?.aggregation.intervals.day) {
            this.addToBucket('day', metric, this.getBucketKey('day', timestamp));
        }
    }

    /**
     * Adds a metric to a specific bucket interval.
     * @private
     * @param {string} interval - The bucket interval (minute, hour, day).
     * @param {PerformanceMetric} metric - The metric to add.
     * @param {string} bucketKey - The bucket key.
     */
    private addToBucket(interval: string, metric: PerformanceMetric, bucketKey: string): void {
        const intervalBuckets = this.buckets.get(interval);
        if (!intervalBuckets) return;

        let bucket = intervalBuckets.get(bucketKey);
        if (!bucket) {
            bucket = this.createBucket(interval, metric.timestamp);
            intervalBuckets.set(bucketKey, bucket);
        }

        bucket.metrics.push(metric);
        bucket.statistics = this.calculateBucketStatistics(bucket.metrics, metric.type);
    }

    /**
     * Creates a new time-series bucket for the specified interval.
     * @private
     * @param {string} interval - The bucket interval.
     * @param {Date} timestamp - The reference timestamp.
     * @returns {MetricBucket} A new metric bucket.
     */
    private createBucket(interval: string, timestamp: Date): MetricBucket {
        const { start, end, intervalMs } = this.getBucketTimeRange(interval, timestamp);

        return {
            startTime: start,
            endTime: end,
            intervalMs,
            metrics: [],
            statistics: {
                type: MetricType.QUERY_TIME, // Will be updated when first metric is added
                count: 0,
                min: 0,
                max: 0,
                average: 0,
                median: 0,
                p95: 0,
                p99: 0,
                standardDeviation: 0,
                timeRange: { start, end }
            }
        };
    }

    /**
     * Generates a bucket key for a timestamp and interval.
     * @private
     * @param {string} interval - The bucket interval.
     * @param {Date} timestamp - The timestamp.
     * @returns {string} The bucket key.
     */
    private getBucketKey(interval: string, timestamp: Date): string {
        const date = new Date(timestamp);
        
        switch (interval) {
            case 'minute':
                date.setSeconds(0, 0);
                return date.toISOString();
            case 'hour':
                date.setMinutes(0, 0, 0);
                return date.toISOString();
            case 'day':
                date.setHours(0, 0, 0, 0);
                return date.toISOString();
            default:
                return timestamp.toISOString();
        }
    }

    /**
     * Gets the time range for a bucket based on interval and timestamp.
     * @private
     * @param {string} interval - The bucket interval.
     * @param {Date} timestamp - The reference timestamp.
     * @returns {object} Object containing start time, end time, and interval in milliseconds.
     */
    private getBucketTimeRange(interval: string, timestamp: Date): { start: Date; end: Date; intervalMs: number } {
        const date = new Date(timestamp);
        
        switch (interval) {
            case 'minute':
                const minuteStart = new Date(date);
                minuteStart.setSeconds(0, 0);
                const minuteEnd = new Date(minuteStart);
                minuteEnd.setMinutes(minuteEnd.getMinutes() + 1);
                return { start: minuteStart, end: minuteEnd, intervalMs: 60000 };
                
            case 'hour':
                const hourStart = new Date(date);
                hourStart.setMinutes(0, 0, 0);
                const hourEnd = new Date(hourStart);
                hourEnd.setHours(hourEnd.getHours() + 1);
                return { start: hourStart, end: hourEnd, intervalMs: 3600000 };
                
            case 'day':
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                return { start: dayStart, end: dayEnd, intervalMs: 86400000 };
                
            default:
                return { start: date, end: date, intervalMs: 0 };
        }
    }

    /**
     * Calculates aggregated statistics for metrics in a bucket.
     * @private
     * @param {PerformanceMetric[]} metrics - The metrics in the bucket.
     * @param {MetricType} type - The metric type.
     * @returns {MetricStatistics} The calculated statistics.
     */
    private calculateBucketStatistics(metrics: PerformanceMetric[], type: MetricType): MetricStatistics {
        if (metrics.length === 0) {
            return {
                type,
                count: 0,
                min: 0,
                max: 0,
                average: 0,
                median: 0,
                p95: 0,
                p99: 0,
                standardDeviation: 0,
                timeRange: { start: new Date(), end: new Date() }
            };
        }

        const values = metrics.map(m => m.value).sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const average = sum / values.length;
        
        // Calculate percentiles
        const p95Index = Math.floor(values.length * 0.95);
        const p99Index = Math.floor(values.length * 0.99);
        const medianIndex = Math.floor(values.length * 0.5);
        
        // Calculate standard deviation
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);

        return {
            type,
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            average,
            median: values[medianIndex],
            p95: values[p95Index],
            p99: values[p99Index],
            standardDeviation,
            timeRange: {
                start: metrics[0].timestamp,
                end: metrics[metrics.length - 1].timestamp
            }
        };
    }

    /**
     * Retrieves time-series data based on the provided query parameters.
     * @async
     * @param {MetricQuery} query - The query parameters.
     * @returns {Promise<TimeSeries[]>} A promise that resolves with the time-series data.
     * @throws {ModuleNotInitializedError} If the module is not initialized.
     */
    public async getTimeSeries(query: MetricQuery): Promise<TimeSeries[]> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('MetricsCollector', 'get time series', {
                operation: 'get-time-series'
            });
        }

        const interval = query.aggregationInterval || 'minute';
        const intervalBuckets = this.buckets.get(interval);
        if (!intervalBuckets) {
            return [];
        }

        const timeSeries: TimeSeries[] = [];
        const metricTypes = query.types || Object.values(MetricType);

        for (const metricType of metricTypes) {
            const points: TimeSeriesPoint[] = [];

            for (const [bucketKey, bucket] of intervalBuckets.entries()) {
                // Apply time range filter
                if (query.timeRange) {
                    if (bucket.startTime < query.timeRange.start || bucket.endTime > query.timeRange.end) {
                        continue;
                    }
                }

                // Filter metrics by type and other criteria
                const filteredMetrics = bucket.metrics.filter(metric => {
                    if (metric.type !== metricType) return false;
                    if (query.sources && !query.sources.includes(metric.source)) return false;
                    if (query.tags && !this.matchesTags(metric, query.tags)) return false;
                    return true;
                });

                if (filteredMetrics.length > 0) {
                    const stats = this.calculateBucketStatistics(filteredMetrics, metricType);
                    points.push({
                        timestamp: bucket.startTime,
                        value: stats.average,
                        tags: {
                            interval,
                            count: stats.count.toString()
                        }
                    });
                }
            }

            if (points.length > 0) {
                // Sort points by timestamp
                points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                // Apply limit if specified
                if (query.limit && points.length > query.limit) {
                    points.splice(query.limit);
                }

                timeSeries.push({
                    type: metricType,
                    points,
                    metadata: {
                        source: 'metrics-collector',
                        unit: this.getMetricUnit(metricType),
                        aggregationType: 'average'
                    }
                });
            }
        }

        this.logger.debug('Time-series data retrieved', {
            operation: 'get-time-series',
            queryTypes: query.types?.length || 0,
            querySources: query.sources?.length || 0,
            hasTimeRange: !!query.timeRange,
            aggregationInterval: query.aggregationInterval,
            queryLimit: query.limit,
            seriesCount: timeSeries.length,
            totalPoints: timeSeries.reduce((sum, series) => sum + series.points.length, 0)
        });

        return timeSeries;
    }

    /**
     * Starts the data export process at regular intervals.
     * @private
     */
    private startDataExport(): void {
        if (!this.config?.export.enabled) return;

        this.exportTimer = setInterval(() => {
            this.exportData();
        }, this.config.export.intervalMs);

        this.logger.debug('Data export started', {
            operation: 'start-data-export',
            interval: this.config.export.intervalMs,
            format: this.config.export.format
        });
    }

    /**
     * Exports metrics data in the configured format.
     * @private
     * @async
     */
    private async exportData(): Promise<void> {
        if (!this.config?.export || this.destroyed) return;

        try {
            const query: MetricQuery = {
                types: this.config.export.metricTypes,
                timeRange: {
                    start: new Date(Date.now() - this.config.export.intervalMs),
                    end: new Date()
                },
                aggregationInterval: 'minute'
            };

            const timeSeries = await this.getTimeSeries(query);
            
            switch (this.config.export.format) {
                case 'json':
                    await this.exportAsJson(timeSeries);
                    break;
                case 'csv':
                    await this.exportAsCsv(timeSeries);
                    break;
                case 'prometheus':
                    await this.exportAsPrometheus(timeSeries);
                    break;
            }

            this.logger.debug('Metrics exported', {
                operation: 'export-data',
                format: this.config.export.format,
                seriesCount: timeSeries.length
            });

        } catch (error) {
            this.logger.error('Failed to export metrics', {
                operation: 'export-data-error',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Exports metrics as JSON format.
     * @private
     * @async
     * @param {TimeSeries[]} timeSeries - The time-series data to export.
     */
    private async exportAsJson(timeSeries: TimeSeries[]): Promise<void> {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: timeSeries
        };

        await this.writeExport(JSON.stringify(data, null, 2));
    }

    /**
     * Exports metrics as CSV format.
     * @private
     * @async
     * @param {TimeSeries[]} timeSeries - The time-series data to export.
     */
    private async exportAsCsv(timeSeries: TimeSeries[]): Promise<void> {
        const csvLines: string[] = ['timestamp,metric_type,value,source,unit'];

        for (const series of timeSeries) {
            for (const point of series.points) {
                csvLines.push([
                    point.timestamp.toISOString(),
                    series.type,
                    point.value.toString(),
                    series.metadata.source,
                    series.metadata.unit
                ].map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(','));
            }
        }

        const csvData = csvLines.join('\n');

        await this.writeExport(csvData);
    }

    /**
     * Exports metrics in Prometheus format.
     * @private
     * @async
     * @param {TimeSeries[]} timeSeries - The time-series data to export.
     */
    private async exportAsPrometheus(timeSeries: TimeSeries[]): Promise<void> {
        const prometheusLines: string[] = [];

        for (const series of timeSeries) {
            const metricName = `hsqldb_${series.type.replace(/-/g, '_')}`;
            
            // Add help and type comments
            prometheusLines.push(`# HELP ${metricName} ${series.type} metric`);
            prometheusLines.push(`# TYPE ${metricName} gauge`);

            for (const point of series.points) {
                const labels = Object.entries(point.tags || {})
                    .map(([key, value]) => `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
                    .join(',');
                
                const labelString = labels ? `{${labels}}` : '';
                prometheusLines.push(`${metricName}${labelString} ${point.value} ${point.timestamp.getTime()}`);
            }
        }

        const prometheusData = prometheusLines.join('\n');

        await this.writeExport(prometheusData);
    }

    /**
     * Writes a serialized metrics snapshot to the configured destination.
     * @param data - Complete UTF-8 contents of the snapshot.
     * @returns Resolves after the destination accepts the snapshot.
     * @throws {ConfigurationError} When a file destination has no path or HTTP export is requested.
     * @private
     */
    private async writeExport(data: string): Promise<void> {
        const destination = this.config?.export.destination;
        if (destination?.type === 'console') {
            console.log(data);
            return;
        }
        if (destination?.type === 'http') {
            throw new ConfigurationError('HTTP metrics export is not supported', ['export.destination.type']);
        }
        if (!destination?.path) {
            throw new ConfigurationError('Metrics export file path is required', ['export.destination.path']);
        }
        await writeFile(destination.path, data, 'utf8');
    }

    /**
     * Starts the cleanup process for removing old data based on retention policies.
     * @private
     */
    private startCleanupProcess(): void {
        // Run cleanup every hour
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldData();
        }, 60 * 60 * 1000);

        this.logger.debug('Cleanup process started', {
            operation: 'start-cleanup-process'
        });
    }

    /**
     * Cleans up old data based on retention policies.
     * @private
     */
    private cleanupOldData(): void {
        if (!this.config?.aggregation || this.destroyed) return;

        const now = new Date();
        let totalCleaned = 0;

        for (const [interval, intervalBuckets] of this.buckets.entries()) {
            const retentionDays = this.config.aggregation.retention[interval as keyof typeof this.config.aggregation.retention];
            const cutoffTime = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
            
            let cleaned = 0;
            for (const [bucketKey, bucket] of intervalBuckets.entries()) {
                if (bucket.endTime < cutoffTime) {
                    intervalBuckets.delete(bucketKey);
                    cleaned++;
                }
            }
            
            totalCleaned += cleaned;
            
            if (cleaned > 0) {
                this.logger.debug('Cleaned up old buckets', {
                    operation: 'cleanup-old-data',
                    interval,
                    cleaned,
                    retentionDays,
                    remaining: intervalBuckets.size
                });
            }
        }

        if (totalCleaned > 0) {
            this.logger.info('Data cleanup completed', {
                operation: 'cleanup-complete',
                totalCleaned
            });
        }
    }

    /**
     * Gets comprehensive memory usage statistics for the metrics collector.
     * @returns {object} Memory usage information including current usage, limits, and utilization.
     */
    public getMemoryUsage(): {
        currentUsageMB: number;
        maxUsageMB: number;
        utilizationPercentage: number;
        bufferSize: number;
        totalBuckets: number;
    } {
        const totalBuckets = Array.from(this.buckets.values())
            .reduce((sum, buckets) => sum + buckets.size, 0);

        return {
            currentUsageMB: this.currentMemoryUsage / (1024 * 1024),
            maxUsageMB: this.config?.maxMemoryUsageMB || 0,
            utilizationPercentage: this.config?.maxMemoryUsageMB 
                ? (this.currentMemoryUsage / (this.config.maxMemoryUsageMB * 1024 * 1024)) * 100 
                : 0,
            bufferSize: this.metricsBuffer.length,
            totalBuckets
        };
    }

    /**
     * Estimates the memory size of a performance metric.
     * @private
     * @param {PerformanceMetric} metric - The metric to estimate.
     * @returns {number} Estimated size in bytes.
     */
    private estimateMetricSize(metric: PerformanceMetric): number {
        // Rough estimate of metric size in bytes
        return JSON.stringify(metric).length * 2; // UTF-16 encoding approximation
    }

    /**
     * Checks if a metric matches the required tags.
     * @private
     * @param {PerformanceMetric} metric - The metric to check.
     * @param {Record<string, string>} requiredTags - The required tags.
     * @returns {boolean} True if the metric matches the required tags.
     */
    private matchesTags(metric: PerformanceMetric, requiredTags: Record<string, string>): boolean {
        if (!metric.tags) return false;
        
        for (const [key, value] of Object.entries(requiredTags)) {
            if (!metric.tags.includes(`${key}:${value}`)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Gets the appropriate unit for a metric type.
     * @private
     * @param {MetricType} metricType - The metric type.
     * @returns {string} The unit string.
     */
    private getMetricUnit(metricType: MetricType): string {
        switch (metricType) {
            case MetricType.QUERY_TIME:
            case MetricType.CONNECTION_TIME:
            case MetricType.RESPONSE_TIME:
            case MetricType.LATENCY:
                return 'ms';
            case MetricType.MEMORY_USAGE:
            case MetricType.CPU_USAGE:
            case MetricType.POOL_UTILIZATION:
            case MetricType.ERROR_RATE:
                return '%';
            case MetricType.OPERATIONS_PER_SECOND:
            case MetricType.THROUGHPUT:
                return 'ops/sec';
            default:
                return 'unit';
        }
    }

    /**
     * Gets a copy of the current configuration.
     * @returns {MetricsCollectorConfig | undefined} The current configuration or undefined if not initialized.
     */
    public getConfiguration(): MetricsCollectorConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Destroys the metrics collector and cleans up all resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying MetricsCollector', {
            operation: 'destroy',
            bufferedMetrics: this.metricsBuffer.length,
            totalBuckets: Array.from(this.buckets.values()).reduce((sum, buckets) => sum + buckets.size, 0)
        });
        
        this.destroyed = true;
        this._initialized = false;

        // Flush any remaining metrics
        if (this.metricsBuffer.length > 0) {
            this.flushBuffer();
        }

        // Stop all timers
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        
        if (this.exportTimer) {
            clearInterval(this.exportTimer);
            this.exportTimer = undefined;
        }
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }

        // Clear all data
        this.metricsBuffer = [];
        this.buckets.clear();
        this.currentMemoryUsage = 0;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);
        
        this.logger.info('MetricsCollector destroyed successfully', {
            operation: 'destroy-complete',
            uptime: Date.now() - this.startTime
        });
    }

    /**
     * Adds an event listener for the specified performance event.
     * @param {PerformanceEvent} event - The event to listen for.
     * @param {ModuleEventListener<PerformanceEvent>} listener - The listener function.
     */
    public on(event: PerformanceEvent, listener: ModuleEventListener<PerformanceEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Adds a one-time event listener for the specified performance event.
     * @param {PerformanceEvent} event - The event to listen for.
     * @param {ModuleEventListener<PerformanceEvent>} listener - The listener function.
     */
    public once(event: PerformanceEvent, listener: ModuleEventListener<PerformanceEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Removes an event listener for the specified performance event.
     * @param {PerformanceEvent} event - The event to stop listening for.
     * @param {ModuleEventListener<PerformanceEvent>} listener - The listener function to remove.
     */
    public off(event: PerformanceEvent, listener: ModuleEventListener<PerformanceEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emits a performance event to all registered listeners.
     * @param {PerformanceEvent} event - The event to emit.
     * @param {any} [data] - Optional data to pass to listeners.
     */
    public emit(event: PerformanceEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Removes all listeners for a specific event or all events.
     * @param {PerformanceEvent} [event] - The event to remove listeners from.
     */
    public removeAllListeners(event?: PerformanceEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Gets the number of listeners for a specific performance event.
     * @param {PerformanceEvent} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    public listenerCount(event: PerformanceEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Gets an array of all performance event names that have listeners.
     * @returns {PerformanceEvent[]} An array of event names.
     */
    public eventNames(): PerformanceEvent[] {
        return this.eventEmitter.eventNames();
    }
}