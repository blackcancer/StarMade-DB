import { expect } from 'chai';
import sinon from 'sinon';
import { FleetMembersModel, MissionCategory, DockingStatus } from '../../src/tables/fleet-members/FleetMembersModel.js';
import { FleetsModel, FleetMissionCategory, FleetType } from '../../src/tables/fleets/FleetsModel.js';
import { SectorsModel } from '../../src/tables/sectors/SectorsModel.js';
import { FtlModel } from '../../src/tables/ftl/FtlModel.js';
import { ModelClasses } from '../../src/tables/index.js';

describe('Operational model states', () => {
    afterEach(()=>sinon.restore());
    for(const [mission,index,docking] of [['IDLE',1,-1],['REPAIRING',1,-1],['ATTACKING',2,-1],['MINING',3,22],['',0,22],['UNKNOWN',2,22]] as const) {
        it(`assesses fleet member ${mission}/${index}/${docking}`,()=> {
            const member=new FleetMembersModel({MISSION_STRING:mission,LIST_INDEX:index,DOCKED_TO:docking});
            member.setRelated('entity',{}).setRelated('fleet',{});
            if(docking>0) member.setRelated('dockedToEntity',{getName:()=> 'Carrier'});
            const readiness=member.getOperationalReadiness();
            expect(readiness.intelligence!.entityType).to.equal(undefined);
            expect(readiness.intelligence!.fleetType).to.equal(undefined);
            const tactical=member.getTacticalAssessment();
            expect(tactical.tacticalValue).to.be.within(0,100);
            if(mission==='IDLE') expect(tactical.deploymentStatus).to.equal('READY');
            if(mission==='REPAIRING') expect(tactical.role).to.equal('SUPPORT');
            if(docking>0) expect(readiness.issues).to.include('Docked to Carrier');
        });
    }
    it('represents nonstandard docking sentinel zero as unknown',()=> {
        expect(new FleetMembersModel({DOCKED_TO:0}).getDockingStatus()).to.equal(DockingStatus.UNKNOWN);
    });
    it('falls back for unrecognized custom mission states',()=> {
        const member=new FleetMembersModel();
        sinon.stub(member,'getMissionState').returns('CUSTOM_STATE' as any);
        expect(member.getMissionCategory()).to.equal(MissionCategory.IDLE);
        const fleet=new FleetsModel();
        sinon.stub(fleet,'getMissionState').returns('CUSTOM_STATE' as any);
        expect(fleet.getMissionCategory()).to.equal(FleetMissionCategory.IDLE);
        sinon.stub(fleet,'getMissionCategory').returns('CUSTOM_CATEGORY' as any);
        expect(fleet.getOperationalStatus().status).to.equal('UNKNOWN');
    });
    it('reports a special fleet mission',()=> {
        expect(new FleetsModel({MISSION_STRING:'CLOAKING'}).getOperationalStatus().status).to.equal('SPECIAL');
    });
    it('preserves fallback fleet descriptions for custom classifications',()=> {
        const fleet=new FleetsModel({ID:42,NAME:'',MISSION_STRING:'',COMBAT_SETTING:'CUSTOM'});
        expect(fleet.getCurrentMission()).to.equal('Unknown');
        expect(fleet.getCombatBehavior()).to.equal('Unknown - CUSTOM');
        sinon.stub(fleet,'getFleetType').returns(FleetType.MINING);
        expect(fleet.getDisplayName()).to.equal('MINING Fleet 42');
        fleet.setRelated('ownerPlayer',{getName:()=> 'Owner'});
        expect(fleet.getDisplayName()).to.equal("Owner's MINING Fleet 42");
    });
    for(const [parent,children,expected] of [[1,0,'Subordinate'],[-1,1,'Commander'],[-1,0,'Independent']] as const) {
        it(`describes fleet command structure ${expected}`,()=> {
            const fleet=new FleetsModel({PARENT_FLEET:parent,MISSION_STRING:'IDLE'});
            fleet.setRelated('flagship',{}).setRelated('ownerPlayer',{}).setRelated('childFleets',Array(children).fill({}));
            expect(fleet.getOperationalStatus().intelligence!.commandStructure).to.equal(expected);
        });
    }
    it('handles future permission flags when rendering names',()=> {
        const player=new ModelClasses.PLAYERS();
        sinon.stub(player,'getPermissions').returns([12345]);
        expect(player.getPermissionNames()).to.deep.equal(['UNKNOWN_12345']);
        const sector=new SectorsModel({PROTECTION:64});
        sinon.stub(sector,'getProtections').returns([12345]);
        expect(sector.getProtectionNames()).to.deep.equal(['UNKNOWN_12345']);
    });
    it('describes unknown sector protection and unavailable cache fields',()=> {
        const sector=new SectorsModel({PROTECTION:64});
        expect(sector.getProtectionDescription()).to.equal('Custom Protection');
        sector.set('PROTECTION',undefined);
        expect(sector.meetsPerformanceCriteria({cacheProtections:true})).to.equal(false);
    });
    it('recognizes blocked sector accessibility and safe FTL routes',()=> {
        const sector=new SectorsModel({PROTECTION:4});
        expect(sector.performSectorAnalysis().accessibilityScore).to.equal(0);
        const route=new FtlModel({TYPE:0,PERMISSION:3,FROM_X:1,FROM_Y:1,FROM_Z:1,TO_X:31,TO_Y:1,TO_Z:1});
        expect(route.getRouteAnalysis().strategicValue).to.equal(65);
    });
    it('recognizes messages loaded on the receiver side only',()=> {
        const player=new ModelClasses.PLAYERS();
        player.setRelated('receivedMessages',[]);
        expect(player.hasMessagesLoaded()).to.equal(true);
    });
    it('handles absent binary payloads in summaries',()=> {
        const system=new ModelClasses.SYSTEMS({INFOS:undefined,RESOURCES:undefined});
        expect(system.getSystemSummary().infosSize).to.equal(0);
        expect(system.getSystemSummary().resourcesSize).to.equal(0);
        expect(new ModelClasses.SECTORS_ITEMS({ITEMS:undefined}).getItemsSize()).to.equal(0);
    });
    it('describes unknown negative owner factions',()=> {
        expect(new ModelClasses.SYSTEMS({OWNER_FACTION:-123}).getFactionName()).to.equal('Faction -123');
        expect(new ModelClasses.MINES({FACTION:-123}).getFactionName()).to.equal('Unknown Faction -123');
    });
});
