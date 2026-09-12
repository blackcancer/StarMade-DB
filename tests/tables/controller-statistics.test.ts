import { expect } from 'chai';
import { HSQLManager } from '../../src/core/HSQLManager.js';
import { EntitiesController } from '../../src/tables/entities/EntitiesController.js';
import { FleetMembersController } from '../../src/tables/fleet-members/FleetMembersController.js';
import { FleetsController } from '../../src/tables/fleets/FleetsController.js';
import { FtlController } from '../../src/tables/ftl/FtlController.js';
import { MinesController } from '../../src/tables/mines/MinesController.js';
import { NpcStatsController } from '../../src/tables/npc-stats/NpcStatsController.js';
import { PlayerMessagesController } from '../../src/tables/player-messages/PlayerMessagesController.js';
import { PlayersController } from '../../src/tables/players/PlayersController.js';
import { SectorsController } from '../../src/tables/sectors/SectorsController.js';
import { SystemsController } from '../../src/tables/systems/SystemsController.js';
import { TradeHistoryController } from '../../src/tables/trade-history/TradeHistoryController.js';
import { TradeNodesController } from '../../src/tables/trade-nodes/TradeNodesController.js';
import { VisibilityController } from '../../src/tables/visibility/VisibilityController.js';

/** These integration checks use raw column positions as an independent count oracle. */
describe('Controller aggregate aliases on HSQLDB',function(){
 this.timeout(30000);let manager:HSQLManager;
 before(async()=>{manager=new HSQLManager({starmadeDir:'./tests/sandbox',worldName:'test_world',logging:{level:'error',enableConsole:false}});await manager.initialize();});
 after(async()=>{await manager.destroy();});
 const cases:Array<[any,string,string,string]>=[
  [EntitiesController,'ENTITIES','getEntityStatistics','totalEntities'],[FleetMembersController,'FLEET_MEMBERS','getStatistics','totalMembers'],[FleetsController,'FLEETS','getStatistics','totalFleets'],[FtlController,'FTL','getStatistics','totalConnections'],[MinesController,'MINES','getStatistics','totalMines'],[NpcStatsController,'NPC_STATS','getStatistics','totalRecords'],[PlayerMessagesController,'PLAYER_MESSAGES','getStatistics','totalMessages'],[PlayersController,'PLAYERS','getPlayerStatistics','totalPlayers'],[SectorsController,'SECTORS','getSectorStatistics','totalSectors'],[SystemsController,'SYSTEMS','getSystemStatistics','totalSystems'],[TradeHistoryController,'TRADE_HISTORY','getStatistics','totalTransactions'],[TradeNodesController,'TRADE_NODES','getStatistics','totalNodes'],[VisibilityController,'VISIBILITY','getStatistics','totalObservations']
 ];
 for(const [Type,table,method,field]of cases)it(Type.name+' reports the persisted '+field,async()=>{
  const controller:any=new Type({enableCaching:false});await controller.initialize(manager);
  const query=manager.getModule<any>('parameterized-query');const raw=await query.execute('SELECT COUNT(*) FROM '+table,[]);const expected=Number(raw.rows[0][0]);
  const result=await controller[method]();expect(result[field]).to.equal(expected);
 });
});
