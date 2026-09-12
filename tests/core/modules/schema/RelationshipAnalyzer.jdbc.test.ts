import {expect} from 'chai';
import {JDBCConnectionFactory} from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';
import {RelationshipAnalyzer,RelationshipType,DiscoveryMethod} from '../../../../src/core/modules/schema/RelationshipAnalyzer.js';

describe('Relationship integrity with HSQLDB composite foreign keys',()=>{
    it('accepts a nullable composite key and quotes real identifiers containing spaces',async()=>{
        const factory=new JDBCConnectionFactory();await factory.initialize({} as any);
        try{
            const connection=await factory.createConnection({url:'jdbc:hsqldb:mem:relationship_composite',autoCommit:true,readOnly:false,timeoutMs:1000});
            await connection.execute('CREATE MEMORY TABLE "Target Table" (A INTEGER, B INTEGER, PRIMARY KEY(A,B))');
            await connection.execute('CREATE MEMORY TABLE "Source Table" (A INTEGER, B INTEGER, FOREIGN KEY(A,B) REFERENCES "Target Table"(A,B))');
            await connection.execute('INSERT INTO "Source Table" VALUES (1,NULL), (NULL,2), (NULL,NULL)');
            const a:any=new RelationshipAnalyzer();a.initialized=true;a.logger={debug:()=>{},info:()=>{},warn:()=>{},error:()=>{}};
            a.connectionManager={getConnection:async()=>connection,releaseConnection:async()=>{}};
            const validation=await a.validateSingleRelationship({name:'composite',sourceTable:'Source Table',targetTable:'Target Table',sourceColumns:['A','B'],targetColumns:['A','B'],isEnforced:true,confidence:1,type:RelationshipType.MANY_TO_ONE,discoveryMethod:DiscoveryMethod.FOREIGN_KEY});
            expect(validation).to.include({isValid:true,orphanedRecords:0});await a.destroy();
        }finally{await factory.destroy();}
    });
});
