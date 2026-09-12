import {expect} from 'chai';
import {describe,it} from 'mocha';
import * as E from '../../src/core/errors.js';

describe('Structured errors',()=>{
    it('serializes context, severity and recoverability without losing the original cause',()=>{
        const base=new E.HSQLDBError('message','CODE');
        expect(base.getFormattedMessage()).to.equal('[CODE] message');
        expect(base.toJSON()).to.include({message:'message',code:'CODE',recoverable:false});
        expect(new E.HSQLDBError('message','CODE',false,{}).getFormattedMessage()).to.equal('[CODE] message');
        const context=new E.HSQLDBError('message','CODE',true,{id:1});
        expect(context.getFormattedMessage()).to.include('id: 1');
        expect(E.formatErrorForLogging(context)).to.equal(context.getFormattedMessage());
        expect(E.formatErrorForLogging(new Error('raw'))).to.equal('[Error] raw');
        expect(E.isHSQLDBError(base)).to.equal(true); expect(E.isHSQLDBError(null)).to.equal(false);
        expect(E.isRecoverableError(context)).to.equal(true);expect(E.isRecoverableError(base)).to.equal(false);expect(E.isRecoverableError(new Error())).to.equal(false);
        for(const [error,severity] of [[new Error(),'medium'],[base,'medium'],[new E.ConfigurationError('bad'),'critical'],
            [new E.JavaEnvironmentError('bad'),'critical'],[new E.ConnectionError('bad'),'high'],[new E.TransactionError('id','commit','bad'),'high'],
            [new E.QueryExecutionError('SELECT 1','bad'),'medium']] as const)expect(E.getErrorSeverity(error)).to.equal(severity);
        const fatal=new E.QueryExecutionError('SELECT 1','bad');(fatal as any).recoverable=false;expect(E.getErrorSeverity(fatal)).to.equal('high');
        expect(new E.PerformanceError('bad',new Error('cause')).context?.cause).to.equal('cause');
    });
    it('constructs specific diagnostic errors with required context and optional details',()=>{
        const cases:Array<[any,any[]]>=[
            [E.ConnectionTimeoutError,[10]],[E.PoolExhaustedError,[10,2,2]],
            [E.ConnectionRetriesExhaustedError,[3]],[E.ConnectionRetriesExhaustedError,[3,new Error('cause')]],
            [E.ConnectionLostError,[]],[E.ConnectionLostError,['network']],
            [E.StarMadeDirectoryError,['/missing']],[E.WorldNotFoundError,['world']],[E.WorldNotFoundError,['world',['other']]],
            [E.DatabaseFileError,['/missing','read']],[E.DatabaseFileError,['/missing','read','denied']],
            [E.HSQLDBJarError,['/missing.jar']],[E.JavaEnvironmentError,['missing','24','/java']],
            [E.SQLValidationError,['SELECT',[{code:'invalid',message:'bad',severity:'error'}]]],
            [E.SQLInjectionError,['SELECT','tautology',.9,'OR 1=1']],
            [E.MemoryLimitError,[10,20]],[E.CacheError,['get','bad']],[E.CacheError,['get','bad','key']],
            [E.SchemaError,['table','PLAYERS']],[E.ModuleDestroyedError,['module','query']],
            [E.InvalidManagerStateError,['query','destroyed',['ready']]],[E.ManagerDestroyedError,['query']]
        ];
        for(const [Type,args] of cases){const error=new Type(...args);expect(error).to.be.instanceOf(E.HSQLDBError);expect(error.code).to.be.a('string').and.not.equal('');expect(error.toJSON().name).to.equal(Type.name);expect(error.timestamp).to.be.instanceOf(Date);}
    });
    it('normalizes native errors and dispatches specific JDBC failure classes',()=>{
        expect(E.extractJDBCErrorInfo({})).to.include({message:'Unknown JDBC error'});
        expect(E.extractJDBCErrorInfo({message:'bad',code:2,cause:new Error('root')})).to.include({message:'bad',errorCode:2,cause:'root'});
        expect(E.extractJDBCErrorInfo('bad').message).to.equal('bad');expect(E.extractJDBCErrorInfo(null).message).to.equal('Unknown error');
        for(const [message,Type] of [['timeout',E.QueryTimeoutError],['syntax',E.SQLSyntaxError],['deadlock',E.TransactionDeadlockError],['connection',E.ConnectionError],['other',E.QueryExecutionError]] as const)
            expect(E.createErrorFromJDBC('SELECT 1',new Error(message))).to.be.instanceOf(Type);
    });
    it('builds missing-field and connection errors through factories',()=>{
        expect(E.ErrorFactory.createConnectionError('bad').context?.cause).to.equal(undefined);
        expect(E.ErrorFactory.createConnectionError('bad','/db','world',new Error('root')).context?.cause).to.equal('root');
        expect(E.ErrorFactory.createConfigError('bad',null,['a']).invalidFields).to.deep.equal(['a']);
        expect(E.ErrorFactory.createConfigError('bad',{a:0,b:null},['a','b','c']).invalidFields).to.deep.equal(['b','c']);
        const error=E.ErrorFactory.createSQLRequiredFieldError('T','INSERT',{a:null,b:0},['a','b','c']);
        expect(error.missingFields).to.deep.equal(['a','c']);expect(error.getDetailedMessage()).to.include('a: Value required');
    });
    it('parses constraint diagnostics and gives actionable suggestions',()=>{
        const cases:Array<[string,string,string[]]>=[
            ['foreign key no parent FFKC','FOREIGN_KEY',['FLEET_ID']],['foreign key no parent EFKC','FOREIGN_KEY',['ENTITY_ID']],
            ['foreign key no parent other','FOREIGN_KEY',[]],['integrity constraint violation: foreign key FLEET','FOREIGN_KEY',['FLEET_ID']],
            ['unique constraint UID_INDEX UID','UNIQUE',['UID']],['index violation PRIMARY','UNIQUE',['ID']],['duplicate value','UNIQUE',[]],
            ['Parameter 2 cannot be null','NOT_NULL',['FLEET_ID']],['Parameter 99 cannot be null','NOT_NULL',['UNKNOWN_FIELD']],
            ['NOT NULL','NOT_NULL',[]],['PRIMARY KEY','PRIMARY_KEY',['ID']],['check failed','CHECK',[]]
        ];
        for(const [message,type,fields] of cases){
            const error=E.ErrorFactory.createSQLConstraintError('INSERT',message as any,'T',{ID:1});
            expect(error.constraintType).to.equal(type);expect(error.violatedFields).to.deep.equal(fields);
            expect(error.getSuggestion()).to.be.a('string').and.not.equal('');expect(error.getDetailedMessage()).to.include('Constraint Details');
        }
        for(const data of [undefined,{}, {ID:1}]){
            const error=new E.SQLConstraintViolationError('INSERT','PRIMARY_KEY','PK','T',['ID','absent'],data,'duplicate');
            expect(error.getDetailedMessage()).to.include('Table: T');
        }
        const unknown=new E.SQLConstraintViolationError('INSERT','unknown' as any,'','T',[],null,'bad');
        expect(unknown.getSuggestion()).to.include('Review the data');
    });
});
