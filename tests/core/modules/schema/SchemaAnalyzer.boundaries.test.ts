import {expect} from 'chai';
import {describe,it} from 'mocha';
import {SchemaAnalyzer} from '../../../../src/core/modules/schema/SchemaAnalyzer.js';
import {JDBCConnectionFactory} from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';

function analyzer(){const a:any=new SchemaAnalyzer();a.logger=new Proxy({}, {get:()=>()=>{}});return a;}
async function rejected(fn:()=>Promise<any>){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(Error);}

describe('Schema metadata boundaries',()=>{
    it('reads real HSQLDB indexes and preserves composite foreign-key column pairs',async()=>{
        const factory=new JDBCConnectionFactory();await factory.initialize({} as any);
        try{
            const connection=await factory.createConnection({url:'jdbc:hsqldb:mem:schema_contract',autoCommit:true,readOnly:false,timeoutMs:1000});
            await connection.execute('CREATE TABLE PARENT_METADATA (A INTEGER, B INTEGER, PRIMARY KEY(A,B))');
            await connection.execute('CREATE TABLE CHILD_METADATA (X INTEGER, Y INTEGER, CONSTRAINT FK_METADATA FOREIGN KEY(X,Y) REFERENCES PARENT_METADATA(A,B) ON DELETE CASCADE)');
            const a=analyzer();
            await connection.execute('CREATE TABLE "odd table" ("a""b" INTEGER)');
            await connection.execute('INSERT INTO "odd table" VALUES(-1),(1),(NULL)');
            const statistics=await a.getColumnStatistics(connection,'odd table','a"b','INTEGER',{maxSampleSize:3});
            expect(statistics).to.include({totalRows:3,nonNullCount:2,averageValue:0});
            expect((await a.calculateTableStatistics(connection,'odd table',[])).rowCount).to.equal(3);
            const indexes=await a.getTableIndexes(connection,'PARENT_METADATA');
            expect(indexes).to.have.length(1);expect(indexes[0].columns.map((c:any)=>c.name)).to.deep.equal(['A','B']);
            expect(indexes[0].isUnique).to.equal(true);
            const constraints=await a.getTableConstraints(connection,'CHILD_METADATA');
            expect(constraints).to.have.length(1);expect(constraints[0]).to.include({type:'FOREIGN_KEY',referencedTable:'PARENT_METADATA',deleteRule:'CASCADE'});
            expect(constraints[0].columns).to.deep.equal(['X','Y']);expect(constraints[0].referencedColumns).to.deep.equal(['A','B']);
        }finally{await factory.destroy();}
    });
    it('uses JDBC rule codes for CASCADE, RESTRICT, SET NULL, NO ACTION and SET DEFAULT',()=>{
        // Java DatabaseMetaData constants: https://docs.oracle.com/en/java/javase/17/docs/api/constant-values.html#java.sql.DatabaseMetaData.importedKeyNoAction
        const a=analyzer();
        for(const [code,rule] of [[0,'CASCADE'],[1,'RESTRICT'],[2,'SET_NULL'],[3,'NO_ACTION'],[4,'SET_DEFAULT'],[99,'NO_ACTION']])expect(a.convertRuleCode(code)).to.equal(rule);
    });
    it('falls back when database version metadata is unavailable',async()=>{
        const a=analyzer();
        expect(await a.getDatabaseInfo({execute:async()=>({rows:[['world','2.7']]})})).to.deep.equal({name:'world',version:'2.7'});
        expect(await a.getDatabaseInfo({execute:async()=>({rows:[[null,null]]})})).to.deep.equal({name:'HSQLDB',version:'Unknown'});
        expect(await a.getDatabaseInfo({execute:async()=>({rows:[]})})).to.deep.equal({name:'HSQLDB',version:'Unknown'});
        let calls=0;
        expect(await a.getDatabaseInfo({execute:async()=>{if(++calls===1)throw Error('unsupported');return {rows:[[null,null]]};}})).to.deep.equal({name:'HSQLDB',version:'Unknown (detected via fallback)'});
        for(const failure of [Error('offline'),'offline'])expect(await a.getDatabaseInfo({execute:async()=>{throw failure;}})).to.deep.equal({name:'HSQLDB',version:'Unknown'});
    });
    it('handles unavailable connection dependencies and metadata failures',async()=>{
        const a=analyzer();
        expect(a.eventNames()).to.deep.equal([]);
        await rejected(()=>a.getTableCount());expect(()=>a.buildConfiguration()).to.throw();
        await rejected(()=>a.getConnection());await a.releaseConnection({});
        a.connectionManager={getConnection:async()=>{throw Error('offline');},releaseConnection:async()=>{throw 'offline';}};
        await rejected(()=>a.getConnection());await a.releaseConnection({});
        for(const failure of [Error('offline'),'offline']){
            const connection={execute:async()=>{throw failure;}};
            await rejected(()=>a.getAllTables(connection,{}));
            expect(await a.getTableIndexes(connection,'T')).to.deep.equal([]);
            expect(await a.getTableConstraints(connection,'T')).to.deep.equal([]);
            expect(await a.extractForeignKeys(connection,'T')).to.deep.equal({foreignKeys:[],referencingKeys:[]});
        }
    });
    it('assesses constraints and referential integrity on empty and populated schemas',()=>{
        const a=analyzer();expect(a.assessSecurityScore([])).to.equal(75);
        expect(a.assessSecurityScore([{constraints:[],foreignKeys:[]}])).to.equal(75);
        expect(a.assessSecurityScore([{constraints:[{}],foreignKeys:[]}])).to.equal(85);
        expect(a.assessSecurityScore([{constraints:[{},{}],foreignKeys:[{}]}])).to.equal(100);
    });
    it('returns neutral statistics and exposes errors for unavailable metadata',async()=>{
        for(const failure of [Error('offline'),'offline']){
            const a=analyzer();a._initialized=true;a.config={};let released=0;
            const connection={execute:async()=>{throw failure;}};
            a.connectionManager={getConnection:async()=>connection,releaseConnection:async()=>{released++;throw failure;}};
            await rejected(()=>a.getTableCount());expect(released).to.equal(1);
            let columnsError;try{await a.getTableColumns(connection,'T',{});}catch(e){columnsError=e;}expect(columnsError).to.equal(failure);
            expect((await a.calculateTableStatistics(connection,'T',[])).qualityScore).to.equal(50);
            let error;try{await a.getTableBasicInfo(connection,'T');}catch(e){error=e;}expect(error).to.equal(failure);
            await a.releaseConnection(connection);
        }
    });
    it('decodes missing index sort orders, descending indexes and absent FK rules',async()=>{
        const a=analyzer();
        const indexes=await a.getTableIndexes({execute:async()=>({rows:[['IX',true,'X',1,null],['IX',true,'Y',2,'D']]})},'T');
        expect(indexes[0].columns.map((c:any)=>c.sortOrder)).to.deep.equal(['ASC','DESC']);
        let calls=0;const constraints=await a.getTableConstraints({execute:async()=>({rows:++calls===1?[]:[['FK','X','P','Y',null,null]]})},'T');
        expect(constraints[0]).to.include({updateRule:'NO_ACTION',deleteRule:'NO_ACTION'});
        expect(await a.getTableBasicInfo({execute:async()=>({rows:[[null,null]]})},'T')).to.include({schema:'PUBLIC',type:'TABLE'});
    });

});
