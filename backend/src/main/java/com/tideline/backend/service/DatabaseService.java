package com.tideline.backend.service;

import java.io.File;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * DatabaseService — manages SQLite local database initialization,
 * schema migration for voyage_logs, and health probes.
 */
@Service
public class DatabaseService {

    private static final Logger log = LoggerFactory.getLogger(DatabaseService.class);

    private final DataSource dataSource;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    public DatabaseService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // ------------------------------------------------------------------
    // Startup hook — runs after Spring context is fully initialised
    // ------------------------------------------------------------------
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        ensureDataDirectory();

        log.info("=== TIDELINE SQLite Initialisation ===");
        log.info("DataSource URL  : {}", datasourceUrl);

        try (Connection conn = dataSource.getConnection()) {
            String product = conn.getMetaData().getDatabaseProductName();
            String version = conn.getMetaData().getDatabaseProductVersion();
            log.info("Connected to    : {} v{}", product, version);
            log.info("DB file path    : {}", resolveDatabasePath());
            log.info("SQLite status   : CONNECTED");

            initSchema(conn);
        } catch (SQLException ex) {
            log.error("SQLite connection or schema initialisation FAILED on startup: {}", ex.getMessage());
        }
    }

    /**
     * Creates essential SQLite tables if they do not yet exist.
     */
    public void initSchema(Connection conn) throws SQLException {
        // Enable WAL mode and busy_timeout to handle OneDrive sync interference
        try (Statement pragmaStmt = conn.createStatement()) {
            pragmaStmt.execute("PRAGMA journal_mode=WAL");
            pragmaStmt.execute("PRAGMA busy_timeout=5000");
            log.info("SQLite pragmas   : journal_mode=WAL, busy_timeout=5000ms");
        }

        String createVoyageLogsSql = """
            CREATE TABLE IF NOT EXISTS voyage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voyage_date TEXT NOT NULL,
                departure TEXT NOT NULL,
                destination TEXT NOT NULL,
                vessel_name TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            );
        """;

        String createMaintenanceRecordsSql = """
            CREATE TABLE IF NOT EXISTS maintenance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vessel_name TEXT NOT NULL,
                equipment TEXT NOT NULL,
                maintenance_date TEXT NOT NULL,
                next_service_date TEXT,
                status TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            );
        """;

        String createEmergencyEventsSql = """
            CREATE TABLE IF NOT EXISTS emergency_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emergency_type TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                event_time TEXT NOT NULL,
                message TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """;

        String createStaffUsersSql = """
            CREATE TABLE IF NOT EXISTS staff_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                rank_title TEXT,
                created_at TEXT NOT NULL,
                last_login_at TEXT,
                active INTEGER NOT NULL DEFAULT 1
            );
        """;

        String createStaffSessionsSql = """
            CREATE TABLE IF NOT EXISTS staff_sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES staff_users(id)
            );
        """;

        String createStaffLocationsSql = """
            CREATE TABLE IF NOT EXISTS staff_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL,
                speed REAL,
                heading REAL,
                shared_at TEXT NOT NULL,
                vessel_name TEXT,
                status_note TEXT,
                FOREIGN KEY(user_id) REFERENCES staff_users(id)
            );
        """;

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(createVoyageLogsSql);
            log.info("Schema verified : table 'voyage_logs' is ready");
            stmt.execute(createMaintenanceRecordsSql);
            log.info("Schema verified : table 'maintenance_records' is ready");
            stmt.execute(createEmergencyEventsSql);
            log.info("Schema verified : table 'emergency_events' is ready");
            stmt.execute(createStaffUsersSql);
            log.info("Schema verified : table 'staff_users' is ready");
            stmt.execute(createStaffSessionsSql);
            log.info("Schema verified : table 'staff_sessions' is ready");
            stmt.execute(createStaffLocationsSql);
            log.info("Schema verified : table 'staff_locations' is ready");

            // Migration: add 'active' column if it doesn't exist (safe for existing DBs)
            try {
                stmt.execute("ALTER TABLE staff_users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
                log.info("Schema migration: added 'active' column to staff_users");
            } catch (Exception e) {
                // Column already exists — this is expected for fresh databases
                log.debug("Column 'active' already exists in staff_users (migration skipped)");
            }

            seedInitialStaffUsersIfEmpty(conn);
        }
    }

    private void seedInitialStaffUsersIfEmpty(Connection conn) {
        log.info("Ensuring required staff accounts exist (John Antony, Pazhiniyappan, Sanjana, Harsha)...");
        PasswordHasher hasher = new PasswordHasher();
        String now = java.time.Instant.now().toString();

        String[][] staffList = {
            {"John Antony", "John Antony", "ADMIN", "Chief Marine Officer & Watch Administrator", "STAFF_DOB_JOHN_ANTONY"},
            {"Pazhiniyappan", "Pazhiniyappan", "OFFICER", "Navigation Officer", "STAFF_DOB_PAZHINIYAPPAN"},
            {"Sanjana", "Sanjana", "OFFICER", "Search & Rescue Officer", "STAFF_DOB_SANJANA"},
            {"Harsha", "Harsha", "OFFICER", "Watch & Telemetry Officer", "STAFF_DOB_HARSHA"}
        };

        for (String[] staff : staffList) {
            String username = staff[0];
            String fullName = staff[1];
            String role = staff[2];
            String rank = staff[3];
            String envVar = staff[4];

            try {
                log.info("  Checking account: '{}'...", username);
                // Check if user already exists
                String checkSql = "SELECT id, password_hash FROM staff_users WHERE LOWER(username) = LOWER(?)";
                try (java.sql.PreparedStatement checkPs = conn.prepareStatement(checkSql)) {
                    checkPs.setString(1, username);
                    try (ResultSet rs = checkPs.executeQuery()) {
                        if (!rs.next()) {
                            // User does not exist, insert with PENDING_SETUP (no hashing at seed time)
                            String insertSql = "INSERT INTO staff_users (username, full_name, password_hash, role, rank_title, created_at) VALUES (?, ?, ?, ?, ?, ?)";
                            try (java.sql.PreparedStatement insertPs = conn.prepareStatement(insertSql)) {
                                insertPs.setString(1, username);
                                insertPs.setString(2, fullName);
                                insertPs.setString(3, "PENDING_SETUP");
                                insertPs.setString(4, role);
                                insertPs.setString(5, rank);
                                insertPs.setString(6, now);
                                insertPs.executeUpdate();
                                log.info("  Created staff account for '{}' ({})", username, role);
                            }
                        } else {
                            log.info("  Account '{}' already exists, skipping", username);
                        }
                    }
                }
            } catch (SQLException ex) {
                log.error("Failed to ensure staff account '{}': {}", username, ex.getMessage());
            }
        }
    }

    // ------------------------------------------------------------------
    // Public status check — called by DatabaseController
    // ------------------------------------------------------------------
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("database", "SQLite");
        status.put("location", resolveDatabasePath());

        try (Connection conn = dataSource.getConnection()) {
            String product = conn.getMetaData().getDatabaseProductName();
            String version = conn.getMetaData().getDatabaseProductVersion();
            boolean fileExists = new File(resolveDatabasePath()).exists();

            status.put("status", "CONNECTED");
            status.put("engine", product);
            status.put("version", version);
            status.put("fileExists", fileExists);
            status.put("connectionOk", true);

            // Query existing user tables
            List<String> tables = new ArrayList<>();
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
                while (rs.next()) {
                    tables.add(rs.getString("name"));
                }
            }
            status.put("tables", tables);

        } catch (SQLException ex) {
            status.put("status", "ERROR");
            status.put("connectionOk", false);
            status.put("error", ex.getMessage());
        }

        return status;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Checks whether a specific table exists in the SQLite database.
     */
    public boolean doesTableExist(String tableName) {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='" + tableName + "'")) {
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
        } catch (SQLException ex) {
            log.error("Failed to check if table {} exists: {}", tableName, ex.getMessage());
        }
        return false;
    }

    private void ensureDataDirectory() {
        File dataDir = new File("./data");
        if (!dataDir.exists()) {
            boolean created = dataDir.mkdirs();
            if (created) {
                log.info("Created data directory: {}", dataDir.getAbsolutePath());
            }
        }
    }

    private String resolveDatabasePath() {
        String filePart = datasourceUrl.replace("jdbc:sqlite:", "");
        return new File(filePart).getAbsolutePath();
    }
}
