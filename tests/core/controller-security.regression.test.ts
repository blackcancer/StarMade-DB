import { expect } from 'chai';
import { describe, it } from 'mocha';
import { BaseController } from '../../src/tables/BaseController.js';
import { PlayersController } from '../../src/tables/players/PlayersController.js';
import { ValidationError } from '../../src/core/errors.js';

function controller() {
    const c: any = new PlayersController({enableCaching: false, enableForeignKeyValidation: false});
    c.initialized = true;
    c.logger = new Proxy({}, {get: () => () => {}});
    const queries: any[] = [];
    c.executeQuery = async (sql: string, parameters: any[]) => { queries.push({sql, parameters}); return []; };
    return {c, queries};
}

describe('Controller SQL identifier regressions', () => {
    for (const options of [
        {orderBy: 'NAME; DROP TABLE PLAYERS --'}, {orderBy: 'UNKNOWN'},
        {orderBy: 'NAME', orderDirection: 'ASC; DELETE FROM PLAYERS'},
        {limit: -1}, {limit: 1.5}, {limit: Infinity}, {offset: -1}, {offset: NaN}
    ]) it(`rejects unsafe pagination or ordering ${JSON.stringify(options)}`, async () => {
        const {c, queries} = controller();
        let error: unknown;
        try { await BaseController.prototype.findMany.call(c, options as any); } catch (caught) { error = caught; }
        expect(error).to.be.instanceOf(ValidationError);
        expect(queries).to.deep.equal([]);
    });

    it('binds pagination values and permits a schema column with either direction', async () => {
        const {c, queries} = controller();
        for (const direction of ['ASC', 'DESC']) {
            await BaseController.prototype.findMany.call(c, {orderBy: 'NAME', orderDirection: direction as any, limit: 3, offset: 2});
        }
        expect(queries.map(q => q.sql)).to.deep.equal([
            'SELECT * FROM PLAYERS ORDER BY NAME ASC LIMIT ? OFFSET ?',
            'SELECT * FROM PLAYERS ORDER BY NAME DESC LIMIT ? OFFSET ?'
        ]);
        expect(queries.map(q => q.parameters)).to.deep.equal([[3, 2], [3, 2]]);
    });

    it('rejects unknown update columns even with model validation disabled', async () => {
        const {c, queries} = controller();
        let error: unknown;
        try { await BaseController.prototype.update.call(c, 1, {'NAME = ?; DELETE FROM PLAYERS --': 'x'},
            {skipValidation: true, skipForeignKeyValidation: true, skipExistenceCheck: true, returnRecord: false}); }
        catch (caught) { error = caught; }
        expect(error).to.be.instanceOf(ValidationError);
        expect(queries).to.deep.equal([]);
    });
    it('bypasses record cache reads and writes when explicitly requested',async()=>{
        const {c}=controller();c.config.enableCaching=true;
        const cacheCalls:string[]=[];
        c.cacheManager={get:async()=>{cacheCalls.push('get');return {ID:1,NAME:'stale'};},set:async()=>{cacheCalls.push('set');}};
        c.executeQuery=async()=>[{ID:1,NAME:'fresh'}];
        expect((await c.findById(1)).getData().NAME).to.equal('stale');
        cacheCalls.length=0;
        expect((await c.findById(1,{skipCache:true})).getData().NAME).to.equal('fresh');
        expect(cacheCalls).to.deep.equal([]);
    });

});
