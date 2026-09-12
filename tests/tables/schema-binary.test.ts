import { expect } from 'chai';
import { FleetCommandObject, FleetRemotesObject, SectorItemsObject, TradePricesObject, FLEET_COMMAND_TYPES } from 'starmade-decoder';
import { FleetsModel, FleetCommand } from '../../src/tables/fleets/FleetsModel.js';
import { SectorsItemsModel, ITEM_RECORD_SIZE, MAX_ITEMS_SIZE } from '../../src/tables/sectors-items/SectorsItemsModel.js';
import { TradeNodesModel } from '../../src/tables/trade-nodes/TradeNodesModel.js';

/** Cross-check binary model boundaries with documented DataOutput layouts. */
describe('StarMade binary model contract', () => {
    const item = { blockType: 259, count: 2, posX: 1.5, posY: -2, posZ: 0, metaId: -1 };
    const goldenItem = Buffer.from('0103000000023fc00000c000000000000000ffffffff', 'hex');
    it('uses the 22-byte big-endian layout written by SectorItemTable', () => {
        expect(goldenItem.length).to.equal(ITEM_RECORD_SIZE);
        expect(MAX_ITEMS_SIZE).to.equal(1024 * ITEM_RECORD_SIZE);
        const model = new SectorsItemsModel({ ITEMS: goldenItem });
        expect(model.decodeItems().items).to.deep.equal([item]);
        expect(model.encodeItems([item])).to.equal(model);
        expect(model.getItems()).to.deep.equal(goldenItem);
        expect(model.encodeItems(SectorItemsObject.from([item])).getItems()).to.deep.equal(goldenItem);
    });
    for (const raw of [undefined, Buffer.alloc(0)]) {
        it(`represents ${raw === undefined ? 'absent' : 'empty'} sector item data as an empty collection`, () => {
            expect(new SectorsItemsModel({ ITEMS: raw }).decodeItems().items).to.deep.equal([]);
        });
        it(`represents ${raw === undefined ? 'absent' : 'empty'} fleet command and prices as null`, () => {
            expect(new FleetsModel({ COMMAND: raw }).decodeCommand()).to.equal(null);
            expect(new TradeNodesModel({ ITEMS: raw }).decodeItems()).to.equal(null);
        });
    }
    for (const [ordinal, type] of FLEET_COMMAND_TYPES.entries()) {
        it(`preserves command ${type} at ordinal ${ordinal}`, () => {
            expect(FleetCommand[type]).to.equal(ordinal);
            const model = new FleetsModel();
            model.encodeCommand(FleetCommandObject.create(9007199254740993n, type));
            expect(model.getCommand()!.length).to.equal(1024);
            expect(model.getCommand()!.readBigInt64BE(0)).to.equal(9007199254740993n);
            expect(model.getCommand()!.readInt32BE(8)).to.equal(ordinal);
            expect(model.decodeCommand()!.commandType).to.equal(type);
        });
    }
    it('supports raw command structures and clearing nullable command columns', () => {
        const model = new FleetsModel();
        model.encodeCommand({ fleetDbId: 42n, commandOrdinal: 0, commandType: 'IDLE', args: [] }, 13);
        expect(model.getCommand()!.toString('hex')).to.equal('000000000000002a0000000000');
        model.encodeCommand(null);
        expect(model.getCommand()).to.equal(undefined);
        model.setCommand(Buffer.from([1]));
        expect(model.decodeCommand()).to.equal(null);
    });
    const goldenRemotes = Buffer.from('0100010004646f6f7201', 'hex');
    for (const remotes of [{ door: true }, new Map([['door', true]]), FleetRemotesObject.from({ door: true })]) {
        it(`encodes a saved remote from ${remotes.constructor.name}`, () => {
            const model = new FleetsModel();
            expect(model.encodeRemotes(remotes)).to.equal(model);
            expect(model.getSavedRemotes()).to.deep.equal(goldenRemotes);
            expect([...model.decodeRemotes().remotes]).to.deep.equal([['door', true]]);
            expect(model.encodeRemotes(null).getSavedRemotes()).to.equal(undefined);
            expect(model.decodeRemotes().remotes.size).to.equal(0);
        });
    }
    for (const prices of [{ entDbId: 9007199254740993n, entries: [] }, TradePricesObject.empty(9007199254740993n)]) {
        it(`retains the 64-bit trade owner ID using ${prices.constructor.name}`, () => {
            const model = new TradeNodesModel();
            expect(model.encodeItems(prices)).to.equal(model);
            expect(model.decodeItems()!.entDbId).to.equal(9007199254740993n);
            expect(model.decodeItems()!.entries).to.deep.equal([]);
        });
    }
});
