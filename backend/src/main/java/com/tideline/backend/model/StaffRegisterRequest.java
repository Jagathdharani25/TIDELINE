package com.tideline.backend.model;

/**
 * StaffRegisterRequest — Payload for registering a new staff account.
 */
public class StaffRegisterRequest {

    private String username;
    private String password;
    private String fullName;
    private String role; // 'OFFICER' or 'ADMIN'
    private String rankTitle;

    public StaffRegisterRequest() {
    }

    public StaffRegisterRequest(String username, String password, String fullName, String role, String rankTitle) {
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.role = role;
        this.rankTitle = rankTitle;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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

    public String getRankTitle() {
        return rankTitle;
    }

    public void setRankTitle(String rankTitle) {
        this.rankTitle = rankTitle;
    }
}
