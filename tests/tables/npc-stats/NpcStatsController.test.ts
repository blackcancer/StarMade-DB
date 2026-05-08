/**
 * @fileoverview NpcStatsController Tests
 * @author InitSysRev
 * @version 1.0.0
 */
import { describe, it, before, after } from 'mocha';
import { assert, expect } from 'chai';
import { NpcStatsController, type NpcStatsKey } from '../../../src/tables/npc-stats/NpcStatsController.js';
import { NPCStatsModel } from '../../../src/tables/npc-stats/NpcStatsModel.js';
import { HSQLManager } from '../../../src/core/index.js';
import { ValidationError, ModuleNotInitializedError } from '../../../src/core/errors.js';

const TEST_CONFIG = {
    starmadeDir: './tests/sandbox', worldName: 'test_world',
    connection: { timeoutMs: 10000, maxRetries: 2, readOnly: false, autoCommit: true, maxConcurrentConnections: 5 },
    modules: { enableRelationshipAnalysis: false, enableQueryValidation: true, enableParameterizedQueries: true, enableAdvancedCaching: true, enableMetricsCollection: false, enableAutoReconnection: false, enableConnectionFactory: true },
    logging: { level: 'error' as const, enableConsole: false, enableFile: false, enableQueries: false, enableConnections: false, enablePerformance: false }
};

const createdKeys: NpcStatsKey[] = [];
let coordIdx = 0;

function makeKey(): NpcStatsKey {
    coordIdx++;
    return { id: -(coordIdx + 5000), sysX: coordIdx, sysY: coordIdx, sysZ: coordIdx };
}

function makeData(key: NpcStatsKey, overrides: Partial<Record<string, any>> = {}): Partial<Record<string, any>> {
    return { ID: key.id, SYS_X: key.sysX, SYS_Y: key.sysY, SYS_Z: key.sysZ, FLEET_SPAWNS: 0, ENTITY_SPAWNS: 0, ...overrides };
}

describe('NpcStatsController', function () {
    this.timeout(30000);
    let manager: HSQLManager;
    let controller: NpcStatsController;

    before(async () => {
        manager = new HSQLManager(TEST_CONFIG);
        await manager.initialize();
        controller = new NpcStatsController();
        await controller.initialize(manager);
    });

    after(async () => {
        for (const k of createdKeys) { try { await controller.delete(k); } catch { /* ignore */ } }
        await manager.destroy();
    });

    describe('Initialization', () => {
        it('creates instance', () => expect(controller).to.be.instanceOf(NpcStatsController));
        it('throws when not initialized', async () => {
            const ctrl = new NpcStatsController();
            try { await ctrl.findAll(); assert.fail(); } catch (e) { expect(e).to.be.instanceOf(ModuleNotInitializedError); }
        });
    });

    describe('recordExists()', () => {
        it('returns false for non-existent', async () => {
            expect(await controller.recordExists({ id: -9999999, sysX: 9999, sysY: 9999, sysZ: 9999 })).to.be.false;
        });
        it('returns true for existing', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            expect(await controller.recordExists(key)).to.be.true;
        });
    });

    describe('create()', () => {
        it('creates with default spawn counts', async () => {
            const key = makeKey();
            const rec = await controller.create(makeData(key));
            createdKeys.push(key);
            expect(rec).to.be.instanceOf(NPCStatsModel);
            expect(rec.get('FLEET_SPAWNS')).to.equal(0);
            expect(rec.get('ENTITY_SPAWNS')).to.equal(0);
        });
        it('throws if ID missing', async () => {
            try { await controller.create({ SYS_X: 1, SYS_Y: 1, SYS_Z: 1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
        it('throws if coordinates missing', async () => {
            try { await controller.create({ ID: -1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    describe('findOne()', () => {
        it('returns null for non-existent', async () => {
            expect(await controller.findOne({ id: -9999998, sysX: 8888, sysY: 8888, sysZ: 8888 })).to.be.null;
        });
        it('returns record for existing key', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const found = await controller.findOne(key);
            expect(found).to.not.be.null;
        });
    });

    describe('findByFaction()', () => {
        it('returns array for faction', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const results = await controller.findByFaction(key.id);
            expect(results.length).to.be.greaterThan(0);
        });
    });

    describe('findBySystem()', () => {
        it('returns array for system', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const results = await controller.findBySystem(key.sysX, key.sysY, key.sysZ);
            expect(results.length).to.be.greaterThan(0);
        });
    });

    describe('update()', () => {
        it('updates spawn counts', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const updated = await controller.update(key, { FLEET_SPAWNS: 5, ENTITY_SPAWNS: 10 });
            expect(updated.get('FLEET_SPAWNS')).to.equal(5);
            expect(updated.get('ENTITY_SPAWNS')).to.equal(10);
        });
        it('throws for negative spawn count', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            try { await controller.update(key, { FLEET_SPAWNS: -1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    describe('incrementFleetSpawns()', () => {
        it('creates and increments', async () => {
            const key = makeKey();
            const rec = await controller.incrementFleetSpawns(key, 3);
            createdKeys.push(key);
            expect(rec.get('FLEET_SPAWNS')).to.equal(3);
        });
        it('increments existing record', async () => {
            const key = makeKey();
            await controller.create(makeData(key, { FLEET_SPAWNS: 5 }));
            createdKeys.push(key);
            const updated = await controller.incrementFleetSpawns(key, 2);
            expect(updated.get('FLEET_SPAWNS')).to.equal(7);
        });
    });

    describe('incrementEntitySpawns()', () => {
        it('creates and increments', async () => {
            const key = makeKey();
            const rec = await controller.incrementEntitySpawns(key, 4);
            createdKeys.push(key);
            expect(rec.get('ENTITY_SPAWNS')).to.equal(4);
        });
    });

    describe('delete()', () => {
        it('returns false for non-existent', async () => {
            expect(await controller.delete({ id: -9999997, sysX: 7777, sysY: 7777, sysZ: 7777 })).to.be.false;
        });
        it('deletes existing record', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            expect(await controller.delete(key)).to.be.true;
            expect(await controller.recordExists(key)).to.be.false;
        });
    });

    describe('findMostActive()', () => {
        it('returns sorted array', async () => {
            const results = await controller.findMostActive(5);
            expect(results).to.be.an('array');
            expect(results.length).to.be.at.most(5);
        });
    });

    describe('getStatistics()', () => {
        it('returns valid stats', async () => {
            const stats = await controller.getStatistics();
            expect(stats).to.have.property('totalRecords').that.is.a('number');
            expect(stats).to.have.property('distinctFactions').that.is.a('number');
            expect(stats).to.have.property('distinctSystems').that.is.a('number');
            expect(stats).to.have.property('totalFleetSpawns').that.is.a('number');
            expect(stats).to.have.property('totalEntitySpawns').that.is.a('number');
            expect(stats).to.have.property('mostActiveFactions').that.is.an('array');
            expect(stats).to.have.property('mostActiveSystems').that.is.an('array');
        });
    });
});
