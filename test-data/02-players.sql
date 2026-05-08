-- =============================================================================
-- PLAYERS TABLE TEST DATA
-- =============================================================================
-- Test data for the PLAYERS table representing player accounts
-- Contains diverse player types with varied permissions and factions
-- 
-- Author: InitSysRev
-- Version: 1.0.0
-- Date: 2025-01-09
-- =============================================================================

-- Insert test players with varied roles and permissions
INSERT INTO PLAYERS (ID, NAME, STARMADE_NAME, FACTION, PERMISSION) VALUES
-- Faction leaders (high permissions)
(2147483647, 'admin_leader', 'TestPlayerAdminLeader', 1, 2147483647), -- Admin permissions
(2147483646, 'faction_leader_1', 'TestPlayerFactionLeader1', 1, 255), -- Full control
(2147483645, 'faction_leader_2', 'TestPlayerFactionLeader2', 2, 255), -- Full control
(2147483644, 'faction_leader_3', 'TestPlayerFactionLeader3', 3, 255), -- Full control
(2147483643, 'faction_leader_4', 'TestPlayerFactionLeader4', 4, 255), -- Full control
(2147483642, 'faction_leader_5', 'TestPlayerFactionLeader5', 5, 255), -- Full control
(2147483641, 'faction_leader_6', 'TestPlayerFactionLeader6', 6, 255), -- Full control

-- Senior officers (high permissions)
(2147483640, 'senior_officer_1', 'TestPlayerSeniorOfficer1', 1, 135), -- Invite + Kick + Edit permissions + Edit description + Homebase
(2147483639, 'senior_officer_2', 'TestPlayerSeniorOfficer2', 2, 135), -- Invite + Kick + Edit permissions + Edit description + Homebase
(2147483638, 'senior_officer_3', 'TestPlayerSeniorOfficer3', 3, 135), -- Invite + Kick + Edit permissions + Edit description + Homebase
(2147483637, 'senior_officer_4', 'TestPlayerSeniorOfficer4', 4, 135), -- Invite + Kick + Edit permissions + Edit description + Homebase

-- Basic officers (moderate permissions)
(2147483636, 'basic_officer_1', 'TestPlayerBasicOfficer1', 1, 3), -- Invite + Kick
(2147483635, 'basic_officer_2', 'TestPlayerBasicOfficer2', 2, 3), -- Invite + Kick
(2147483634, 'basic_officer_3', 'TestPlayerBasicOfficer3', 3, 3), -- Invite + Kick
(2147483633, 'basic_officer_4', 'TestPlayerBasicOfficer4', 4, 3), -- Invite + Kick
(2147483632, 'basic_officer_5', 'TestPlayerBasicOfficer5', 5, 3), -- Invite + Kick

-- Regular faction members (no permissions)
(2147483631, 'member_1', 'TestPlayerMember1', 1, 0), -- No permissions
(2147483630, 'member_2', 'TestPlayerMember2', 1, 0), -- No permissions
(2147483629, 'member_3', 'TestPlayerMember3', 2, 0), -- No permissions
(2147483628, 'member_4', 'TestPlayerMember4', 2, 0), -- No permissions
(2147483627, 'member_5', 'TestPlayerMember5', 3, 0), -- No permissions
(2147483626, 'member_6', 'TestPlayerMember6', 3, 0), -- No permissions
(2147483625, 'member_7', 'TestPlayerMember7', 4, 0), -- No permissions
(2147483624, 'member_8', 'TestPlayerMember8', 4, 0), -- No permissions
(2147483623, 'member_9', 'TestPlayerMember9', 5, 0), -- No permissions
(2147483622, 'member_10', 'TestPlayerMember10', 5, 0), -- No permissions

-- Independent players (no faction)
(2147483621, 'independent_1', 'TestPlayerIndependent1', 0, 0), -- No faction
(2147483620, 'independent_2', 'TestPlayerIndependent2', 0, 0), -- No faction
(2147483619, 'independent_3', 'TestPlayerIndependent3', 0, 0), -- No faction
(2147483618, 'independent_4', 'TestPlayerIndependent4', 0, 0), -- No faction
(2147483617, 'independent_5', 'TestPlayerIndependent5', 0, 0), -- No faction

-- Newbie players (recently joined factions)
(2147483616, 'newbie_1', 'TestPlayerNewbie1', 1, 0), -- Just joined
(2147483615, 'newbie_2', 'TestPlayerNewbie2', 2, 0), -- Just joined
(2147483614, 'newbie_3', 'TestPlayerNewbie3', 3, 0), -- Just joined
(2147483613, 'newbie_4', 'TestPlayerNewbie4', 4, 0), -- Just joined
(2147483612, 'newbie_5', 'TestPlayerNewbie5', 5, 0), -- Just joined

-- Specialized role players
(2147483611, 'trader_1', 'TestPlayerTrader1', 1, 0), -- Trade specialist
(2147483610, 'trader_2', 'TestPlayerTrader2', 2, 0), -- Trade specialist
(2147483609, 'miner_1', 'TestPlayerMiner1', 3, 0), -- Mining specialist
(2147483608, 'miner_2', 'TestPlayerMiner2', 4, 0), -- Mining specialist
(2147483607, 'builder_1', 'TestPlayerBuilder1', 5, 0), -- Builder specialist
(2147483606, 'builder_2', 'TestPlayerBuilder2', 6, 0), -- Builder specialist
(2147483605, 'explorer_1', 'TestPlayerExplorer1', 0, 0), -- Explorer (independent)
(2147483604, 'explorer_2', 'TestPlayerExplorer2', 0, 0), -- Explorer (independent)

-- Military/Combat players
(2147483603, 'commander_1', 'TestPlayerCommander1', 1, 63), -- Military commander with permissions
(2147483602, 'commander_2', 'TestPlayerCommander2', 2, 63), -- Military commander with permissions
(2147483601, 'pilot_1', 'TestPlayerPilot1', 3, 0), -- Fighter pilot
(2147483600, 'pilot_2', 'TestPlayerPilot2', 4, 0), -- Fighter pilot
(2147483599, 'pilot_3', 'TestPlayerPilot3', 5, 0), -- Fighter pilot

-- Diplomatic players
(2147483598, 'diplomat_1', 'TestPlayerDiplomat1', 1, 144), -- Diplomatic permissions (relationship + news)
(2147483597, 'diplomat_2', 'TestPlayerDiplomat2', 2, 144), -- Diplomatic permissions (relationship + news)

-- Test accounts for various scenarios
(2147483596, 'test_user_1', 'TestUser1', 6, 0), -- Test account
(2147483595, 'test_user_2', 'TestUser2', 6, 0), -- Test account
(2147483594, 'inactive_user', 'TestInactiveUser', 0, 0), -- Inactive account
(2147483593, 'banned_user', 'TestBannedUser', 0, 0), -- Banned account simulation

-- Economic specialists
(2147483592, 'economist_1', 'TestPlayerEconomist1', 1, 0), -- Economic specialist
(2147483591, 'economist_2', 'TestPlayerEconomist2', 2, 0), -- Economic specialist
(2147483590, 'merchant_1', 'TestPlayerMerchant1', 3, 0), -- Merchant
(2147483589, 'merchant_2', 'TestPlayerMerchant2', 4, 0), -- Merchant

-- Research/Science players
(2147483588, 'scientist_1', 'TestPlayerScientist1', 6, 0), -- Research specialist
(2147483587, 'scientist_2', 'TestPlayerScientist2', 6, 0), -- Research specialist

-- Special characters in names (edge cases)
(2147483586, 'special_char_user', 'TestPlayer-Special_1', 1, 0), -- Special characters
(2147483585, 'unicode_user', 'TestPlayerUnicode1', 2, 0), -- Unicode support test

-- Cross-faction players (for testing relationships)
(2147483584, 'cross_faction_spy', 'TestPlayerSpy1', 1, 0), -- Potential spy
(2147483583, 'cross_faction_trader', 'TestPlayerCrossTrader1', 2, 0), -- Cross-faction trader

-- VIP/Premium players
(2147483582, 'vip_player_1', 'TestPlayerVIP1', 1, 31), -- VIP with special permissions
(2147483581, 'vip_player_2', 'TestPlayerVIP2', 2, 31), -- VIP with special permissions

-- MISSING PLAYERS FROM OTHER TABLES - CORRECTION
(2147483580, 'collector_1', 'TestPlayerCollector1', 3, 0), -- Collector referenced in trade-history
(2147483579, 'special_char_user_2', 'TestPlayerSpecial1', 4, 0); -- Special player for messages

-- =============================================================================
-- INSERT COMPLETE - 69 PLAYERS
-- =============================================================================
