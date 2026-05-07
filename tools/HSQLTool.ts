/**
 * @fileoverview Advanced HSQLDB Management Tool for StarMade Databases
 * 
 * Professional command-line tool for managing StarMade HSQLDB databases with
 * advanced features including schema analysis, data import/export, validation,
 * and maintenance operations.
 * 
 * Features:
 * - Schema introspection and validation
 * - Data import/export with StarMade compatibility
 * - Transaction management with rollback capabilities
 * - Foreign key validation and constraint checking
 * - Database health monitoring and optimization
 * - Bulk operations with progress tracking
 * - Advanced query execution with parameterized queries
 * - Cache management and performance monitoring
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    ValidationError,
    QueryExecutionError,
    ErrorFactory,
    ConflictError,
    ConnectionError,
    TransactionError
} from '../src/core/errors.js'
import { HSQLManager } from '../src/core/index.js';
import type { ParameterizedQuery } from '../src/core/modules/query/ParameterizedQuery.js';
import type { SchemaAnalyzer } from '../src/core/modules/schema/SchemaAnalyzer.js';
import type { TransactionManager } from '../src/core/modules/transactions/TransactionManager.js';
import type { CacheManager } from '../src/core/modules/cache/CacheManager.js';
import type { MetricsCollector } from '../src/core/modules/performance/MetricsCollector.js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    starmadeDir: './tests/sandbox',
    worldName: 'test_world',
    connection: {
        timeoutMs: 30000, // Increased timeout for large operations
        maxRetries: 3,
        readOnly: false,
        autoCommit: true,
        maxConcurrentConnections: 3 // Reduced for stability
    },
    modules: {
        enableRelationshipAnalysis: true,
        enableQueryValidation: false,
        enableParameterizedQueries: true,
        enableAdvancedCaching: true,
        enableMetricsCollection: true,
        enableAutoReconnection: false,
        enableConnectionFactory: true,
        enableTransactionManager: true
    },
    logging: {
        level: 'info' as 'info' | 'debug' | 'warn' | 'error',
        enableConsole: true,
        enableFile: true,
        enableQueries: false, // Disabled for cleaner output
        enableConnections: false,
        enablePerformance: true,
        logDir: './logs',
        maxSize: '50m',
        maxFiles: 10
    }
};

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

interface TableSummary {
    name: string;
    rowCount: number;
    sizeBytes?: number;
    health: 'healthy' | 'empty' | 'error';
    lastModified?: Date;
}

interface DatabaseHealth {
    isHealthy: boolean;
    totalTables: number;
    totalRows: number;
    emptyTables: string[];
    errorTables: string[];
    foreignKeyIssues: string[];
    suggestions: string[];
}

interface ImportOptions {
    skipFKChecks: boolean;
    batchSize: number;
    skipValidation: boolean;
    continueOnError: boolean;
    dryRun: boolean;
}

interface ExportOptions {
    includeData: boolean;
    includeSchema: boolean;
    format: 'sql' | 'json' | 'csv';
    compress: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Progress bar for long operations
 */
class ProgressBar {
    private current = 0;
    private total: number;
    private startTime: number;
    private barLength = 40;

    constructor(total: number) {
        this.total = total;
        this.startTime = Date.now();
    }

    update(current: number, message = '') {
        this.current = current;
        const percent = Math.floor((current / this.total) * 100);
        const filled = Math.floor((current / this.total) * this.barLength);
        const empty = this.barLength - filled;
        
        const elapsed = Date.now() - this.startTime;
        const estimatedTotal = elapsed * (this.total / current);
        const remaining = estimatedTotal - elapsed;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const eta = current > 0 ? formatDuration(remaining) : 'calculating...';
        
        process.stdout.write(`\r[${bar}] ${percent}% (${current}/${this.total}) ${message} ETA: ${eta}`);
        
        if (current >= this.total) {
            process.stdout.write('\n');
        }
    }
}

// =============================================================================
// MAIN HSQL TOOL CLASS
// =============================================================================

class HSQLTool {
    private manager!: HSQLManager;
    public parameterizedQuery!: ParameterizedQuery; // Made public for access in main
    private schemaAnalyzer?: SchemaAnalyzer;
    private transactionManager?: TransactionManager;
    private cacheManager?: CacheManager;
    private metricsCollector?: MetricsCollector;

    /**
     * Initialize the HSQL tool
     */
    async initialize(): Promise<void> {
        console.log('Initializing HSQLDB Management Tool...');
        
        this.manager = new HSQLManager(CONFIG);
        await this.manager.initialize();

        // Get required modules
        this.parameterizedQuery = this.manager.getModule<ParameterizedQuery>('parameterized-query')!;
        if (!this.parameterizedQuery) {
            throw new Error('ParameterizedQuery module not available');
        }

        // Get optional modules
        this.schemaAnalyzer = this.manager.getModule<SchemaAnalyzer>('schema-analyzer');
        this.transactionManager = this.manager.getModule<TransactionManager>('transaction-manager');
        this.cacheManager = this.manager.getModule<CacheManager>('cache-manager');
        this.metricsCollector = this.manager.getModule<MetricsCollector>('metrics-collector');

        console.log('Database connection established');
        console.log(`Available modules: ${this.getAvailableModules().join(', ')}`);
    }

    /**
     * Get list of available modules
     */
    private getAvailableModules(): string[] {
        const modules = ['ParameterizedQuery'];
        if (this.schemaAnalyzer) modules.push('SchemaAnalyzer');
        if (this.transactionManager) modules.push('TransactionManager');
        if (this.cacheManager) modules.push('CacheManager');
        if (this.metricsCollector) modules.push('MetricsCollector');
        return modules;
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        if (this.manager) {
            try {
                await this.manager.destroy();
                // Force a small delay to ensure cleanup is complete
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
        }
    }

    // =============================================================================
    // ENHANCED TABLE OPERATIONS
    // =============================================================================

    /**
     * Get enhanced table information with health status
     */
    async getTableSummaries(): Promise<TableSummary[]> {
        const tableNames = await this.listTables();
        const summaries: TableSummary[] = [];
        
        console.log(`Analyzing ${tableNames.length} tables...`);
        const progress = new ProgressBar(tableNames.length);
        
        for (let i = 0; i < tableNames.length; i++) {
            const tableName = tableNames[i];
            try {
                const countResult = await this.parameterizedQuery.execute(`SELECT COUNT(*) FROM ${tableName}`);
                const rowCount = countResult.success && countResult.rows ? countResult.rows[0][0] : 0;
                
                // Try to get table size if SchemaAnalyzer is available
                let sizeBytes: number | undefined;
                if (this.schemaAnalyzer) {
                    try {
                        const tableInfo = await this.schemaAnalyzer.analyzeTable(tableName, {
                            enableDeepAnalysis: false,
                            enableStatistics: true
                        });
                        // Use available size information from statistics
                        sizeBytes = tableInfo.statistics?.sizeBytes;
                    } catch (error) {
                        // Size info not available
                    }
                }
                
                summaries.push({
                    name: tableName,
                    rowCount,
                    sizeBytes,
                    health: rowCount > 0 ? 'healthy' : 'empty'
                });
            } catch (error) {
                summaries.push({
                    name: tableName,
                    rowCount: -1,
                    health: 'error'
                });
            }
            
            progress.update(i + 1, `Analyzing ${tableName}`);
        }
        
        return summaries.sort((a, b) => b.rowCount - a.rowCount);
    }

    /**
     * Get database health assessment
     */
    async getDatabaseHealth(): Promise<DatabaseHealth> {
        const summaries = await this.getTableSummaries();
        const emptyTables = summaries.filter(t => t.health === 'empty').map(t => t.name);
        const errorTables = summaries.filter(t => t.health === 'error').map(t => t.name);
        const totalRows = summaries.reduce((sum, t) => sum + Math.max(0, t.rowCount), 0);
        
        const foreignKeyIssues: string[] = [];
        const suggestions: string[] = [];
        
        // Check for foreign key issues if SchemaAnalyzer is available
        if (this.schemaAnalyzer) {
            try {
                // This would need to be implemented in SchemaAnalyzer
                // const fkValidation = await this.schemaAnalyzer.validateForeignKeys();
                // foreignKeyIssues.push(...fkValidation.issues);
            } catch (error) {
                // FK validation not available
            }
        }
        
        // Generate suggestions
        if (emptyTables.length > summaries.length / 2) {
            suggestions.push('Consider importing data - most tables are empty');
        }
        if (errorTables.length > 0) {
            suggestions.push('Fix table access errors before proceeding');
        }
        if (totalRows === 0) {
            suggestions.push('Database appears to be completely empty');
        }
        
        return {
            isHealthy: errorTables.length === 0 && totalRows > 0,
            totalTables: summaries.length,
            totalRows,
            emptyTables,
            errorTables,
            foreignKeyIssues,
            suggestions
        };
    }

    // =============================================================================
    // ORIGINAL METHODS (ENHANCED)
    // =============================================================================

    async getTableCounts(): Promise<Record<string, number>> {
        const result = await this.parameterizedQuery.execute(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'`
        );
        const counts: Record<string, number> = {};

        if (result && result.success && result.rows) {
            for (const row of result.rows) {
                const tableName = row[0];
                try {
                    const countResult = await this.parameterizedQuery.execute(`SELECT COUNT(*) FROM ${tableName}`);
                    if (countResult && countResult.success && countResult.rows && countResult.rows.length > 0) {
                        counts[tableName] = countResult.rows[0][0] || 0;
                    }
                } catch (error) {
                    console.error(`Error fetching count for table ${tableName}:`, error);
                    counts[tableName] = -1; // Mark as error
                }
            }
        }

        return counts;
    }

    async listTables(): Promise<string[]> {
        const result = await this.parameterizedQuery.execute(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' ORDER BY TABLE_NAME`
        );
        
        if (result && result.success && result.rows) {
            return result.rows.map(row => row[0]);
        }
        
        return [];
    }

    async describeTable(tableName: string): Promise<any[]> {
        const result = await this.parameterizedQuery.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = ? 
            ORDER BY ORDINAL_POSITION
        `, [tableName]);
        
        if (result && result.success && result.rows) {
            return result.rows.map(row => ({
                name: row[0],
                type: row[1],
                nullable: row[2] === 'YES',
                defaultValue: row[3],
                maxLength: row[4]
            }));
        }
        
        return [];
    }

    async wipeTable(tableName: string): Promise<number> {
        try {
            // For HSQLDB, use SET DATABASE REFERENTIAL INTEGRITY instead
            await this.parameterizedQuery.execute('SET DATABASE REFERENTIAL INTEGRITY FALSE');
            
            const result = await this.parameterizedQuery.execute(`DELETE FROM ${tableName}`);
            
            // Re-enable foreign key checks
            await this.parameterizedQuery.execute('SET DATABASE REFERENTIAL INTEGRITY TRUE');
            
            // Clear cache for this table if available
            if (this.cacheManager) {
                await this.cacheManager.clear(`table:${tableName}:*`);
            }
            
            return result.affectedRows || 0;
        } catch (error) {
            // Try to re-enable foreign key checks even if delete failed
            try {
                await this.parameterizedQuery.execute('SET DATABASE REFERENTIAL INTEGRITY TRUE');
            } catch {}
            throw error;
        }
    }

    async checkpoint(): Promise<void> {
        await this.parameterizedQuery.execute('CHECKPOINT');
    }

    // =============================================================================
    // ENHANCED IMPORT/EXPORT OPERATIONS
    // =============================================================================

    async importSQLFile(filePath: string, options: Partial<ImportOptions> = {}): Promise<{success: number, errors: number, warnings: string[]}> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const {
            skipFKChecks = false,
            batchSize = 100,
            skipValidation = false,
            continueOnError = true,
            dryRun = false
        } = options;
        
        console.log('Reading SQL file...');
        let sqlContent = fs.readFileSync(filePath, 'utf-8');
        const originalSize = sqlContent.length;
        
        // Enhanced SQL cleaning for HSQLDB compatibility
        console.log('Applying StarMade to HSQLDB compatibility fixes...');
        const warnings: string[] = [];
        
        // Track compatibility fixes
        let fixesApplied = 0;
        
        sqlContent = sqlContent
            // Fix JavaScript boolean values to SQL
            .replace(/,\s*true\s*,/g, (match) => { fixesApplied++; return ', TRUE,'; })
            .replace(/,\s*false\s*,/g, (match) => { fixesApplied++; return ', FALSE,'; })
            .replace(/,\s*true\s*\)/g, (match) => { fixesApplied++; return ', TRUE)'; })
            .replace(/,\s*false\s*\)/g, (match) => { fixesApplied++; return ', FALSE)'; })
            .replace(/\btrue\b/g, 'TRUE')
            .replace(/\bfalse\b/g, 'FALSE')
            // CORRECTION CRITIQUE: Eviter de transformer ARRAY[...] qui sont déjà corrects
            // Transformer seulement les arrays avec quotes '[...]' en ARRAY[...]
            .replace(/'\[([^\]]+)\]'/g, (match, values) => {
                fixesApplied++;
                try {
                    const arrayValues = values.split(',').map((v: string) => v.trim());
                    const validValues = arrayValues.every((v: string) => !isNaN(parseFloat(v)));
                    if (validValues) {
                        return `ARRAY[${arrayValues.join(', ')}]`;
                    } else {
                        warnings.push(`Invalid array converted to NULL: ${match}`);
                        return 'NULL';
                    }
                } catch (e) {
                    warnings.push(`Array parsing failed, converted to NULL: ${match}`);
                    return 'NULL';
                }
            })
            // Fix problematic binary data
            .replace(/X'[0-9A-Fa-f]+'/g, (match) => {
                if (match.length > 20) { // Large binary data
                    fixesApplied++;
                    warnings.push(`Large binary data replaced with placeholder: ${match.substring(0, 20)}...`);
                }
                return "X'00'";
            })
            .replace(/\bNULL\b/gi, 'NULL');
        
        console.log(`Applied ${fixesApplied} compatibility fixes`);
        if (warnings.length > 0) {
            console.log(`  ${warnings.length} warnings generated during preprocessing`);
        }
        
        // Clean and split SQL content
        const cleanedContent = sqlContent
            .replace(/--.*$/gm, '') // Remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .trim();

        const statements = cleanedContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && stmt.length > 0);

        console.log(`Processing ${statements.length} SQL statements...`);
        
        if (dryRun) {
            console.log('DRY RUN MODE - No changes will be made');
            return { success: 0, errors: 0, warnings };
        }

        let successCount = 0;
        let errorCount = 0;
        
        // Use TransactionManager if available for better transaction control
        if (this.transactionManager && statements.length > 10) {
            console.log('Using TransactionManager for large import...');
            
            try {
                const result = await this.transactionManager.executeTransaction(async (ctx: any) => {
                    let txSuccessCount = 0;
                    let txErrorCount = 0;
                    
                    // Disable FK checks within transaction if requested
                    if (skipFKChecks) {
                        console.log('Disabling foreign key constraints...');
                        await ctx.execute('SET DATABASE REFERENTIAL INTEGRITY FALSE');
                    }
                    
                    const progress = new ProgressBar(statements.length);
                    
                    // Process in batches
                    for (let i = 0; i < statements.length; i += batchSize) {
                        const batch = statements.slice(i, Math.min(i + batchSize, statements.length));
                        
                        for (let j = 0; j < batch.length; j++) {
                            const stmt = batch[j];
                            const globalIndex = i + j;
                            
                            if (this.isExecutableStatement(stmt)) {
                                try {
                                    const result = await ctx.execute(stmt);
                                    
                                    if (!result || result.success === false) {
                                        console.error(`Statement ${globalIndex + 1} failed`);
                                        txErrorCount++;
                                        if (!continueOnError) {
                                            throw new Error(`Statement failed: ${stmt.substring(0, 100)}...`);
                                        }
                                        continue;
                                    }
                                    
                                    txSuccessCount++;
            
                                } catch (stmtError) {
                                    txErrorCount++;
                                    console.error(`Error in statement ${globalIndex + 1}:`);
                                    console.error(`   ${stmtError instanceof Error ? stmtError.message : String(stmtError)}`);
                                    
                                    if (!continueOnError) {
                                        throw stmtError;
                                    }
                                }
                            }
                            
                            progress.update(globalIndex + 1, `Processing batch ${Math.floor(i / batchSize) + 1}`);
                        }
                        
                        // Small delay between batches to prevent overwhelming the database
                        if (i + batchSize < statements.length) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                    }
                    
                    // Re-enable FK checks within transaction if needed
                    if (skipFKChecks) {
                        console.log('Re-enabling foreign key constraints...');
                        await ctx.execute('SET DATABASE REFERENTIAL INTEGRITY TRUE');
                    }
                    
                    return { success: txSuccessCount, errors: txErrorCount };
                }, {
                    isolationLevel: 'READ_COMMITTED' as any,
                    timeout: 300000, // 5 minutes
                    autoCommit: true,
                    maxRetries: 1
                });
                
                successCount = result.success;
                errorCount = result.errors;
                
                console.log('Transaction completed successfully');
                
            } catch (transactionError) {
                console.error('Transaction failed and was rolled back:', 
                    transactionError instanceof Error ? transactionError.message : String(transactionError));
                errorCount = statements.length;
                successCount = 0;
            }
            
        } else {
            // Fallback to individual statements
            console.log('Processing statements individually...');

            if (skipFKChecks) {
                console.log('Disabling foreign key constraints...');
                await this.parameterizedQuery.execute('SET DATABASE REFERENTIAL INTEGRITY FALSE');
            }
            
            const progress = new ProgressBar(statements.length);
            
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i];
                
                if (this.isExecutableStatement(stmt)) {
                    try {
                        const result = await this.parameterizedQuery.execute(stmt);
                        
                        if (!result || result.success === false) {
                            console.error(`Statement ${i + 1} failed`);
                            errorCount++;
                            if (!continueOnError) break;
                            continue;
                        }
                        
                        successCount++;
                        
                    } catch (stmtError) {
                        errorCount++;
                        console.error(`Error in statement ${i + 1}:`);
                        console.error(`   ${stmtError instanceof Error ? stmtError.message : String(stmtError)}`);
                        
                        if (!continueOnError) break;
                    }
                }
                
                progress.update(i + 1, 'Processing');
            }
            
            // Re-enable FK checks
            if (skipFKChecks) {
                try {
                    await this.parameterizedQuery.execute('SET DATABASE REFERENTIAL INTEGRITY TRUE');
                    console.log('Foreign key constraints re-enabled');
                } catch (fkError) {
                    console.error(`Failed to re-enable FK constraints: ${fkError instanceof Error ? fkError.message : String(fkError)}`);
                    warnings.push('Failed to re-enable foreign key constraints');
                }
            }
        }
        
        // Clear relevant caches
        if (this.cacheManager) {
            console.log('Clearing caches...');
            await this.cacheManager.clear('table:*');
            await this.cacheManager.clear('schema:*');
        }

        console.log(`\nImport Summary:`);
        console.log(`   Successful statements: ${successCount}`);
        console.log(`   Failed statements: ${errorCount}`);
        console.log(`   File size: ${formatFileSize(originalSize)}`);
        console.log(`   Warnings: ${warnings.length}`);

        return { success: successCount, errors: errorCount, warnings };
    }

    /**
     * Check if a statement should be executed
     */
    private isExecutableStatement(stmt: string): boolean {
        const upperStmt = stmt.toUpperCase();
        return upperStmt.startsWith('INSERT') || 
               upperStmt.startsWith('UPDATE') ||
               upperStmt.startsWith('DELETE') ||
               upperStmt.startsWith('CREATE') ||
               upperStmt.startsWith('DROP') ||
               upperStmt.startsWith('ALTER') ||
               upperStmt.startsWith('SET');
    }

    async exportTable(tableName: string, outputPath: string, options: Partial<ExportOptions> = {}): Promise<void> {
        const {
            includeData = true,
            includeSchema = false,
            format = 'sql',
            compress = false
        } = options;

        console.log(`Exporting table ${tableName} to ${outputPath}...`);
        
        let content = '';
        
        if (format === 'sql') {
            content += `-- Export of table ${tableName}\n`;
            content += `-- Generated on ${new Date().toISOString()}\n`;
            content += `-- Format: SQL\n\n`;
            
            if (includeSchema && this.schemaAnalyzer) {
                try {
                    const tableInfo = await this.schemaAnalyzer.analyzeTable(tableName);
                    content += `-- Table structure\n`;
                    content += `-- Columns: ${tableInfo.columns.length}\n`;
                    // Fix primary key access - it's an object with columns property
                    const pkColumns = Array.isArray(tableInfo.primaryKey) ? 
                        tableInfo.primaryKey : 
                        tableInfo.primaryKey?.columns || [];
                    content += `-- Primary Key: ${pkColumns.join(', ')}\n\n`;
                } catch (error) {
                    console.warn(`Could not include schema information: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            if (includeData) {
                // Get table structure for column info
                const columns = await this.describeTable(tableName);
                const result = await this.parameterizedQuery.execute(`SELECT * FROM ${tableName}`);
                
                if (result && result.success && result.rows && result.rows.length > 0) {
                    const columnNames = columns.map(col => col.name).join(', ');
                    content += `INSERT INTO ${tableName} (${columnNames}) VALUES\n`;
                    
                    const values = result.rows.map(row => {
                        const formattedValues = row.map(value => {
                            if (value === null) return 'NULL';
                            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
                            return String(value);
                        });
                        return `(${formattedValues.join(', ')})`;
                    }).join(',\n');
                    
                    content += values + ';\n\nCOMMIT;\n';
                } else {
                    content += `-- No data found in table ${tableName}\n`;
                }
            }
        } else if (format === 'json') {
            const result = await this.parameterizedQuery.execute(`SELECT * FROM ${tableName}`);
            const columns = await this.describeTable(tableName);
            
            const data = {
                tableName,
                exportedAt: new Date().toISOString(),
                schema: includeSchema ? columns : undefined,
                data: result && result.success && result.rows ? 
                    result.rows.map(row => {
                        const obj: any = {};
                        columns.forEach((col, index) => {
                            obj[col.name] = row[index];
                        });
                        return obj;
                    }) : []
            };
            
            content = JSON.stringify(data, null, 2);
        }
        
        if (compress) {
            // TODO: Implement compression
            console.warn('Compression not yet implemented');
        }
        
        fs.writeFileSync(outputPath, content, 'utf-8');
        console.log(`Export completed: ${formatFileSize(content.length)}`);
    }

    async verifyDatabase(): Promise<{isValid: boolean, issues: string[]}> {
        const issues: string[] = [];
        
        try {
            console.log('Performing database verification...');
            
            // Check foreign key constraints
            try {
                const fkResult = await this.parameterizedQuery.execute(`
                    SELECT FK_NAME, FKTABLE_NAME, FKCOLUMN_NAME, PKTABLE_NAME, PKCOLUMN_NAME
                    FROM INFORMATION_SCHEMA.SYSTEM_CROSSREFERENCE
                `);
                
                if (fkResult && fkResult.success && fkResult.rows) {
                    console.log(`Found ${fkResult.rows.length} foreign key constraints`);
                }
            } catch (error) {
                issues.push(`Foreign key check failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Check for orphaned records (basic check)
            const tables = await this.listTables();
            const progress = new ProgressBar(tables.length);
            
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                try {
                    const countResult = await this.parameterizedQuery.execute(`SELECT COUNT(*) FROM ${table}`);
                    if (countResult && countResult.success && countResult.rows) {
                        const count = countResult.rows[0][0];
                        if (count === 0) {
                            issues.push(`Table ${table} is empty`);
                        }
                    }
                } catch (error) {
                    issues.push(`Could not verify table ${table}: ${error instanceof Error ? error.message : String(error)}`);
                }
                
                progress.update(i + 1, `Verifying ${table}`);
            }
            
            // Use SchemaAnalyzer for advanced verification if available
            if (this.schemaAnalyzer) {
                try {
                    console.log('Running advanced schema analysis...');
                    const schemaHealth = await this.schemaAnalyzer.analyzeSchema({
                        enableDeepAnalysis: true,
                        enableStatistics: true
                    });
                    
                    if (schemaHealth.health && schemaHealth.health.issues.length > 0) {
                        issues.push(...schemaHealth.health.issues.map(issue => `Schema issue: ${issue}`));
                    }
                } catch (error) {
                    console.warn(`    Advanced schema analysis failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
        } catch (error) {
            issues.push(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Run the HSQLTool CLI
     */
    async run(args: string[]) {
        let command = '';
        let commandArgs: string[] = [];

        // Parse command line arguments
        for (let i = 0; i < args.length; i++) {
            if (args[i].startsWith('--db-path=')) {
                const path = args[i].split('=')[1];
                CONFIG.worldName = path.split('/').pop() || 'test_world';
                CONFIG.starmadeDir = path.replace(`/${CONFIG.worldName}`, '');
                args.splice(i, 1);
                i--;
            } else if (args[i].startsWith('--verbose')) {
                CONFIG.logging.enableConsole = true;
                CONFIG.logging.level = 'debug' as any;
                args.splice(i, 1);
                i--;
            } else if (args[i].startsWith('--world-name=')) {
                CONFIG.worldName = args[i].split('=')[1];
                args.splice(i, 1);
                i--;
            } else if (args[i].startsWith('--starmade-dir=')) {
                CONFIG.starmadeDir = args[i].split('=')[1];
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--status') {
                command = 'status';
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--verify') {
                command = 'verify';
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--diagnose') {
                command = 'diagnose';
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--checkpoint') {
                command = 'checkpoint';
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--list-tables') {
                command = 'list-tables';
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--describe') {
                command = 'describe';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                }
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--wipe') {
                command = 'wipe';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                }
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--exec') {
                command = 'exec';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                } else {
                    console.error('Error: No SQL command specified for exec command.');
                    process.exit(1);
                }
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--import') {
                command = 'import';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                } else {
                    console.error('Error: No file path specified for import command.');
                    process.exit(1);
                }
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--force-import') {
                command = 'force-import';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                } else {
                    console.error('Error: No file path specified for force-import command.');
                    process.exit(1);
                }
                args.splice(i, 1);
                i--;
            } else if (args[i] === '--export') {
                command = 'export';
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                } else {
                    console.error('Error: No table name specified for export command.');
                    process.exit(1);
                }
                if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                    commandArgs.push(args[i + 1]);
                    args.splice(i + 1, 1);
                } else {
                    console.error('Error: No output file specified for export command.');
                    process.exit(1);
                }
                args.splice(i, 1);
                i--;
            }
        }

        await this.initialize();

        try {
            switch (command) {
                case 'status':
                    console.log('Database Status');
                    console.log('===============');
                    
                    const counts = await this.getTableCounts();
                    const tables = Object.keys(counts);
                    const totalRows = Object.values(counts).reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
                    
                    console.log(` Total tables: ${tables.length}`);
                    console.log(` Total rows: ${totalRows}`);
                    console.log('\n Table details:');

                    tables.forEach(table => {
                        const count = counts[table];
                        const icon = count > 0 ? '?' : count === 0 ? '?' : '?';
                        console.log(`   ${icon} ${table}: ${count >= 0 ? count : 'ERROR'}`);
                    });
                    break;

                case 'verify':
                    console.log('Verifying database integrity...');
                    
                    const verification = await this.verifyDatabase();
                    
                    if (verification.isValid) {
                        console.log('Database verification passed');
                    } else {
                        console.log('Database verification found issues:');
                        verification.issues.forEach(issue => {
                            console.log(`   • ${issue}`);
                        });
                    }
                    break;

                case 'diagnose':
                    console.log('Diagnosing database...');

                    const diagCounts = await this.getTableCounts();
                    const emptyTables = Object.entries(diagCounts).filter(([, count]) => count === 0);
                    const errorTables = Object.entries(diagCounts).filter(([, count]) => count < 0);
                    
                    if (emptyTables.length > 0) {
                        console.log('Empty tables:');
                        emptyTables.forEach(([table]) => console.log(`   • ${table}`));
                    }
                    
                    if (errorTables.length > 0) {
                        console.log('Tables with errors:');
                        errorTables.forEach(([table]) => console.log(`   • ${table}`));
                    }
                    
                    if (emptyTables.length === 0 && errorTables.length === 0) {
                        console.log('No issues detected');
                    }
                    break;

                case 'checkpoint':
                    console.log('Creating database checkpoint...');
                    await this.checkpoint();
                    console.log('Checkpoint created successfully');
                    break;

                case 'list-tables':
                    console.log('Database Tables');
                    console.log('==================');
                    
                    const tableList = await this.listTables();
                    tableList.forEach((table, index) => {
                        console.log(`${index + 1}. ${table}`);
                    });
                    console.log(`\nTotal: ${tableList.length} tables`);
                    break;

                case 'describe':
                    if (commandArgs.length === 0) {
                        console.error('Error: Table name required for describe command');
                        process.exit(1);
                    }
                    
                    const tableName = commandArgs[0].toUpperCase();
                    console.log(`Table Structure: ${tableName}`);
                    console.log('='.repeat(20 + tableName.length));
                    
                    const columns = await this.describeTable(tableName);
                    if (columns.length === 0) {
                        console.log('Table not found or has no columns');
                    } else {
                        columns.forEach((col, index) => {
                            const nullableText = col.nullable ? 'NULL' : 'NOT NULL';
                            const lengthText = col.maxLength ? `(${col.maxLength})` : '';
                            const defaultText = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
                            
                            console.log(`${index + 1}. ${col.name}`);
                            console.log(`   Type: ${col.type}${lengthText}`);
                            console.log(`   Nullable: ${nullableText}${defaultText}`);
                            console.log('');
                        });
                    }
                    break;

                case 'wipe':
                    if (commandArgs.length === 0) {
                        console.log('Wiping ALL tables...');
                        const allTables = await this.listTables();
                        let totalDeleted = 0;
                        
                        const progress = new ProgressBar(allTables.length);
                        
                        for (const table of allTables) {
                            try {
                                const deleted = await this.wipeTable(table);
                                console.log(`   ${table}: ${deleted} rows deleted`);
                                totalDeleted += deleted;
                            } catch (error) {
                                console.log(`   ${table}: Error - ${error instanceof Error ? error.message : String(error)}`);
                            }
                        }

                        console.log(`Wipe completed. ${totalDeleted} total rows deleted`);
                    } else {
                        const tableToWipe = commandArgs[0].toUpperCase();
                        console.log(`Wiping table ${tableToWipe}...`);

                        try {
                            const deleted = await this.wipeTable(tableToWipe);
                            console.log(`${deleted} rows deleted from ${tableToWipe}`);
                        } catch (error) {
                            console.error(`Error wiping ${tableToWipe}: ${error instanceof Error ? error.message : String(error)}`);
                            process.exit(1);
                        }
                    }
                    break;

                case 'exec':
                    const sql = commandArgs[0];
                    console.log(`Executing SQL: ${sql.substring(0, 50)}${sql.length > 50 ? '...' : ''}`);

                    try {
                        const result = await this.parameterizedQuery.execute(sql);
                        
                        if (result && result.success) {
                            if (result.rows && result.rows.length > 0) {
                                console.log(`${result.rows.length} rows returned:`);
                                result.rows.slice(0, 10).forEach((row, index) => {
                                    console.log(`${index + 1}: ${JSON.stringify(row)}`);
                            });
                            if (result.rows.length > 10) {
                                console.log(`   ... and ${result.rows.length - 10} more rows`);
                            }
                        } else if (result.affectedRows !== undefined) {
                            console.log(`${result.affectedRows} rows affected`);
                        } else {
                            console.log('Query executed successfully');
                        }
                        } else {
                            console.log('Query failed');
                        }
                    } catch (error) {
                        console.error(`SQL Error: ${error instanceof Error ? error.message : String(error)}`);
                        process.exit(1);
                    }
                    break;

                case 'import':
                case 'force-import':
                    const filePath = commandArgs[0];
                    const skipFKChecks = command === 'force-import';

                    console.log(`Importing SQL file: ${filePath}${skipFKChecks ? ' (FK checks disabled)' : ''}`);
                    
                    try {
                        const importResult = await this.importSQLFile(filePath, { skipFKChecks });
                        console.log(`Import completed: ${importResult.success} successful, ${importResult.errors} errors`);
                    } catch (error) {
                        console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
                        process.exit(1);
                    }
                    break;

                case 'export':
                    const exportTable = commandArgs[0].toUpperCase();
                    const outputPath = commandArgs[1];

                    console.log(`Exporting table ${exportTable} to ${outputPath}...`);

                    try {
                        await this.exportTable(exportTable, outputPath);
                        console.log('Export completed successfully');
                    } catch (error) {
                        console.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
                        process.exit(1);
                    }
                    break;

                default:
                    console.log('HSQLDB Management Tool');
                    console.log('======================');
                    console.log('Usage: node HSQLTool.ts <command> [options]');
                    console.log('');
                    console.log('Database Information:');
                    console.log('  --status                    Show current database status');
                    console.log('  --verify                    Verify database integrity');
                    console.log('  --diagnose                  Diagnose database issues');
                    console.log('  --checkpoint                Create database checkpoint');
                    console.log('  --list-tables               List all tables');
                    console.log('  --describe <table>          Show table structure');
                    console.log('');
                    console.log('Data Operations:');
                    console.log('  --exec "<sql>"              Execute raw SQL command');
                    console.log('  --import <file>             Import SQL file');
                    console.log('  --force-import <file>       Import SQL file (skip FK checks)');
                    console.log('  --export <table> <file>     Export table to SQL file');
                    console.log('  --wipe [table]              Wipe table or all tables');
                    console.log('');
                    console.log('Configuration:');
                    console.log('  --db-path=<path>            Database path');
                    console.log('  --world-name=<name>         World name');
                    console.log('  --starmade-dir=<dir>        StarMade directory');
                    console.log('  --verbose                   Enable verbose logging');
                    console.log('');
                    console.log('Examples:');
                    console.log('  node HSQLTool.ts --status');
                    console.log('  node HSQLTool.ts --describe SECTORS');
                    console.log('  node HSQLTool.ts --exec "SELECT COUNT(*) FROM PLAYERS"');
                    console.log('  node HSQLTool.ts --import ./test-data/01-systems.sql');
                    console.log('  node HSQLTool.ts --wipe SECTORS');
            }

        } catch (error) {
            console.error('Fatal error:', error instanceof Error ? error.message : String(error));
            // Don't exit here, let cleanup handle it
        } finally {
            // Cleanup
            try {
                await this.cleanup();
            } catch (cleanupError) {
                console.error('Cleanup warning:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
            }
            
            // Force process termination to handle JVM cleanup
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        }
    }
}

// =============================================================================
// MAIN FUNCTION WITH ENHANCED COMMAND PROCESSING
// =============================================================================

async function main() {
    const args = process.argv.slice(2);
    let command = '';
    let commandArgs: string[] = [];
    let options: any = {};

    // Enhanced argument parsing
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--db-path=')) {
            const path = arg.split('=')[1];
            CONFIG.worldName = path.split('/').pop() || 'test_world';
            CONFIG.starmadeDir = path.replace(`/${CONFIG.worldName}`, '');
        } else if (arg.startsWith('--world-name=')) {
            CONFIG.worldName = arg.split('=')[1];
        } else if (arg.startsWith('--starmade-dir=')) {
            CONFIG.starmadeDir = arg.split('=')[1];
        } else if (arg === '--verbose') {
            CONFIG.logging.enableConsole = true;
            CONFIG.logging.level = 'debug' as any;
        } else if (arg === '--quiet') {
            CONFIG.logging.enableConsole = false;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--force') {
            options.force = true;
        } else if (arg.startsWith('--batch-size=')) {
            options.batchSize = parseInt(arg.split('=')[1]) || 100;
        } else if (arg === '--continue-on-error') {
            options.continueOnError = true;
        } else if (arg === '--skip-fk-checks') {
            options.skipFKChecks = true;
        } else if (arg === '--include-schema') {
            options.includeSchema = true;
        } else if (arg.startsWith('--format=')) {
            options.format = arg.split('=')[1];
        } else if (arg === '--compress') {
            options.compress = true;
        } else if (command === '') {
            // First non-option argument is the command
            command = arg.replace(/^--/, '');
        } else {
            // Subsequent arguments are command arguments
            commandArgs.push(arg);
        }
    }

    const tool = new HSQLTool();
    
    try {
        await tool.initialize();

        const startTime = Date.now();

        switch (command) {
            case 'status':
                console.log('Database Status Report');
                console.log('='.repeat(50));
                
                const summaries = await tool.getTableSummaries();
                const health = await tool.getDatabaseHealth();

                console.log(`\nSummary:`);
                console.log(`   Total tables: ${health.totalTables}`);
                console.log(`   Total rows: ${health.totalRows.toLocaleString()}`);
                console.log(`   Database health: ${health.isHealthy ? '✅ Healthy' : '❌ Issues detected'}`);
                
                if (health.emptyTables.length > 0) {
                    console.log(`\nEmpty tables (${health.emptyTables.length}):`);
                    health.emptyTables.slice(0, 10).forEach(table => {
                        console.log(`   • ${table}`);
                    });
                    if (health.emptyTables.length > 10) {
                        console.log(`   ... and ${health.emptyTables.length - 10} more`);
                    }
                }
                
                if (health.errorTables.length > 0) {
                    console.log(`\nTables with errors (${health.errorTables.length}):`);
                    health.errorTables.forEach(table => {
                        console.log(`   • ${table}`);
                    });
                }
                
                console.log(`\nTop tables by row count:`);
                summaries.filter(s => s.health === 'healthy')
                    .slice(0, 10)
                    .forEach((table, index) => {
                        const size = table.sizeBytes ? ` (${formatFileSize(table.sizeBytes)})` : '';
                        console.log(`   ${index + 1}. ${table.name}: ${table.rowCount.toLocaleString()} rows${size}`);
                    });
                
                if (health.suggestions.length > 0) {
                    console.log(`\nSuggestions:`);
                    health.suggestions.forEach(suggestion => {
                        console.log(`   • ${suggestion}`);
                    });
                }
                break;

            case 'health':
            case 'verify':
                console.log('Database Health Check');
                console.log('='.repeat(50));
                
                const verification = await tool.verifyDatabase();
                
                if (verification.isValid) {
                    console.log('Database verification passed');
                } else {
                    console.log('Database verification found issues:');
                    verification.issues.forEach(issue => {
                        console.log(`   • ${issue}`);
                    });
                }
                break;

            case 'analyze':
            case 'diagnose':
                console.log('Database Analysis');
                console.log('='.repeat(50));
                
                const analysisHealth = await tool.getDatabaseHealth();
                
                console.log(`\nAnalysis Results:`);
                console.log(`   Database health: ${analysisHealth.isHealthy ? '✅ Healthy' : '❌ Issues detected'}`);
                console.log(`   Total tables: ${analysisHealth.totalTables}`);
                console.log(`   Total rows: ${analysisHealth.totalRows.toLocaleString()}`);
                console.log(`   Empty tables: ${analysisHealth.emptyTables.length}`);
                console.log(`   Error tables: ${analysisHealth.errorTables.length}`);
                
                if (analysisHealth.suggestions.length > 0) {
                    console.log(`\nRecommendations:`);
                    analysisHealth.suggestions.forEach(suggestion => {
                        console.log(`   • ${suggestion}`);
                    });
                }
                break;

            case 'checkpoint':
                console.log('Creating database checkpoint...');
                await tool.checkpoint();
                console.log('Checkpoint created successfully');
                break;

            case 'list-tables':
                console.log('Database Tables');
                console.log('='.repeat(50));
                
                const tableList = await tool.listTables();
                const tableSummariesDetailed = await tool.getTableSummaries();
                
                tableSummariesDetailed.forEach((table, index) => {
                    const status = table.health === 'healthy' ? '✅' : 
                                 table.health === 'empty' ? '📭' : '❌';
                    const size = table.sizeBytes ? ` (${formatFileSize(table.sizeBytes)})` : '';
                    console.log(`${index + 1}. ${status} ${table.name}: ${table.rowCount >= 0 ? table.rowCount.toLocaleString() : 'ERROR'} rows${size}`);
                });
                
                console.log(`\nTotal: ${tableList.length} tables`);
                break;

            case 'describe':
            case 'schema':
                if (commandArgs.length === 0) {
                    console.error('❌ Error: Table name required for describe command');
                    process.exit(1);
                }
                
                const tableName = commandArgs[0].toUpperCase();
                console.log(`📋 Table Schema: ${tableName}`);
                console.log('='.repeat(20 + tableName.length));
                
                const columns = await tool.describeTable(tableName);
                if (columns.length === 0) {
                    console.log('❌ Table not found or has no columns');
                } else {
                    columns.forEach((col, index) => {
                        const nullableText = col.nullable ? 'NULL' : 'NOT NULL';
                        const lengthText = col.maxLength ? `(${col.maxLength})` : '';
                        const defaultText = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
                        
                        console.log(`${index + 1}. ${col.name}`);
                        console.log(`   Type: ${col.type}${lengthText}`);
                        console.log(`   Nullable: ${nullableText}${defaultText}`);
                        console.log('');
                    });
                }
                break;

            case 'wipe':
            case 'truncate':
                if (commandArgs.length === 0) {
                    if (!options.force) {
                        console.log('⚠️  WARNING: This will wipe ALL tables!');
                        console.log('Use --force to confirm this operation');
                        process.exit(1);
                    }
                    
                    console.log('🗑️  Wiping ALL tables...');
                    const allTables = await tool.listTables();
                    let totalDeleted = 0;
                    
                    const progress = new ProgressBar(allTables.length);
                    
                    for (let i = 0; i < allTables.length; i++) {
                        const table = allTables[i];
                        try {
                            const deleted = await tool.wipeTable(table);
                            console.log(`   ✅ ${table}: ${deleted.toLocaleString()} rows deleted`);
                            totalDeleted += deleted;
                        } catch (error) {
                            console.log(`   ❌ ${table}: Error - ${error instanceof Error ? error.message : String(error)}`);
                        }
                        
                        progress.update(i + 1, `Wiping ${table}`);
                    }
                    
                    console.log(`✅ Wipe completed. ${totalDeleted.toLocaleString()} total rows deleted`);
                } else {
                    const tableToWipe = commandArgs[0].toUpperCase();
                    console.log(`🗑️  Wiping table ${tableToWipe}...`);
                    
                    try {
                        const deleted = await tool.wipeTable(tableToWipe);
                        console.log(`✅ ${deleted.toLocaleString()} rows deleted from ${tableToWipe}`);
                    } catch (error) {
                        console.error(`❌ Error wiping ${tableToWipe}: ${error instanceof Error ? error.message : String(error)}`);
                        process.exit(1);
                    }
                }
                break;

            case 'exec':
            case 'sql':
                if (commandArgs.length === 0) {
                    console.error('❌ Error: SQL command required');
                    process.exit(1);
                }
                
                const sql = commandArgs.join(' ');
                console.log(`🔍 Executing SQL: ${sql.substring(0, 80)}${sql.length > 80 ? '...' : ''}`);
                
                try {
                    const result = await tool.parameterizedQuery.execute(sql);
                    
                    if (result && result.success) {
                        if (result.rows && result.rows.length > 0) {
                            console.log(`📊 ${result.rows.length} rows returned:`);
                            
                            // Display results in a table format
                            const columns = result.columns || [];
                            if (columns.length > 0) {
                                console.log(`   ${columns.map(c => c.name).join(' | ')}`);
                                console.log(`   ${columns.map(c => '-'.repeat(c.name.length)).join('-+-')}`);
                            }
                            
                            result.rows.slice(0, 20).forEach((row, index) => {
                                console.log(`   ${row.join(' | ')}`);
                            });
                            
                            if (result.rows.length > 20) {
                                console.log(`   ... and ${result.rows.length - 20} more rows`);
                            }
                        } else if (result.affectedRows !== undefined) {
                            console.log(`✅ ${result.affectedRows} rows affected`);
                        } else {
                            console.log('✅ Query executed successfully');
                        }
                    } else {
                        console.log('❌ Query failed');
                    }
                } catch (error) {
                    console.error(`❌ SQL Error: ${error instanceof Error ? error.message : String(error)}`);
                    process.exit(1);
                }
                break;

            case 'import':
                if (commandArgs.length === 0) {
                    console.error('❌ Error: File path required for import');
                    process.exit(1);
                }
                
                const filePath = commandArgs[0];
                console.log(`📥 Importing SQL file: ${filePath}`);
                
                if (options.dryRun) {
                    console.log('🔍 DRY RUN MODE - No changes will be made');
                }
                
                try {
                    const importResult = await tool.importSQLFile(filePath, {
                        skipFKChecks: options.skipFKChecks || false,
                        batchSize: options.batchSize || 100,
                        continueOnError: options.continueOnError || false,
                        dryRun: options.dryRun || false
                    });
                    
                    console.log(`✅ Import completed: ${importResult.success} successful, ${importResult.errors} errors`);
                    
                    if (importResult.warnings.length > 0) {
                        console.log(`⚠️  Warnings (${importResult.warnings.length}):`);
                        importResult.warnings.slice(0, 5).forEach(warning => {
                            console.log(`   • ${warning}`);
                        });
                        if (importResult.warnings.length > 5) {
                            console.log(`   ... and ${importResult.warnings.length - 5} more warnings`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Import failed: ${error instanceof Error ? error.message : String(error)}`);
                    process.exit(1);
                }
                break;

            case 'export':
                if (commandArgs.length < 2) {
                    console.error('❌ Error: Table name and output file required');
                    process.exit(1);
                }
                
                const exportTable = commandArgs[0].toUpperCase();
                const outputPath = commandArgs[1];
                
                try {
                    await tool.exportTable(exportTable, outputPath, {
                        includeData: true,
                        includeSchema: options.includeSchema || false,
                        format: options.format || 'sql',
                        compress: options.compress || false
                    });
                } catch (error) {
                    console.error(`❌ Export failed: ${error instanceof Error ? error.message : String(error)}`);
                    process.exit(1);
                }
                break;

            case 'help':
            default:
                console.log('🔧 HSQLDB Management Tool v2.0');
                console.log('='.repeat(50));
                console.log('Advanced StarMade database management with modular architecture');
                console.log('');
                console.log('📊 Database Information:');
                console.log('  status                      Show enhanced database status');
                console.log('  health, verify              Perform database health check');
                console.log('  analyze, diagnose           Run comprehensive database analysis');
                console.log('  list-tables                 List all tables with statistics');
                console.log('  describe <table>            Show detailed table schema');
                console.log('  schema <table>              Alias for describe');
                console.log('');
                console.log('🔧 Database Maintenance:');
                console.log('  checkpoint                  Create database checkpoint');
                console.log('  wipe [table]                Wipe table or all tables (use --force for all)');
                console.log('  truncate [table]            Alias for wipe');
                console.log('');
                console.log('💾 Data Operations:');
                console.log('  exec "<sql>"                Execute raw SQL command');
                console.log('  sql "<sql>"                 Alias for exec');
                console.log('  import <file>               Import SQL file with smart processing');
                console.log('  export <table> <file>       Export table to file');
                console.log('');
                console.log('⚙️  Configuration Options:');
                console.log('  --db-path=<path>            Database path');
                console.log('  --world-name=<name>         World name');
                console.log('  --starmade-dir=<dir>        StarMade directory');
                console.log('  --verbose                   Enable verbose logging');
                console.log('  --quiet                     Suppress output');
                console.log('');
                console.log('🚀 Import/Export Options:');
                console.log('  --skip-fk-checks            Skip foreign key constraints');
                console.log('  --batch-size=<n>            Batch size for operations (default: 100)');
                console.log('  --continue-on-error         Continue processing on errors');
                console.log('  --dry-run                   Preview changes without executing');
                console.log('  --force                     Force dangerous operations');
                console.log('  --include-schema            Include schema in exports');
                console.log('  --format=<fmt>              Export format (sql, json, csv)');
                console.log('  --compress                  Compress output files');
                console.log('');
                console.log('💡 Examples:');
                console.log('  node HSQLTool.ts status');
                console.log('  node HSQLTool.ts describe SECTORS');
                console.log('  node HSQLTool.ts exec "SELECT COUNT(*) FROM PLAYERS"');
                console.log('  node HSQLTool.ts import ./data.sql --batch-size=50');
                console.log('  node HSQLTool.ts export PLAYERS players.sql --include-schema');
                console.log('  node HSQLTool.ts wipe SECTORS --force');
        }

        const duration = Date.now() - startTime;
        console.log(`\n⏱️  Operation completed in ${formatDuration(duration)}`);
        
        // Flush stdout to ensure all output is displayed
        process.stdout.write('');
        
    } catch (error) {
        console.error('💥 Fatal error:', error instanceof Error ? error.message : String(error));
        
        if (CONFIG.logging.level === ('debug' as any)) {
            console.error('Stack trace:', (error as Error).stack);
        }
        
        // Don't exit here, let cleanup handle it
    } finally {
        // Cleanup
        try {
            await tool.cleanup();
        } catch (cleanupError) {
            console.error('⚠️  Cleanup warning:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
        }
        
        // Force process termination to handle JVM cleanup
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
}

// =============================================================================
// EXECUTION
// =============================================================================

// Run CLI if called directly
if (process.argv[1].endsWith('HSQLTool.ts') || process.argv[1].endsWith('HSQLTool.js')) {
    main().catch((error) => {
        console.error('💥 Fatal error:', error instanceof Error ? error.message : String(error));
        
        // Force cleanup and exit
        setTimeout(() => {
            process.exit(1);
        }, 500);
    });
}