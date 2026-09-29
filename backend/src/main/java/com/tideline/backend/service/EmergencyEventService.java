package com.tideline.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.tideline.backend.model.EmergencyEvent;
import com.tideline.backend.repository.EmergencyEventRepository;

@Service
public class EmergencyEventService {

    private final EmergencyEventRepository emergencyEventRepository;

    public EmergencyEventService(EmergencyEventRepository emergencyEventRepository) {
        this.emergencyEventRepository = emergencyEventRepository;
    }

    public List<EmergencyEvent> getAllEvents() {
        return emergencyEventRepository.findAll();
    }

    public Optional<EmergencyEvent> getEventById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return emergencyEventRepository.findById(id);
    }

    public EmergencyEvent createEvent(EmergencyEvent event) {
        if (event == null) {
            throw new IllegalArgumentException("EmergencyEvent cannot be null");
        }

        // Sensible defaults
        if (event.getEmergencyType() == null || event.getEmergencyType().isBlank()) {
            event.setEmergencyType("DISTRESS_SOS");
        }
        if (event.getEventTime() == null || event.getEventTime().isBlank()) {
            event.setEventTime(Instant.now().toString());
        }
        if (event.getCreatedAt() == null || event.getCreatedAt().isBlank()) {
            event.setCreatedAt(Instant.now().toString());
        }

        // Status rule: Default to PENDING_TRANSMISSION if not specified.
        // Never falsely claim TRANSMITTED unless explicitly provided with verified status.
        if (event.getStatus() == null || event.getStatus().isBlank()) {
            event.setStatus("PENDING_TRANSMISSION");
        }

        // Duplicate prevention: check if identical emergency event was already saved
        Optional<EmergencyEvent> existing = emergencyEventRepository.findExisting(
                event.getEmergencyType(),
                event.getEventTime(),
                event.getCreatedAt()
        );
        if (existing.isPresent()) {
            return existing.get();
        }

        return emergencyEventRepository.save(event);
    }

    public boolean deleteEvent(Long id) {
        if (id == null) {
            return false;
        }
        return emergencyEventRepository.deleteById(id);
    }

    public boolean doesTableExist() {
        return emergencyEventRepository.doesTableExist();
    }
}
