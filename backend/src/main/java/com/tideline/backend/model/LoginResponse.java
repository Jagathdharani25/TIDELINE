package com.tideline.backend.model;

public class LoginResponse {
    private boolean success;
    private String token;
    private StaffUserDto user;
    private String expiresAt;
    private String message;
    private boolean needsPasswordSetup;

    public LoginResponse() {}

    public LoginResponse(boolean success, String token, StaffUserDto user, String expiresAt, String message, boolean needsPasswordSetup) {
        this.success = success; this.token = token; this.user = user;
        this.expiresAt = expiresAt; this.message = message; this.needsPasswordSetup = needsPasswordSetup;
    }

    public static LoginResponse success(String token, StaffUserDto user, String expiresAt) {
        return new LoginResponse(true, token, user, expiresAt, "Authentication successful", false);
    }
    public static LoginResponse setupRequired(String token, StaffUserDto user, String expiresAt) {
        return new LoginResponse(true, token, user, expiresAt, "Password setup required", true);
    }
    public static LoginResponse error(String message) {
        return new LoginResponse(false, null, null, null, message, false);
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public StaffUserDto getUser() { return user; }
    public void setUser(StaffUserDto user) { this.user = user; }
    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isNeedsPasswordSetup() { return needsPasswordSetup; }
    public void setNeedsPasswordSetup(boolean needsPasswordSetup) { this.needsPasswordSetup = needsPasswordSetup; }
}