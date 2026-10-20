package com.tideline.backend.model;

public class StaffUserDto {
    private Long id;
    private String username;
    private String fullName;
    private String role;
    private String rankTitle;
    private String createdAt;
    private String lastLoginAt;
    private boolean active;
    private boolean needsPasswordSetup;

    public StaffUserDto() {}

    public StaffUserDto(Long id, String username, String fullName, String role, String rankTitle,
                        String createdAt, String lastLoginAt) {
        this(id, username, fullName, role, rankTitle, createdAt, lastLoginAt, true, false);
    }

    public StaffUserDto(Long id, String username, String fullName, String role, String rankTitle,
                        String createdAt, String lastLoginAt, boolean active, boolean needsPasswordSetup) {
        this.id = id; this.username = username; this.fullName = fullName; this.role = role;
        this.rankTitle = rankTitle; this.createdAt = createdAt; this.lastLoginAt = lastLoginAt;
        this.active = active; this.needsPasswordSetup = needsPasswordSetup;
    }

    public static StaffUserDto fromEntity(StaffUser user) {
        if (user == null) return null;
        return new StaffUserDto(user.getId(), user.getUsername(), user.getFullName(), user.getRole(),
            user.getRankTitle(), user.getCreatedAt(), user.getLastLoginAt(), user.isActive(), user.isNeedsPasswordSetup());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getRankTitle() { return rankTitle; }
    public void setRankTitle(String rankTitle) { this.rankTitle = rankTitle; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(String lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isNeedsPasswordSetup() { return needsPasswordSetup; }
    public void setNeedsPasswordSetup(boolean v) { this.needsPasswordSetup = v; }
}