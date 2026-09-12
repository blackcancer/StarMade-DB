import { expect } from 'chai';
import sinon from 'sinon';
import { ModelClasses } from '../../src/tables/index.js';

describe('Model summary boundaries',()=> {
    afterEach(()=>sinon.restore());
    it('defaults an absent entity database-only flag to false',()=> {
        expect(new ModelClasses.ENTITIES({SPAWNED_ONLY_IN_DB:undefined}).getSpawnedOnlyInDb()).to.equal(false);
    });
    it('uses mine owner login fallback and handles an incomplete sector',()=> {
        const mine=new ModelClasses.MINES({HP:100,AMMO:1,ARMED:false,ARMED_IN_SECS:0,CREATION_DATE:Date.now()});
        mine.setRelated('ownerPlayer',{getName:()=> 'Login'}).setRelated('sector',{});
        expect(mine.getOwnerName()).to.equal('Login');
        expect(mine.getTacticalThreatAssessment().sectorIntelligence.isProtected).to.equal(undefined);
        mine.setRelated('ownerPlayer',{});
        expect(mine.getOwnerName()).to.equal(undefined);
    });
    it('rejects trade payloads exceeding the Java VARBINARY size',()=> {
        const rule=ModelClasses.TRADE_NODES.schema.validationRules.find(rule=>rule.field==='ITEMS'&&rule.type==='custom')!;
        expect(rule.validator!(Buffer.alloc(73733),{})).to.equal('ITEMS cannot exceed 73732 bytes');
    });
    it('honors a low custom trade strategy score',()=> {
        const node=new ModelClasses.TRADE_NODES({VOLUME:0,CAPACITY:100,CREDITS:0,PERMISSION:0});
        sinon.stub(node,'assessStrategicValue').returns({economicValue:0,securityValue:0,accessibilityValue:0,overallValue:0,recommendation:'Avoid'});
        expect(node.generateTradingReport().overallRating).to.equal('AVOID');
    });
    it('includes available sector protection descriptions',()=> {
        const visibility=new ModelClasses.VISIBILITY({ID:1,TIMESTAMP:Date.now()});
        visibility.setRelated('sector',{getProtectionDescription:()=> 'Safe'});
        expect(visibility.getSectorProtectionStatus().protectionLevel).to.equal('Safe');
    });
    it('classifies intermediate observation value',()=> {
        const visibility=new ModelClasses.VISIBILITY({ID:1,TIMESTAMP:Date.now()});
        expect(visibility.assessObservationValue().recommendation).to.equal('Moderate intelligence value');
    });
    it('generates a player profile before relations are loaded',()=> {
        const player=new ModelClasses.PLAYERS({ID:1,NAME:'Alice',STARMADE_NAME:'Alice',FACTION:0,PERMISSION:0});
        const profile=player.generatePlayerProfile();
        expect(profile.basic.name).to.equal('Alice');
        expect(profile.overallRating).to.equal('NEWCOMER');
        expect(profile.relationshipStatus.hasAllAssetsLoaded).to.equal(false);
    });
    for(const [mines,fleets,messages,rating]of [[0,0,0,'NEWCOMER'],[5,0,0,'DEVELOPING'],[10,0,0,'ESTABLISHED'],[10,4,0,'VETERAN'],[10,7,200,'LEGEND']] as const) {
        it(`builds a ${rating} player profile from loaded assets`,()=> {
            const player=new ModelClasses.PLAYERS({ID:1,NAME:'Alice',STARMADE_NAME:'Alice',FACTION:0,PERMISSION:0});
            for(const relation of Object.keys(ModelClasses.PLAYERS.relationMappings)) player.setRelated(relation,[]);
            player.setRelated('ownedMines',Array(mines).fill({}));
            player.setRelated('ownedFleets',Array(fleets).fill({}));
            player.setRelated('sentMessages',Array(messages).fill({}));
            const profile=player.generatePlayerProfile();
            expect(profile.relationshipStatus.hasAllAssetsLoaded).to.equal(true);
            expect(profile.assets.ownedMines).to.equal(mines);
            expect(profile.assets.ownedFleets).to.equal(fleets);
            expect(profile.overallRating).to.equal(rating);
        });
    }
});

describe('Aged observations and transient sector alias',()=> {
    for(const [days,expected] of [[3,'Low priority - outdated information'],[7,'Minimal intelligence value - very old data']] as const) {
        it(`rates an unloaded observation after ${days} days`,()=> {
            const visibility=new ModelClasses.VISIBILITY({ID:1,TIMESTAMP:Date.now()-days*86400000});
            expect(visibility.assessObservationValue().recommendation).to.equal(expected);
        });
    }
    it('exposes the transient flag through its convenience method',()=> {
        expect(new ModelClasses.SECTORS({TRANSIENT:true}).isTransient()).to.equal(true);
        expect(new ModelClasses.SECTORS({TRANSIENT:false}).isTransient()).to.equal(false);
    });
});
