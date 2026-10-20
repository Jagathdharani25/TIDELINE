package com.tideline.backend.model;

/**
 * StaffUser — Entity representing an authenticated marine staff member.
 */
public class StaffUser {

    private Long id;
    private String username;
    private String fullName;
    private String passwordHash;
    private String role; // 'OFFICER' or 'ADMIN'
    private String rankTitle;
    private String createdAt;
    private String lastLoginAt;
    private boolean active; // true = account is active, false = deactivated

    public StaffUser() {
    }

    public StaffUser(Long id, String username, String fullName, String passwordHash, String role, String rankTitle, String createdAt, String lastLoginAt) {
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.passwordHash = passwordHash;
        this.role = role;
        this.rankTitle = rankTitle;
        this.createdAt = createdAt;
        this.lastLoginAt = lastLoginAt;
        this.active = true;
    }

    public StaffUser(Long id, String username, String fullName, String passwordHash, String role, String rankTitle, String createdAt, String lastLoginAt, boolean active) {
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.passwordHash = passwordHash;
        this.role = role;
        this.rankTitle = rankTitle;
        this.createdAt = createdAt;
        this.lastLoginAt = lastLoginAt;
        this.active = active;
    }

    public StaffUser(String username, String fullName, String passwordHash, String role, String rankTitle, String createdAt) {
        this(null, username, fullName, passwordHash, role, rankTitle, createdAt, null, true);
    }

    /** Returns true if this account requires first-time password setup. */
    public boolean isNeedsPasswordSetup() {
        return "PENDING_SETUP".equals(passwordHash) || passwordHash == null || passwordHash.isBlank();
    }
    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getRankTitle() {
        return rankTitle;
    }

    public void setRankTitle(String rankTitle) {
        this.rankTitle = rankTitle;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(String lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
}
