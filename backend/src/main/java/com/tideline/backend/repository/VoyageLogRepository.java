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

import com.tideline.backend.model.VoyageLog;

@Repository
public class VoyageLogRepository {

    private final JdbcTemplate jdbcTemplate;

    public VoyageLogRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<VoyageLog> ROW_MAPPER = new RowMapper<>() {
        @Override
        public VoyageLog mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new VoyageLog(
                    rs.getLong("id"),
                    rs.getString("voyage_date"),
                    rs.getString("departure"),
                    rs.getString("destination"),
                    rs.getString("vessel_name"),
                    rs.getString("notes"),
                    rs.getString("created_at")
            );
        }
    };

    public List<VoyageLog> findAll() {
        String sql = "SELECT id, voyage_date, departure, destination, vessel_name, notes, created_at FROM voyage_logs ORDER BY id DESC";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<VoyageLog> findById(Long id) {
        String sql = "SELECT id, voyage_date, departure, destination, vessel_name, notes, created_at FROM voyage_logs WHERE id = ?";
        try {
            VoyageLog log = jdbcTemplate.queryForObject(sql, ROW_MAPPER, id);
            return Optional.ofNullable(log);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<VoyageLog> findExisting(String departure, String destination, String voyageDate, String vesselName, String createdAt) {
        String sql = "SELECT id, voyage_date, departure, destination, vessel_name, notes, created_at FROM voyage_logs WHERE departure = ? AND destination = ? AND voyage_date = ? AND vessel_name = ? AND created_at = ?";
        try {
            VoyageLog log = jdbcTemplate.queryForObject(sql, ROW_MAPPER, departure, destination, voyageDate, vesselName, createdAt);
            return Optional.ofNullable(log);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public VoyageLog save(VoyageLog voyageLog) {
        String sql = "INSERT INTO voyage_logs (voyage_date, departure, destination, vessel_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, voyageLog.getVoyageDate());
            ps.setString(2, voyageLog.getDeparture());
            ps.setString(3, voyageLog.getDestination());
            ps.setString(4, voyageLog.getVesselName());
            ps.setString(5, voyageLog.getNotes());
            ps.setString(6, voyageLog.getCreatedAt());
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId != null) {
            voyageLog.setId(generatedId.longValue());
        }
        return voyageLog;
    }

    public boolean deleteById(Long id) {
        String sql = "DELETE FROM voyage_logs WHERE id = ?";
        int rows = jdbcTemplate.update(sql, id);
        return rows > 0;
    }

    public boolean doesTableExist() {
        String sql = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='voyage_logs'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count != null && count > 0;
    }
}
