-- =============================================================================
-- FLEET_MEMBERS TABLE TEST DATA
-- =============================================================================
-- Test data for the FLEET_MEMBERS table representing fleet composition
-- Contains diverse fleet member configurations with varied roles and states
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test fleet members with varied configurations
INSERT INTO FLEET_MEMBERS (ID, FLEET_ID, ENTITY_ID, MISSION_STRING, LIST_INDEX, DOCKED_TO, FACTION) VALUES
-- Alpha Strike Fleet (0) - Combat formation
(1, 1, 4, 'TRADING', 0, -1, -10000000), -- Flagship
(2, 1, 5, 'TRADING', 1, -1, -10000000), -- Fighter 1 docked to flagship

(3, 2, 6, 'PATROLLING', 0, -1, -9999999), -- Fighter 2 docked to flagship
(4, 2, 7, 'PATROLLING', 1, -1, -9999999), -- Fighter 3 docked to flagship

(5, 3, 8, 'ATTACKING', 0, -1, -999998), -- Fighter 3 docked to flagship

(6, 4, 10, 'SENTRY - FORMATION', 0, 9, 1), -- Fighter 3 docked to flagship
(7, 4, 11, 'SENTRY - FORMATION', 1, 9, 1), -- Fighter 3 docked to flagship
(8, 4, 12, 'SENTRY - FORMATION', 2, 9, 1), -- Fighter 3 docked to flagship
(9, 5, 9, 'MOVING', 0, -1, 1), -- Fighter 3 docked to flagship
(10, 5, 1, 'MOVING', 1, -1, 1), -- Fighter 3 docked to flagship
(11, 5, 2, 'MOVING', 2, -1, 1), -- Fighter 3 docked to flagship
(12, 5, 3, 'ATTACKING', 3, -1, 1), -- Fighter 3 docked to flagship

(13, 6, 13, 'IDLE', 0, -1, 0),
(14, 6, 14, 'IDLE', 1, -1, 0),
(15, 6, 15, 'IDLE', 2, -1, 0),

(16, 7, 16, 'STANDOFF', 0, -1, 2),
(17, 7, 17, 'STANDOFF', 1, -1, 2);

-- =============================================================================
-- INSERT COMPLETE - 17 FLEET MEMBERS
-- =============================================================================
