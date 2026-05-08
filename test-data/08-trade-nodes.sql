-- =============================================================================
-- TRADE_NODES TABLE TEST DATA
-- =============================================================================
-- Test data for the TRADE_NODES table representing trade station marketplaces
-- Contains diverse trade configurations with realistic economics
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test trade nodes with varied configurations
INSERT INTO TRADE_NODES (ID, SEC_X, SEC_Y, SEC_Z, PLAYER, STATION_NAME, FACTION, PERMISSION, ITEMS, VOLUME, CAPACITY, CREDITS) VALUES
-- Central trade hub (Sol Prime) - Using valid coordinates and players
(1, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', .0, .0, 50000000),
(2, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 25000.0, 50000.0, 50000000),
(3, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 50000.0, 50000.0, 2400000),
(4, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 20000.0, 50000.0, 51800000),
(5, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 12000.0, 50000.0, 70005004),
(6, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 40000.0, 50000.0, 60000000),
(7, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 0.0, 50000.0, 2300000000),
(8, 0,  0,  2, 'TestPlayerFactionLeader1', 'Trading station', 1, 15, '789C0B604000000000FFFF', 25000.0, 50000.0, 50000000),

-- Player faction trade stations - All coordinates verified in sectors.sql
(9, 5,  0,  1, 'TestPlayerFactionLeader1', 'Trading station', 1, 7, '789C0B604000000000FFFF', 15000.0, 50000.0, 5000000),
(10, -5,  0,  1, 'TestPlayerFactionLeader1', 'Trading station', 1, 7, '789C0B604000000000FFFF', 40000.0, 60000.0, 3000000),
(11, -6,  2,  3, 'TestPlayerFactionLeader1', 'Trade Hub', 1, 7, '789C0B604000000000FFFF', 20000.0, 40000.0, 2000000),

-- Trading Guild stations - Using valid coordinates and corrected players
(12, 24,  0,  0, '<system>', 'Central Trade Station', 0, 15, '789C0B604000000000FFFF', 35000.0, 40000.0, 25000000);

-- =============================================================================
-- INSERT COMPLETE - 12 TRADE NODES
-- =============================================================================
