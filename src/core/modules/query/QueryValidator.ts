/**
 * QueryValidator Module
 * 
 * SQL query validation engine for StarMade HSQLDB operations.
 * Handles query validation, syntax checking, security analysis,
 * SQL injection prevention, and query optimization hints.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { BaseModule, type HSQLManager } from '../../HSQLManager.js';
import { ConnectionManager } from '../connection/ConnectionManager.js';
import { CacheManager } from '../cache/CacheManager.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import { 
    HSQLDBError, 
    ModuleNotInitializedError, 
    ConfigurationError,
    ModuleAlreadyInitializedError,
    SQLSyntaxError,
    ValidationError as HSQLValidationError
} from '../../errors.js';
import { 
    ModuleEventEmitterImpl,
    ModuleEvent, 
    createEventData,
    type ModuleEventEmitter,
    type ModuleEventListener
} from '../../events.js';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * SQL validation levels
 */
export enum ValidationLevel {
    /** Basic syntax validation only */
    BASIC = 'basic',
    /** Standard validation with security checks */
    STANDARD = 'standard',
    /** Strict validation with comprehensive security and performance analysis */
    STRICT = 'strict',
    /** Custom validation with user-defined rules */
    CUSTOM = 'custom'
}

/**
 * Security threat levels
 */
export enum ThreatLevel {
    /** No threats detected */
    NONE = 'none',
    /** Low-risk patterns detected */
    LOW = 'low',
    /** Medium-risk patterns detected */
    MEDIUM = 'medium',
    /** High-risk patterns detected */
    HIGH = 'high',
    /** Critical security threat detected */
    CRITICAL = 'critical'
}

/**
 * Query operation types
 */
export enum QueryOperation {
    SELECT = 'SELECT',
    INSERT = 'INSERT',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    CREATE = 'CREATE',
    DROP = 'DROP',
    ALTER = 'ALTER',
    TRUNCATE = 'TRUNCATE',
    GRANT = 'GRANT',
    REVOKE = 'REVOKE',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
    /** Unique rule identifier */
    id: string;
    /** Rule name */
    name: string;
    /** Rule description */
    description: string;
    /** Rule severity level */
    severity: 'info' | 'warning' | 'error' | 'critical';
    /** Whether rule is enabled */
    enabled: boolean;
    /** Pattern to match (regex string) */
    pattern?: string;
    /** Custom validation function */
    validator?: (sql: string, context: QueryValidationContext) => ValidationResult | Promise<ValidationResult>;
    /** Rule metadata */
    metadata?: Record<string, any>;
}

/**
 * Query validation context
 */
export interface QueryValidationContext {
    /** Original SQL query */
    sql: string;
    /** Query parameters (if any) */
    parameters?: any[];
    /** User context */
    user?: {
        id: string;
        roles: string[];
        permissions: string[];
    };
    /** Connection context */
    connection?: {
        readOnly: boolean;
        database: string;
        schema: string;
    };
    /** Validation options */
    options?: QueryValidationOptions;
    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Query validation options
 */
export interface QueryValidationOptions {
    /** Validation level to apply */
    level?: ValidationLevel;
    /** Enable SQL injection detection */
    enableInjectionDetection?: boolean;
    /** Enable schema validation */
    enableSchemaValidation?: boolean;
    /** Enable performance analysis */
    enablePerformanceAnalysis?: boolean;
    /** Enable privilege checking */
    enablePrivilegeChecking?: boolean;
    /** Maximum query complexity score */
    maxComplexityScore?: number;
    /** Allowed operations */
    allowedOperations?: QueryOperation[];
    /** Forbidden patterns */
    forbiddenPatterns?: RegExp[];
    /** Custom validation rules */
    customRules?: ValidationRule[];
    /** Enable query rewriting suggestions */
    enableRewriteSuggestions?: boolean;
    /** Timeout for validation (ms) */
    timeoutMs?: number;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** Overall threat level */
    threatLevel: ThreatLevel;
    /** Detected query operation */
    operation: QueryOperation;
    /** Validation errors */
    errors: QueryValidationError[];
    /** Validation warnings */
    warnings: QueryValidationWarning[];
    /** Security issues */
    securityIssues: SecurityIssue[];
    /** Performance recommendations */
    performanceHints: PerformanceHint[];
    /** Query metadata */
    queryMetadata: QueryMetadata;
    /** Validation execution time */
    validationTime: number;
    /** Suggested query rewrites */
    rewriteSuggestions?: string[];
}

/**
 * Query validation error interface
 */
export interface QueryValidationError {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Error severity */
    severity: 'error' | 'critical';
    /** Position in query (if applicable) */
    position?: number;
    /** Length of problematic text */
    length?: number;
    /** Suggested fix */
    suggestion?: string;
    /** Rule that triggered the error */
    rule?: string;
}

/**
 * Query validation warning interface
 */
export interface QueryValidationWarning {
    /** Warning code */
    code: string;
    /** Warning message */
    message: string;
    /** Warning severity */
    severity: 'info' | 'warning';
    /** Position in query (if applicable) */
    position?: number;
    /** Length of problematic text */
    length?: number;
    /** Suggested improvement */
    suggestion?: string;
    /** Rule that triggered the warning */
    rule?: string;
}

/**
 * Security issue interface
 */
export interface SecurityIssue {
    /** Issue type */
    type: 'sql_injection' | 'privilege_escalation' | 'data_exposure' | 'resource_abuse' | 'unauthorized_access';
    /** Issue severity */
    severity: ThreatLevel;
    /** Issue description */
    description: string;
    /** Pattern that triggered the issue */
    pattern: string;
    /** Position in query */
    position?: number;
    /** Length of problematic text */
    length?: number;
    /** Mitigation suggestions */
    mitigation: string[];
    /** Risk assessment */
    riskScore: number;
}

/**
 * Performance hint interface
 */
export interface PerformanceHint {
    /** Hint type */
    type: 'index_suggestion' | 'query_rewrite' | 'join_optimization' | 'complexity_warning' | 'resource_usage';
    /** Hint priority */
    priority: 'low' | 'medium' | 'high';
    /** Hint message */
    message: string;
    /** Detailed explanation */
    explanation: string;
    /** Expected performance impact */
    impact: string;
    /** Suggested solution */
    solution?: string;
}

/**
 * Query metadata interface
 */
export interface QueryMetadata {
    /** Parsed query structure */
    structure: {
        /** Main operation */
        operation: QueryOperation;
        /** Target tables */
        tables: string[];
        /** Referenced columns */
        columns: string[];
        /** WHERE clause predicates */
        wherePredicates: string[];
        /** JOIN types and conditions */
        joins: Array<{ type: string; condition: string; table: string }>;
        /** Subqueries detected */
        subqueries: number;
        /** Aggregate functions used */
        aggregates: string[];
        /** Functions used */
        functions: string[];
    };
    /** Query complexity metrics */
    complexity: {
        /** Overall complexity score (0-100) */
        score: number;
        /** Number of table joins */
        joinCount: number;
        /** Nesting depth */
        nestingDepth: number;
        /** Cyclomatic complexity */
        cyclomaticComplexity: number;
        /** Estimated execution cost */
        estimatedCost: number;
    };
    /** Security analysis */
    security: {
        /** Dynamic content detected */
        hasDynamicContent: boolean;
        /** User input detected */
        hasUserInput: boolean;
        /** Privileged operations detected */
        hasPrivilegedOps: boolean;
        /** Data modification operations */
        isDataModifying: boolean;
        /** Schema modification operations */
        isSchemaModifying: boolean;
    };
    /** Performance characteristics */
    performance: {
        /** Estimated selectivity */
        selectivity: number;
        /** Index usage hints */
        indexHints: string[];
        /** Potential bottlenecks */
        bottlenecks: string[];
        /** Resource usage estimate */
        resourceUsage: 'low' | 'medium' | 'high';
    };
}

/**
 * QueryValidator configuration
 */
export interface QueryValidatorConfig {
    /** Default validation level */
    defaultValidationLevel: ValidationLevel;
    /** Enable caching of validation results */
    enableValidationCache: boolean;
    /** Cache TTL for validation results (ms) */
    validationCacheTtl: number;
    /** Maximum cache size for validation results */
    maxValidationCacheSize: number;
    /** Default validation timeout (ms) */
    defaultTimeoutMs: number;
    /** Enable SQL injection detection */
    enableInjectionDetection: boolean;
    /** Enable schema validation */
    enableSchemaValidation: boolean;
    /** Enable performance analysis */
    enablePerformanceAnalysis: boolean;
    /** Maximum allowed complexity score */
    maxComplexityScore: number;
    /** Default allowed operations */
    defaultAllowedOperations: QueryOperation[];
    /** Global forbidden patterns */
    globalForbiddenPatterns: RegExp[];
    /** Built-in validation rules */
    builtInRules: ValidationRule[];
    /** Custom validation rules */
    customRules: ValidationRule[];
    /** Enable query rewriting suggestions */
    enableRewriteSuggestions: boolean;
    /** Enable detailed logging */
    enableDetailedLogging: boolean;
}

// =============================================================================
// QUERYVALIDATOR CLASS
// =============================================================================

/**
 * QueryValidator - SQL query validation and security analysis engine
 * 
 * Features:
 * - SQL syntax validation
 * - SQL injection detection
 * - Security threat analysis
 * - Performance optimization hints
 * - Query complexity analysis
 * - Schema validation
 * - Query rewriting suggestions
 * - Validation result caching
 */
export class QueryValidator implements BaseModule, ModuleEventEmitter<ModuleEvent> {
    public readonly name = 'query-validator';
    public readonly version = '1.0.0';
    public get isInitialized(): boolean { return this._initialized; }

    private _initialized = false;
    private manager?: HSQLManager;
    private logger: ModuleLogger | null = null;
    private eventEmitter: ModuleEventEmitterImpl<ModuleEvent>;
    private connectionManager: ConnectionManager | null = null;
    private cacheManager: CacheManager | null = null;

    // Configuration
    private config: QueryValidatorConfig = {
        defaultValidationLevel: ValidationLevel.STANDARD,
        enableValidationCache: true,
        validationCacheTtl: 300000, // 5 minutes
        maxValidationCacheSize: 50 * 1024 * 1024, // 50MB
        defaultTimeoutMs: 10000, // 10 seconds
        enableInjectionDetection: true,
        enableSchemaValidation: true,
        enablePerformanceAnalysis: true,
        maxComplexityScore: 75,
        defaultAllowedOperations: [
            QueryOperation.SELECT,
            QueryOperation.INSERT,
            QueryOperation.UPDATE,
            QueryOperation.DELETE
        ],
        globalForbiddenPatterns: [
            // SQL injection patterns - more targeted
            /(union\s+select|union\s+all\s+select)/gi,
            // Time-based injection
            /(waitfor\s+delay|benchmark|sleep\s*\()/gi,
            // Boolean-based injection (more specific)
            /(or\s+1\s*=\s*1|and\s+1\s*=\s*1)/gi,
            // Dangerous command execution
            /(exec|execute|sp_|xp_|cmdshell|openrowset|opendatasource)/gi,
            // Potentially dangerous schema queries (more specific)
            /(information_schema\..*password|information_schema\..*secret|information_schema\..*credential)/gi
        ],
        builtInRules: [],
        customRules: [],
        enableRewriteSuggestions: true,
        enableDetailedLogging: false
    };

    // Internal state
    private validationCache = new Map<string, { result: ValidationResult; timestamp: Date }>();
    private validationStats = {
        totalValidations: 0,
        passedValidations: 0,
        failedValidations: 0,
        avgValidationTime: 0,
        cacheHitRate: 0,
        securityIssuesDetected: 0,
        mostCommonIssues: new Map<string, number>()
    };

    private cleanupInterval: NodeJS.Timeout | null = null;

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * Create a new QueryValidator instance
     */
    constructor() {
        this.logger = createModuleLogger('QueryValidator');
        this.eventEmitter = new ModuleEventEmitterImpl(this.logger, 'QueryValidator');

        // Initialize event listeners for module events
        this.eventEmitter.initializeEvents(Object.values(ModuleEvent));

        // Initialize built-in validation rules
        this.initializeBuiltInRules();
    }

    // =============================================================================
    // LIFECYCLE METHODS
    // =============================================================================

    /**
     * Initialize QueryValidator with HSQLManager
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('QueryValidator');
        }

        if (!manager) {
            throw new ConfigurationError('Manager parameter is required for QueryValidator initialization');
        }

        try {
            this.manager = manager;
            
            // Initialize logger
            this.logger = createModuleLogger(this.name);
            this.logger.info('Initializing QueryValidator...');

            // Auto-discover ConnectionManager (required for schema validation)
            this.connectionManager = manager.getModule<ConnectionManager>('connection-manager') || null;
            if (!this.connectionManager || !this.connectionManager.isInitialized) {
                this.logger.warn('ConnectionManager not available - schema validation will be limited');
            }

            // Auto-discover optional modules
            this.cacheManager = manager.getModule<CacheManager>('cache-manager') || null;

            // Start cleanup interval
            this.startCleanupInterval();

            this._initialized = true;
            this.logger.info('QueryValidator initialized successfully');

            // Emit initialization event
            this.emit(ModuleEvent.INITIALIZED, createEventData('query-validator-initialized', {
                module: this.name,
                version: this.version,
                config: this.config,
                hasConnectionManager: !!this.connectionManager,
                hasCacheManager: !!this.cacheManager,
                builtInRulesCount: this.config.builtInRules.length,
                customRulesCount: this.config.customRules.length
            }, this.name));

        } catch (error) {
            this.logger?.error('Failed to initialize QueryValidator', { error });
            throw new HSQLDBError(
                `Failed to initialize ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
                'INIT_ERROR'
            );
        }
    }

    /**
     * Destroy QueryValidator and cleanup resources
     */
    public async destroy(): Promise<void> {
        if (!this._initialized) {
            return; // Already destroyed or never initialized
        }

        this.logger?.info('Destroying QueryValidator...');

        try {
            // Stop cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            // Clear caches
            this.validationCache.clear();

            // Reset statistics
            this.validationStats = {
                totalValidations: 0,
                passedValidations: 0,
                failedValidations: 0,
                avgValidationTime: 0,
                cacheHitRate: 0,
                securityIssuesDetected: 0,
                mostCommonIssues: new Map<string, number>()
            };

            // Clear module references
            this.connectionManager = null;
            this.cacheManager = null;

            this._initialized = false;
            this.logger?.info('QueryValidator destroyed successfully');

            // Emit destruction event
            this.emit(ModuleEvent.DESTROYED, {
                module: this.name,
                version: this.version
            });

        } catch (error) {
            this.logger?.error('Error during QueryValidator destruction', { error });
            throw error;
        } finally {
            this.logger = null;
        }
    }

    // =============================================================================
    // PUBLIC VALIDATION METHODS
    // =============================================================================

    /**
     * Validate a SQL query
     */
    public async validateQuery(
        sql: string, 
        context?: Partial<QueryValidationContext>
    ): Promise<ValidationResult> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryValidator', 'validateQuery');
        }

        if (!sql || typeof sql !== 'string') {
            throw new HSQLValidationError('sql', sql, 'SQL query is required and must be a string');
        }

        const validationContext: QueryValidationContext = {
            sql: sql.trim(),
            parameters: context?.parameters,
            user: context?.user,
            connection: context?.connection,
            options: {
                level: context?.options?.level || ValidationLevel.STANDARD,
                enableInjectionDetection: context?.options?.enableInjectionDetection ?? this.config.enableInjectionDetection,
                enableSchemaValidation: context?.options?.enableSchemaValidation ?? this.config.enableSchemaValidation,
                enablePerformanceAnalysis: context?.options?.enablePerformanceAnalysis ?? this.config.enablePerformanceAnalysis,
                enablePrivilegeChecking: context?.options?.enablePrivilegeChecking ?? false,
                maxComplexityScore: context?.options?.maxComplexityScore ?? this.config.maxComplexityScore,
                allowedOperations: context?.options?.allowedOperations ?? this.config.defaultAllowedOperations,
                forbiddenPatterns: context?.options?.forbiddenPatterns ?? this.config.globalForbiddenPatterns,
                customRules: context?.options?.customRules ?? this.config.customRules,
                enableRewriteSuggestions: context?.options?.enableRewriteSuggestions ?? this.config.enableRewriteSuggestions,
                timeoutMs: context?.options?.timeoutMs ?? this.config.defaultTimeoutMs
            },
            metadata: context?.metadata
        };

        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(validationContext);

        this.logger?.debug('Validating query', { 
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            level: validationContext.options?.level,
            cacheKey
        });

        try {
            // Check cache first
            if (this.config.enableValidationCache) {
                const cachedResult = this.getCachedValidation(cacheKey);
                if (cachedResult) {
                    this.updateValidationStats(cachedResult, Date.now() - startTime, true);
                    return cachedResult;
                }
            }

            // Perform validation
            const result = await this.performValidation(validationContext);
            const validationTime = Date.now() - startTime;
            result.validationTime = validationTime;

            // Cache result if applicable
            if (this.config.enableValidationCache && this.shouldCacheValidation(result)) {
                this.cacheValidation(cacheKey, result);
            }

            // Update statistics
            this.updateValidationStats(result, validationTime, false);

            // Emit validation event
            this.emit(ModuleEvent.STATUS_CHANGED, {
                module: this.name,
                status: result.isValid ? 'validation-passed' : 'validation-failed',
                validationTime,
                threatLevel: result.threatLevel,
                errorsCount: result.errors.length,
                warningsCount: result.warnings.length,
                securityIssuesCount: result.securityIssues.length
            });

            return result;

        } catch (error) {
            const validationTime = Date.now() - startTime;
            
            this.logger?.error('Query validation failed', { 
                sql: sql.substring(0, 100),
                validationTime,
                error 
            });

            // Create error result
            const errorResult: ValidationResult = {
                isValid: false,
                threatLevel: ThreatLevel.CRITICAL,
                operation: QueryOperation.UNKNOWN,
                errors: [{
                    code: 'VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    severity: 'critical' as const
                }],
                warnings: [],
                securityIssues: [],
                performanceHints: [],
                queryMetadata: this.createEmptyQueryMetadata(),
                validationTime
            };

            this.updateValidationStats(errorResult, validationTime, false);

            return errorResult;
        }
    }

    /**
     * Validate multiple queries in batch
     */
    public async validateQueries(
        queries: Array<{ sql: string; context?: Partial<QueryValidationContext> }>
    ): Promise<ValidationResult[]> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('QueryValidator', 'validateQueries');
        }

        if (!Array.isArray(queries) || queries.length === 0) {
            throw new HSQLValidationError('queries', queries, 'Queries array is required and must not be empty');
        }

        const results: ValidationResult[] = [];
        
        for (const query of queries) {
            const result = await this.validateQuery(query.sql, query.context);
            results.push(result);
        }

        return results;
    }

    // =============================================================================
    // VALIDATION IMPLEMENTATION
    // =============================================================================

    /**
     * Perform the actual validation
     */
    private async performValidation(context: QueryValidationContext): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            threatLevel: ThreatLevel.NONE,
            operation: QueryOperation.UNKNOWN,
            errors: [],
            warnings: [],
            securityIssues: [],
            performanceHints: [],
            queryMetadata: this.createEmptyQueryMetadata(),
            validationTime: 0
        };

        try {
            // Step 1: Parse query and detect operation
            result.operation = this.detectQueryOperation(context.sql);
            result.queryMetadata = await this.analyzeQueryStructure(context.sql);

            // Step 2: Basic syntax validation
            await this.validateSyntax(context, result);

            // Step 3: Security validation
            if (context.options?.enableInjectionDetection) {
                await this.validateSecurity(context, result);
            }

            // Step 4: Schema validation
            if (context.options?.enableSchemaValidation && this.connectionManager) {
                await this.validateSchema(context, result);
            }

            // Step 5: Performance analysis
            if (context.options?.enablePerformanceAnalysis) {
                await this.analyzePerformance(context, result);
            }

            // Step 6: Apply custom rules
            await this.applyCustomRules(context, result);

            // Step 7: Generate rewrite suggestions
            if (context.options?.enableRewriteSuggestions) {
                result.rewriteSuggestions = await this.generateRewriteSuggestions(context, result);
            }

            // Determine overall validation result
            result.isValid = result.errors.length === 0;
            result.threatLevel = this.calculateThreatLevel(result);

            return result;

        } catch (error) {
            result.isValid = false;
            result.threatLevel = ThreatLevel.CRITICAL;
            result.errors.push({
                code: 'VALIDATION_INTERNAL_ERROR',
                message: `Internal validation error: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'critical'
            });

            return result;
        }
    }

    /**
     * Detect the main operation of the SQL query
     */
    private detectQueryOperation(sql: string): QueryOperation {
        const normalizedSql = sql.trim().toUpperCase();
        
        if (normalizedSql.startsWith('SELECT')) return QueryOperation.SELECT;
        if (normalizedSql.startsWith('INSERT')) return QueryOperation.INSERT;
        if (normalizedSql.startsWith('UPDATE')) return QueryOperation.UPDATE;
        if (normalizedSql.startsWith('DELETE')) return QueryOperation.DELETE;
        if (normalizedSql.startsWith('CREATE')) return QueryOperation.CREATE;
        if (normalizedSql.startsWith('DROP')) return QueryOperation.DROP;
        if (normalizedSql.startsWith('ALTER')) return QueryOperation.ALTER;
        if (normalizedSql.startsWith('TRUNCATE')) return QueryOperation.TRUNCATE;
        if (normalizedSql.startsWith('GRANT')) return QueryOperation.GRANT;
        if (normalizedSql.startsWith('REVOKE')) return QueryOperation.REVOKE;
        
        return QueryOperation.UNKNOWN;
    }

    /**
     * Analyze query structure and extract metadata
     */
    private async analyzeQueryStructure(sql: string): Promise<QueryMetadata> {
        // This is a simplified implementation
        // In a real-world scenario, you would use a proper SQL parser
        
        const metadata: QueryMetadata = this.createEmptyQueryMetadata();
        const normalizedSql = sql.toUpperCase();

        // Extract tables (simplified)
        const tableMatches = sql.match(/(?:FROM|JOIN|UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/gi);
        if (tableMatches) {
            metadata.structure.tables = tableMatches
                .map(match => match.split(/\s+/).pop() || '')
                .filter(table => table.length > 0);
        }

        // Calculate complexity
        metadata.complexity.score = this.calculateComplexityScore(sql);
        metadata.complexity.joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
        metadata.complexity.nestingDepth = this.calculateNestingDepth(sql);

        // Security analysis
        metadata.security.hasDynamicContent = /\$\{|\#\{|\%\{/.test(sql);
        metadata.security.hasUserInput = /\?|\$\d+|:\w+/.test(sql);
        metadata.security.isDataModifying = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].some(op => 
            normalizedSql.includes(op)
        );
        metadata.security.isSchemaModifying = ['CREATE', 'DROP', 'ALTER'].some(op => 
            normalizedSql.includes(op)
        );

        return metadata;
    }

    /**
     * Validate SQL syntax
     */
    private async validateSyntax(context: QueryValidationContext, result: ValidationResult): Promise<void> {
        // Basic syntax checks
        const sql = context.sql;

        // Check for balanced parentheses
        let parenCount = 0;
        for (let i = 0; i < sql.length; i++) {
            if (sql[i] === '(') parenCount++;
            if (sql[i] === ')') parenCount--;
            if (parenCount < 0) {
                result.errors.push({
                    code: 'UNMATCHED_PARENTHESIS',
                    message: 'Unmatched closing parenthesis',
                    severity: 'error',
                    position: i,
                    suggestion: 'Check parentheses balance'
                });
                return;
            }
        }

        if (parenCount > 0) {
            result.errors.push({
                code: 'UNCLOSED_PARENTHESIS',
                message: 'Unclosed parentheses detected',
                severity: 'error',
                suggestion: 'Add missing closing parentheses'
            });
        }

        // Check for incomplete statements
        if (!sql.trim()) {
            result.errors.push({
                code: 'EMPTY_QUERY',
                message: 'Query cannot be empty',
                severity: 'error'
            });
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            { pattern: /;\s*$/, message: 'Unnecessary semicolon at end of query', severity: 'warning' as const },
            { pattern: /\s+$/, message: 'Trailing whitespace detected', severity: 'info' as const },
            { pattern: /\s{2,}/, message: 'Multiple consecutive spaces detected', severity: 'info' as const }
        ];

        for (const { pattern, message, severity } of suspiciousPatterns) {
            const match = sql.match(pattern);
            if (match) {
                if (severity === 'warning' || severity === 'info') {
                    result.warnings.push({
                        code: 'SYNTAX_WARNING',
                        message,
                        severity,
                        position: match.index,
                        length: match[0].length
                    });
                }
            }
        }
    }

    /**
     * Validate security aspects
     */
    private async validateSecurity(context: QueryValidationContext, result: ValidationResult): Promise<void> {
        const sql = context.sql;

        // Check against forbidden patterns
        for (let i = 0; i < this.config.globalForbiddenPatterns.length; i++) {
            const pattern = this.config.globalForbiddenPatterns[i];
            const matches = sql.match(pattern);
            
            if (matches) {
                result.securityIssues.push({
                    type: 'sql_injection',
                    severity: ThreatLevel.HIGH,
                    description: 'Potentially dangerous SQL pattern detected',
                    pattern: pattern.source,
                    position: sql.indexOf(matches[0]),
                    length: matches[0].length,
                    mitigation: [
                        'Use parameterized queries',
                        'Validate and sanitize input',
                        'Apply principle of least privilege'
                    ],
                    riskScore: 85
                });
            }
        }

        // Check for SQL injection patterns
        const injectionPatterns = [
            {
                pattern: /(union\s+select|or\s+1\s*=\s*1|and\s+1\s*=\s*1)/gi,
                type: 'sql_injection' as const,
                severity: ThreatLevel.CRITICAL,
                description: 'SQL injection attempt detected',
                riskScore: 95
            },
            {
                pattern: /(exec|execute|sp_|xp_)/gi,
                type: 'unauthorized_access' as const,
                severity: ThreatLevel.HIGH,
                description: 'Potentially dangerous stored procedure call',
                riskScore: 80
            },
            {
                pattern: /(drop\s+table|truncate\s+table|delete\s+from.*where\s+1\s*=\s*1)/gi,
                type: 'data_exposure' as const,
                severity: ThreatLevel.CRITICAL,
                description: 'Potentially destructive operation detected',
                riskScore: 90
            }
        ];

        for (const injectionCheck of injectionPatterns) {
            const matches = sql.match(injectionCheck.pattern);
            if (matches) {
                result.securityIssues.push({
                    type: injectionCheck.type,
                    severity: injectionCheck.severity,
                    description: injectionCheck.description,
                    pattern: injectionCheck.pattern.source,
                    position: sql.indexOf(matches[0]),
                    length: matches[0].length,
                    mitigation: [
                        'Use parameterized queries',
                        'Implement proper input validation',
                        'Apply database-level security controls'
                    ],
                    riskScore: injectionCheck.riskScore
                });
            }
        }
    }

    /**
     * Validate against database schema
     */
    private async validateSchema(context: QueryValidationContext, result: ValidationResult): Promise<void> {
        if (!this.connectionManager) {
            result.warnings.push({
                code: 'SCHEMA_VALIDATION_UNAVAILABLE',
                message: 'Schema validation unavailable - ConnectionManager not found',
                severity: 'warning'
            });
            return;
        }

        try {
            // Extract table names from query
            const tables = result.queryMetadata.structure.tables;
            
            if (tables.length > 0) {
                // This would typically involve checking if tables exist
                // For now, we'll add a placeholder validation
                result.warnings.push({
                    code: 'SCHEMA_VALIDATION_PLACEHOLDER',
                    message: 'Schema validation is implemented but requires database connection',
                    severity: 'info'
                });
            }

        } catch (error) {
            result.warnings.push({
                code: 'SCHEMA_VALIDATION_ERROR',
                message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'warning'
            });
        }
    }

    /**
     * Analyze query performance
     */
    private async analyzePerformance(context: QueryValidationContext, result: ValidationResult): Promise<void> {
        const complexity = result.queryMetadata.complexity;
        
        // Complexity warnings
        if (complexity.score > (context.options?.maxComplexityScore ?? this.config.maxComplexityScore)) {
            result.performanceHints.push({
                type: 'complexity_warning',
                priority: 'high',
                message: `Query complexity score (${complexity.score}) exceeds maximum allowed (${context.options?.maxComplexityScore ?? this.config.maxComplexityScore})`,
                explanation: 'High complexity queries may perform poorly and consume excessive resources',
                impact: 'May cause slow query execution and high resource usage',
                solution: 'Consider breaking down the query into smaller parts or optimizing the logic'
            });
        }

        // Join analysis
        if (complexity.joinCount > 5) {
            result.performanceHints.push({
                type: 'join_optimization',
                priority: 'medium',
                message: `Query contains ${complexity.joinCount} joins which may impact performance`,
                explanation: 'Multiple joins can significantly slow down query execution',
                impact: 'Increased execution time and memory usage',
                solution: 'Consider using indexes on join columns or restructuring the query'
            });
        }

        // Index suggestions
        const tables = result.queryMetadata.structure.tables;
        if (tables.length > 0) {
            result.performanceHints.push({
                type: 'index_suggestion',
                priority: 'low',
                message: 'Consider adding indexes on frequently queried columns',
                explanation: 'Proper indexing can significantly improve query performance',
                impact: 'Faster query execution for SELECT operations',
                solution: 'Analyze query patterns and add indexes on columns used in WHERE, JOIN, and ORDER BY clauses'
            });
        }
    }

    /**
     * Apply custom validation rules
     */
    private async applyCustomRules(context: QueryValidationContext, result: ValidationResult): Promise<void> {
        const allRules = [...this.config.builtInRules, ...this.config.customRules];
        
        for (const rule of allRules) {
            if (!rule.enabled) continue;

            try {
                let ruleResult: ValidationResult | null = null;

                // Apply pattern-based rule
                if (rule.pattern) {
                    const pattern = new RegExp(rule.pattern, 'gi');
                    const matches = context.sql.match(pattern);
                    
                    if (matches) {
                        const issue = {
                            code: rule.id,
                            message: rule.description,
                            severity: rule.severity as any,
                            rule: rule.name
                        };

                        if (rule.severity === 'error' || rule.severity === 'critical') {
                            result.errors.push(issue);
                        } else {
                            result.warnings.push(issue);
                        }
                    }
                }

                // Apply function-based rule
                if (rule.validator) {
                    ruleResult = await rule.validator(context.sql, context);
                    
                    if (ruleResult && !ruleResult.isValid) {
                        result.errors.push(...ruleResult.errors);
                        result.warnings.push(...ruleResult.warnings);
                        result.securityIssues.push(...ruleResult.securityIssues);
                        result.performanceHints.push(...ruleResult.performanceHints);
                    }
                }

            } catch (error) {
                this.logger?.warn('Custom rule execution failed', { 
                    rule: rule.id, 
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Generate query rewrite suggestions
     */
    private async generateRewriteSuggestions(context: QueryValidationContext, result: ValidationResult): Promise<string[]> {
        const suggestions: string[] = [];
        const sql = context.sql;

        // Basic optimization suggestions
        if (sql.includes('SELECT *')) {
            suggestions.push(sql.replace(/SELECT \*/g, 'SELECT specific_columns'));
        }

        if (sql.match(/WHERE.*OR.*OR/gi)) {
            suggestions.push('Consider using IN clause instead of multiple OR conditions');
        }

        if (sql.match(/ORDER BY.*LIMIT/gi)) {
            suggestions.push('Consider adding an index on the ORDER BY column for better performance');
        }

        return suggestions;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Calculate query complexity score
     */
    private calculateComplexityScore(sql: string): number {
        let score = 0;
        
        // Base complexity
        score += 10;
        
        // Add points for various constructs
        score += (sql.match(/\bJOIN\b/gi) || []).length * 10;
        score += (sql.match(/\bUNION\b/gi) || []).length * 15;
        score += (sql.match(/\bSUBQUERY\b|\(\s*SELECT/gi) || []).length * 20;
        score += (sql.match(/\bCASE\b/gi) || []).length * 5;
        score += (sql.match(/\bEXISTS\b/gi) || []).length * 10;
        score += (sql.match(/\bGROUP BY\b/gi) || []).length * 8;
        score += (sql.match(/\bORDER BY\b/gi) || []).length * 5;
        score += (sql.match(/\bHAVING\b/gi) || []).length * 10;
        
        return Math.min(score, 100); // Cap at 100
    }

    /**
     * Calculate nesting depth
     */
    private calculateNestingDepth(sql: string): number {
        let depth = 0;
        let maxDepth = 0;
        
        for (const char of sql) {
            if (char === '(') {
                depth++;
                maxDepth = Math.max(maxDepth, depth);
            } else if (char === ')') {
                depth--;
            }
        }
        
        return maxDepth;
    }

    /**
     * Calculate overall threat level
     */
    private calculateThreatLevel(result: ValidationResult): ThreatLevel {
        if (result.errors.some(e => e.severity === 'critical')) {
            return ThreatLevel.CRITICAL;
        }
        
        if (result.securityIssues.some(s => s.severity === ThreatLevel.CRITICAL)) {
            return ThreatLevel.CRITICAL;
        }
        
        if (result.securityIssues.some(s => s.severity === ThreatLevel.HIGH) || 
            result.errors.some(e => e.severity === 'error')) {
            return ThreatLevel.HIGH;
        }
        
        if (result.securityIssues.some(s => s.severity === ThreatLevel.MEDIUM) || 
            result.warnings.length > 0) {
            return ThreatLevel.MEDIUM;
        }
        
        if (result.securityIssues.some(s => s.severity === ThreatLevel.LOW)) {
            return ThreatLevel.LOW;
        }
        
        return ThreatLevel.NONE;
    }

    /**
     * Create empty query metadata
     */
    private createEmptyQueryMetadata(): QueryMetadata {
        return {
            structure: {
                operation: QueryOperation.UNKNOWN,
                tables: [],
                columns: [],
                wherePredicates: [],
                joins: [],
                subqueries: 0,
                aggregates: [],
                functions: []
            },
            complexity: {
                score: 0,
                joinCount: 0,
                nestingDepth: 0,
                cyclomaticComplexity: 0,
                estimatedCost: 0
            },
            security: {
                hasDynamicContent: false,
                hasUserInput: false,
                hasPrivilegedOps: false,
                isDataModifying: false,
                isSchemaModifying: false
            },
            performance: {
                selectivity: 0,
                indexHints: [],
                bottlenecks: [],
                resourceUsage: 'low'
            }
        };
    }

    /**
     * Generate cache key for validation result
     */
    private generateCacheKey(context: QueryValidationContext): string {
        const keyData = {
            sql: context.sql,
            level: context.options?.level,
            enableInjection: context.options?.enableInjectionDetection,
            enableSchema: context.options?.enableSchemaValidation,
            enablePerformance: context.options?.enablePerformanceAnalysis,
            maxComplexity: context.options?.maxComplexityScore,
            customRulesCount: context.options?.customRules?.length || 0
        };
        
        // Simple hash function
        const keyString = JSON.stringify(keyData);
        let hash = 0;
        for (let i = 0; i < keyString.length; i++) {
            const char = keyString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    /**
     * Get cached validation result
     */
    private getCachedValidation(cacheKey: string): ValidationResult | null {
        const cached = this.validationCache.get(cacheKey);
        
        if (!cached) {
            return null;
        }

        // Check TTL
        const age = Date.now() - cached.timestamp.getTime();
        if (age > this.config.validationCacheTtl) {
            this.validationCache.delete(cacheKey);
            return null;
        }

        return cached.result;
    }

    /**
     * Cache validation result
     */
    private cacheValidation(cacheKey: string, result: ValidationResult): void {
        this.validationCache.set(cacheKey, {
            result: { ...result },
            timestamp: new Date()
        });

        // Enforce cache size limits
        if (this.validationCache.size > 1000) { // Max 1000 cached results
            const oldestKey = this.validationCache.keys().next().value;
            if (oldestKey) {
                this.validationCache.delete(oldestKey);
            }
        }
    }

    /**
     * Check if validation result should be cached
     */
    private shouldCacheValidation(result: ValidationResult): boolean {
        // Don't cache results with critical errors
        if (result.threatLevel === ThreatLevel.CRITICAL) {
            return false;
        }

        // Don't cache results that took too long to compute
        if (result.validationTime > 5000) { // 5 seconds
            return false;
        }

        return true;
    }

    /**
     * Update validation statistics
     */
    private updateValidationStats(result: ValidationResult, validationTime: number, fromCache: boolean): void {
        this.validationStats.totalValidations++;
        
        if (result.isValid) {
            this.validationStats.passedValidations++;
        } else {
            this.validationStats.failedValidations++;
        }

        // Update average validation time
        const totalTime = this.validationStats.avgValidationTime * (this.validationStats.totalValidations - 1) + validationTime;
        this.validationStats.avgValidationTime = totalTime / this.validationStats.totalValidations;

        // Update cache hit rate
        const cacheHits = fromCache ? 1 : 0;
        this.validationStats.cacheHitRate = 
            (this.validationStats.cacheHitRate * (this.validationStats.totalValidations - 1) + cacheHits) / 
            this.validationStats.totalValidations;

        // Update security issues count
        this.validationStats.securityIssuesDetected += result.securityIssues.length;

        // Update most common issues
        for (const issue of result.securityIssues) {
            const count = this.validationStats.mostCommonIssues.get(issue.type) || 0;
            this.validationStats.mostCommonIssues.set(issue.type, count + 1);
        }
    }

    /**
     * Initialize built-in validation rules
     */
    private initializeBuiltInRules(): void {
        this.config.builtInRules = [
            {
                id: 'no-select-star',
                name: 'Avoid SELECT *',
                description: 'SELECT * should be avoided for better performance',
                severity: 'warning',
                enabled: true,
                pattern: 'SELECT\\s+\\*'
            },
            {
                id: 'no-functions-in-where',
                name: 'Avoid functions in WHERE clause',
                description: 'Functions in WHERE clause can prevent index usage',
                severity: 'warning',
                enabled: true,
                pattern: 'WHERE\\s+\\w+\\s*\\('
            },
            {
                id: 'require-where-for-update-delete',
                name: 'Require WHERE clause for UPDATE/DELETE',
                description: 'UPDATE and DELETE statements should have WHERE clause',
                severity: 'error',
                enabled: true,
                validator: async (sql: string, context: QueryValidationContext): Promise<ValidationResult> => {
                    const hasWhere = /WHERE/i.test(sql);
                    const isUpdateOrDelete = /^(UPDATE|DELETE)/i.test(sql.trim());
                    
                    if (isUpdateOrDelete && !hasWhere) {
                        return {
                            isValid: false,
                            errors: [{
                                code: 'MISSING_WHERE_CLAUSE',
                                message: 'UPDATE/DELETE statements must include WHERE clause',
                                severity: 'error' as const
                            }],
                            warnings: [],
                            securityIssues: [],
                            performanceHints: [],
                            threatLevel: ThreatLevel.HIGH,
                            operation: QueryOperation.UNKNOWN,
                            queryMetadata: this.createEmptyQueryMetadata(),
                            validationTime: 0
                        };
                    }
                    
                    return {
                        isValid: true,
                        errors: [],
                        warnings: [],
                        securityIssues: [],
                        performanceHints: [],
                        threatLevel: ThreatLevel.NONE,
                        operation: QueryOperation.UNKNOWN,
                        queryMetadata: this.createEmptyQueryMetadata(),
                        validationTime: 0
                    };
                }
            }
        ];
    }

    /**
     * Start cleanup interval
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 300000); // Cleanup every 5 minutes
    }

    /**
     * Perform cleanup of expired cache entries
     */
    private performCleanup(): void {
        const now = Date.now();
        let expiredCount = 0;

        for (const [key, cached] of this.validationCache.entries()) {
            const age = now - cached.timestamp.getTime();
            if (age > this.config.validationCacheTtl) {
                this.validationCache.delete(key);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            this.logger?.debug('Validation cache cleanup completed', {
                expiredEntries: expiredCount,
                remainingEntries: this.validationCache.size
            });
        }
    }

    // =============================================================================
    // PUBLIC GETTERS AND CONFIGURATION
    // =============================================================================

    /**
     * Get validation statistics
     */
    public getStatistics() {
        return { ...this.validationStats };
    }

    /**
     * Get current configuration
     */
    public getConfiguration(): QueryValidatorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfiguration(config: Partial<QueryValidatorConfig>): void {
        this.config = { ...this.config, ...config };
        
        this.logger?.info('Configuration updated', { config });
        
        this.emit(ModuleEvent.CONFIG_UPDATED, {
            module: this.name,
            config: this.config
        });
    }

    /**
     * Clear validation cache
     */
    public clearCache(): void {
        const size = this.validationCache.size;
        this.validationCache.clear();
        
        this.logger?.info('Validation cache cleared', { entriesRemoved: size });
        
        this.emit(ModuleEvent.STATUS_CHANGED, {
            module: this.name,
            status: 'cache-cleared',
            entriesRemoved: size
        });
    }

    /**
     * Get cache statistics
     */
    public getCacheStats() {
        const now = Date.now();
        const entries = Array.from(this.validationCache.entries()).map(([key, cached]) => ({
            key,
            age: now - cached.timestamp.getTime(),
            threatLevel: cached.result.threatLevel,
            isValid: cached.result.isValid
        }));

        return {
            size: this.validationCache.size,
            entries,
            hitRate: this.validationStats.cacheHitRate
        };
    }

    /**
     * Add custom validation rule
     */
    public addCustomRule(rule: ValidationRule): void {
        this.config.customRules.push(rule);
        
        this.logger?.info('Custom validation rule added', { rule: rule.id });
        
        this.emit(ModuleEvent.CONFIG_UPDATED, {
            module: this.name,
            action: 'rule-added',
            rule: rule.id
        });
    }

    /**
     * Remove custom validation rule
     */
    public removeCustomRule(ruleId: string): boolean {
        const index = this.config.customRules.findIndex(rule => rule.id === ruleId);
        
        if (index >= 0) {
            this.config.customRules.splice(index, 1);
            
            this.logger?.info('Custom validation rule removed', { rule: ruleId });
            
            this.emit(ModuleEvent.CONFIG_UPDATED, {
                module: this.name,
                action: 'rule-removed',
                rule: ruleId
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Get connection manager instance
     */
    public getConnectionManager(): ConnectionManager | null {
        return this.connectionManager;
    }

    /**
     * Get cache manager instance
     */
    public getCacheManager(): CacheManager | null {
        return this.cacheManager;
    }

    // =============================================================================
    // EVENT EMITTER INTERFACE IMPLEMENTATION
    // =============================================================================

    /**
     * Add event listener
     */
    public on(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Add one-time event listener
     */
    public once(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.once(event, listener);
    }

    /**
     * Remove event listener
     */
    public off(event: ModuleEvent, listener: ModuleEventListener<ModuleEvent>): void {
        this.eventEmitter.off(event, listener);
    }

    /**
     * Emit event
     */
    public emit(event: ModuleEvent, data?: any): void {
        this.eventEmitter.emit(event, data);
    }

    /**
     * Remove all listeners for an event or all events
     */
    public removeAllListeners(event?: ModuleEvent): void {
        this.eventEmitter.removeAllListeners(event);
    }

    /**
     * Get listener count for an event
     */
    public listenerCount(event: ModuleEvent): number {
        return this.eventEmitter.listenerCount(event);
    }

    /**
     * Get all events that have listeners
     */
    public eventNames(): ModuleEvent[] {
        return this.eventEmitter.eventNames() as ModuleEvent[];
    }
}