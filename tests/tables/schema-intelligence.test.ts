import { expect } from 'chai';
import sinon from 'sinon';
import { VisibilityModel } from '../../src/tables/visibility/VisibilityModel.js';
import { PlayerMessagesModel } from '../../src/tables/player-messages/PlayerMessagesModel.js';
import { TradeNodesModel } from '../../src/tables/trade-nodes/TradeNodesModel.js';

describe('Optional relation intelligence', () => {
    afterEach(()=>sinon.restore());
    it('handles partial visibility sector information', () => {
        const visibility = new VisibilityModel({ID:1,TIMESTAMP:Date.now()});
        visibility.setRelated('sector',{});
        expect(visibility.getSectorIntelligence()).to.deep.equal({name:undefined,type:undefined,stellar:undefined,protection:undefined,isLoaded:true});
        expect(visibility.getSectorProtectionStatus()).to.deep.equal({isProtected:false,isSafeZone:false,isLocked:false,protectionLevel:undefined,isLoaded:true});
    });
    for (const type of ['PLANET','WORMHOLE','SUN','BLACK_HOLE']) {
        it(`values protected ${type} observations`, () => {
            sinon.stub(Date,'now').returns(1000000000);
            const visibility = new VisibilityModel({ID:-10000000,TIMESTAMP:Date.now()});
            visibility.setRelated('sector', {getTypeName:()=>type,getProtection:()=>63,isSafeZone:()=>true,isLocked:()=>true});
            const value=visibility.assessObservationValue();
            expect(value.strategicValue).to.be.greaterThan(50);
            expect(visibility.generateIntelligenceReport().assessment.value).to.deep.equal(value);
        });
    }
    for (const [id,age,level,rating] of [[-9999999,0,'CRITICAL','CRITICAL'],[-9999999,7200000,'HIGH','IMPORTANT'],[-9999998,0,'HIGH','IMPORTANT'],[-9999998,7200000,'MEDIUM','INTERESTING'],[-10000000,0,'LOW','ROUTINE']] as const) {
        it(`assesses faction ${id} observation age ${age}`, () => {
            sinon.stub(Date,'now').returns(1000000000);
            const visibility = new VisibilityModel({ID:id,TIMESTAMP:1000000000-age});
            visibility.setRelated('sector',{getProtection:()=>1});
            expect(visibility.isPotentialThreat().threatLevel).to.equal(level);
            expect(visibility.generateIntelligenceReport().overallRating).to.equal(rating);
        });
    }
    it('handles partial sender and receiver player records', () => {
        const message = new PlayerMessagesModel();
        message.setRelated('senderPlayer',{}).setRelated('receiverPlayer',{});
        const intelligence=message.getPlayersIntelligence();
        expect(intelligence.sender).to.deep.equal({name:undefined,role:undefined,faction:undefined,isAdmin:undefined,isLoaded:true});
        expect(intelligence.receiver).to.deep.equal(intelligence.sender);
    });
    for (const word of ['proposal','agreement','service']) {
        it(`classifies a ${word} in message text as business`, () => {
            expect(new PlayerMessagesModel({TOPIC:'Note',MESSAGE:word,SENDER:'Alice'}).getMessageCategory()).to.equal('BUSINESS');
        });
    }
    it('reports old unread administrative self-messages', () => {
        const message = new PlayerMessagesModel({ID:1,SENDER:'admin',RECEIVER:'admin',TOPIC:'Note',MESSAGE:'memo',SENT:Date.now()-172800000,READ:false});
        message.setRelated('senderPlayer',{isAdmin:()=>true});
        const report=message.generateMessageAnalytics();
        expect(report.insights).to.include('Administrative message - official communication');
        expect(report.insights).to.include('Self-message - possibly a note or reminder');
        expect(report.insights).to.include('Unread old message - may need follow-up');
    });
    it('handles a partial trade owner and recognizes planetary security', () => {
        const node=new TradeNodesModel({VOLUME:0,CAPACITY:100,CREDITS:0});
        node.setRelated('player',{});
        expect(node.getPlayerIntelligence().isLoaded).to.equal(true);
        node.setRelated('sector',{getTypeName:()=> 'PLANET'});
        expect(node.getSectorIntelligence().type).to.equal('PLANET');
        expect(node.assessStrategicValue()).to.be.an('object');
    });
});
