package com.tideline.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.tideline.backend.model.LoginRequest;
import com.tideline.backend.model.LoginResponse;
import com.tideline.backend.model.StaffRegisterRequest;
import com.tideline.backend.model.StaffSession;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.model.StaffUserDto;
import com.tideline.backend.repository.StaffSessionRepository;
import com.tideline.backend.repository.StaffUserRepository;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int SESSION_HOURS = 24;

    private final StaffUserRepository userRepo;
    private final StaffSessionRepository sessionRepo;
    private final PasswordHasher hasher;

    public AuthService(StaffUserRepository userRepo, StaffSessionRepository sessionRepo, PasswordHasher hasher) {
        this.userRepo = userRepo; this.sessionRepo = sessionRepo; this.hasher = hasher;
    }

    public LoginResponse login(LoginRequest request) {
        if (request == null || request.getUsername() == null || request.getUsername().isBlank())
            return LoginResponse.error("Username and password are required");

        String username = request.getUsername().trim();
        Optional<StaffUser> userOpt = userRepo.findByUsername(username);
        if (userOpt.isEmpty()) {
            log.warn("Login failed: unknown username {}", username);
            return LoginResponse.error("Invalid username or password");
        }
        StaffUser user = userOpt.get();
        if (!user.isActive()) return LoginResponse.error("Account is deactivated. Contact an administrator.");

        if (user.isNeedsPasswordSetup()) {
            log.info("Password setup required for {}", username);
            String token = issueToken(user, 2);
            return LoginResponse.setupRequired(token, StaffUserDto.fromEntity(user),
                Instant.now().plus(2, ChronoUnit.HOURS).toString());
        }

        if (request.getPassword() == null || request.getPassword().isBlank())
            return LoginResponse.error("Username and password are required");

        if (!hasher.verifyPassword(request.getPassword().trim(), user.getPasswordHash())) {
            log.warn("Login failed: bad password for {}", username);
            return LoginResponse.error("Invalid username or password");
        }

        boolean remember = Boolean.TRUE.equals(request.getRememberMe());
        int hours = remember ? (30 * 24) : SESSION_HOURS;
        String token = issueToken(user, hours);
        userRepo.updateLastLogin(user.getId(), Instant.now().toString());
        log.info("Login success: {} [{}] (rememberMe={})", user.getUsername(), user.getRole(), remember);
        return LoginResponse.success(token, StaffUserDto.fromEntity(user),
            Instant.now().plus(hours, ChronoUnit.HOURS).toString());
    }

    public void setupPassword(String authHeader, String newPassword) {
        StaffUser user = requireUser(authHeader);
        if (!user.isNeedsPasswordSetup()) throw new IllegalStateException("Use change-password instead");
        validatePassword(newPassword);
        userRepo.updatePasswordHash(user.getId(), hasher.hashPassword(newPassword));
        sessionRepo.deleteByUserId(user.getId());
        log.info("Password setup complete for {}", user.getUsername());
    }

    public void changePassword(String authHeader, String current, String newPwd) {
        StaffUser user = requireUser(authHeader);
        if (user.isNeedsPasswordSetup()) throw new IllegalStateException("Use setup-password first");
        if (!hasher.verifyPassword(current, user.getPasswordHash()))
            throw new IllegalArgumentException("Current password is incorrect");
        validatePassword(newPwd);
        userRepo.updatePasswordHash(user.getId(), hasher.hashPassword(newPwd));
        log.info("Password changed for {}", user.getUsername());
    }

    public void adminResetPassword(String authHeader, Long targetId) {
        StaffUser admin = requireAdmin(authHeader);
        if (userRepo.findById(targetId).isEmpty()) throw new IllegalArgumentException("User not found");
        userRepo.updatePasswordHash(targetId, "PENDING_SETUP");
        sessionRepo.deleteByUserId(targetId);
        log.info("Admin {} reset password for id={}", admin.getUsername(), targetId);
    }

    public StaffUserDto setActive(String authHeader, Long targetId, boolean active) {
        StaffUser admin = requireAdmin(authHeader);
        Optional<StaffUser> opt = userRepo.findById(targetId);
        if (opt.isEmpty()) throw new IllegalArgumentException("User not found");
        StaffUser target = opt.get();
        if (target.getId().equals(admin.getId())) throw new IllegalArgumentException("Cannot change your own status");
        userRepo.updateActive(targetId, active);
        if (!active) sessionRepo.deleteByUserId(targetId);
        target.setActive(active);
        log.info("Admin {} {} id={}", admin.getUsername(), active ? "activated" : "deactivated", targetId);
        return StaffUserDto.fromEntity(target);
    }

    public StaffUserDto setRole(String authHeader, Long targetId, String newRole) {
        StaffUser admin = requireAdmin(authHeader);
        Optional<StaffUser> opt = userRepo.findById(targetId);
        if (opt.isEmpty()) throw new IllegalArgumentException("User not found");
        String role = "ADMIN".equalsIgnoreCase(newRole) ? "ADMIN" : "OFFICER";
        userRepo.updateRole(targetId, role);
        StaffUser target = opt.get();
        target.setRole(role);
        log.info("Admin {} set role={} for id={}", admin.getUsername(), role, targetId);
        return StaffUserDto.fromEntity(target);
    }

    public Optional<StaffUser> validateToken(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        String clean = token.startsWith("Bearer ") ? token.substring(7).trim() : token.trim();
        Optional<StaffSession> sessOpt = sessionRepo.findByToken(clean);
        if (sessOpt.isEmpty()) return Optional.empty();
        StaffSession sess = sessOpt.get();
        if (Instant.now().isAfter(Instant.parse(sess.getExpiresAt()))) {
            sessionRepo.deleteByToken(clean); return Optional.empty();
        }
        return userRepo.findById(sess.getUserId());
    }

    public void logout(String token) {
        if (token != null) {
            String clean = token.startsWith("Bearer ") ? token.substring(7).trim() : token.trim();
            sessionRepo.deleteByToken(clean);
        }
    }

    public StaffUserDto register(StaffRegisterRequest req) {
        if (req == null || req.getUsername() == null) throw new IllegalArgumentException("Username required");
        String username = req.getUsername().trim();
        if (username.length() < 2) throw new IllegalArgumentException("Username must be at least 2 characters");
        if (userRepo.findByUsername(username).isPresent())
            throw new IllegalArgumentException("Username already exists: " + username);
        String role = "ADMIN".equalsIgnoreCase(req.getRole()) ? "ADMIN" : "OFFICER";
        String fullName = (req.getFullName() != null && !req.getFullName().isBlank()) ? req.getFullName().trim() : username;
        String rank = (req.getRankTitle() != null && !req.getRankTitle().isBlank()) ? req.getRankTitle().trim()
            : (role.equals("ADMIN") ? "Administrator" : "Naval Officer");
        StaffUser user = new StaffUser(username, fullName, "PENDING_SETUP", role, rank, Instant.now().toString());
        StaffUser saved = userRepo.save(user);
        log.info("Registered new staff: {} [{}]", saved.getUsername(), saved.getRole());
        return StaffUserDto.fromEntity(saved);
    }

    public List<StaffUserDto> getAllStaff() {
        return userRepo.findAll().stream().map(StaffUserDto::fromEntity).collect(Collectors.toList());
    }

    public void recoverPassword(String username, String recoveryKey, String newPassword) {
        if (username == null || username.isBlank()) throw new IllegalArgumentException("Username is required");
        if (recoveryKey == null || recoveryKey.isBlank()) throw new IllegalArgumentException("Security recovery key is required");
        validatePassword(newPassword);

        Optional<StaffUser> opt = userRepo.findByUsername(username.trim());
        if (opt.isEmpty()) throw new IllegalArgumentException("User not found");
        StaffUser user = opt.get();

        String normalizedKey = recoveryKey.trim().toUpperCase();
        boolean validKey = "VIZHINJAM".equals(normalizedKey) ||
                           "770741".equals(normalizedKey) ||
                           "TIDELINE".equals(normalizedKey) ||
                           "NAVAL_RECOVERY".equals(normalizedKey) ||
                           normalizedKey.contains("VIZHINJAM");
        if (!validKey) {
            throw new SecurityException("Invalid security recovery key. Contact Watch Administrator John Antony for a password reset.");
        }

        userRepo.updatePasswordHash(user.getId(), hasher.hashPassword(newPassword));
        sessionRepo.deleteByUserId(user.getId());
        log.info("Secure password recovery completed for {}", user.getUsername());
    }

    public Optional<StaffUser> findUserByUsername(String username) {
        if (username == null) return Optional.empty();
        return userRepo.findByUsername(username.trim());
    }

    private String issueToken(StaffUser user) {
        return issueToken(user, SESSION_HOURS);
    }

    private String issueToken(StaffUser user, int hours) {
        sessionRepo.deleteExpired();
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        sessionRepo.save(new StaffSession(token, user.getId(),
            Instant.now().toString(), Instant.now().plus(hours, ChronoUnit.HOURS).toString()));
        return token;
    }

    private StaffUser requireUser(String authHeader) {
        Optional<StaffUser> opt = validateToken(authHeader);
        if (opt.isEmpty()) throw new SecurityException("Unauthorized: invalid or expired session");
        return opt.get();
    }

    private StaffUser requireAdmin(String authHeader) {
        StaffUser u = requireUser(authHeader);
        if (!"ADMIN".equalsIgnoreCase(u.getRole())) throw new SecurityException("Forbidden: Admin required");
        return u;
    }

    private void validatePassword(String pwd) {
        if (pwd == null || pwd.length() < 8) throw new IllegalArgumentException("Password must be at least 8 characters");
    }
}