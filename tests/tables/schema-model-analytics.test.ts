import { expect } from 'chai';
import sinon from 'sinon';
import { ModelClasses } from '../../src/tables/index.js';
import { FtlModel, FtlPermission } from '../../src/tables/ftl/FtlModel.js';
import { MinesModel } from '../../src/tables/mines/MinesModel.js';
import { NPCStatsModel } from '../../src/tables/npc-stats/NpcStatsModel.js';

describe('Model analytical boundaries', () => {
    afterEach(() => sinon.restore());
    for (const [seconds, expected] of [[60,'1 minute'],[120,'2 minutes'],[3600,'1 hour'],[7200,'2 hours'],[86400,'1 day'],[172800,'2 days']] as const) {
        it(`formats a mine age of ${seconds} seconds`, () => {
            sinon.stub(Date,'now').returns(1000000000);
            expect(new MinesModel({CREATION_DATE:1000000000-seconds*1000}).getAgeDescription()).to.equal(expected);
        });
    }
    for (const days of [1,2]) {
        it(`formats message and visibility ages of ${days} days`, () => {
            sinon.stub(Date,'now').returns(1000000000);
            const timestamp=1000000000-days*86400000;
            expect(new ModelClasses.PLAYER_MESSAGES({SENT:timestamp}).getRelativeTimeDescription()).to.equal(`${days} day${days===1?'':'s'} ago`);
            expect(new ModelClasses.VISIBILITY({TIMESTAMP:timestamp}).getRelativeTimeDescription()).to.equal(`${days} day${days===1?'':'s'} ago`);
        });
    }
    for (const [id,total,level] of [[-9999999,0,'SAFE'],[-9999999,5,'MODERATE'],[-9999999,15,'HIGH'],[-9999999,16,'CRITICAL'],[1,10,'LOW'],[1,20,'MODERATE'],[1,21,'HIGH']] as const) {
        it(`assesses ${total} NPC spawns for faction ${id} as ${level}`, () => {
            const model = new NPCStatsModel({ID:id,FLEET_SPAWNS:total,ENTITY_SPAWNS:0});
            expect(model.getThreatAssessment().level).to.equal(level);
            expect(model.getNPCStatsSummary().analysis.threatAssessment.level).to.equal(level);
        });
    }
    it('compares a quieter NPC system with a busier one', () => {
        expect(new NPCStatsModel({FLEET_SPAWNS:1,ENTITY_SPAWNS:0}).compareActivityWith(new NPCStatsModel({FLEET_SPAWNS:10,ENTITY_SPAWNS:0})).comparison).to.equal('9 fewer spawns than comparison');
    });
    for (const [mask,quality] of [[0,'FAIR'],[FtlPermission.NO_ENTER,'POOR'],[FtlPermission.NO_ENTER|FtlPermission.NO_EXIT,'BLOCKED'],[FtlPermission.NO_FP_LOSS,'GOOD'],[FtlPermission.NO_FP_LOSS|FtlPermission.NO_INDICATIONS,'EXCELLENT']] as const) {
        it(`rates FTL permission mask ${mask} as ${quality}`, () => {
            const route = new FtlModel({TYPE:0,PERMISSION:mask,FROM_X:1,FROM_Y:1,FROM_Z:1,TO_X:31,TO_Y:1,TO_Z:1});
            for (const relation of ['fromSector','toSector','fromEntity','toEntity']) route.setRelated(relation,{});
            expect(route.getConnectionQuality().quality).to.equal(quality);
            expect(route.getRouteAnalysis().distanceCategory).to.equal('MEDIUM');
            expect(route.getPermissionDescription()).to.be.a('string');
        });
    }
    it('describes all FTL restrictions and the destination origin', () => {
        const route = new FtlModel({TYPE:0,PERMISSION:63,FROM_X:1,FROM_Y:1,FROM_Z:1,TO_X:0,TO_Y:0,TO_Z:0});
        expect(route.getPermissionDescription()).to.include('No Entry').and.include('No Exit').and.include('Stealth').and.include('No FP Loss');
        expect(route.passesOrigin()).to.equal(true);
    });
    for (const [data,expected] of [
        [{ARMED:false,ARMED_IN_SECS:10,HP:100,AMMO:1},'HIGH'],
        [{ARMED:false,ARMED_IN_SECS:0,HP:0,AMMO:1},'SAFE'],
        [{ARMED:true,ARMED_IN_SECS:0,HP:100,AMMO:0},'LOW'],
        [{ARMED:false,ARMED_IN_SECS:0,HP:100,AMMO:0},'LOW']
    ] as const) {
        it(`assesses mine state ${JSON.stringify(data)}`, () => {
            const mine = new MinesModel({...data,CREATION_DATE:Date.now()-600000,FACTION:-10000000});
            expect(mine.getTacticalThreatAssessment().threatLevel).to.equal(expected);
            expect(mine.getSafetyAssessment().warnings.length).to.be.greaterThan(0);
        });
    }
    for (const [faction,expected] of [[-9999999,'HIGH'],[-10000000,'MODERATE']] as const) {
        it(`uses loaded mine owner intelligence for faction ${faction}`, () => {
            const mine = new MinesModel({ARMED:false,ARMED_IN_SECS:0,HP:100,AMMO:1,FACTION:faction,CREATION_DATE:Date.now()-600000,COMPOSITION:'[1,2,3,4,5,6]'});
            mine.setRelated('ownerPlayer',{getDisplayName:()=> 'Owner'});
            mine.setRelated('sector',{isFullyProtected:()=>true});
            expect(mine.getOwnerName()).to.equal('Owner');
            expect(mine.getTacticalThreatAssessment().threatLevel).to.equal(expected);
            expect(mine.getSafetyAssessment().tacticalIntelligence!.sectorSafety).to.equal('PROTECTED');
        });
    }
    it('increases caution around recently depleted mines', () => {
        const mine = new MinesModel({ARMED:false,ARMED_IN_SECS:0,HP:100,AMMO:0,CREATION_DATE:Date.now()});
        expect(mine.getTacticalThreatAssessment().threatLevel).to.equal('MODERATE');
    });
});
