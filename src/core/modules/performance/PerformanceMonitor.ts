/**
 * @fileoverview Performance Monitor Module - Refactored v1.0.0
 * 
 * This file defines a real-time performance monitoring and health assessment system
 * focused on immediate monitoring, alerting, and reporting. The module integrates
 * with ConnectionManager for database metrics and emits events to MetricsCollector
 * for long-term storage and aggregation.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { 
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    PerformanceError
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
import { type ConnectionManager } from '../connection/ConnectionManager.js';
import { type JDBCConnection } from '../connection/JDBCConnectionFactory.js';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @enum {string}
 * @description Defines the available performance metric types.
 * @readonly
 */
export enum MetricType {
    /** Query execution time */
    QUERY_TIME = 'query-time',
    /** Connection acquisition time */
    CONNECTION_TIME = 'connection-time',
    /** Memory usage */
    MEMORY_USAGE = 'memory-usage',
    /** CPU usage */
    CPU_USAGE = 'cpu-usage',
    /** Database operations per second */
    OPERATIONS_PER_SECOND = 'operations-per-second',
    /** Pool utilization percentage */
    POOL_UTILIZATION = 'pool-utilization',
    /** Error rate */
    ERROR_RATE = 'error-rate',
    /** Response time */
    RESPONSE_TIME = 'response-time',
    /** Throughput */
    THROUGHPUT = 'throughput',
    /** Latency */
    LATENCY = 'latency',
    /** Database connection health */
    CONNECTION_HEALTH = 'connection-health',
    /** Table access frequency */
    TABLE_ACCESS = 'table-access',
    /** Index usage efficiency */
    INDEX_EFFICIENCY = 'index-efficiency'
}

/**
 * @interface PerformanceMetric
 * @description Represents a single performance metric data point.
 */
export interface PerformanceMetric {
    /** The type of metric being recorded. */
    type: MetricType;
    /** The measured value for this metric. */
    value: number;
    /** The unit of measurement (e.g., 'ms', '%', 'ops/sec'). */
    unit: string;
    /** The timestamp when this metric was recorded. */
    timestamp: Date;
    /** The source component or module that generated this metric. */
    source: string;
    /** Additional contextual information about the metric. */
    context?: Record<string, any>;
    /** Tags for categorizing and filtering the metric. */
    tags?: string[];
}

/**
 * @interface MetricStatistics
 * @description Provides aggregated statistical information for a metric type.
 */
export interface MetricStatistics {
    /** The metric type these statistics represent. */
    type: MetricType;
    /** The number of samples included in these statistics. */
    count: number;
    /** The minimum value recorded. */
    min: number;
    /** The maximum value recorded. */
    max: number;
    /** The average (mean) value. */
    average: number;
    /** The median value. */
    median: number;
    /** The 95th percentile value. */
    p95: number;
    /** The 99th percentile value. */
    p99: number;
    /** The standard deviation of the values. */
    standardDeviation: number;
    /** The time range covered by these statistics. */
    timeRange: {
        start: Date;
        end: Date;
    };
}

/**
 * @interface PerformanceThreshold
 * @description Defines threshold values for performance monitoring and alerting.
 */
export interface PerformanceThreshold {
    /** The metric type this threshold applies to. */
    type: MetricType;
    /** The value at which a warning is triggered. */
    warningThreshold: number;
    /** The value at which a critical alert is triggered. */
    criticalThreshold: number;
    /** Whether this threshold is actively monitored. */
    enabled: boolean;
    /** How often to check this threshold in milliseconds. */
    checkIntervalMs: number;
}

/**
 * @interface PerformanceConfig
 * @description Configuration options for the PerformanceMonitor module.
 */
export interface PerformanceConfig {
    /** Whether performance monitoring is enabled. */
    enabled: boolean;
    /** Interval for collecting metrics in milliseconds. */
    collectionIntervalMs: number;
    /** Maximum number of metrics to keep in memory for real-time monitoring. */
    maxMetricsHistory: number;
    /** Whether to collect system resource metrics. */
    enableSystemMetrics: boolean;
    /** Whether to collect query performance metrics. */
    enableQueryMetrics: boolean;
    /** Whether to collect connection performance metrics. */
    enableConnectionMetrics: boolean;
    /** Whether to collect database-specific metrics. */
    enableDatabaseMetrics: boolean;
    /** Array of performance thresholds for monitoring. */
    thresholds: PerformanceThreshold[];
    /** Whether to export metrics to external systems. */
    exportMetrics: boolean;
    /** Interval for exporting metrics in milliseconds. */
    exportIntervalMs: number;
}

/**
 * @interface DatabaseMetrics
 * @description Contains database-specific performance metrics.
 */
export interface DatabaseMetrics {
    /** Number of currently active database connections. */
    activeConnections: number;
    /** Connection pool utilization as a percentage (0-100). */
    poolUtilization: number;
    /** Average query response time in milliseconds. */
    avgQueryTime: number;
    /** Overall connection health score (0-100). */
    connectionHealth: number;
    /** Statistics on table access frequency. */
    tableAccess: Map<string, number>;
    /** Statistics on index usage efficiency. */
    indexUsage: Map<string, number>;
    /** Error rate as a percentage (0-100). */
    errorRate: number;
}

/**
 * @interface SystemMetrics
 * @description Contains system resource usage metrics.
 */
export interface SystemMetrics {
    /** Memory usage information. */
    memory: {
        /** Used memory in bytes. */
        used: number;
        /** Total available memory in bytes. */
        total: number;
        /** Memory usage as a percentage (0-100). */
        percentage: number;
        /** Heap memory used in bytes. */
        heapUsed: number;
        /** Total heap memory in bytes. */
        heapTotal: number;
    };
    /** CPU usage information. */
    cpu: {
        /** CPU usage as a percentage (0-100). */
        percentage: number;
        /** System load averages. */
        loadAverage: number[];
    };
    /** Process information. */
    process: {
        /** Process identifier. */
        pid: number;
        /** Process uptime in seconds. */
        uptime: number;
        /** Process CPU time in microseconds. */
        cpuTime: number;
    };
}

/**
 * @interface PerformanceReport
 * @description Comprehensive performance report containing metrics and analysis.
 */
export interface PerformanceReport {
    /** When this report was generated. */
    timestamp: Date;
    /** The time range covered by this report. */
    timeRange: {
        start: Date;
        end: Date;
    };
    /** Current system resource metrics. */
    systemMetrics: SystemMetrics;
    /** Current database performance metrics. */
    databaseMetrics: DatabaseMetrics;
    /** Statistical analysis for each metric type. */
    statistics: Map<MetricType, MetricStatistics>;
    /** Any threshold violations detected. */
    thresholdViolations: Array<{
        threshold: PerformanceThreshold;
        violationType: 'warning' | 'critical';
        value: number;
        timestamp: Date;
    }>;
    /** Summary information and insights. */
    summary: {
        /** Total number of metrics analyzed. */
        totalMetrics: number;
        /** Total number of threshold violations. */
        totalViolations: number;
        /** Overall performance score (0-100). */
        performanceScore: number;
        /** Key insights and recommendations. */
        insights: string[];
    };
}

// =============================================================================
// PERFORMANCE MONITOR CLASS
// =============================================================================

/**
 * @class PerformanceMonitor
 * @description Comprehensive performance monitoring and metrics collection system
 * that tracks database operations, system resources, and performance trends.
 * Integrates with ConnectionManager for real database metrics.
 * @implements {BaseModule}
 * @implements {ModuleEventEmitter<PerformanceEvent>}
 */
export class PerformanceMonitor implements BaseModule, ModuleEventEmitter<PerformanceEvent> {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'performance-monitor';
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
     * @type {ConnectionManager | undefined}
     */
    private connectionManager?: ConnectionManager;
    /** 
     * @private 
     * @type {PerformanceConfig | undefined}
     */
    private config?: PerformanceConfig;
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
     * @type {ModuleEventEmitterImpl<PerformanceEvent>}
     */
    private eventEmitter: ModuleEventEmitterImpl<PerformanceEvent>;
    
    /** 
     * @private 
     * @type {PerformanceMetric[]}
     */
    private recentMetrics: PerformanceMetric[] = [];
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private collectionTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private databaseMetricsTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private thresholdTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {NodeJS.Timeout | undefined}
     */
    private exportTimer?: NodeJS.Timeout;
    /** 
     * @private 
     * @type {Map<MetricType, MetricStatistics> | undefined}
     */
    private baseline?: Map<MetricType, MetricStatistics>;
    /** 
     * @private 
     * @type {number}
     */
    private queryCount = 0;
    /** 
     * @private 
     * @type {number}
     */
    private errorCount = 0;
    /** 
     * @private 
     * @type {number[]}
     */
    private connectionTimes: number[] = [];

    /**
     * Creates a new PerformanceMonitor instance.
     */
    constructor() {
        this.logger = createModuleLogger('PerformanceMonitor-v1.0');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'PerformanceMonitor');

        // Initialize event listeners for performance events
        this.eventEmitter.initializeEvents(Object.values(PerformanceEvent));
    }

    /**
     * Initializes the performance monitor with the provided HSQLManager.
     * @async
     * @param {HSQLManager} manager - The HSQLDB manager instance.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {ModuleAlreadyInitializedError} If the module is already initialized.
     * @throws {ConfigurationError} If the manager parameter is invalid.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('PerformanceMonitor', {
                operation: 'initialize'
            });
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required', ['manager'], {
                operation: 'initialize'
            });
        }

        this.logger.info('Initializing PerformanceMonitor v1.0 with ConnectionManager integration', {
            operation: 'initialize'
        });

        this.manager = manager;
        this.buildConfiguration();
        
        // Get ConnectionManager from HSQLManager for real database metrics
        this.connectionManager = this.manager.getModule<ConnectionManager>('connection-manager');
        if (!this.connectionManager) {
            this.logger.warn('ConnectionManager not found - database metrics will be limited', {
                operation: 'initialize',
                warning: 'connectionManagerNotFound'
            });
        } else if (!this.connectionManager.isInitialized) {
            this.logger.warn('ConnectionManager not initialized - database metrics will be limited', {
                operation: 'initialize',
                warning: 'connectionManagerNotInitialized'
            });
        } else {
            this.logger.info('ConnectionManager integration established successfully', {
                operation: 'initialize',
                connectionManagerVersion: this.connectionManager.version
            });
        }
        
        if (this.config?.enabled) {
            // Start metrics collection
            this.startMetricsCollection();
            
            // Start database-specific metrics collection if ConnectionManager available
            if (this.config.enableDatabaseMetrics && this.connectionManager?.isInitialized) {
                this.startDatabaseMetricsCollection();
            }
            
            // Start threshold monitoring
            this.startThresholdMonitoring();
            
            // Start metrics export if enabled
            if (this.config.exportMetrics) {
                this.startMetricsExport();
            }
            
            // Establish baseline
            await this.establishBaseline();
        }
        
        this._initialized = true;
        resourceCleaner.register(this);
        
        this.logger.info('PerformanceMonitor v1.0 initialized successfully', {
            operation: 'initialize-complete',
            enabled: this.config?.enabled,
            collectionInterval: this.config?.collectionIntervalMs,
            databaseMetricsEnabled: this.config?.enableDatabaseMetrics && !!this.connectionManager?.isInitialized,
            connectionManagerIntegrated: !!this.connectionManager?.isInitialized
        });

        // Emit initialization event
        this.emit(PerformanceEvent.BASELINE_ESTABLISHED, createEventData('monitor-initialized', {
            enabled: this.config?.enabled,
            collectionInterval: this.config?.collectionIntervalMs,
            databaseMetricsEnabled: this.config?.enableDatabaseMetrics,
            connectionManagerIntegrated: !!this.connectionManager?.isInitialized
        }, this.name));
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
        
        // Extract performance configuration with defaults
        this.config = {
            enabled: managerConfig.modules?.enableMetricsCollection || false,
            collectionIntervalMs: 2000, // Reduced from 5000 to 2000 for faster tests
            maxMetricsHistory: 10000, // Keep last 10,000 metrics
            enableSystemMetrics: true,
            enableQueryMetrics: true,
            enableConnectionMetrics: true,
            enableDatabaseMetrics: true, // New: Enable database-specific metrics
            exportMetrics: false,
            exportIntervalMs: 60000, // 1 minute
            thresholds: [
                {
                    type: MetricType.QUERY_TIME,
                    warningThreshold: 1000, // 1 second
                    criticalThreshold: 5000, // 5 seconds
                    enabled: true,
                    checkIntervalMs: 3000 // Reduced from 10000 to 3000 for faster tests
                },
                {
                    type: MetricType.MEMORY_USAGE,
                    warningThreshold: 80, // 80%
                    criticalThreshold: 95, // 95%
                    enabled: true,
                    checkIntervalMs: 3000 // Reduced from 10000 to 3000 for faster tests
                },
                {
                    type: MetricType.ERROR_RATE,
                    warningThreshold: 5, // 5%
                    criticalThreshold: 10, // 10%
                    enabled: true,
                    checkIntervalMs: 3000 // Reduced from 30000 to 3000 for faster tests
                },
                {
                    type: MetricType.POOL_UTILIZATION,
                    warningThreshold: 80, // 80%
                    criticalThreshold: 95, // 95%
                    enabled: true,
                    checkIntervalMs: 3000
                },
                {
                    type: MetricType.CONNECTION_HEALTH,
                    warningThreshold: 70, // 70% health
                    criticalThreshold: 50, // 50% health
                    enabled: true,
                    checkIntervalMs: 5000
                }
            ]
        };

        this.logger.debug('Configuration built for PerformanceMonitor', { 
            operation: 'build-config',
            config: this.config 
        });
    }

    /**
     * Records a performance metric for immediate monitoring and emits it to MetricsCollector.
     * @param {PerformanceMetric} metric - The performance metric to record.
     */
    public recordMetric(metric: PerformanceMetric): void {
        if (!this._initialized || !this.config?.enabled) {
            return;
        }

        // Ensure metric has a timestamp
        if (!metric.timestamp) {
            metric.timestamp = new Date();
        }

        // Store in temporary buffer for immediate statistics (small buffer, short retention)
        this.recentMetrics.push(metric);
        
        // Keep only recent metrics for real-time monitoring based on maxMetricsHistory
        const maxRecentMetrics = this.config?.maxMetricsHistory || 100;
        if (this.recentMetrics.length > maxRecentMetrics) {
            this.recentMetrics = this.recentMetrics.slice(-maxRecentMetrics);
        }

        // Emit to MetricsCollector for long-term storage and aggregation
        this.emit(PerformanceEvent.METRIC_RECORDED, createEventData('metric-recorded', {
            metric,
            source: this.name,
            timestamp: new Date()
        }, this.name));

        // Check thresholds for immediate alerting
        this.checkThresholds(metric);

        this.logger.debug('Metric recorded and forwarded', {
            operation: 'record-metric',
            type: metric.type,
            value: metric.value,
            source: metric.source,
            recentMetricsCount: this.recentMetrics.length
        });
    }

    /**
     * Clears the recent metrics buffer used for real-time monitoring.
     */
    public clearMetrics(): void {
        this.recentMetrics = [];
        
        this.logger.debug('Recent metrics buffer cleared', {
            operation: 'clear-metrics'
        });
    }

    /**
     * Gets real-time statistics for a specific metric type.
     * @param {MetricType} type - The metric type to get statistics for.
     * @returns {MetricStatistics | null} Statistics or null if no data is available.
     */
    public getStatistics(type: MetricType): MetricStatistics | null {
        if (!this._initialized) {
            return null;
        }

        // Filter recent metrics by type
        const metrics = this.recentMetrics.filter(m => m.type === type);
        
        if (metrics.length === 0) {
            return null;
        }

        return this.calculateStatistics(metrics, type);
    }

    /**
     * Calculates aggregated statistics for a set of metrics.
     * @private
     * @param {PerformanceMetric[]} metrics - The metrics to calculate statistics for.
     * @param {MetricType} type - The metric type.
     * @returns {MetricStatistics} The calculated statistics.
     */
    private calculateStatistics(metrics: PerformanceMetric[], type: MetricType): MetricStatistics {
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
     * Starts the metrics collection process at regular intervals.
     * @private
     */
    private startMetricsCollection(): void {
        if (!this.config) return;

        this.collectionTimer = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.collectionIntervalMs);

        this.logger.debug('Metrics collection started', {
            operation: 'start-metrics-collection',
            interval: this.config.collectionIntervalMs
        });
    }

    /**
     * Collects system resource metrics.
     * @private
     */
    private collectSystemMetrics(): void {
        if (!this.config?.enableSystemMetrics || this.destroyed) {
            return;
        }

        try {
            const memUsage = process.memoryUsage();
            const timestamp = new Date();

            // Memory metrics
            this.recordMetric({
                type: MetricType.MEMORY_USAGE,
                value: (memUsage.heapUsed / memUsage.heapTotal) * 100,
                unit: '%',
                timestamp,
                source: 'system',
                context: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    arrayBuffers: memUsage.arrayBuffers
                }
            });

            // Process uptime
            this.recordMetric({
                type: MetricType.RESPONSE_TIME,
                value: process.uptime() * 1000,
                unit: 'ms',
                timestamp,
                source: 'system',
                context: {
                    type: 'process-uptime'
                }
            });

            // CPU usage (basic approximation)
            const cpuUsage = process.cpuUsage();
            this.recordMetric({
                type: MetricType.CPU_USAGE,
                value: (cpuUsage.user + cpuUsage.system) / 1000,
                unit: 'microseconds',
                timestamp,
                source: 'system',
                context: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            });

        } catch (error) {
            const perfError = new PerformanceError(
                'Failed to collect system metrics',
                error instanceof Error ? error : new Error(String(error)),
                'system-metrics'
            );
            
            this.logger.warn(perfError.getFormattedMessage(), {
                operation: 'collect-system-metrics',
                error: perfError.message
            });
            
            // Don't throw to avoid interrupting collection cycle
        }
    }

    /**
     * Starts threshold monitoring for performance alerts.
     * @private
     */
    private startThresholdMonitoring(): void {
        if (!this.config?.thresholds || this.config.thresholds.length === 0) {
            return;
        }

        this.thresholdTimer = setInterval(() => {
            this.checkThresholds();
        }, Math.min(...this.config.thresholds.map(t => t.checkIntervalMs)));

        this.logger.debug('Threshold monitoring started', {
            operation: 'start-threshold-monitoring',
            thresholds: this.config.thresholds.length
        });
    }

    /**
     * Checks performance thresholds and emits alerts if violations are detected.
     * @private
     * @param {PerformanceMetric} [metric] - Optional specific metric to check thresholds for.
     */
    private checkThresholds(metric?: PerformanceMetric): void {
        if (!this.config?.thresholds || this.destroyed) {
            return;
        }

        for (const threshold of this.config.thresholds) {
            if (!threshold.enabled) continue;

            const stats = metric ? this.getStatistics(metric.type) : this.getStatistics(threshold.type);
            if (!stats) continue;

            const currentValue = metric ? metric.value : stats.average;

            if (currentValue >= threshold.criticalThreshold) {
                this.logger.warn('Critical performance threshold exceeded', {
                    operation: 'threshold-check',
                    type: threshold.type,
                    value: currentValue,
                    threshold: threshold.criticalThreshold
                });

                this.emit(PerformanceEvent.THRESHOLD_EXCEEDED, createEventData('threshold-exceeded', {
                    threshold,
                    violationType: 'critical',
                    value: currentValue,
                    timestamp: new Date()
                }, this.name));
            } else if (currentValue >= threshold.warningThreshold) {
                this.logger.warn('Warning performance threshold exceeded', {
                    operation: 'threshold-check',
                    type: threshold.type,
                    value: currentValue,
                    threshold: threshold.warningThreshold
                });

                this.emit(PerformanceEvent.THRESHOLD_EXCEEDED, createEventData('threshold-exceeded', {
                    threshold,
                    violationType: 'warning',
                    value: currentValue,
                    timestamp: new Date()
                }, this.name));
            }
        }
    }

    /**
     * Starts the metrics export process for external systems.
     * @private
     */
    private startMetricsExport(): void {
        if (!this.config) return;

        this.exportTimer = setInterval(() => {
            this.exportMetrics();
        }, this.config.exportIntervalMs);

        this.logger.debug('Metrics export started', {
            operation: 'start-metrics-export',
            interval: this.config.exportIntervalMs
        });
    }

    /**
     * Exports metrics to external monitoring systems.
     * @private
     */
    private exportMetrics(): void {
        if (this.destroyed) return;

        // For now, just log metrics export
        // In a real implementation, this would send metrics to external monitoring systems
        this.logger.info('Exporting performance metrics', {
            operation: 'export-metrics',
            metricsCount: this.recentMetrics.length,
            timestamp: new Date()
        });
    }

    /**
     * Establishes a performance baseline by collecting initial metrics.
     * @private
     * @async
     */
    private async establishBaseline(): Promise<void> {
        // Wait a bit to collect some initial metrics - reduced for faster tests
        await new Promise(resolve => setTimeout(resolve, Math.min(this.config?.collectionIntervalMs || 2000, 2000)));

        this.baseline = new Map();
        
        for (const metricType of Object.values(MetricType)) {
            const stats = this.getStatistics(metricType);
            if (stats) {
                this.baseline.set(metricType, stats);
            }
        }

        this.logger.info('Performance baseline established', {
            operation: 'establish-baseline',
            baselineMetrics: this.baseline.size
        });

        this.emit(PerformanceEvent.BASELINE_ESTABLISHED, createEventData('baseline-established', {
            baselineMetrics: this.baseline.size,
            timestamp: new Date()
        }, this.name));
    }

    /**
     * Generates a comprehensive performance report.
     * @async
     * @param {Date} [since] - Start date for the report (defaults to last hour).
     * @param {Date} [until] - End date for the report (defaults to now).
     * @returns {Promise<PerformanceReport>} The generated performance report.
     * @throws {ModuleNotInitializedError} If the module is not initialized.
     */
    public async generateReport(since?: Date, until?: Date): Promise<PerformanceReport> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('PerformanceMonitor', 'generate report', {
                operation: 'generate-report'
            });
        }

        const now = new Date();
        const startDate = since || new Date(now.getTime() - 60 * 60 * 1000); // Last hour
        const endDate = until || now;

        // Collect system metrics
        const systemMetrics: SystemMetrics = {
            memory: {
                used: process.memoryUsage().heapUsed,
                total: process.memoryUsage().heapTotal,
                percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
                heapUsed: process.memoryUsage().heapUsed,
                heapTotal: process.memoryUsage().heapTotal
            },
            cpu: {
                percentage: 0, // Placeholder - would need more sophisticated CPU monitoring
                loadAverage: []
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                cpuTime: process.cpuUsage().user + process.cpuUsage().system
            }
        };

        // Get database metrics
        const databaseMetrics = this.getDatabaseMetrics();

        // Calculate statistics for all metric types
        const statistics = new Map<MetricType, MetricStatistics>();
        for (const metricType of Object.values(MetricType)) {
            const stats = this.getStatistics(metricType);
            if (stats) {
                statistics.set(metricType, stats);
            }
        }

        // Check for threshold violations
        const thresholdViolations: PerformanceReport['thresholdViolations'] = [];
        if (this.config?.thresholds) {
            for (const threshold of this.config.thresholds) {
                const stats = statistics.get(threshold.type);
                if (stats) {
                    if (stats.average >= threshold.criticalThreshold) {
                        thresholdViolations.push({
                            threshold,
                            violationType: 'critical',
                            value: stats.average,
                            timestamp: now
                        });
                    } else if (stats.average >= threshold.warningThreshold) {
                        thresholdViolations.push({
                            threshold,
                            violationType: 'warning',
                            value: stats.average,
                            timestamp: now
                        });
                    }
                }
            }
        }

        // Calculate performance score (0-100)
        let performanceScore = 100;
        
        // Deduct points for threshold violations
        for (const violation of thresholdViolations) {
            if (violation.violationType === 'critical') {
                performanceScore -= 15;
            } else {
                performanceScore -= 5;
            }
        }
        
        performanceScore = Math.max(0, performanceScore);

        // Generate insights
        const insights: string[] = [];
        
        // Database-specific insights
        if (databaseMetrics.poolUtilization > 80) {
            insights.push(`High connection pool utilization: ${databaseMetrics.poolUtilization.toFixed(1)}%`);
        }
        
        if (databaseMetrics.connectionHealth < 80) {
            insights.push(`Connection health below optimal: ${databaseMetrics.connectionHealth.toFixed(1)}%`);
        }
        
        if (databaseMetrics.errorRate > 5) {
            insights.push(`Elevated error rate detected: ${databaseMetrics.errorRate.toFixed(2)}%`);
        }
        
        // Memory insights
        if (systemMetrics.memory.percentage > 80) {
            insights.push(`High memory usage: ${systemMetrics.memory.percentage.toFixed(1)}%`);
        }

        // Query performance insights
        const queryStats = statistics.get(MetricType.QUERY_TIME);
        if (queryStats && queryStats.average > 1000) {
            insights.push(`Slow query performance detected: ${queryStats.average.toFixed(1)}ms average`);
        }

        const report: PerformanceReport = {
            timestamp: now,
            timeRange: { start: startDate, end: endDate },
            systemMetrics,
            databaseMetrics,
            statistics,
            thresholdViolations,
            summary: {
                totalMetrics: this.recentMetrics.length,
                totalViolations: thresholdViolations.length,
                performanceScore,
                insights
            }
        };

        this.logger.info('Performance report generated', {
            operation: 'generate-report',
            performanceScore,
            totalViolations: thresholdViolations.length,
            insights: insights.length
        });

        // Emit report generated event
        this.emit(PerformanceEvent.REPORT_GENERATED, createEventData('report-generated', {
            report: {
                performanceScore,
                totalViolations: thresholdViolations.length,
                totalMetrics: this.recentMetrics.length,
                insights: insights.length
            },
            timestamp: now
        }, this.name));

        return report;
    }

    /**
     * Gets database-specific metrics from the ConnectionManager.
     * @returns {DatabaseMetrics} Current database performance metrics.
     */
    public getDatabaseMetrics(): DatabaseMetrics {
        const defaultMetrics: DatabaseMetrics = {
            activeConnections: 0,
            poolUtilization: 0,
            avgQueryTime: 0,
            connectionHealth: 100,
            tableAccess: new Map(),
            indexUsage: new Map(),
            errorRate: 0
        };

        if (!this.connectionManager?.isInitialized) {
            return defaultMetrics;
        }

        try {
            const stats = this.connectionManager.getStats();
            
            return {
                activeConnections: stats.activeConnections,
                poolUtilization: stats.poolUtilization,
                avgQueryTime: this.calculateAverageQueryTime(),
                connectionHealth: this.calculateConnectionHealth(stats),
                tableAccess: new Map(), // Would need query analysis for this
                indexUsage: new Map(), // Would need query analysis for this
                errorRate: stats.failureRate || 0
            };
        } catch (error) {
            const perfError = new PerformanceError(
                'Failed to collect database metrics',
                error instanceof Error ? error : new Error(String(error)),
                'database-metrics'
            );
            
            this.logger.warn(perfError.getFormattedMessage(), {
                operation: 'get-database-metrics',
                error: perfError.message
            });
            return defaultMetrics;
        }
    }

    /**
     * Calculates the average query time from recent metrics.
     * @private
     * @returns {number} Average query time in milliseconds.
     */
    private calculateAverageQueryTime(): number {
        const queryMetrics = this.recentMetrics.filter(m => m.type === MetricType.QUERY_TIME);
        if (queryMetrics.length === 0) return 0;
        
        const sum = queryMetrics.reduce((acc, m) => acc + m.value, 0);
        return sum / queryMetrics.length;
    }

    /**
     * Calculates the connection health percentage based on statistics.
     * @private
     * @param {any} stats - Connection manager statistics.
     * @returns {number} Health percentage (0-100).
     */
    private calculateConnectionHealth(stats: any): number {
        if (stats.totalConnections === 0) return 100;
        
        const failureRate = stats.failureRate || 0;
        const poolUtilization = stats.poolUtilization || 0;
        
        // Health score based on low failure rate and reasonable utilization
        let health = 100 - (failureRate * 10); // 10% deduction per 1% failure rate
        
        // Deduct for high utilization (stress indicator)
        if (poolUtilization > 90) {
            health -= 20;
        } else if (poolUtilization > 80) {
            health -= 10;
        }
        
        return Math.max(0, Math.min(100, health));
    }

    /**
     * Starts database-specific metrics collection.
     * @private
     */
    private startDatabaseMetricsCollection(): void {
        if (!this.config?.enableDatabaseMetrics || !this.connectionManager?.isInitialized) {
            return;
        }

        this.databaseMetricsTimer = setInterval(() => {
            this.collectDatabaseMetrics();
        }, this.config.collectionIntervalMs);

        this.logger.debug('Database metrics collection started', {
            operation: 'start-database-metrics-collection',
            interval: this.config.collectionIntervalMs
        });
    }

    /**
     * Collects database-specific performance metrics.
     * @private
     */
    private collectDatabaseMetrics(): void {
        if (!this.connectionManager?.isInitialized || this.destroyed) {
            return;
        }

        try {
            const stats = this.connectionManager.getStats();
            const timestamp = new Date();

            // Pool utilization
            this.recordMetric({
                type: MetricType.POOL_UTILIZATION,
                value: stats.poolUtilization,
                unit: '%',
                timestamp,
                source: 'connection-manager',
                context: {
                    activeConnections: stats.activeConnections,
                    totalConnections: stats.totalConnections
                }
            });

            // Connection health
            this.recordMetric({
                type: MetricType.CONNECTION_HEALTH,
                value: this.calculateConnectionHealth(stats),
                unit: '%',
                timestamp,
                source: 'connection-manager',
                context: {
                    failureRate: stats.failureRate,
                    uptime: stats.uptime
                }
            });

            // Error rate
            this.recordMetric({
                type: MetricType.ERROR_RATE,
                value: stats.failureRate,
                unit: '%',
                timestamp,
                source: 'connection-manager'
            });

        } catch (error) {
            const perfError = new PerformanceError(
                'Failed to collect database metrics',
                error instanceof Error ? error : new Error(String(error)),
                'database-metrics'
            );
            
            this.logger.warn(perfError.getFormattedMessage(), {
                operation: 'collect-database-metrics',
                error: perfError.message
            });
            
            // Don't throw to avoid interrupting collection cycle
        }
    }

    /**
     * Gets current system resource metrics.
     * @returns {SystemMetrics} Current system metrics including memory, CPU, and process information.
     */
    public getSystemMetrics(): SystemMetrics {
        const memUsage = process.memoryUsage();
        
        return {
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal
            },
            cpu: {
                percentage: 0, // Would need more sophisticated monitoring
                loadAverage: []
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                cpuTime: process.cpuUsage().user + process.cpuUsage().system
            }
        };
    }

    /**
     * Gets the ConnectionManager instance if available.
     * @returns {ConnectionManager | undefined} The ConnectionManager instance or undefined if not available.
     */
    public getConnectionManager(): ConnectionManager | undefined {
        return this.connectionManager;
    }

    /**
     * Gets a copy of the current configuration.
     * @returns {PerformanceConfig | undefined} The current configuration or undefined if not initialized.
     */
    public getConfiguration(): PerformanceConfig | undefined {
        return this.config ? { ...this.config } : undefined;
    }

    /**
     * Updates the performance monitoring configuration.
     * @param {Partial<PerformanceConfig>} newConfig - The new configuration options to apply.
     */
    public updateConfiguration(newConfig: Partial<PerformanceConfig>): void {
        if (!this.config) return;
        
        // Special handling for maxMetricsHistory to adjust current buffer
        if (newConfig.maxMetricsHistory !== undefined) {
            const newLimit = newConfig.maxMetricsHistory;
            if (this.recentMetrics.length > newLimit) {
                this.recentMetrics = this.recentMetrics.slice(-newLimit);
            }
        }
        
        this.config = { ...this.config, ...newConfig };
        
        this.logger.info('Configuration updated', {
            operation: 'update-configuration',
            newConfig
        });
    }

    /**
     * Destroys the performance monitor and cleans up all resources.
     * @async
     * @returns {Promise<void>} A promise that resolves when destruction is complete.
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.logger.info('Destroying PerformanceMonitor', {
            operation: 'destroy',
            metricsCollected: this.recentMetrics.length
        });

        this.destroyed = true;
        this._initialized = false;

        // Stop all timers
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = undefined;
        }

        if (this.databaseMetricsTimer) {
            clearInterval(this.databaseMetricsTimer);
            this.databaseMetricsTimer = undefined;
        }

        if (this.thresholdTimer) {
            clearInterval(this.thresholdTimer);
            this.thresholdTimer = undefined;
        }

        if (this.exportTimer) {
            clearInterval(this.exportTimer);
            this.exportTimer = undefined;
        }

        // Clear metrics
        this.recentMetrics = [];
        this.baseline = undefined;

        // Cleanup event emitter
        this.eventEmitter.destroy();

        resourceCleaner.unregister(this);

        this.logger.info('PerformanceMonitor destroyed successfully', {
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Measures the execution time of a function and returns both the result and duration.
 * @async
 * @param {Function} fn - The function to measure.
 * @returns {Promise<{result: T, duration: number}>} Object containing the result and duration in milliseconds.
 * @template T - The return type of the function being measured.
 * @throws {Error} Re-throws any error from the function with duration information added.
 */
export async function measureExecutionTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        return { result, duration };
    } catch (error) {
        const duration = Date.now() - startTime;
        throw Object.assign(error as object, { duration });
    }
}