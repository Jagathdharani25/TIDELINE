package com.tideline.backend.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tideline.backend.service.DatabaseService;

/**
 * DatabaseController — exposes the SQLite database connection status.
 *
 * Endpoint:
 *   GET /api/database/status
 *
 * Returns a JSON object describing whether the SQLite database is reachable,
 * the engine version, and the resolved file path on disk.
 */
@RestController
@RequestMapping("/api/database")
public class DatabaseController {

    private final DatabaseService databaseService;

    public DatabaseController(DatabaseService databaseService) {
        this.databaseService = databaseService;
    }

    /**
     * GET /api/database/status
     *
     * Example response when connected:
     * {
     *   "database":     "SQLite",
     *   "location":     "/abs/path/to/backend/data/tideline.db",
     *   "status":       "CONNECTED",
     *   "engine":       "SQLite",
     *   "version":      "3.46.1",
     *   "fileExists":   true,
     *   "connectionOk": true
     * }
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getDatabaseStatus() {
        Map<String, Object> status = databaseService.getStatus();

        // Return 200 if connected, 503 if the DB is unreachable
        boolean ok = Boolean.TRUE.equals(status.get("connectionOk"));
        return ok
                ? ResponseEntity.ok(status)
                : ResponseEntity.status(503).body(status);
    }
}
