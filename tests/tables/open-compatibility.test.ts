import { expect } from 'chai';
import { FleetsModel, FleetCommand } from '../../src/tables/fleets/FleetsModel.js';
import { FleetMembersModel } from '../../src/tables/fleet-members/FleetMembersModel.js';
import { SectorsModel, SectorType } from '../../src/tables/sectors/SectorsModel.js';
import { SystemsModel, SystemType } from '../../src/tables/systems/SystemsModel.js';
import { FleetMembersController } from '../../src/tables/fleet-members/FleetMembersController.js';
import { rejects } from 'node:assert/strict';
import sinon from 'sinon';
import { FleetCommandObject, StarSystem, TradePricesObject } from 'starmade-decoder';
import { TradeNodesModel } from '../../src/tables/trade-nodes/TradeNodesModel.js';

/** Independent schema and ordinal expectations for Open e5a3b49d8. */
describe('Open database model compatibility', () => {
    it('forwards explicit legacy profiles without changing their wire bytes', () => {
        const command=FleetCommandObject.create(42n,'FLEET_ATTACK',[],'legacy-sdk');
        const fleet=new FleetsModel().encodeCommand(command);
        expect(fleet.decodeCommand('legacy-sdk')!.commandType).to.equal('FLEET_ATTACK');
        expect(fleet.getCommand()).to.deep.equal(command.toBytes());
        const system=StarSystem.empty('legacy-sdk').withSectorType(0,0,0,'SUN');
        const model=new SystemsModel().encodeStarSystem(system);
        expect(model.decodeStarSystem('legacy-sdk')!.getSector(0,0,0)!.sectorType).to.equal('SUN');
        expect(model.encodeInfos([...system.sectors],'legacy-sdk').getInfos()).to.deep.equal(system.infosToBytes());
        const prices=TradePricesObject.empty(42n,'legacy-sdk').withSellOrder(259,2,500);
        const node=new TradeNodesModel().encodeItems({entDbId:42n,entries:[...prices.entries]},'legacy-sdk');
        expect(node.decodeItems('legacy-sdk')!.entries).to.deep.equal(prices.entries);
        expect(node.encodeItems(prices).getItems()).to.deep.equal(prices.toBytes());
    });
    it('rejects incomplete membership keys before selecting or mutating a row', async () => {
        const controller=new FleetMembersController();
        const lookup=sinon.stub(controller,'findOne').resolves(null);
        try {
            for(const id of [null,undefined,7,{}, {fleetId:1},{entityId:1},{fleetId:null,entityId:1},{fleetId:1,entityId:null}]) {
                await rejects(()=>controller.update(id as any,{CARGO_CAPACITY:42}),/Both fleetId and entityId/);
                await rejects(()=>controller.delete(id as any),/Both fleetId and entityId/);
            }
            expect(lookup.callCount).to.equal(0);
        } finally { lookup.restore(); }
    });
    it('uses game ordinals for fleet commands and SQL sector/system types', () => {
        expect(FleetCommand.FLEET_ATTACK).to.equal(6);
        expect(FleetCommand.STOP_INTERDICT).to.equal(23);
        for(const [ordinal,name] of ['SPACE_STATION','ASTEROID','PLANET','MAIN','SUN','BLACK_HOLE','VOID','LOW_ASTEROID','GIANT','DOUBLE_STAR'].entries()) {
            expect(SectorType[name as keyof typeof SectorType]).to.equal(ordinal);
            expect(new SectorsModel({TYPE:ordinal}).getTypeName()).to.equal(name);
        }
        for(const [ordinal,name] of [[4,'SUN'],[5,'BLACK_HOLE'],[6,'VOID'],[8,'GIANT'],[9,'DOUBLE_STAR']] as const) {
            expect(SystemType[name]).to.equal(ordinal);
            const model=new SystemsModel({TYPE:ordinal});
            expect(model.getTypeName()).to.equal(name);
            expect(model.validate().fieldErrors).not.to.have.property('TYPE');
        }
    });
    it('exposes and validates the new fleet columns', () => {
        const fleet=new FleetsModel({FLAGSHIP_ID:1});
        expect(fleet.setCombinedTargeting(true).getCombinedTargeting()).to.equal(true);
        expect(fleet.setCombinedTargeting(false).getCombinedTargeting()).to.equal(false);
        expect(fleet.setMessageLog('entry').getMessageLog()).to.equal('entry');
        expect(fleet.setMessageLog(null).getMessageLog()).to.equal(null);
        expect(fleet.setMessageLog(JSON.stringify(['x'.repeat(4092)])).validate().fieldErrors).not.to.have.property('MESSAGE_LOG');
        expect(fleet.setMessageLog(JSON.stringify(['x'.repeat(4093)])).validate().fieldErrors).to.have.property('MESSAGE_LOG');
        const member=new FleetMembersModel();
        expect(member.setCargoCapacity(42.5).getCargoCapacity()).to.equal(42.5);
        expect(member.setCargoCapacity(0).getCargoCapacity()).to.equal(0);
        expect(FleetsModel.schema.columns.map(c=>c.name)).to.include.members(['COMBINED_TARGETING','MESSAGE_LOG']);
        expect(FleetMembersModel.schema.columns.find(c=>c.name==='CARGO_CAPACITY')).to.include({nullable:false,defaultValue:0});
    });
    it('validates the nullable JSON string array used by game message logs', () => {
        for (const value of [undefined, null, '', '[]', '["entry"]', JSON.stringify([JSON.stringify({timestamp:1,type:'TEST',description:'entry'})])]) {
            expect(new FleetsModel({MESSAGE_LOG:value}).validate().fieldErrors).not.to.have.property('MESSAGE_LOG');
        }
        for (const value of [42, {}, 'entry', '{}', 'null', '[1]', '["valid",null]']) {
            expect(new FleetsModel({MESSAGE_LOG:value}).validate().fieldErrors).to.have.property('MESSAGE_LOG');
        }
    });
    it('rejects invalid targeting and cargo data while accepting nullable flags and omitted defaults', () => {
        for(const value of [undefined,null,true,false]) {
            expect(new FleetsModel({COMBINED_TARGETING:value}).validate().fieldErrors).not.to.have.property('COMBINED_TARGETING');
        }
        for(const value of [0,'true',{}]) {
            expect(new FleetsModel({COMBINED_TARGETING:value}).validate().fieldErrors).to.have.property('COMBINED_TARGETING');
        }
        for(const value of [undefined,0,42.5]) {
            expect(new FleetMembersModel({CARGO_CAPACITY:value}).validate().fieldErrors).not.to.have.property('CARGO_CAPACITY');
        }
        for(const value of [null,'42',NaN,Infinity,-Infinity]) {
            expect(new FleetMembersModel({CARGO_CAPACITY:value}).validate().fieldErrors).to.have.property('CARGO_CAPACITY');
        }
    });
});
