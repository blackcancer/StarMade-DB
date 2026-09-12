import {expect} from 'chai';
import {describe,it} from 'mocha';
import * as tables from '../../src/tables/index.js';
import {getAvailableModules,loadModule} from '../../src/core/modules/index.js';
import {ModuleRegistry} from '../../src/core/HSQLManager.js';
import '../../src/core/interfaces.js';

describe('Registry contracts',()=>{
    it('maps every declared table to matching models, schemas and controllers',()=>{
        const names=tables.getAllTableNames();
        expect(names).to.have.length(16);
        expect(tables.ModelRegistry.getTableNames().sort()).to.deep.equal([...names].sort());
        for(const name of names){
            const Model:any=tables.getModelClass(name);
            expect(Model.getTableName()).to.equal(name);
            expect(tables.createModel(name)).to.be.instanceOf(Model);
            expect(tables.ModelRegistry.create(name.toLowerCase(),{})).to.be.instanceOf(Model);
            expect(tables.getControllerClass(name)).to.be.a('function');
            expect(tables.ModelRegistry.getSchema(name)?.tableName).to.equal(name);
            expect(tables.isValidTableName(name)).to.equal(true);
            expect(tables.ModelRegistry.hasTable(name.toLowerCase())).to.equal(true);
        }
        expect(tables.createModel('missing')).to.equal(undefined);
        expect(tables.ModelRegistry.create('missing')).to.equal(undefined);
        expect(tables.ModelRegistry.getSchema('missing')).to.equal(undefined);
        expect(tables.getControllerClass('missing')).to.equal(undefined);
        expect(tables.ModelRegistry.hasTable('missing')).to.equal(false);
        for(const inherited of ['toString','constructor','__proto__']){
            expect(tables.isValidTableName(inherited)).to.equal(false);
            expect(tables.getModelClass(inherited)).to.equal(undefined);
            expect(tables.getControllerClass(inherited)).to.equal(undefined);
        }
    });
    it('loads each supported module and rejects unknown names',async()=>{
        for(const name of getAvailableModules())expect(Object.keys(await loadModule(name as any)).length).to.be.greaterThan(0);
        let error:unknown;try{await loadModule('missing' as any);}catch(e){error=e;}
        expect(error).to.be.instanceOf(Error).with.property('message',"Module 'missing' not found in registry");
    });
    it('creates fresh module instances from registered constructors',()=>{
        class Module {name='test-registry';version='1';isInitialized=false;async initialize(){} async destroy(){}}
        const registry=(ModuleRegistry as any).registry;
        try{
            ModuleRegistry.register('test-registry',Module);
            expect(ModuleRegistry.getRegisteredModules()).to.include('test-registry');
            expect(ModuleRegistry.create('test-registry')).to.be.instanceOf(Module);
            expect(ModuleRegistry.create('test-registry')).not.to.equal(ModuleRegistry.create('test-registry'));
            expect(ModuleRegistry.create('missing')).to.equal(undefined);
        }finally{registry.delete('test-registry');}
    });
});
