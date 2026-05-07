-- =============================================================================
-- FTL TABLE TEST DATA
-- =============================================================================
-- Test data for the FTL table representing jump gate connections
-- Contains diverse FTL connections linking distant systems
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test FTL connections with varied types and permissions
INSERT INTO FTL (ID, FROM_X, FROM_Y, FROM_Z, FROM_X_LOC, FROM_Y_LOC, FROM_Z_LOC, FROM_UID, TO_X, TO_Y, TO_Z, TO_X_LOC, TO_Y_LOC, TO_Z_LOC, TO_UID, TYPE, PERMISSION) VALUES
-- Core system connections (Sol Prime area) - WARP_GATE connections between stations
(0,  16,  1,  1, 0, 0, 0, 'WarpGate_Re13', -14,  1,  1, 0, 0, 0, 'WarpGate_Cw16', 0, 0),
(1, -14,  1,  4, 0, 0, 0, 'WarpGate_If18',  25,  1,  1, 0, 0, 0, 'WarpGate_Ct19', 0, 0),
(2,  25,  4,  2, 0, 0, 0, 'WarpGate_Re20',  32,  0,  2, 0, 0, 0, 'WarpGate_Ol23', 0, 3),
(3,   4, 31,  2, 0, 0, 0, 'WarpGate_Qz28',   4,  1, 31, 0, 0, 0, 'WarpGate_Fr30', 0, 3),

-- Trading Guild network - WARP_GATE connections between trading stations
(4,  0,  4,  1, 0, 0, 0, 'BLACKHOLE_SGR'	,  9,  4,  1, 0, 0, 0, 'BLACKHOLE_PS9'	, 2, 3),
(5, 10,  1, -2, 0, 0, 0, 'BLACKHOLE_SC10'	, 15,  1,  4, 0, 0, 0, 'BLACKHOLE_DV15'	, 2, 3),
(6, 30,  1,  1, 0, 0, 0, 'BLACKHOLE_OI23'	,  3, 31,  1, 0, 0, 0, 'BLACKHOLE_QZ28'	, 2, 3),

-- Player faction connections - WARP_GATE connections between player stations
(7,   2,  2,  5, 0, 0, 0, 'WORMHOLE_ALPHA'	,  2,  5,  2, 0, 0, 0, 'WORMHOLE_SGR'	, 1, 3),
(8,   0,  2, -1, 0, 0, 0, 'WORMHOLE_VOID'	, -4,  2,  2, 0, 0, 0, 'WORMHOLE_TG5'	, 1, 31),
(9,  -6, -1,  2, 0, 0, 0, 'WORMHOLE_TG6'	, -6,  2,  5, 0, 0, 0, 'WORMHOLE_TG7'	, 1, 31),
(10, 11,  5,  2, 0, 0, 0, 'WORMHOLE_PS9'	, 15,  5,  2, 0, 0, 0, 'WORMHOLE_FD14'	, 1, 31),
(11,-15, -1,  2, 0, 0, 0, 'WORMHOLE_VZ17'	,  0, 17,  2, 0, 0, 0, 'WORMHOLE_WZ21'	, 1, 31),
(12,  0,  2, 17, 0, 0, 0, 'WORMHOLE_NS22'	,-30,  2,  2, 0, 0, 0, 'WORMHOLE_PD25'	, 1, 15),
(13,  0, 32,  2, 0, 0, 0, 'WORMHOLE_SN27'	,  0,  2, 32, 0, 0, 0, 'WORMHOLE_LC29'	, 1, 15);

-- =============================================================================
-- INSERT COMPLETE - 14 FTL CONNECTIONS
-- =============================================================================
