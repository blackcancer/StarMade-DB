/**
 * @fileoverview Logger Module
 * 
 * This file defines the centralized logging system for SMToolkit-DB using Winston.
 * It provides structured logging with different levels and formats, including
 * specialized loggers for modules and support for multiple output formats.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * @typedef LogLevel
 * @description Defines the available log levels.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * @interface LogContext
 * @description Defines the context object that can be attached to log entries.
 */
export interface LogContext {
    /** The module name that generated the log entry. */
    module?: string;
    /** The operation being performed when the log was generated. */
    operation?: string;
    /** The connection ID associated with the log entry. */
    connectionId?: string;
    /** The SQL query associated with the log entry. */
    query?: string;
    /** The execution time in milliseconds for the operation. */
    executionTime?: number;
    /** Additional context properties. */
    [key: string]: any;
}

/**
 * @interface LoggerConfig
 * @description Defines the configuration for the logger system.
 */
export interface LoggerConfig {
    /** The minimum log level to output. */
    level: LogLevel;
    /** Whether to enable console output. */
    enableConsole: boolean;
    /** Whether to enable file output. */
    enableFile: boolean;
    /** Whether to enable query logging. */
    enableQueries: boolean;
    /** Whether to enable connection event logging. */
    enableConnections: boolean;
    /** Whether to enable performance metric logging. */
    enablePerformance: boolean;
    /** The directory where log files should be stored. */
    logDir?: string;
    /** The maximum number of log files to keep. */
    maxFiles?: number;
    /** The maximum size of each log file. */
    maxSize?: string;
}

// =============================================================================
// LOGGER IMPLEMENTATION
// =============================================================================

/**
 * @class StarMadeLogger
 * @description Centralized logger for SMToolkit-DB using Winston.
 */
class StarMadeLogger {
    /**
     * Module logger for operation context and diagnostic errors. @private @type {winston.Logger} */
    private logger: winston.Logger;
    /**
     * Effective configuration applied to this instance. @public @type {LoggerConfig} */
    public config: LoggerConfig;  // Make config public so ModuleLogger can access it
    
    /**
     * Creates a new StarMadeLogger instance.
     * @param {LoggerConfig} config - The logger configuration.
     */
    constructor(config: LoggerConfig) {
        this.config = config;
        this.logger = this.createLogger();
    }
    
    /**
     * Creates the Winston logger instance with the appropriate transports and formatters.
     * @private
     * @returns {winston.Logger} The configured Winston logger.
     */
    private createLogger(): winston.Logger {
        const formats = [
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        ];
        
        const transports: winston.transport[] = [];
        
        // Console transport
        if (this.config.enableConsole) {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                    winston.format.printf(({ level, message, timestamp, ...meta }) => {
                        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
                        return `${timestamp} [${level}] ${message}${metaStr}`;
                    })
                )
            }));
        }
        
        // File transports
        if (this.config.enableFile && this.config.logDir) {
            this.ensureLogDirectory(this.config.logDir);
            
            // Main log file
            transports.push(new winston.transports.File({
                filename: join(this.config.logDir, 'smtoolkit-db.log'),
                maxsize: this.parseSize(this.config.maxSize || '10m'),
                maxFiles: this.config.maxFiles || 5,
                format: winston.format.combine(...formats)
            }));
            
            // Error log file
            transports.push(new winston.transports.File({
                filename: join(this.config.logDir, 'smtoolkit-db-error.log'),
                level: 'error',
                maxsize: this.parseSize(this.config.maxSize || '10m'),
                maxFiles: this.config.maxFiles || 5,
                format: winston.format.combine(...formats)
            }));
            
            // Query log file (if enabled)
            if (this.config.enableQueries) {
                transports.push(new winston.transports.File({
                    filename: join(this.config.logDir, 'smtoolkit-db-queries.log'),
                    maxsize: this.parseSize(this.config.maxSize || '10m'),
                    maxFiles: this.config.maxFiles || 5,
                    format: winston.format.combine(...formats)
                }));
            }
        }
        
        // If no transports are configured, add a silent transport to prevent Winston warnings
        if (transports.length === 0) {
            transports.push(new winston.transports.Console({
                silent: true
            }));
        }
        
        return winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(...formats),
            transports,
            exitOnError: false,
            silent: !this.config.enableConsole && !(this.config.enableFile && this.config.logDir)
        });
    }
    
    /**
     * Ensures that the log directory exists, creating it if necessary.
     * @private
     * @param {string} logDir - The path to the log directory.
     */
    private ensureLogDirectory(logDir: string): void {
        if (!existsSync(logDir)) {
            mkdirSync(logDir, {recursive: true});
        }
    }
    
    /**
     * Parses a size string (e.g., '10m', '5k') into bytes.
     * @private
     * @param {string} size - The size string to parse.
     * @returns {number} The size in bytes.
     * @throws {Error} If the size format is invalid.
     */
    private parseSize(size: string): number {
        const match = size.match(/^(\d+)([kKmMgG])$/);
        if (!match) {
            throw new Error(`Invalid size format: ${size}`);
        }
        
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        
        const multipliers: Record<string, number> = {k: 1024, m: 1024 ** 2, g: 1024 ** 3};
        return value * multipliers[unit];
    }
    
    /**
     * Formats the context for logging, providing a default empty object if none is provided.
     * @private
     * @param {LogContext} [context] - The context to format.
     * @returns {LogContext} The formatted context.
     */
    private formatContext(context?: LogContext): LogContext {
        return context || {};
    }
    
    /**
     * Logs a message with the specified level and context.
     * @param {LogLevel} level - The log level.
     * @param {string} message - The message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    log(level: LogLevel, message: string, context?: LogContext): void {
        this.logger.log(level, message, context);
    }
    
    /**
     * Logs an error message.
     * @param {string} message - The error message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public error(message: string, context?: LogContext): void {
        if (this.logger && this.logger.transports && this.logger.transports.length > 0) {
            this.logger.error(message, this.formatContext(context));
        }
    }
    
    /**
     * Logs a warning message.
     * @param {string} message - The warning message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public warn(message: string, context?: LogContext): void {
        if (this.logger && this.logger.transports && this.logger.transports.length > 0) {
            this.logger.warn(message, this.formatContext(context));
        }
    }
    
    /**
     * Logs an info message.
     * @param {string} message - The info message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public info(message: string, context?: LogContext): void {
        if (this.logger && this.logger.transports && this.logger.transports.length > 0) {
            this.logger.info(message, this.formatContext(context));
        }
    }
    
    /**
     * Logs a debug message.
     * @param {string} message - The debug message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public debug(message: string, context?: LogContext): void {
        if (this.logger && this.logger.transports && this.logger.transports.length > 0) {
            this.logger.debug(message, this.formatContext(context));
        }
    }
    
    /**
     * Logs SQL query execution details.
     * @param {string} sql - The SQL query that was executed.
     * @param {number} executionTime - The execution time in milliseconds.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public query(sql: string, executionTime: number, context?: LogContext): void {
        if (this.config.enableQueries && this.logger) {
            this.logger.info(`Query executed: ${sql}`, { executionTime, ...this.formatContext(context) });
        }
    }

    /**
     * Updates the logger configuration and recreates the logger with new settings.
     * @param {Partial<LoggerConfig>} newConfig - The configuration updates to apply.
     */
    public updateConfig(newConfig: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.close();
        this.logger = this.createLogger();
    }
    
    /**
     * Closes the logger and cleans up all resources.
     */
    public close(): void {
        if (this.logger) {
            this.logger.close();
        }
    }
}

// =============================================================================
// MODULE LOGGER IMPLEMENTATION
// =============================================================================

/**
 * @class ModuleLogger
 * @description Logger for specific modules that automatically includes module context.
 */
export class ModuleLogger {
    /**
     * Parent logger receiving messages with module context. @private @type {StarMadeLogger} */
    private parentLogger: StarMadeLogger;
    /**
     * Module name attached to each log entry. @private @type {string} */
    private moduleName: string;

    /**
     * Creates a new ModuleLogger instance.
     * @param {StarMadeLogger} parentLogger - The parent logger instance.
     * @param {string} moduleName - The name of the module this logger is for.
     */
    constructor(parentLogger: StarMadeLogger, moduleName: string) {
        this.parentLogger = parentLogger;
        this.moduleName = moduleName;
    }

    /**
     * Logs an error message with module context.
     * @param {string} message - The error message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public error(message: string, context?: LogContext): void {
        this.parentLogger.error(message, { module: this.moduleName, ...context });
    }

    /**
     * Logs a warning message with module context.
     * @param {string} message - The warning message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public warn(message: string, context?: LogContext): void {
        this.parentLogger.warn(message, { module: this.moduleName, ...context });
    }

    /**
     * Logs an info message with module context.
     * @param {string} message - The info message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public info(message: string, context?: LogContext): void {
        this.parentLogger.info(message, { module: this.moduleName, ...context });
    }

    /**
     * Logs a debug message with module context.
     * @param {string} message - The debug message to log.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public debug(message: string, context?: LogContext): void {
        this.parentLogger.debug(message, { module: this.moduleName, ...context });
    }

    /**
     * Logs SQL query execution details with module context.
     * @param {string} sql - The SQL query that was executed.
     * @param {number} executionTime - The execution time in milliseconds.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public query(sql: string, executionTime: number, context?: LogContext): void {
        this.parentLogger.query(sql, executionTime, { module: this.moduleName, ...context });
    }

    /**
     * Logs connection events with module context.
     * @param {string} event - The connection event that occurred.
     * @param {string} connectionId - The ID of the connection.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public connection(event: string, connectionId: string, context?: LogContext): void {
        if (this.parentLogger.config.enableConnections) {
            this.parentLogger.info(`Connection ${event}`, { 
                module: this.moduleName, 
                connectionId, 
                category: 'connection',
                ...context 
            });
        }
    }

    /**
     * Logs performance metrics with module context.
     * @param {string} metric - The name of the performance metric.
     * @param {number} value - The value of the metric.
     * @param {LogContext} [context] - Additional context for the log entry.
     */
    public performance(metric: string, value: number, context?: LogContext): void {
        if (this.parentLogger.config.enablePerformance) {
            this.parentLogger.info('Performance metric', { 
                module: this.moduleName, 
                metric, 
                value, 
                category: 'performance',
                ...context 
            });
        }
    }
}

// =============================================================================
// GLOBAL LOGGER MANAGEMENT
// =============================================================================

/** Shared logger instance returned to callers that do not supply one. */
let globalLogger: StarMadeLogger | null = null;

/**
 * Initializes the global logger with the specified configuration.
 * @param {LoggerConfig} config - The logger configuration.
 * @returns {StarMadeLogger} The initialized global logger instance.
 */
export function initializeLogger(config: LoggerConfig): StarMadeLogger {
    if (globalLogger) {
        globalLogger.close();
    }
    
    globalLogger = new StarMadeLogger(config);
    return globalLogger;
}

/**
 * Gets the global logger instance, creating a default silent logger if none exists.
 * @returns {StarMadeLogger} The global logger instance.
 */
export function getLogger(): StarMadeLogger {
    if (!globalLogger) {
        // Create default silent logger if none exists during tests
        globalLogger = new StarMadeLogger({
            level: 'error',
            enableConsole: false,
            enableFile: false,
            enableQueries: false,
            enableConnections: false,
            enablePerformance: false
        });
    }
    
    return globalLogger;
}

/**
 * Creates a module logger for the specified module name.
 * @param {string} moduleName - The name of the module.
 * @returns {ModuleLogger} A new ModuleLogger instance.
 */
export function createModuleLogger(moduleName: string): ModuleLogger {
    const parentLogger = getLogger();
    return new ModuleLogger(parentLogger, moduleName);
}

/**
 * Closes the global logger and cleans up resources.
 */
export function closeLogger(): void {
    if (globalLogger) {
        globalLogger.close();
        globalLogger = null;
    }
}

/**
 * Creates a silent logger for testing that doesn't output anything.
 * @returns {ModuleLogger} A silent ModuleLogger instance.
 */
export function createSilentLogger(): ModuleLogger {
    const silentLogger = new StarMadeLogger({
        level: 'error',
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    });
    
    return new ModuleLogger(silentLogger, 'Silent');
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * @const DEFAULT_CONFIGS
 * @description Default logger configurations for different environments.
 */
export const DEFAULT_CONFIGS = {
    /** Development environment configuration with full logging enabled. */
    development: {
        level: 'debug' as LogLevel,
        enableConsole: true,
        enableFile: true,
        enableQueries: true,
        enableConnections: true,
        enablePerformance: true,
        logDir: './logs',
        maxFiles: 3,
        maxSize: '5m'
    },
    
    /** Production environment configuration with optimized logging. */
    production: {
        level: 'info' as LogLevel,
        enableConsole: false,
        enableFile: true,
        enableQueries: false,
        enableConnections: true,
        enablePerformance: true,
        logDir: './logs',
        maxFiles: 10,
        maxSize: '50m'
    },
    
    /** Testing environment configuration with minimal logging. */
    testing: {
        level: 'error' as LogLevel,
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    },
    
    /** Silent configuration that disables all logging. */
    silent: {
        level: 'error' as LogLevel,
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    }
} as const;