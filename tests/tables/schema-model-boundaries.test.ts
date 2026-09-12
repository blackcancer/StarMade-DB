import { expect } from 'chai';
import sinon from 'sinon';
import { ModelClasses, BaseModel } from '../../src/tables/index.js';
import { SystemsModel } from '../../src/tables/systems/SystemsModel.js';
import { StarSystem } from 'starmade-decoder';
import { PlayersModel, PlayerPermission } from '../../src/tables/players/PlayersModel.js';
import { FleetsModel } from '../../src/tables/fleets/FleetsModel.js';
import { TradeNodesModel } from '../../src/tables/trade-nodes/TradeNodesModel.js';

describe('Model relationship and binary boundaries', () => {
    for (const [table, Model] of Object.entries(ModelClasses)) {
        it(`resolves every lazy ${table} relation to an exported model and real columns`, () => {
            for (const relation of Object.values(Model.relationMappings)) {
                const Target = BaseModel.resolveModelClass(relation.modelClass);
                expect(Object.values(ModelClasses)).to.include(Target);
                for (const side of ['from', 'to'] as const) {
                    for (const qualified of [relation.join[side]].flat()) {
                        const [name, column] = qualified.split('.');
                        const owner = ModelClasses[name as keyof typeof ModelClasses];
                        expect(owner.schema.columns.map(column => column.name)).to.include(column);
                    }
                }
            }
        });
    }
    it('round-trips system grid and resource data through both encoding APIs', () => {
        const model = new SystemsModel();
        expect(model.decodeStarSystem()).to.equal(null);
        expect(model.decodeResources()).to.deep.equal([]);
        const system = StarSystem.empty();
        expect(model.encodeStarSystem(system)).to.equal(model);
        expect(model.decodeStarSystem()!.infosToBytes()).to.deep.equal(system.infosToBytes());
        expect(model.encodeInfos([])).to.equal(model);
        expect(model.encodeResources([])).to.equal(model);
        expect(model.getInfos().length).to.equal(8192);
        expect(model.getResources().length).to.equal(16);
        expect(model.decodeResources().every(resource => resource.density === 0)).to.equal(true);
    });
    it('stores generated FTL IDs and explicit mine creation dates', () => {
        const route = new ModelClasses.FTL();
        expect(route.setId(321).getId()).to.equal(321);
        const mine = new ModelClasses.MINES();
        expect(mine.setCreationDate(123456789).getCreationDate()).to.equal(123456789);
    });
    it('validates commercial binary capacity at its boundary', () => {
        const node = new TradeNodesModel({ITEMS: Buffer.alloc(73732)});
        expect(node.validateItemsSize()).to.equal(true);
        node.setItems(Buffer.alloc(73733));
        expect(node.validateItemsSize()).to.equal(false);
    });
    for (const [rank, economic, fleet, messages] of [
        ['NEWCOMER', 0, 0, 0], ['CITIZEN', 5, 0, 0], ['NOTABLE', 10, 0, 0],
        ['INFLUENTIAL', 10, 4, 0], ['POWER_PLAYER', 10, 7, 200]
    ] as const) {
        it(`classifies player influence as ${rank}`, () => {
            const player = new PlayersModel({PERMISSION:0});
            sinon.stub(player, 'getEconomicAssetsCount').returns(economic);
            sinon.stub(player, 'getOwnedFleetsCount').returns(fleet);
            sinon.stub(player, 'getTotalEntityInteractionsCount').returns(0);
            sinon.stub(player, 'getTotalMessagesCount').returns(messages);
            expect(player.getInfluenceAssessment().influenceRank).to.equal(rank);
        });
    }
    it('includes officer guidance and evaluates permission requirements', () => {
        const player = new PlayersModel({PERMISSION:PlayerPermission.INVITE});
        expect(player.getInfluenceAssessment().recommendations.some(value => value.includes('officer'))).to.equal(true);
        expect(player.validatePermissionForAction(PlayerPermission.INVITE)).to.equal(true);
        expect(player.validatePermissionForAction(PlayerPermission.KICK)).to.equal(false);
        expect(player.getRoleName()).to.equal(player.getRole());
        player.setPermission(PlayerPermission.ADMIN_PERMISSIONS);
        expect(player.validatePermissionForAction(PlayerPermission.KICK)).to.equal(true);
    });
    it('distinguishes fleet mission categories', () => {
        const fleet = new FleetsModel({MISSION_STRING:'TRADING'});
        expect(fleet.isTrading()).to.equal(true);
        expect(fleet.isSentry()).to.equal(false);
        expect(fleet.isPerformingOperations()).to.equal(true);
        fleet.setMissionString('SENTRY');
        expect(fleet.isSentry()).to.equal(true);
        expect(fleet.isTrading()).to.equal(false);
        expect(fleet.isPerformingOperations()).to.equal(false);
        expect(fleet.isLeafNode()).to.equal(true);
    });
});
