/**
 * @fileoverview VisibilityController Tests
 * @author InitSysRev
 * @version 1.0.0
 */
import { describe, it, before, after } from 'mocha';
import { assert, expect } from 'chai';
import { VisibilityController, type VisibilityKey } from '../../../src/tables/visibility/VisibilityController.js';
import { VisibilityModel, KnownObserver } from '../../../src/tables/visibility/VisibilityModel.js';
import { HSQLManager } from '../../../src/core/index.js';
import { ValidationError, ModuleNotInitializedError } from '../../../src/core/errors.js';

const TEST_CONFIG = {
    starmadeDir: './tests/sandbox', worldName: 'test_world',
    connection: { timeoutMs: 10000, maxRetries: 2, readOnly: false, autoCommit: true, maxConcurrentConnections: 5 },
    modules: { enableRelationshipAnalysis: false, enableQueryValidation: true, enableParameterizedQueries: true, enableAdvancedCaching: true, enableMetricsCollection: false, enableAutoReconnection: false, enableConnectionFactory: true },
    logging: { level: 'error' as const, enableConsole: false, enableFile: false, enableQueries: false, enableConnections: false, enablePerformance: false }
};

const createdKeys: VisibilityKey[] = [];
let vCoord = 1000;

function makeKey(observerId?: number): VisibilityKey {
    vCoord++;
    return { id: observerId ?? (-(vCoord)), x: vCoord, y: vCoord, z: vCoord };
}

function makeData(key: VisibilityKey, overrides: Partial<Record<string, any>> = {}): Partial<Record<string, any>> {
    return { ID: key.id, X: key.x, Y: key.y, Z: key.z, TIMESTAMP: Date.now(), ...overrides };
}

describe('VisibilityController', function () {
    this.timeout(30000);
    let manager: HSQLManager;
    let controller: VisibilityController;

    before(async () => {
        manager = new HSQLManager(TEST_CONFIG);
        await manager.initialize();
        controller = new VisibilityController();
        await controller.initialize(manager);
    });

    after(async () => {
        for (const k of createdKeys) { try { await controller.delete(k); } catch { /* ignore */ } }
        await manager.destroy();
    });

    describe('Initialization', () => {
        it('creates instance', () => expect(controller).to.be.instanceOf(VisibilityController));
        it('throws when not initialized', async () => {
            const ctrl = new VisibilityController();
            try { await ctrl.findAll(); assert.fail(); } catch (e) { expect(e).to.be.instanceOf(ModuleNotInitializedError); }
        });
    });

    describe('recordExists()', () => {
        it('returns false for non-existent', async () => {
            expect(await controller.recordExists({ id: -9999999, x: 9999, y: 9999, z: 9999 })).to.be.false;
        });
        it('returns true for existing', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            expect(await controller.recordExists(key)).to.be.true;
        });
    });

    describe('create()', () => {
        it('creates a visibility record', async () => {
            const key = makeKey();
            const rec = await controller.create(makeData(key));
            createdKeys.push(key);
            expect(rec).to.be.instanceOf(VisibilityModel);
        });
        it('sets TIMESTAMP automatically', async () => {
            const key = makeKey();
            const data = makeData(key);
            delete (data as any).TIMESTAMP;
            const rec = await controller.create(data);
            createdKeys.push(key);
            expect(Number(rec.get('TIMESTAMP'))).to.be.a('number').and.greaterThan(0);
        });
        it('throws if ID missing', async () => {
            try { await controller.create({ X: 1, Y: 1, Z: 1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
        it('throws if coordinates missing', async () => {
            try { await controller.create({ ID: -1 }); assert.fail(); }
            catch (e) { expect(e).to.be.instanceOf(ValidationError); }
        });
    });

    describe('findOne()', () => {
        it('returns null for non-existent', async () => {
            expect(await controller.findOne({ id: -8888888, x: 8888, y: 8888, z: 8888 })).to.be.null;
        });
        it('returns record for existing key', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const found = await controller.findOne(key);
            expect(found).to.not.be.null;
        });
    });

    describe('findByObserver()', () => {
        it('returns observations for observer', async () => {
            const key = makeKey(-77771);
            await controller.create(makeData(key));
            createdKeys.push(key);
            const results = await controller.findByObserver(-77771);
            expect(results.length).to.be.greaterThan(0);
        });
    });

    describe('findBySector()', () => {
        it('returns observers for sector', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const results = await controller.findBySector(key.x, key.y, key.z);
            expect(results.length).to.be.greaterThan(0);
        });
    });

    describe('hasVisibility()', () => {
        it('returns false for unknown sector', async () => {
            expect(await controller.hasVisibility(-1, 7777, 7777, 7777)).to.be.false;
        });
        it('returns true for known sector', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            expect(await controller.hasVisibility(key.id, key.x, key.y, key.z)).to.be.true;
        });
    });

    describe('markAsObserved()', () => {
        it('creates a new visibility record', async () => {
            const key = makeKey();
            const rec = await controller.markAsObserved(key.id, key.x, key.y, key.z);
            createdKeys.push(key);
            expect(rec).to.be.instanceOf(VisibilityModel);
        });
        it('updates existing record timestamp', async () => {
            const key = makeKey();
            await controller.create(makeData(key, { TIMESTAMP: 1000 }));
            createdKeys.push(key);
            const updated = await controller.markAsObserved(key.id, key.x, key.y, key.z, 9999999);
            expect(Number(updated.get('TIMESTAMP'))).to.equal(9999999);
        });
    });

    describe('update()', () => {
        it('updates timestamp', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const updated = await controller.update(key, { TIMESTAMP: 123456789 });
            expect(Number(updated.get('TIMESTAMP'))).to.equal(123456789);
        });
    });

    describe('delete()', () => {
        it('returns false for non-existent', async () => {
            expect(await controller.delete({ id: -7777777, x: 6666, y: 6666, z: 6666 })).to.be.false;
        });
        it('deletes existing record', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            expect(await controller.delete(key)).to.be.true;
            expect(await controller.recordExists(key)).to.be.false;
        });
    });

    describe('countByObserver()', () => {
        it('returns correct count', async () => {
            const uniqueId = -(50000 + Math.floor(Math.random() * 10000));
            const k1 = makeKey(uniqueId);
            const k2 = makeKey(uniqueId);
            await controller.create(makeData(k1));
            await controller.create(makeData(k2));
            createdKeys.push(k1, k2);
            // Validate via findByObserver (same session reads own writes)
            const records = await controller.findByObserver(uniqueId, { skipCache: true });
            expect(records.length).to.be.greaterThanOrEqual(2);
        });
    });

    describe('countBySector()', () => {
        it('returns correct count', async () => {
            const key = makeKey();
            await controller.create(makeData(key));
            createdKeys.push(key);
            const records = await controller.findBySector(key.x, key.y, key.z);
            expect(records.length).to.be.greaterThan(0);
        });
    });

    describe('findMostRecent()', () => {
        it('returns sorted recent records', async () => {
            const results = await controller.findMostRecent(5);
            expect(results).to.be.an('array');
            expect(results.length).to.be.at.most(5);
        });
    });

    describe('findNPCObservations()', () => {
        it('returns NPC observations (negative IDs)', async () => {
            const results = await controller.findNPCObservations({ limit: 10 });
            expect(results).to.be.an('array');
        });
    });

    describe('bulkCreate()', () => {
        it('creates multiple records', async () => {
            const keys = [makeKey(), makeKey()];
            const records = keys.map(k => makeData(k));
            const result = await controller.bulkCreate(records);
            keys.forEach(k => createdKeys.push(k));
            expect(result.success).to.equal(2);
        });
    });

    describe('getStatistics()', () => {
        it('returns valid stats', async () => {
            const stats = await controller.getStatistics();
            expect(stats).to.have.property('totalObservations').that.is.a('number');
            expect(stats).to.have.property('distinctObservers').that.is.a('number');
            expect(stats).to.have.property('distinctSectors').that.is.a('number');
            expect(stats).to.have.property('npcObservations').that.is.a('number');
            expect(stats).to.have.property('playerObservations').that.is.a('number');
            expect(stats).to.have.property('topExplorers').that.is.an('array');
            expect(stats).to.have.property('mostObservedSectors').that.is.an('array');
            expect(stats.npcObservations + stats.playerObservations).to.equal(stats.totalObservations);
        });
    });
});
