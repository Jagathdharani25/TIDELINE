package com.tideline.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tideline.backend.model.MaintenanceRecord;
import com.tideline.backend.service.MaintenanceRecordService;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceRecordController {

    private final MaintenanceRecordService maintenanceRecordService;

    public MaintenanceRecordController(MaintenanceRecordService maintenanceRecordService) {
        this.maintenanceRecordService = maintenanceRecordService;
    }

    /**
     * GET /api/maintenance
     * Retrieves all maintenance records from SQLite ordered by ID descending.
     */
    @GetMapping
    public ResponseEntity<List<MaintenanceRecord>> getAllRecords() {
        List<MaintenanceRecord> records = maintenanceRecordService.getAllRecords();
        return ResponseEntity.ok(records);
    }

    /**
     * GET /api/maintenance/{id}
     * Retrieves a single maintenance record by its ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<MaintenanceRecord> getRecordById(@PathVariable Long id) {
        return maintenanceRecordService.getRecordById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * POST /api/maintenance
     * Creates a new maintenance record in SQLite.
     */
    @PostMapping
    public ResponseEntity<MaintenanceRecord> createRecord(@RequestBody MaintenanceRecord record) {
        MaintenanceRecord saved = maintenanceRecordService.createRecord(record);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * DELETE /api/maintenance/{id}
     * Deletes a maintenance record by ID from SQLite.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecord(@PathVariable Long id) {
        boolean deleted = maintenanceRecordService.deleteRecord(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
