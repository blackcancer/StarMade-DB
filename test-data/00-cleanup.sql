-- =============================================================================
-- TEST DATA CLEANUP SCRIPT
-- =============================================================================
-- This script removes all test data from the StarMade database
-- Run this before inserting new test data to ensure clean state
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Disable foreign key checks temporarily to avoid constraint issues
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- CLEANUP ORDER (respecting dependencies)
-- =============================================================================

-- Clear effects (depends on entities)
DELETE FROM EFFECTS WHERE ENTITY_ID BETWEEN 1000000 AND 1999999;

-- Clear trade history (depends on trade nodes)
DELETE FROM TRADE_HISTORY WHERE TRADE_NODE_ID BETWEEN 1000000 AND 1999999;

-- Clear player messages (depends on players)
DELETE FROM PLAYER_MESSAGES WHERE SENDER LIKE 'TestPlayer%' OR RECEIVER LIKE 'TestPlayer%' OR SENDER LIKE 'TestUser%' OR RECEIVER LIKE 'TestUser%' OR SENDER = 'SYSTEM';

-- Clear visibility records (depends on systems and players)
DELETE FROM VISIBILITY WHERE ID BETWEEN 1000000 AND 1999999 OR ID BETWEEN -1000006 AND -1000001;

-- Clear NPC stats (depends on systems)
DELETE FROM NPC_STATS WHERE ID IN (-10000000, -9999999, -9999998);

-- Clear mines (depends on players and sectors)
DELETE FROM MINES WHERE OWNER BETWEEN 1000000 AND 1999999;

-- Clear trade nodes (depends on players and sectors)
DELETE FROM TRADE_NODES WHERE PLAYER LIKE 'TestPlayer%' OR PLAYER LIKE 'TestUser%' OR PLAYER = '<sim>';

-- Clear FTL connections (depends on entities)
DELETE FROM FTL WHERE FROM_UID LIKE 'TEST_%' OR TO_UID LIKE 'TEST_%';

-- Clear fleet members (depends on fleets and entities)
DELETE FROM FLEET_MEMBERS WHERE FLEET_ID BETWEEN 1000000 AND 1999999;

-- Clear fleets (depends on entities and players)
DELETE FROM FLEETS WHERE ID BETWEEN 1000000 AND 1999999;

-- Clear sectors items (depends on sectors)
DELETE FROM SECTORS_ITEMS WHERE ID BETWEEN 1000000 AND 1999999;

-- Clear entities (depends on sectors, self-references)
DELETE FROM ENTITIES WHERE ID BETWEEN 1000000 AND 1999999;

-- Clear sectors (depends on systems)
DELETE FROM SECTORS WHERE X BETWEEN -10 AND 10 AND Y BETWEEN -10 AND 10 AND Z BETWEEN -10 AND 10;

-- Clear players (independent table)
DELETE FROM PLAYERS WHERE ID BETWEEN 1000000 AND 1999999;

-- Clear systems (independent table)
DELETE FROM SYSTEMS WHERE ID BETWEEN 1000000 AND 1999999;

-- Clear ID generation table entries for test data
DELETE FROM ID_GEN_TABLE WHERE ID_VALUE BETWEEN 1000000 AND 1999999;

-- =============================================================================
-- RESET AUTO_INCREMENT VALUES (if using auto-increment)
-- =============================================================================

-- Note: HSQLDB uses sequences or identity columns
-- Reset sequences if they exist
-- ALTER SEQUENCE SEQ_SYSTEMS_ID RESTART WITH 1;
-- ALTER SEQUENCE SEQ_PLAYERS_ID RESTART WITH 1;
-- ALTER SEQUENCE SEQ_ENTITIES_ID RESTART WITH 1;
-- ALTER SEQUENCE SEQ_FLEETS_ID RESTART WITH 1;

-- =============================================================================
-- VERIFY CLEANUP
-- =============================================================================

-- Check that test data has been removed
SELECT 'Systems' as table_name, COUNT(*) as remaining_records 
FROM SYSTEMS 
WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Sectors' as table_name, COUNT(*) as remaining_records 
FROM SECTORS 
WHERE X BETWEEN -10 AND 10 AND Y BETWEEN -10 AND 10 AND Z BETWEEN -10 AND 10

UNION ALL

SELECT 'Entities' as table_name, COUNT(*) as remaining_records 
FROM ENTITIES 
WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Players' as table_name, COUNT(*) as remaining_records 
FROM PLAYERS 
WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Fleets' as table_name, COUNT(*) as remaining_records 
FROM FLEETS 
WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'FleetMembers' as table_name, COUNT(*) as remaining_records 
FROM FLEET_MEMBERS 
WHERE FLEET_ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'TradeNodes' as table_name, COUNT(*) as remaining_records 
FROM TRADE_NODES 
WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Mines' as table_name, COUNT(*) as remaining_records 
FROM MINES 
WHERE OWNER BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'PlayerMessages' as table_name, COUNT(*) as remaining_records 
FROM PLAYER_MESSAGES 
WHERE SENDER LIKE 'TestPlayer%' OR RECEIVER LIKE 'TestPlayer%' OR SENDER LIKE 'TestUser%' OR RECEIVER LIKE 'TestUser%'

UNION ALL

SELECT 'Effects' as table_name, COUNT(*) as remaining_records 
FROM EFFECTS 
WHERE ENTITY_ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Visibility' as table_name, COUNT(*) as remaining_records 
FROM VISIBILITY 
WHERE ID BETWEEN 1000000 AND 1999999 OR ID BETWEEN -1000006 AND -1000001

UNION ALL

SELECT 'NPCStats' as table_name, COUNT(*) as remaining_records 
FROM NPC_STATS 
WHERE ID IN (-10000000, -9999999, -9999998)

UNION ALL

SELECT 'SectorsItems' as table_name, COUNT(*) as remaining_records 
FROM SECTORS_ITEMS 
WHERE ID BETWEEN 1000000 AND 1999999;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- CLEANUP SUMMARY
-- =============================================================================

-- Display cleanup summary
SELECT 
    'CLEANUP_SUMMARY' as operation,
    CURRENT_TIMESTAMP as completed_at,
    'Test data cleanup completed successfully' as status,
    'All test records with IDs 1000000-1999999 removed' as details;

-- =============================================================================
-- DATA RANGES CLEANED
-- =============================================================================
-- SYSTEMS: ID 1000000-1000030 (31 systems)
-- SECTORS: Coordinates (-10,-10,-10) to (10,10,10) (100 sectors)
-- ENTITIES: ID 1000000-1000077 (78 entities)
-- PLAYERS: ID 1000000-1000068 (69 players)
-- FLEETS: ID 1000000-1000099 (100 fleets)
-- FLEET_MEMBERS: FLEET_ID 1000000-1000099 (200 members)
-- TRADE_NODES: ID 1000000-1000099 (50 nodes)
-- MINES: OWNER 1000000-1000068 (50 mines)
-- EFFECTS: ENTITY_ID 1000000-1000077 (103 effects)
-- PLAYER_MESSAGES: TestPlayer*/TestUser* names (50 messages)
-- VISIBILITY: ID 1000000-1000006 and -1000001 to -1000006 (65 records)
-- NPC_STATS: ID -10000000, -9999999, -9999998 (43 records)
-- SECTORS_ITEMS: ID 1000000-1000099 (if any)
-- TRADE_HISTORY: TRADE_NODE_ID 1000000-1000099 (if any)
-- FTL: FROM_UID/TO_UID like 'TEST_%' (if any)
-- =============================================================================
