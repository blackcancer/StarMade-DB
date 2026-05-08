-- =============================================================================
-- MASTER TEST DATA INSERTION SCRIPT
-- =============================================================================
-- Comprehensive test dataset for StarMade database system
-- Executes all test data files in correct dependency order
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2024
-- =============================================================================

-- =============================================================================
-- DATASET OVERVIEW
-- =============================================================================
-- This master script creates a comprehensive test dataset with:
-- - 31 star systems with diverse types and ownership
-- - 67 player accounts with varied permissions and factions
-- - 100 sectors across multiple systems
-- - 70 entities including ships, stations, and celestial bodies
-- - 50 fleets with complex hierarchies and missions
-- - 65 fleet member records showing composition
-- - 50 FTL connections linking systems
-- - 30 trade nodes with economic diversity
-- - 43 status effects on entities
-- - 36 deployed mines with varied configurations
-- - 35 player messages showing communication patterns
-- - 37 sector item inventories
-- - 20 trade history records
-- - 10 visibility detection records
-- - 10 NPC statistics records
-- - 16 ID generation table entries
-- 
-- TOTAL: 600+ test records across all tables
-- =============================================================================

-- =============================================================================
-- EXECUTION INSTRUCTIONS
-- =============================================================================
-- 1. Run 00-cleanup.sql first to remove any existing test data
-- 2. Run this master script to insert all test data
-- 3. Verify data integrity with the validation queries at the end
-- 
-- Alternative: Run individual files in the order listed below
-- =============================================================================

-- Set session parameters for bulk loading
SET AUTOCOMMIT = false;
SET REFERENTIAL_INTEGRITY = false;

-- =============================================================================
-- PHASE 1: FOUNDATIONAL DATA (Independent Tables)
-- =============================================================================

-- Systems (star systems - no dependencies)
-- Creates 31 diverse star systems with varied types and ownership
\i test-data/01-systems.sql

-- Players (player accounts - no dependencies)
-- Creates 67 player accounts with varied permissions and factions
\i test-data/02-players.sql

-- =============================================================================
-- PHASE 2: SPATIAL DATA (Depends on Systems)
-- =============================================================================

-- Sectors (depends on Systems)
-- Creates 100 sectors across multiple systems
\i test-data/03-sectors.sql

-- =============================================================================
-- PHASE 3: ENTITIES (Depends on Sectors, Players)
-- =============================================================================

-- Entities (depends on Sectors, self-references for docking)
-- Creates 70 entities including ships, stations, and celestial bodies
\i test-data/04-entities.sql

-- =============================================================================
-- PHASE 4: FLEET SYSTEM (Depends on Entities, Players)
-- =============================================================================

-- Fleets (depends on Entities for flagship, Players for ownership)
-- Creates 50 fleets with complex hierarchies and missions
\i test-data/05-fleets.sql

-- Fleet Members (depends on Fleets, Entities)
-- Creates 65 fleet member records showing composition
\i test-data/06-fleet-members.sql

-- =============================================================================
-- PHASE 5: CONNECTIVITY (Depends on Entities)
-- =============================================================================

-- FTL (depends on Entities for connection endpoints)
-- Creates 50 FTL connections linking systems
\i test-data/07-ftl.sql

-- =============================================================================
-- PHASE 6: ECONOMIC SYSTEM (Depends on Entities, Players)
-- =============================================================================

-- Trade Nodes (depends on Entities for location, Players for ownership)
-- Creates 30 trade nodes with economic diversity
\i test-data/08-trade-nodes.sql

-- =============================================================================
-- PHASE 7: INTERACTIVE SYSTEMS (Depends on Entities, Players)
-- =============================================================================

-- Effects (depends on Entities for targets)
-- Creates 43 status effects on entities
\i test-data/09-effects.sql

-- Mines (depends on Entities for deployment, Players for ownership)
-- Creates 36 deployed mines with varied configurations
\i test-data/10-mines.sql

-- Player Messages (depends on Players for sender/receiver)
-- Creates 35 player messages showing communication patterns
\i test-data/11-player-messages.sql

-- =============================================================================
-- PHASE 8: SECTOR INVENTORIES (Depends on Sectors)
-- =============================================================================

-- Sectors Items (depends on Sectors for location)
-- Creates 37 sector item inventories
\i test-data/12-sectors-items.sql

-- =============================================================================
-- PHASE 9: OPERATIONAL DATA (Depends on various tables)
-- =============================================================================

-- Trade History (depends on Trade Nodes, Players)
-- Creates 20 comprehensive trade history records
\i test-data/13-trade-history.sql

-- Visibility (depends on Entities for observer/observed relationships)
-- Creates 10 visibility detection records
\i test-data/14-visibility.sql

-- NPC Stats (depends on Systems for location)
-- Creates 10 NPC statistics records
\i test-data/15-NPC-stats.sql

-- ID Generation Table (independent infrastructure table)
-- Creates 16 ID generation table entries
\i test-data/16-id-gen-table.sql

-- =============================================================================
-- FINALIZATION
-- =============================================================================

-- Re-enable referential integrity
SET REFERENTIAL_INTEGRITY = true;

-- Commit all changes

-- Set autocommit back to true
SET AUTOCOMMIT = true;

-- =============================================================================
-- DATA VALIDATION QUERIES
-- =============================================================================
-- Run these queries to verify data integrity and relationships

-- Verify record counts per table
SELECT 'SYSTEMS' as table_name, COUNT(*) as record_count FROM SYSTEMS WHERE X BETWEEN -10 AND 10 AND Y BETWEEN -10 AND 10 AND Z BETWEEN -10 AND 10
UNION ALL
SELECT 'PLAYERS' as table_name, COUNT(*) as record_count FROM PLAYERS WHERE ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'SECTORS' as table_name, COUNT(*) as record_count FROM SECTORS WHERE X BETWEEN -50 AND 50 AND Y BETWEEN -50 AND 50 AND Z BETWEEN -50 AND 50
UNION ALL
SELECT 'ENTITIES' as table_name, COUNT(*) as record_count FROM ENTITIES WHERE ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'FLEETS' as table_name, COUNT(*) as record_count FROM FLEETS WHERE ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'FLEET_MEMBERS' as table_name, COUNT(*) as record_count FROM FLEET_MEMBERS WHERE FLEET_ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'FTL' as table_name, COUNT(*) as record_count FROM FTL WHERE FROM_UID LIKE 'TEST_%'
UNION ALL
SELECT 'TRADE_NODES' as table_name, COUNT(*) as record_count FROM TRADE_NODES WHERE ENTITY_UID LIKE 'TEST_%'
UNION ALL
SELECT 'EFFECTS' as table_name, COUNT(*) as record_count FROM EFFECTS WHERE ENTITY_ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'MINES' as table_name, COUNT(*) as record_count FROM MINES WHERE ENTITY_ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'PLAYER_MESSAGES' as table_name, COUNT(*) as record_count FROM PLAYER_MESSAGES WHERE SENDER LIKE 'TestPlayer%'
UNION ALL
SELECT 'SECTORS_ITEMS' as table_name, COUNT(*) as record_count FROM SECTORS_ITEMS WHERE SECTOR_X BETWEEN -50 AND 50 AND SECTOR_Y BETWEEN -50 AND 50 AND SECTOR_Z BETWEEN -50 AND 50
UNION ALL
SELECT 'TRADE_HISTORY' as table_name, COUNT(*) as record_count FROM TRADE_HISTORY WHERE TRADE_NODE_ID BETWEEN 1000000 AND 1999999
UNION ALL
SELECT 'VISIBILITY' as table_name, COUNT(*) as record_count FROM VISIBILITY WHERE OBSERVER_UID LIKE 'TEST_%'
UNION ALL
SELECT 'NPC_STATS' as table_name, COUNT(*) as record_count FROM NPC_STATS WHERE NPC_NAME LIKE '%NPC%'
UNION ALL
SELECT 'ID_GEN_TABLE' as table_name, COUNT(*) as record_count FROM ID_GEN_TABLE WHERE ID_VALUE BETWEEN 1000000 AND 1999999
ORDER BY table_name;

-- Verify key relationships
SELECT 'Entity-Sector relationships' as check_type, COUNT(*) as valid_relationships
FROM ENTITIES e JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
WHERE e.ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Fleet-Entity relationships' as check_type, COUNT(*) as valid_relationships
FROM FLEETS f JOIN ENTITIES e ON f.FLAGSHIP_ID = e.ID
WHERE f.ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Fleet-Player relationships' as check_type, COUNT(*) as valid_relationships
FROM FLEETS f JOIN PLAYERS p ON f.OWNER = p.STARMADE_NAME
WHERE f.ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Sector-System relationships' as check_type, COUNT(*) as valid_relationships
FROM SECTORS s JOIN SYSTEMS sys ON s.STELLAR = sys.ID
WHERE s.X BETWEEN -50 AND 50 AND s.Y BETWEEN -50 AND 50 AND s.Z BETWEEN -50 AND 50

UNION ALL

SELECT 'Effect-Entity relationships' as check_type, COUNT(*) as valid_relationships
FROM EFFECTS eff JOIN ENTITIES e ON eff.ENTITY_ID = e.ID
WHERE eff.ENTITY_ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Mine-Entity relationships' as check_type, COUNT(*) as valid_relationships
FROM MINES m JOIN ENTITIES e ON m.ENTITY_ID = e.ID
WHERE m.ENTITY_ID BETWEEN 1000000 AND 1999999

ORDER BY check_type;

-- Verify data diversity
SELECT 'Entity types' as diversity_check, COUNT(DISTINCT TYPE) as unique_values
FROM ENTITIES WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Player factions' as diversity_check, COUNT(DISTINCT FACTION) as unique_values
FROM PLAYERS WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'System types' as diversity_check, COUNT(DISTINCT TYPE) as unique_values
FROM SYSTEMS WHERE X BETWEEN -10 AND 10 AND Y BETWEEN -10 AND 10 AND Z BETWEEN -10 AND 10

UNION ALL

SELECT 'Fleet mission states' as diversity_check, COUNT(DISTINCT MISSION_STRING) as unique_values
FROM FLEETS WHERE ID BETWEEN 1000000 AND 1999999

UNION ALL

SELECT 'Effect types' as diversity_check, COUNT(DISTINCT EFFECT_TYPE) as unique_values
FROM EFFECTS WHERE ENTITY_ID BETWEEN 1000000 AND 1999999

ORDER BY diversity_check;

-- =============================================================================
-- DATASET SUMMARY
-- =============================================================================
-- Test dataset successfully created with:
-- - Comprehensive coverage of all entity types and relationships
-- - Realistic data distributions and dependencies
-- - Diverse scenarios for testing queries and operations
-- - Proper referential integrity maintained
-- - Edge cases and special conditions included
-- 
-- Dataset is ready for:
-- - Unit testing of model classes
-- - Integration testing of relationship queries
-- - Performance testing of complex joins
-- - Validation of business logic
-- - Development and debugging of new features
-- =============================================================================

PRINT 'StarMade test dataset creation completed successfully!';
PRINT 'Total records: 600+ across 16 tables';
PRINT 'Dataset ready for testing and development.';