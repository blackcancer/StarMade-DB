/**
 * @fileoverview Core Module Exports
 * 
 * This file serves as the central export point for all core functionalities
 * of the StarMade HSQLDB management library. It aggregates and re-exports
 * the main manager, configuration types, error classes, utility functions,
 * event system components, and all underlying modules, providing a single
 * entry point for consumers of the library.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

// Main manager and configuration
export {
    HSQLManager,
    ModuleRegistry,
    type HSQLManagerConfiguration,
    type ModuleConfiguration,
    type ConnectionConfiguration,
    type PerformanceConfiguration,
    type LoggingConfiguration,
    type SecurityConfiguration,
    type BaseModule,
    type ManagerStatus,
    ManagerState,
    DEFAULT_CONFIG
} from './HSQLManager.js';

// Error classes and utilities
export * from './errors.js';

// Utility functions
export * from './utils.js';

// Event system (selective exports to avoid conflicts)
export {
    ModuleEvent,
    PerformanceEvent,
    type ModuleEventListener,
    type ModuleEventEmitter,
    ModuleEventEmitterImpl,
    isEventEmitter,
    forwardEvents,
    GlobalEventBus,
    globalEventBus
} from './events.js';

// Core module exports
export * from './modules/index.js';

// Table-specific modules
export * from '../tables/index.js';