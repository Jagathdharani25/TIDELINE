package com.tideline.backend.model;

/**
 * MaintenanceRecord — domain model representing an equipment maintenance entry stored in SQLite.
 *
 * Maps to the SQLite table: maintenance_records
 */
public class MaintenanceRecord {

    private Long id;
    private String vesselName;
    private String equipment;
    private String maintenanceDate;
    private String nextServiceDate;
    private String status;
    private String notes;
    private String createdAt;

    public MaintenanceRecord() {
    }

    public MaintenanceRecord(Long id, String vesselName, String equipment, String maintenanceDate,
                             String nextServiceDate, String status, String notes, String createdAt) {
        this.id = id;
        this.vesselName = vesselName;
        this.equipment = equipment;
        this.maintenanceDate = maintenanceDate;
        this.nextServiceDate = nextServiceDate;
        this.status = status;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getVesselName() {
        return vesselName;
    }

    public void setVesselName(String vesselName) {
        this.vesselName = vesselName;
    }

    public String getEquipment() {
        return equipment;
    }

    public void setEquipment(String equipment) {
        this.equipment = equipment;
    }

    public String getMaintenanceDate() {
        return maintenanceDate;
    }

    public void setMaintenanceDate(String maintenanceDate) {
        this.maintenanceDate = maintenanceDate;
    }

    public String getNextServiceDate() {
        return nextServiceDate;
    }

    public void setNextServiceDate(String nextServiceDate) {
        this.nextServiceDate = nextServiceDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
