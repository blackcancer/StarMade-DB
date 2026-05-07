-- =============================================================================
-- EFFECTS TABLE TEST DATA
-- =============================================================================
-- Test data for the EFFECTS table representing entity status effects
-- Contains diverse effect types with varied parameters and scopes
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test effects with varied types and configurations
INSERT INTO EFFECTS (ID, ENTITY_ID, TYPE, EFFECT_UID) VALUES
-- Ship effects (TYPE = 1 - STRUCTURE) - Ships have TYPE = 0 in entities
(0,    1, 1, 'SPEED_BOOST'),              -- TestPlayer Explorer (TYPE=0)
(1,   2, 1, 'SHIELD_RECHARGE'),          -- TestPlayer Frigate (TYPE=0)
(2,   3, 1, 'ARMOR_EFFECTIVENESS'),      -- TestPlayer Fighter (TYPE=0)
(3,   9, 1, 'THRUST_EFFECTIVENESS'),     -- Faction Carrier Alpha (TYPE=0)
(4,  10, 1, 'JUMP_DRIVE_CHARGE'),        -- Fighter Alpha (TYPE=0)
(5,  11, 1, 'SHIELD_CAPACITY'),          -- Fighter Beta (TYPE=0)
(6,  12, 1, 'STEALTH'),                  -- Fighter Gamma (TYPE=0)
(7,  13, 1, 'DAMAGE_MULTIPLIER'),        -- Independent Explorer (TYPE=0)
(8,  14, 1, 'POWER_GENERATION'),         -- Independent Trader (TYPE=0)
(9,  15, 1, 'MINING_EFFECTIVENESS'),     -- Independent Miner (TYPE=0)
(10, 16, 1, 'SHIELD_RECHARGE'),          -- Faction 2 Cruiser (TYPE=0)
(11, 17, 1, 'DAMAGE_MULTIPLIER'),        -- Faction 2 Destroyer (TYPE=0)
(12,  4, 1, 'POWER_CAPACITY'),           -- TG Freighter Alpha (TYPE=0)
(13,  5, 1, 'THRUST_EFFECTIVENESS'),     -- TG Freighter Beta (TYPE=0)
(14,  6, 1, 'STEALTH'),                  -- Outcast Raider Alpha (TYPE=0)
(15,  7, 1, 'JAMMING'),                  -- Outcast Raider Beta (TYPE=0)
(16,  8, 1, 'MINING_EFFECTIVENESS'),     -- Scavenger Collector (TYPE=0)
(17, 22, 1, 'SCANNER_RANGE'),            -- Research Probe Beta (TYPE=0)
(18, 23, 1, 'DAMAGE_MULTIPLIER'),        -- Contested Ship Alpha (TYPE=0)
(19, 24, 1, 'POWER_GENERATION'),         -- Core Fleet Flagship (TYPE=0)
(20,  1, 1, 'THRUST_EFFECTIVENESS'),     -- Merchant Ship Alpha (TYPE=0)
(21,  1, 1, 'JUMP_DRIVE_CHARGE'),        -- Merchant Ship Beta (TYPE=0)
(22, 22, 1, 'SCANNER_RANGE'),            -- Research Probe Alpha (TYPE=0)
(23, 29, 1, 'SPEED_BOOST'),              -- Test Vehicle Alpha (TYPE=17)

-- Station effects (TYPE = 1 - STRUCTURE) - Stations have TYPE = 1 in entities
(24,  2, 1, 'SHIELD_CAPACITY'),          -- Sol Prime Central Station (TYPE=1)
(25, 10, 1, 'POWER_GENERATION'),         -- Alpha Centauri Outpost (TYPE=1)
(26, 21, 1, 'JAMMING'),                  -- Outcast Base Alpha (TYPE=1)
(27, 22, 1, 'SHIELD_RECHARGE'),          -- Pirate Stronghold (TYPE=1)
(28, 23, 1, 'ARMOR_EFFECTIVENESS'),      -- Raider Outpost (TYPE=1)
(29, 26, 1, 'SCANNER_RANGE'),            -- Scavenger Nest (TYPE=1)
(30, 27, 1, 'MINING_EFFECTIVENESS'),     -- Salvage Yard (TYPE=1)
(31, 29, 1, 'SHIELD_RECHARGE'),          -- New Terra Station (TYPE=1)
(32, 30, 1, 'POWER_GENERATION'),         -- Industrial Complex (TYPE=1)
(33, 31, 1, 'MINING_EFFECTIVENESS'),     -- Mining Station (TYPE=1)
(34, 39, 1, 'SHIELD_CAPACITY'),          -- Faction 2 Homebase (TYPE=1)
(35, 50, 1, 'SCANNER_RANGE'),            -- Research Station Alpha (TYPE=1)
(36, 51, 1, 'POWER_GENERATION'),         -- Research Station Beta (TYPE=1)
(37, 53, 1, 'SHIELD_CAPACITY'),          -- Strategic Station Alpha (TYPE=1)
(38, 54, 1, 'ION_RESISTANCE'),           -- Strategic Outpost Alpha (TYPE=1)
(39, 55, 1, 'ARMOR_EFFECTIVENESS'),      -- Contested Base Alpha (TYPE=1)
(40, 57, 1, 'DAMAGE_MULTIPLIER'),        -- Core Station Alpha (TYPE=1)
(41, 58, 1, 'POWER_CAPACITY'),           -- Core Station Beta (TYPE=1)
(42, 72, 1, 'SCANNER_RANGE'),            -- Economic Hub Alpha (TYPE=1)
(43, 73, 1, 'POWER_GENERATION'),         -- Economic Hub Beta (TYPE=1)
(44, 74, 1, 'SHIELD_RECHARGE'),          -- Frontier Outpost Alpha (TYPE=1)
(45, 75, 1, 'ARMOR_EFFECTIVENESS'),      -- Frontier Outpost Beta (TYPE=1)
(46, 76, 1, 'POWER_GENERATION'),         -- Debug Shop Alpha (TYPE=1)
(47, 77, 1, 'DAMAGE_MULTIPLIER'),        -- Debug Shop Beta (TYPE=1)

-- Special structure effects (TYPE = 1 - STRUCTURE) - Special entity types
(48, 28, 1, 'STEALTH'),                  -- Ship Core Alpha (TYPE=5)
(49, 34, 1, 'POWER_GENERATION'),         -- Test Death Star (TYPE=18)

-- Sector-wide effects (TYPE = 2 - SECTOR) - Environmental effects
(50, 13, 2, 'POWER_GENERATION'),         -- Sol Prime Sun (TYPE=16) - star radiation
(51, 10, 2, 'SHIELD_RECHARGE'),          -- Sol Prime Planet Alpha (TYPE=2) - planetary field
(52, 31, 2, 'ION_RESISTANCE'),           -- Alpha Centauri Giant star (TYPE=15) - stellar wind
(54, 44, 2, 'MINING_EFFECTIVENESS'),     -- Alpha Centauri Prime (TYPE=2) - rich resources
(55, 58, 2, 'JAMMING'),                  -- Sagittarius A* (TYPE=15) - black hole interference
(56, 84, 2, 'POWER_CAPACITY'),           -- Binary Prime A (TYPE=16) - energy field
(57, 86, 2, 'CLOAKING'),                 -- Binary Prime B (TYPE=16) - gravitational lensing
(58, 83, 2, 'SHIELD_RECHARGE'),          -- Binary Prime Planet (TYPE=2) - magnetic field
(59, 90, 2, 'MINING_EFFECTIVENESS'),     -- Asteroid Alpha (TYPE=3) - rich ore
(60, 97, 2, 'SCANNER_RANGE'),            -- Asteroid Beta (TYPE=3) - crystal resonance
(61, 103, 2, 'MINING_EFFECTIVENESS'),     -- Rich Asteroid (TYPE=3) - valuable resources
(62, 103, 2, 'POWER_GENERATION'),         -- Resource Asteroid (TYPE=3) - energy crystals
(63, 39, 2, 'JAMMING'),                  -- Space Creature Alpha (TYPE=7) - bio-interference

-- System-wide effects (TYPE = 3 - SYSTEM) - Large-scale effects
(64,  0, 3, 'POWER_GENERATION'),         -- Sol Prime Sun (TYPE=16) - system energy boost
(65,  1, 3, 'SCANNER_RANGE'),            -- Alpha Centauri A (TYPE=16) - system-wide sensors
(66, 2, 3, 'JAMMING'),                  -- Sagittarius A* (TYPE=15) - system interference
(67, 3, 3, 'POWER_CAPACITY'),           -- Binary Prime A (TYPE=16) - system power grid
(68, 3, 3, 'STEALTH'),                  -- Binary Prime B (TYPE=16) - system stealth field
(69, 34, 3, 'DAMAGE_MULTIPLIER'),        -- Test Death Star (TYPE=18) - system threat

-- Other/miscellaneous effects (TYPE = 0 - OTHER) - General effects
(70, 18, 0, 'SPEED_BOOST'),              -- Test Astronaut Alpha (TYPE=10) - personal effect
(71, 19, 0, 'SHIELD_CAPACITY'),          -- Test Astronaut Beta (TYPE=10) - suit shield
(72, 20, 0, 'SCANNER_RANGE'),            -- Trading Guild NPC (TYPE=11) - NPC enhancement
(73, 21, 0, 'STEALTH'),                  -- Outcast NPC (TYPE=11) - NPC stealth
(74,  3, 0, 'POWER_GENERATION'),         -- Sol Prime Trade Hub (TYPE=12) - trade boost
(75, 110, 0, 'SCANNER_RANGE'),            -- Trading Post Alpha (TYPE=12) - trade network
(76, 113, 0, 'MINING_EFFECTIVENESS'),     -- Trading Post Beta (TYPE=12) - resource flow
(77, 116, 0, 'POWER_CAPACITY');

-- =============================================================================
-- INSERT COMPLETE - 77 EFFECTS
-- =============================================================================
