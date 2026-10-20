package com.tideline.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tideline.backend.model.LoginRequest;
import com.tideline.backend.model.LoginResponse;
import com.tideline.backend.model.StaffRegisterRequest;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.model.StaffUserDto;
import com.tideline.backend.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        if (!response.isSuccess()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        authService.logout(authHeader);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<StaffUser> userOpt = authService.validateToken(authHeader);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized or session expired"));
        }
        return ResponseEntity.ok(StaffUserDto.fromEntity(userOpt.get()));
    }

    @PostMapping("/setup-password")
    public ResponseEntity<?> setupPassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            String newPassword = body.get("newPassword");
            if (newPassword == null || newPassword.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "New password is required"));
            }
            String confirm = body.get("confirmPassword");
            if (!newPassword.equals(confirm)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Passwords do not match"));
            }
            authService.setupPassword(authHeader, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password set successfully. Please log in again."));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            String currentPassword = body.get("currentPassword");
            String newPassword = body.get("newPassword");
            String confirmPassword = body.get("confirmPassword");
            if (currentPassword == null || newPassword == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Current and new passwords are required"));
            }
            if (!newPassword.equals(confirmPassword)) {
                return ResponseEntity.badRequest().body(Map.of("error", "New passwords do not match"));
            }
            authService.changePassword(authHeader, currentPassword, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/staff")
    public ResponseEntity<?> getStaffList(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<StaffUser> currentUserOpt = authService.validateToken(authHeader);
        if (currentUserOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        List<StaffUserDto> staffList = authService.getAllStaff();
        return ResponseEntity.ok(staffList);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody StaffRegisterRequest request) {
        Optional<StaffUser> currentUserOpt = authService.validateToken(authHeader);
        if (currentUserOpt.isEmpty() || !"ADMIN".equalsIgnoreCase(currentUserOpt.get().getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Forbidden: Admin privileges required"));
        }
        try {
            StaffUserDto created = authService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/status/{username}")
    public ResponseEntity<?> getAccountStatus(@PathVariable String username) {
        Optional<StaffUser> u = authService.findUserByUsername(username);
        if (u.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }
        StaffUser user = u.get();
        return ResponseEntity.ok(Map.of(
            "username", user.getUsername(),
            "fullName", user.getFullName(),
            "role", user.getRole(),
            "needsPasswordSetup", user.isNeedsPasswordSetup(),
            "active", user.isActive()
        ));
    }

    @PostMapping("/recover-password")
    public ResponseEntity<?> recoverPassword(@RequestBody Map<String, String> body) {
        try {
            String username = body.get("username");
            String recoveryKey = body.get("recoveryKey");
            String newPassword = body.get("newPassword");
            String confirmPassword = body.get("confirmPassword");
            if (newPassword == null || newPassword.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "New password is required"));
            }
            if (!newPassword.equals(confirmPassword)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Passwords do not match"));
            }
            authService.recoverPassword(username, recoveryKey, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password reset successfully. Please log in with your new password."));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/staff/{id}/reset-password")
    public ResponseEntity<?> resetPassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id) {
        try {
            authService.adminResetPassword(authHeader, id);
            return ResponseEntity.ok(Map.of("message", "Password reset. User must set a new password on next login."));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/admin-reset-password")
    public ResponseEntity<?> adminResetPasswordDirect(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {
        try {
            Long targetId = null;
            if (body.get("targetId") != null) {
                targetId = Long.valueOf(body.get("targetId").toString());
            } else if (body.get("username") != null) {
                String targetUsername = body.get("username").toString();
                Optional<StaffUser> u = authService.findUserByUsername(targetUsername);
                if (u.isPresent()) targetId = u.get().getId();
            }
            if (targetId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Valid targetId or username required"));
            }
            authService.adminResetPassword(authHeader, targetId);
            return ResponseEntity.ok(Map.of("message", "Password reset successfully. User must set a new password on next login."));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/staff/{id}/active")
    public ResponseEntity<?> setActive(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        try {
            Boolean active = body.get("active");
            if (active == null) return ResponseEntity.badRequest().body(Map.of("error", "active field required"));
            StaffUserDto updated = authService.setActive(authHeader, id, active);
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/staff/{id}/role")
    public ResponseEntity<?> setRole(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        try {
            String role = body.get("role");
            if (role == null) return ResponseEntity.badRequest().body(Map.of("error", "role field required"));
            StaffUserDto updated = authService.setRole(authHeader, id, role);
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}