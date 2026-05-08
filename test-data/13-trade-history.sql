-- =============================================================================
-- TRADE_HISTORY TABLE TEST DATA
-- =============================================================================
-- Test data for the TRADE_HISTORY table designed to record all commercial trades
-- between trading stations.
-- 
-- **IMPORTANT NOTE: This table is currently UNUSED in the StarMade game implementation.**
-- It serves as a reserved structure for potential future transaction tracking 
-- and economic analytics functionality.
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test trade history records for theoretical transaction logging
-- Each record represents a commercial trade between trading stations

INSERT INTO TRADE_HISTORY (ID, FROM_ID, TO_ID, FROM_OWNER, TO_OWNER, FROM_FACTION_ID, TO_FACTION_ID, TOTAL_COST, DELIVERY_COST, SENT, RECEIVED, VOLUME, SUCCESS) VALUES
-- Successful transactions
(1, 1000000, 1000001, 'TestPlayerTrader1', 'TestPlayerEconomist1', 1000001, 1000002, 50000, 5000, 1672531200000, 1672531800000, 150.5, TRUE),
(2, 1000001, 1000002, 'TestPlayerEconomist1', 'TestPlayerMerchant1', 1000002, 1000003, 75000, 7500, 1672531860000, 1672532460000, 225.0, TRUE),
(3, 1000002, 1000003, 'TestPlayerMerchant1', 'TestPlayerVIP1', 1000003, 1000005, 100000, 10000, 1672532520000, 1672533120000, 50.0, TRUE),
(4, 1000003, 1000000, 'TestPlayerVIP1', 'TestPlayerTrader1', 1000005, 1000001, 25000, 2500, 1672533180000, 1672533780000, 75.25, TRUE),

-- Failed transactions
(5, 1000000, 1000004, 'TestPlayerTrader1', 'TestPlayerNewbie1', 1000001, 1000001, 30000, 3000, 1672533840000, 1672534440000, 100.0, FALSE),
(6, 1000004, 1000001, 'TestPlayerNewbie1', 'TestPlayerEconomist1', 1000001, 1000002, 15000, 1500, 1672534500000, 1672535100000, 60.0, FALSE),

-- Internal faction trades
(7, 1000000, 1000005, 'TestPlayerTrader1', 'TestPlayerMember1', 1000001, 1000001, 40000, 4000, 1672535160000, 1672535760000, 120.0, TRUE),
(8, 1000005, 1000006, 'TestPlayerMember1', 'TestPlayerMember2', 1000001, 1000001, 20000, 2000, 1672535820000, 1672536420000, 80.0, TRUE),

-- Cross-faction trades
(9, 1000001, 1000007, 'TestPlayerEconomist1', 'TestPlayerBuilder1', 1000002, 1000006, 60000, 6000, 1672536480000, 1672537080000, 180.0, TRUE),
(10, 1000007, 1000002, 'TestPlayerBuilder1', 'TestPlayerMerchant1', 1000006, 1000003, 35000, 3500, 1672537140000, 1672537740000, 95.5, TRUE),

-- Neutral party trades
(11, 1000008, 1000009, 'TestPlayerIndependent1', 'TestPlayerIndependent2', 0, 0, 12000, 1200, 1672537800000, 1672538400000, 40.0, TRUE),
(12, 1000009, 1000008, 'TestPlayerIndependent2', 'TestPlayerIndependent1', 0, 0, 8000, 800, 1672538460000, 1672539060000, 30.0, TRUE),

-- High-value transactions
(13, 1000010, 1000011, 'TestPlayerVIP1', 'TestPlayerVIP2', 1000005, 1000002, 500000, 50000, 1672539120000, 1672539720000, 25.0, TRUE),
(14, 1000011, 1000010, 'TestPlayerVIP2', 'TestPlayerVIP1', 1000002, 1000005, 300000, 30000, 1672539780000, 1672540380000, 15.0, TRUE),

-- Low-value transactions
(15, 1000012, 1000013, 'TestPlayerNewbie1', 'TestPlayerNewbie2', 1000001, 1000002, 5000, 500, 1672540440000, 1672541040000, 20.0, TRUE),
(16, 1000013, 1000012, 'TestPlayerNewbie2', 'TestPlayerNewbie1', 1000002, 1000001, 3000, 300, 1672541100000, 1672541700000, 15.0, TRUE),

-- Zero delivery cost (same location)
(17, 1000000, 1000014, 'TestPlayerTrader1', 'TestPlayerScientist1', 1000001, 1000006, 80000, 0, 1672541760000, 1672542360000, 200.0, TRUE),
(18, 1000014, 1000000, 'TestPlayerScientist1', 'TestPlayerTrader1', 1000006, 1000001, 45000, 0, 1672542420000, 1672543020000, 110.0, TRUE),

-- Different volume transactions
(19, 1000015, 1000016, 'TestPlayerMiner1', 'TestPlayerMiner2', 1000003, 1000004, 90000, 9000, 1672543080000, 1672543680000, 500.0, TRUE),
(20, 1000016, 1000015, 'TestPlayerMiner2', 'TestPlayerMiner1', 1000004, 1000003, 70000, 7000, 1672543740000, 1672544340000, 350.0, TRUE);

-- =============================================================================
-- DATA EXPLANATION
-- =============================================================================
-- **TABLE STATUS: UNUSED** - This table exists in the database schema but is not
-- actively used by the StarMade game engine.
--
-- Column Explanations:
-- - ID: Auto-incrementing transaction ID
-- - FROM_ID/TO_ID: Trading station node IDs (theoretical references)
-- - FROM_OWNER/TO_OWNER: Player UIDs involved in the transaction
-- - FROM_FACTION_ID/TO_FACTION_ID: Faction IDs (0 = neutral/independent)
-- - TOTAL_COST: Total transaction value in credits
-- - DELIVERY_COST: Shipping/transport fees
-- - SENT: Transaction initiation timestamp (milliseconds)
-- - RECEIVED: Transaction completion timestamp (milliseconds)
-- - VOLUME: Cargo volume in cubic units
-- - SUCCESS: Transaction completion status (TRUE/FALSE)
--
-- Transaction Patterns:
-- - Successful and failed transactions
-- - Internal faction trades (same faction)
-- - Cross-faction commerce
-- - Neutral party transactions
-- - Various value ranges and cargo volumes
-- - Different delivery costs and durations
-- =============================================================================

-- =============================================================================
-- INSERT COMPLETE - 20 THEORETICAL TRADE HISTORY RECORDS
-- =============================================================================
