package com.tideline.backend.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.tideline.backend.model.StaffSession;

@Repository
public class StaffSessionRepository {

    private final JdbcTemplate jdbcTemplate;

    public StaffSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<StaffSession> ROW_MAPPER = new RowMapper<>() {
        @Override
        public StaffSession mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new StaffSession(
                    rs.getString("token"),
                    rs.getLong("user_id"),
                    rs.getString("created_at"),
                    rs.getString("expires_at")
            );
        }
    };

    public void save(StaffSession session) {
        String sql = "INSERT OR REPLACE INTO staff_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)";
        jdbcTemplate.update(sql, session.getToken(), session.getUserId(), session.getCreatedAt(), session.getExpiresAt());
    }

    public Optional<StaffSession> findByToken(String token) {
        if (token == null) return Optional.empty();
        String sql = "SELECT token, user_id, created_at, expires_at FROM staff_sessions WHERE token = ?";
        try {
            StaffSession session = jdbcTemplate.queryForObject(sql, ROW_MAPPER, token);
            return Optional.ofNullable(session);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void deleteByToken(String token) {
        if (token == null) return;
        String sql = "DELETE FROM staff_sessions WHERE token = ?";
        jdbcTemplate.update(sql, token);
    }

    public void deleteExpired() {
        String now = Instant.now().toString();
        jdbcTemplate.update("DELETE FROM staff_sessions WHERE expires_at < ?", now);
    }

    public void deleteByUserId(Long userId) {
        jdbcTemplate.update("DELETE FROM staff_sessions WHERE user_id = ?", userId);
    }
}
