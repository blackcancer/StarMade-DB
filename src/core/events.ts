/**
 * @fileoverview Module Event System
 * 
 * This file defines the centralized event system for all StarMade DB modules.
 * It provides type-safe event emission and listening capabilities, defining
 * core event types, interfaces, and a global event bus for inter-module
 * communication.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { createModuleLogger, type ModuleLogger } from './modules/logging/Logger.js';

// =============================================================================
// CORE EVENT TYPES
// =============================================================================

/**
 * @interface BaseEventData
 * @description The base interface for all event data payloads, providing common properties.
 */
export interface BaseEventData {
    /**
     * The timestamp when the event occurred.
     * @type {Date}
     */
    timestamp?: Date;
    /**
     * The name of the module that sourced the event.
     * @type {string}
     */
    source?: string;
    /**
     * A string detailing the specific type of the event.
     * @type {string}
     */
    type?: string;
    /**
     * An object for any additional context data related to the event.
     * @type {Record<string, any>}
     */
    context?: Record<string, any>;
}

/**
 * @description Defines the function signature for an event listener.
 * @template T - The set of possible event types.
 * @param {T} event - The event being listened for.
 * @param {any} [data] - The data payload associated with the event.
 */
export type ModuleEventListener<T extends string | number | symbol = string | number | symbol> = (event: T, data?: any) => void;

/**
 * Defines the interface for a module's event emitter.
 * @interface ModuleEventEmitter
 * @template T - A union type of all possible event names (e.g., an enum).
 */
export interface ModuleEventEmitter<T extends string | number | symbol> {
    /**
     * Adds a listener for a specific event.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener<T>} listener - The callback function to execute.
     */
    on(event: T, listener: ModuleEventListener<T>): void;
    /**
     * Adds a one-time listener for a specific event. It is removed after being called once.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener<T>} listener - The callback function to execute.
     */
    once(event: T, listener: ModuleEventListener<T>): void;
    /**
     * Removes a listener for a specific event.
     * @param {T} event - The event to stop listening to.
     * @param {ModuleEventListener<T>} listener - The specific listener function to remove.
     */
    off(event: T, listener: ModuleEventListener<T>): void;
    /**
     * Emits an event to all registered listeners for that event.
     * @param {T} event - The event to emit.
     * @param {any} [data] - The data payload to send with the event.
     */
    emit(event: T, data?: any): void;
    /**
     * Removes all listeners for a specific event, or all listeners from all events if no event is specified.
     * @param {T} [event] - The event to remove all listeners from.
     */
    removeAllListeners(event?: T): void;
    /**
     * Gets the number of listeners for a specific event.
     * @param {T} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    listenerCount(event: T): number;
    /**
     * Gets an array of all event names that have at least one listener.
     * @returns {T[]} An array of event names.
     */
    eventNames(): T[];
}

// =============================================================================
// GLOBAL MODULE EVENTS
// =============================================================================

/**
 * Defines global module lifecycle events that any module can emit or listen to.
 */
export enum ModuleEvent {
    /** Emitted when a module's initialization process begins. */
    INITIALIZING = 'module-initializing',
    /** Emitted when a module has successfully initialized. */
    INITIALIZED = 'module-initialized',
    /** Emitted when a module's initialization fails. */
    INITIALIZATION_FAILED = 'module-initialization-failed',
    /** Emitted when a module's configuration is updated. */
    CONFIG_UPDATED = 'module-config-updated',
    /** Emitted when a module encounters a general error. */
    ERROR = 'module-error',
    /** Emitted when a module encounters a non-critical issue. */
    WARNING = 'module-warning',
    /** Emitted when a module is destroyed and its resources are cleaned up. */
    DESTROYED = 'module-destroyed',
    /** Emitted when a module's health check passes. */
    HEALTH_CHECK_PASSED = 'module-health-check-passed',
    /** Emitted when a module's health check fails. */
    HEALTH_CHECK_FAILED = 'module-health-check-failed',
    /** Emitted to report a performance metric from a module. */
    PERFORMANCE_METRIC = 'module-performance-metric',
    /** Emitted when a module's operational status changes. */
    STATUS_CHANGED = 'module-status-changed'
}

/**
 * Defines events specific to database connections.
 */
export enum ConnectionEvent {
    /** Emitted when a connection to the database is successfully established. */
    CONNECTED = 'connected',
    /** Emitted when a connection to the database is lost. */
    DISCONNECTED = 'disconnected',
    /** Emitted when an attempt to connect to the database fails. */
    CONNECTION_FAILED = 'connection-failed',
    /** Emitted when a new connection pool is created. */
    POOL_CREATED = 'pool-created',
    /** Emitted when a connection pool is destroyed. */
    POOL_DESTROYED = 'pool-destroyed',
    /** Emitted when a connection is acquired from the pool. */
    CONNECTION_ACQUIRED = 'connection-acquired',
    /** Emitted when a connection is released back to the pool. */
    CONNECTION_RELEASED = 'connection-released',
    /** Emitted when a connection's health check passes. */
    HEALTH_CHECK_PASSED = 'health-check-passed',
    /** Emitted when a connection's health check fails. */
    HEALTH_CHECK_FAILED = 'health-check-failed',
    /** Emitted when a reconnection attempt is initiated. */
    RECONNECT_STARTED = 'reconnect-started',
    /** Emitted when a reconnection attempt succeeds. */
    RECONNECT_SUCCESS = 'reconnect-success',
    /** Emitted when a reconnection attempt fails. */
    RECONNECT_FAILED = 'reconnect-failed',
    /** Emitted when all reconnection attempts have been exhausted. */
    RECONNECT_EXHAUSTED = 'reconnect-exhausted',
    /** Emitted when the circuit breaker opens due to repeated failures. */
    CIRCUIT_BREAKER_OPENED = 'circuit-breaker-opened',
    /** Emitted when the circuit breaker closes after a period of stability. */
    CIRCUIT_BREAKER_CLOSED = 'circuit-breaker-closed'
}

/**
 * Defines events related to the execution of database queries.
 */
export enum QueryEvent {
    /** Emitted when a query execution begins. */
    QUERY_STARTED = 'query-started',
    /** Emitted when a query execution completes successfully. */
    QUERY_COMPLETED = 'query-completed',
    /** Emitted when a query execution fails. */
    QUERY_FAILED = 'query-failed',
    /** Emitted when a query execution times out. */
    QUERY_TIMEOUT = 'query-timeout',
    /** Emitted when a query passes validation checks. */
    QUERY_VALIDATED = 'query-validated',
    /** Emitted when a query fails validation checks. */
    QUERY_VALIDATION_FAILED = 'query-validation-failed',
    /** Emitted when a query result is stored in the cache. */
    QUERY_CACHED = 'query-cached',
    /** Emitted when a query result is successfully retrieved from the cache. */
    QUERY_CACHE_HIT = 'query-cache-hit',
    /** Emitted when a query result is not found in the cache. */
    QUERY_CACHE_MISS = 'query-cache-miss'
}

/**
 * Defines events related to performance monitoring.
 */
export enum PerformanceEvent {
    /** Emitted when a new performance metric is recorded. */
    METRIC_RECORDED = 'metric-recorded',
    /** Emitted when a performance metric exceeds a predefined threshold. */
    THRESHOLD_EXCEEDED = 'threshold-exceeded',
    /** Emitted when a new performance baseline is established. */
    BASELINE_ESTABLISHED = 'baseline-established',
    /** Emitted when a performance report is generated. */
    REPORT_GENERATED = 'report-generated',
    /** Emitted as a warning for high memory usage. */
    MEMORY_WARNING = 'memory-warning',
    /** Emitted as a warning for high CPU usage. */
    CPU_WARNING = 'cpu-warning',
    /** Emitted as a warning for high disk usage. */
    DISK_WARNING = 'disk-warning'
}

// =============================================================================
// EVENT EMITTER IMPLEMENTATION
// =============================================================================

/**
 * A concrete implementation of the ModuleEventEmitter interface.
 * @class ModuleEventEmitterImpl
 * @template T - A union type of all possible event names (e.g., an enum).
 */
export class ModuleEventEmitterImpl<T extends string | number | symbol> implements ModuleEventEmitter<T> {
    /**
     * @private
     * @type {Map<T, Set<ModuleEventListener<T>>>}
     * @description Stores persistent event listeners.
     */
    private eventListeners: Map<T, Set<ModuleEventListener<T>>> = new Map<T, Set<ModuleEventListener<T>>>();
    /**
     * @private
     * @type {Map<T, Set<ModuleEventListener<T>>>}
     * @description Stores one-time event listeners.
     */
    private onceListeners: Map<T, Set<ModuleEventListener<T>>> = new Map<T, Set<ModuleEventListener<T>>>();
    /**
     * @private
     * @type {ModuleLogger | undefined}
     * @description Optional logger for internal event handling.
     */
    private logger?: ModuleLogger;
    /**
     * @private
     * @type {string | undefined}
     * @description The name of the module owning this emitter, for logging context.
     */
    private moduleName?: string;

    /**
     * Creates an instance of ModuleEventEmitterImpl.
     * @param {ModuleLogger} [logger] - An optional logger instance.
     * @param {string} [moduleName] - The name of the module for logging context.
     */
    constructor(logger?: ModuleLogger, moduleName?: string) {
        this.logger = logger;
        this.moduleName = moduleName;
    }

    /**
     * Initializes the event emitter with a predefined set of events.
     * @param {T[]} events - An array of event names to pre-initialize.
     */
    public initializeEvents(events: T[]): void {
        events.forEach(event => {
            this.eventListeners.set(event, new Set());
            this.onceListeners.set(event, new Set());
        });
    }

    /**
     * Adds a listener for a specific event.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener<T>} listener - The callback function to execute.
     */
    public on(event: T, listener: ModuleEventListener<T>): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);

        this.logger?.debug('Event listener added', {
            operation: 'add-event-listener',
            module: this.moduleName,
            event: String(event),
            listenerCount: this.listenerCount(event)
        });
    }

    /**
     * Adds a one-time listener for a specific event.
     * @param {T} event - The event to listen for.
     * @param {ModuleEventListener<T>} listener - The callback function to execute.
     */
    public once(event: T, listener: ModuleEventListener<T>): void {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event)!.add(listener);

        this.logger?.debug('One-time event listener added', {
            operation: 'add-once-event-listener',
            module: this.moduleName,
            event: String(event),
            listenerCount: this.listenerCount(event)
        });
    }

    /**
     * Removes a listener for a specific event.
     * @param {T} event - The event to stop listening to.
     * @param {ModuleEventListener<T>} listener - The specific listener function to remove.
     */
    public off(event: T, listener: ModuleEventListener<T>): void {
        const regularRemoved = this.eventListeners.get(event)?.delete(listener) || false;
        const onceRemoved = this.onceListeners.get(event)?.delete(listener) || false;

        if (regularRemoved || onceRemoved) {
            this.logger?.debug('Event listener removed', {
                operation: 'remove-event-listener',
                module: this.moduleName,
                event: String(event),
                listenerCount: this.listenerCount(event)
            });
        }
    }

    /**
     * Removes all listeners for a specific event, or all listeners from all events if no event is specified.
     * @param {T} [event] - The event to remove all listeners from.
     */
    public removeAllListeners(event?: T): void {
        if (event) {
            const regularCount = this.eventListeners.get(event)?.size || 0;
            const onceCount = this.onceListeners.get(event)?.size || 0;
            
            this.eventListeners.get(event)?.clear();
            this.onceListeners.get(event)?.clear();

            this.logger?.debug('All event listeners removed for event', {
                operation: 'remove-all-event-listeners',
                module: this.moduleName,
                event: String(event),
                removedCount: regularCount + onceCount
            });
        } else {
            const totalListeners = this.getTotalListenerCount();
            
            this.eventListeners.clear();
            this.onceListeners.clear();

            this.logger?.debug('All event listeners removed', {
                operation: 'remove-all-event-listeners',
                module: this.moduleName,
                removedCount: totalListeners
            });
        }
    }

    /**
     * Gets the number of listeners for a specific event.
     * @param {T} event - The event to count listeners for.
     * @returns {number} The number of listeners.
     */
    public listenerCount(event: T): number {
        const regularCount = this.eventListeners.get(event)?.size || 0;
        const onceCount = this.onceListeners.get(event)?.size || 0;
        return regularCount + onceCount;
    }

    /**
     * Gets the total number of listeners across all events.
     * @private
     * @returns {number} The total listener count.
     */
    private getTotalListenerCount(): number {
        let total = 0;
        this.eventListeners.forEach(listeners => total += listeners.size);
        this.onceListeners.forEach(listeners => total += listeners.size);
        return total;
    }

    /**
     * Gets an array of all event names that have at least one listener.
     * @returns {T[]} An array of event names.
     */
    public eventNames(): T[] {
        const events = new Set<T>();
        this.eventListeners.forEach((listeners, event) => {
            if (listeners.size > 0) events.add(event);
        });
        this.onceListeners.forEach((listeners, event) => {
            if (listeners.size > 0) events.add(event);
        });
        return Array.from(events);
    }

    /**
     * Emits an event to all registered listeners for that event.
     * @param {T} event - The event to emit.
     * @param {any} [data] - The data payload to send with the event.
     */
    public emit(event: T, data?: any): void {
        const startTime = Date.now();
        let listenersCalledCount = 0;
        let errorsCount = 0;

        // Enhance data with module context if not present
        const enhancedData = {
            ...data,
            timestamp: data?.timestamp || new Date(),
            source: data?.source || this.moduleName,
        };

        // Handle regular listeners
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event, enhancedData);
                    listenersCalledCount++;
                } catch (error) {
                    errorsCount++;
                    this.logger?.error('Error in event listener', {
                        operation: 'emit-event-error',
                        module: this.moduleName,
                        event: String(event),
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }

        // Handle one-time listeners
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners && onceListeners.size > 0) {
            const listenersToCall = Array.from(onceListeners);
            onceListeners.clear();
            
            listenersToCall.forEach(listener => {
                try {
                    listener(event, enhancedData);
                    listenersCalledCount++;
                } catch (error) {
                    errorsCount++;
                    this.logger?.error('Error in one-time event listener', {
                        operation: 'emit-event-error-once',
                        module: this.moduleName,
                        event: String(event),
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
        }

        const duration = Date.now() - startTime;

        // Log event emission for debugging
        if (listenersCalledCount > 0 || errorsCount > 0) {
            this.logger?.debug('Event emitted', {
                operation: 'emit-event',
                module: this.moduleName,
                event: String(event),
                listenersCount: listenersCalledCount,
                errorsCount,
                duration
            });
        }
    }

    /**
     * Cleans up all listeners, effectively destroying the event emitter.
     */
    public destroy(): void {
        const totalListeners = this.getTotalListenerCount();
        
        this.eventListeners.clear();
        this.onceListeners.clear();

        this.logger?.debug('Event emitter destroyed', {
            operation: 'destroy-event-emitter',
            module: this.moduleName,
            listenersRemoved: totalListeners
        });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a new instance of ModuleEventEmitterImpl, pre-initialized with a set of events.
 * @template T - A union type of all possible event names (e.g., an enum).
 * @param {T[]} events - An array of event names to initialize the emitter with.
 * @param {ModuleLogger} [logger] - An optional logger for the emitter.
 * @param {string} [moduleName] - The name of the module for logging context.
 * @returns {ModuleEventEmitterImpl<T>} A new event emitter instance.
 */
export function createModuleEventEmitter<T extends string | number | symbol>(
    events: T[], 
    logger?: ModuleLogger, 
    moduleName?: string
): ModuleEventEmitterImpl<T> {
    const emitter = new ModuleEventEmitterImpl<T>(logger, moduleName);
    emitter.initializeEvents(events);
    return emitter;
}

/**
 * Creates a standard event data object with common fields like timestamp and source.
 * @template T - The type of the custom data payload.
 * @param {string} type - A string detailing the specific type of the event.
 * @param {T} [data] - The custom data payload for the event.
 * @param {string} [source] - The name of the module that sourced the event.
 * @param {Record<string, any>} [context] - Additional context for the event.
 * @returns {T & BaseEventData} The combined event data object.
 */
export function createEventData<T = any>(
    type: string,
    data?: T,
    source?: string,
    context?: Record<string, any>
): T & BaseEventData {
    return {
        timestamp: new Date(),
        type,
        source,
        context,
        ...data
    } as T & BaseEventData;
}

/**
 * Type guard to check if an object implements the ModuleEventEmitter interface.
 * @param {any} obj - The object to check.
 * @returns {obj is ModuleEventEmitter<any>} True if the object is a valid event emitter, false otherwise.
 */
export function isEventEmitter(obj: any): obj is ModuleEventEmitter<any> {
    return obj && 
           typeof obj.on === 'function' &&
           typeof obj.once === 'function' &&
           typeof obj.off === 'function' &&
           typeof obj.emit === 'function' &&
           typeof obj.removeAllListeners === 'function' &&
           typeof obj.listenerCount === 'function' &&
           typeof obj.eventNames === 'function';
}

// =============================================================================
// EVENT FORWARDING UTILITIES
// =============================================================================

/**
 * Forwards a specified list of events from a source emitter to a target emitter.
 * Can optionally add a prefix to the event names on the target emitter.
 * @template T - The set of possible event types.
 * @param {ModuleEventEmitter<T>} source - The source event emitter.
 * @param {ModuleEventEmitter<T>} target - The target event emitter.
 * @param {T[]} events - An array of event names to forward.
 * @param {string} [prefix] - An optional prefix to add to the event names on the target.
 * @returns {() => void} A cleanup function that removes all the forwarding listeners.
 */
export function forwardEvents<T extends string | number | symbol>(
    source: ModuleEventEmitter<T>,
    target: ModuleEventEmitter<T>,
    events: T[],
    prefix?: string
): () => void {
    const listeners: Array<{ event: T; listener: ModuleEventListener<T> }> = [];

    events.forEach(event => {
        const listener: ModuleEventListener<T> = (evt, data) => {
            const targetEvent = prefix ? `${prefix}-${String(event)}` as T : event;
            target.emit(targetEvent, data);
        };
        
        source.on(event, listener);
        listeners.push({ event, listener });
    });

    // Return cleanup function
    return () => {
        listeners.forEach(({ event, listener }) => {
            source.off(event, listener);
        });
    };
}

/**
 * A singleton class that provides a global event bus for inter-module communication.
 * @class GlobalEventBus
 */
export class GlobalEventBus extends ModuleEventEmitterImpl<string> {
    /**
     * @private
     * @static
     * @type {GlobalEventBus | undefined}
     */
    private static instance?: GlobalEventBus;

    /**
     * @private
     */
    private constructor() {
        super(undefined, 'GlobalEventBus');
    }

    /**
     * Gets the singleton instance of the GlobalEventBus.
     * @static
     * @returns {GlobalEventBus} The singleton instance.
     */
    public static getInstance(): GlobalEventBus {
        if (!GlobalEventBus.instance) {
            GlobalEventBus.instance = new GlobalEventBus();
        }
        return GlobalEventBus.instance;
    }

    /**
     * Subscribes the global event bus to all events from a specific module's emitter.
     * @template T - The set of possible event types for the module.
     * @param {string} moduleName - The name of the module to subscribe to.
     * @param {ModuleEventEmitter<T>} emitter - The event emitter of the module.
     * @returns {() => void} A cleanup function to unsubscribe from the module's events.
     */
    public subscribeToModule<T extends string | number | symbol>(
        moduleName: string,
        emitter: ModuleEventEmitter<T>
    ): () => void {
        const events = emitter.eventNames();
        return forwardEvents(emitter, this as any, events, moduleName);
    }

    /**
     * Emits an event on the global event bus.
     * @param {string} event - The name of the global event to emit.
     * @param {any} [data] - The data payload for the event.
     */
    public emitGlobal(event: string, data?: any): void {
        this.emit(event, {
            ...data,
            timestamp: new Date(),
            source: 'GlobalEventBus',
            type: 'global-event'
        });
    }
}

/**
 * The singleton instance of the GlobalEventBus.
 * @type {GlobalEventBus}
 */
export const globalEventBus = GlobalEventBus.getInstance();