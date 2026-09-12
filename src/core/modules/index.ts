import { importModule } from './importModule.js';
/**
 * Modules Index
 * 
 * Central export point for all HSQLManager modules
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

// Core module interfaces and base classes
export type { BaseModule } from '../HSQLManager.js';

// Logging modules
export { 
    initializeLogger, 
    getLogger, 
    createModuleLogger, 
    closeLogger,
    DEFAULT_CONFIGS,
    type LogLevel,
    type LogContext,
    type LoggerConfig,
    type ModuleLogger 
} from './logging/Logger.js';

// Connection modules
export { ConnectionManager } from './connection/ConnectionManager.js';
export { JDBCConnectionFactory } from './connection/JDBCConnectionFactory.js';
export { ReconnectionManager } from './connection/ReconnectionManager.js';
export type { JDBCConnection, JDBCConnectionConfig, JDBCQueryResult } from './connection/JDBCConnectionFactory.js';
export type { 
    ReconnectionConfig, 
    ReconnectionStats, 
    ReconnectionStrategy, 
    CircuitBreakerState, 
    ConnectionEvent 
} from './connection/ReconnectionManager.js';

// Performance modules
export { PerformanceMonitor } from './performance/PerformanceMonitor.js';
export { MetricsCollector } from './performance/MetricsCollector.js';
export type {
    PerformanceMetric,
    MetricType,
    MetricStatistics,
    PerformanceThreshold,
    PerformanceConfig,
    SystemMetrics,
    PerformanceReport
} from './performance/PerformanceMonitor.js';
export type {
    MetricBucket,
    TimeSeriesPoint,
    TimeSeries,
    AggregationConfig,
    ExportConfig,
    MetricsCollectorConfig,
    MetricQuery
} from './performance/MetricsCollector.js';

// Cache modules
export { CacheManager } from './cache/CacheManager.js';
export { CacheOptimizer } from './cache/CacheOptimizer.js';
export { CacheStatsCollector } from './cache/CacheStatsCollector.js';
export type {
    CacheEntry,
    CacheOptions,
    CacheConfig,
    CacheStats,
    CachePattern
} from './cache/CacheManager.js';
export type {
    AccessPattern,
    EvictionStrategy,
    OptimizationRecommendation,
    OptimizerConfig,
    EfficiencyMetrics,
    OptimizationInsights,
    PrefetchSuggestion
} from './cache/CacheOptimizer.js';
export type {
    CacheStatsConfig,
    KeyStatistics,
    CachePerformanceMetrics,
    CacheEfficiencyAnalysis,
    CacheUsagePattern,
    CacheAnalytics,
    CacheAlert,
    CacheStatsReport
} from './cache/CacheStatsCollector.js';

// Schema modules
export { SchemaAnalyzer } from './schema/SchemaAnalyzer.js';
export { RelationshipAnalyzer } from './schema/RelationshipAnalyzer.js';
export { DatabaseReporter } from './schema/DatabaseReporter.js';
export type {
    DatabaseSchema,
    TableInfo,
    ColumnInfo,
    ColumnStatistics,
    IndexInfo,
    IndexUsageStatistics,
    ConstraintInfo,
    TableStatistics,
    SchemaStatistics,
    SchemaHealth,
    SchemaIssue,
    OptimizationRecommendation as SchemaOptimizationRecommendation
} from './schema/SchemaAnalyzer.js';
export type {
    RelationshipDiscoveryConfig,
    RelationshipPattern,
    RelationshipValidation,
    CrossTableAnalysis,
    RelationshipType,
    DiscoveryMethod,
    RelationshipPerformance,
    IntegrityIssue,
    TableDependency,
    AnalysisMetrics
} from './schema/RelationshipAnalyzer.js';
export type {
    ReportConfig,
    ReportFormat,
    ReportType,
    ReportSchedule,
    ExecutiveSummary,
    TechnicalReport,
    SchemaComparison,
    SchemaDifference,
    ReportMetadata,
    DatabaseOverview,
    DatabaseInsight,
    PerformanceSummary,
    RiskAssessment,
    Recommendation,
    SchemaSnapshot,
    ImpactAnalysis,
    MigrationRecommendation,
    ReportEvent
} from './schema/DatabaseReporter.js';

// Query modules
export { QueryExecutor } from './query/QueryExecutor.js';
export { QueryValidator } from './query/QueryValidator.js';
export { ParameterizedQuery } from './query/ParameterizedQuery.js';
export type {
    QueryExecutionConfig,
    QueryExecutionResult,
    QueryExecutionStats,
    QueryExecutorConfig
} from './query/QueryExecutor.js';
export type {
    ValidationLevel,
    ThreatLevel,
    QueryOperation,
    ValidationResult,
    QueryValidationContext,
    ValidationRule,
    QueryValidatorConfig,
    QueryValidationOptions,
    QueryValidationError,
    SecurityIssue,
    PerformanceHint,
    QueryMetadata
} from './query/QueryValidator.js';
export type {
    ParameterType,
    ExecutionMode,
    BindingStrategy,
    QueryParameter,
    PreparedStatement,
    ParameterizedQueryResult,
    BatchExecutionResult,
    ParameterizedQueryConfig,
    QueryExecutionOptions,
    NamedParameterMap,
    BatchParameters,
    ParameterizedQueryStatistics
} from './query/ParameterizedQuery.js';

// Transaction modules
export { TransactionManager } from './transactions/TransactionManager.js';
export { TransactionContext } from './transactions/TransactionContext.js';
export type {
    IsolationLevel,
    TransactionState,
    TransactionOptions,
    TransactionConfig,
    TransactionInfo,
    TransactionStatistics,
    DeadlockInfo,
    ResourceDependency,
    TransactionExecutor,
    TransactionEvent
} from './transactions/TransactionManager.js';
export type {
    SavepointInfo,
    TransactionQueryResult,
    BatchParameters as TransactionBatchParameters,
    BatchExecutionResult as TransactionBatchExecutionResult,
    TransactionContextState
} from './transactions/TransactionContext.js';

// Module registry for dynamic loading
/** Maps configurable module names to their dynamic import factories. */
export const MODULE_REGISTRY = {
    // Connection modules
    'connection-manager': () => importModule<typeof import('./connection/ConnectionManager.js')>('./connection/ConnectionManager.js'),
    'jdbc-connection-factory': () => importModule<typeof import('./connection/JDBCConnectionFactory.js')>('./connection/JDBCConnectionFactory.js'),
    'reconnection-manager': () => importModule<typeof import('./connection/ReconnectionManager.js')>('./connection/ReconnectionManager.js'),
    
    // Performance modules
    'performance-monitor': () => importModule<typeof import('./performance/PerformanceMonitor.js')>('./performance/PerformanceMonitor.js'),
    'metrics-collector': () => importModule<typeof import('./performance/MetricsCollector.js')>('./performance/MetricsCollector.js'),
    
    // Cache modules
    'cache-manager': () => importModule<typeof import('./cache/CacheManager.js')>('./cache/CacheManager.js'),
    'cache-optimizer': () => importModule<typeof import('./cache/CacheOptimizer.js')>('./cache/CacheOptimizer.js'),
    'cache-stats-collector': () => importModule<typeof import('./cache/CacheStatsCollector.js')>('./cache/CacheStatsCollector.js'),
    
    // Schema modules
    'schema-analyzer': () => importModule<typeof import('./schema/SchemaAnalyzer.js')>('./schema/SchemaAnalyzer.js'),
    'relationship-analyzer': () => importModule<typeof import('./schema/RelationshipAnalyzer.js')>('./schema/RelationshipAnalyzer.js'),
    'database-reporter': () => importModule<typeof import('./schema/DatabaseReporter.js')>('./schema/DatabaseReporter.js'),
    
    // Query modules
    'query-executor': () => importModule<typeof import('./query/QueryExecutor.js')>('./query/QueryExecutor.js'),
    'query-validator': () => importModule<typeof import('./query/QueryValidator.js')>('./query/QueryValidator.js'),
    'parameterized-query': () => importModule<typeof import('./query/ParameterizedQuery.js')>('./query/ParameterizedQuery.js'),
    
    // Transaction modules
    'transaction-manager': () => importModule<typeof import('./transactions/TransactionManager.js')>('./transactions/TransactionManager.js'),
    'transaction-context': () => importModule<typeof import('./transactions/TransactionContext.js')>('./transactions/TransactionContext.js'),
    
    // Logging modules
    'logger': () => importModule<typeof import('./logging/Logger.js')>('./logging/Logger.js')
} as const;

/**
 * Get all available module names
 */
export function getAvailableModules(): string[] {
    return Object.keys(MODULE_REGISTRY);
}

/**
 * Load a module dynamically
 */
export async function loadModule(name: keyof typeof MODULE_REGISTRY) {
    const moduleLoader = MODULE_REGISTRY[name];
    if (!Object.hasOwn(MODULE_REGISTRY, name)) {
        throw new Error(`Module '${name}' not found in registry`);
    }
    return await moduleLoader();
}