package com.tideline.backend.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.tideline.backend.model.MaintenanceRecord;
import com.tideline.backend.repository.MaintenanceRecordRepository;

@Service
public class MaintenanceRecordService {

    private final MaintenanceRecordRepository maintenanceRecordRepository;

    public MaintenanceRecordService(MaintenanceRecordRepository maintenanceRecordRepository) {
        this.maintenanceRecordRepository = maintenanceRecordRepository;
    }

    public List<MaintenanceRecord> getAllRecords() {
        return maintenanceRecordRepository.findAll();
    }

    public Optional<MaintenanceRecord> getRecordById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return maintenanceRecordRepository.findById(id);
    }

    public MaintenanceRecord createRecord(MaintenanceRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("MaintenanceRecord cannot be null");
        }

        // Set sensible defaults if fields are missing
        if (record.getVesselName() == null || record.getVesselName().isBlank()) {
            record.setVesselName("TIDELINE-01");
        }
        if (record.getEquipment() == null || record.getEquipment().isBlank()) {
            record.setEquipment("Main Engine");
        }
        if (record.getMaintenanceDate() == null || record.getMaintenanceDate().isBlank()) {
            record.setMaintenanceDate(LocalDate.now().toString());
        }
        if (record.getStatus() == null || record.getStatus().isBlank()) {
            record.setStatus("OK");
        }
        if (record.getCreatedAt() == null || record.getCreatedAt().isBlank()) {
            record.setCreatedAt(Instant.now().toString());
        }

        // Duplicate prevention: check if identical maintenance record was already saved
        Optional<MaintenanceRecord> existing = maintenanceRecordRepository.findExisting(
                record.getVesselName(),
                record.getEquipment(),
                record.getMaintenanceDate(),
                record.getCreatedAt()
        );
        if (existing.isPresent()) {
            return existing.get();
        }

        return maintenanceRecordRepository.save(record);
    }

    public boolean deleteRecord(Long id) {
        if (id == null) {
            return false;
        }
        return maintenanceRecordRepository.deleteById(id);
    }

    public boolean doesTableExist() {
        return maintenanceRecordRepository.doesTableExist();
    }
}
