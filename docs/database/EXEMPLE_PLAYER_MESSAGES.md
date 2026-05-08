# PLAYER_MESSAGES - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the PLAYER_MESSAGES table.**

---

## Basic Message Queries

### Find messages by sender or receiver
```sql
-- Search messages sent by a specific player
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.read, pm.ATT_ID
FROM PLAYER_MESSAGES pm
WHERE pm.SENDER = ?
ORDER BY pm.SENT DESC;
```

```sql
-- Search messages received by a specific player
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.read, pm.ATT_ID
FROM PLAYER_MESSAGES pm
WHERE pm.RECEIVER = ?
ORDER BY pm.SENT DESC;
```

```sql
-- Get unread messages for a player
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.ATT_ID
FROM PLAYER_MESSAGES pm
WHERE pm.RECEIVER = ?
  AND (pm.read = FALSE OR pm.read IS NULL)
ORDER BY pm.SENT DESC;
```

### Message conversations between players
```sql
-- Get conversation history between two players
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.read, pm.ATT_ID,
       CASE 
           WHEN pm.SENDER = ? THEN 'SENT'
           ELSE 'RECEIVED'
       END as direction
FROM PLAYER_MESSAGES pm
WHERE (pm.SENDER = ? AND pm.RECEIVER = ?)
   OR (pm.SENDER = ? AND pm.RECEIVER = ?)
ORDER BY pm.SENT DESC;
```

### Recent messages with timestamps
```sql
-- Messages from the last 24 hours
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.read,
       CASE 
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 3600) * 1000 THEN 'LAST_HOUR'
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 21600) * 1000 THEN 'LAST_6_HOURS'
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 43200) * 1000 THEN 'LAST_12_HOURS'
           ELSE 'LAST_24_HOURS'
       END as time_category
FROM PLAYER_MESSAGES pm
WHERE pm.SENT > (UNIX_TIMESTAMP() - 86400) * 1000
ORDER BY pm.SENT DESC;
```

---

## Communication Statistics

### Player communication activity
```sql
-- Top communicators by message count
SELECT pm.SENDER as player_uid,
       COUNT(*) as messages_sent,
       COUNT(DISTINCT pm.RECEIVER) as unique_recipients,
       COUNT(CASE WHEN pm.read = TRUE THEN 1 END) as messages_read,
       COUNT(CASE WHEN pm.ATT_ID IS NOT NULL THEN 1 END) as messages_with_attachments,
       MIN(pm.SENT) as first_message,
       MAX(pm.SENT) as last_message
FROM PLAYER_MESSAGES pm
GROUP BY pm.SENDER
ORDER BY messages_sent DESC
LIMIT 20;
```

```sql
-- Most active conversations
WITH conversation_pairs AS (
    SELECT 
        CASE WHEN pm.SENDER < pm.RECEIVER THEN pm.SENDER ELSE pm.RECEIVER END as player1,
        CASE WHEN pm.SENDER < pm.RECEIVER THEN pm.RECEIVER ELSE pm.SENDER END as player2,
        COUNT(*) as message_count,
        MIN(pm.SENT) as first_message,
        MAX(pm.SENT) as last_message,
        COUNT(CASE WHEN pm.read = TRUE THEN 1 END) as read_messages,
        COUNT(CASE WHEN pm.ATT_ID IS NOT NULL THEN 1 END) as attachments_exchanged
    FROM PLAYER_MESSAGES pm
    GROUP BY 
        CASE WHEN pm.SENDER < pm.RECEIVER THEN pm.SENDER ELSE pm.RECEIVER END,
        CASE WHEN pm.SENDER < pm.RECEIVER THEN pm.RECEIVER ELSE pm.SENDER END
)
SELECT cp.player1, cp.player2, cp.message_count, 
       cp.read_messages, cp.attachments_exchanged,
       CASE 
           WHEN cp.last_message > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'ACTIVE_TODAY'
           WHEN cp.last_message > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'ACTIVE_THIS_WEEK'
           WHEN cp.last_message > (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'ACTIVE_THIS_MONTH'
           ELSE 'INACTIVE'
       END as conversation_status
FROM conversation_pairs cp
WHERE cp.message_count > 5
ORDER BY cp.message_count DESC
LIMIT 50;
```

### Message flow analysis
```sql
-- Analyze message patterns by time
WITH hourly_messages AS (
    SELECT 
        HOUR(DATEADD('MILLISECOND', pm.SENT / 1000, TIMESTAMP '1970-01-01 00:00:00')) as message_hour,
        COUNT(*) as message_count,
        COUNT(DISTINCT pm.SENDER) as unique_senders,
        COUNT(DISTINCT pm.RECEIVER) as unique_receivers,
        AVG(LENGTH(pm.MESSAGE)) as avg_message_length
    FROM PLAYER_MESSAGES pm
    WHERE pm.SENT > (UNIX_TIMESTAMP() - 604800) * 1000  -- Last week
    GROUP BY HOUR(DATEADD('MILLISECOND', pm.SENT / 1000, TIMESTAMP '1970-01-01 00:00:00'))
)
SELECT hm.message_hour, hm.message_count, hm.unique_senders, hm.unique_receivers,
       ROUND(hm.avg_message_length, 2) as avg_message_length,
       CASE 
           WHEN hm.message_hour BETWEEN 0 AND 5 THEN 'NIGHT'
           WHEN hm.message_hour BETWEEN 6 AND 11 THEN 'MORNING'
           WHEN hm.message_hour BETWEEN 12 AND 17 THEN 'AFTERNOON'
           WHEN hm.message_hour BETWEEN 18 AND 23 THEN 'EVENING'
       END as time_period
FROM hourly_messages hm
ORDER BY hm.message_hour;
```

---

## Social Network Analysis

### Player communication networks
```sql
-- Identify communication clusters
WITH communication_edges AS (
    SELECT pm.SENDER, pm.RECEIVER, COUNT(*) as messages_exchanged
    FROM PLAYER_MESSAGES pm
    GROUP BY pm.SENDER, pm.RECEIVER
),
player_connections AS (
    SELECT 
        ce.SENDER as player,
        COUNT(DISTINCT ce.RECEIVER) as outgoing_connections,
        SUM(ce.messages_exchanged) as total_sent,
        0 as incoming_connections,
        0 as total_received
    FROM communication_edges ce
    GROUP BY ce.SENDER
    
    UNION ALL
    
    SELECT 
        ce.RECEIVER as player,
        0 as outgoing_connections,
        0 as total_sent,
        COUNT(DISTINCT ce.SENDER) as incoming_connections,
        SUM(ce.messages_exchanged) as total_received
    FROM communication_edges ce
    GROUP BY ce.RECEIVER
),
player_network_metrics AS (
    SELECT 
        pc.player,
        SUM(pc.outgoing_connections) as outgoing_connections,
        SUM(pc.incoming_connections) as incoming_connections,
        SUM(pc.total_sent) as total_sent,
        SUM(pc.total_received) as total_received
    FROM player_connections pc
    GROUP BY pc.player
)
SELECT 
    pnm.player,
    pnm.outgoing_connections,
    pnm.incoming_connections,
    pnm.outgoing_connections + pnm.incoming_connections as total_connections,
    pnm.total_sent,
    pnm.total_received,
    pnm.total_sent + pnm.total_received as total_messages,
    CASE 
        WHEN pnm.total_sent > pnm.total_received * 2 THEN 'BROADCASTER'
        WHEN pnm.total_received > pnm.total_sent * 2 THEN 'LISTENER'
        ELSE 'BALANCED'
    END as communication_style,
    CASE 
        WHEN (pnm.outgoing_connections + pnm.incoming_connections) >= 20 THEN 'HUB'
        WHEN (pnm.outgoing_connections + pnm.incoming_connections) >= 10 THEN 'WELL_CONNECTED'
        WHEN (pnm.outgoing_connections + pnm.incoming_connections) >= 5 THEN 'CONNECTED'
        WHEN (pnm.outgoing_connections + pnm.incoming_connections) >= 1 THEN 'ISOLATED'
        ELSE 'NO_CONNECTIONS'
    END as network_position
FROM player_network_metrics pnm
WHERE pnm.total_messages > 0
ORDER BY pnm.total_connections DESC, pnm.total_messages DESC
LIMIT 100;
```

### Message content analysis
```sql
-- Analyze message characteristics
SELECT 
    COUNT(*) as total_messages,
    AVG(LENGTH(pm.MESSAGE)) as avg_message_length,
    MIN(LENGTH(pm.MESSAGE)) as min_message_length,
    MAX(LENGTH(pm.MESSAGE)) as max_message_length,
    COUNT(CASE WHEN LENGTH(pm.MESSAGE) < 10 THEN 1 END) as very_short_messages,
    COUNT(CASE WHEN LENGTH(pm.MESSAGE) BETWEEN 10 AND 50 THEN 1 END) as short_messages,
    COUNT(CASE WHEN LENGTH(pm.MESSAGE) BETWEEN 51 AND 200 THEN 1 END) as medium_messages,
    COUNT(CASE WHEN LENGTH(pm.MESSAGE) > 200 THEN 1 END) as long_messages,
    COUNT(CASE WHEN pm.ATT_ID IS NOT NULL THEN 1 END) as messages_with_attachments,
    ROUND(COUNT(CASE WHEN pm.ATT_ID IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as attachment_percentage
FROM PLAYER_MESSAGES pm;
```

---

## Attachment Analysis

### Messages with attachments
```sql
-- Find all messages with attachments
SELECT pm.ID, pm.SENDER, pm.RECEIVER, pm.MESSAGE, pm.SENT, pm.ATT_ID,
       CASE 
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'TODAY'
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'THIS_WEEK'
           WHEN pm.SENT > (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'THIS_MONTH'
           ELSE 'OLDER'
       END as time_period
FROM PLAYER_MESSAGES pm
WHERE pm.ATT_ID IS NOT NULL
ORDER BY pm.SENT DESC
LIMIT 100;
```

```sql
-- Top gift senders and receivers
WITH gift_statistics AS (
    SELECT 
        pm.SENDER as player,
        COUNT(*) as gifts_sent,
        0 as gifts_received
    FROM PLAYER_MESSAGES pm
    WHERE pm.ATT_ID IS NOT NULL
    GROUP BY pm.SENDER
    
    UNION ALL
    
    SELECT 
        pm.RECEIVER as player,
        0 as gifts_sent,
        COUNT(*) as gifts_received
    FROM PLAYER_MESSAGES pm
    WHERE pm.ATT_ID IS NOT NULL
    GROUP BY pm.RECEIVER
)
SELECT 
    gs.player,
    SUM(gs.gifts_sent) as total_gifts_sent,
    SUM(gs.gifts_received) as total_gifts_received,
    SUM(gs.gifts_sent) + SUM(gs.gifts_received) as total_gift_activity,
    CASE 
        WHEN SUM(gs.gifts_sent) > SUM(gs.gifts_received) * 2 THEN 'GENEROUS'
        WHEN SUM(gs.gifts_received) > SUM(gs.gifts_sent) * 2 THEN 'RECEIVER'
        ELSE 'BALANCED'
    END as gift_behavior
FROM gift_statistics gs
GROUP BY gs.player
HAVING SUM(gs.gifts_sent) + SUM(gs.gifts_received) > 0
ORDER BY total_gift_activity DESC
LIMIT 50;
```

---

## Data Validation and Maintenance

### Message data integrity checks
```sql
-- Comprehensive data validation
WITH validation_checks AS (
    -- Check 1: Future timestamps
    SELECT 'FUTURE_TIMESTAMPS' as check_type, COUNT(*) as issues
    FROM PLAYER_MESSAGES pm
    WHERE pm.SENT > UNIX_TIMESTAMP() * 1000
    
    UNION ALL
    
    -- Check 2: Null or empty messages
    SELECT 'EMPTY_MESSAGES' as check_type, COUNT(*) as issues
    FROM PLAYER_MESSAGES pm
    WHERE pm.MESSAGE IS NULL OR TRIM(pm.MESSAGE) = ''
    
    UNION ALL
    
    -- Check 3: Self-messages
    SELECT 'SELF_MESSAGES' as check_type, COUNT(*) as issues
    FROM PLAYER_MESSAGES pm
    WHERE pm.SENDER = pm.RECEIVER
    
    UNION ALL
    
    -- Check 4: Invalid read status
    SELECT 'INVALID_READ_STATUS' as check_type, COUNT(*) as issues
    FROM PLAYER_MESSAGES pm
    WHERE pm.read NOT IN (TRUE, FALSE) AND pm.read IS NOT NULL
    
    UNION ALL
    
    -- Check 5: Very old unread messages
    SELECT 'OLD_UNREAD_MESSAGES' as check_type, COUNT(*) as issues
    FROM PLAYER_MESSAGES pm
    WHERE (pm.read = FALSE OR pm.read IS NULL)
      AND pm.SENT < (UNIX_TIMESTAMP() - 2592000) * 1000  -- Older than 30 days
)
SELECT 
    vc.check_type,
    vc.issues,
    CASE 
        WHEN vc.issues = 0 THEN 'PASS'
        WHEN vc.issues < 10 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM validation_checks vc
ORDER BY vc.issues DESC;
```

```sql
-- Storage and performance analysis
SELECT 
    'MESSAGE_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_messages,
    COUNT(DISTINCT SENDER) as unique_senders,
    COUNT(DISTINCT RECEIVER) as unique_receivers,
    COUNT(CASE WHEN read = TRUE THEN 1 END) as read_messages,
    COUNT(CASE WHEN read = FALSE OR read IS NULL THEN 1 END) as unread_messages,
    COUNT(CASE WHEN ATT_ID IS NOT NULL THEN 1 END) as messages_with_attachments,
    COUNT(CASE WHEN SENT > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 1 END) as recent_24h_messages
FROM PLAYER_MESSAGES;
```

---

## Reporting and Communication Intelligence

### Comprehensive communication report
```sql
-- Complete communication system report
SELECT 
    'COMMUNICATION_SYSTEM_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_messages,
    COUNT(DISTINCT SENDER) as unique_senders,
    COUNT(DISTINCT RECEIVER) as unique_receivers,
    COUNT(CASE WHEN read = TRUE THEN 1 END) as total_read_messages,
    COUNT(CASE WHEN ATT_ID IS NOT NULL THEN 1 END) as messages_with_attachments,
    MIN(SENT) as earliest_message_timestamp,
    MAX(SENT) as latest_message_timestamp,
    AVG(LENGTH(MESSAGE)) as avg_message_length,
    COUNT(CASE WHEN SENT > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 1 END) as messages_last_24h,
    COUNT(CASE WHEN SENT > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 1 END) as messages_last_week
FROM PLAYER_MESSAGES;
```

```sql
-- Top communicators summary
SELECT pm.SENDER as player_uid,
       COUNT(*) as messages_sent,
       COUNT(DISTINCT pm.RECEIVER) as unique_recipients,
       COUNT(CASE WHEN pm.ATT_ID IS NOT NULL THEN 1 END) as gifts_sent,
       AVG(LENGTH(pm.MESSAGE)) as avg_message_length,
       MIN(pm.SENT) as first_message,
       MAX(pm.SENT) as last_message
FROM PLAYER_MESSAGES pm
GROUP BY pm.SENDER
ORDER BY messages_sent DESC
LIMIT 20;
```

---

## Changelog

| Version | Date       | Author       | Description                                           |
|---------|------------|--------------|-------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of PLAYER_MESSAGES example queries   |

[INDEX](./INDEX.md) | [PLAYER_MESSAGES](./TABLE_PLAYER_MESSAGES.md)