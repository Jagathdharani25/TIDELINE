package com.tideline.backend.controller;

import java.net.URI;
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

import com.tideline.backend.model.VoyageLog;
import com.tideline.backend.service.VoyageLogService;

@RestController
@RequestMapping("/api/voyages")
public class VoyageLogController {

    private final VoyageLogService voyageLogService;

    public VoyageLogController(VoyageLogService voyageLogService) {
        this.voyageLogService = voyageLogService;
    }

    /**
     * GET /api/voyages
     * Retrieves all saved voyage logs from SQLite in descending order of ID.
     */
    @GetMapping
    public ResponseEntity<List<VoyageLog>> getAllVoyages() {
        List<VoyageLog> logs = voyageLogService.getAllVoyages();
        return ResponseEntity.ok(logs);
    }

    /**
     * GET /api/voyages/{id}
     * Retrieves a single voyage log by its integer ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<VoyageLog> getVoyageById(@PathVariable Long id) {
        return voyageLogService.getVoyageById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * POST /api/voyages
     * Accepts JSON payload and saves the new voyage log record into SQLite.
     */
    @PostMapping
    public ResponseEntity<VoyageLog> createVoyage(@RequestBody VoyageLog voyageLog) {
        VoyageLog saved = voyageLogService.createVoyage(voyageLog);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * DELETE /api/voyages/{id}
     * Removes a voyage log record from SQLite by ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVoyage(@PathVariable Long id) {
        boolean deleted = voyageLogService.deleteVoyage(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
