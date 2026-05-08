-- =============================================================================
-- FLEETS TABLE TEST DATA (SIMPLIFIED BINARY DATA)
-- =============================================================================
-- Test data for the FLEETS table representing fleet command structures
-- Contains simplified binary data that is valid for HSQLDB
-- 
-- Author: InitSysRev
-- Version: 1.0.2 - Simplified binary data for HSQLDB compatibility
-- Date: 2025-01-25
-- =============================================================================

-- Insert test fleets with simplified binary data
INSERT INTO FLEETS (ID, FLAGSHIP_ID, PARENT_FLEET, NAME, OWNER, MISSION_STRING, COMMAND, FACTION_ACCESS, SAVED_REMOTES, COMBAT_SETTING) VALUES
-- Trading Guild
(1, 4, -1, 'NPCFLT#TRADING#-00#-2, 0, 0#1', '', 'TRADING', X'00000001', 1, X'00', 'PASSIVE'),
(2, 6, -1, 'NPCFLT#PATROLLING#-00#-2, 0, 0#2', '', 'PATROLLING', X'00000002', 0, X'00', 'ALWAYS ENGAGE'),
(3, 8, -1, 'NPCFLT#ATTACKING#-00#-2, 0, 0#3', '', 'ATTACKING', X'00000003', 0, X'00', 'ALWAYS ENGAGE'),

(4, 10, -1, 'Fighters', 'TestPlayerCommander1', 'SENTRY - FORMATION', X'00000004', 2, X'00', 'SOMETIMES ENGAGE'),
(5, 10, 3, 'Faction fleet', 'TestPlayerCommander1', 'MOVING', X'00000005', 2, X'00', 'SOMETIMES ENGAGE'),
(6, 13, -1, 'Independant', 'TestPlayerIndependent1', 'IDLE', X'00000006', 2, X'00', 'PASSIVE'),
(7, 16, -1, 'Faction 2', 'TestPlayerFactionLeader2', 'STANDOFF', X'00000007', 2, X'00', 'SOMETIMES ENGAGE');
-- =============================================================================
-- INSERT COMPLETE - 7 FLEETS
-- =============================================================================
