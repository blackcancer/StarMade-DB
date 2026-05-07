-- =============================================================================
-- STARMADE DATABASE - MySQL Schema Creation Script (OFFICIAL DOCUMENTATION)
-- =============================================================================
-- Complete MySQL database schema for StarMade based on official table documentation
-- Source: docs/database/TABLE_*.md files
-- Compatible with phpMyAdmin and standard MySQL 8.0+
-- 
-- Author: InitSysRev
-- Version: 2.0.0 - Based on official documentation
-- Date: 2025-01-25
-- =============================================================================

-- Create database
DROP DATABASE IF EXISTS starmade_db;
CREATE DATABASE starmade_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE starmade_db;

-- =============================================================================
-- 1. ID_GEN_TABLE - ID Generation Tracking
-- =============================================================================
CREATE TABLE ID_GEN_TABLE (
    ID VARCHAR(128) NOT NULL PRIMARY KEY COMMENT 'Sequence name',
    ID_GEN BIGINT NOT NULL COMMENT 'Next available ID value'
) ENGINE=InnoDB COMMENT='ID generation tracking for various game systems';

-- =============================================================================
-- 2. PLAYERS - Player accounts and profiles
-- =============================================================================
CREATE TABLE PLAYERS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Player unique identifier',
    NAME VARCHAR(512) NOT NULL COMMENT 'Login username',
    STARMADE_NAME VARCHAR(512) NOT NULL COMMENT 'Display name in-game',
    FACTION INTEGER NOT NULL DEFAULT 0 COMMENT 'Current faction affiliation',
    PERMISSION BIGINT NOT NULL DEFAULT 0 COMMENT 'Permission bitmask for rights',
    
    INDEX PLAYERS_NAME (NAME),
    INDEX PLAYERS_SM_NAME (STARMADE_NAME)
) ENGINE=InnoDB COMMENT='Player accounts and character data';

-- =============================================================================
-- 3. SYSTEMS - Star systems and cosmic structures
-- =============================================================================
CREATE TABLE SYSTEMS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'System identifier',
    X INTEGER NOT NULL COMMENT 'System grid X coordinate',
    Y INTEGER NOT NULL COMMENT 'System grid Y coordinate', 
    Z INTEGER NOT NULL COMMENT 'System grid Z coordinate',
    TYPE INTEGER NOT NULL COMMENT 'System classification',
    STARTTIME BIGINT NULL COMMENT 'Generation timestamp',
    NAME VARCHAR(64) NULL COMMENT 'System name',
    INFOS VARBINARY(8192) NOT NULL COMMENT 'Additional system data',
    OWNER_UID VARCHAR(128) NULL COMMENT 'Controlling entity UID',
    OWNER_FACTION INTEGER NOT NULL DEFAULT 0 COMMENT 'Controlling faction',
    OWNER_X INTEGER NOT NULL DEFAULT 0 COMMENT 'Owner home X coordinate',
    OWNER_Y INTEGER NOT NULL DEFAULT 0 COMMENT 'Owner home Y coordinate',
    OWNER_Z INTEGER NOT NULL DEFAULT 0 COMMENT 'Owner home Z coordinate',
    RESOURCES VARBINARY(16) NOT NULL COMMENT 'Resource richness distribution',
    
    UNIQUE KEY sysCoordIndex (X, Y, Z),
    INDEX sysOwnFacIndex (OWNER_FACTION),
    INDEX sysOwnUIDIndex (OWNER_UID)
) ENGINE=InnoDB COMMENT='Star systems and galactic coordinates';

-- =============================================================================
-- 4. SECTORS - Individual sectors within systems
-- =============================================================================
CREATE TABLE SECTORS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Sector identifier',
    X INTEGER NOT NULL COMMENT 'Sector grid X coordinate',
    Y INTEGER NOT NULL COMMENT 'Sector grid Y coordinate',
    Z INTEGER NOT NULL COMMENT 'Sector grid Z coordinate',
    TYPE INTEGER NOT NULL COMMENT 'Sector classification',
    NAME VARCHAR(64) NOT NULL COMMENT 'Sector designation',
    ITEMS BIGINT NOT NULL COMMENT 'Reference to SECTORS_ITEMS',
    PROTECTION INTEGER NOT NULL COMMENT 'Protection level flags',
    STELLAR BIGINT NOT NULL COMMENT 'System identifier',
    TRANSIENT BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Auto-unload when empty',
    LAST_REPLENISHED BIGINT NOT NULL DEFAULT 0 COMMENT 'Resource refresh timestamp',
    
    INDEX secStellarIndex (STELLAR),
    INDEX secTypeIndex (TYPE),
    FOREIGN KEY fk_sectors_stellar (STELLAR) REFERENCES SYSTEMS(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Individual sectors in space';

-- =============================================================================
-- 5. ENTITIES - All game entities (ships, stations, asteroids, etc.)
-- =============================================================================
CREATE TABLE ENTITIES (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal surrogate key',
    UID VARCHAR(128) NOT NULL UNIQUE COMMENT 'External persistent identifier',
    X INTEGER NOT NULL DEFAULT 0 COMMENT 'Sector X coordinate',
    Y INTEGER NOT NULL DEFAULT 0 COMMENT 'Sector Y coordinate',
    Z INTEGER NOT NULL DEFAULT 0 COMMENT 'Sector Z coordinate',
    TYPE TINYINT NOT NULL DEFAULT 0 COMMENT 'Entity type',
    NAME CHAR(64) NULL COMMENT 'Display name of the entity',
    FACTION INTEGER NULL DEFAULT 0 COMMENT 'Owning faction ID',
    CREATOR VARCHAR(64) NULL COMMENT 'Creation author',
    LAST_MOD VARCHAR(64) NULL COMMENT 'Most recent modifying author',
    SEED BIGINT NULL COMMENT 'Procedural generation seed',
    TOUCHED BOOLEAN NULL COMMENT 'Whether visited/loaded since generation',
    LOCAL_POS TEXT NULL COMMENT 'Coordinate within the sector where the entity stand',
    DIM TEXT NULL COMMENT 'Dimensions of the entity bounding box',
    GEN_ID INTEGER NULL COMMENT 'Internal build version',
    DOCKED_TO BIGINT NULL DEFAULT -1 COMMENT 'Parent entity ID if docked (-1 if not docked)',
    DOCKED_ROOT BIGINT NULL DEFAULT -1 COMMENT 'Root of docking chain (-1 if not docked)',
    SPAWNED_ONLY_IN_DB BOOLEAN NULL DEFAULT FALSE COMMENT 'Present only in DB, not yet spawned',
    TRACKED BOOLEAN NULL DEFAULT FALSE COMMENT 'Marked for tracking by server tools',
    
    INDEX uidType (UID, TYPE),
    INDEX ENTITIES_PK (UID),
    INDEX coordX (X),
    INDEX coordY (Y),
    INDEX coordZ (Z),
    INDEX coordIndex (X, Y, Z),
    INDEX coordIndexDT (X, Y, Z, DOCKED_TO),
    INDEX typeIndex (TYPE),
    INDEX dockedToIndex (DOCKED_TO),
    INDEX dockedRootIndex (DOCKED_ROOT),
    INDEX idx_entities_name (NAME)
) ENGINE=InnoDB COMMENT='All game entities including ships, stations, and objects';

-- =============================================================================
-- 6. FLEETS - Fleet command structures
-- =============================================================================
CREATE TABLE FLEETS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Fleet identifier',
    FLAGSHIP_ID BIGINT NOT NULL COMMENT 'Leading entity ID',
    PARENT_FLEET BIGINT NULL DEFAULT -1 COMMENT 'Parent fleet for hierarchies',
    NAME VARCHAR(128) NULL COMMENT 'Fleet designation',
    OWNER VARCHAR(128) NULL COMMENT 'Controlling player UID',
    MISSION_STRING VARCHAR(1024) NULL COMMENT 'High-level mission description',
    COMMAND VARBINARY(1024) NULL COMMENT 'Serialized command data',
    FACTION_ACCESS TINYINT NULL DEFAULT 0 COMMENT 'Access permission level bitmask',
    SAVED_REMOTES VARBINARY(1024) NULL COMMENT 'Serialized NBT remote data',
    COMBAT_SETTING VARCHAR(128) NULL COMMENT 'Combat behavior preset',
    
    INDEX fin (FLAGSHIP_ID),
    INDEX oin (OWNER),
    INDEX finp (PARENT_FLEET),
    FOREIGN KEY fk_fleets_flagship (FLAGSHIP_ID) REFERENCES ENTITIES(ID) ON DELETE CASCADE,
    FOREIGN KEY fk_fleets_parent (PARENT_FLEET) REFERENCES FLEETS(ID) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Fleet command and control structures';

-- =============================================================================
-- 7. FLEET_MEMBERS - Fleet composition and member relationships
-- =============================================================================
CREATE TABLE FLEET_MEMBERS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Member record ID',
    FLEET_ID BIGINT NOT NULL COMMENT 'Parent fleet',
    ENTITY_ID BIGINT NOT NULL COMMENT 'Member entity',
    MISSION_STRING VARCHAR(1024) NULL COMMENT 'Individual member mission',
    LIST_INDEX INTEGER NOT NULL COMMENT 'Position in fleet',
    DOCKED_TO BIGINT NOT NULL COMMENT 'ID of entity docked to',
    FACTION INTEGER NOT NULL DEFAULT 0 COMMENT 'Faction ID',
    
    UNIQUE KEY ffeid (ENTITY_ID, FLEET_ID),
    INDEX ffid (FLEET_ID),
    INDEX eid (ENTITY_ID),
    INDEX idx_fleet_members_list_index (LIST_INDEX),
    FOREIGN KEY fk_fleet_members_fleet (FLEET_ID) REFERENCES FLEETS(ID) ON DELETE CASCADE,
    FOREIGN KEY fk_fleet_members_entity (ENTITY_ID) REFERENCES ENTITIES(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Fleet membership and composition data';

-- =============================================================================
-- 8. EFFECTS - Entity effects and status conditions
-- =============================================================================
CREATE TABLE EFFECTS (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Effect instance ID',
    ENTITY_ID BIGINT NOT NULL COMMENT 'Affected entity',
    TYPE TINYINT NOT NULL COMMENT 'Effect category',
    EFFECT_UID VARCHAR(128) NULL COMMENT 'Specific effect identifier',
    
    INDEX EFFECTS_PK (ENTITY_ID),
    INDEX EFFECTS_TYPE (TYPE),
    INDEX EFFECTS_UIDK (EFFECT_UID),
    INDEX EFFECTS_TYPE_ENT (TYPE, EFFECT_UID),
    FOREIGN KEY fk_effects_entity (ENTITY_ID) REFERENCES ENTITIES(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Entity effects and status conditions';

-- =============================================================================
-- 9. FTL - Faster-than-light travel records
-- =============================================================================
CREATE TABLE FTL (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Jump record ID',
    FROM_X INTEGER NOT NULL COMMENT 'Origin sector X coordinate',
    FROM_Y INTEGER NOT NULL COMMENT 'Origin sector Y coordinate',
    FROM_Z INTEGER NOT NULL COMMENT 'Origin sector Z coordinate',
    FROM_X_LOC INTEGER NOT NULL COMMENT 'Origin local X position (always 0)',
    FROM_Y_LOC INTEGER NOT NULL COMMENT 'Origin local Y position (always 0)',
    FROM_Z_LOC INTEGER NOT NULL COMMENT 'Origin local Z position (always 0)',
    FROM_UID VARCHAR(128) NOT NULL COMMENT 'Origin entity UID',
    TO_X INTEGER NOT NULL COMMENT 'Destination sector X coordinate',
    TO_Y INTEGER NOT NULL COMMENT 'Destination sector Y coordinate',
    TO_Z INTEGER NOT NULL COMMENT 'Destination sector Z coordinate',
    TO_X_LOC INTEGER NOT NULL DEFAULT 0 COMMENT 'Destination local X position',
    TO_Y_LOC INTEGER NOT NULL DEFAULT 0 COMMENT 'Destination local Y position',
    TO_Z_LOC INTEGER NOT NULL DEFAULT 0 COMMENT 'Destination local Z position',
    TO_UID VARCHAR(128) NOT NULL COMMENT 'Destination entity UID',
    TYPE INTEGER NOT NULL COMMENT 'Jump type',
    PERMISSION INTEGER NOT NULL COMMENT 'Access control flags',
    
    INDEX fromFTLIndLoc (FROM_UID, FROM_X_LOC, FROM_Y_LOC, FROM_Z_LOC),
    INDEX fromFTLInd (FROM_X, FROM_Y, FROM_Z),
    INDEX fromUIDFTLInd (FROM_UID, FROM_X, FROM_Y, FROM_Z),
    INDEX toFTLInd (TO_X, TO_Y, TO_Z),
    INDEX fromFTLUID (FROM_UID),
    INDEX toFTLUID (TO_UID),
    INDEX typeFTL (TYPE),
    INDEX permissionFTL (PERMISSION)
) ENGINE=InnoDB COMMENT='FTL jump logs and travel history';

-- =============================================================================
-- 10. VISIBILITY - Entity visibility and detection data
-- =============================================================================
CREATE TABLE VISIBILITY (
    ID BIGINT NULL COMMENT 'Observer ID (player/faction)',
    X INTEGER NOT NULL COMMENT 'Observed sector X coordinate',
    Y INTEGER NOT NULL COMMENT 'Observed sector Y coordinate',
    Z INTEGER NOT NULL COMMENT 'Observed sector Z coordinate',
    TIMESTAMP BIGINT NULL COMMENT 'First observation time',
    
    PRIMARY KEY (ID, X, Y, Z),
    INDEX vissetfull(ID, X, Y, Z),
    INDEX vispos (X, Y, Z),
    INDEX vists (TIMESTAMP)
) ENGINE=InnoDB COMMENT='Entity visibility and sensor detection data';

-- =============================================================================
-- 11. TRADE_NODES - Trading stations and market data
-- =============================================================================
CREATE TABLE TRADE_NODES (
    ID BIGINT NULL COMMENT 'Node identifier',
    SEC_X INTEGER NOT NULL COMMENT 'Station sector X location',
    SEC_Y INTEGER NOT NULL COMMENT 'Station sector Y location',
    SEC_Z INTEGER NOT NULL COMMENT 'Station sector Z location',
    PLAYER VARCHAR(128) NOT NULL COMMENT 'Owner player name',
    STATION_NAME VARCHAR(128) NOT NULL COMMENT 'Market display name',
    FACTION INTEGER NOT NULL COMMENT 'Faction identifier',
    PERMISSION BIGINT NOT NULL DEFAULT 15 COMMENT 'Trade permission mask',
    ITEMS VARBINARY(73732) NOT NULL COMMENT 'Zipped serialized NBT items with types, amounts, prices, limits',
    VOLUME DOUBLE NOT NULL COMMENT 'Current cargo volume',
    CAPACITY DOUBLE NOT NULL COMMENT 'Maximum capacity',
    CREDITS BIGINT NOT NULL COMMENT 'Available credits',
    
    PRIMARY KEY (ID),
    INDEX facIndex (FACTION),
    INDEX playerIndex (PLAYER),
    INDEX trSysCoordIndex (SEC_X, SEC_Y, SEC_Z),
    INDEX idx_trade_nodes_station (STATION_NAME),
    FOREIGN KEY fk_trade_nodes_entity (ID) REFERENCES ENTITIES(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Trading stations and market nodes';

-- =============================================================================
-- 12. TRADE_HISTORY - Trade transaction logs (UNUSED)
-- =============================================================================
CREATE TABLE TRADE_HISTORY (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Transaction ID',
    FROM_ID BIGINT NOT NULL COMMENT 'Source node ID',
    TO_ID BIGINT NOT NULL COMMENT 'Destination node ID',
    FROM_OWNER VARCHAR(128) NOT NULL COMMENT 'Source owner UID',
    TO_OWNER VARCHAR(128) NOT NULL COMMENT 'Destination owner UID',
    FROM_FACTION_ID INTEGER NOT NULL COMMENT 'Source faction',
    TO_FACTION_ID INTEGER NOT NULL COMMENT 'Destination faction',
    TOTAL_COST BIGINT NOT NULL COMMENT 'Transaction value',
    DELIVERY_COST BIGINT NOT NULL COMMENT 'Shipping fee',
    SENT BIGINT NOT NULL COMMENT 'Dispatch timestamp',
    RECEIVED BIGINT NOT NULL COMMENT 'Delivery timestamp',
    VOLUME DOUBLE NOT NULL COMMENT 'Cargo volume',
    SUCCESS BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Completion status',
    
    INDEX frFacTr (FROM_FACTION_ID),
    INDEX toFacTr (TO_FACTION_ID),
    INDEX fromIniTr (FROM_OWNER),
    INDEX toIniTr (TO_OWNER),
    INDEX timeConstT (SENT),
    INDEX timeConstEET (RECEIVED),
    INDEX sucCon (SUCCESS),
    FOREIGN KEY frTr (FROM_ID) REFERENCES TRADE_NODES(ID) ON DELETE CASCADE,
    FOREIGN KEY toTr (TO_ID) REFERENCES TRADE_NODES(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Trade transaction history and logs (UNUSED)';

-- =============================================================================
-- 13. PLAYER_MESSAGES - Player communication system
-- =============================================================================
CREATE TABLE PLAYER_MESSAGES (
    ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Message ID',
    SENDER VARCHAR(64) NOT NULL COMMENT 'Sender player UID',
    RECEIVER VARCHAR(64) NOT NULL COMMENT 'Recipient player UID',
    TOPIC VARCHAR(128) NOT NULL COMMENT 'Message subject',
    MESSAGE VARCHAR(1024) NOT NULL COMMENT 'Message body content',
    SENT BIGINT NOT NULL COMMENT 'Timestamp (epoch milliseconds)',
    `READ` BOOLEAN NULL DEFAULT FALSE COMMENT 'Read status flag',
    ATT_ID BIGINT NULL COMMENT 'Attached entity ID (gifts/items)',
    
    INDEX i0 (SENDER),
    INDEX i1 (RECEIVER),
    INDEX i2 (SENT),
    INDEX i3 (`READ`),
    INDEX i4 (SENDER, RECEIVER),
    INDEX i5 (SENDER, RECEIVER, SENT)
) ENGINE=InnoDB COMMENT='Player messaging and communication system';

-- =============================================================================
-- 14. SECTORS_ITEMS - Items floating in space sectors
-- =============================================================================
CREATE TABLE SECTORS_ITEMS (
    ID BIGINT NOT NULL PRIMARY KEY COMMENT 'Sector reference',
    ITEMS VARBINARY(22528) NOT NULL COMMENT 'Serialized item stack data (22 bytes per stack max 22528 bytes)',
    
    FOREIGN KEY fk_sectors_items_sector (ID) REFERENCES SECTORS(ID) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Items floating freely in space sectors';

-- =============================================================================
-- 15. MINES - Mining operations and resource extraction
-- =============================================================================
CREATE TABLE MINES (
    ID INTEGER AUTO_INCREMENT PRIMARY KEY COMMENT 'Mine identifier',
    OWNER BIGINT NOT NULL COMMENT 'Deploying player ID',
    FACTION INTEGER NOT NULL DEFAULT 0 COMMENT 'Owner\'s faction',
    HP SMALLINT NOT NULL COMMENT 'Mine durability',
    COMPOSITION TEXT NOT NULL COMMENT 'Component materials (Array as JSON)',
    SECTOR_X INTEGER NOT NULL COMMENT 'Deployment sector X',
    SECTOR_Y INTEGER NOT NULL COMMENT 'Deployment sector Y',
    SECTOR_Z INTEGER NOT NULL COMMENT 'Deployment sector Z',
    LOCAL_X DOUBLE NOT NULL COMMENT 'Local X coordinate',
    LOCAL_Y DOUBLE NOT NULL COMMENT 'Local Y coordinate',
    LOCAL_Z DOUBLE NOT NULL COMMENT 'Local Z coordinate',
    CREATION_DATE BIGINT NOT NULL COMMENT 'Deployment timestamp',
    ARMED BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Activation status',
    ARMED_IN_SECS INTEGER NOT NULL DEFAULT -1 COMMENT 'Arming countdown',
    AMMO SMALLINT NOT NULL DEFAULT -2 COMMENT 'Remaining triggers',
    
    INDEX IN_OWNER (OWNER),
    INDEX IN_FACTION (FACTION),
    INDEX IN_SECTOR (SECTOR_X, SECTOR_Y, SECTOR_Z),
    INDEX IN_CREATION (CREATION_DATE),
    INDEX IN_ARMED (ARMED),
    INDEX IN_ARMED_OWNER (OWNER, ARMED),
    INDEX IN_ARMED_OWNER_SEC (OWNER, SECTOR_X, SECTOR_Y, SECTOR_Z, ARMED)
) ENGINE=InnoDB COMMENT='Mining operations and resource extraction points';

-- =============================================================================
-- 16. NPC_STATS - NPC faction statistics and behavior data
-- =============================================================================
CREATE TABLE NPC_STATS (
    ID INTEGER NULL COMMENT 'Placeholder (-10000000)',
    SYS_X INTEGER NOT NULL COMMENT 'System X coordinate',
    SYS_Y INTEGER NOT NULL COMMENT 'System Y coordinate',
    SYS_Z INTEGER NOT NULL COMMENT 'System Z coordinate',
    FLEET_SPAWNS INTEGER NULL DEFAULT 0 COMMENT 'Fleet spawn count',
    ENTITY_SPAWNS INTEGER NULL DEFAULT 0 COMMENT 'Entity spawn count',
    
    PRIMARY KEY (ID, SYS_X, SYS_Y, SYS_Z)
) ENGINE=InnoDB COMMENT='NPC faction statistics and behavioral data';

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================
SELECT 'StarMade MySQL Database Schema Created Successfully!' as status,
       'All 16 tables created based on official documentation' as details,
       'Ready for phpMyAdmin data management and export' as note;