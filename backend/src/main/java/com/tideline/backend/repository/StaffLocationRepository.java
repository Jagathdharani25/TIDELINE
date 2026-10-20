package com.tideline.backend.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.tideline.backend.model.StaffLocation;

@Repository
public class StaffLocationRepository {

    private final JdbcTemplate jdbcTemplate;

    public StaffLocationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<StaffLocation> ROW_MAPPER = new RowMapper<>() {
        @Override
        public StaffLocation mapRow(ResultSet rs, int rowNum) throws SQLException {
            Double lat = rs.getObject("latitude") != null ? rs.getDouble("latitude") : null;
            Double lon = rs.getObject("longitude") != null ? rs.getDouble("longitude") : null;
            Double acc = rs.getObject("accuracy") != null ? rs.getDouble("accuracy") : null;
            Double spd = rs.getObject("speed") != null ? rs.getDouble("speed") : null;
            Double hdg = rs.getObject("heading") != null ? rs.getDouble("heading") : null;

            return new StaffLocation(
                    rs.getLong("id"),
                    rs.getLong("user_id"),
                    rs.getString("username"),
                    rs.getString("full_name"),
                    rs.getString("role"),
                    lat,
                    lon,
                    acc,
                    spd,
                    hdg,
                    rs.getString("shared_at"),
                    rs.getString("vessel_name"),
                    rs.getString("status_note")
            );
        }
    };

    public List<StaffLocation> findAllLatest() {
        // Group by user_id to return only the latest location per user
        String sql = """
            SELECT l.id, l.user_id, l.username, l.full_name, l.role,
                   l.latitude, l.longitude, l.accuracy, l.speed, l.heading,
                   l.shared_at, l.vessel_name, l.status_note
            FROM staff_locations l
            INNER JOIN (
                SELECT user_id, MAX(id) as max_id
                FROM staff_locations
                GROUP BY user_id
            ) latest ON l.id = latest.max_id
            ORDER BY l.shared_at DESC
        """;
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<StaffLocation> findLatestByUserId(Long userId) {
        String sql = """
            SELECT id, user_id, username, full_name, role,
                   latitude, longitude, accuracy, speed, heading,
                   shared_at, vessel_name, status_note
            FROM staff_locations
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
        """;
        try {
            StaffLocation loc = jdbcTemplate.queryForObject(sql, ROW_MAPPER, userId);
            return Optional.ofNullable(loc);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(StaffLocation location) {
        String sql = """
            INSERT INTO staff_locations (user_id, username, full_name, role, latitude, longitude, accuracy, speed, heading, shared_at, vessel_name, status_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        jdbcTemplate.update(sql,
                location.getUserId(),
                location.getUsername(),
                location.getFullName(),
                location.getRole(),
                location.getLatitude(),
                location.getLongitude(),
                location.getAccuracy(),
                location.getSpeed(),
                location.getHeading(),
                location.getSharedAt(),
                location.getVesselName(),
                location.getStatusNote()
        );
    }
}
