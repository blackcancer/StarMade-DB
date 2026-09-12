import { expect } from 'chai';
import { ModelClasses } from '../../src/tables/index.js';
import { FleetsModel, MissionString, FactionAccess, CombatSetting } from '../../src/tables/fleets/FleetsModel.js';
import { FleetMembersModel } from '../../src/tables/fleet-members/FleetMembersModel.js';
import { PlayersModel } from '../../src/tables/players/PlayersModel.js';
import { EntitiesModel } from '../../src/tables/entities/EntitiesModel.js';

describe('Model value boundaries', () => {
    for (const [table, Model] of Object.entries(ModelClasses)) {
        if (table === 'ID_GEN_TABLE') continue;
        for (const raw of ['42', 42, undefined, null]) {
            it(`reads ${table}.ID=${String(raw)} without changing null semantics`, () => {
                const model = new Model({ID:raw}) as any;
                const expected = table === 'SECTORS_ITEMS' || table === 'PLAYERS' || table === 'EFFECTS' ? raw : raw == null ? undefined : raw;
                expect(model.getId()).to.equal(typeof expected === 'string' ? 42 : expected);
            });
        }
    }
    it('normalizes numeric strings in related identifiers and player fields', () => {
        expect(new ModelClasses.EFFECTS({ENTITY_ID:'123'}).getEntityId()).to.equal(123);
        const player = new PlayersModel({FACTION:'22',PERMISSION:'7'});
        expect(player.getFaction()).to.equal(22);
        expect(player.getPermission()).to.equal(7);
        expect(new FleetsModel({PARENT_FLEET:'22'}).getParentFleet()).to.equal(22);
    });
    it('preserves absent padded character data and entity flags', () => {
        const entity = new EntitiesModel({NAME:undefined,LAST_MOD:'author   ',SPAWNED_ONLY_IN_DB:true});
        expect(entity.getName()).to.equal(undefined);
        expect(entity.getLastMod()).to.equal('author');
        expect(entity.getSpawnedOnlyInDb()).to.equal(true);
        entity.setLastMod(undefined);
        expect(entity.getLastMod()).to.equal(undefined);
        entity.setType(999 as any);
        expect(entity.getTypeName()).to.equal('UNKNOWN_999');
    });
    for (const [table, relation, getter] of [
        ['ENTITIES','sector','getSectorName'], ['FLEET_MEMBERS','fleet','getFleetName'],
        ['FLEET_MEMBERS','entity','getEntityName'], ['FLEET_MEMBERS','dockedToEntity','getDockedToEntityName'],
        ['FLEETS','flagship','getFlagshipName'], ['FLEETS','parentFleet','getParentFleetName'],
        ['FTL','fromEntity','getFromEntityName'], ['FTL','toEntity','getToEntityName'],
        ['MINES','sector','getSectorName']
    ]) {
        it(`handles a partial ${relation} relation in ${table}`, () => {
            const model = new ModelClasses[table as keyof typeof ModelClasses]() as any;
            model.setRelated(relation, {});
            expect(model[getter]()).to.equal(undefined);
        });
    }
    for (const [text, expected] of [
        ['IDLE WAIT','IDLE'], ['SENTRY FORMATION WAIT','SENTRY - FORMATION'], ['SENTRY WAIT','SENTRY'],
        ['ATTACK NOW','ATTACKING'], ['DEFEND NOW','DEFENDING'], ['MINING NOW','MINING'],
        ['TRADING NOW','TRADING'], ['PATROL NOW','PATROLLING'], ['MOVING NOW','MOVING'],
        ['REPAIR NOW','REPAIRING'], ['CALLBACK NOW','CALLBACK TO CARRIER'], ['CARRIER NOW','CALLBACK TO CARRIER'],
        ['STANDOFF NOW','STANDOFF'], ['ESCORT NOW','ESCORTING'], ['CLOAK NOW','CLOAKING'],
        ['UNCLOAK NOW','UNCLOAKING'], ['JAM NOW','JAMMING'], ['STOP JAM NOW','STOP JAMMING'],
        ['INTERDICT NOW','FTL INTERDICTING'], ['STOP INTERDICT NOW','STOP FTL INTERDICTION']
    ]) {
        for (const Model of [FleetsModel, FleetMembersModel]) {
            it(`normalizes ${Model.tableName} mission variant ${text}`, () => {
                expect(new Model({MISSION_STRING:text}).getMissionState()).to.equal(expected);
            });
        }
    }
    it('normalizes idle sentry fleet variants and empty missions', () => {
        expect(new FleetsModel({MISSION_STRING:'IDLE SENTRY WAIT'}).getMissionState()).to.equal(MissionString.IDLE_SENTRY);
        expect(new FleetsModel({MISSION_STRING:''}).getMissionState()).to.equal(null);
    });
    for (const [value, description] of [[FactionAccess.COMMANDER,'Commanders and Above'],[FactionAccess.RECRUIT,'Including Recruits'],[99,'Unknown']] as const) {
        it(`describes faction access ${value}`, () => {
            expect(new FleetsModel({FACTION_ACCESS:value}).getAccessDescription()).to.equal(description);
        });
    }
    for (const setting of [CombatSetting.SOMETIMES_ENGAGE, CombatSetting.ALWAYS_FLEE]) {
        it(`describes combat setting ${setting}`, () => {
            expect(new FleetsModel({COMBAT_SETTING:setting}).getCombatBehavior().toUpperCase()).to.include(setting);
        });
    }
    it('falls back to an owner login and accepts partial owner data', () => {
        const fleet = new FleetsModel();
        fleet.setRelated('ownerPlayer', {getName:()=> 'login'});
        expect(fleet.getOwnerName()).to.equal('login');
        fleet.setRelated('ownerPlayer', {});
        expect(fleet.getOwnerName()).to.equal(undefined);
    });
});
