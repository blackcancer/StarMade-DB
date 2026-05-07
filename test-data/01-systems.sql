-- =============================================================================
-- SYSTEMS TABLE TEST DATA - SIMPLIFIED HSQLDB VERSION
-- =============================================================================
-- Test data for the SYSTEMS table representing star systems
-- Uses simple, valid hexadecimal values for HSQLDB compatibility
-- 
-- Author: InitSysRev
-- Version: 1.0.3 - Simplified for HSQLDB compatibility
-- Date: 2025-01-09
-- =============================================================================

-- Insert test systems with varied types and ownership
INSERT INTO SYSTEMS (ID, X, Y, Z, TYPE, STARTTIME, NAME, INFOS, OWNER_UID, OWNER_FACTION, OWNER_X, OWNER_Y, OWNER_Z, RESOURCES) VALUES
-- Central systems (0,0,0 region)
(0, 0, 0, 0, 0, 1672531200000, 'Sol Prime', X'00000000', NULL, 0, 0, 0, 0, X'10152030456075900A0B0C0D0E0F5051'),
(1, 0, 0, 1, 1, 1672531200000, 'Alpha Centauri', X'00000001', NULL, 0, 0, 0, 0, X'20253545557580950A0B0C0D0E0F1020'),
(2, 0, 1, 0, 2, 1672531200000, 'Sagittarius A*', X'00000002', NULL, 0, 0, 0, 0, X'7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F'),
(3, 1, 0, 0, 3, 1672531200000, 'Binary Prime', X'00000003', NULL, 0, 0, 0, 0, X'30405060708090A01020304050608090'),
(4, 0, 0, -1, 4, 1672531200000, 'The Void', X'00000004', NULL, 0, 0, 0, 0, X'05050505050505050505050505050505'),

-- Trading Guild territory (NPC systems)
(5, -2, 0, 0, 0, 1672531200000, 'Trading Post Alpha', X'00000005', 'ENTITY_Security_Station', -10000000, -4, 1, 0, X'50556065707580859095102030405060'),
(6, -2, -1, 0, 0, 1672531200000, 'Trading Post Beta', X'00000006', 'ENTITY_Depot_Station', -10000000, -6, -3, 2, X'60657075808590A00A15304560750001'),
(7, -2, 0, 1, 1, 1672531200000, 'Trading Hub Gamma', X'00000007', 'ENTITY_Warehouse_Station', -10000000, -5, 2, 5, X'70758085909590102030405060708090'),

-- Outcast territory (hostile NPC systems)
(8, 3, 0, 0, 0, 1672531200000, 'Outcast Base Alpha', X'00000008', 'ENTITY_Pirate_Base', -9999999, 9, 2, 0, X'80859095102030405060708090102030'),
(9, 3, 1, 0, 2, 1672531200000, 'Pirate Stronghold', X'00000009', 'ENTITY_Hidden_Base', -9999999, 10, 3, 0, X'90950A05102030405060708090102030'),
(10, 3, 0, -1, 0, 1672531200000, 'Raider Outpost', X'0000000A', 'ENTITY_Raider_Dock', -9999999, 10, 2, -1, X'0A05102030405060708090102030400A'),

-- Scavenger territory
(11, 0, -3, 0, 4, 1672531200000, 'Scavenger Nest', X'0000000B', 'ENTITY_Hidden_Cache', -9999998, -7, 1, 3, X'10101010101010101010101010101010'),
(12, 1, -3, 0, 4, 1672531200000, 'Salvage Yard', X'0000000C', 'ENTITY_Salvage_Depot', -9999998, 5, -9, 1, X'15151515151515151515151515151515'),

-- Player faction territory
(13, 5, 0, 0, 0, 1672531200000, 'New Terra', X'0000000D', 'WarpGate_Re13', 1, 16, 1, 1, X'40506070809010203040506070809010'),
(14, 5, 1, 0, 0, 1672531200000, 'Industrial Complex', X'0000000E', NULL, 0, 0, 0, 0, X'50607080901020304050607080901020'),
(15, 5, 0, 1, 1, 1672531200000, 'Mining Station', X'0000000F', 'ENTITY_Research_Station', 1, 15, 0, 5, X'60708090102030405060708090102030'),

-- Neutral systems with resources
(16, -5, 0, 0, 0, 1672531200000, 'Resource Alpha', X'00000010', NULL, 0, 0, 0, 0, X'70809010203040506070809010203040'),
(17, -5, -1, 0, 1, 1672531200000, 'Resource Beta', X'00000011', NULL, 0, 0, 0, 0, X'80901020304050607080901020304050'),
(18, -5, 0, 1, 0, 1672531200000, 'Resource Gamma', X'00000012', NULL, 0, 0, 0, 0, X'90102030405060708090102030405060'),

-- Frontier systems (player expansion)
(19, 8, 0, 0, 0, 1672531200000, 'Frontier One', X'00000013', 'ENTITY_Central_Trade_Station', 1, 24, 0, 0, X'10203040506070809010203040506070'),
(20, 8, 1, 0, 4, 1672531200000, 'Frontier Two', X'00000014', NULL, 0, 0, 0, 0, X'20304050607080901020304050607080'),

-- Strategic systems
(21, 0, 5, 0, 0, 1672531200000, 'Strategic Point Alpha', X'00000015', NULL, 0, 0, 0, 0, X'30405060708090102030405060708090'),
(22, 0, 0, 5, 1, 1672531200000, 'Strategic Point Beta', X'00000016', NULL, 0, 0, 0, 0, X'40506070809010203040506070809010'),

-- Contested systems
(23, 10, 0, 0, 0, 1672531200000, 'Contested Alpha', X'00000017', 'ENTITY_Smuggler_Station', 4, 31, 0, 0, X'50607080901020304050607080901020'),
(24, 10, 1, 0, 0, 1672531200000, 'Contested Beta', X'00000018', 'ENTITY_Fortress_Station', 2, 30, 3, 0, X'60708090102030405060708090102030'),

-- Deep space systems
(25, -10, 0, 0, 4, 1672531200000, 'Deep Space Alpha', X'00000019', NULL, 0, 0, 0, 0, X'0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A'),
(26, -10, -1, 0, 4, 1672531200000, 'Deep Space Beta', X'0000001A', NULL, 0, 0, 0, 0, X'0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F'),

-- Core systems for major factions
(27, 0, 10, 0, 0, 1672531200000, 'Core Alpha', X'0000001B', 'ENTITY_Bastion', 5, 1, 30, 2, X'70809010203040506070809010203040'),
(28, 1, 10, 0, 1, 1672531200000, 'Core Beta', X'0000001C', 'ENTITY_Quarantine_Station', 4, 4, 30, 0, X'80901020304050607080901020304050'),

-- Research systems
(29, 0, 0, 10, 2, 1672531200000, 'Research Station Alpha', X'0000001D', 'ENTITY_Research_Center', 6, 2, 0, 32, X'6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A'),
(30, 1, 0, 10, 3, 1672531200000, 'Research Station Beta', X'0000001E', 'ENTITY_Relay_Station', 6, 3, 0, 30, X'5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A');

-- =============================================================================
-- INSERT COMPLETE - 31 SYSTEMS
-- =============================================================================
