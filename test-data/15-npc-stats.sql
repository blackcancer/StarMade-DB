-- =============================================================================
-- NPC_STATS TABLE TEST DATA
-- =============================================================================
-- Test data for the NPC_STATS table aggregating NPC activity by star system coordinates.
-- This table provides critical insights into AI-driven fleet and entity spawning patterns,
-- enabling server administrators and players to understand NPC population dynamics.
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test NPC statistics records for various system coordinates
-- Each record represents NPC spawn activity for a specific faction in a specific system

INSERT INTO NPC_STATS (ID, SYS_X, SYS_Y, SYS_Z, FLEET_SPAWNS, ENTITY_SPAWNS) VALUES
-- Trading Guild activity (ID: -10000000) - In Trading Guild territory
(-10000000, -2, 0, 0, 8, 15),  -- Trading Post Alpha system
(-10000000, -2, -1, 0, 12, 20), -- Trading Post Beta system
(-10000000, -2, 0, 1, 5, 10),   -- Trading Hub Gamma system

-- Trading Guild activity in neutral/core systems
(-10000000, 0, 0, 0, 3, 5),     -- Sol Prime system
(-10000000, 0, 0, 1, 2, 4),     -- Alpha Centauri system
(-10000000, 1, 0, 0, 1, 3),     -- Binary Prime system
(-10000000, 0, 1, 0, 4, 6),     -- Sagittarius A* system

-- Outcasts activity (ID: -9999999) - In Outcast territory
(-9999999, 3, 0, 0, 25, 30),    -- Outcast Base Alpha system
(-9999999, 3, 1, 0, 18, 22),    -- Pirate Stronghold system
(-9999999, 3, 0, -1, 15, 18),   -- Raider Outpost system

-- Outcasts activity in contested areas
(-9999999, 10, 0, 0, 35, 40),   -- Contested Alpha system
(-9999999, 10, 1, 0, 30, 35),   -- Contested Beta system

-- Outcasts reconnaissance in strategic locations
(-9999999, 0, 5, 0, 12, 15),    -- Strategic Point Alpha system
(-9999999, 0, 0, 5, 28, 32),    -- Strategic Point Beta system

-- Scavengers activity (ID: -9999998) - In Scavenger territory
(-9999998, 0, -3, 0, 10, 8),    -- Scavenger Nest system
(-9999998, 1, -3, 0, 12, 10),   -- Salvage Yard system

-- Scavengers activity in resource-rich areas
(-9999998, 5, 0, 1, 14, 18),    -- Mining Station system
(-9999998, 5, 1, 0, 16, 20),    -- Industrial Complex system
(-9999998, 5, 0, 0, 8, 12),     -- New Terra system

-- Scavengers in resource exploration zones
(-9999998, -5, 0, 0, 6, 8),     -- Resource Alpha system
(-9999998, -5, -1, 0, 10, 12),  -- Resource Beta system
(-9999998, -5, 0, 1, 8, 10),    -- Resource Gamma system

-- Mixed NPC activity in frontier systems
(-10000000, 8, 0, 0, 1, 2),     -- Frontier One system (Trading Guild patrols)
(-9999998, 8, 1, 0, 2, 3),      -- Frontier Two system (Scavenger exploration)

-- Research and development systems activity
(-10000000, 0, 0, 10, 2, 8),    -- Research Station Alpha system
(-10000000, 1, 0, 10, 3, 7),    -- Research Station Beta system

-- Deep space exploration activity
(-10000000, -10, 0, 0, 1, 1),   -- Deep Space Alpha system
(-10000000, -10, -1, 0, 1, 2),  -- Deep Space Beta system

-- Core faction territory activity
(-10000000, 0, 10, 0, 18, 22),  -- Core Alpha system
(-10000000, 1, 10, 0, 15, 20),  -- Core Beta system

-- Void system activity (minimal but present)
(-9999998, 0, 0, -1, 2, 1),     -- The Void system (Scavengers only)

-- Low-activity systems with occasional NPC presence
(-9999998, 1, 0, 0, 3, 2),      -- Binary Prime - occasional scavenger visits

-- Strategic systems with mixed faction activity
(-10000000, 0, 5, 0, 8, 12),    -- Strategic Point Alpha - Trading Guild defense

-- Some systems with no current activity (but tracked for monitoring)
(-10000000, 0, 0, -1, 0, 0),    -- The Void - Trading Guild avoidance
(-9999999, -10, 0, 0, 0, 1),    -- Deep Space Alpha - minimal outcast presence
(-9999998, -10, -1, 0, 0, 0);   -- Deep Space Beta - no scavenger activity

-- =============================================================================
-- DATA EXPLANATION
-- =============================================================================
-- ID Values:
-- - -10000000: Trading Guild NPC faction (generally peaceful, trade-focused)
-- - -9999999: Outcasts NPC faction (hostile, aggressive, raids)
-- - -9999998: Scavengers NPC faction (hostile, opportunistic, resource-focused)
--
-- Activity Patterns:
-- - Trading Guild: Moderate activity in trade routes and neutral systems
-- - Outcasts: High activity in their territory and contested areas
-- - Scavengers: Focused activity in resource-rich and salvage areas
-- - Some systems show historical data with multiple entries per faction
-- - Zero-activity entries indicate monitored but currently inactive systems
--
-- Spawn Counts:
-- - FLEET_SPAWNS: Number of NPC fleet spawns in the system
-- - ENTITY_SPAWNS: Number of individual NPC entity spawns
-- - Values represent accumulated spawn activity over time
-- - Higher values in contested and faction-controlled territories
-- - Lower values in frontier and deep space systems
-- - Zero values indicate systems under observation but no current activity
-- =============================================================================

-- =============================================================================
-- INSERT COMPLETE - 36 NPC STATS
-- =============================================================================
