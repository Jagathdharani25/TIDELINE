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

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(createVoyageLogsSql);
            log.info("Schema verified : table 'voyage_logs' is ready");
            stmt.execute(createMaintenanceRecordsSql);
            log.info("Schema verified : table 'maintenance_records' is ready");
            stmt.execute(createEmergencyEventsSql);
            log.info("Schema verified : table 'emergency_events' is ready");
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
