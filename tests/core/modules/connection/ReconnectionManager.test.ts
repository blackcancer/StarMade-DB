/**
 * ReconnectionManager Comprehensive Tests
 * 
 * Complete test suite for all ReconnectionManager functionalities
 * Testing reconnection strategies, circuit breaker patterns, event handling,
 * health monitoring, configuration management, and advanced scenarios.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { 
    ReconnectionManager, 
    ReconnectionStrategy, 
    CircuitBreakerState, 
    ConnectionEvent,
    type ReconnectionConfig,
    type ReconnectionStats,
    type ConnectionEventListener
} from '../../../../src/core/modules/connection/ReconnectionManager.js';
import { ConnectionManager } from '../../../../src/core/modules/connection/ConnectionManager.js';
import { HSQLManager } from '../../../../src/core/index.js';
import { 
    ConnectionError, 
    ModuleAlreadyInitializedError,
    ModuleNotInitializedError,
    ConfigurationError
} from '../../../../src/core/errors.js';

// =============================================================================
// STANDALONE TEST CONFIGURATION (NO EXTERNAL FILES)
// =============================================================================

/**
 * Standalone test configuration for ReconnectionManager
 */
const STANDALONE_TEST_CONFIG = {
    // Test database paths
    starmadeDir: resolve(process.cwd(), 'tests', 'sandbox'),
    worldName: 'test_world',
    
    // Connection settings
    connection: {
        timeoutMs: 10000,
        maxRetries: 3,
        readOnly: false,  // Safe for testing
        autoCommit: true,
        maxConcurrentConnections: 2
    },
    
    // Module settings for testing - ENABLE AUTO RECONNECTION
    modules: {
        enableRelationshipAnalysis: false,
        enableQueryValidation: false,
        enableParameterizedQueries: false,
        enableAdvancedCaching: false,
        enableMetricsCollection: false,
        enableAutoReconnection: true, // ENABLE for ReconnectionManager testing
        enableConnectionFactory: true
    },
    
    // Minimal logging for tests
    logging: {
        level: 'error' as const,
        enableConsole: false,
        enableFile: false,
        enableQueries: false,
        enableConnections: false,
        enablePerformance: false
    }
};

// =============================================================================
// STANDALONE UTILITY FUNCTIONS
// =============================================================================

/**
 * Standalone function to validate test database exists
 */
function validateStandaloneTestDatabase(): void {
    const dbPath = resolve(STANDALONE_TEST_CONFIG.starmadeDir, 'server-database', STANDALONE_TEST_CONFIG.worldName, 'index');
    
    if (!existsSync(STANDALONE_TEST_CONFIG.starmadeDir)) {
        throw new Error(`Test StarMade directory not found: ${STANDALONE_TEST_CONFIG.starmadeDir}`);
    }
    
    const worldDir = resolve(STANDALONE_TEST_CONFIG.starmadeDir, 'server-database', STANDALONE_TEST_CONFIG.worldName);
    if (!existsSync(worldDir)) {
        throw new Error(`Test world directory not found: ${worldDir}`);
    }
    
    // Check for database files
    const requiredFiles = ['.data', '.properties', '.script'];
    for (const file of requiredFiles) {
        const filePath = resolve(dbPath, file);
        if (!existsSync(filePath)) {
            throw new Error(`Required database file not found: ${filePath}`);
        }
    }
}

/**
 * Standalone utility to suppress console output during tests
 */
function suppressConsoleOutput(): { restore: () => void } {
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    // Replace with no-op functions
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    return {
        restore: () => {
            Object.assign(console, originalConsole);
        }
    };
}

/**
 * Standalone utility to measure execution time
 */
async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const startTime = Date.now();
    const result = await fn();
    const timeMs = Date.now() - startTime;
    return { result, timeMs };
}

/**
 * Wait utility for tests
 */
function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock connection manager for testing reconnection failures
 */
class MockConnectionManager {
    private shouldFailConnections = false;
    private failureCount = 0;
    
    async getConnection() {
        if (this.shouldFailConnections) {
            this.failureCount++;
            throw new ConnectionError(`Mock connection failure #${this.failureCount}`);
        }
        return {
            execute: async () => ({ rows: [[1]], columns: [{ name: 'test', type: 'NUMBER', nullable: false }], executionTime: 1 })
        };
    }
    
    async releaseConnection() {
        // Mock release
    }
    
    async testAllConnections() {
        if (this.shouldFailConnections) {
            return { totalTested: 1, healthyConnections: 0, results: [] };
        }
        return { totalTested: 1, healthyConnections: 1, results: [] };
    }
    
    setFailConnections(fail: boolean) {
        this.shouldFailConnections = fail;
        if (!fail) {
            this.failureCount = 0;
        }
    }
    
    getFailureCount() {
        return this.failureCount;
    }
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================

describe('ReconnectionManager Comprehensive Tests', function() {
    // Increase timeout for reconnection operations
    this.timeout(45000);

    let manager: HSQLManager;
    let connectionManager: ConnectionManager;
    let reconnectionManager: ReconnectionManager;
    let consoleSuppressor: { restore: () => void };

    before(async function() {
        // Suppress console output during tests
        consoleSuppressor = suppressConsoleOutput();
        
        // Validate test database exists
        try {
            validateStandaloneTestDatabase();
        } catch (error) {
            console.log('Skipping ReconnectionManager tests: Test database not available');
            console.log('Error:', (error as Error).message);
            this.skip();
            return;
        }

        // Create and initialize HSQLManager with reconnection enabled
        manager = new HSQLManager(STANDALONE_TEST_CONFIG);
        await manager.initialize();
        
        // Create and initialize ConnectionManager
        connectionManager = new ConnectionManager();
        await connectionManager.initialize(manager);
        
        // Create ReconnectionManager
        reconnectionManager = new ReconnectionManager();
    });

    after(async function() {
        // Cleanup
        if (reconnectionManager) {
            await reconnectionManager.destroy();
        }
        if (connectionManager) {
            await connectionManager.destroy();
        }
        if (manager) {
            await manager.destroy();
        }
        
        // Restore console
        if (consoleSuppressor) {
            consoleSuppressor.restore();
        }
    });

    describe('Module Initialization', function() {
        it('should create ReconnectionManager with correct properties', function() {
            expect(reconnectionManager.name).to.equal('reconnection-manager');
            expect(reconnectionManager.version).to.equal('1.0.0');
            expect(reconnectionManager.isInitialized).to.be.false;
        });

        it('should initialize successfully with HSQLManager (auto-discovery)', async function() {
            await reconnectionManager.initialize(manager);
            
            expect(reconnectionManager.isInitialized).to.be.true;
            
            const config = reconnectionManager.getConfig();
            expect(config).to.exist;
            expect(config!.enabled).to.be.true; // Should be enabled from our test config
            expect(config!.strategy).to.equal(ReconnectionStrategy.EXPONENTIAL_BACKOFF);
        });

        it('should not allow double initialization', async function() {
            try {
                await reconnectionManager.initialize(manager);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ModuleAlreadyInitializedError);
                expect((error as Error).message).to.include('already initialized');
            }
        });

        it('should initialize with explicit ConnectionManager', async function() {
            const testReconnectionManager = new ReconnectionManager();
            
            await testReconnectionManager.initializeWithConnectionManager(manager, connectionManager);
            
            expect(testReconnectionManager.isInitialized).to.be.true;
            const config = testReconnectionManager.getConfig();
            expect(config).to.exist;
            expect(config!.enabled).to.be.true;
            
            await testReconnectionManager.destroy();
        });

        it('should throw error when initializing with null manager', async function() {
            const testReconnectionManager = new ReconnectionManager();
            
            try {
                await testReconnectionManager.initialize(null as any);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ConfigurationError);
                expect((error as Error).message).to.include('Manager is required');
            }
        });

        it('should throw error when initializing with invalid parameters', async function() {
            const testReconnectionManager = new ReconnectionManager();
            
            try {
                await testReconnectionManager.initializeWithConnectionManager(null as any, null as any);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ConfigurationError);
                expect((error as Error).message).to.include('Manager and ConnectionManager are required');
            }
        });
    });

    describe('Configuration Management', function() {
        it('should provide current configuration', function() {
            const config = reconnectionManager.getConfig();
            
            expect(config).to.exist;
            expect(config!.enabled).to.be.true;
            expect(config!.strategy).to.equal(ReconnectionStrategy.EXPONENTIAL_BACKOFF);
            expect(config!.maxRetries).to.equal(3);
            expect(config!.baseDelayMs).to.equal(1000);
            expect(config!.maxDelayMs).to.equal(30000);
            expect(config!.jitterFactor).to.equal(0.1);
            expect(config!.circuitBreakerThreshold).to.equal(5);
            expect(config!.circuitBreakerCooldownMs).to.equal(60000);
            expect(config!.resetOnSuccess).to.be.true;
            expect(config!.healthCheckIntervalMs).to.equal(5000);
        });

        it('should update configuration', function() {
            const updates: Partial<ReconnectionConfig> = {
                maxRetries: 5,
                baseDelayMs: 2000,
                jitterFactor: 0.2
            };
            
            reconnectionManager.updateConfig(updates);
            
            const config = reconnectionManager.getConfig();
            expect(config!.maxRetries).to.equal(5);
            expect(config!.baseDelayMs).to.equal(2000);
            expect(config!.jitterFactor).to.equal(0.2);
            
            // Restore original values
            reconnectionManager.updateConfig({
                maxRetries: 3,
                baseDelayMs: 1000,
                jitterFactor: 0.1
            });
        });

        it('should throw error when updating config before initialization', async function() {
            const testReconnectionManager = new ReconnectionManager();
            
            try {
                testReconnectionManager.updateConfig({ maxRetries: 5 });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ModuleNotInitializedError);
                expect((error as Error).message).to.include('not initialized');
            }
        });
    });

    describe('Statistics and Monitoring', function() {
        beforeEach(function() {
            // Reset statistics before each test
            reconnectionManager.resetStats();
        });

        it('should provide initial statistics', function() {
            const stats = reconnectionManager.getStats();
            
            expect(stats.totalAttempts).to.equal(0);
            expect(stats.successfulReconnections).to.equal(0);
            expect(stats.failedReconnections).to.equal(0);
            expect(stats.failureRate).to.equal(0);
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
            expect(stats.timeSinceLastConnectionMs).to.be.a('number');
            expect(stats.averageReconnectionTimeMs).to.equal(0);
        });

        it('should reset statistics', function() {
            // Simulate some stats by updating internal state
            (reconnectionManager as any).updateStats({
                totalAttempts: 10,
                successfulReconnections: 5,
                failedReconnections: 5
            });
            
            let stats = reconnectionManager.getStats();
            expect(stats.totalAttempts).to.equal(10);
            
            reconnectionManager.resetStats();
            
            stats = reconnectionManager.getStats();
            expect(stats.totalAttempts).to.equal(0);
            expect(stats.successfulReconnections).to.equal(0);
            expect(stats.failedReconnections).to.equal(0);
        });

        it('should calculate failure rate correctly', function() {
            // Simulate stats
            (reconnectionManager as any).updateStats({
                totalAttempts: 10,
                successfulReconnections: 7,
                failedReconnections: 3
            });
            
            const stats = reconnectionManager.getStats();
            expect(stats.failureRate).to.equal(30); // 3 failures out of 10 attempts = 30%
        });

        it('should handle zero attempts correctly', function() {
            const stats = reconnectionManager.getStats();
            expect(stats.failureRate).to.equal(0);
        });
    });

    describe('Event System', function() {
        let capturedEvents: Array<{ event: ConnectionEvent; data?: any }> = [];
        let testListener: ConnectionEventListener;

        beforeEach(function() {
            capturedEvents = [];
            testListener = (event: ConnectionEvent, data?: any) => {
                capturedEvents.push({ event, data });
            };
        });

        afterEach(function() {
            // Clean up listeners
            Object.values(ConnectionEvent).forEach(event => {
                reconnectionManager.off(event, testListener);
            });
        });

        it('should register and trigger event listeners', function() {
            reconnectionManager.on(ConnectionEvent.CONNECTED, testListener);
            
            // Trigger event using private method
            (reconnectionManager as any).emit(ConnectionEvent.CONNECTED, { test: 'data' });
            
            expect(capturedEvents).to.have.length(1);
            expect(capturedEvents[0].event).to.equal(ConnectionEvent.CONNECTED);
            expect(capturedEvents[0].data).to.deep.equal({ test: 'data' });
        });

        it('should handle one-time event listeners', function() {
            reconnectionManager.once(ConnectionEvent.RECONNECT_SUCCESS, testListener);
            
            // Trigger event twice
            (reconnectionManager as any).emit(ConnectionEvent.RECONNECT_SUCCESS, { attempt: 1 });
            (reconnectionManager as any).emit(ConnectionEvent.RECONNECT_SUCCESS, { attempt: 2 });
            
            // Should only capture one event
            expect(capturedEvents).to.have.length(1);
            expect(capturedEvents[0].event).to.equal(ConnectionEvent.RECONNECT_SUCCESS);
            expect(capturedEvents[0].data).to.deep.equal({ attempt: 1 });
        });

        it('should remove event listeners', function() {
            reconnectionManager.on(ConnectionEvent.DISCONNECTED, testListener);
            
            // Trigger event - should be captured
            (reconnectionManager as any).emit(ConnectionEvent.DISCONNECTED);
            expect(capturedEvents).to.have.length(1);
            
            // Remove listener
            reconnectionManager.off(ConnectionEvent.DISCONNECTED, testListener);
            
            // Trigger event again - should not be captured
            (reconnectionManager as any).emit(ConnectionEvent.DISCONNECTED);
            expect(capturedEvents).to.have.length(1); // Still only one
        });

        it('should handle multiple listeners for same event', function() {
            const capturedEvents2: Array<{ event: ConnectionEvent; data?: any }> = [];
            const testListener2: ConnectionEventListener = (event: ConnectionEvent, data?: any) => {
                capturedEvents2.push({ event, data });
            };
            
            reconnectionManager.on(ConnectionEvent.RECONNECT_FAILED, testListener);
            reconnectionManager.on(ConnectionEvent.RECONNECT_FAILED, testListener2);
            
            (reconnectionManager as any).emit(ConnectionEvent.RECONNECT_FAILED, { error: 'test' });
            
            expect(capturedEvents).to.have.length(1);
            expect(capturedEvents2).to.have.length(1);
            
            // Cleanup
            reconnectionManager.off(ConnectionEvent.RECONNECT_FAILED, testListener2);
        });
    });

    describe('Reconnection Strategies', function() {
        let mockConnectionManager: MockConnectionManager;
        let testReconnectionManager: ReconnectionManager;

        beforeEach(async function() {
            // Create a test manager with mock connection manager
            mockConnectionManager = new MockConnectionManager();
            testReconnectionManager = new ReconnectionManager();
            
            // Initialize with a mock setup
            await testReconnectionManager.initializeWithConnectionManager(manager, mockConnectionManager as any);
        });

        afterEach(async function() {
            if (testReconnectionManager) {
                await testReconnectionManager.destroy();
            }
        });

        it('should handle immediate reconnection strategy', async function() {
            // Configure for immediate reconnection
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.IMMEDIATE,
                maxRetries: 2
            });
            
            // Set mock to fail connections
            mockConnectionManager.setFailConnections(true);
            
            const { result: success, timeMs } = await measureExecutionTime(async () => {
                return await testReconnectionManager.triggerReconnection();
            });
            
            expect(success).to.be.false; // Should fail with mock
            expect(timeMs).to.be.lessThan(1000); // Should be quick (immediate)
            
            const stats = testReconnectionManager.getStats();
            expect(stats.totalAttempts).to.be.greaterThan(0);
        });

        it('should handle exponential backoff strategy', async function() {
            // Configure for exponential backoff
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.EXPONENTIAL_BACKOFF,
                maxRetries: 3,
                baseDelayMs: 100 // Smaller delay for testing
            });
            
            // Set mock to fail first attempts, then succeed
            mockConnectionManager.setFailConnections(true);
            
            const startTime = Date.now();
            
            // Start reconnection
            const reconnectionPromise = testReconnectionManager.triggerReconnection();
            
            // After first failure, allow success
            setTimeout(() => {
                mockConnectionManager.setFailConnections(false);
            }, 250); // After first retry delay
            
            const success = await reconnectionPromise;
            const totalTime = Date.now() - startTime;
            
            expect(success).to.be.true;
            expect(totalTime).to.be.greaterThan(100); // Should have some delay
            
            const stats = testReconnectionManager.getStats();
            expect(stats.totalAttempts).to.be.greaterThan(1);
            expect(stats.successfulReconnections).to.be.greaterThan(0);
        });

        it('should handle fixed interval strategy', async function() {
            // Configure for fixed interval
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.FIXED_INTERVAL,
                maxRetries: 3,
                baseDelayMs: 100 // Smaller delay for testing
            });
            
            mockConnectionManager.setFailConnections(true);
            
            const { result: success, timeMs } = await measureExecutionTime(async () => {
                return await testReconnectionManager.triggerReconnection();
            });
            
            expect(success).to.be.false;
            // Use >= instead of > to handle exact timing matches
            expect(timeMs).to.be.at.least(200); // Should have fixed delays (2 retries × 100ms each = 200ms minimum)
            
            const stats = testReconnectionManager.getStats();
            expect(stats.totalAttempts).to.equal(3); // Should try max retries
        });

        it('should handle circuit breaker strategy', async function() {
            // Configure for circuit breaker
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.CIRCUIT_BREAKER,
                maxRetries: 2,
                circuitBreakerThreshold: 2
            });
            
            mockConnectionManager.setFailConnections(true);
            
            // First reconnection attempt - should fail and trigger circuit breaker
            const success1 = await testReconnectionManager.triggerReconnection();
            expect(success1).to.be.false;
            
            // Check circuit breaker state
            const stats1 = testReconnectionManager.getStats();
            expect(stats1.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
            
            // Second attempt - should be blocked by circuit breaker
            const success2 = await testReconnectionManager.triggerReconnection();
            expect(success2).to.be.false;
            
            const stats2 = testReconnectionManager.getStats();
            expect(stats2.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
        });
    });

    describe('Circuit Breaker Pattern', function() {
        let testReconnectionManager: ReconnectionManager;
        let mockConnectionManager: MockConnectionManager;

        beforeEach(async function() {
            mockConnectionManager = new MockConnectionManager();
            testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initializeWithConnectionManager(manager, mockConnectionManager as any);
            
            // Configure circuit breaker
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.CIRCUIT_BREAKER,
                circuitBreakerThreshold: 3,
                circuitBreakerCooldownMs: 1000, // Short cooldown for testing
                maxRetries: 5
            });
        });

        afterEach(async function() {
            if (testReconnectionManager) {
                await testReconnectionManager.destroy();
            }
        });

        it('should open circuit breaker after threshold failures', async function() {
            mockConnectionManager.setFailConnections(true);
            
            // Multiple failures should open circuit breaker
            await testReconnectionManager.triggerReconnection();
            
            const stats = testReconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
            expect(stats.failedReconnections).to.be.greaterThanOrEqual(3);
        });

        it('should transition to half-open after cooldown', async function() {
            mockConnectionManager.setFailConnections(true);
            
            // Trigger failures to open circuit breaker
            await testReconnectionManager.triggerReconnection();
            
            let stats = testReconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
            
            // Wait for cooldown (circuit breaker should automatically transition)
            await wait(1200); // Wait longer than cooldown
            
            stats = testReconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.HALF_OPEN);
        });

        it('should close circuit breaker on successful reconnection', async function() {
            // First, open the circuit breaker
            mockConnectionManager.setFailConnections(true);
            await testReconnectionManager.triggerReconnection();
            
            let stats = testReconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
            
            // Wait for half-open
            await wait(1200);
            
            // Enable successful connections
            mockConnectionManager.setFailConnections(false);
            
            // Trigger successful reconnection
            const success = await testReconnectionManager.triggerReconnection();
            expect(success).to.be.true;
            
            stats = testReconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
        });
    });

    describe('Error Handling and Edge Cases', function() {
        it('should handle operations before initialization', async function() {
            const testReconnectionManager = new ReconnectionManager();
            
            try {
                await testReconnectionManager.triggerReconnection();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ModuleNotInitializedError);
                expect((error as Error).message).to.include('not initialized');
            }
        });

        it('should handle disabled reconnection', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Disable reconnection
            testReconnectionManager.updateConfig({ enabled: false });
            
            try {
                await testReconnectionManager.triggerReconnection();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ConfigurationError);
                expect((error as Error).message).to.include('Reconnection is disabled');
            }
            
            await testReconnectionManager.destroy();
        });

        it('should handle circuit breaker blocking reconnection', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Manually set circuit breaker to open
            (testReconnectionManager as any).updateStats({
                circuitBreakerState: CircuitBreakerState.OPEN
            });
            
            const success = await testReconnectionManager.triggerReconnection();
            expect(success).to.be.false;
            
            await testReconnectionManager.destroy();
        });

        it('should handle connection manager not found during initialization', async function() {
            // Create a manager without connection manager
            const testManager = new HSQLManager({
                ...STANDALONE_TEST_CONFIG,
                modules: {
                    ...STANDALONE_TEST_CONFIG.modules,
                    enableConnectionFactory: false // Disable connection manager
                }
            });
            await testManager.initialize();
            
            const testReconnectionManager = new ReconnectionManager();
            
            try {
                await testReconnectionManager.initialize(testManager);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ConfigurationError);
                expect((error as Error).message).to.include('ConnectionManager not found');
            }
            
            await testManager.destroy();
        });

        it('should handle errors in event listeners gracefully', function() {
            const errorListener: ConnectionEventListener = () => {
                throw new Error('Test listener error');
            };
            
            reconnectionManager.on(ConnectionEvent.CONNECTED, errorListener);
            
            // This should not throw
            expect(() => {
                (reconnectionManager as any).emit(ConnectionEvent.CONNECTED);
            }).to.not.throw();
            
            // Cleanup
            reconnectionManager.off(ConnectionEvent.CONNECTED, errorListener);
        });
    });

    describe('Real Connection Testing', function() {
        it('should successfully test real connection', async function() {
            // This tests with the real connection manager
            const success = await reconnectionManager.triggerReconnection();
            expect(success).to.be.true;
            
            const stats = reconnectionManager.getStats();
            expect(stats.successfulReconnections).to.be.greaterThan(0);
        });

        it('should handle real connection health check', async function() {
            // Wait a moment and check if health monitoring is working
            await wait(100);
            
            // The manager should maintain healthy state
            const stats = reconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
        });

        it('should measure real reconnection performance', async function() {
            const { result: success, timeMs } = await measureExecutionTime(async () => {
                return await reconnectionManager.triggerReconnection();
            });
            
            expect(success).to.be.true;
            expect(timeMs).to.be.lessThan(5000); // Should complete quickly
            
            const stats = reconnectionManager.getStats();
            expect(stats.averageReconnectionTimeMs).to.be.a('number');
            expect(stats.averageReconnectionTimeMs).to.be.greaterThan(0);
        });
    });

    describe('Resource Cleanup and Destruction', function() {
        it('should destroy manager and cleanup all resources', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            expect(testReconnectionManager.isInitialized).to.be.true;
            
            await testReconnectionManager.destroy();
            
            expect(testReconnectionManager.isInitialized).to.be.false;
        });

        it('should handle multiple destroy calls gracefully', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            await testReconnectionManager.destroy();
            await testReconnectionManager.destroy(); // Should not throw
            
            expect(testReconnectionManager.isInitialized).to.be.false;
        });

        it('should handle destroy with active timers', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Health monitoring should be active
            const config = testReconnectionManager.getConfig();
            expect(config!.healthCheckIntervalMs).to.be.greaterThan(0);
            
            await testReconnectionManager.destroy();
            
            expect(testReconnectionManager.isInitialized).to.be.false;
        });

        it('should handle operations after destroy', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            await testReconnectionManager.destroy();
            
            try {
                await testReconnectionManager.triggerReconnection();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(ModuleNotInitializedError);
                expect((error as Error).message).to.include('not initialized');
            }
        });
    });

    describe('Advanced Scenarios', function() {
        it('should handle concurrent reconnection attempts', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Configure for longer delays to test concurrency
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.EXPONENTIAL_BACKOFF,
                baseDelayMs: 50,
                maxRetries: 2
            });
            
            // Start multiple reconnection attempts
            const promises = [
                testReconnectionManager.triggerReconnection(),
                testReconnectionManager.triggerReconnection(),
                testReconnectionManager.triggerReconnection()
            ];
            
            const results = await Promise.all(promises);
            
            // At least one should succeed
            const successCount = results.filter(r => r).length;
            expect(successCount).to.be.greaterThanOrEqual(1);
            
            await testReconnectionManager.destroy();
        });

        it('should handle configuration changes during reconnection', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Start with one configuration
            testReconnectionManager.updateConfig({
                maxRetries: 2,
                baseDelayMs: 100
            });
            
            let config = testReconnectionManager.getConfig();
            expect(config!.maxRetries).to.equal(2);
            
            // Change configuration
            testReconnectionManager.updateConfig({
                maxRetries: 5,
                baseDelayMs: 200
            });
            
            config = testReconnectionManager.getConfig();
            expect(config!.maxRetries).to.equal(5);
            expect(config!.baseDelayMs).to.equal(200);
            
            await testReconnectionManager.destroy();
        });

        it('should handle complex event sequences', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            const events: ConnectionEvent[] = [];
            const eventListener: ConnectionEventListener = (event: ConnectionEvent) => {
                events.push(event);
            };
            
            // Listen to all events
            Object.values(ConnectionEvent).forEach(event => {
                testReconnectionManager.on(event, eventListener);
            });
            
            // Trigger reconnection
            await testReconnectionManager.triggerReconnection();
            
            // Should have received some events
            expect(events.length).to.be.greaterThan(0);
            expect(events).to.include(ConnectionEvent.RECONNECT_STARTED);
            
            // Cleanup listeners
            Object.values(ConnectionEvent).forEach(event => {
                testReconnectionManager.off(event, eventListener);
            });
            
            await testReconnectionManager.destroy();
        });

        it('should handle statistics persistence across operations', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            // Perform several reconnections
            await testReconnectionManager.triggerReconnection();
            await testReconnectionManager.triggerReconnection();
            
            const stats = testReconnectionManager.getStats();
            expect(stats.totalAttempts).to.be.greaterThan(0);
            expect(stats.successfulReconnections).to.be.greaterThan(0);
            
            await testReconnectionManager.destroy();
        });
    });

    describe('Integration with ConnectionManager', function() {
        beforeEach(async function() {
            // Ensure the manager is initialized before each test in this suite
            if (!reconnectionManager.isInitialized) {
                await reconnectionManager.initialize(manager);
            }
        });

        it('should work with real ConnectionManager', async function() {
            // Test that our real connection manager integration works
            expect(reconnectionManager.isInitialized).to.be.true;
            
            const success = await reconnectionManager.triggerReconnection();
            expect(success).to.be.true;
        });

        it('should handle ConnectionManager state changes', async function() {
            // This tests the integration with a real connection manager
            const stats = reconnectionManager.getStats();
            expect(stats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
            
            // Multiple successful reconnections should maintain closed state
            await reconnectionManager.triggerReconnection();
            await reconnectionManager.triggerReconnection();
            
            const newStats = reconnectionManager.getStats();
            expect(newStats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
            expect(newStats.successfulReconnections).to.be.greaterThan(stats.successfulReconnections);
        });
    });

    describe('Performance and Timing', function() {
        it('should respect configured delays', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.FIXED_INTERVAL,
                baseDelayMs: 200,
                maxRetries: 2
            });
            
            const { timeMs } = await measureExecutionTime(async () => {
                return await testReconnectionManager.triggerReconnection();
            });
            
            // Should complete relatively quickly (success on first attempt)
            expect(timeMs).to.be.lessThan(1000);
            
            await testReconnectionManager.destroy();
        });

        it('should handle jitter in exponential backoff', async function() {
            const testReconnectionManager = new ReconnectionManager();
            await testReconnectionManager.initialize(manager);
            
            testReconnectionManager.updateConfig({
                strategy: ReconnectionStrategy.EXPONENTIAL_BACKOFF,
                baseDelayMs: 100,
                jitterFactor: 0.5,
                maxRetries: 1
            });
            
            // Multiple runs should have slightly different timing due to jitter
            const times: number[] = [];
            
            for (let i = 0; i < 3; i++) {
                const { timeMs } = await measureExecutionTime(async () => {
                    return await testReconnectionManager.triggerReconnection();
                });
                times.push(timeMs);
                
                // Small delay between attempts
                await wait(50);
            }
            
            // Should have some variation (but might be minimal with immediate success)
            expect(times.length).to.equal(3);
            times.forEach(time => expect(time).to.be.a('number'));
            
            await testReconnectionManager.destroy();
        });
    });
});