package com.tideline.backend.repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import com.tideline.backend.model.EmergencyEvent;

@Repository
public class EmergencyEventRepository {

    private final JdbcTemplate jdbcTemplate;

    public EmergencyEventRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<EmergencyEvent> ROW_MAPPER = new RowMapper<>() {
        @Override
        public EmergencyEvent mapRow(ResultSet rs, int rowNum) throws SQLException {
            Double lat = rs.getObject("latitude") != null ? rs.getDouble("latitude") : null;
            Double lon = rs.getObject("longitude") != null ? rs.getDouble("longitude") : null;

            return new EmergencyEvent(
                    rs.getLong("id"),
                    rs.getString("emergency_type"),
                    lat,
                    lon,
                    rs.getString("event_time"),
                    rs.getString("message"),
                    rs.getString("status"),
                    rs.getString("created_at")
            );
        }
    };

    public List<EmergencyEvent> findAll() {
        String sql = "SELECT id, emergency_type, latitude, longitude, event_time, message, status, created_at FROM emergency_events ORDER BY id DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<EmergencyEvent> findById(Long id) {
        String sql = "SELECT id, emergency_type, latitude, longitude, event_time, message, status, created_at FROM emergency_events WHERE id = ?";
        try {
            EmergencyEvent event = jdbcTemplate.queryForObject(sql, ROW_MAPPER, id);
            return Optional.ofNullable(event);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<EmergencyEvent> findExisting(String emergencyType, String eventTime, String createdAt) {
        String sql = "SELECT id, emergency_type, latitude, longitude, event_time, message, status, created_at FROM emergency_events WHERE emergency_type = ? AND event_time = ? AND created_at = ?";
        try {
            EmergencyEvent event = jdbcTemplate.queryForObject(sql, ROW_MAPPER, emergencyType, eventTime, createdAt);
            return Optional.ofNullable(event);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public EmergencyEvent save(EmergencyEvent event) {
        String sql = "INSERT INTO emergency_events (emergency_type, latitude, longitude, event_time, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, event.getEmergencyType());
            if (event.getLatitude() != null) {
                ps.setDouble(2, event.getLatitude());
            } else {
                ps.setNull(2, Types.REAL);
            }
            if (event.getLongitude() != null) {
                ps.setDouble(3, event.getLongitude());
            } else {
                ps.setNull(3, Types.REAL);
            }
            ps.setString(4, event.getEventTime());
            ps.setString(5, event.getMessage());
            ps.setString(6, event.getStatus());
            ps.setString(7, event.getCreatedAt());
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId != null) {
            event.setId(generatedId.longValue());
        }
        return event;
    }

    public boolean deleteById(Long id) {
        String sql = "DELETE FROM emergency_events WHERE id = ?";
        int rows = jdbcTemplate.update(sql, id);
        return rows > 0;
    }

    public boolean doesTableExist() {
        String sql = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='emergency_events'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count != null && count > 0;
    }
}
