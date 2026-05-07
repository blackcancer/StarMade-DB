import java.sql.*;
import java.io.*;
import java.nio.file.*;

public class ReloadEntities {
    public static void main(String[] args) throws Exception {
        String dbPath = args[0];
        String sqlFile = args[1];
        String url = "jdbc:hsqldb:file:" + dbPath + ";shutdown=true;hsqldb.lock_file=false;hsqldb.nio_data_file=false;hsqldb.write_delay=false";
        Class.forName("org.hsqldb.jdbc.JDBCDriver");
        try (Connection conn = DriverManager.getConnection(url, "SA", "")) {
            conn.setAutoCommit(true);
            String sql = new String(Files.readAllBytes(Paths.get(sqlFile)));
            String[] stmts = sql.split(";");
            int ok = 0, skip = 0;
            for (String stmt : stmts) {
                stmt = stmt.replaceAll("--[^\n]*", "").trim();
                if (stmt.isEmpty()) continue;
                try (Statement s = conn.createStatement()) { s.execute(stmt); ok++; }
                catch (SQLException e) {
                    String msg = e.getMessage();
                    if (!msg.contains("already exists") && !msg.contains("duplicate") && skip < 5)
                        System.out.println("ERR: " + msg.substring(0, Math.min(80, msg.length())));
                    skip++;
                }
            }
            System.out.println("Inserted: " + ok + ", Skipped: " + skip);
            try (Statement s = conn.createStatement();
                 ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM ENTITIES")) {
                rs.next(); System.out.println("ENTITIES: " + rs.getInt(1));
            }
        }
    }
}
