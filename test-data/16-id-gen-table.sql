-- =============================================================================
-- ID_GEN_TABLE TEST DATA
-- =============================================================================
-- Test data for the ID_GEN_TABLE table that manages sequence generation for primary keys
-- across the entire database system. This table serves as the central authority for
-- generating unique identifiers, ensuring data integrity and preventing primary key collisions.
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test ID generator records for various entity types
-- Each record represents a sequence generator with its current next available ID value

INSERT INTO ID_GEN_TABLE (ID, ID_GEN) VALUES
-- Core entity ID generators
('ENTITY_ID_GENERATOR', 1000200),
('PLAYER_ID_GENERATOR', 1000100),
('FLEET_ID_GENERATOR', 1000150),
('SYSTEM_ID_GENERATOR', 1000050),
('SECTOR_ID_GENERATOR', 1000300),

-- Trade and economic ID generators
('TRADE_SESSION_ID_GENERATOR', 1000075),
('TRANSACTION_ID_GENERATOR', 1000250),
('TRADE_NODE_ID_GENERATOR', 1000030),

-- Message and communication ID generators
('MESSAGE_ID_GENERATOR', 1000125),
('THREAD_ID_GENERATOR', 1000025),
('NOTIFICATION_ID_GENERATOR', 1000040),

-- Effect and status ID generators
('EFFECT_ID_GENERATOR', 1000080),
('STATUS_ID_GENERATOR', 1000035),
('BUFF_ID_GENERATOR', 1000020),

-- Mining and resource ID generators
('MINE_ID_GENERATOR', 1000090),
('RESOURCE_ID_GENERATOR', 1000180),
('MINING_SESSION_ID_GENERATOR', 1000015),

-- Faction and alliance ID generators
('FACTION_ID_GENERATOR', 1000010),
('ALLIANCE_ID_GENERATOR', 1000005),
('FACTION_RELATION_ID_GENERATOR', 1000008),

-- Ship and structure ID generators
('SHIP_ID_GENERATOR', 1000400),
('STATION_ID_GENERATOR', 1000060),
('STRUCTURE_ID_GENERATOR', 1000350),

-- Event and log ID generators
('EVENT_ID_GENERATOR', 1000120),
('LOG_ID_GENERATOR', 1000500),
('AUDIT_ID_GENERATOR', 1000045),

-- Unique and special purpose generators
('UNIQUE_ID_GENERATOR', 1000600),
('SESSION_ID_GENERATOR', 1000095),
('TOKEN_ID_GENERATOR', 1000070),

-- Test and debug ID generators
('TEST_ID_GENERATOR', 1000050),
('DEBUG_ID_GENERATOR', 1000025),
('SAMPLE_ID_GENERATOR', 1000010),

-- Low-activity generators
('RARE_EVENT_ID_GENERATOR', 1000005),
('MAINTENANCE_ID_GENERATOR', 1000003),
('BACKUP_ID_GENERATOR', 1000002),

-- High-activity generators
('COMBAT_EVENT_ID_GENERATOR', 1000800),
('MOVEMENT_ID_GENERATOR', 1001000),
('INTERACTION_ID_GENERATOR', 1000750),

-- Reset generators (starting from specific values)
('RESET_TEST_GENERATOR', 0),
('COUNTER_GENERATOR', 1),
('SEQUENCE_GENERATOR', 100),

-- Large number generators
('LARGE_ID_GENERATOR', 9999999),
('MASSIVE_ID_GENERATOR', 50000000),
('EXTREME_ID_GENERATOR', 999999999);

-- =============================================================================
-- DATA EXPLANATION
-- =============================================================================
-- ID Column:
-- - VARCHAR(128): Sequence generator name/identifier
-- - Descriptive names indicating the purpose of each generator
-- - Maximum length of 128 characters to accommodate various naming conventions
--
-- ID_GEN Column:
-- - BIGINT(64): Next available ID value for the sequence
-- - Represents the next ID that will be assigned when requested
-- - Values chosen to avoid conflicts with existing data
-- - Range from 0 to very large numbers for different use cases
-- =============================================================================

-- =============================================================================
-- INSERT COMPLETE - 44 ID GEN
-- =============================================================================
