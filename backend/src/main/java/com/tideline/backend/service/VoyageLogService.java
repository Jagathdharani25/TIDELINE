package com.tideline.backend.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.tideline.backend.model.VoyageLog;
import com.tideline.backend.repository.VoyageLogRepository;

@Service
public class VoyageLogService {

    private final VoyageLogRepository voyageLogRepository;

    public VoyageLogService(VoyageLogRepository voyageLogRepository) {
        this.voyageLogRepository = voyageLogRepository;
    }

    public List<VoyageLog> getAllVoyages() {
        return voyageLogRepository.findAll();
    }

    public Optional<VoyageLog> getVoyageById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return voyageLogRepository.findById(id);
    }

    public VoyageLog createVoyage(VoyageLog voyageLog) {
        if (voyageLog == null) {
            throw new IllegalArgumentException("VoyageLog cannot be null");
        }

        // Set sensible defaults if fields are missing
        if (voyageLog.getVoyageDate() == null || voyageLog.getVoyageDate().isBlank()) {
            voyageLog.setVoyageDate(LocalDate.now().toString());
        }
        if (voyageLog.getVesselName() == null || voyageLog.getVesselName().isBlank()) {
            voyageLog.setVesselName("TIDELINE-01");
        }
        if (voyageLog.getDeparture() == null || voyageLog.getDeparture().isBlank()) {
            voyageLog.setDeparture("Vizhinjam Harbour");
        }
        if (voyageLog.getDestination() == null || voyageLog.getDestination().isBlank()) {
            voyageLog.setDestination("Arabian Sea Sector 4");
        }
        if (voyageLog.getCreatedAt() == null || voyageLog.getCreatedAt().isBlank()) {
            voyageLog.setCreatedAt(Instant.now().toString());
        }

        // Duplicate prevention: check if identical voyage was already saved
        Optional<VoyageLog> existing = voyageLogRepository.findExisting(
                voyageLog.getDeparture(),
                voyageLog.getDestination(),
                voyageLog.getVoyageDate(),
                voyageLog.getVesselName(),
                voyageLog.getCreatedAt()
        );
        if (existing.isPresent()) {
            return existing.get();
        }

        return voyageLogRepository.save(voyageLog);
    }

    public boolean deleteVoyage(Long id) {
        if (id == null) {
            return false;
        }
        return voyageLogRepository.deleteById(id);
    }

    public boolean isTableInitialized() {
        return voyageLogRepository.doesTableExist();
    }
}
