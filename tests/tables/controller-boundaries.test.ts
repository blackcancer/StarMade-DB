import { expect } from 'chai';
import { stub } from 'sinon';
import { ValidationError } from '../../src/core/errors.js';
import { EffectsController } from '../../src/tables/effects/EffectsController.js';
import { EntitiesController } from '../../src/tables/entities/EntitiesController.js';
import { FleetMembersController } from '../../src/tables/fleet-members/FleetMembersController.js';
import { FleetsController } from '../../src/tables/fleets/FleetsController.js';
import { FtlController } from '../../src/tables/ftl/FtlController.js';
import { IdGenTableController } from '../../src/tables/id-gen-table/IdGenTableController.js';
import { MinesController } from '../../src/tables/mines/MinesController.js';
import { NpcStatsController } from '../../src/tables/npc-stats/NpcStatsController.js';
import { PlayerMessagesController } from '../../src/tables/player-messages/PlayerMessagesController.js';
import { PlayersController } from '../../src/tables/players/PlayersController.js';
import { SectorsController } from '../../src/tables/sectors/SectorsController.js';
import { SectorsItemsController } from '../../src/tables/sectors-items/SectorsItemsController.js';
import { SystemsController } from '../../src/tables/systems/SystemsController.js';
import { TradeHistoryController } from '../../src/tables/trade-history/TradeHistoryController.js';
import { TradeNodesController } from '../../src/tables/trade-nodes/TradeNodesController.js';
import { VisibilityController } from '../../src/tables/visibility/VisibilityController.js';

/** Construct a controller at its database boundary without starting a JVM. */
function isolated(Type: any): any {
 const c = new Type({enableCaching:false});
 c.initialized=true;
 c.logger={info:stub(),debug:stub(),warn:stub(),error:stub()};
 return c;
}
const readCases: Array<[any,string,any[]]> = [
[EffectsController, 'findEffects', []],
[EffectsController, 'findByEffectUid', ['probe']],
[EffectsController, 'getTotalEffectCount', []],
[EffectsController, 'getEffectCountByEntity', [1]],
[EffectsController, 'validateEntityExists', [1]],
[EntitiesController, 'findEntities', []],
[EntitiesController, 'findEntityByUID', ['probe']],
[EntitiesController, 'getEntityStatistics', []],
[EntitiesController, 'getTotalEntityCount', []],
[FleetMembersController, 'membershipExists', [1,1]],
[FleetMembersController, 'findAll', []],
[FleetMembersController, 'getStatistics', []],
[FleetMembersController, 'countByFleet', [1]],
[FleetsController, 'fleetExistsById', [1]],
[FleetsController, 'fleetExistsByFlagship', [1]],
[FleetsController, 'findAll', []],
[FleetsController, 'countChildren', [1]],
[FleetsController, 'getStatistics', []],
[FtlController, 'ftlExistsById', [1]],
[FtlController, 'findAll', []],
[FtlController, 'getStatistics', []],
[MinesController, 'mineExistsById', [1]],
[MinesController, 'findAll', []],
[MinesController, 'getStatistics', []],
[MinesController, 'countInSector', [1,1,1]],
[NpcStatsController, 'recordExists', [{id:1,factionId:1,x:1,y:2,z:3}]],
[NpcStatsController, 'findAll', []],
[NpcStatsController, 'getStatistics', []],
[PlayerMessagesController, 'messageExistsById', [1]],
[PlayerMessagesController, 'findAll', []],
[PlayerMessagesController, 'findConversation', ['probe','probe']],
[PlayerMessagesController, 'getStatistics', []],
[PlayerMessagesController, 'countUnread', ['probe']],
[PlayersController, 'playerExistsById', [1]],
[PlayersController, 'playerExistsByName', ['probe']],
[PlayersController, 'playerExistsByStarMadeName', ['probe']],
[PlayersController, 'findPlayers', []],
[PlayersController, 'findPlayerByAccountName', ['probe']],
[PlayersController, 'findPlayerByStarMadeName', ['probe']],
[PlayersController, 'findPlayerByName', ['probe']],
[PlayersController, 'getPlayerStatistics', []],
[PlayersController, 'getTotalPlayerCount', []],
[PlayersController, 'getFactionMemberCount', [1]],
[PlayersController, 'getPlayerCountByPermission', [0]],
[SectorsController, 'findSectors', []],
[SectorsController, 'findByCoordinates', [1,1,1]],
[SectorsController, 'getSectorStatistics', []],
[SectorsController, 'getTotalSectorCount', []],
[SectorsController, 'getSectorCountByType', [0]],
[SectorsItemsController, 'findSectorsItems', []],
[SectorsItemsController, 'findBySectorId', [1]],
[SectorsItemsController, 'getStorageStatistics', []],
[SectorsItemsController, 'getTotalSectorsItemsCount', []],
[SystemsController, 'findSystems', []],
[SystemsController, 'findByCoordinates', [1,1,1]],
[SystemsController, 'getSystemStatistics', []],
[SystemsController, 'getTotalSystemCount', []],
[SystemsController, 'getSystemCountByType', [0]],
[TradeHistoryController, 'transactionExistsById', [1]],
[TradeHistoryController, 'findAll', []],
[TradeHistoryController, 'findByOwner', ['probe']],
[TradeHistoryController, 'getStatistics', []],
[TradeNodesController, 'nodeExistsById', [1]],
[TradeNodesController, 'findAll', []],
[TradeNodesController, 'getStatistics', []],
[VisibilityController, 'recordExists', [{id:1,factionId:1,x:1,y:2,z:3}]],
[VisibilityController, 'findAll', []],
[VisibilityController, 'getStatistics', []],
[VisibilityController, 'countByObserver', [1]],
[VisibilityController, 'countBySector', [1,1,1]]
];
describe('Controller database error boundaries',()=>{
 for(const [Type,method,args] of readCases) for(const failure of [new Error('database unavailable'),'database unavailable']) {
 it(Type.name+'.'+method+' preserves database failure ('+typeof failure+')',async()=>{
 const c=isolated(Type), query=stub(c,'executeQuery').callsFake(async()=>{throw failure;});
 let observed:any; try { await c[method](...args); }catch(error){observed=error;}
 expect(query.called,'database operation must be reached').to.equal(true);
 expect(observed,'database failure must reject').to.exist;
 expect(String(observed)).to.include('database unavailable');
 });
 }
});
const searchCases: Array<[any,string,any[]]> = [
[EffectsController, 'findEffects', []],
[EntitiesController, 'findEntities', []],
[FleetMembersController, 'findAll', []],
[FleetsController, 'findAll', []],
[FtlController, 'findAll', []],
[MinesController, 'findAll', []],
[NpcStatsController, 'findAll', []],
[PlayerMessagesController, 'findAll', []],
[PlayerMessagesController, 'findConversation', ['probe','probe']],
[PlayersController, 'findPlayers', []],
[SectorsController, 'findSectors', []],
[SectorsItemsController, 'findSectorsItems', []],
[SystemsController, 'findSystems', []],
[TradeHistoryController, 'findAll', []],
[TradeHistoryController, 'findByOwner', ['probe']],
[TradeNodesController, 'findAll', []],
[VisibilityController, 'findAll', []]
];
describe('Controller query option security',()=>{
 for(const [Type,method,args] of searchCases) for(const options of [{orderBy:'ID; DROP TABLE PLAYERS'}, {orderDirection:'DESC; DROP TABLE PLAYERS'},{limit:-1},{offset:0.5}]) {
 it(Type.name+'.'+method+' rejects '+JSON.stringify(options)+' before accessing the database',async()=>{
 const c=isolated(Type),query=stub(c,'executeQuery').resolves([]);
 let observed:any;try{await c[method](...args,options);}catch(error){observed=error;}
 expect(observed).to.be.instanceOf(Error);
 expect(query.called).to.equal(false);
 });
 }
});

const filters: Array<[any, Record<string,any>]> = [
 [FleetMembersController,{fleetId:0,entityId:0,missionState:'IDLE',dockingStatus:'FREE_FLOATING',flagshipOnly:true,searchTerm:'Probe'}],
 [FleetsController,{owner:'Probe',flagshipId:0,parentFleet:0,topLevelOnly:true,missionString:'IDLE',combatSetting:0,factionAccess:0,npcOnly:true,playerOwnedOnly:true,fleetType:0,searchTerm:'Probe',idleOnly:true,inCombatOnly:true}],
 [FtlController,{ftlType:0,fromX:0,fromY:0,fromZ:0,toX:0,toY:0,toZ:0,peaceZoneOnly:true,lockedOnly:true,permission:0}],
 [MinesController,{owner:'0',factionId:0,sectorX:0,sectorY:0,sectorZ:0,armedOnly:true,unarmedOnly:true,activeOnly:true,npcOnly:true,playerOwnedOnly:true}],
 [NpcStatsController,{factionId:0,sysX:0,sysY:0,sysZ:0,minFleetSpawns:0,minEntitySpawns:0,activeOnly:true,orderByActivity:true}],
 [PlayerMessagesController,{sender:'Probe',receiver:'Probe',isRead:false,sentAfter:0,sentBefore:1,hasAttachment:false,searchTerm:'Probe'}],
 [TradeHistoryController,{fromId:0,toId:0,fromOwner:'Probe',toOwner:'Probe',fromFactionId:0,toFactionId:0,successOnly:true,failedOnly:true,sentAfter:0,sentBefore:1,minTotalCost:0}],
 [TradeNodesController,{owner:'Probe',factionId:0,entityId:0,permissionPreset:0,npcOnly:true,playerOwnedOnly:true,searchTerm:'Probe',allowsNeutral:true}],
 [VisibilityController,{observerId:0,x:0,y:0,z:0,observedAfter:0,observedBefore:1,npcOnly:true,playerOnly:true,orderByRecent:true}]
];

describe('Controller filtered queries and caching',()=>{
 for(const [Type,options] of filters) {
  it(Type.name+' binds filter values and pagination',async()=>{
   const c=isolated(Type),query=stub(c,'executeQuery').resolves([]);
   expect(await c.findAll({...options,offset:2,limit:3})).to.deep.equal([]);
   const [sql,params]=query.firstCall.args;
   expect(sql).to.include(' WHERE ').and.include(' ORDER BY ').and.include(' LIMIT ? OFFSET ?');
   expect(params.slice(-2)).to.deep.equal([3,2]);
   expect(sql).not.to.include('Probe');
   expect((sql.match(/\?/g)||[]).length).to.equal(params.length);
  });
  it(Type.name+' returns cached empty results without querying',async()=>{
   const c=isolated(Type); c.config.enableCaching=true;
   c.cacheManager={get:stub().resolves([]),set:stub().resolves()};
   const query=stub(c,'executeQuery').resolves([]);
   expect(await c.findAll()).to.deep.equal([]);
   expect(query.called).to.equal(false);
  });
  it(Type.name+' populates cache and supports an unlimited query',async()=>{
   const c=isolated(Type); c.config.enableCaching=true;
   c.cacheManager={get:stub().resolves(null),set:stub().resolves()};
   const query=stub(c,'executeQuery').resolves([]);
   expect(await c.findAll({limit:0,cacheTtl:17})).to.deep.equal([]);
   expect(query.firstCall.args[0]).not.to.include('LIMIT');
   expect(c.cacheManager.set.firstCall.args.slice(1)).to.deep.equal([[],{ttl:17}]);
  });
 }
});

describe('Controller coordinate validation',()=>{
 for(const Type of [SectorsController,SystemsController]) {
  it(Type.name+' excludes record zero when checking global coordinate uniqueness',async()=>{
   const c=isolated(Type),query=stub(c,'executeQuery').resolves([]);
   await c.validateCoordinateUniqueness(1,2,3,0);
   expect(query.firstCall.args[0]).to.include('ID != ?').and.not.include('STELLAR');
   expect(query.firstCall.args[1]).to.deep.equal([1,2,3,0]);
  });
  for(const failure of [new Error('database unavailable'),'database unavailable']) {
   it(Type.name+' preserves uniqueness validation failure '+typeof failure,async()=>{
    const c=isolated(Type);stub(c,'executeQuery').callsFake(async()=>{throw failure});
    let error:any;try{await c.validateCoordinateUniqueness(1,2,3);}catch(e){error=e;}
    expect(error).to.equal(failure);
   });
  }
 }
});

describe('Fleet member schema filters',()=>{
 for(const [status,clause] of [['FREE_FLOATING','DOCKED_TO = -1'],['DOCKED_TO_FLEET_MEMBER','FLEET_MEMBERS AS TARGET_MEMBER'],['DOCKED_TO_STATION','ENTITIES AS TARGET_ENTITY'],['UNKNOWN','NOT EXISTS']]) {
  it('derives '+status+' from persisted docking references',async()=>{
   const c=isolated(FleetMembersController),query=stub(c,'executeQuery').resolves([]);
   await c.findAll({dockingStatus:status,flagshipOnly:true});
   expect(query.firstCall.args[0]).to.include(clause).and.include('FLAGSHIP_ID = FLEET_MEMBERS.ENTITY_ID');
   expect(query.firstCall.args[0]).not.to.include('DOCKING_STATUS').and.not.to.include('IS_FLAGSHIP');
  });
 }
 it('rejects an unsupported docking classification',async()=>{
  const c=isolated(FleetMembersController),query=stub(c,'executeQuery').resolves([]);
  let error:any;try{await c.findAll({dockingStatus:'UNRECOGNIZED'});}catch(e){error=e;}
  expect(error).to.be.instanceOf(Error);expect(query.called).to.equal(false);
 });
});

const bulkTypes = [FleetMembersController,FleetsController,FtlController,MinesController,NpcStatsController,PlayerMessagesController,PlayersController,TradeHistoryController,TradeNodesController,VisibilityController];
describe('Controller bulk operation accounting',()=>{
 for(const Type of bulkTypes) {
  for(const failure of [new Error('record rejected'),'record rejected']) {
   it(Type.name+' counts deleted, absent, and rejected records '+typeof failure,async()=>{
    const c=isolated(Type),del=stub(c,'delete');del.onCall(0).resolves(true);del.onCall(1).resolves(false);del.onCall(2).callsFake(async()=>{throw failure});
    const result=await c.bulkDelete([1,2,3],{logOperations:true});
    expect(result).to.include({success:1,skipped:1,failed:1});
    expect(result.errors[0]).to.include({index:2,error:'record rejected'});
   });
   it(Type.name+' stops deleting immediately when requested '+typeof failure,async()=>{
    const c=isolated(Type),del=stub(c,'delete').callsFake(async()=>{throw failure});
    let result:any,error:any;try{result=await c.bulkDelete([1,2],{continueOnError:false});}catch(e){error=e;}
    expect(del.callCount).to.equal(1);
    if(Type===PlayersController){expect(result.failed).to.equal(1);}else{expect(error).to.equal(failure);}
   });
  }
  it(Type.name+' accounts for successful and rejected inserts',async()=>{
   const c=isolated(Type);stub(c,'executeQuery').resolves([]);
   const create=stub(c,'create');create.onCall(0).resolves({getId:()=>1});create.onCall(1).rejects(new Error('record rejected'));
   const result=await c.bulkCreate([{ID:1},{ID:2}],{logOperations:true,batchSize:1});
   expect(result).to.include({success:1,failed:1,skipped:0});
   expect(result.errors[0]).to.include({index:1,error:'record rejected'});
   PlayersController.resetLastPlayerIdCache();
  });
 }
 for(const Type of [PlayersController,EffectsController,SectorsController,SystemsController,SectorsItemsController]) {
  it(Type.name+' rejects a non-integer batch size before processing records',async()=>{
   const c=isolated(Type);stub(c,'executeQuery').resolves([]);const create=stub(c,'create').resolves({getId:()=>1});
   let error:any;try{await c.bulkCreate([{ID:1}],{batchSize:NaN});}catch(e){error=e;}
   expect(error).to.be.instanceOf(Error);expect(create.called).to.equal(false);
  });
  it(Type.name+' stops all batches after the first failure',async()=>{
   const c=isolated(Type);stub(c,'executeQuery').resolves([]);const create=stub(c,'create').rejects(Type===SectorsItemsController ? new ValidationError('ITEMS',null,'size exceeds capacity') : new Error('record rejected'));
   await c.bulkCreate([{ID:1},{ID:2}],{batchSize:1,continueOnError:false,continueOnSizeError:false});
   expect(create.callCount).to.equal(1);
  });
 }
});

import { PlayersModel, PlayerRole, PlayerPermission } from '../../src/tables/players/PlayersModel.js';
/** A persisted player with a controlled permission mask. */
function player(permission=0): PlayersModel { return PlayersModel.fromRow({ID:7,NAME:'Probe',STARMADE_NAME:'Probe',FACTION:1,PERMISSION:permission}); }

describe('Player permissions and faction operations',()=>{
 for(const method of ['grantPermission','revokePermission','setPlayerRole']) {
  for(const options of [{},{reason:null},{reason:''},{reason:1},{reason:'test',changedBy:-1},{reason:'test',changedBy:'1'}]) {
   it(method+' rejects invalid audit metadata '+JSON.stringify(options),async()=>{
    const c=isolated(PlayersController),resolve=stub(c,'resolvePlayer').resolves(player());
    let error:any;try{await c[method](7,1,options);}catch(e){error=e;}
    expect(error).to.be.instanceOf(ValidationError);expect(resolve.called).to.equal(false);
   });
  }
  it(method+' rejects an absent player',async()=>{
   const c=isolated(PlayersController);stub(c,'resolvePlayer').resolves(null);
   let error:any;try{await c[method](7,1,{reason:'test',changedBy:0});}catch(e){error=e;}
   expect(error).to.be.instanceOf(ValidationError);
  });
 }
 for(const [method,start,end] of [['grantPermission',0,1],['revokePermission',1,0]] as const) {
  it(method+' updates the stored mask only when the bit changes',async()=>{
   const c=isolated(PlayersController),model=player(start);stub(c,'resolvePlayer').resolves(model);
   const update=stub(c,'update').resolves(player(end));
   expect((await c[method](7,1,{reason:'test',changedBy:0})).getPermission()).to.equal(end);
   expect(update.firstCall.args[1]).to.deep.equal({PERMISSION:end});
   update.resetHistory();expect(await c[method](7,1,{reason:'test'})).to.equal(model);expect(update.called).to.equal(false);
  });
 }
 for(const [method,roles] of [['promotePlayer',[PlayerRole.MEMBER,PlayerRole.COMMANDER,PlayerRole.CAPTAIN,PlayerRole.FULL_CONTROL]],['demotePlayer',[PlayerRole.FULL_CONTROL,PlayerRole.CAPTAIN,PlayerRole.COMMANDER,PlayerRole.MEMBER]]] as const) {
  for(let i=0;i<roles.length-1;i++) it(method+' advances one role from '+roles[i],async()=>{
   const c=isolated(PlayersController);stub(c,'resolvePlayer').resolves(player(roles[i]));const set=stub(c,'setPlayerRole').resolves(player(roles[i+1]));
   await c[method](7,{reason:'test'});expect(set.firstCall.args).to.deep.equal([7,roles[i+1],{reason:'test'}]);
  });
  for(const model of [null,player(roles[3]),player(12345)]) it(method+' rejects missing or non-transitionable role '+model?.getPermission(),async()=>{
   const c=isolated(PlayersController);stub(c,'resolvePlayer').resolves(model);let error:any;try{await c[method](7);}catch(e){error=e;}
   expect(error).to.be.instanceOf(ValidationError);
  });
 }
 for(const admin of [false,true]) it('transfers faction with correct permission reset, admin='+admin,async()=>{
  const c=isolated(PlayersController),model=player(PlayerRole.CAPTAIN);stub(model,'isAdmin').returns(admin);stub(c,'resolvePlayer').resolves(model);const update=stub(c,'update').resolves(model);
  expect(await c.transferToFaction(7,1)).to.equal(model);expect(update.called).to.equal(false);
  await c.transferToFaction(7,2,{reason:'test'});expect(update.firstCall.args[1]).to.deep.equal({FACTION:2,PERMISSION:admin?PlayerRole.CAPTAIN:PlayerRole.MEMBER});
 });
 it('uses an explicit or default reason when leaving a faction',async()=>{
  const c=isolated(PlayersController),transfer=stub(c,'transferToFaction').resolves(player());
  await c.leaveFaction(7);await c.leaveFaction(7,{reason:'departure'});
  expect(transfer.firstCall.args).to.deep.equal([7,0,{reason:'Player left faction'}]);expect(transfer.secondCall.args).to.deep.equal([7,0,{reason:'departure'}]);
 });
 for(const failure of [new Error('write rejected'),'write rejected']) for(const continueOnError of [false,true]) it('accounts permission batch failures '+typeof failure+' continue='+continueOnError,async()=>{
  const c=isolated(PlayersController),update=stub(c,'update');update.onCall(0).callsFake(async()=>{throw failure});update.onCall(1).resolves(player());
  const result=await c.bulkUpdatePermissions([7,8],1,{continueOnError,logOperations:true});expect(result).to.include({failed:1,success:continueOnError?1:0});expect(update.callCount).to.equal(continueOnError?2:1);
 });
});

import { EntityType, KnownFactions } from '../../src/tables/entities/EntitiesModel.js';
/** Read-only entity graph node used to exercise traversal independently of storage. */
function entityNode(id:number,parent=-1,root=-1):any { return {getId:()=>id,getUid:()=>`ENTITY_${id}`,getX:()=>0,getY:()=>0,getZ:()=>0,getDockedTo:()=>parent,getDockedRoot:()=>root,isDocked:()=>parent!==-1,getDockedEntitiesCount:()=>0,getEntitySummary:()=>({id})}; }

describe('Entity graph and analytics boundaries',()=>{
 for(const length of [1,11,51]) it('analyzes a docking chain of '+length+' entities',async()=>{
  const c=isolated(EntitiesController),nodes=Array.from({length},(_,i)=>entityNode(i+1,i===0?-1:i,1));
  stub(c,'resolveEntity').resolves(nodes[length-1]);stub(c,'findById').resolves(nodes[0]);stub(c,'findEntities').resolves(nodes.slice(1));
  const result=await c.getDockingChain(length,{includePerformanceMetrics:true,maxDepth:60});
  expect(result).to.include({totalEntities:length,chainDepth:length-1});expect(result.rootEntity).to.equal(nodes[0]);
  expect(result.performanceMetrics.complexity).to.equal(length<=10?'LOW':length<=50?'MEDIUM':'HIGH');
  expect(result.chainStructure.map((n:any)=>n.depth)).to.deep.equal(Array.from({length},(_,i)=>i));
 });
 it('bounds recursive traversal when docking data cycles',async()=>{
  const c=isolated(EntitiesController),node=entityNode(1,1);stub(c,'resolveEntity').resolves(node);stub(c,'findEntities').resolves([node]);
  const result=await c.getDockingChain(1,{maxDepth:2});expect(result.chainDepth).to.equal(2);expect(result.totalEntities).to.equal(3);expect(result.performanceMetrics).to.equal(undefined);
 });
 it('falls back to the supplied entity when its recorded root is absent',async()=>{
  const c=isolated(EntitiesController),node=entityNode(1,2,99);stub(c,'resolveEntity').resolves(node);stub(c,'findById').resolves(null);stub(c,'findEntities').resolves([]);
  expect((await c.getDockingChain(1)).rootEntity).to.equal(node);
 });
 for(const method of ['getDockingChain','getEntityAnalytics']) it(method+' rejects a missing entity',async()=>{
  const c=isolated(EntitiesController);stub(c,'resolveEntity').resolves(null);let error:any;try{await c[method](1);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const rootDockedTo of [-1,'-1',2]) it('validates persisted docking root '+rootDockedTo,async()=>{
  const c=isolated(EntitiesController),find=stub(c,'findById');find.onCall(0).resolves(entityNode(1));find.onCall(1).resolves({...entityNode(2),getDockedTo:()=>rootDockedTo});
  let error:any;try{await c.validateDockingChain(1,2);}catch(e){error=e;}
  if(rootDockedTo===2)expect(error).to.be.instanceOf(ValidationError);else expect(error).to.equal(undefined);
 });
 it('does not resolve an undocked entity',async()=>{const c=isolated(EntitiesController),find=stub(c,'findById');await c.validateDockingChain(-1);expect(find.called).to.equal(false);});
 for(const root of [undefined,-1,2]) it('requires docking references to exist, root='+root,async()=>{
  const c=isolated(EntitiesController),find=stub(c,'findById');find.onCall(0).resolves(root===undefined?null:entityNode(1));find.onCall(1).resolves(null);
  let error:any;try{await c.validateDockingChain(1,root);}catch(e){error=e;}if(root===-1)expect(error).to.equal(undefined);else expect(error).to.be.instanceOf(ValidationError);
 });
 for(const options of [{},{includeSpatialIntelligence:false,includeDockingAnalysis:false,includeRelationshipStatus:false}]) it('includes requested analytics '+JSON.stringify(options),async()=>{
  const c=isolated(EntitiesController),node=entityNode(1,2);stub(c,'resolveEntity').resolves(node);stub(c,'performSpatialAnalysis').resolves({density:3});stub(c,'getDockingChain').resolves({totalEntities:2});
  const result=await c.getEntityAnalytics(1,options);expect(result.id).to.equal(1);expect(result.analysisTimestamp).to.be.a('string');
  if(options.includeSpatialIntelligence===false){expect(result).not.to.have.property('spatialIntelligence');}else{expect(result.spatialIntelligence).to.deep.equal({density:3});expect(result.dockingAnalysis).to.deep.equal({totalEntities:2});}
 });
 for(const [faction,name] of [[KnownFactions.NO_FACTION,'No Faction'],[KnownFactions.TRADING_GUILD,'Trading Guild'],[KnownFactions.OUTCASTS,'Outcasts'],[KnownFactions.SCAVENGERS,'Scavengers'],[77,'Player Faction 77'],[-77,'Unknown Faction -77']] as const) it('labels faction '+faction,()=>{expect(isolated(EntitiesController).getFactionDisplayName(faction)).to.equal(name);});
 for(const type of [EntityType.PLANET,EntityType.SUN,EntityType.BLACK_HOLE,EntityType.PLANET_CORE]) it('requires a unique position for type '+type,()=>{expect(isolated(EntitiesController).requiresUniquePosition(type)).to.equal(true);});
 it('allows ships to share a sector',()=>{expect(isolated(EntitiesController).requiresUniquePosition(EntityType.SHIP)).to.equal(false);});
});

describe('Controller count normalization',()=>{
 for(const method of ['getTotalEffectCount','getEffectCountByEntity']) for(const rows of [[],[{}],[{total_count:'3'}],[{effect_count:'3'}],[{'COUNT(*)':'3'}],[{count:'3'}],[{C1:'3'}]]) it(method+' decodes '+JSON.stringify(rows),async()=>{
  const c=isolated(EffectsController);stub(c,'executeQuery').resolves(rows);expect(await c[method](1)).to.equal(rows.length&&Object.keys(rows[0]).length?3:0);
 });
 for(const [Type,method,args] of readCases.filter(([,method])=>/Count|^count/.test(method))) it(Type.name+'.'+method+' handles no aggregate rows',async()=>{
  const c=isolated(Type);stub(c,'executeQuery').resolves([]);expect(await c[method](...args)).to.equal(0);
 });
});

const wrappers: Array<[any,string,any[],string,any[]]> = [
 [FleetMembersController,'findByFleet',[7,{limit:3}],'findAll',[{limit:3,fleetId:7}]],
 [FleetsController,'findChildren',[7,{limit:3}],'findAll',[{limit:3,parentFleet:7}]],
 [FleetsController,'findNPCFleets',[],'findAll',[{npcOnly:true}]],
 [FleetsController,'findPlayerFleets',[],'findAll',[{playerOwnedOnly:true}]],
 [FleetsController,'findInCombat',[],'findAll',[{inCombatOnly:true}]],
 [MinesController,'findInSector',[1,2,3,{limit:4}],'findAll',[{limit:4,sectorX:1,sectorY:2,sectorZ:3}]],
 [TradeNodesController,'findByFaction',[7,{limit:3}],'findAll',[{limit:3,factionId:7}]],
 [SystemsController,'findByOwnerUid',['entity-probe',{limit:3}],'findSystems',[{limit:3,ownerUid:'entity-probe'}]],
 [PlayersController,'factionMembersExist',[7],'playersExist',[{factionId:7}]]
];
describe('Controller specialized query delegation',()=>{
 for(const [Type,method,args,delegate,expected] of wrappers) it(Type.name+'.'+method+' preserves filters',async()=>{
  const c=isolated(Type),sentinel=[{}],find=stub(c,delegate).resolves(sentinel);
  expect(await c[method](...args)).to.equal(sentinel);expect(find.firstCall.args).to.deep.equal(expected);
 });
 for(const Type of [FtlController,MinesController,PlayerMessagesController,TradeHistoryController,TradeNodesController]) it(Type.name+'.findOne returns the primary key lookup',async()=>{
  const c=isolated(Type),sentinel={},find=stub(c,'findById').resolves(sentinel);expect(await c.findOne(7)).to.equal(sentinel);expect(find.firstCall.args).to.deep.equal([7]);
 });
});

describe('Player private helpers',()=>{
 for(const method of ['playersExist','independentPlayersExist']) {
  for(const rows of [[],[{C1:1}]]) it(method+' returns existence for '+rows.length+' rows',async()=>{
   const c=isolated(PlayersController),query=stub(c,'executeQuery').resolves(rows);
   expect(await c[method]()).to.equal(rows.length>0);expect(query.firstCall.args[0]).to.include('LIMIT 1');
  });
  for(const failure of [new Error('query failed'),'query failed']) it(method+' preserves failure '+typeof failure,async()=>{
   const c=isolated(PlayersController);stub(c,'executeQuery').callsFake(async()=>{throw failure});let error:any;try{await c[method]();}catch(e){error=e;}expect(String(error)).to.include('query failed');
  });
 }
 it('binds combined existence filters including faction and role zero',async()=>{
  const c=isolated(PlayersController),query=stub(c,'executeQuery').resolves([]);await c.playersExist({searchTerm:'PrObE',factionId:0,role:0,activeOnly:true,factionMembersOnly:true});
  expect(query.firstCall.args[1]).to.deep.equal(['%probe%','%probe%',0,0]);expect(query.firstCall.args[0]).to.include('PERMISSION >= 0').and.include('FACTION != 0');
 });
 for(const rows of [[],[{max_id:null}],[{max_id:'41'}]]) it('allocates the ID after the persisted maximum '+JSON.stringify(rows),async()=>{
  PlayersController.resetLastPlayerIdCache();const c=isolated(PlayersController);stub(c,'executeQuery').resolves(rows);
  expect(await c.generatePlayerIdFromDatabase()).to.equal(rows[0]?.max_id?42:1);
  expect(PlayersController.getLastPlayerIdFromCache()).to.equal(rows[0]?.max_id?42:1);
  PlayersController.resetLastPlayerIdCache();
 });
 for(const method of ['initializeLastPlayerIdCache','generatePlayerIdFromDatabase']) for(const failure of [new Error('query failed'),'query failed']) it(method+' propagates failure '+typeof failure,async()=>{
  const c=isolated(PlayersController);stub(c,'executeQuery').callsFake(async()=>{throw failure});let error:any;try{await c[method]();}catch(e){error=e;}expect(error).to.equal(failure);
 });
 it('uses the database fallback when the cache state has no maximum',async()=>{
  const Type:any=PlayersController;Type.lastPlayerId=null;Type.isLastPlayerIdInitialized=true;const c=isolated(Type);stub(c,'executeQuery').resolves([]);
  expect(await c.generatePlayerId()).to.equal(1);PlayersController.resetLastPlayerIdCache();
 });
 it('never decreases the cached maximum when an older ID is recorded',()=>{
  const Type:any=PlayersController;Type.resetLastPlayerIdCache();Type.updateLastPlayerId(8);Type.updateLastPlayerId(4);expect(Type.getLastPlayerIdFromCache()).to.equal(8);Type.resetLastPlayerIdCache();
 });
 for(const nameExists of [false,true]) it('rejects duplicate username at the correct lookup, accountExists='+nameExists,async()=>{
  const c=isolated(PlayersController);stub(c,'playerExistsByName').resolves(nameExists);const starmade=stub(c,'playerExistsByStarMadeName').resolves(true);
  let error:any;try{await c.validateUsernameUniqueness('Account','Game');}catch(e){error=e;}expect(String(error)).to.include(nameExists?'Account':'Game');expect(starmade.called).to.equal(!nameExists);
 });
});

describe('Player permission search',()=>{
 it('retains only players with the requested bit in a combined mask',async()=>{
  const c=isolated(PlayersController),allowed=player(3),denied=player(0),find=stub(c,'findPlayers').resolves([allowed,denied]);
  expect(await c.findPlayersWithPermission(1,{limit:3})).to.deep.equal([allowed]);expect(find.firstCall.args[0]).to.deep.equal({limit:3});
 });
});

const cacheCases: Array<[any,string,string,string]> = [[PlayersController,'clearPlayerCaches','players:*','PLAYERS'],[EntitiesController,'clearEntityCaches','entities:*','ENTITIES'],[EffectsController,'clearEffectCaches','effects:*','EFFECTS'],[SectorsController,'clearSectorCaches','sectors:*','SECTORS'],[SystemsController,'clearSystemCaches','systems:*','SYSTEMS'],[SectorsItemsController,'clearSectorsItemsCaches','sectors-items:*','SECTORS_ITEMS']];
describe('Controller private cache invalidation',()=>{
 for(const [Type,method,pattern,table] of cacheCases) {
  it(Type.name+' tolerates an absent cache',async()=>{await isolated(Type)[method](7);});
  it(Type.name+' clears its aggregate and identity cache entries',async()=>{
   const c=isolated(Type);c.cacheManager={clear:stub().resolves()};await c[method](7);
   expect(c.cacheManager.clear.firstCall.args[0]).to.equal(pattern);expect(c.cacheManager.clear.secondCall.args[0]).to.equal(table+':by-id:7');
  });
 }
});

describe('Spatial private helpers',()=>{
 for(const [Type,method] of [[SectorsController,'resolveSector'],[SystemsController,'resolveSystem']] as const) {
  for(const identifier of [7,'7','(1, -2, 3)',{x:1,y:-2,z:3},{X:1,Y:-2,Z:3},null,{},'unknown']) it(Type.name+' resolves '+JSON.stringify(identifier),async()=>{
   const c=isolated(Type),sentinel={},id=stub(c,'findById').resolves(sentinel),coords=stub(c,'findByCoordinates').resolves(sentinel);
   const result=await c[method](identifier);
   if(identifier===7||identifier==='7'){expect(result).to.equal(sentinel);expect(id.firstCall.args).to.deep.equal([7]);}
   else if(identifier==='(1, -2, 3)'||(identifier&&typeof identifier==='object'&&Object.keys(identifier).length)){expect(result).to.equal(sentinel);expect(coords.firstCall.args).to.deep.equal([1,-2,3]);}
   else{expect(result).to.equal(null);expect(id.called||coords.called).to.equal(false);}
  });
  it(Type.name+' returns null for an absent numeric identifier',async()=>{const c=isolated(Type);stub(c,'findById').resolves(null);expect(await c[method](7)).to.equal(null);});
  for(const [x,y,z,label] of [[0,0,0,''],[1,1,1,'+X+Y+Z'],[-1,-1,-1,'-X-Y-Z']] as const) it(Type.name+' calculates direction '+label,()=>{
   const c=isolated(Type),from={getX:()=>0,getY:()=>0,getZ:()=>0},to={getX:()=>x,getY:()=>y,getZ:()=>z};expect(c.calculateDirection(from,to)).to.equal(label);
  });
 }
});

describe('Bulk insertion failure policies',()=>{
 for(const Type of bulkTypes) for(const continueOnError of [true,false]) it(Type.name+' handles a non-Error insert failure, continue='+continueOnError,async()=>{
  const c=isolated(Type);stub(c,'executeQuery').resolves([]);const create=stub(c,'create').callsFake(async()=>{throw 'insert rejected'});
  let result:any,error:any;try{result=await c.bulkCreate([{ID:1},{ID:2}],{continueOnError,batchSize:1});}catch(e){error=e;}
  expect(create.callCount).to.equal(continueOnError?2:1);
  if(continueOnError||Type===PlayersController){expect(result.failed).to.equal(continueOnError?2:1);expect(result.errors[0].error).to.equal('insert rejected');}else expect(error).to.equal('insert rejected');
  PlayersController.resetLastPlayerIdCache();
 });
});

describe('Empty table statistics',()=>{
 for(const [Type,method,args] of readCases.filter(([,method])=>/Statistics$/.test(method))) it(Type.name+'.'+method+' handles empty aggregates',async()=>{
  const c=isolated(Type);stub(c,'executeQuery').callsFake(async(sql:any)=>/GROUP BY/i.test(sql)?[]:[{}]);
  const result=await c[method](...args);expect(result).to.be.an('object');
  const visit=(value:any)=>{if(typeof value==='number')expect(Number.isFinite(value),'finite statistic').to.equal(true);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(result);
 });
});

describe('Read and mutation edge cases',()=>{
 it('maps an absent fleet membership to null and rejects updates',async()=>{
  const c=isolated(FleetMembersController);stub(c,'executeQuery').resolves([]);
  expect(await c.findOne(1,2)).to.equal(null);expect(await c.delete({fleetId:1,entityId:2})).to.equal(false);
  let error:any;try{await c.update({fleetId:1,entityId:2},{MISSION_STRING:'IDLE'});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 it('rejects an existing fleet membership before inserting',async()=>{
  const c=isolated(FleetMembersController);stub(c,'membershipExists').resolves(true);
  let error:any;try{await c.create({FLEET_ID:1,ENTITY_ID:2});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 it('counts only successfully removed fleet members',async()=>{
  const c=isolated(FleetMembersController);stub(c,'findByFleet').resolves([{get:()=>1},{get:()=>2}]);const del=stub(c,'delete');del.onCall(0).resolves(true);del.onCall(1).resolves(false);
  expect(await c.removeAllFromFleet(7)).to.equal(1);
 });
 for(const Type of [TradeHistoryController,TradeNodesController]) for(const owner of ['', '   ']) it(Type.name+' refuses an empty owner',async()=>{
  const c=isolated(Type);let error:any;try{await c.findByOwner(owner);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const [Type,method,args] of [[PlayerMessagesController,'findConversation',['A','B']],[TradeHistoryController,'findByOwner',['A']]] as Array<[any,string,any[]]>) for(const options of [{limit:0},{limit:2,offset:3}]) it(Type.name+'.'+method+' applies safe pagination '+JSON.stringify(options),async()=>{
  const c=isolated(Type),query=stub(c,'executeQuery').resolves([]);expect(await c[method](...args,options)).to.deep.equal([]);
  const sql=query.firstCall.args[0];if(options.limit===0)expect(sql).not.to.include('LIMIT');else expect(sql).to.include('LIMIT 2').and.include('OFFSET 3');
 });
 it('selects messages with attachments explicitly',async()=>{const c=isolated(PlayerMessagesController),query=stub(c,'executeQuery').resolves([]);await c.findAll({hasAttachment:true});expect(query.firstCall.args[0]).to.include('ATT_ID IS NOT NULL');});
 for(const method of ['markAllAsRead','deleteAllForPlayer']) for(const failure of [new Error('query failed'),'query failed']) it(method+' preserves a failed statement '+typeof failure,async()=>{
  const c=isolated(PlayerMessagesController);stub(c,method==='markAllAsRead'?'executeUpdate':'executeQuery').callsFake(async()=>{throw failure});let error:any;try{await c[method]('Probe');}catch(e){error=e;}expect(String(error)).to.include('query failed');
 });
 it('clears observer records and returns the number found',async()=>{
  const c=isolated(VisibilityController),update=stub(c,'executeUpdate').resolves(2);expect(await c.clearObserver(7)).to.equal(2);expect(update.firstCall.args).to.deep.equal(['DELETE FROM VISIBILITY WHERE ID = ?', [7]]);
 });
});

import { SectorsModel, ProtectionLevel } from '../../src/tables/sectors/SectorsModel.js';
describe('Sector protection and neighbors',()=>{
 for(const [method,before,bit,after] of [['grantProtection',1,2,3],['revokeProtection',3,2,1]] as const) {
  it(method+' changes only the requested protection bit',async()=>{
   const c=isolated(SectorsController),sector=SectorsModel.fromRow({ID:7,X:0,Y:0,Z:0,PROTECTION:before});stub(c,'resolveSector').resolves(sector);const update=stub(c,'update').resolves(sector);
   expect(await c[method](7,bit)).to.equal(sector);expect(update.firstCall.args).to.deep.equal([7,{PROTECTION:after},{returnRecord:true}]);
  });
  it(method+' rejects an absent sector',async()=>{const c=isolated(SectorsController);stub(c,'resolveSector').resolves(null);let error:any;try{await c[method](7,1);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
 }
 it('removes all protection using the normal protection level',async()=>{
  const c=isolated(SectorsController),set=stub(c,'setProtectionLevel').resolves({});await c.removeAllProtection(7,{reason:'test'});expect(set.firstCall.args).to.deep.equal([7,ProtectionLevel.NORMAL,{reason:'test'}]);
 });
 it('queries six face-adjacent sectors and omits missing ones',async()=>{
  const c=isolated(SectorsController),sector=SectorsModel.fromRow({ID:7,X:0,Y:0,Z:0});stub(c,'resolveSector').resolves(sector);const find=stub(c,'findByCoordinates').resolves(null);find.onFirstCall().resolves(sector);
  expect(await c.getAdjacentSectors(7)).to.deep.equal([sector]);expect(find.getCalls().map(call=>call.args)).to.deep.equal([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]);
 });
 it('rejects neighbor lookup for a missing center',async()=>{const c=isolated(SectorsController);stub(c,'resolveSector').resolves(null);let error:any;try{await c.getAdjacentSectors(7);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
});

import { BaseController } from '../../src/tables/BaseController.js';
import { SystemsModel } from '../../src/tables/systems/SystemsModel.js';
import { EntitiesModel } from '../../src/tables/entities/EntitiesModel.js';
import { EffectsModel } from '../../src/tables/effects/EffectsModel.js';
import { SectorsItemsModel, MAX_ITEMS_SIZE } from '../../src/tables/sectors-items/SectorsItemsModel.js';

describe('Controller update validation boundaries',()=>{
 for(const [Type,Model,resolve] of [[SectorsController,SectorsModel,'resolveSector'],[SystemsController,SystemsModel,'resolveSystem']] as const) {
  for(const data of [{X:1},{Y:1},{Z:1}]) it(Type.name+' rejects coordinate edits by default '+JSON.stringify(data),async()=>{
   const c=isolated(Type);stub(c,resolve).resolves(Model.fromRow({ID:7,X:0,Y:0,Z:0}));let error:any;try{await c.update(7,data);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
  });
  for(const data of [{X:1},{Y:1},{Z:1},{X:0,Y:0,Z:0},{X:undefined}]) it(Type.name+' validates only changed coordinate tuples '+JSON.stringify(data),async()=>{
   const c=isolated(Type),model=Model.fromRow({ID:7,X:0,Y:0,Z:0});stub(c,resolve).resolves(model);const unique=stub(c,'validateCoordinateUniqueness').resolves();const update=stub(BaseController.prototype,'update').resolves(model);
   try{await c.update(7,data,{allowCoordinateUpdates:true,allowBinaryUpdates:false,updateReplenishedTime:true});expect(update.called).to.equal(true);expect(unique.called).to.equal(Object.values(data).includes(1));}finally{update.restore();}
  });
 }
 for(const data of [{INFOS:Buffer.alloc(0)},{RESOURCES:Buffer.alloc(0)}]) it('rejects protected binary updates '+Object.keys(data),async()=>{
  const c=isolated(SystemsController);stub(c,'resolveSystem').resolves(SystemsModel.fromRow({ID:7}));let error:any;try{await c.update(7,data,{allowBinaryUpdates:false});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const value of [1,{},true]) it('rejects invalid resource buffer '+JSON.stringify(value),async()=>{
  const c=isolated(SystemsController);stub(c,'resolveSystem').resolves(SystemsModel.fromRow({ID:7}));let error:any;try{await c.update(7,{RESOURCES:value});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const data of [{},{TYPE:undefined},{TYPE:1}]) it('honors type update protection '+JSON.stringify(data),async()=>{
  const c=isolated(EffectsController),model=EffectsModel.fromRow({ID:7});stub(c,'findById').resolves(model);const update=stub(BaseController.prototype,'update').resolves(model);let error:any;
  try{try{await c.update(7,data,{allowTypeUpdates:false});}catch(e){error=e;}if(data.TYPE===1)expect(error).to.be.instanceOf(ValidationError);else expect(update.called).to.equal(true);}finally{update.restore();}
 });
 it('validates a changed effect entity before updating',async()=>{
  const c=isolated(EffectsController),model=EffectsModel.fromRow({ID:7});stub(c,'findById').resolves(model);const validate=stub(c,'validateEntityExists').resolves(),update=stub(BaseController.prototype,'update').resolves(model);
  try{await c.update(7,{ENTITY_ID:2},{allowEntityIdUpdates:true});expect(validate.firstCall.args).to.deep.equal([2]);}finally{update.restore();}
 });
 for(const bytes of [MAX_ITEMS_SIZE+1,1]) it('rejects invalid item buffer size '+bytes,async()=>{
  const c=isolated(SectorsItemsController);stub(c,'resolveRecord').resolves(SectorsItemsModel.fromRow({ID:7,ITEMS:Buffer.alloc(0)}));let error:any;try{await c.update(7,{ITEMS:Buffer.alloc(bytes)});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const data of [{ID:undefined},{ID:7},{ID:8}]) it('validates a changed sector link '+JSON.stringify(data),async()=>{
  const c=isolated(SectorsItemsController),model=SectorsItemsModel.fromRow({ID:7,ITEMS:Buffer.alloc(0)});stub(c,'resolveRecord').resolves(model);const validate=stub(c,'validateSectorReference').resolves(),update=stub(BaseController.prototype,'update').resolves(model);
  try{await c.update(7,data,{updateSectorLink:true});expect(validate.called).to.equal(data.ID===8);}finally{update.restore();}
 });
});

describe('Exact mutation counts',()=>{
 for(const [Type,method,args] of [[EffectsController,'removeEffectsFromEntity',[7]],[PlayerMessagesController,'markAllAsRead',['Probe']],[VisibilityController,'clearObserver',[7]]] as Array<[any,string,any[]]>) {
  for(const affected of [0,3]) it(Type.name+'.'+method+' returns '+affected+' affected rows',async()=>{const c=isolated(Type);stub(c,'executeUpdate').resolves(affected);expect(await c[method](...args)).to.equal(affected);});
  for(const failure of [new Error('write failed'),'write failed']) it(Type.name+'.'+method+' propagates '+typeof failure+' database error',async()=>{const c=isolated(Type);stub(c,'executeUpdate').callsFake(async()=>{throw failure});let error:any;try{await c[method](...args);}catch(e){error=e;}expect(String(error)).to.include('write failed');});
 }
});

describe('Entity docking query integrity',()=>{
 it('binds the exact parent entity when looking up docked dependents',async()=>{
  const c=isolated(EntitiesController),query=stub(c,'executeQuery').resolves([]);await c.findEntities({dockedToId:0});expect(query.firstCall.args[0]).to.include('DOCKED_TO = ?');expect(query.firstCall.args[1]).to.include(0);
 });
 for(const [filter,condition] of [['rootEntitiesOnly','(DOCKED_TO = -1 OR DOCKED_TO = DOCKED_ROOT)'],['untouchedOnly','(TOUCHED = FALSE OR TOUCHED IS NULL)'],['spawnedOnly','(SPAWNED_ONLY_IN_DB = FALSE OR SPAWNED_ONLY_IN_DB IS NULL)']]) it('keeps '+filter+' within other AND filters',async()=>{
  const c=isolated(EntitiesController),query=stub(c,'executeQuery').resolves([]);await c.findEntities({[filter]:true,factionId:7});expect(query.firstCall.args[0]).to.include(condition).and.include('FACTION = ?');
 });
 it('checks actual docked children before deleting an entity',async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,UID:'probe',TYPE:0,X:0,Y:0,Z:0});stub(c,'resolveEntity').resolves(model);const find=stub(c,'findEntities').resolves([]),del=stub(BaseController.prototype,'delete').resolves(true);
  try{expect(await c.delete(7)).to.equal(true);expect(find.firstCall.args[0]).to.deep.equal({dockedToId:7,limit:1,skipCache:true});}finally{del.restore();}
 });
 it('does not truncate a docking chain lookup to an arbitrary first hundred entities',async()=>{
  const c=isolated(EntitiesController),node=entityNode(7);stub(c,'resolveEntity').resolves(node);const find=stub(c,'findEntities').resolves([]);await c.getDockingChain(7);expect(find.firstCall.args[0]).to.deep.equal({dockedToId:7,limit:0});
 });
});

import { EffectCategory, EffectType } from '../../src/tables/effects/EffectsModel.js';
import { KnownSystemFactions } from '../../src/tables/systems/SystemsModel.js';
describe('Effect and spatial analytics',()=>{
 for(const [combat,operation,impact] of [[true,true,'high'],[true,false,'medium'],[false,true,'medium'],[false,false,'low']] as const) it('classifies '+impact+' effect impact, combat='+combat+', operation='+operation,async()=>{
  const c=isolated(EffectsController),effect=EffectsModel.fromRow({ID:1,ENTITY_ID:7,TYPE:EffectType.STRUCTURE,EFFECT_UID:'test'});stub(effect,'affectsCombatPerformance').returns(combat);stub(effect,'affectsShipOperation').returns(operation);stub(effect,'hasEntityLoaded').returns(true);stub(effect,'getEntityName').returns('Probe');stub(effect,'getEntityTypeName').returns('Ship');stub(c,'findByEntityId').resolves([effect]);
  const result=await c.getEntityEffectSummary(7,{sortByType:false});expect(result.performanceImpact.overallImpact).to.equal(impact);expect(result.entityName).to.equal('Probe');
  stub(c,'findMany').resolves([effect]);const stats=await c.getEffectStatistics();expect(stats.performanceImpact).to.deep.equal({hybridEffects:combat&&operation?1:0,combatEffects:combat&&!operation?1:0,operationEffects:operation&&!combat?1:0,neutralEffects:!combat&&!operation?1:0});
 });
 it('returns zero effect analytics for an empty table',async()=>{const c=isolated(EffectsController);stub(c,'findMany').resolves([]);const result=await c.getEffectStatistics();expect(result.recognitionStats.recognitionRate).to.equal(0);expect(result.entityCoverage).to.deep.equal({entitiesWithEffects:0,averageEffectsPerEntity:0,maxEffectsOnEntity:0});});
 for(const failure of [new Error('read failed'),'read failed']) it('propagates effect analytics failure '+typeof failure,async()=>{const c=isolated(EffectsController);stub(c,'findMany').callsFake(async()=>{throw failure});let error:any;try{await c.getEffectStatistics();}catch(e){error=e;}expect(String(error)).to.include('read failed');});
 for(const [protectedCount,centerProtection,level] of [[3,0,'SAFE'],[1,0,'MODERATE'],[0,1,'MODERATE'],[0,0,'DANGEROUS']] as const) it('classifies sector neighborhood security '+level+' protected='+protectedCount,async()=>{
  const c=isolated(SectorsController),center=SectorsModel.fromRow({ID:1,X:0,Y:0,Z:0,STELLAR:1,PROTECTION:centerProtection});stub(c,'resolveSector').resolves(center);
  const neighbors=Array.from({length:3},(_,i)=>{const sector=SectorsModel.fromRow({ID:i+2,X:i+1,Y:0,Z:0,STELLAR:i===0?1:2,PROTECTION:i<protectedCount?1:0,TYPE:999});stub(sector,'getEconomicActivityScore').returns(i===0?1:0);return {sector,distance:i+1};});stub(c,'findWithinDistance').resolves([{sector:center,distance:0},...neighbors]);
  const result=await c.getSpatialMap(1);expect(result.summary).to.include({securityLevel:level,totalSectors:3,economicSectors:1,sameSystemSectors:1,differentSystemSectors:2});expect(result.summary.dominantType.typeName).to.equal('UNKNOWN_999');
 });
 it('handles an isolated sector',async()=>{const c=isolated(SectorsController);stub(c,'resolveSector').resolves(SectorsModel.fromRow({ID:1,PROTECTION:0}));stub(c,'findWithinDistance').resolves([]);const result=await c.getSpatialMap(1);expect(result.summary.totalSectors).to.equal(0);expect(result.summary.dominantType).to.equal(undefined);});
 for(const [Type,resolve,method,args] of [[SectorsController,'resolveSector','getSpatialMap',[]],[SystemsController,'resolveSystem','getTerritoryMap',[]],[SystemsController,'resolveSystem','getAdjacentSystems',[]],[SystemsController,'resolveSystem','transferOwnership',['uid',7,{x:0,y:0,z:0}]],[SystemsController,'resolveSystem','claimSystem',['uid',7,{x:0,y:0,z:0}]]] as Array<[any,string,string,any[]]>) it(Type.name+'.'+method+' requires its center to exist',async()=>{const c=isolated(Type);stub(c,resolve).resolves(null);let error:any;try{await c[method](7,...args);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
 for(const [faction,label] of [[KnownSystemFactions.NEUTRAL,'Neutral'],[KnownSystemFactions.TRADING_GUILD,'Trading Guild'],[KnownSystemFactions.OUTCASTS,'Outcasts'],[KnownSystemFactions.SCAVENGERS,'Scavengers'],[77,'Player Faction 77'],[-77,'Faction -77']] as const) it('labels system faction '+faction,()=>{expect(isolated(SystemsController).getFactionNameById(faction)).to.equal(label);});
 it('includes systems owned by the center faction in territory analytics',async()=>{
  const c=isolated(SystemsController),center=SystemsModel.fromRow({ID:1,X:0,Y:0,Z:0,OWNER_FACTION:7}),neighbor=SystemsModel.fromRow({ID:2,X:1,Y:0,Z:0,OWNER_FACTION:7,OWNER_UID:'probe'});stub(neighbor,'isOwned').returns(true);stub(c,'resolveSystem').resolves(center);stub(c,'findWithinDistance').resolves([{system:neighbor,distance:1}]);expect((await c.getTerritoryMap(1)).summary.ownedBySameFaction).to.equal(1);
 });
});

const tradeRecord={FROM_ID:1,TO_ID:2,FROM_OWNER:'A',TO_OWNER:'B',FROM_FACTION_ID:0,TO_FACTION_ID:0,TOTAL_COST:0,DELIVERY_COST:0,SENT:0,RECEIVED:0,VOLUME:1};
describe('Controller creation defaults',()=>{
 for(const [Type,data,expected] of [[FleetsController,{FLAGSHIP_ID:1},{PARENT_FLEET:-1}],[MinesController,{OWNER:'1'},{ARMED:false,ARMED_IN_SECS:-1}],[NpcStatsController,{ID:0,SYS_X:0,SYS_Y:0,SYS_Z:0},{FLEET_SPAWNS:0,ENTITY_SPAWNS:0}],[PlayerMessagesController,{SENDER:'A',RECEIVER:'B',TOPIC:'t',MESSAGE:'m'},{READ:false}],[TradeHistoryController,tradeRecord,{SUCCESS:false}]] as Array<[any,any,any]>) it(Type.name+' sets defaults without modifying input',async()=>{
  const c=isolated(Type),original={...data},create=stub(BaseController.prototype,'create').resolves({} as any);try{await c.create(data);expect(create.firstCall.args[0]).to.include(expected);expect(data).to.deep.equal(original);}finally{create.restore();}
 });
 for(const missing of ['TOPIC','MESSAGE']) it('requires message '+missing,async()=>{
  const c=isolated(PlayerMessagesController),data:any={SENDER:'A',RECEIVER:'B',TOPIC:'t',MESSAGE:'m'};delete data[missing];let error:any;try{await c.create(data);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 it('rejects negative delivery costs',async()=>{const c=isolated(TradeHistoryController);let error:any;try{await c.create({...tradeRecord,DELIVERY_COST:-1});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
 for(const armed of [true,false]) it('sets mine arming='+armed,async()=>{const c=isolated(MinesController);stub(c,'mineExistsById').resolves(true);const update=stub(c,'update').resolves({});await c[armed?'armMine':'disarmMine'](7);expect(update.firstCall.args).to.deep.equal([7,{ARMED:armed,ARMED_IN_SECS:-1}]);});
 it('delegates deletion of a mine by primary key',async()=>{const c=isolated(MinesController),del=stub(BaseController.prototype,'delete').resolves(true);stub(c,'mineExistsById').resolves(true);try{expect(await c.delete(7)).to.equal(true);expect(del.firstCall.args).to.deep.equal([7,{}]);}finally{del.restore();}});
 for(const method of ['incrementFleetSpawns','incrementEntitySpawns']) for(const value of [null,3]) it(method+' increments nullable stored count '+value,async()=>{
  const c=isolated(NpcStatsController);stub(c,'findOne').resolves({get:()=>value});const update=stub(c,'update').resolves({}),key={id:7,sysX:1,sysY:2,sysZ:3};await c[method](key);expect(update.firstCall.args[1]).to.deep.equal({[method==='incrementFleetSpawns'?'FLEET_SPAWNS':'ENTITY_SPAWNS']:(value??0)+1});
 });
 it('rejects a negative entity spawn count when decrements are disabled',async()=>{const c=isolated(NpcStatsController);let error:any;try{await c.update({id:7,sysX:1,sysY:2,sysZ:3},{ENTITY_SPAWNS:-1});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
});

describe('Distribution fallbacks',()=>{
 for(const [Type,column,key,expectedKey] of [[FleetMembersController,'MISSION_STRING','missionDistribution','UNKNOWN'],[FleetsController,'MISSION_STRING','missionDistribution','UNKNOWN'],[FtlController,'TYPE','byType','999'],[TradeNodesController,'PERMISSION','permissionDistribution','-1']] as Array<[any,string,string,string]>) it(Type.name+' retains an unknown distribution value',async()=>{
  const c=isolated(Type);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('GROUP BY '+column)?[{[column]:column==='TYPE'?999:null,cnt:3}]:[]);
  const result=await c.getStatistics();expect(result[key][expectedKey]).to.equal(3);
 });
});

describe('Bounded automatic coordinate search',()=>{
 for(const Type of [SystemsController,SectorsController]) for(const maxDistance of [0,-1,1.5,Infinity]) it(Type.name+' rejects invalid search radius '+maxDistance,async()=>{
  const c=isolated(Type);stub(c,'areCoordinatesAvailable').resolves(true);let error:any;try{await c.generateUniqueCoordinates(maxDistance);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
});

describe('Coordinate search exhaustion',()=>{
 for(const Type of [SystemsController,SectorsController]) {
  it(Type.name+' checks every position on an occupied first shell before failing',async()=>{
   const c=isolated(Type);let checked=0;const positions=new Set<string>();c.areCoordinatesAvailable=async(x:number,y:number,z:number)=>{checked++;positions.add(`${x},${y},${z}`);return false;};
   let error:any;try{await c.generateUniqueCoordinates(1);}catch(e){error=e;}expect(String(error)).to.include('Unable to generate unique coordinates');expect(checked).to.equal(26);expect(positions.size).to.equal(26);expect(positions.has('0,0,0')).to.equal(false);
  });
  it(Type.name+' moves to the next shell when the first is full',async()=>{
   const c=isolated(Type);let checked=0;c.areCoordinatesAvailable=async()=>++checked===27;expect(await c.generateUniqueCoordinates(2)).to.deep.equal({x:-2,y:-2,z:-2});
  });
 }
});

import { ITEM_RECORD_SIZE } from '../../src/tables/sectors-items/SectorsItemsModel.js';
describe('Sector item storage boundaries',()=>{
 for(const size of [0,1,MAX_ITEMS_SIZE]) it('analyzes storage size '+size+' with loaded sector details',async()=>{
  const c=isolated(SectorsItemsController),model=SectorsItemsModel.fromRow({ID:7,ITEMS:Buffer.alloc(size)});stub(model,'hasSectorLoaded').returns(true);stub(model,'getSectorCoordinates').returns({x:1,y:2,z:3});stub(model,'getSectorName').returns('Probe');stub(c,'resolveRecord').resolves(model);
  const result=await c.analyzeStorageCapacity(7,{includeSectorAnalysis:true});expect(result.currentUsage.sizeBytes).to.equal(size);expect(result.sectorInfo).to.deep.equal({isLoaded:true,coordinates:{x:1,y:2,z:3},name:'Probe'});
  if(size===0)expect(result.recommendations).to.include('Empty storage - consider cleanup if unused');if(size===1)expect(result.dataQuality.isStructured).to.equal(false);
 });
 it('computes storage distributions including missing and empty blobs',async()=>{
  const c=isolated(SectorsItemsController),sizes=[0,ITEM_RECORD_SIZE,11000,MAX_ITEMS_SIZE,null];stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('COUNT')?[{cnt:5}]:sizes.map((size,i)=>({ID:i,ITEMS:size===null?null:Buffer.alloc(size)})));
  const result=await c.getStorageStatistics();expect(result).to.include({totalRecords:5,recordsWithItems:3,emptyRecords:2,recordsAtCapacity:1,totalStorageUsed:ITEM_RECORD_SIZE+11000+MAX_ITEMS_SIZE});expect(result.sizeDistribution).to.deep.equal({empty:2,small:1,medium:1,large:1});expect(result.efficiencyDistribution).to.deep.equal({low:3,medium:1,high:1});
 });
 for(const rows of [[],[{ITEMS:null}],[{ITEMS:Buffer.alloc(ITEM_RECORD_SIZE)}]]) it('totals usage across '+rows.length+' records',async()=>{
  const c=isolated(SectorsItemsController);stub(c,'executeQuery').resolves(rows);const result=await c.getTotalStorageUsage();expect(result.usedBytes).to.equal(rows[0]?.ITEMS?.length??0);expect(result.totalBytes).to.equal(rows.length*MAX_ITEMS_SIZE);expect(Number.isFinite(result.efficiency)).to.equal(true);
 });
 for(const failure of [new Error('read failed'),'read failed']) it('preserves usage query failure '+typeof failure,async()=>{const c=isolated(SectorsItemsController);stub(c,'executeQuery').callsFake(async()=>{throw failure});let error:any;try{await c.getTotalStorageUsage();}catch(e){error=e;}expect(String(error)).to.include('read failed');});
 for(const [value,valid] of [[null,false],[Buffer.alloc(0),true],[Buffer.alloc(1),false],[Buffer.alloc(ITEM_RECORD_SIZE),true]] as Array<[any,boolean]>) it('validates item record alignment '+String(value?.length),()=>{expect(isolated(SectorsItemsController).validateItemsDataFormat(value)).to.equal(valid);});
 for(const filter of [{minSizeBytes:ITEM_RECORD_SIZE},{minItemCount:1},{maxItemCount:1},{validDataOnly:true}]) it('filters item data '+JSON.stringify(filter),async()=>{
  const c=isolated(SectorsItemsController);stub(c,'executeQuery').resolves([0,ITEM_RECORD_SIZE,ITEM_RECORD_SIZE*2,1].map((size,i)=>({ID:i,ITEMS:Buffer.alloc(size)})));
  const result=await c.findSectorsItems(filter);expect(result.length).to.be.greaterThan(0);for(const row of result){if('minSizeBytes'in filter)expect(row.getItemsSize()).to.be.at.least(filter.minSizeBytes!);if('minItemCount'in filter)expect(row.getEstimatedStackCount()).to.be.at.least(1);if('maxItemCount'in filter)expect(row.getEstimatedStackCount()).to.be.at.most(1);if('validDataOnly'in filter)expect(row.isItemsDataValid()).to.equal(true);}
 });
 for(const identifier of ['7','bad',{},null]) it('resolves item identifier '+JSON.stringify(identifier),async()=>{const c=isolated(SectorsItemsController),find=stub(c,'findById').resolves({});expect(await c.resolveRecord(identifier)).to.deep.equal(identifier==='7'?{}:null);expect(find.called).to.equal(identifier==='7');});
 for(const failure of [new Error('read failed'),'read failed']) it('warns when inverse sector references cannot be inspected '+typeof failure,async()=>{const c=isolated(SectorsItemsController);stub(c,'executeQuery').callsFake(async()=>{throw failure});await c.validateSectorReference(7);expect(c.logger.warn.calledOnce).to.equal(true);expect(c.logger.warn.firstCall.args[1].error).to.equal('read failed');});
 it('repairs only an incomplete trailing item record during cleanup',async()=>{
  const c=isolated(SectorsItemsController),record=SectorsItemsModel.fromRow({ID:7,ITEMS:Buffer.alloc(ITEM_RECORD_SIZE+1)});stub(c,'findSectorsItems').resolves([record]);const update=stub(c,'update').resolves(record);const result=await c.cleanupStorage({logOperations:true});expect(result).to.include({corruptedRecordsFixed:1,recordsOptimized:1,spaceFreed:1});expect(update.firstCall.args[1].ITEMS.length).to.equal(ITEM_RECORD_SIZE);
 });
 for(const failure of [new Error('write failed'),'write failed']) it('reports a cleanup update failure without claiming optimized records '+typeof failure,async()=>{
  const c=isolated(SectorsItemsController),record=SectorsItemsModel.fromRow({ID:0,ITEMS:Buffer.alloc(ITEM_RECORD_SIZE+1)});stub(c,'findSectorsItems').resolves([record]);stub(c,'update').callsFake(async()=>{throw failure});const result=await c.cleanupStorage();expect(result.recordsOptimized).to.equal(0);expect(result.errors).to.deep.equal([{recordId:0,error:'write failed'}]);
 });
 for(const failure of [new Error('read failed'),'read failed']) it('reports cleanup enumeration failure '+typeof failure,async()=>{const c=isolated(SectorsItemsController);stub(c,'findSectorsItems').callsFake(async()=>{throw failure});const result=await c.cleanupStorage();expect(result.errors).to.deep.equal([{recordId:-1,error:'read failed'}]);});
});

describe('Remaining controller delegation and result variants',()=>{
 for(const Type of [MinesController,TradeHistoryController]) it(Type.name+' forwards updates to the persisted primary key',async()=>{const c=isolated(Type),update=stub(BaseController.prototype,'update').resolves({} as any);try{await c.update(7,{NAME:'Probe'});expect(update.firstCall.args).to.deep.equal([7,{NAME:'Probe'},{}]);}finally{update.restore();}});
 it('updates a fleet membership through its actual ID',async()=>{const c=isolated(FleetMembersController);stub(c,'findOne').resolves({getId:()=>9});const update=stub(BaseController.prototype,'update').resolves({} as any);try{await c.update({fleetId:7,entityId:8},{MISSION_STRING:'IDLE'});expect(update.firstCall.args).to.deep.equal([9,{MISSION_STRING:'IDLE'},{}]);}finally{update.restore();}});
 it('finds fleets by their flagship reference',async()=>{const c=isolated(FleetsController),find=stub(c,'findAll').resolves([]);expect(await c.findByFlagship(7)).to.deep.equal([]);expect(find.firstCall.args).to.deep.equal([{flagshipId:7}]);});
 it('skips absent fleets in bulk updates',async()=>{const c=isolated(FleetsController);stub(c,'fleetExistsById').resolves(false);expect(await c.bulkUpdate([{id:7,data:{}}])).to.include({success:0,skipped:1,failed:0});});
 for(const failure of [new Error('write failed'),'write failed']) for(const continueOnError of [true,false]) it('handles fleet bulk update errors '+typeof failure+' continue='+continueOnError,async()=>{
  const c=isolated(FleetsController);stub(c,'fleetExistsById').resolves(true);stub(c,'update').callsFake(async()=>{throw failure});let result:any,error:any;try{result=await c.bulkUpdate([{id:7,data:{}}],{continueOnError});}catch(e){error=e;}if(continueOnError)expect(result.errors[0].error).to.equal('write failed');else expect(error).to.equal(failure);
 });
 it('handles an empty fleet count row',async()=>{const c=isolated(FleetsController);stub(c,'executeQuery').resolves([{}]);expect(await c.countChildren(7)).to.equal(0);});
 it('retains unknown fleet faction access values',async()=>{const c=isolated(FleetsController);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('GROUP BY FACTION_ACCESS')?[{FACTION_ACCESS:null,cnt:3}]:[]);expect((await c.getStatistics()).accessDistribution.UNKNOWN).to.equal(3);});
 it('deletes only messages involving the selected player',async()=>{
  const c=isolated(PlayerMessagesController),messages=[{ID:1,SENDER:'Probe',RECEIVER:'Other'},{ID:2,SENDER:'Other',RECEIVER:'Probe'},{ID:3,SENDER:null,RECEIVER:null},{ID:4,SENDER:'Other',RECEIVER:'Other'}].map(row=>({get:(key:string)=>(row as any)[key]}));stub(c,'findAll').resolves(messages);const del=stub(c,'delete').resolves(true);expect(await c.deleteAllForPlayer('PROBE')).to.equal(2);expect(del.getCalls().map(call=>call.args)).to.deep.equal([[1],[2]]);
 });
 for(const [Type,method,args] of [[PlayerMessagesController,'countUnread',['Probe']],[PlayersController,'getFactionMemberCount',[7]],[PlayersController,'getPlayerCountByPermission',[0]],[VisibilityController,'countByObserver',[7]],[VisibilityController,'countBySector',[1,2,3]]] as Array<[any,string,any[]]>) for(const count of [null,'3']) it(Type.name+'.'+method+' reads '+count+' aggregate count',async()=>{
  const c=isolated(Type);stub(c,'executeQuery').resolves([{cnt:count,member_count:count,permission_count:count}]);expect(await c[method](...args)).to.equal(Number(count));
 });
 it('updates a trade node permission mask through the validated record',async()=>{const c=isolated(TradeNodesController);stub(c,'nodeExistsById').resolves(true);const update=stub(c,'update').resolves({});await c.updatePermissions(7,3);expect(update.firstCall.args).to.deep.equal([7,{PERMISSION:3},{validatePermissions:false}]);});
 it('preserves owner spelling as a bound trade node filter',async()=>{const c=isolated(TradeNodesController),find=stub(c,'findAll').resolves([]);await c.findByOwner('Probe');expect(find.firstCall.args).to.deep.equal([{owner:'Probe'}]);});
 it('updates an observation with an explicit timestamp including zero',async()=>{const c=isolated(VisibilityController);stub(c,'findOne').resolves({});const update=stub(c,'update').resolves({});await c.markAsObserved(7,1,2,3,0);expect(update.firstCall.args[1]).to.deep.equal({TIMESTAMP:0});});
 it('clears cached visibility after deleting observations',async()=>{const c=isolated(VisibilityController);c.cacheManager={clear:stub().resolves()};stub(c,'executeUpdate').resolves(3);expect(await c.clearObserver(7)).to.equal(3);expect(c.cacheManager.clear.called).to.equal(true);});
});

describe('Player initialization and statistics fallbacks',()=>{
 for(const failure of [new Error('read failed'),'read failed']) it('keeps initialization available when optional ID preloading fails '+typeof failure,async()=>{
  const c:any=new PlayersController();const init=stub(BaseController.prototype,'initialize').resolves();c.logger={warn:stub()};stub(c,'initializeLastPlayerIdCache').callsFake(async()=>{throw failure});try{await c.initialize({});expect(c.logger.warn.firstCall.args[1].error).to.equal('read failed');}finally{init.restore();}
 });
 it('reports a player found by ID',async()=>{const c=isolated(PlayersController);stub(c,'executeQuery').resolves([{C1:1}]);expect(await c.playerExistsById(7)).to.equal(true);});
 it('maps a player found by its exact account name',async()=>{const c=isolated(PlayersController);stub(c,'executeQuery').resolves([{ID:7,NAME:'Probe'}]);expect((await c.findPlayerByName('Probe')).getName()).to.equal('Probe');});
 it('rejects faction transfer for a missing player',async()=>{const c=isolated(PlayersController);stub(c,'resolvePlayer').resolves(null);let error:any;try{await c.transferToFaction(7,2);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
 for(const failure of [new Error('statistics unavailable'),'statistics unavailable']) it('preserves basic statistics when optional faction data fails '+typeof failure,async()=>{
  const c=isolated(PlayersController);stub(c,'executeQuery').callsFake(async(sql:any)=>{if(sql.includes('GROUP BY FACTION'))throw failure;return [{total_players:2,active_players:1,faction_members:1,officer_count:0,admin_count:0}];});const result=await c.getPlayerStatistics();expect(result).to.include({totalPlayers:2,averageActivityScore:0.5});expect(result.mostActiveFaction).to.equal(undefined);expect(c.logger.warn.calledOnce).to.equal(true);
 });
 it('normalizes missing faction statistics fields to zero',async()=>{const c=isolated(PlayersController);stub(c,'executeQuery').resolves([{}]);const result=await c.getPlayerStatistics();expect(result.mostActiveFaction).to.deep.equal({id:0,memberCount:0,averageActivity:1});});
 for(const rows of [[],[{max_id:null}],[{max_id:'7'}]]) it('initializes the ID cache lazily from '+JSON.stringify(rows),async()=>{PlayersController.resetLastPlayerIdCache();const c=isolated(PlayersController);stub(c,'executeQuery').resolves(rows);expect(await c.generatePlayerId()).to.equal(rows[0]?.max_id?8:1);PlayersController.resetLastPlayerIdCache();});
});

describe('Controller batch edge cases',()=>{
 for(const [Type,method,args] of [[EffectsController,'bulkUpdate',[[7,8],{}]],[SectorsController,'bulkUpdateProtection',[[7,8],1]],[SystemsController,'bulkUpdateOwnership',[[7,8],'probe',7]]] as Array<[any,string,any[]]>) for(const continueOnError of [true,false]) for(const failure of [new Error('write failed'),'write failed']) it(Type.name+'.'+method+' reports failures, continue='+continueOnError+', '+typeof failure,async()=>{
  const c=isolated(Type),update=stub(c,'update');update.onCall(0).callsFake(async()=>{throw failure});update.onCall(1).resolves({});const result=await c[method](...args,{continueOnError,logOperations:true});expect(result).to.include({failed:1,success:continueOnError?1:0});expect(result.errors[0].error).to.equal('write failed');
 });
 for(const Type of [EffectsController,SectorsController,SystemsController,SectorsItemsController]) for(const failure of [undefined,'write failed']) it(Type.name+' logs successful inserts and string failures',async()=>{
  const c=isolated(Type),created={getId:()=>7,getEntityId:()=>7,getEffectUid:()=>'',getItemsSize:()=>0,getCoordinatesString:()=>'(0,0,0)'},create=stub(c,'create');if(failure)create.callsFake(async()=>{throw failure});else create.resolves(created);
  const result=await c.bulkCreate([{ID:7}],{logOperations:true});expect(result).to.include({success:failure?0:1,failed:failure?1:0});
 });
 for(const method of ['replenishSectors','cleanupStorage']) for(const batchSize of [0,1.5]) it(method+' rejects invalid batch size '+batchSize,async()=>{
  const c=isolated(method==='cleanupStorage'?SectorsItemsController:SectorsController);let error:any;try{if(method==='cleanupStorage')await c.cleanupStorage({batchSize});else await c.replenishSectors([],{batchSize});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
 for(const failure of [undefined,new Error('update failed'),'update failed']) for(const continueOnError of [true,false]) it('replenishes sectors with error accounting '+typeof failure+' continue='+continueOnError,async()=>{
  const c=isolated(SectorsController),model=SectorsModel.fromRow({ID:7,X:0,Y:0,Z:0});stub(c,'resolveSector').resolves(model);const update=stub(c,'update');if(failure)update.callsFake(async()=>{throw failure});else update.resolves(model);
  const result=await c.replenishSectors([7,8],{batchSize:1,logOperations:true,continueOnError});expect(result.sectorsReplenished).to.equal(failure?0:2);expect(result.errors.length).to.equal(failure?(continueOnError?2:1):0);
 });
});

describe('Creation coordinate and identity boundaries',()=>{
 it('applies system defaults when initializeDefaults is omitted',async()=>{
  const c=isolated(SystemsController);stub(c,'validateCoordinateUniqueness').resolves();const create=stub(BaseController.prototype,'create').resolves({} as any);try{await c.create({TYPE:0,X:0,Y:0,Z:0});expect(create.firstCall.args[0]).to.have.property('OWNER_FACTION',0);expect(Buffer.isBuffer(create.firstCall.args[0].INFOS)).to.equal(true);}finally{create.restore();}
 });
 for(const Type of [SystemsController,SectorsController]) for(const data of [{TYPE:0,NAME:'probe'},{TYPE:0,NAME:'probe',X:0},{TYPE:0,NAME:'probe',X:0,Y:0},{TYPE:0,NAME:'probe',X:0,Y:0,Z:0}]) it(Type.name+' supplies missing coordinates '+JSON.stringify(data),async()=>{
  const c=isolated(Type);stub(c,'validateCoordinateUniqueness').resolves();stub(c,'generateUniqueCoordinates').resolves({x:-1,y:-1,z:-1});const create=stub(BaseController.prototype,'create').resolves({} as any);try{await c.create({...data},{autoGenerateCoordinates:true,initializeDefaults:true,initializeProtection:false});expect(create.firstCall.args[0]).to.include({X:data.X??-1,Y:data.Y??-1,Z:data.Z??-1});}finally{create.restore();}
 });
 for(const data of [{TYPE:0,NAME:'probe'},{TYPE:0,NAME:'probe',X:0},{TYPE:0,NAME:'probe',X:0,Y:0}]) it('requires every sector coordinate when generation is disabled '+JSON.stringify(data),async()=>{const c=isolated(SectorsController);let error:any;try{await c.create(data);}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
 it('preserves explicit system default values',()=>{const c=isolated(SystemsController),defaults=c.applyCreateDefaults({OWNER_FACTION:7,INFOS:Buffer.from([1])});expect(defaults.OWNER_FACTION).to.equal(7);expect(defaults.INFOS).to.deep.equal(Buffer.from([1]));});
 for(const severity of ['HIGH','MEDIUM']) it('permits only nonblocking entity placement conflicts, severity='+severity,async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,UID:'probe',TYPE:0,X:0,Y:0,Z:0});stub(c,'findEntityByUID').resolves(null);stub(c,'validateEntityPlacement').resolves();stub(c,'checkEntityConflicts').resolves({hasConflicts:true,conflicts:[{severity,description:'overlap'}]});const create=stub(BaseController.prototype,'create').resolves(model);let error:any;
  try{try{await c.create({UID:'probe',TYPE:0,X:0,Y:0,Z:0});}catch(e){error=e;}if(severity==='HIGH'){expect(error).to.be.instanceOf(ValidationError);expect(create.called).to.equal(false);}else expect(error).to.equal(undefined);}finally{create.restore();}
 });
 for(const found of [null,EntitiesModel.fromRow({UID:'probe',TYPE:0}),EntitiesModel.fromRow({ID:7,UID:'probe',TYPE:0})]) it('retrieves a missing inserted entity ID through its unique UID, found='+found?.getId(),async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({UID:'probe',TYPE:0,X:0,Y:0,Z:0});const find=stub(c,'findEntityByUID');find.onFirstCall().resolves(null);find.onSecondCall().resolves(found);stub(c,'validateEntityPlacement').resolves();const create=stub(BaseController.prototype,'create').resolves(model);
  try{const result=await c.create({UID:'probe',TYPE:0,X:0,Y:0,Z:0},{checkSectorConflicts:false,linkToDockingChain:true});expect(result.getId()).to.equal(found?.getId());expect(find.callCount).to.equal(2);}finally{create.restore();}
 });
 it('validates requested docking links before insertion',async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,UID:'probe',TYPE:0,X:0,Y:0,Z:0});stub(c,'findEntityByUID').resolves(null);stub(c,'validateEntityPlacement').resolves();const validate=stub(c,'validateDockingChain').resolves(),create=stub(BaseController.prototype,'create').resolves(model);
  try{await c.create({UID:'probe',TYPE:0,X:0,Y:0,Z:0,DOCKED_TO:2,DOCKED_ROOT:3},{checkSectorConflicts:false,linkToDockingChain:true});expect(validate.firstCall.args).to.deep.equal([2,3]);}finally{create.restore();}
 });
});

describe('Sector protection filter validation',()=>{
 for(const hasProtection of [['1); DROP TABLE SECTORS--'],[0],[-1],[1.5],[NaN],[3],'1']) it('rejects unsupported protection flags '+JSON.stringify(hasProtection),async()=>{
  const c=isolated(SectorsController),query=stub(c,'executeQuery').resolves([]);let error:any;try{await c.findSectors({hasProtection});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);expect(query.called).to.equal(false);
 });
 for(const hasProtection of [undefined,[],[1,2]]) it('accepts absent, empty or valid protection flags '+JSON.stringify(hasProtection),async()=>{
  const c=isolated(SectorsController),query=stub(c,'executeQuery').resolves([]);expect(await c.findSectors({hasProtection})).to.deep.equal([]);if(hasProtection?.length)expect(query.firstCall.args[0]).to.include('PROTECTION');
 });
});

describe('Spatial statistics grouped counts',()=>{
 for(const [Type,method,column,countColumn,property,idProperty] of [[SystemsController,'getSystemStatistics','OWNER_FACTION','faction_count','mostActiveFaction','id'],[SectorsController,'getSectorStatistics','STELLAR','system_count','mostPopulatedSystem','stellarId']] as Array<[any,string,string,string,string,string]>) for(const counts of [[0],[3,5]]) it(Type.name+' ranks group counts '+counts,async()=>{
  const c=isolated(Type);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('GROUP BY '+column)?counts.map((n,i)=>({[column]:i+1,[countColumn]:String(n)})):[]);
  const result=await c[method]();if(counts.length===1)expect(result[property]).to.equal(undefined);else expect(result[property][idProperty]).to.equal(2);
 });
 it('reports no active faction when every system is neutral',async()=>{
  const c=isolated(SystemsController);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('GROUP BY OWNER_FACTION')?[{OWNER_FACTION:0,faction_count:'3'}]:[]);expect((await c.getSystemStatistics()).mostActiveFaction).to.equal(undefined);
 });
 for(const failure of [new Error('statistics unavailable'),'statistics unavailable']) it('preserves sector counts if optional security aggregates fail '+typeof failure,async()=>{
  const c=isolated(SectorsController);stub(c,'executeQuery').callsFake(async(sql:any)=>{if(sql.includes('as "open_sectors"'))throw failure;return [];});const result=await c.getSectorStatistics();expect(result.securityStats).to.deep.equal({safeSectors:0,lockedSectors:0,openSectors:0,protectedSectors:0});expect(c.logger.warn.calledOnce).to.equal(true);
 });
});

describe('Entity mutation and conflict boundaries',()=>{
 for(const data of [{X:1},{Y:1},{Z:1},{X:0,Y:0,Z:0},{DOCKED_TO:2},{DOCKED_ROOT:3},{DOCKED_TO:-1}]) it('validates changed entity placement and docking '+JSON.stringify(data),async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,UID:'probe',X:0,Y:0,Z:0,TYPE:0,DOCKED_TO:2,DOCKED_ROOT:3});stub(c,'resolveEntity').resolves(model);const place=stub(c,'validateEntityPlacement').resolves(),dock=stub(c,'validateDockingChain').resolves(),update=stub(BaseController.prototype,'update').resolves(model);
  try{expect(await c.update(7,data)).to.equal(model);expect(place.called).to.equal(Object.values(data).includes(1));if('DOCKED_TO'in data||'DOCKED_ROOT'in data)expect(dock.called).to.equal(data.DOCKED_TO!==-1);if(dock.called)expect(dock.firstCall.args).to.deep.equal([2,3]);}finally{update.restore();}
 });
 for(const forceDelete of [true,false]) it('protects docked dependents unless forceDelete is set, force='+forceDelete,async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,UID:'probe',TYPE:0,X:0,Y:0,Z:0});stub(c,'resolveEntity').resolves(model);stub(c,'findEntities').resolves([model]);const del=stub(BaseController.prototype,'delete').resolves(true);let result:any,error:any;
  try{try{result=await c.delete(7,{forceDelete});}catch(e){error=e;}if(forceDelete)expect(result).to.equal(true);else{expect(error).to.be.instanceOf(ValidationError);expect(del.called).to.equal(false);}}finally{del.restore();}
 });
 it('binds UID and modifier filters while requesting relationship loading',async()=>{
  const c=isolated(EntitiesController),query=stub(c,'executeQuery').resolves([]);await c.findEntities({uid:'ENTITY_7',lastModifier:'Probe',withRelations:{sector:true}});expect(query.firstCall.args[0]).to.include('UID = ?').and.include('LAST_MOD = ?');expect(query.firstCall.args[1]).to.include('ENTITY_7').and.include('Probe');expect(c.logger.debug.getCalls().some(call=>call.args[1]?.operation==='load-entity-relationships')).to.equal(true);
 });
 it('reports duplicate UID and planet position independently',async()=>{
  const c=isolated(EntitiesController),planet=EntitiesModel.fromRow({ID:7,TYPE:EntityType.PLANET});stub(c,'findEntityByUID').resolves(planet);stub(c,'findEntitiesInSector').resolves([EntitiesModel.fromRow({TYPE:EntityType.SHIP}),planet,EntitiesModel.fromRow({TYPE:EntityType.SUN})]);const result=await c.checkEntityConflicts({uid:'probe',coordinates:{x:0,y:0,z:0},entityType:EntityType.PLANET});expect(result.hasConflicts).to.equal(true);expect(result.conflicts.map((item:any)=>item.type)).to.deep.equal(['UID_DUPLICATE','POSITION_OVERLAP']);expect(result.recommendations).to.have.length(2);
 });
 it('permits a unique-position type when there is no conflicting entity',async()=>{
  const c=isolated(EntitiesController);stub(c,'findEntitiesInSector').resolves([]);const result=await c.checkEntityConflicts({coordinates:{x:0,y:0,z:0},entityType:EntityType.PLANET});expect(result.hasConflicts).to.equal(false);
 });
 it('stops UID generation after exhausting the bounded collision budget',async()=>{
  const c=isolated(EntitiesController),find=stub(c,'findEntityByUID').resolves({});let error:any;try{await c.generateUniqueUID();}catch(e){error=e;}expect(String(error)).to.include('maximum attempts');expect(find.callCount).to.equal(100);expect(new Set(find.getCalls().map(call=>call.args[0])).size).to.equal(100);
 });
 for(const identifier of ['7','probe',{},null]) it('resolves entity identifier '+JSON.stringify(identifier),async()=>{
  const c=isolated(EntitiesController),id=stub(c,'findById').resolves({ID:7}),uid=stub(c,'findEntityByUID').resolves({UID:'probe'});const result=await c.resolveEntity(identifier);if(identifier==='7'){expect(result).to.deep.equal({ID:7});expect(id.firstCall.args).to.deep.equal([7]);}else if(identifier==='probe'){expect(result).to.deep.equal({UID:'probe'});expect(uid.firstCall.args).to.deep.equal(['probe']);}else expect(result).to.equal(null);
 });
 it('computes zero average docking length for only undocked entities',async()=>{
  const c=isolated(EntitiesController),model=EntitiesModel.fromRow({ID:7,TYPE:0,X:0,Y:0,Z:0,DOCKED_TO:-1});stub(c,'findEntitiesWithinRadius').resolves([model]);const result=await c.performSpatialAnalysis({x:0,y:0,z:0},1);expect(result.dockingStats).to.deep.equal({dockedEntities:0,dockingChains:1,averageChainLength:0});
 });
 for(const childCount of [0,1]) it('includes docking analytics for undocked parents only when children exist, count='+childCount,async()=>{
  const c=isolated(EntitiesController),node={...entityNode(7),getDockedEntitiesCount:()=>childCount};stub(c,'resolveEntity').resolves(node);const dock=stub(c,'getDockingChain').resolves({});await c.getEntityAnalytics(7,{includeSpatialIntelligence:false});expect(dock.called).to.equal(childCount>0);
 });
});

import { ALL_EFFECT_UIDS } from '../../src/tables/effects/EffectsModel.js';
describe('Final controller branch variants',()=>{
 it('categorizes a recognized effect during creation',async()=>{
  const c=isolated(EffectsController),model=EffectsModel.fromRow({ID:7,ENTITY_ID:7,TYPE:EffectType.OTHER,EFFECT_UID:ALL_EFFECT_UIDS[0]});stub(c,'validateEntityExists').resolves();const create=stub(BaseController.prototype,'create').resolves(model);
  try{await c.create({ENTITY_ID:7,TYPE:EffectType.OTHER,EFFECT_UID:ALL_EFFECT_UIDS[0]},{autoCategorize:true});expect(c.logger.debug.getCalls().some(call=>call.args[1]?.operation==='create-auto-categorize')).to.equal(true);}finally{create.restore();}
 });
 for(const entityIds of [[],[null,undefined],[null,7,undefined]]) it('filters valid effect entity identifiers '+JSON.stringify(entityIds),async()=>{
  const c=isolated(EffectsController),query=stub(c,'executeQuery').resolves([]);await c.findEffects({entityIds});if(entityIds.includes(7)){expect(query.firstCall.args[0]).to.include('ENTITY_ID IN (?)');expect(query.firstCall.args[1]).to.deep.equal([7]);}else expect(query.firstCall.args[0]).not.to.include('ENTITY_ID IN');
 });
 it('computes positive fleet member averages',async()=>{const c=isolated(FleetMembersController);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('DISTINCT')?[{cnt:2}]:sql.includes('GROUP BY')?[]:[{cnt:6}]);expect((await c.getStatistics()).averageMembersPerFleet).to.equal(3);});
 it('returns null for a missing exact StarMade name',async()=>{const c=isolated(PlayersController);stub(c,'executeQuery').resolves([]);expect(await c.findPlayerByStarMadeName('probe')).to.equal(null);});
 it('uses an explicit replenishment batch size when finding stale records',async()=>{const c=isolated(SectorsController),find=stub(c,'findSectorsNeedingReplenishment').resolves([]);stub(c,'replenishSectors').resolves({});await c.autoReplenishStaleSectors(100,{batchSize:7});expect(find.firstCall.args).to.deep.equal([100,{limit:7}]);});
 it('supports an entirely absent storage count row',async()=>{const c=isolated(SectorsItemsController);stub(c,'executeQuery').resolves([]);expect((await c.getStorageStatistics()).totalRecords).to.equal(0);});
 it('identifies a malformed cleanup record whose ID is unavailable',async()=>{
  const c=isolated(SectorsItemsController),record=SectorsItemsModel.fromRow({ITEMS:Buffer.alloc(ITEM_RECORD_SIZE+1)});stub(record,'getId').returns(undefined as any);stub(c,'findSectorsItems').resolves([record]);stub(c,'update').rejects(new Error('write failed'));expect((await c.cleanupStorage()).errors).to.deep.equal([{recordId:-1,error:'write failed'}]);
 });
 it('binds both system name search and owner UID',async()=>{const c=isolated(SystemsController),query=stub(c,'executeQuery').resolves([]);await c.findSystems({searchTerm:'Probe',ownerUid:'ENTITY'});expect(query.firstCall.args[1]).to.deep.equal(['%probe%','%probe%','%entity%']);});
 it('returns a system from its coordinate cache',async()=>{const c=isolated(SystemsController);c.config.enableCaching=true;c.cacheManager={get:stub().resolves({ID:7,X:1,Y:2,Z:3})};const query=stub(c,'executeQuery');expect((await c.findByCoordinates(1,2,3)).getId()).to.equal(7);expect(query.called).to.equal(false);});
 it('persists every system ownership field',async()=>{
  const c=isolated(SystemsController),model=SystemsModel.fromRow({ID:7,X:0,Y:0,Z:0,OWNER_FACTION:1,OWNER_UID:'old'});stub(c,'resolveSystem').resolves(model);const update=stub(c,'update').resolves(model);expect(await c.transferOwnership(7,'new',2,{x:1,y:2,z:3})).to.equal(model);expect(update.firstCall.args[1]).to.deep.equal({OWNER_UID:'new',OWNER_FACTION:2,OWNER_X:1,OWNER_Y:2,OWNER_Z:3});
 });
 it('computes average value for nonempty trade history',async()=>{const c=isolated(TradeHistoryController);stub(c,'executeQuery').callsFake(async(sql:any)=>sql.includes('SUM(TOTAL_COST)')?[{total:12}]:sql.includes('GROUP BY')?[]:[{cnt:3}]);expect((await c.getStatistics()).averageTransactionValue).to.equal(4);});
 it('timestamps an existing observation when no explicit time is supplied',async()=>{const c=isolated(VisibilityController);stub(c,'findOne').resolves({});const update=stub(c,'update').resolves({}),before=Date.now();await c.markAsObserved(7,1,2,3);expect(update.firstCall.args[1].TIMESTAMP).to.be.within(before,Date.now());});
});


describe('Spatial optional aggregate fields',()=>{
 for(const [Type,method,property] of [[SystemsController,'getSystemStatistics','systemsByType'],[SectorsController,'getSectorStatistics','sectorsByType']] as Array<[any,string,string]>) it(Type.name+' defaults missing grouped counts to zero',async()=>{
  const c=isolated(Type);stub(c,'executeQuery').resolves([{}]);const result=await c[method]();expect(Object.values(result[property]).every(count=>count===0)).to.equal(true);
 });
 it('uses the default stale-sector batch limit',async()=>{
  const c=isolated(SectorsController),find=stub(c,'findSectorsNeedingReplenishment').resolves([]),replenish=stub(c,'replenishSectors').resolves({});await c.autoReplenishStaleSectors();expect(find.firstCall.args[1]).to.deep.equal({limit:100});expect(replenish.firstCall.args[0]).to.deep.equal([]);
 });
});
