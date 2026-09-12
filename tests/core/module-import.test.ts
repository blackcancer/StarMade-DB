import {expect} from 'chai';
import {importModule} from '../../src/core/modules/importModule.js';
import {loadModule} from '../../src/core/modules/index.js';

describe('Lazy module loading interoperability',()=>{
    it('loads native ESM, CommonJS objects and CommonJS functions',async()=>{
        const esm:any=await importModule('../errors.js');expect(esm.ConfigurationError).to.be.a('function');
        const compiledCommonJs:any=await importModule('nodejs-jdbc');expect(compiledCommonJs.JDBC).to.be.a('function');
        const plainCommonJs:any=await importModule('node:fs');expect(plainCommonJs.readFile).to.be.a('function');
        const functionCommonJs:any=await importModule('ms');expect(functionCommonJs.default('1s')).to.equal(1000);
    });
    it('rejects inherited object properties as unknown registry names',async()=>{
        for(const name of ['constructor','toString','__proto__']){
            let failure:any;try{await loadModule(name as any);}catch(error){failure=error;}
            expect(failure).to.be.instanceOf(Error);expect(failure.message).to.equal(`Module '${name}' not found in registry`);
        }
    });
});
