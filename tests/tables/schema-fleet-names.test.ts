import { expect } from 'chai';
import { FleetsModel } from '../../src/tables/fleets/FleetsModel.js';

describe('NPC fleet name parsing', () => {
    for (const prefix of ['NPCFLT', 'GNPCFLT']) {
        it(`extracts the faction rather than parsing the ${prefix} prefix`, () => {
            const fleet = new FleetsModel({NAME:`${prefix}#MINING#-9999998#-1, 2, -3#7`});
            expect(fleet.getFactionIdFromName()).to.equal(-9999998);
            expect(fleet.getSystemCoordsFromName()).to.deep.equal({x:-1,y:2,z:-3});
            expect(fleet.getFleetIndexFromName()).to.equal(7);
            expect(fleet.isNPCFleet()).to.equal(true);
        });
    }
    for (const name of [undefined, null, '', 'player fleet']) {
        it(`does not classify ${String(name)} as an NPC fleet`, () => {
            const fleet = new FleetsModel({ NAME: name });
            expect(fleet.isNPCFleet()).to.equal(false);
            expect(fleet.getFactionIdFromName()).to.equal(null);
            expect(fleet.getSystemCoordsFromName()).to.equal(null);
            expect(fleet.getFleetIndexFromName()).to.equal(null);
        });
    }
});

describe('Fleet member docking target types', () => {
    it('recognizes a station target from the loaded entity type', async () => {
        const {FleetMembersModel, DockingStatus} = await import('../../src/tables/fleet-members/FleetMembersModel.js');
        const {EntitiesModel, EntityType} = await import('../../src/tables/entities/EntitiesModel.js');
        const member = new FleetMembersModel({DOCKED_TO:10});
        member.setDockedToEntity(new EntitiesModel({ID:10,TYPE:EntityType.SPACE_STATION}));
        expect(member.getDockingStatus()).to.equal(DockingStatus.DOCKED_TO_STATION);
    });
});
