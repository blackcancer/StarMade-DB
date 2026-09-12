import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { ModelClasses } from '../../src/tables/index.js';

/** Column names and identity metadata from the test database schema, without game source code. */
const contract: Record<string, { columns: string[]; generated: string[] }> = JSON.parse(
    readFileSync(new URL('./schema-contract.json', import.meta.url), 'utf8')
);

/** Validate every model against the independently recorded database schema. */
describe('StarMade database schema contract', () => {
    it('covers every exported table model', () => {
        expect(Object.keys(contract).sort()).to.deep.equal(Object.keys(ModelClasses).sort());
    });
    for (const [table, expected] of Object.entries(contract)) {
        const model = ModelClasses[table as keyof typeof ModelClasses];
        it(`${table} exposes exactly the database columns`, () => {
            expect(model.schema.columns.map(column => column.name).sort()).to.deep.equal([...expected.columns].sort());
        });
        it(`${table} marks only database identity columns as generated`, () => {
            expect(model.schema.columns.filter(column => column.autoIncrement).map(column => column.name)).to.deep.equal(expected.generated);
        });
    }
    it('accepts a new player before HSQLDB assigns its identity', () => {
        const player = new ModelClasses.PLAYERS({ NAME: 'new_player', STARMADE_NAME: 'New Player', FACTION: 0, PERMISSION: 0 });
        expect(player.validate().errors.map(error => error.field)).not.to.include('ID');
    });
    it('requires the game-assigned mine ID', () => {
        const mine = new ModelClasses.MINES();
        expect(mine.validate().errors.map(error => error.field)).to.include('ID');
    });
});
