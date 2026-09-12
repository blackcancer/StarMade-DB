import { expect } from 'chai';
import { SectorsModel } from '../../src/tables/sectors/SectorsModel.js';

/** SectorTable's unique index is global, and system grids have sixteen sectors per axis. */
describe('StarMade sector coordinate contract', () => {
    it('detects duplicate global coordinates even when STELLAR disagrees', () => {
        const first = new SectorsModel({ ID: 1, X: 17, Y: 2, Z: -1, STELLAR: 10 });
        const second = new SectorsModel({ ID: 2, X: 17, Y: 2, Z: -1, STELLAR: 20 });
        expect(first.hasCoordinateConflictWith(second)).to.equal(true);
        expect(first.getUniqueCoordinateKey()).to.equal(second.getUniqueCoordinateKey());
        expect(first.getSystemContextCoordinateKey()).not.to.equal(second.getSystemContextCoordinateKey());
        expect(SectorsModel.schema.indexes.find(index => index.name === 'secCoordIndex')!.columns).to.deep.equal(['X', 'Y', 'Z']);
    });
    for (const [position, relative, system] of [
        [[0,0,0],[0,0,0],[0,0,0]], [[17,31,16],[1,15,0],[1,1,1]], [[-1,-16,-17],[15,0,15],[-1,-1,-2]]
    ]) {
        it(`derives system and local coordinates for ${position}`, () => {
            const sector = new SectorsModel({ X: position[0], Y: position[1], Z: position[2] });
            expect(sector.calculateRelativeCoordinatesInSystem()).to.deep.equal({
                relative: { x: relative[0], y: relative[1], z: relative[2] },
                systemCoords: { x: system[0], y: system[1], z: system[2] }, calculated: true
            });
        });
    }
    it('recognizes every system origin rather than only universe origin', () => {
        expect(new SectorsModel({ X: 16, Y: -32, Z: 48 }).isSystemOrigin()).to.equal(true);
        for (const xyz of [[1,0,0], [0,1,0], [0,0,1]]) {
            expect(new SectorsModel({ X: xyz[0], Y: xyz[1], Z: xyz[2] }).isSystemOrigin()).to.equal(false);
        }
    });
    it('honors an explicit system grid size', () => {
        const sector = new SectorsModel({ X: 7, Y: -1, Z: 4 });
        expect(sector.calculateRelativeCoordinatesInSystem(4).relative).to.deep.equal({x:3,y:3,z:0});
    });
    for (const size of [0, -1, 1.5, Infinity, NaN]) {
        it(`rejects invalid system size ${size}`, () => {
            expect(() => new SectorsModel().calculateRelativeCoordinatesInSystem(size)).to.throw(RangeError);
        });
    }
});
