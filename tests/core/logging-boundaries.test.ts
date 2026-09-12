import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeLogger,closeLogger,createModuleLogger,createSilentLogger,DEFAULT_CONFIGS} from '../../src/core/modules/logging/Logger.js';
describe('Logging transport boundaries',()=>{
    afterEach(()=>closeLogger());
    it('keeps explicitly enabled console output active',()=>{
        const logger:any=initializeLogger({...DEFAULT_CONFIGS.testing,enableConsole:true});
        expect(logger.logger.silent).to.equal(false);
    });
    it('creates file transports with default and explicit rotation settings',()=>{
        const dir=mkdtempSync(join(tmpdir(),'starmade-logger-'));
        try{
            for(const settings of [{enableQueries:false},{enableQueries:true},{enableQueries:true,maxSize:'5k',maxFiles:2}]){
                const logger:any=initializeLogger({...DEFAULT_CONFIGS.testing,enableFile:true,...settings,logDir:join(dir,'nested','logs')});
                expect(logger.logger.transports).to.have.length(settings.enableQueries?3:2);expect(logger.formatContext()).to.deep.equal({});
                logger.close();
            }
        }finally{rmSync(dir,{recursive:true,force:true});}
    });
    it('validates size units and forwards connection and performance metadata',()=>{
        const logger:any=initializeLogger({...DEFAULT_CONFIGS.testing,enableConnections:true,enablePerformance:true});
        for(const [unit,size] of [['k',1024],['m',1024**2],['g',1024**3]])expect(logger.parseSize('2'+unit)).to.equal(2*Number(size));
        expect(()=>logger.parseSize('invalid')).to.throw('Invalid size');
        const calls:any[]=[];logger.info=(...args:any[])=>calls.push(args);const module=createModuleLogger('boundary');module.connection('acquired','id');module.performance('duration',5);
        expect(calls.map(c=>c[0])).to.deep.equal(['Connection acquired','Performance metric']);
    });

    it('forwards query metadata and provides a silent logger',()=>{
        const logger:any=initializeLogger({...DEFAULT_CONFIGS.testing});const calls:any[]=[];logger.query=(...args:any[])=>calls.push(args);
        createModuleLogger('boundary').query('SELECT 1',3);expect(calls).to.deep.equal([['SELECT 1',3,{module:'boundary'}]]);
        expect(createSilentLogger()).to.have.property('info');
    });

    it('formats messages without metadata and applies live configuration changes',()=>{
        const logger:any=initializeLogger({...DEFAULT_CONFIGS.testing,level:'info',enableConsole:true,enableQueries:true});
        const output:string[]=[];const write=sinon.stub(process.stdout,'write').callsFake((chunk:any)=>{output.push(String(chunk));return true;});
        try{
            logger.log('info','plain message');logger.query('SELECT 1',5);
            expect(output.join('')).to.include('plain message').and.include('Query executed: SELECT 1');
            expect(output.find(line=>line.includes('plain message'))).not.to.include('{}');
            logger.updateConfig({enableConsole:false,enableQueries:false});
            expect(logger.logger.silent).to.equal(true);logger.query('SELECT 2',1);
        }finally{write.restore();}
    });

});
