import { expect } from 'chai';
import { MinesModel } from '../../src/tables/mines/MinesModel.js';
import { EntitiesModel } from '../../src/tables/entities/EntitiesModel.js';

/** Regression cases derived from MinesTable and EntityTable SQL ARRAY columns. */
describe('StarMade SQL array representations', () => {
    for (const input of ['ARRAY[1, 2, 3, 4, 5, 6]', ' array [1,2,3,4,5,6] ', '[1,2,3,4,5,6]', [1,2,3,4,5,6]]) {
        it(`reads a mine composition from ${JSON.stringify(input)}`, () => {
            const mine = new MinesModel({ COMPOSITION: input });
            expect(mine.getCompositionValues()).to.deep.equal([1,2,3,4,5,6]);
        });
    }
    for (const input of ['["1",2,3,4,5,6]', '[1,2,3,4,5,6,7]', '[32768,2,3,4,5,6]', '[1.5,2,3,4,5,6]', '[null,2,3,4,5,6]', 'ARRAY[1junk,2,3,4,5,6]', '{}', null]) {
        it(`rejects a non-SMALLINT[6] composition ${JSON.stringify(input)}`, () => {
            expect(new MinesModel({ COMPOSITION: input }).parseComposition()).to.equal(null);
        });
    }
    it('preserves zero and signed SMALLINT values', () => {
        expect(new MinesModel({ COMPOSITION: 'ARRAY[-32768,32767,0,0,0,0]' }).getCompositionValues()).to.deep.equal([-32768,32767,0,0,0,0]);
    });
    for (const [column, method] of [['LOCAL_POS', 'parseLocalPos'], ['DIM', 'parseDim']] as const) {
        for (const input of ['42', '{}', '[null]', '["12"]', 'ARRAY[12junk]', 'ARRAY[Infinity]', 'prefix ARRAY[1,2,3] suffix']) {
            it(`rejects invalid numeric data in ${column}: ${input}`, () => {
                expect(new EntitiesModel({ [column]: input })[method]()).to.equal(null);
            });
        }
        for (const input of ['array [1, 2, 3]', [1,2,3]]) {
            it(`reads ${column} from ${JSON.stringify(input)}`, () => {
                expect(new EntitiesModel({ [column]: input })[method]()).to.deep.equal([1,2,3]);
            });
        }
    }
});
