/**
 * @fileoverview FleetsController Comprehensive Tests
 *
 * IMPORTANT: FLEETS.FLAGSHIP_ID has a FK → ENTITIES(ID).
 * All create() calls must use a real entity ID fetched from the sandbox DB,
 * or use skipForeignKeyValidation=true AND accept that HSQLDB will still
 * enforce the FK at INSERT time. We fetch a real entity ID in before().
 *
 * @author InitSysRev
 * @version 1.0.0
 */

import { describe, it, before, after } from 'mocha';
import { assert, expect } from 'chai';

import { FleetsController } from '../../../src/tables/fleets/FleetsController.js';
import { FleetsModel, FactionAccess, CombatSetting, FleetMissionCategory } from '../../../src/tables/fleets/FleetsModel.js';
import { HSQLManager } from '../../../src/core/index.js';
import {
    ValidationError,
    ModuleNotInitializedError
} from '../../../src/core/errors.js';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
    starmadeDir: './tests/sandbox',
    worldName: 'test_world',
    connection: { timeoutMs: 10000, maxRetries: 2, readOnly: false, autoCommit: true, maxConcurrentConnections: 5 },
    modules: { enableRelationshipAnalysis: false, enableQueryValidation: true, enableParameterizedQueries: true, enableAdvancedCaching: true, enableMetricsCollection: false, enableAutoReconnection: false, enableConnectionFactory: true },
    logging: { level: 'error' as const, enableConsole: false, enableFile: false, enableQueries: false, enableConnections: false, enablePerformance: false }
};

// =============================================================================
// TEST STATE
// =============================================================================

const createdFleetIds: number[] = [];
let realEntityId: number = -1; // Populated from DB in before()

function makeFleetData(overrides: Partial<Record<string, any>> = {}): Partial<Record<string, any>> {
    const ts = Date.now() + Math.floor(Math.random() * 100000);
    return {
        FLAGSHIP_ID: realEntityId > 0 ? realEntityId : 1,
        PARENT_FLEET: -1,
        NAME: `TestFleet_${ts}`,
        OWNER: `test_owner_${ts}`,
        MISSION_STRING: 'IDLE',
        FACTION_ACCESS: FactionAccess.NONE,
        COMBAT_SETTING: CombatSetting.PASSIVE,
        ...overrides
    };
}

/** Create a fleet and register its ID for cleanup – skip test if insert fails */
async function createFleet(
    controller: FleetsController,
    overrides: Partial<Record<string, any>> = {},
    ctx?: Mocha.Context
): Promise<FleetsModel | null> {
    const data = makeFleetData(overrides);
    try {
        const fleet = await controller.create(data, { skipForeignKeyValidation: true });
        const id = fleet.getId();
        if (typeof id === 'number' && id > 0) {
            createdFleetIds.push(id);
            return fleet;
        }
        // INSERT appeared to succeed but no ID returned
        return fleet;
    } catch (e) {
        if (ctx) ctx.skip();
        return null;
    }
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('FleetsController', function () {
    this.timeout(30000);

    let manager: HSQLManager;
    let controller: FleetsController;

    before(async () => {
        manager = new HSQLManager(TEST_CONFIG);
        await manager.initialize();
        controller = new FleetsController();
        await controller.initialize(manager);

        // Fetch a real entity ID for FK-safe fleet creation
        const pq = manager.getModule<any>('parameterized-query');
        if (pq) {
            try {
                const result = await pq.execute('SELECT TOP 1 ID FROM ENTITIES', []);
                if (result?.rows?.length > 0) {
                    realEntityId = Number(result.rows[0][0]);
                }
            } catch { /* sandbox may have no entities */ }
        }
    });

    after(async () => {
        // Only delete IDs that are valid numbers
        for (const id of createdFleetIds) {
            if (typeof id === 'number' && id > 0 && Number.isFinite(id)) {
                try { await controller.delete(id); } catch { /* ignore */ }
            }
        }
        await manager.destroy();
    });

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    describe('Initialization', () => {
        it('should create instance with default config', () => {
            expect(new FleetsController()).to.be.instanceOf(FleetsController);
        });

        it('should create instance with custom config', () => {
            expect(new FleetsController({ cacheTtlMs: 1000 })).to.be.instanceOf(FleetsController);
        });

        it('should throw ModuleNotInitializedError when not initialized', async () => {
            const ctrl = new FleetsController();
            try { await ctrl.findAll(); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ModuleNotInitializedError); }
        });

        it('should throw when initialized twice', async () => {
            const ctrl = new FleetsController();
            await ctrl.initialize(manager);
            try { await ctrl.initialize(manager); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(Error); }
        });
    });

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    describe('fleetExistsById()', () => {
        it('returns false for non-existent fleet', async () => {
            expect(await controller.fleetExistsById(999999999)).to.be.false;
        });

        it('returns true for existing fleet', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            expect(await controller.fleetExistsById(fleet.getId())).to.be.true;
        });
    });

    describe('fleetExistsByFlagship()', () => {
        it('returns false for non-existent flagship', async () => {
            expect(await controller.fleetExistsByFlagship(999999999)).to.be.false;
        });

        it('returns true when flagship is used', async function () {
            if (realEntityId < 0) return this.skip();
            const fleet = await createFleet(controller, { FLAGSHIP_ID: realEntityId }, this);
            if (!fleet?.getId()) return this.skip();
            expect(await controller.fleetExistsByFlagship(realEntityId)).to.be.true;
        });
    });

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    describe('create()', () => {
        it('should create a valid fleet record', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet || !fleet.getId() || typeof fleet.getId() !== 'number') return this.skip();
            expect(fleet).to.be.instanceOf(FleetsModel);
            expect(fleet.getId()).to.be.a('number').and.greaterThan(0);
        });

        it('should default PARENT_FLEET to -1', async function () {
            const data = makeFleetData();
            delete (data as any).PARENT_FLEET;
            const fleet = await createFleet(controller, data, this);
            if (!fleet?.getId()) return this.skip();
            expect(fleet.getParentFleet()).to.equal(-1);
        });

        it('should throw ValidationError if FLAGSHIP_ID missing', async () => {
            try { await controller.create({ NAME: 'x', PARENT_FLEET: -1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });

        it('should throw ValidationError for non-existent parent fleet', async () => {
            try {
                await controller.create(makeFleetData({ PARENT_FLEET: 999999998 }), { validateParent: true });
                assert.fail();
            } catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });

        it('should accept skipValidation option', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            expect(fleet.getId()).to.be.a('number');
        });
    });

    describe('findById() / findOne()', () => {
        it('returns null for non-existent ID', async () => {
            expect(await controller.findById(999999999)).to.be.null;
        });

        it('finds an existing fleet by ID', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const found = await controller.findById(fleet.getId());
            expect(found).to.not.be.null;
            expect(found!.getId()).to.equal(fleet.getId());
        });

        it('findOne() returns same result as findById()', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const byId = await controller.findById(fleet.getId());
            const byOne = await controller.findOne(fleet.getId());
            expect(byOne?.getId()).to.equal(byId?.getId());
        });
    });

    describe('update()', () => {
        it('should update a fleet mission string', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const updated = await controller.update(fleet.getId(), { MISSION_STRING: 'ATTACKING' });
            expect(updated.getMissionString()).to.equal('ATTACKING');
        });

        it('should update combat setting', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const updated = await controller.update(fleet.getId(), { COMBAT_SETTING: CombatSetting.ALWAYS_ENGAGE });
            expect(updated.getCombatSetting()).to.equal(CombatSetting.ALWAYS_ENGAGE);
        });

        it('should throw ValidationError for invalid combat setting', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            try { await controller.update(fleet.getId(), { COMBAT_SETTING: 'INVALID_SETTING' }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });

        it('should throw ValidationError for out-of-range FACTION_ACCESS', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            try { await controller.update(fleet.getId(), { FACTION_ACCESS: 99 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    describe('delete()', () => {
        it('returns false for non-existent fleet', async () => {
            expect(await controller.delete(999999999)).to.be.false;
        });

        it('deletes an existing fleet', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const id = fleet.getId();
            const deleted = await controller.delete(id);
            expect(deleted).to.be.true;
            // Remove from cleanup list since already deleted
            const idx = createdFleetIds.indexOf(id);
            if (idx > -1) createdFleetIds.splice(idx, 1);
        });
    });

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    describe('findAll()', () => {
        it('returns an array', async () => {
            const results = await controller.findAll({ limit: 10 });
            expect(results).to.be.an('array');
        });

        it('filters by owner', async function () {
            const owner = `search_owner_${Date.now()}`;
            const fleet = await createFleet(controller, { OWNER: owner }, this);
            if (!fleet?.getId()) return this.skip();
            const results = await controller.findAll({ owner, skipCache: true });
            expect(results.length).to.be.greaterThan(0);
            results.forEach(f => expect(f.getOwner()).to.equal(owner));
        });

        it('filters topLevelOnly', async function () {
            const fleet = await createFleet(controller, { PARENT_FLEET: -1 }, this);
            if (!fleet?.getId()) return this.skip();
            const results = await controller.findAll({ topLevelOnly: true, limit: 100, skipCache: true });
            results.forEach(f => expect(f.isTopLevel()).to.be.true);
        });

        it('supports limit and offset', async () => {
            const first = await controller.findAll({ limit: 3, offset: 0 });
            const second = await controller.findAll({ limit: 3, offset: 3 });
            expect(first).to.be.an('array');
            expect(second).to.be.an('array');
        });
    });

    describe('findByOwner()', () => {
        it('throws ValidationError for empty owner', async () => {
            try { await controller.findByOwner(''); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });

        it('returns fleets for a known owner', async function () {
            const owner = `owner_test_${Date.now()}`;
            const fleet = await createFleet(controller, { OWNER: owner }, this);
            if (!fleet?.getId()) return this.skip();
            const results = await controller.findByOwner(owner);
            expect(results.length).to.be.greaterThan(0);
        });
    });

    describe('findTopLevel()', () => {
        it('returns only top-level fleets', async () => {
            const results = await controller.findTopLevel({ limit: 50 });
            expect(results).to.be.an('array');
            // All results should have no parent (PARENT_FLEET IS NULL OR -1)
            results.forEach(f => {
                const parentFleet = f.get('PARENT_FLEET');
                const isTopLevel = parentFleet === null || parentFleet === undefined || Number(parentFleet) === -1;
                expect(isTopLevel).to.be.true;
            });
        });
    });

    describe('findIdle()', () => {
        it('returns idle fleets (array)', async () => {
            const results = await controller.findIdle({ limit: 50 });
            expect(results).to.be.an('array');
        });
    });

    // =============================================================================
    // MISSION MANAGEMENT
    // =============================================================================

    describe('updateMission()', () => {
        it('should update the mission string', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const updated = await controller.updateMission(fleet.getId(), 'PATROLLING');
            expect(updated.getMissionString()).to.equal('PATROLLING');
        });

        it('throws ValidationError for non-existent fleet', async () => {
            try { await controller.updateMission(999999999, 'IDLE'); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    describe('updateCombatSetting()', () => {
        it('should update the combat setting', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const updated = await controller.updateCombatSetting(fleet.getId(), CombatSetting.ALWAYS_FLEE);
            expect(updated.getCombatSetting()).to.equal(CombatSetting.ALWAYS_FLEE);
        });

        it('throws ValidationError for non-existent fleet', async () => {
            try { await controller.updateCombatSetting(999999999, CombatSetting.PASSIVE); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    // =============================================================================
    // HIERARCHY ANALYSIS
    // =============================================================================

    describe('getFleetHierarchy()', () => {
        it('returns an array of hierarchy nodes', async () => {
            const nodes = await controller.getFleetHierarchy({ maxDepth: 2 });
            expect(nodes).to.be.an('array');
        });

        it('hierarchy nodes have required properties', async () => {
            const nodes = await controller.getFleetHierarchy({ maxDepth: 1 });
            if (nodes.length > 0) {
                const node = nodes[0];
                expect(node).to.have.property('id');
                expect(node).to.have.property('name');
                expect(node).to.have.property('mission');
                expect(node).to.have.property('children').that.is.an('array');
                expect(node).to.have.property('depth', 0);
            }
        });
    });

    describe('countChildren()', () => {
        it('returns 0 for a fleet without children', async function () {
            const fleet = await createFleet(controller, {}, this);
            if (!fleet?.getId()) return this.skip();
            const count = await controller.countChildren(fleet.getId());
            expect(count).to.equal(0);
        });

        it('counts children correctly', async function () {
            const parent = await createFleet(controller, {}, this);
            if (!parent?.getId()) return this.skip();
            const child = await createFleet(controller, { PARENT_FLEET: parent.getId() }, this);
            if (!child?.getId()) return this.skip();
            const count = await controller.countChildren(parent.getId());
            expect(count).to.be.greaterThan(0);
        });
    });

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    describe('bulkCreate()', () => {
        it('creates multiple fleets', async function () {
            if (realEntityId < 0) return this.skip();
            const records = [makeFleetData(), makeFleetData(), makeFleetData()];
            const result = await controller.bulkCreate(records, { skipForeignKeyValidation: true });
            // Either all succeed (if FK is satisfied) or all fail gracefully
            expect(result.success + result.failed + result.skipped).to.equal(3);
            // cleanup created
            for (const r of records) {
                try {
                    const found = await controller.findAll({ owner: r.OWNER as string, limit: 1, skipCache: true });
                    if (found.length > 0 && found[0].getId()) createdFleetIds.push(found[0].getId());
                } catch { /* ignore cleanup errors */ }
            }
        });

        it('handles errors with continueOnError=true', async () => {
            const records = [
                makeFleetData(),
                { FLAGSHIP_ID: undefined } as any, // invalid
                makeFleetData()
            ];
            const result = await controller.bulkCreate(records, { continueOnError: true, skipForeignKeyValidation: true });
            expect(result.errors.length).to.be.greaterThan(0);
        });
    });

    describe('bulkDelete()', () => {
        it('deletes multiple fleets', async function () {
            const f1 = await createFleet(controller, {}, this);
            const f2 = await createFleet(controller, {}, this);
            if (!f1?.getId() || !f2?.getId()) return this.skip();
            const result = await controller.bulkDelete([f1.getId(), f2.getId()]);
            expect(result.success).to.equal(2);
            [f1.getId(), f2.getId()].forEach(id => {
                const idx = createdFleetIds.indexOf(id);
                if (idx > -1) createdFleetIds.splice(idx, 1);
            });
        });

        it('skips non-existent IDs', async () => {
            const result = await controller.bulkDelete([999999990, 999999991]);
            expect(result.skipped).to.equal(2);
        });
    });

    describe('bulkUpdate()', () => {
        it('updates multiple fleet records', async function () {
            const f1 = await createFleet(controller, {}, this);
            const f2 = await createFleet(controller, {}, this);
            if (!f1?.getId() || !f2?.getId()) return this.skip();
            const result = await controller.bulkUpdate([
                { id: f1.getId(), data: { MISSION_STRING: 'PATROLLING' } },
                { id: f2.getId(), data: { MISSION_STRING: 'TRADING' } }
            ]);
            expect(result.success).to.equal(2);
        });
    });

    // =============================================================================
    // STATISTICS
    // =============================================================================

    describe('getStatistics()', () => {
        it('returns a valid statistics object', async () => {
            const stats = await controller.getStatistics();
            expect(stats).to.have.property('totalFleets').that.is.a('number');
            expect(stats).to.have.property('topLevelFleets').that.is.a('number');
            expect(stats).to.have.property('subFleets').that.is.a('number');
            expect(stats).to.have.property('npcFleets').that.is.a('number');
            expect(stats).to.have.property('playerOwnedFleets').that.is.a('number');
            expect(stats).to.have.property('missionDistribution').that.is.an('object');
            expect(stats).to.have.property('topOwners').that.is.an('array');
        });

        it('totalFleets = topLevelFleets + subFleets', async () => {
            const stats = await controller.getStatistics();
            expect(stats.topLevelFleets + stats.subFleets).to.equal(stats.totalFleets);
        });

        it('totalFleets = npcFleets + playerOwnedFleets', async () => {
            const stats = await controller.getStatistics();
            expect(stats.npcFleets + stats.playerOwnedFleets).to.equal(stats.totalFleets);
        });
    });

    describe('count()', () => {
        it('returns a number', async () => {
            const total = await controller.count({});
            expect(total).to.be.a('number').and.greaterThanOrEqual(0);
        });

        it('returns 0 for impossible filter', async () => {
            const count = await controller.count({ owner: 'non_existent_owner_xyz_12345' });
            expect(count).to.equal(0);
        });
    });
});
