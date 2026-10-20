package com.tideline.backend.model;

/**
 * StaffLocation — Entity representing the latest reported location of an authorized staff member / vessel.
 */
public class StaffLocation {

    private Long id;
    private Long userId;
    private String username;
    private String fullName;
    private String role;
    private Double latitude;
    private Double longitude;
    private Double accuracy;
    private Double speed;
    private Double heading;
    private String sharedAt;
    private String vesselName;
    private String statusNote;
    private String freshness; // "ACTIVE" (< 5m), "STALE" (< 30m), "OFFLINE" (>= 30m)

    public StaffLocation() {
    }

    public StaffLocation(Long id, Long userId, String username, String fullName, String role,
                         Double latitude, Double longitude, Double accuracy, Double speed,
                         Double heading, String sharedAt, String vesselName, String statusNote) {
        this.id = id;
        this.userId = userId;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.speed = speed;
        this.heading = heading;
        this.sharedAt = sharedAt;
        this.vesselName = vesselName;
        this.statusNote = statusNote;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
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

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public Double getSpeed() {
        return speed;
    }

    public void setSpeed(Double speed) {
        this.speed = speed;
    }

    public Double getHeading() {
        return heading;
    }

    public void setHeading(Double heading) {
        this.heading = heading;
    }

    public String getSharedAt() {
        return sharedAt;
    }

    public void setSharedAt(String sharedAt) {
        this.sharedAt = sharedAt;
    }

    public String getVesselName() {
        return vesselName;
    }

    public void setVesselName(String vesselName) {
        this.vesselName = vesselName;
    }

    public String getStatusNote() {
        return statusNote;
    }

    public void setStatusNote(String statusNote) {
        this.statusNote = statusNote;
    }

    public String getFreshness() {
        return freshness;
    }

    public void setFreshness(String freshness) {
        this.freshness = freshness;
    }
}
