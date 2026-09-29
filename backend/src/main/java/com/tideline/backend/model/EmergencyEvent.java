package com.tideline.backend.model;

/**
 * EmergencyEvent — domain model representing an offshore emergency or SOS distress signal.
 *
 * Maps to SQLite table: emergency_events
 *
 * Status values:
 * - LOCAL_ONLY: Stored on device/vessel only, not broadcast to rescue services.
 * - PENDING_TRANSMISSION: Queued for transmission via coastal satellite/VHF gateway.
 * - TRANSMITTED: Confirmed received and acknowledged by an external communications service.
 */
public class EmergencyEvent {

    private Long id;
    private String emergencyType;
    private Double latitude;
    private Double longitude;
    private String eventTime;
    private String message;
    private String status;
    private String createdAt;

    public EmergencyEvent() {
    }

    public EmergencyEvent(Long id, String emergencyType, Double latitude, Double longitude,
                          String eventTime, String message, String status, String createdAt) {
        this.id = id;
        this.emergencyType = emergencyType;
        this.latitude = latitude;
        this.longitude = longitude;
        this.eventTime = eventTime;
        this.message = message;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmergencyType() {
        return emergencyType;
    }

    public void setEmergencyType(String emergencyType) {
        this.emergencyType = emergencyType;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getEventTime() {
        return eventTime;
    }

    public void setEventTime(String eventTime) {
        this.eventTime = eventTime;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
