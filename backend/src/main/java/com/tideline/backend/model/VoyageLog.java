package com.tideline.backend.model;

import java.time.Instant;
import java.time.LocalDate;

/**
 * VoyageLog — domain model representing an offline voyage log record stored in SQLite.
 *
 * Maps to the SQLite table: voyage_logs
 */
public class VoyageLog {

    private Long id;
    private String voyageDate;
    private String departure;
    private String destination;
    private String vesselName;
    private String notes;
    private String createdAt;

    public VoyageLog() {
    }

    public VoyageLog(Long id, String voyageDate, String departure, String destination, String vesselName, String notes, String createdAt) {
        this.id = id;
        this.voyageDate = voyageDate;
        this.departure = departure;
        this.destination = destination;
        this.vesselName = vesselName;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getVoyageDate() {
        return voyageDate;
    }

    public void setVoyageDate(String voyageDate) {
        this.voyageDate = voyageDate;
    }

    public String getDeparture() {
        return departure;
    }

    public void setDeparture(String departure) {
        this.departure = departure;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public String getVesselName() {
        return vesselName;
    }

    public void setVesselName(String vesselName) {
        this.vesselName = vesselName;
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

    @Override
    public String toString() {
        return "VoyageLog{" +
                "id=" + id +
                ", voyageDate='" + voyageDate + '\'' +
                ", departure='" + departure + '\'' +
                ", destination='" + destination + '\'' +
                ", vesselName='" + vesselName + '\'' +
                ", notes='" + notes + '\'' +
                ", createdAt='" + createdAt + '\'' +
                '}';
    }
}
