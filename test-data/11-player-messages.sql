-- =============================================================================
-- PLAYER_MESSAGES TABLE TEST DATA
-- =============================================================================
-- Test data for the PLAYER_MESSAGES table representing player communications
-- Contains diverse message types with realistic communication patterns
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test player messages with varied types and timestamps
INSERT INTO PLAYER_MESSAGES (ID, SENDER, RECEIVER, TOPIC, MESSAGE, SENT, "READ", ATT_ID) VALUES
-- Faction leadership communications
(1, 'TestPlayerFactionLeader1', 'TestPlayerSeniorOfficer1', 'Fleet Meeting', 'Meeting scheduled for 1400 hours to discuss fleet deployment strategies. Please prepare status reports.', 1672531200000, false, NULL),
(2, 'TestPlayerSeniorOfficer1', 'TestPlayerFactionLeader1', 'Re: Fleet Meeting', 'Confirmed. Fleet status report attached. Alpha fleet ready for deployment.', 1672531260000, false, 1000004),

-- Inter-faction diplomacy
(3, 'TestPlayerFactionLeader1', 'TestPlayerFactionLeader2', 'Non-Aggression Pact', 'Proposing non-aggression pact for contested sectors. Terms for discussion attached.', 1672531320000, false, NULL),
(4, 'TestPlayerFactionLeader2', 'TestPlayerFactionLeader1', 'Re: Non-Aggression Pact', 'Reviewing proposal. Initial terms acceptable. Scheduling formal negotiation.', 1672531380000, false, NULL),

-- Trade negotiations
(5, 'TestPlayerTrader1', 'TestPlayerEconomist1', 'Bulk Materials', 'Bulk shipment of advanced materials available. 50,000 units at 15% below market rate.', 1672531440000, false, NULL),
(6, 'TestPlayerEconomist1', 'TestPlayerTrader1', 'Re: Bulk Materials', 'Interested in 25,000 units. Can we negotiate delivery terms to sector 5,1,0?', 1672531500000, false, NULL),

-- Mission coordination
(7, 'TestPlayerCommander1', 'TestPlayerPilot1', 'Patrol Orders', 'Mission briefing: Patrol sectors 0,0,0 to 2,2,2. Report any unusual activity.', 1672531560000, false, 1000032),
(8, 'TestPlayerPilot1', 'TestPlayerCommander1', 'Re: Patrol Orders', 'Patrol route acknowledged. Estimated completion in 4 hours. Will maintain comm silence.', 1672531620000, false, NULL),

-- Emergency communications
(9, 'TestPlayerMember1', 'TestPlayerFactionLeader1', 'EMERGENCY: Under Attack', 'EMERGENCY: Under attack by unknown hostiles at sector 8,0,0. Requesting immediate backup!', 1672531680000, false, NULL),
(10, 'TestPlayerFactionLeader1', 'TestPlayerCommander1', 'PRIORITY: Backup Needed', 'PRIORITY: Member1 under attack at 8,0,0. Dispatch Alpha fleet immediately. Authorize lethal force.', 1672531740000, false, NULL),

-- Social messages
(11, 'TestPlayerMember2', 'TestPlayerMember3', 'Great Job!', 'Great job on the mining operation yesterday! The resource haul was impressive.', 1672531800000, true, NULL),
(12, 'TestPlayerMember3', 'TestPlayerMember2', 'Re: Great Job!', 'Thanks! Team effort made all the difference. Looking forward to the next operation.', 1672531860000, true, NULL),

-- Technical support
(13, 'TestPlayerNewbie1', 'TestPlayerBuilder1', 'Ship Design Help', 'Need help with ship design. Engines not providing enough thrust for the mass.', 1672531920000, false, 1000033),
(14, 'TestPlayerBuilder1', 'TestPlayerNewbie1', 'Re: Ship Design Help', 'Reviewed your design. Try increasing thruster count by 30% and balancing thrust vectors. Attached modified blueprint.', 1672531980000, false, 1000034),

-- Intelligence reports
(15, 'TestPlayerSpy1', 'TestPlayerFactionLeader1', 'Intel Report', 'Intel report: Outcast forces massing at sector 3,1,0. Estimated 5 heavy ships. Recommend defensive measures.', 1672532040000, false, NULL),
(16, 'TestPlayerFactionLeader1', 'TestPlayerCommander1', 'Intel Confirmed', 'Intelligence confirms Outcast buildup. Increase sector 3,1,0 patrols. Prepare contingency plans.', 1672532100000, false, NULL),

-- Research collaboration
(17, 'TestPlayerScientist1', 'TestPlayerScientist2', 'Quantum Research', 'Quantum resonance data from black hole study attached. Thoughts on potential applications?', 1672532160000, false, 1000050),
(18, 'TestPlayerScientist2', 'TestPlayerScientist1', 'Re: Quantum Research', 'Fascinating data! Potential for FTL drive improvements. Shall we collaborate on practical applications?', 1672532220000, false, NULL),

-- Cross-faction trading
(19, 'TestPlayerMerchant1', 'TestPlayerMerchant2', 'Neutral Trade', 'Neutral ground trade meet at sector 0,0,0. Bringing rare artifacts for exchange.', 1672532280000, false, NULL),
(20, 'TestPlayerMerchant2', 'TestPlayerMerchant1', 'Re: Neutral Trade', 'Confirmed. Have exotic materials to trade. Meet at Sol Prime trade hub for security.', 1672532340000, false, NULL),

-- System messages (automated)
(21, 'SYSTEM', 'TestPlayerFactionLeader1', 'Station Maintenance', 'Faction homebase shields at 75%. Recommend maintenance check within 24 hours.', 1672532400000, false, 1000002),
(22, 'SYSTEM', 'TestPlayerMiner1', 'Mining Report', 'Mining efficiency optimal. Current yield: 125% of baseline. Asteroid depletion in 72 hours.', 1672532460000, false, 1000031),

-- Failed delivery attempts (inactive users)
(23, 'TestPlayerIndependent1', 'TestInactiveUser', 'Trade Opportunity', 'Trying to reach you about the trading opportunity. Please respond when available.', 1672532520000, false, NULL),
(24, 'TestPlayerExplorer1', 'TestBannedUser', 'Resource Discovery', 'Discovered new sector with rich resources. Coordinates: -8,-8,-8. Interested in partnership?', 1672532580000, false, NULL),

-- Archived messages (old)
(25, 'TestPlayerFactionLeader1', 'TestPlayerSeniorOfficer1', 'Old Fleet Orders', 'Old fleet deployment orders from last month. Keeping for historical reference.', 1669939200000, true, NULL),
(26, 'TestPlayerEconomist1', 'TestPlayerTrader1', 'Old Trade Terms', 'Previous trade agreement terms. Superseded by new contract but keeping for reference.', 1669939260000, true, NULL),

-- Read messages
(27, 'TestPlayerMember4', 'TestPlayerMember5', 'Casual Chat', 'How are things going with your mining operation? Any good finds lately?', 1672532640000, true, NULL),
(28, 'TestPlayerMember5', 'TestPlayerMember4', 'Re: Casual Chat', 'Going well! Found some rare crystals yesterday. Want to trade?', 1672532700000, true, NULL),

-- Messages with attachments
(29, 'TestPlayerBuilder1', 'TestPlayerNewbie1', 'Ship Blueprint', 'Here is the improved ship blueprint we discussed. Should solve your thrust issues.', 1672532760000, false, 1000035),
(30, 'TestPlayerTrader1', 'TestPlayerEconomist1', 'Trade Manifest', 'Detailed trade manifest for our upcoming deal. Please review and confirm.', 1672532820000, false, 1000016),

-- Urgent messages
(31, 'TestPlayerCommander2', 'TestPlayerFactionLeader2', 'Urgent: Hostile Fleet', 'Urgent: Large hostile fleet approaching sector 10,0,0. Requesting immediate reinforcements.', 1672532880000, false, NULL),
(32, 'TestPlayerFactionLeader2', 'TestPlayerCommander2', 'Re: Urgent: Hostile Fleet', 'Reinforcements dispatched. ETA 20 minutes. Hold position and avoid engagement until support arrives.', 1672532940000, false, NULL),

-- Long conversation thread
(33, 'TestPlayerDiplomat1', 'TestPlayerFactionLeader3', 'Alliance Proposal', 'Formal alliance proposal between our factions. Economic and military cooperation benefits outlined.', 1672533000000, false, NULL),
(34, 'TestPlayerFactionLeader3', 'TestPlayerDiplomat1', 'Re: Alliance Proposal', 'Proposal under consideration. Council meeting scheduled for tomorrow. Will respond within 48 hours.', 1672533060000, false, NULL),
(35, 'TestPlayerDiplomat1', 'TestPlayerFactionLeader3', 'Re: Alliance Proposal', 'Thank you for the quick response. Looking forward to positive outcome. Additional terms attached.', 1672533120000, false, 1000053),

-- Self-messages (notes)
(36, 'TestPlayerCommander1', 'TestPlayerCommander1', 'Personal Note', 'Remember to check fleet maintenance schedules and update patrol routes for next week.', 1672533180000, false, NULL),
(37, 'TestPlayerScientist1', 'TestPlayerScientist1', 'Research Note', 'Potential breakthrough in quantum drive efficiency. Need to run more tests with new parameters.', 1672533240000, false, NULL),

-- Messages from different time periods
(38, 'TestPlayerExplorer2', 'TestPlayerExplorer1', 'Exploration Report', 'Sector -5,1,0 has unusual energy readings. Might be worth investigating together.', 1672533300000, false, NULL),
(39, 'TestPlayerMiner2', 'TestPlayerMiner1', 'Mining Partnership', 'Found a rich asteroid field in sector 5,0,2. Want to partner up for extraction?', 1672533360000, false, NULL),

-- Messages with various read statuses
(40, 'TestPlayerVIP1', 'TestPlayerMember1', 'VIP Access', 'Special access granted to VIP trading post. Coordinates and access code attached.', 1672533420000, true, 1000032),
(41, 'TestPlayerMember1', 'TestPlayerVIP1', 'Re: VIP Access', 'Thank you for the access! Successfully made several profitable trades.', 1672533480000, true, NULL),

-- Recent messages
(42, 'TestPlayerPilot2', 'TestPlayerCommander1', 'Mission Complete', 'Patrol mission completed successfully. No hostile activity detected in assigned sectors.', 1672533540000, false, NULL),
(43, 'TestPlayerCommander1', 'TestPlayerPilot2', 'Re: Mission Complete', 'Excellent work. Return to base for debriefing and next assignment.', 1672533600000, false, NULL),

-- Multi-faction communications
(44, 'TestPlayerFactionLeader4', 'TestPlayerFactionLeader5', 'Neutral Meeting', 'Proposing neutral meeting at sector 0,0,0 to discuss territorial boundaries.', 1672533660000, false, NULL),
(45, 'TestPlayerFactionLeader5', 'TestPlayerFactionLeader4', 'Re: Neutral Meeting', 'Agreed. Will meet at coordinates 0,0,0 at 1800 hours with minimal escort.', 1672533720000, false, NULL),

-- Technical discussions
(46, 'TestPlayerBuilder2', 'TestPlayerBuilder1', 'Engine Optimization', 'New engine design shows 15% efficiency improvement. Prototype ready for testing.', 1672533780000, false, 1000036),
(47, 'TestPlayerBuilder1', 'TestPlayerBuilder2', 'Re: Engine Optimization', 'Impressive results! Schedule testing for next week. Will prepare test ship.', 1672533840000, false, NULL),

-- Final messages
(48, 'TestPlayerUnicode1', 'TestPlayer-Special_1', 'Special Characters', 'Testing message with special characters: áéíóú ñÑ ¡¿ «» - All systems operational.', 1672533900000, false, NULL),
(49, 'TestPlayer-Special_1', 'TestPlayerUnicode1', 'Re: Special Characters', 'Message received correctly. Character encoding working properly.', 1672533960000, false, NULL),
(50, 'TestUser1', 'TestUser2', 'Debug Test', 'Final debug test message. All communication systems operational.', 1672534020000, false, NULL);

-- =============================================================================
-- INSERT COMPLETE - 50 PLAYER MESSAGES
-- =============================================================================
