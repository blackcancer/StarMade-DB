import {expect} from 'chai';
import {describe,it} from 'mocha';
import {ParameterizedQuery,BindingStrategy} from '../../../../src/core/modules/query/ParameterizedQuery.js';

function query(){const q:any=new ParameterizedQuery();q.config={enableInjectionDetection:true,enableParameterValidation:true,maxParametersPerQuery:10,enableStatementCaching:true,maxCachedStatements:10,statementCacheTtlMs:10000};q.logger=new Proxy({}, {get:()=>()=>{}});return q;}
async function rejected(fn:()=>Promise<any>){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(Error);}
describe('Parameterized SQL validation regressions',()=>{
    it('accepts a correlated EXISTS subquery while rejecting stacked statements',async()=>{
        const q=query();
        await q.validateSqlAndParameters('SELECT * FROM FLEET_MEMBERS M WHERE EXISTS (SELECT 1 FROM FLEETS F WHERE F.ID = M.FLEET_ID) AND M.ID = ?',[1],{});
        await rejected(()=>q.validateSqlAndParameters('SELECT * FROM FLEETS; DROP TABLE FLEETS',[],{}));
        await rejected(()=>q.validateSqlAndParameters('SELECT * FROM FLEETS; SELECT * FROM PLAYERS',[],{}));
    });
    it('counts placeholders outside SQL string and identifier literals',async()=>{
        const q=query();
        await q.validateSqlAndParameters('SELECT \'?\' AS "?", ? FROM PLAYERS',[1],{});
        await q.validateSqlAndParameters("SELECT 'it''s ?' FROM PLAYERS",[],{});
    });
    it('validates current parameters even when prepared statement metadata is cached',async()=>{
        const q=query();
        await q.prepareStatement('SELECT ? FROM PLAYERS',[1],BindingStrategy.POSITIONAL,{});
        await rejected(()=>q.prepareStatement('SELECT ? FROM PLAYERS',[],BindingStrategy.POSITIONAL,{}));
    });
    it('treats bound strings as values and keeps SQL literal cache keys exact',async()=>{
        const q=query();
        await q.validateSqlAndParameters('SELECT ? FROM PLAYERS',["'; DROP TABLE PLAYERS; --"],{});
        for(const literal of ['Alice','alice','a b','a  b']) {
            const sql=`SELECT '${literal}' FROM PLAYERS`;
            const prepared=await q.prepareStatement(sql,[],BindingStrategy.POSITIONAL,{});
            expect(prepared.sql).to.equal(sql);
        }
    });
    it('replaces named placeholders only outside quoted SQL and requires own properties',()=>{
        const q=query();
        expect(q.convertNamedToPositional(`SELECT ':id', :id, :id AS ":id"`,{id:2})).to.deep.equal({convertedSql:`SELECT ':id', ?, ? AS ":id"`,positionalParameters:[2,2]});
        expect(()=>q.convertNamedToPositional('SELECT :constructor',{})).to.throw();
    });
    it('fails closed when the registered SQL validator fails',async()=>{
        const q=query();q.queryValidator={isInitialized:true,validateQuery:async()=>{throw Error('validator offline');}};
        await rejected(()=>q.validateSqlAndParameters('SELECT ?',[1],{}));
    });
});
