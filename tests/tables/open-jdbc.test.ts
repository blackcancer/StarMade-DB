import { expect } from 'chai';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HSQLManager, QueryExecutor } from '../../src/core/index.js';
import { FleetsController } from '../../src/tables/fleets/FleetsController.js';
import { FleetMembersController } from '../../src/tables/fleet-members/FleetMembersController.js';

/** Exercise the additional game columns on a separate, disposable HSQLDB fixture. */
describe('Open database JDBC compatibility', function () {
    this.timeout(30000);
    it('creates, reads, updates and sorts the new fleet columns with native JDBC', async () => {
        const scratch=mkdtempSync(join(tmpdir(),'starmade-open-jdbc-'));
        cpSync(join(process.cwd(),'tests/sandbox'),join(scratch,'game'),{recursive:true});
        const manager=new HSQLManager({starmadeDir:join(scratch,'game'),worldName:'test_world',connection:{readOnly:false},modules:{enableConnectionFactory:true,enableQueryValidation:true,enableParameterizedQueries:true},logging:{level:'error',enableConsole:false,enableFile:false}});
        try {
            await manager.initialize();
            const queries=new QueryExecutor(); await queries.initialize(manager); manager.registerModule(queries);
            const execute=async (sql:string, values:any[]=[])=>queries.executeParameterizedQuery(sql,values);
            const transactions=manager.getModule<any>('TransactionManager');
            await transactions.executeTransaction(async (tx:any) => {
                await tx.execute('ALTER TABLE FLEETS ADD COLUMN COMBINED_TARGETING BOOLEAN DEFAULT FALSE');
                await tx.execute('ALTER TABLE FLEETS ADD COLUMN MESSAGE_LOG VARCHAR(4096)');
                await tx.execute('ALTER TABLE FLEET_MEMBERS ADD COLUMN CARGO_CAPACITY DOUBLE DEFAULT 0 NOT NULL');
            });
            const entities=await execute('SELECT ID FROM ENTITIES ORDER BY ID LIMIT 1');
            expect(entities.rows).not.to.be.empty;
            const entityId=Number(entities.rows[0][0]);
            await execute('DELETE FROM FLEET_MEMBERS WHERE ENTITY_ID = ?',[entityId]);
            const fleets=new FleetsController(); await fleets.initialize(manager);
            const members=new FleetMembersController(); await members.initialize(manager);
            const fleet=await fleets.create({FLAGSHIP_ID:entityId,PARENT_FLEET:-1,NAME:'Open JDBC',OWNER:'audit',MISSION_STRING:'IDLE',COMBINED_TARGETING:true,MESSAGE_LOG:JSON.stringify([JSON.stringify({timestamp:1,type:'TEST',description:'created'})])});
            expect(fleet.getCombinedTargeting()).to.equal(true);
            expect(fleet.getMessageLog()).to.equal(JSON.stringify([JSON.stringify({timestamp:1,type:'TEST',description:'created'})]));
            const updated=await fleets.update(fleet.getId(),{COMBINED_TARGETING:false,MESSAGE_LOG:JSON.stringify([JSON.stringify({timestamp:2,type:'TEST',description:'updated'})])});
            expect(updated.getCombinedTargeting()).to.equal(false);
            expect(updated.getMessageLog()).to.equal(JSON.stringify([JSON.stringify({timestamp:2,type:'TEST',description:'updated'})]));
            const member=await members.create({FLEET_ID:fleet.getId(),ENTITY_ID:entityId,LIST_INDEX:0,DOCKED_TO:-1,FACTION:0});
            expect((await members.findById(member.getId(),{skipCache:true}))!.getCargoCapacity()).to.equal(0);
            expect((await members.update({fleetId:fleet.getId(),entityId},{CARGO_CAPACITY:42.5})).getCargoCapacity()).to.equal(42.5);
            expect((await members.findById(member.getId(),{skipCache:true}))!.getCargoCapacity()).to.equal(42.5);
            for(const orderBy of ['COMBINED_TARGETING','MESSAGE_LOG']) {
                expect((await fleets.findMany({orderBy,limit:0})).some(row=>row.getId()===fleet.getId())).to.equal(true);
            }
            expect((await members.findMany({orderBy:'CARGO_CAPACITY',limit:0})).some(row=>row.getId()===member.getId())).to.equal(true);
            const stored=await execute('SELECT CARGO_CAPACITY FROM FLEET_MEMBERS WHERE ID = ?',[member.getId()]);
            expect(Number(stored.rows[0][0])).to.equal(42.5);
        } finally {
            await manager.destroy();
            rmSync(scratch,{recursive:true,force:true});
        }
    });
});
