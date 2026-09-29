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

import com.tideline.backend.model.MaintenanceRecord;

@Repository
public class MaintenanceRecordRepository {

    private final JdbcTemplate jdbcTemplate;

    public MaintenanceRecordRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<MaintenanceRecord> ROW_MAPPER = new RowMapper<>() {
        @Override
        public MaintenanceRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new MaintenanceRecord(
                    rs.getLong("id"),
                    rs.getString("vessel_name"),
                    rs.getString("equipment"),
                    rs.getString("maintenance_date"),
                    rs.getString("next_service_date"),
                    rs.getString("status"),
                    rs.getString("notes"),
                    rs.getString("created_at")
            );
        }
    };

    public List<MaintenanceRecord> findAll() {
        String sql = "SELECT id, vessel_name, equipment, maintenance_date, next_service_date, status, notes, created_at FROM maintenance_records ORDER BY id DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<MaintenanceRecord> findById(Long id) {
        String sql = "SELECT id, vessel_name, equipment, maintenance_date, next_service_date, status, notes, created_at FROM maintenance_records WHERE id = ?";
        try {
            MaintenanceRecord record = jdbcTemplate.queryForObject(sql, ROW_MAPPER, id);
            return Optional.ofNullable(record);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<MaintenanceRecord> findExisting(String vesselName, String equipment, String maintenanceDate, String createdAt) {
        String sql = "SELECT id, vessel_name, equipment, maintenance_date, next_service_date, status, notes, created_at FROM maintenance_records WHERE vessel_name = ? AND equipment = ? AND maintenance_date = ? AND created_at = ?";
        try {
            MaintenanceRecord record = jdbcTemplate.queryForObject(sql, ROW_MAPPER, vesselName, equipment, maintenanceDate, createdAt);
            return Optional.ofNullable(record);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public MaintenanceRecord save(MaintenanceRecord record) {
        String sql = "INSERT INTO maintenance_records (vessel_name, equipment, maintenance_date, next_service_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, record.getVesselName());
            ps.setString(2, record.getEquipment());
            ps.setString(3, record.getMaintenanceDate());
            ps.setString(4, record.getNextServiceDate());
            ps.setString(5, record.getStatus());
            ps.setString(6, record.getNotes());
            ps.setString(7, record.getCreatedAt());
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId != null) {
            record.setId(generatedId.longValue());
        }
        return record;
    }

    public boolean deleteById(Long id) {
        String sql = "DELETE FROM maintenance_records WHERE id = ?";
        int rows = jdbcTemplate.update(sql, id);
        return rows > 0;
    }

    public boolean doesTableExist() {
        String sql = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='maintenance_records'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count != null && count > 0;
    }
}
