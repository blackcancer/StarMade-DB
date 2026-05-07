/**
 * @fileoverview Global Mocha root hooks
 *
 * Forces process exit after all tests complete to terminate the JVM thread
 * kept alive by the node-java JDBC bridge.
 */

export const mochaHooks = {
    afterAll(this: Mocha.Context, done: Mocha.Done) {
        // Give the JVM 2 seconds to cleanup, then force exit
        setTimeout(() => {
            process.exit(0);
        }, 2000);
        done();
    }
};
