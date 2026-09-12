import { expect } from 'chai';
import { SectorsModel } from '../../src/tables/sectors/SectorsModel.js';
import { EntitiesModel } from '../../src/tables/entities/EntitiesModel.js';

describe('SQL numeric domain validation', () => {
    const validator=SectorsModel.schema.validationRules.find(rule=>rule.field==='COORDINATES_VALID')!.validator!;
    for(const coordinate of ['X','Y','Z']) {
        for(const value of [undefined, -2147483649,2147483648,1.5,NaN,Infinity,'one']) {
            it(`rejects ${coordinate}=${String(value)} outside the SQL INTEGER domain`,()=> {
                expect(validator(undefined,{X:0,Y:0,Z:0,[coordinate]:value})).to.be.a('string');
            });
        }
    }
    it('preserves explicit entity docking identifier zero',()=> {
        const model=new EntitiesModel({DOCKED_TO:0,DOCKED_ROOT:0});
        expect(model.getDockedTo()).to.equal(0);
        expect(model.getDockedRoot()).to.equal(0);
    });
    it('distinguishes absent docking IDs from string and numeric values',()=> {
        for(const value of [undefined,null,1,'2']) {
            const model=new EntitiesModel({DOCKED_TO:value,DOCKED_ROOT:value});
            expect(model.getDockedTo()).to.equal(value==null?-1:Number(value));
            expect(model.getDockedRoot()).to.equal(value==null?-1:Number(value));
        }
    });
});
