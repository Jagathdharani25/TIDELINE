package com.tideline.backend.repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import com.tideline.backend.model.StaffUser;

@Repository
public class StaffUserRepository {

    private final JdbcTemplate jdbcTemplate;

    public StaffUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<StaffUser> ROW_MAPPER = (rs, rowNum) -> {
        boolean active = true;
        try { active = rs.getInt("active") != 0; } catch (SQLException ignored) {}
        return new StaffUser(
            rs.getLong("id"), rs.getString("username"), rs.getString("full_name"),
            rs.getString("password_hash"), rs.getString("role"), rs.getString("rank_title"),
            rs.getString("created_at"), rs.getString("last_login_at"), active);
    };

    private static final String SELECT_ALL =
        "SELECT id, username, full_name, password_hash, role, rank_title, created_at, last_login_at, active FROM staff_users";

    public List<StaffUser> findAll() {
        return jdbcTemplate.query(SELECT_ALL + " ORDER BY id ASC", ROW_MAPPER);
    }

    public Optional<StaffUser> findById(Long id) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(SELECT_ALL + " WHERE id = ?", ROW_MAPPER, id));
        } catch (EmptyResultDataAccessException e) { return Optional.empty(); }
    }

    public Optional<StaffUser> findByUsername(String username) {
        if (username == null) return Optional.empty();
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(
                SELECT_ALL + " WHERE LOWER(username) = LOWER(?)", ROW_MAPPER, username.trim()));
        } catch (EmptyResultDataAccessException e) { return Optional.empty(); }
    }

    public int count() {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM staff_users", Integer.class);
        return count != null ? count : 0;
    }

    public StaffUser save(StaffUser user) {
        if (user.getId() == null) {
            String sql = "INSERT INTO staff_users (username, full_name, password_hash, role, rank_title, created_at, last_login_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, user.getUsername().trim());
                ps.setString(2, user.getFullName());
                ps.setString(3, user.getPasswordHash());
                ps.setString(4, user.getRole());
                ps.setString(5, user.getRankTitle());
                ps.setString(6, user.getCreatedAt());
                ps.setString(7, user.getLastLoginAt());
                ps.setInt(8, user.isActive() ? 1 : 0);
                return ps;
            }, keyHolder);
            Number key = keyHolder.getKey();
            if (key != null) user.setId(key.longValue());
            return user;
        } else {
            jdbcTemplate.update(
                "UPDATE staff_users SET full_name=?, password_hash=?, role=?, rank_title=?, last_login_at=?, active=? WHERE id=?",
                user.getFullName(), user.getPasswordHash(), user.getRole(), user.getRankTitle(),
                user.getLastLoginAt(), user.isActive() ? 1 : 0, user.getId());
            return user;
        }
    }

    public void updateLastLogin(Long userId, String lastLoginAt) {
        jdbcTemplate.update("UPDATE staff_users SET last_login_at=? WHERE id=?", lastLoginAt, userId);
    }

    public void updatePasswordHash(Long userId, String passwordHash) {
        jdbcTemplate.update("UPDATE staff_users SET password_hash=? WHERE id=?", passwordHash, userId);
    }

    public void updateRole(Long userId, String role) {
        jdbcTemplate.update("UPDATE staff_users SET role=? WHERE id=?", role, userId);
    }

    public void updateActive(Long userId, boolean active) {
        jdbcTemplate.update("UPDATE staff_users SET active=? WHERE id=?", active ? 1 : 0, userId);
    }

    public boolean deleteById(Long id) {
        return jdbcTemplate.update("DELETE FROM staff_users WHERE id=?", id) > 0;
    }
}