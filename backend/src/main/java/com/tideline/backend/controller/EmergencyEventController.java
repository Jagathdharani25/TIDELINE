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

import com.tideline.backend.model.EmergencyEvent;
import com.tideline.backend.service.EmergencyEventService;

@RestController
@RequestMapping("/api/emergencies")
public class EmergencyEventController {

    private final EmergencyEventService emergencyEventService;

    public EmergencyEventController(EmergencyEventService emergencyEventService) {
        this.emergencyEventService = emergencyEventService;
    }

    /**
     * GET /api/emergencies
     * Retrieves all emergency events from SQLite ordered by ID descending.
     */
    @GetMapping
    public ResponseEntity<List<EmergencyEvent>> getAllEvents() {
        List<EmergencyEvent> events = emergencyEventService.getAllEvents();
        return ResponseEntity.ok(events);
    }

    /**
     * GET /api/emergencies/{id}
     * Retrieves a single emergency event by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<EmergencyEvent> getEventById(@PathVariable Long id) {
        return emergencyEventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * POST /api/emergencies
     * Records an emergency distress event in SQLite.
     * Status is set to PENDING_TRANSMISSION or LOCAL_ONLY (never claims TRANSMITTED without comms confirmation).
     */
    @PostMapping
    public ResponseEntity<EmergencyEvent> createEvent(@RequestBody EmergencyEvent event) {
        EmergencyEvent saved = emergencyEventService.createEvent(event);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * DELETE /api/emergencies/{id}
     * Deletes / cancels an emergency event from SQLite.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        boolean deleted = emergencyEventService.deleteEvent(id);
        if (deleted) {
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
