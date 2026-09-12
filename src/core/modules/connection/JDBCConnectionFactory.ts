/**
 * @fileoverview JDBC Connection Factory Module - Based on JDBCTool.js discoveries
 * 
 * This file defines a factory for creating real JDBC connections to HSQLDB using
 * nodejs-jdbc. This version is based on the successful JDBCTool.js implementation
 * with validated key points including correct JVM configuration, proper connection
 * properties, and multiple ResultSet processing approaches.
 * 
 * @author InitSysRev
 * @version 1.0.0 - Based on JDBCTool.js
 */

// Import from nodejs-jdbc using the validated pattern from JDBCTool.js
import { JDBC, isJvmCreated, addOption, setupClasspath } from 'nodejs-jdbc';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { 
    HSQLDBError,
    QueryTimeoutError,
    ConnectionError,
    ConnectionTimeoutError,
    DatabaseFileError,
    HSQLDBJarError,
    JavaEnvironmentError,
    QueryExecutionError,
    ConfigurationError,
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    createErrorFromJDBC
} from '../../errors.js';
import { createModuleLogger, type ModuleLogger } from '../logging/Logger.js';
import type { BaseModule, HSQLManager } from '../../HSQLManager.js';

// ES modules fix
/** Absolute path of this ES module, resolved from import.meta.url. */
const __filename = fileURLToPath(import.meta.url);
/** Directory containing this ES module, used to locate the JDBC driver. */
const __dirname = dirname(__filename);

// =============================================================================
// GLOBAL JVM AND POOL MANAGEMENT (inspired by successful JDBCTool.js)
// =============================================================================

/** Whether JVM options and the driver classpath have already been configured. */
let jvmConfigured = false;

/**
 * Global JVM configuration - based on successful JDBCTool.js pattern.
 * @throws {HSQLDBJarError} When JVM configuration fails.
 */
function configureJVMGlobal(): void {
    if (jvmConfigured || isJvmCreated()) {
        return; // JVM already configured
    }

    try {
        // JVM configuration identical to successful JDBCTool.js
        addOption("-Xrs");

        // Find and configure HSQLDB JAR
        const jarPath = findHSQLJarPath();
        setupClasspath([jarPath]);

        jvmConfigured = true;

    } catch (error) {
        throw new HSQLDBJarError(
            `Failed to configure JVM: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Find HSQLDB JAR file - paths identical to JDBCTool.js.
 * @returns {string} Path to the HSQLDB JAR file.
 * @throws {HSQLDBJarError} When JAR file is not found.
 */
function findHSQLJarPath(): string {
    const possiblePaths = [
        ...(process.env.HSQLDB_JAR ? [process.env.HSQLDB_JAR] : []),
        './src/lib/hsqldb.jar',
        join(process.cwd(), 'src', 'lib', 'hsqldb.jar'),
        join(process.cwd(), 'lib', 'hsqldb.jar'),
        join(__dirname, '..', '..', '..', 'lib', 'hsqldb.jar')
    ];
    
    for (const jarPath of possiblePaths) {
        if (existsSync(jarPath)) {
            return jarPath;
        }
    }
    
    throw new HSQLDBJarError(
        `HSQLDB JAR not found in locations: ${possiblePaths.join(', ')}`
    );
}

/**
 * Create and initialize a JDBC pool owned by one factory.
 * @param {string} url - Database URL.
 * @param {JDBCPoolConfig} [poolConfig] - Optional pool configuration.
 * @returns {Promise<any>} The initialized JDBC pool instance.
 */
async function createJDBCPool(url: string, poolConfig?: JDBCPoolConfig): Promise<any> {
    const pool = new JDBC({
        minpoolsize: 1,
        maxpoolsize: 10,
        ...poolConfig,
        url: enhanceHSQLDBUrl(url),
        drivername: 'org.hsqldb.jdbc.JDBCDriver',
        user: 'SA',
        password: ''
    });
    try {
        await pool.initialize();
        return pool;
    } catch (error) {
        await pool.purge();
        throw error;
    }
}

/**
 * Validate an HSQLDB URL while preserving its explicit connection options.
 * @param {string} originalUrl - Original database URL.
 * @returns {string} The original validated URL.
 */
function enhanceHSQLDBUrl(originalUrl: string): string {
    if (!/^jdbc:hsqldb:(file|mem|hsql|hsqls|http|https|res):\S+/i.test(originalUrl)) {
        throw new ConfigurationError('Invalid HSQLDB JDBC URL', ['url']);
    }
    // Keep explicitly supplied HSQLDB options. Do not weaken locking or recovery.
    return originalUrl;
}

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

/**
 * @interface JDBCPoolConfig
 * @description Defines advanced configuration for the JDBC connection pool and HSQLDB properties.
 * Inspired by simple-db-tool.js for enhanced flexibility.
 */
export interface JDBCPoolConfig {
    /** Minimum number of connections in the pool */
    minpoolsize?: number;
    /** Maximum number of connections in the pool */
    maxpoolsize?: number;
    /** HSQLDB properties for fine-tuning */
    properties?: {
        'hsqldb.write_delay'?: string;
        'hsqldb.log_data'?: string;
        'hsqldb.lock_file'?: string;
        'hsqldb.nio_data_file'?: string;
        'hsqldb.applog'?: string;
        'hsqldb.sqllog'?: string;
        'shutdown'?: string;
        [key: string]: string | undefined;
    };
}

/**
 * @interface JDBCConnectionConfig
 * @description JDBC Connection configuration interface.
 */
export interface JDBCConnectionConfig {
    /** Database URL */
    url: string;
    /** Connection timeout in milliseconds */
    timeoutMs: number;
    /** Auto-commit mode */
    autoCommit: boolean;
    /** Read-only mode */
    readOnly: boolean;
    /** Optional pool configuration */
    poolConfig?: JDBCPoolConfig;
}

/**
 * @interface JDBCQueryResult
 * @description JDBC Query result interface - simplified based on JDBCTool.js.
 */
export interface JDBCQueryResult {
    /** Column metadata */
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
    }> ;
    /** Result rows */
    rows: any[][];
    /** Number of affected rows (for updates/deletes) */
    rowsAffected?: number;
    /** Execution time in milliseconds */
    executionTime: number;
}

/**
 * @interface JDBCConnection
 * @description JDBC Connection wrapper interface.
 */
export interface JDBCExecutionOptions {
    /** Deadline in milliseconds; zero explicitly disables the timeout. */
    timeoutMs?: number;
    /** Maximum rows retrieved by JDBC; zero means unlimited. */
    maxRows?: number;
}

/** Session options restored after a transaction. */
export interface JDBCSessionState {
    /** Whether statements commit automatically. */
    autoCommit: boolean;
    /** Whether the session rejects writes. */
    readOnly: boolean;
    /** Numeric java.sql.Connection isolation level. */
    isolationLevel: number;
}

/** Connection handle used by query and transaction modules. */
export interface JDBCConnection {
    /** Connection ID */
    id: string;
    /** Connection active state */
    isActive: boolean;
    /** 
     * Execute a SQL query
     * @param {string} sql - SQL query string
     * @param {Array} [parameters] - Query parameters array
     * @returns {Promise<JDBCQueryResult>} Query result promise
     */
    execute(sql: string, parameters?: any[], options?: JDBCExecutionOptions): Promise<JDBCQueryResult>;
    /** 
     * Close the connection
     * @returns {Promise<void>} Close operation promise
     */
    close(): Promise<void>;
    /** Permanently close an unsafe session without returning it to the native pool. */
    discard?(): Promise<void>;
    /** 
     * Test connection health
     * @returns {Promise<boolean>} Health test result promise
     */
    ping(): Promise<boolean>;
    /**
     * Set auto-commit mode
     * @param {boolean} autoCommit - Auto-commit mode
     * @returns {Promise<void>} Set operation promise
     */
    setAutoCommit(autoCommit: boolean): Promise<void>;
    /** Read session options before borrowing the connection for a transaction. */
    getSessionState?(): Promise<JDBCSessionState>;
    /**
     * Commit the current transaction
     * @returns {Promise<void>} Commit operation promise
     */
    commit(): Promise<void>;
    /**
     * Rollback the current transaction
     * @returns {Promise<void>} Rollback operation promise
     */
    rollback(): Promise<void>;
    /**
     * Set transaction isolation level
     * @param {number} level - Isolation level
     * @returns {Promise<void>} Set operation promise
     */
    setTransactionIsolation(level: number): Promise<void>;
    /**
     * Set read-only mode
     * @param {boolean} readOnly - Read-only mode
     * @returns {Promise<void>} Set operation promise
     */
    setReadOnly(readOnly: boolean): Promise<void>;
    /**
     * Create a statement for SQL execution
     * @returns {Promise<any>} Statement object promise
     */
    createStatement(): Promise<any>;
}

// =============================================================================
// HSQLDB CONNECTION IMPLEMENTATION
// =============================================================================

/**
 * @class HSQLDBConnection
 * @description HSQLDB Connection implementation based on JDBCTool.js with shared pool.
 * @implements {JDBCConnection}
 */
class HSQLDBConnection implements JDBCConnection {
    /** Unique identifier assigned to this JDBC connection. */
    public readonly id: string;
    /** Whether this connection is available for JDBC operations. */
    public isActive: boolean = false;
    
    /** Native pool reservation holding the underlying JDBC connection. */
    private connobj: any;
    /** Native pool that owns this connection and receives it on release. */
    private sharedPool: any;
    /** Native JDBC connection wrapper used to execute statements and manage session state. */
    private conn: any;
    /** Effective configuration applied to this instance. */
    private config: JDBCConnectionConfig;
    /** Module logger for operation context and diagnostic errors. */
    private logger: ModuleLogger;
    
    /**
     * Create a new HSQLDB connection using shared pool.
     * @param {string} id - Connection identifier.
     * @param {JDBCConnectionConfig} config - Connection configuration object.
     * @param {ModuleLogger} logger - Logger instance.
     */
    constructor(id: string, config: JDBCConnectionConfig, logger: ModuleLogger, pool: any) {
        this.id = id;
        this.config = config;
        this.logger = logger;
        this.sharedPool = pool;
    }
    
    /**
     * Connect to database using factory-owned pool.
     * @async
     * @returns {Promise<void>} Connection operation promise.
     * @throws {ConnectionError} When connection fails.
     */
    public async connect(): Promise<void> {
        const startTime = Date.now();
        
        try {
            this.logger.info('Acquiring connection from shared JDBC pool', {
                connectionId: this.id,
                url: this.config.url,
                operation: 'connect-start'
            });
            
            // Get or create the factory-owned pool
            this.logger.debug('Getting or creating factory-owned JDBC pool', {
                connectionId: this.id,
                operation: 'pool-access'
            });
            
            const sharedPool = this.sharedPool;
            
            this.logger.debug('Factory-owned JDBC pool ready, reserving connection', {
                connectionId: this.id,
                operation: 'pool-reserve'
            });
            
            // Reserve a connection from the shared pool
            this.connobj = await sharedPool.reserve();
            this.conn = this.connobj.conn;
            
            // CRITICAL FIX: Configure connection settings right after acquiring from pool
            // This ensures proper transaction support for HSQLDB
            try {
                // Set autoCommit based on config (typically false for transactions)
                await this.conn.conn.setAutoCommitPromise(this.config.autoCommit);
                this.logger.debug('AutoCommit mode configured', {
                    connectionId: this.id,
                    autoCommit: this.config.autoCommit,
                    operation: 'autocommit-config'
                });
                
                // Set read-only mode if specified
                if (this.config.readOnly !== undefined) {
                    await this.conn.conn.setReadOnlyPromise(this.config.readOnly);
                    this.logger.debug('Read-only mode configured', {
                        connectionId: this.id,
                        readOnly: this.config.readOnly,
                        operation: 'readonly-config'
                    });
                }
                
            } catch (configError) {
                await this.discard();
                throw configError;
            }

            this.isActive = true;
            const connectTime = Date.now() - startTime;
            
            this.logger.info('Connection acquired from shared pool successfully', {
                connectionId: this.id,
                operation: 'connect-complete',
                connectTime,
                poolType: 'factory-owned',
                autoCommit: this.config.autoCommit,
                readOnly: this.config.readOnly
            });
            
        }
        catch (error) {
            const connectTime = Date.now() - startTime;
            this.logger.error('Failed to acquire connection from shared pool', {
                connectionId: this.id,
                operation: 'connect-error',
                connectTime,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to acquire JDBC connection from shared pool: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id, url: this.config.url }
            );
        }
    }
    
    /**
     * Execute SQL query with proper parameter binding support.
     * @async
     * @param {string} sql - SQL query string with ? placeholders.
     * @param {Array} [parameters] - Query parameters array.
     * @returns {Promise<JDBCQueryResult>} Query result promise.
     * @throws {ConnectionError} When connection is not active.
     * @throws {QueryExecutionError} When query execution fails.
     */
    public async execute(sql: string, parameters: any[] = [], options: JDBCExecutionOptions = {}): Promise<JDBCQueryResult> {
        if (!this.isActive || !this.conn) throw new ConnectionError('Connection not active', {connectionId: this.id});
        const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
        const maxRows = options.maxRows ?? 0;
        if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || !Number.isInteger(maxRows) || maxRows < 0) {
            throw new ConfigurationError('Invalid query timeout or row limit', ['timeoutMs', 'maxRows']);
        }
        const start = Date.now();
        let statement: any;
        let resultSet: any;
        try {
            const prepared = parameters.length > 0;
            statement = prepared ? await this.conn.prepareStatement(sql) : await this.conn.createStatement();
            for (let i = 0; i < parameters.length; i++) {
                const value = parameters[i];
                const index = i + 1;
                if (value == null) await statement.setString(index, null);
                else if (typeof value === 'boolean') await statement.setBoolean(index, value);
                else if (typeof value === 'number') {
                    if (!Number.isFinite(value)) throw new ConfigurationError('Non-finite query parameter', ['parameters']);
                    if (Number.isInteger(value)) await statement.setLong(index, String(value));
                    else await statement.setDouble(index, value);
                } else if (value instanceof Date) {
                    await statement.setString(index, value.toISOString().replace('T', ' ').replace('Z', ''));
                } else if (Buffer.isBuffer(value)) await statement.setString(index, value.toString('hex').toUpperCase());
                else await statement.setString(index, String(value));
            }
            // PreparedStatement lacks the wrapper's timeout methods in nodejs-jdbc.
            const native = statement.ps ?? statement.s;
            if (native) {
                native.setQueryTimeoutSync(Math.ceil(timeoutMs / 1000));
                native.setMaxRowsSync(maxRows);
            } else {
                statement.setQueryTimeout?.(Math.ceil(timeoutMs / 1000));
                statement.setMaxRows?.(maxRows);
            }
            const selects = /^\s*(SELECT|WITH|SHOW|VALUES|TABLE|EXPLAIN)\b/i.test(sql);
            const run = () => selects
                ? (prepared ? statement.executeQuery() : statement.executeQuery(sql))
                : (prepared ? statement.executeUpdate() : statement.executeUpdate(sql));
            const value = await this.executeWithDeadline(statement, run, sql, parameters, timeoutMs);
            if (!selects) return {columns: [], rows: [], rowsAffected: value, executionTime: Date.now() - start};
            resultSet = value;
            const metadata = resultSet.getMetaData().getAllColumnMeta();
            const columns = metadata.map((column: any) => ({
                name: column.label || column.name,
                type: column.type?.name || 'VARCHAR',
                nullable: true
            }));
            const rows: any[][] = [];
            while ((maxRows === 0 || rows.length < maxRows) && resultSet.next()) {
                const row = resultSet.fetchResult(metadata);
                rows.push(columns.map((column: any) => row[column.name]));
            }
            return {columns, rows, executionTime: Date.now() - start};
        } catch (error) {
            if (error instanceof HSQLDBError) throw error;
            throw createErrorFromJDBC(sql, error, parameters, {connectionId: this.id});
        } finally {
            try { resultSet?.resultSet?.closeSync(); }
            finally {
                if (statement?.close) await statement.close();
                else if (statement?.ps) await statement.ps.closePromise();
            }
        }
    }

    /** Cancel expired work and drain it before allowing the connection to be reused. */
    private async executeWithDeadline(statement: any, run: () => Promise<any>, sql: string, parameters: any[], timeoutMs: number): Promise<any> {
        if (timeoutMs === 0) return run();
        let timer: NodeJS.Timeout | undefined;
        const running = run();
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new QueryTimeoutError(sql, timeoutMs, parameters)), timeoutMs);
        });
        try {
            return await Promise.race([running, deadline]);
        } catch (error) {
            if (error instanceof QueryTimeoutError) {
                try {
                    if (statement.cancel) await statement.cancel();
                    else await (statement.ps ?? statement.s).cancelPromise();
                } finally {
                    // A Java call may still be completing after cancellation.
                    // Never hand its connection to a different borrower meanwhile.
                    await running.catch(() => {});
                }
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Test connection health.
     * @async
     * @returns {Promise<boolean>} Health test result promise.
     */
    public async ping(): Promise<boolean> {
        try {
            // Simple test based on JDBCTool.js
            await this.execute('SELECT 1 FROM INFORMATION_SCHEMA.SYSTEM_USERS LIMIT 1');
            return true;
        } catch (error) {
            this.logger.warn('Connection ping failed', {
                connectionId: this.id,
                operation: 'ping-failure',
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /** Read the current JDBC session settings for later restoration. */
    public async getSessionState(): Promise<JDBCSessionState> {
        if (!this.isActive || !this.conn) throw new ConnectionError('Connection not active', {connectionId: this.id});
        return {
            autoCommit: await this.conn.conn.getAutoCommitPromise(),
            readOnly: await this.conn.conn.isReadOnlyPromise(),
            isolationLevel: await this.conn.conn.getTransactionIsolationPromise()
        };
    }

    /**
     * Set auto-commit mode on the underlying JDBC connection.
     * @async
     * @param {boolean} autoCommit - Auto-commit mode
     * @returns {Promise<void>} Set operation promise
     * @throws {ConnectionError} When connection is not active
     */
    public async setAutoCommit(autoCommit: boolean): Promise<void> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Setting auto-commit mode', {
            connectionId: this.id,
            operation: 'set-auto-commit',
            autoCommit
        });

        try {
            await this.conn.conn.setAutoCommitPromise(autoCommit);
            
            this.logger.debug('Auto-commit mode set successfully', {
                connectionId: this.id,
                operation: 'set-auto-commit-complete',
                autoCommit
            });
        } catch (error) {
            this.logger.error('Failed to set auto-commit mode', {
                connectionId: this.id,
                operation: 'set-auto-commit-error',
                autoCommit,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to set auto-commit mode: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id, autoCommit }
            );
        }
    }

    /**
     * Commit the current transaction.
     * @async
     * @returns {Promise<void>} Commit operation promise
     * @throws {ConnectionError} When connection is not active
     */
    public async commit(): Promise<void> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Committing transaction', {
            connectionId: this.id,
            operation: 'commit'
        });

        try {
            await this.conn.commit();
            
            this.logger.debug('Transaction committed successfully', {
                connectionId: this.id,
                operation: 'commit-complete'
            });
        } catch (error) {
            this.logger.error('Failed to commit transaction', {
                connectionId: this.id,
                operation: 'commit-error',
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to commit transaction: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id }
            );
        }
    }

    /**
     * Rollback the current transaction.
     * @async
     * @returns {Promise<void>} Rollback operation promise
     * @throws {ConnectionError} When connection is not active
     */
    public async rollback(): Promise<void> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Rolling back transaction', {
            connectionId: this.id,
            operation: 'rollback'
        });

        try {
            // CRITICAL FIX: Check if autoCommit is disabled before attempting rollback
            // HSQLDB throws "Invalid argument" if trying to rollback with autoCommit=true
            const autoCommit = await this.conn.conn.getAutoCommitPromise();
            
            if (autoCommit) {
                this.logger.debug('Cannot rollback with autoCommit enabled, skipping rollback', {
                    connectionId: this.id,
                    operation: 'rollback-skip',
                    autoCommit: true
                });
                // For connections with autoCommit=true, there's nothing to rollback
                return;
            }
            
            await this.conn.conn.rollbackPromise();
            
            this.logger.debug('Transaction rolled back successfully', {
                connectionId: this.id,
                operation: 'rollback-complete'
            });
        } catch (error) {
            this.logger.error('Failed to rollback transaction', {
                connectionId: this.id,
                operation: 'rollback-error',
                error: error instanceof Error ? error.message : String(error)
            });
            
            // NOUVEAU: Analyse plus détaillée de l'erreur pour HSQLDB
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ConnectionError(
                `Failed to rollback transaction: ${errorMessage}`,
                { connectionId: this.id }
            );
        }
    }

    /**
     * Set transaction isolation level.
     * @async
     * @param {number} level - Isolation level (JDBC constants)
     * @returns {Promise<void>} Set operation promise
     * @throws {ConnectionError} When connection is not active
     */
    public async setTransactionIsolation(level: number): Promise<void> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Setting transaction isolation level', {
            connectionId: this.id,
            operation: 'set-isolation-level',
            level
        });

        try {
            await this.conn.conn.setTransactionIsolationPromise(level);
            
            this.logger.debug('Transaction isolation level set successfully', {
                connectionId: this.id,
                operation: 'set-isolation-level-complete',
                level
            });
        } catch (error) {
            this.logger.error('Failed to set transaction isolation level', {
                connectionId: this.id,
                operation: 'set-isolation-level-error',
                level,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to set transaction isolation level: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id, level }
            );
        }
    }

    /**
     * Set read-only mode.
     * @async
     * @param {boolean} readOnly - Read-only mode
     * @returns {Promise<void>} Set operation promise
     * @throws {ConnectionError} When connection is not active
     */
    public async setReadOnly(readOnly: boolean): Promise<void> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Setting read-only mode', {
            connectionId: this.id,
            operation: 'set-read-only',
            readOnly
        });

        try {
            await this.conn.conn.setReadOnlyPromise(readOnly);
            
            this.logger.debug('Read-only mode set successfully', {
                connectionId: this.id,
                operation: 'set-read-only-complete',
                readOnly
            });
        } catch (error) {
            this.logger.error('Failed to set read-only mode', {
                connectionId: this.id,
                operation: 'set-read-only-error',
                readOnly,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to set read-only mode: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id, readOnly }
            );
        }
    }

    /**
     * Create a statement for SQL execution.
     * @async
     * @returns {Promise<any>} Statement object promise
     * @throws {ConnectionError} When connection is not active
     */
    public async createStatement(): Promise<any> {
        if (!this.isActive || !this.conn) {
            throw new ConnectionError('Connection not active', { connectionId: this.id });
        }

        this.logger.debug('Creating statement', {
            connectionId: this.id,
            operation: 'create-statement'
        });

        try {
            const statement = await this.conn.createStatement();
            
            this.logger.debug('Statement created successfully', {
                connectionId: this.id,
                operation: 'create-statement-complete'
            });
            
            return statement;
        } catch (error) {
            this.logger.error('Failed to create statement', {
                connectionId: this.id,
                operation: 'create-statement-error',
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to create statement: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId: this.id }
            );
        }
    }

    /**
     * Permanently remove an unsafe JDBC session from its native pool.
     * Closing the physical connection rolls back any uncommitted work.
     * @returns A promise resolved after the physical connection closes.
     */
    public async discard(): Promise<void> {
        const reservation = this.connobj;
        this.isActive = false;
        this.connobj = null;
        this.conn = null;
        if (!reservation) return;
        if (this.sharedPool) {
            this.sharedPool.pool = this.sharedPool.pool.filter((entry: any) => entry !== reservation);
            this.sharedPool.reserved = this.sharedPool.reserved.filter((entry: any) => entry !== reservation);
        }
        await reservation.conn.close();
    }

    /**
     * Close connection - ONLY release back to shared pool, do NOT close the pool.
     * @async
     * @returns {Promise<void>} Close operation promise.
     */
    public async close(): Promise<void> {
        this.isActive = false;
        
        this.logger.info('Releasing connection back to shared pool', {
            connectionId: this.id,
            operation: 'close-start'
        });
        
        try {
            // NOUVEAU: Protection supplémentaire contre les doubles libérations
            if (!this.connobj) {
                this.logger.debug('Connection already released', {
                    connectionId: this.id,
                    operation: 'close-already-done'
                });
                return;
            }
            
            // ONLY release the connection back to the shared pool
            // DO NOT close the shared pool itself
            if (this.connobj && this.sharedPool) {
                await this.sharedPool.release(this.connobj);
                this.logger.debug('Connection released back to shared pool successfully', {
                    connectionId: this.id,
                    operation: 'pool-release-complete'
                });
            }
            
            // Clear local references but keep shared pool alive
            this.connobj = null;
            this.conn = null;
            
            this.logger.connection('released', this.id, {
                operation: 'close-complete',
                poolType: 'factory-owned'
            });
            
            // NOUVEAU: Petit délai pour permettre au pool de se stabiliser
            await new Promise(resolve => setTimeout(resolve, 10));
            
        } catch (error) {
            // Log but don't throw during cleanup
            this.logger.warn('Error during connection release to shared pool', {
                connectionId: this.id,
                operation: 'close-error',
                error: error instanceof Error ? error.message : String(error)
            });
            
            // NOUVEAU: Forcer le nettoyage local même en cas d'erreur
            this.connobj = null;
            this.conn = null;
        }
    }
}

// =============================================================================
// JDBC CONNECTION FACTORY
// =============================================================================

/**
 * @class JDBCConnectionFactory
 * @description JDBC Connection Factory - Version based on JDBCTool.js.
 * @implements {BaseModule}
 */
export class JDBCConnectionFactory implements BaseModule {
    /** 
     * The name of the module.
     * @public
     * @readonly
     * @type {string}
     */
    public readonly name = 'jdbc-connection-factory';
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
     * Live connection wrappers indexed by connection identifier. 
     * @private 
     * @type {Map<string, HSQLDBConnection>}
     */
    private activeConnections: Map<string, HSQLDBConnection> = new Map();
    /**
     * Monotonic counter used to allocate connection identifiers. 
     * @private 
     * @type {number}
     */
    private connectionCounter = 0;
    /** Native pool initialization promises indexed by connection URL and configuration. */
    private pools = new Map<string, Promise<any>>();
    /**
     * Module logger for operation context and diagnostic errors. 
     * @private 
     * @type {ModuleLogger}
     */
    private logger: ModuleLogger;
    
    /**
     * Create a new JDBC Connection Factory.
     */
    constructor() {
        this.logger = createModuleLogger('JDBCConnectionFactory-v1.0');
    }
    
    /**
     * Initialize the factory - JVM configuration based on JDBCTool.js.
     * @async
     * @param {HSQLManager} manager - HSQLManager instance.
     * @returns {Promise<void>} Initialization promise.
     * @throws {ModuleAlreadyInitializedError} When factory is already initialized.
     * @throws {HSQLDBJarError} When JVM configuration fails.
     */
    public async initialize(manager: HSQLManager): Promise<void> {
        if (this._initialized) {
            throw new ModuleAlreadyInitializedError('JDBCConnectionFactory', {
                operation: 'initialize'
            });
        }
        
        this.logger.info('Initializing JDBCConnectionFactory v1.0 (based on JDBCTool.js)', {
            operation: 'initialize',
            jvmCreated: isJvmCreated()
        });
        
        this.manager = manager;
        
        // Global JVM configuration - CRITICAL for success
        try {
            this.logger.debug('Configuring global JVM for JDBC connections', {
                operation: 'jvm-config-start',
                jvmAlreadyCreated: isJvmCreated()
            });
            
            configureJVMGlobal();
            
            this.logger.info('JVM configured successfully for JDBC connections', {
                operation: 'jvm-config-complete',
                jvmCreated: isJvmCreated()
            });
        } catch (error) {
            this.logger.error('Failed to configure JVM for JDBC connections', {
                operation: 'jvm-config-error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
        
        this._initialized = true;
        this.logger.info('JDBCConnectionFactory initialized successfully', {
            operation: 'initialize-complete',
            version: this.version,
            jvmReady: isJvmCreated()
        });
    }
    
    /** Acquire a pool for this factory and exact database configuration. */
    private async getPool(url: string, config?: JDBCPoolConfig): Promise<any> {
        const key = JSON.stringify([url, config]);
        let pool = this.pools.get(key);
        if (!pool) {
            pool = createJDBCPool(url, config);
            this.pools.set(key, pool);
        }
        try {
            return await pool;
        } catch (error) {
            this.pools.delete(key);
            throw error;
        }
    }

    /**
     * Create a new JDBC connection.
     * @async
     * @param {JDBCConnectionConfig} config - Connection configuration object.
     * @returns {Promise<JDBCConnection>} Connection promise.
     * @throws {ModuleNotInitializedError} When factory is not initialized.
     * @throws {ConnectionError} When connection creation fails.
     */
    public async createConnection(config: JDBCConnectionConfig): Promise<JDBCConnection> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('JDBCConnectionFactory', 'create connection', {
                operation: 'create-connection'
            });
        }
        
        const connectionId = `jdbc_v1_${++this.connectionCounter}_${Date.now()}`;
        
        this.logger.info('Creating new JDBC connection v1.0', {
            operation: 'create-connection',
            connectionId,
            url: config.url,
            autoCommit: config.autoCommit,
            readOnly: config.readOnly,
            poolConfigProvided: !!config.poolConfig
        });
        
        const pool = await this.getPool(config.url, config.poolConfig);
        const connection = new HSQLDBConnection(connectionId, config, this.logger, pool);
        
        try {
            await connection.connect();
            this.activeConnections.set(connectionId, connection);
            
            this.logger.info('JDBC connection created successfully', {
                operation: 'create-connection-complete',
                connectionId,
                activeConnections: this.activeConnections.size
            });
            
            this.logger.performance('active-connections', this.activeConnections.size, {
                operation: 'connection-created'
            });
            
            return connection;
            
        } catch (error) {
            this.logger.error('Failed to create JDBC connection', {
                operation: 'create-connection-error',
                connectionId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw new ConnectionError(
                `Failed to create JDBC connection: ${error instanceof Error ? error.message : String(error)}`,
                { connectionId, url: config.url }
            );
        }
    }
    
    /**
     * Create connection with manager configuration.
     * @async
     * @returns {Promise<JDBCConnection>} Connection promise.
     * @throws {ModuleNotInitializedError} When factory is not initialized.
     * @throws {ConfigurationError} When manager is not set.
     */
    public async createConnectionFromManager(): Promise<JDBCConnection> {
        if (!this._initialized) {
            throw new ModuleNotInitializedError('JDBCConnectionFactory', 'create connection from manager', {
                operation: 'create-from-manager'
            });
        }
        
        if (!this.manager) {
            throw new ConfigurationError('Manager not set', ['manager'], {
                operation: 'create-from-manager'
            });
        }
        
        const managerConfig = this.manager.getConfiguration();
        const url = this.manager.getDatabaseUrl();
        
        this.logger.debug('Creating connection from manager configuration', {
            operation: 'create-from-manager',
            url
        });
        
        const config: JDBCConnectionConfig = {
            url,
            timeoutMs: managerConfig.connection.timeoutMs!,
            autoCommit: managerConfig.connection.autoCommit!,
            readOnly: managerConfig.connection.readOnly!,

        };
        
        return await this.createConnection(config);
    }
    
    /**
     * Close a specific connection.
     * @async
     * @param {string} connectionId - Connection identifier string.
     * @returns {Promise<void>} Close operation promise.
     */
    public async closeConnection(connectionId: string): Promise<void> {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            this.logger.info('Closing connection', {
                operation: 'close-connection',
                connectionId
            });
            
            await connection.close();
            this.activeConnections.delete(connectionId);
            
            this.logger.info('Connection closed', {
                operation: 'close-connection-complete',
                connectionId,
                activeConnections: this.activeConnections.size
            });
        } else {
            this.logger.warn('Attempted to close non-existent connection', {
                operation: 'close-connection',
                connectionId
            });
        }
    }
    
    /**
     * Get active connection count.
     * @returns {number} Number of active connections.
     */
    public getActiveConnectionCount(): number {
        return this.activeConnections.size;
    }
    
    /**
     * Get list of active connection IDs.
     * @returns {Array<string>} Array of connection ID strings.
     */
    public getActiveConnectionIds(): string[] {
        return Array.from(this.activeConnections.keys());
    }
    
    /**
     * Test a connection by ID.
     * @async
     * @param {string} connectionId - Connection identifier string.
     * @returns {Promise<boolean>} Health test result promise.
     */
    public async testConnection(connectionId: string): Promise<boolean> {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            return await connection.ping();
        }
        return false;
    }
    
    /**
     * Release all wrappers and drain every factory-owned physical pool, preserving the shared JVM.
     * @async
     * @returns {Promise<void>} Cleanup operation promise.
     * @throws {AggregateError} After draining all pools when one or more physical sessions fail to close.
     */
    public async destroy(): Promise<void> {
        this.logger.info('Destroying JDBCConnectionFactory and cleaning up resources', {
            operation: 'destroy-start',
            activeConnections: this.activeConnections.size,
            version: this.version
        });
        
        // Close all active connections (release them back to shared pool)
        const closePromises = Array.from(this.activeConnections.values()).map(conn =>
            conn.close().catch(error => {
                this.logger.warn('Failed to close connection during destroy', {
                    operation: 'destroy-connection-error',
                    connectionId: conn.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            })
        );
        
        await Promise.allSettled(closePromises);
        this.activeConnections.clear();
        
        this.logger.debug('All individual connections released, closing shared pool', {
            operation: 'destroy-pool-cleanup-start'
        });
        
        const pools = [...this.pools.values()];
        this.pools.clear();
        const cleanupErrors: unknown[] = [];
        for (const pending of pools) {
            try {
                const pool = await pending;
                // Native purge resolves before close completes. Drain every physical session.
                const sessions = [...pool.pool, ...pool.reserved];
                pool.pool = [];
                pool.reserved = [];
                const results = await Promise.allSettled(sessions.map(async session => session.conn.close()));
                for (const result of results) {
                    if (result.status === 'rejected') cleanupErrors.push(result.reason);
                }
            } catch (error) {
                cleanupErrors.push(error);
            }
        }

        this._initialized = false;
        
        this.logger.info('JDBCConnectionFactory cleanup complete', {
            operation: 'destroy-complete'
        });

        // CRITICAL: DO NOT shutdown JVM during tests - it would prevent subsequent test execution
        // The JVM shutdown should only happen during final application shutdown
        if (isJvmCreated()) {
            this.logger.info('JVM is active but leaving it running for potential reuse', {
                operation: 'jvm-shutdown-skip',
                jvmActive: true,
                reason: 'preserve-jvm-for-reuse'
            });
            
            // Give a brief moment to ensure proper cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            this.logger.info('JVM not active, no shutdown required', {
                operation: 'jvm-shutdown-not-needed',
                jvmActive: false
            });
        }
        if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'Failed to close JDBC pools');
    }
    
    /**
     * Schedule process termination for applications whose JVM keeps Node alive.
     * The shared JVM remains available until the process exits.
     * @param {number} [exitCode=0] - Process exit code.
     * @param {number} [delayMs=1000] - Grace period; termination uses half this delay for compatibility.
     * @returns {Promise<void>} Resolves once the termination timer is scheduled.
     */
    public static async forceProcessCleanup(exitCode: number = 0, delayMs: number = 1000): Promise<void> {
        setTimeout(() => process.exit(exitCode), delayMs / 2);
    }

    /**
     * Diagnose connection readiness for JDBC connections.
     * @async
     * @returns {Promise<object>} Diagnosis result object.
     */
    public async diagnoseConnectionReadiness(): Promise<{
        jarAvailable: boolean;
        jvmConfigured: boolean;
        databaseAccessible: boolean;
        details: string[];
    }> {
        const details: string[] = [];
        
        // Check HSQLDB JAR
        let jarAvailable = false;
        try {
            findHSQLJarPath();
            jarAvailable = true;
            details.push('HSQLDB JAR found');
        } catch (error) {
            details.push(`HSQLDB JAR not found: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Check JVM
        const jvmReady: boolean = isJvmCreated() || jvmConfigured;
        details.push(`JVM configured: ${jvmReady}`);
        
        // Check database accessibility - IMPLEMENTATION BASED ON validateTestDatabase()
        let databaseAccessible = false;
        if (this.manager) {
            try {
                const url = this.manager.getDatabaseUrl();
                details.push(`Database URL: ${url}`);
                
                // Extract database path from JDBC URL
                const urlMatch = url.match(/jdbc:hsqldb:file:(.+?)(;|$)/);
                if (!urlMatch) {
                    details.push('Invalid JDBC URL format');
                } else {
                    const dbPath = urlMatch[1];
                    details.push(`Database path extracted: ${dbPath}`);
                    
                    // Check if main directory exists
                    const dbDir = path.dirname(dbPath);
                    if (!fs.existsSync(dbDir)) {
                        details.push(`Database directory not found: ${dbDir}`);
                    } else {
                        details.push(`Database directory found: ${dbDir}`);
                        
                        // Check for HSQLDB files - try both formats (JDBCTool.js shows both work)
                        const possibleFiles = [
                            // Direct file format: path.data, path.properties, path.script
                            `${dbPath}.data`,
                            `${dbPath}.properties`, 
                            `${dbPath}.script`,
                            // Directory format: path/.data, path/.properties, path/.script
                            path.join(dbPath, '.data'),
                            path.join(dbPath, '.properties'),
                            path.join(dbPath, '.script')
                        ];
                        
                        let foundFiles = 0;
                        const foundFilesList: string[] = [];
                        
                        for (const filePath of possibleFiles) {
                            if (fs.existsSync(filePath)) {
                                try {
                                    // Check if file is readable
                                    fs.accessSync(filePath, fs.constants.R_OK);
                                    foundFiles++;
                                    foundFilesList.push(path.basename(filePath));
                                    details.push(`Found readable database file: ${path.basename(filePath)}`);
                                } catch (accessError) {
                                    details.push(`Database file exists but not readable: ${path.basename(filePath)}`);
                                }
                            }
                        }
                        
                        // Database is accessible if we found at least the core files
                        if (foundFiles >= 2) { // At least .script and .properties should exist
                            databaseAccessible = true;
                        details.push(`Database accessible with ${foundFiles} files: ${foundFilesList.join(', ')}`);
                        } else {
                            details.push(`Insufficient database files found (${foundFiles}). Expected: .data, .properties, .script`);
                        }
                        
                        // Additional check: verify we can get file stats
                        try {
                            const indexPath = dbPath.endsWith('/') ? dbPath.slice(0, -1) : dbPath;
                            const stats = fs.statSync(path.dirname(indexPath));
                            if (stats.isDirectory()) {
                                details.push(`Database parent directory is valid and accessible`);
                            }
                        } catch (statError) {
                            details.push(`Warning: Could not verify directory stats: ${statError instanceof Error ? statError.message : String(statError)}`);
                        }
                    }
                }
                
            } catch (error) {
                details.push(`Database accessibility test failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else {
            details.push('Manager not set, cannot test database accessibility');
        }
        
        return {
            jarAvailable,
            jvmConfigured: jvmReady,
            databaseAccessible,
            details
        };
    }
}
