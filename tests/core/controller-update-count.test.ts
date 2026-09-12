import {expect} from 'chai';
import {describe,it} from 'mocha';
import {PlayersController} from '../../src/tables/players/PlayersController.js';

describe('Controller mutation counts',()=>{
    it('returns the affected-row count from JDBC and forwards bound values',async()=>{
        const controller:any=new PlayersController();const calls:any[]=[];
        controller.parameterizedQuery={execute:async(...args:any[])=>{calls.push(args);return {success:true,affectedRows:3,rows:[]};}};
        expect(await controller.executeUpdate('DELETE FROM T WHERE ID=?',[1])).to.equal(3);
        expect(calls).to.deep.equal([['DELETE FROM T WHERE ID=?',[1]]]);
        controller.parameterizedQuery.execute=async()=>({success:true,affectedRows:0});
        expect(await controller.executeUpdate('DELETE FROM T',[])).to.equal(0);
    });
    it('rejects missing query modules, failed results and invalid update counts',async()=>{
        const controller:any=new PlayersController();
        for(const result of [undefined,{success:false,affectedRows:0},{success:true,affectedRows:-1},{success:true,affectedRows:NaN}]){
            controller.parameterizedQuery=result===undefined?undefined:{execute:async()=>result};
            let error:unknown;try{await controller.executeUpdate('DELETE FROM T',[]);}catch(e){error=e;}
            expect(error).to.be.instanceOf(Error);
        }
    });
});
