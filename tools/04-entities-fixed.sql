-- =============================================================================
-- ENTITIES TABLE TEST DATA
-- =============================================================================
-- Test data for the ENTITIES table representing all game entities
-- Contains diverse entity types with realistic relationships and docking chains
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test entities with varied types, factions, and relationships
INSERT INTO ENTITIES (ID, UID, X, Y, Z, TYPE, NAME, FACTION, CREATOR, LAST_MOD, SEED, TOUCHED, LOCAL_POS, DIM, GEN_ID, DOCKED_TO, DOCKED_ROOT, SPAWNED_ONLY_IN_DB, TRACKED) VALUES
-- Player ships docked to stations
(1, 'TEST_PLAYER_SHIP_001', -4,  1,  0, 0, 'TestPlayer Explorer', 1, 'TestPlayerFactionLeader1', 'TestPlayerFactionLeader1', 0, true, ARRAY[870.0, -1195.0, 755.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 129, 129, false, false),
(2, 'TEST_PLAYER_SHIP_002', -4,  1,  0, 0, 'TestPlayer Frigate', 1, 'TestPlayerSeniorOfficer1', 'TestPlayerSeniorOfficer1', 0, true, ARRAY[865.0, -1205.0, 745.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 129, 1, false, false),
(3, 'TEST_PLAYER_SHIP_003', -4,  1,  0, 0, 'TestPlayer Fighter', 1, 'TestPlayerBasicOfficer1', 'TestPlayerBasicOfficer1', 0, true, ARRAY[880.0, -1185.0, 765.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 129, 2, false, false),

-- Trading Guild entities
(4, 'TEST_TG_FREIGHTER_001', -2, 1, 0, 0, 'TG Freighter Alpha', -10000000, '', '', 0, true, ARRAY[-1950.0, 2800.0, -1550.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(5, 'TEST_TG_FREIGHTER_002', -2, 0, 1, 0, 'TG Freighter Beta', -10000000, '', '', 0, true, ARRAY[1700.0, -3300.0, 2300.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Outcast entities
(6, 'TEST_OC_RAIDER_001', 3, 1, 0, 0, 'Outcast Raider Alpha', -9999999, '', '', 0, true, ARRAY[-4100.0, 3900.0, -3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(7, 'TEST_OC_RAIDER_002', 3, 0, -1, 0, 'Outcast Raider Beta', -9999999, '', '', 0, true, ARRAY[-4300.0, 3700.0, -2800.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Scavenger entities
(8, 'TEST_SC_COLLECTOR_001', 0, -2, 0, 0, 'Scavenger Collector', -9999998, '', '', 0, true, ARRAY[750.0, 4550.0, -1150.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- More player ships with complex docking chains
(9, 'TEST_PLAYER_CARRIER_001', 5, 1, 0, 0, 'Faction Carrier Alpha', 1, 'TestPlayerCommander1', 'TestPlayerCommander1', 0, true, ARRAY[-6350.0, 5350.0, -3650.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(10, 'TEST_PLAYER_FIGHTER_001', 5, 1, 0, 0, 'Fighter Alpha', 1, 'TestPlayerPilot1', 'TestPlayerPilot1', 0, true, ARRAY[-6340.0, 5340.0, -3640.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 9, 9, false, false),
(11, 'TEST_PLAYER_FIGHTER_002', 5, 1, 0, 0, 'Fighter Beta', 1, 'TestPlayerPilot2', 'TestPlayerPilot2', 0, true, ARRAY[-6330.0, 5330.0, -3630.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 9, 9, false, false),
(12, 'TEST_PLAYER_FIGHTER_003', 5, 1, 0, 0, 'Fighter Gamma', 1, 'TestPlayerPilot3', 'TestPlayerPilot3', 0, true, ARRAY[-6320.0, 5320.0, -3620.0], ARRAY[0, 0, 0, 20, 30, 25], 0, 9, 9, false, false),

-- Independent player entities
(13, 'TEST_INDEPENDENT_001', 8, 0, 0, 0, 'Independent Explorer', 0, 'TestPlayerIndependent1', 'TestPlayerIndependent1', 0, true, ARRAY[7200.0, -4500.0, 3600.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(14, 'TEST_INDEPENDENT_002', 8, 1, 0, 0, 'Independent Trader', 0, 'TestPlayerIndependent2', 'TestPlayerIndependent2', 0, true, ARRAY[7250.0, -4450.0, 3650.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(15, 'TEST_INDEPENDENT_003', -5, 0, 0, 0, 'Independent Miner', 0, 'TestPlayerIndependent3', 'TestPlayerIndependent3', 0, true, ARRAY[5800.0, -6200.0, 4100.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

(16, 'TEST_FACTION2_SHIP_001', 10, 1, 0, 0, 'Faction 2 Cruiser', 2, 'TestPlayerFactionLeader2', 'TestPlayerFactionLeader2', 0, true, ARRAY[-7450.0, 6850.0, -4150.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(17, 'TEST_FACTION2_SHIP_002', 10, 0, 1, 0, 'Faction 2 Destroyer', 2, 'TestPlayerSeniorOfficer2', 'TestPlayerSeniorOfficer2', 0, true, ARRAY[-7550.0, 6750.0, -4250.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

-- Astronauts and NPCs
(18, 'TEST_ASTRONAUT_001', 0, 0, -1, 10, 'Test Astronaut Alpha', 1, 'TestPlayerFactionLeader1', 'TestPlayerFactionLeader1', 0, true, ARRAY[855.0, -1195.0, 750.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(19, 'TEST_ASTRONAUT_002', 5, 0, 0, 10, 'Test Astronaut Beta', 1, 'TestPlayerMember1', 'TestPlayerMember1', 0, true, ARRAY[-6500.0, 5200.0, -3800.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(20, 'TEST_NPC_001', -2, 0, 0, 11, 'Trading Guild NPC', -10000000, '', '', 0, true, ARRAY[1800.0, -3200.0, 2400.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(21, 'TEST_NPC_002', 3, 0, 0, 11, 'Outcast NPC', -9999999, '', '', 0, true, ARRAY[-4200.0, 3800.0, -2900.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

(22, 'TEST_RESEARCH_PROBE_002', 0, 1, 10, 0, 'Research Probe Beta', 6, 'TestPlayerScientist1', 'TestPlayerScientist1', 0, true, ARRAY[1250.0, -900.0, -7850.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

(23, 'TEST_CONTESTED_002', 10, 1, 0, 0, 'Contested Ship Alpha', 4, 'TestPlayerCommander2', 'TestPlayerCommander2', 0, true, ARRAY[-7450.0, 6850.0, -4150.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

(24, 'TEST_CORE_FLEET_001', 0, 11, 0, 0, 'Core Fleet Flagship', 5, 'TestPlayerFactionLeader5', 'TestPlayerFactionLeader5', 0, true, ARRAY[1150.0, -7250.0, 1550.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

-- Additional variety entities
(25, 'TEST_SPACE_CREATURE_001', 0, 2, 0, 7, 'Space Creature Alpha', 0, '', '', 123456802, true, ARRAY[350.0, -1950.0, 850.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(26, 'TEST_PLANET_SEGMENT_001', 0, 0, 1, 13, 'Planet Segment Alpha', 0, '', '', 123456803, true, ARRAY[-2250.0, 1750.0, -850.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(27, 'TEST_PLANET_CORE_001', 0, 0, 1, 14, 'Planet Core Alpha', 0, '', '', 123456804, true, ARRAY[-2300.0, 1700.0, -900.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(28, 'TEST_SHIP_CORE_001', 5, 1, 0, 5, 'Ship Core Alpha', 1, 'TestPlayerBuilder1', 'TestPlayerBuilder1', 0, true, ARRAY[-6350.0, 5350.0, -3650.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(29, 'TEST_VEHICLE_001', 0, 0, 1, 17, 'Test Vehicle Alpha', 1, 'TestPlayerMember2', 'TestPlayerMember2', 0, true, ARRAY[-2200.0, 1800.0, -800.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

-- Float rocks
(30, 'TEST_FLOAT_ROCK_001', -5, 1, 0, 4, 'Float Rock Alpha', 0, '', '', 123456805, true, ARRAY[6000.0, -6000.0, 4200.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(31, 'TEST_FLOAT_ROCK_002', -5, 0, 1, 4, 'Float Rock Beta', 0, '', '', 123456806, true, ARRAY[5900.0, -6100.0, 4300.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

-- Managed asteroids
(32, 'TEST_MANAGED_ASTEROID_001', 5, 0, 2, 6, 'Managed Asteroid Alpha', 1000001, 'TestPlayerMiner1', 'TestPlayerMiner1', 0, true, ARRAY[-6150.0, 5450.0, -3450.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),
(33, 'TEST_MANAGED_ASTEROID_002', 5, 1, 2, 6, 'Managed Asteroid Beta', 1000001, 'TestPlayerMiner2', 'TestPlayerMiner2', 0, true, ARRAY[-6300.0, 5400.0, -3600.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, false),

-- Death star (special entity)
(34, 'TEST_DEATH_STAR_001', 0, 0, 15, 18, 'Test Death Star', 1000005, 'TestPlayerFactionLeader5', 'TestPlayerFactionLeader5', 0, true, ARRAY[2200.0, -1100.0, -7500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Stars & blackholes used by sectors
(35, 'STAR_SOL_A'		,  1,  1,  1, 16, 'Sol',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(36, 'STAR_ALPHA_A'		,  0,  1,  4, 16, 'Giant Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(37, 'STAR_BIN_A'		,  0,  4,  1, 16, 'Binary Star A',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(38, 'STAR_BIN_B'		,  0,  4,  1, 16, 'Binary Star B',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(39, 'STAR_TG5_A'		, -6,  1,  1, 16, 'Local Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(40, 'STAR_TG6_A'		, -6, -2,  1, 16, 'Local Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(41, 'STAR_TG7_A'		, -6,  1,  4, 16, 'Giant Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(42, 'STAR_OC8_A'		,  9,  1,  1, 16, 'Red Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(43, 'STAR_SC10_A'		,  9,  1,  1, 16, 'Scarlet Dwarf',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(44, 'STAR_SC11_A'		,  0, -8,  1, 16, 'Rust Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(45, 'STAR_N12_A'		,  3, -8,  1, 16, 'Sol-Clone Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(46, 'STAR_RE13_A'		, 15,  1,  1, 16, 'Blue Giant',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(47, 'STAR_FD14_A'		, 15,  4,  1, 16, 'Remote Dwarf',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(48, 'STAR_CW16_A'		,-15,  1,  1, 16, 'Core Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(49, 'STAR_VZ17_A'		,-15, -2,  1, 16, 'Volcanic Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(50, 'STAR_IF18_A'		,-15,  1,  4, 16, 'Giant Ice Sun',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(51, 'STAR_CT19_A'		, 24,  1,  1, 16, 'Corridor Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(52, 'STAR_RE20_A'		, 24,  4,  1, 16, 'Binary Lab Stars',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(53, 'STAR_WZ21_A'		,  0, 16,  1, 16, 'Warzone Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(54, 'STAR_NS22_A'		,  0,  1, 16, 16, 'Young Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(55, 'STAR_SB24_A'		, 30,  4,  1, 16, 'Bastion Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(56, 'STAR_PD25_A'		,-30,  1,  1, 16, 'Prospector Giant',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(57, 'STAR_DS26_A'		,-30, -2,  1, 16, 'Remote Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(58, 'STAR_SN27_A'		,  0, 31,  1, 16, 'Proto-Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(59, 'STAR_LC29_A'		,  0,  1, 31, 16, 'Dying Star',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(60, 'BLACKHOLE_SGR'	,  0,  4,  1, 15, 'Black Hole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(61, 'BLACKHOLE_PS9'	,  9,  4,  1, 15, 'Black Hole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(62, 'BLACKHOLE_SC10'	, 10,  1, -2, 15, 'Scar Maw',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(63, 'BLACKHOLE_DV15'	, 15,  1,  4, 15, 'Dark Singularity',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(64, 'BLACKHOLE_OI23'	, 30,  1,  1, 15, 'Hidden Black Hole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(65, 'BLACKHOLE_QZ28'	,  3, 31,  1, 15, 'Quarantine Black Hole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Planets used by sectors
(66, 'PLANET_SOL_EARTH'				,  1,  0,  1, 2, 'Earth',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(67, 'PLANET_ALPHA_HOT_PLANET'		,  1,  2,  5, 3, 'Hot Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(68, 'PLANET_BIN_ROCKY_PLANET'		,  3,  0,  2, 2, 'Rocky Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(69, 'PLANET_BIN_DESERT_PLANET'		,  3,  2,  0, 2, 'Desert Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(70, 'PLANET_TG5_TRADING_WORLD'		, -6,  2,  2, 2, 'Trading World',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(71, 'PLANET_TG6_TRADE_PLANET'		, -4, -1,  2, 2, 'Trade Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(72, 'PLANET_TG7_FACTORY_PLANET'	, -4,  2,  3, 2, 'Factory Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(73, 'PLANET_TG7_OUTLAW_HAVEN'		, 10,  0, -2, 2, 'Outlaw Haven',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(74, 'PLANET_TG7_DERELICT_WORLD'	,  1, -9,  1, 2, 'Derelict World',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(75, 'PLANET_TG7_NEOTERRA_PRIME'	,  3, -9,  0, 2, 'NeoTerra Prime',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(76, 'PLANET_TG7_EXTRACTION_PLANET'	, 16,  0,  1, 2, 'Extraction Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(77, 'PLANET_TG7_BARREN_WORLD'		, 16,  0,  4, 2, 'Barren World',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(78, 'PLANET_TG7_CORE_PLANET'		,-15,  0,  0, 2, 'Core Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(79, 'PLANET_TG7_MAGMA_PLANET'		,-14, -3,  1, 2, 'Magma Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(80, 'PLANET_TG7_TRADE_COLONY'		, 24,  2,  2, 2, 'Trade Colony',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(81, 'PLANET_TG7_NEBULA_PLANET'		,  1,  1, 17, 2, 'Nebula Planet',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(82, 'PLANET_TG7_LOST_COLONY'		,  0,  0, 30, 2, 'Lost Colony',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Asteroids used by sectors
(83, 'ASTEROID_SOL_A'		,  0,  1,  2, 3, 'Asteroid A',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(84, 'ASTEROID_SOL_B'		,  0,  2,  0, 3, 'Asteroid B',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(85, 'ASTEROID_SOL_C'		,  0,  2,  1, 3, 'Asteroid C',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(86, 'ASTEROID_SOL_D'		,  0,  2,  2, 3, 'Asteroid D',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(87, 'ASTEROID_SOL_E'		,  1,  2,  1, 3, 'Asteroid E',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(88, 'ASTEROID_SOL_F'		,  1,  2,  2, 3, 'Asteroid F',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(89, 'ASTEROID_SOL_G'		,  2,  2,  0, 3, 'Asteroid G',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(90, 'ASTEROID_SOL_H'		,  2,  2,  1, 3, 'Asteroid H',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(91, 'ASTEROID_ALPHA_A'		,  0,  2,  5, 3, 'Asteroid Rich',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(92, 'ASTEROID_ALPHA_B'		,  1,  2,  4, 3, 'Asteroid Belt',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(93, 'ASTEROID_ALPHA_C'		,  2,  0,  3, 3, 'Asteroid field',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(94, 'ASTEROID_SGR__A'		,  1,  3,  2, 3, 'Shattered Asteroids',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(95, 'ASTEROID_SGR_B'		,  1,  5,  0, 3, 'Cosmic Debris',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(96, 'ASTEROID_BIN_A'		,  4,  2,  1, 3, 'Asteroid field',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(97, 'ASTEROID_BIN_B'		,  4,  0,  0, 3, 'Asteroid Belt',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(98, 'ASTEROID_BIN_C'		,  5,  1,  1, 3, 'Rich Asteroids',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(99, 'ASTEROID_VOID_A'		,  1,  1, -1, 3, 'Lone Asteroid',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(100, 'ASTEROID_TG5_A'		, -6,  0,  0, 3, 'Asteroid Belt',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(101, 'ASTEROID_TG5_B'		, -5,  2,  0, 3, 'Mining Rights',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(102, 'ASTEROID_TG6_A'		, -6, -3,  0, 3, 'Asteroid Mining',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(103, 'ASTEROID_TG6_B'		, -6, -1,  0, 3, 'Resource Field',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(104, 'ASTEROID_TG6_C'		, -5, -1,  0, 3, 'Asteroid Belt',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(105, 'ASTEROID_TG7_A'		, -5,  0,  3, 3, 'Resource Mining',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(106, 'ASTEROID_TG7_B'		, -4,  0,  5, 3, 'Asteroid Field',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(107, 'ASTEROID_OC8_A'		, 10,  2,  0, 3, 'Raided Debris',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(108, 'ASTEROID_OC8_B'		,  9,  0,  2, 3, 'Scavenged Asteroids',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(109, 'ASTEROID_PS9_A'		, 10,  3,  2, 3, 'Wreckage',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Test stations used by sector. Trading stations are used in trade node
(110, 'TEST_SOL_TRADE_STATION'			,  0,  0,  2, 12, 'Trading station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(111, 'TEST_SOL_MILITRAY_STATION'		,  2,  0,  2, 1, 'Hidden Military Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(112, 'TEST_SGR_RESEARCH_STATION'		,  2,  3,  1, 1, 'Research Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(113, 'TEST_BIN_TRADE_STATION'			,  5,  0,  1, 12, 'Trading station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(114, 'TEST_VOID_ABANDONED_STATION'		,  2,  2, -2, 1, 'Abandoned Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(115, 'TEST_TG5_SECURITY_STATION'		, -4,  1,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(116, 'TEST_TG5_TRADE_STATION'			, -5,  0,  1, 12, 'Trading station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(117, 'TEST_TG6_DEPOT_STATION'			, -6, -3,  2, 1, 'Depot Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(118, 'TEST_TG7_TRADE_HUB'				, -6,  2,  3, 12, 'Trade Hub',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(119, 'TEST_TG7_WARHOUSE_STATION'		, -5,  2,  5, 1, 'Warehouse Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(120, 'TEST_OC8_PIRATE_BASE'			,  9,  2,  0, 1, 'Pirate Base',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(121, 'TEST_PS9_HIDDEN_BASE'			, 10,  3,  0, 1, 'Hidden Base',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(122, 'TEST_SC10_RAIDER_DOCK'			, 10,  2, -1, 1, 'Raider Dock',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(123, 'TEST_SC11_HIDDEN_CACHE'			,  1, -7,  1, 1, 'Hidden Cache',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(124, 'TEST_N12_SALVAGE_DEPOT'			,  5, -9,  1, 1, 'Salvage depot',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(125, 'TEST_DV15_RESEARCH_STATION'		, 15,  0,  5, 1, 'Research Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(126, 'TEST_CT19_CENTRAL_TRADE_STATION'	, 24,  0,  0, 1, 'Central Trade Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(127, 'TEST_RE20_SCIENCE_STATION'		, 24,  3,  0, 1, 'Science Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(128, 'TEST_QI23_SMUGGLER_STATION'		, 31,  0,  0, 1, 'Smuggler Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- System homebases used by sectors and systems
(129, 'ENTITY_Security_Station'			, -4,  1,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(130, 'ENTITY_Depot_Station'			, -6, -3,  2, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(131, 'ENTITY_Warehouse_Station'		, -5,  2,  5, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(132, 'ENTITY_Pirate_Base'				,  9,  2,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(133, 'ENTITY_Hidden_Base'				, 10,  3,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(134, 'ENTITY_Raider_Dock'				, 10,  2, -1, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(135, 'ENTITY_Hidden_Cache'				, -7,  1,  3, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(136, 'ENTITY_Salvage_Depot'			,  5, -9,  1, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(137, 'ENTITY_Research_Station'			, 15,  0,  5, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(138, 'ENTITY_Central_Trade_Station'	, 24,  0,  0, 12, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(139, 'ENTITY_Smuggler_Station'			, 31,  0,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(140, 'ENTITY_Fortress_Station'			, 30,  3,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(141, 'ENTITY_Bastion'					,  1, 30,  2, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(142, 'ENTITY_Quarantine_Station'		,  4, 30,  0, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(143, 'ENTITY_Research_Center'			,  2,  0, 32, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(144, 'ENTITY_Relay_Station'			,  3,  0, 30, 1, 'Security Station',   1, '<system>', '<system>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Warpgates used by sectors and ftl
(145, 'WarpGate_Re13',  16,  1,  1, 1, 'Warp Gate Terminal',   1, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(146, 'WarpGate_Cw16', -14,  1,  1, 1, 'Warp Gate Prime',      0, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[1001.0,  400.0, 2500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(147, 'WarpGate_If18', -14,  1,  4, 1, 'Warp Gate CryoNet',    0, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[ 138.0, 1200.1,  800.4], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(148, 'WarpGate_Ct19',  25,  1,  1, 1, 'Warp Gate Exchange',   0, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[2500.0, 2500.0, 2500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(149, 'WarpGate_Re20',  25,  4,  2, 1, 'Warp Gate LabNet',     0, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[2500.0,  750.0, 2500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(150, 'WarpGate_Ol23',  32,  0,  2, 1, 'Warp Gate ShadowNet',  4, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[2500.0, 2500.0, 2500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(151, 'WarpGate_Qz28',   4, 31,  2, 1, 'Warp Gate Quarantine', 4, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[2200.0, 2500.0, 3450.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(152, 'WarpGate_Fr30',   4,  1, 31, 1, 'Warp Gate Terminus',   1, 'TestPlayerVIP1', 'TestPlayerSpy1', 0, true, ARRAY[2500.0, 2500.0, 2500.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),

-- Wormholes, used by sector and ftl
(153, 'WORMHOLE_ALPHA'	,  2,  2,  5, 15, 'Wormhole Gate',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(154, 'WORMHOLE_SGR'	,  2,  5,  2, 15, 'Emergency Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(155, 'WORMHOLE_VOID'	,  0,  2, -1, 15, 'Ancient Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(156, 'WORMHOLE_TG5'	, -4,  2,  2, 15, 'Trade Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(157, 'WORMHOLE_TG6'	, -6, -1,  2, 15, 'Trade Route',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(158, 'WORMHOLE_TG7'	, -6,  2,  5, 15, 'Main Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(159, 'WORMHOLE_PS9'	, 11,  5,  2, 15, 'Escape Portal',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(160, 'WORMHOLE_FD14'	, 15,  5,  2, 15, 'Drift Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(161, 'WORMHOLE_VZ17'	,-15, -1,  2, 15, 'Lava Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(162, 'WORMHOLE_WZ21'	,  0, 17,  2, 15, 'Tactical Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(163, 'WORMHOLE_NS22'	,  0,  2, 17, 15, 'Sanctuary Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(164, 'WORMHOLE_PD25'	,-30,  2,  2, 15, 'Prospector Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(165, 'WORMHOLE_SN27'	,  0, 32,  2, 15, 'Nursery Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true),
(166, 'WORMHOLE_LC29'	,  0,  2, 32, 15, 'Lost Wormhole',   1, '<sim>', '<sim>', 0, true, ARRAY[4000.0, 2000.0, 3000.0], ARRAY[0, 0, 0, 20, 30, 25], 0, -1, -1, false, true);

-- =============================================================================
-- INSERT COMPLETE - 166 ENTITIES
-- =============================================================================
COMMIT;