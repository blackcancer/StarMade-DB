-- =============================================================================
-- VISIBILITY TABLE TEST DATA
-- =============================================================================
-- Test data for the VISIBILITY table implementing the "fog of war" system.
-- This table tracks which sectors have been explored by specific players or factions,
-- creating a persistent record of spatial knowledge and reconnaissance activities.
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test visibility records for various observer scenarios
-- Each record represents a sector that has been observed by a specific player or faction

INSERT INTO VISIBILITY (ID, X, Y, Z, TIMESTAMP) VALUES
-- System observations (Player ID: 2147483647)
(2147483647, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483647, 0, 0, 1, 1672531200000),   -- Alpha Centauri
(2147483647, 0, 1, 0, 1672531200000),   -- Sagittarius A*
(2147483647, 1, 0, 0, 1672531200000),   -- Binary Prime
(2147483647, 0, 0, -1, 1672531200000),  -- The Void
(2147483647, -2, 0, 0, 1672531200000),   -- Trading Post Alpha
(2147483647, -2, -1, 0, 1672531200000),  -- Trading Post Beta
(2147483647, -2, 0, 1, 1672531200000),   -- Trading Hub Gamma

-- System observations (Player ID: 2147483646)
(2147483646, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483646, 3, 0, 0, 1672531200000),   -- Outcast Base Alpha
(2147483646, 3, 1, 0, 1672531200000),   -- Pirate Stronghold
(2147483646, 3, 0, -1, 1672531200000),  -- Raider Outpost
(2147483646, 0, -3, 0, 1672531200000),   -- Scavenger Nest
(2147483646, 1, -3, 0, 1672531200000),   -- Salvage Yard

-- System observations (Player ID: 2147483645)
(2147483645, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483645, 5, 0, 0, 1672531200000),   -- New Terra
(2147483645, 5, 1, 0, 1672531200000),   -- Industrial Complex
(2147483645, 5, 0, 1, 1672531200000),   -- Mining Station

-- System observations (Player ID: 2147483644)
(2147483644, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483644, -5, 0, 0, 1672531200000),   -- Resource Alpha
(2147483644, -5, -1, 0, 1672531200000),  -- Resource Beta
(2147483644, -5, 0, 1, 1672531200000),   -- Resource Gamma

-- System observations (ID: 2147483643)
(2147483643, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483643, 8, 0, 0, 1672531200000),   -- Frontier One
(2147483643, 8, 1, 0, 1672531200000),   -- Frontier Two

-- System observations (Player ID: 2147483582)
(2147483582, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2147483582, 0, 5, 0, 1672531200000),   -- Strategic Point Alpha
(2147483582, 0, 0, 5, 1672531200000),   -- Strategic Point Beta

-- System observations (Faction ID: 1)
(1, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(1, 0, 5, 0, 1672531200000),   -- Strategic Point Alpha
(1, 0, 0, 5, 1672531200000),   -- Strategic Point Beta
(1, 10, 0, 0, 1672531200000),   -- Contested Alpha
(1, 10, 1, 0, 1672531200000),   -- Contested Beta

-- System observations (Faction ID: 2)
(2, 0, 0, 0, 1672531200000),   -- Sol Prime Core
(2, -10, 0, 0, 1672531200000),   -- Deep Space Alpha
(2, -10, -1, 0, 1672531200000),  -- Deep Space Beta
(2, 8, 0, 0, 1672531200000),   -- Frontier One
(2, 8, 1, 0, 1672531200000);   -- Frontier Two
-- =============================================================================
-- DATA EXPLANATION
-- =============================================================================
-- ID Values:
-- - 2147483647- : Individual player observers
-- - 0+ : Faction observers
-- - -10000000: Trading Guild NPC faction
-- - -9999999: Outcasts NPC faction
-- - -9999998: Scavengers NPC faction
--
-- TIMESTAMP Values:
-- - Unix timestamp in milliseconds (1672531200000 = 2023-01-01 00:00:00 UTC)
-- - Various relative times for realistic exploration patterns
-- - NULL: Sector known but never directly observed (fog of war)
--
-- Coordinate Distribution:
-- - All coordinates now correspond to existing system in 01-systems.sql
-- =============================================================================

-- =============================================================================
-- INSERT COMPLETE - 38 VISIBILITY
-- =============================================================================
