package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BusDAO {

    public List<Map<String, Object>> findAll() throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT * FROM buses ORDER BY bus_number";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<Map<String, Object>> findActive() throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT * FROM buses WHERE status = 'ACTIVE' ORDER BY bus_number";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<Map<String, Object>> findAvailableForDate(LocalDate date, int excludeTripId) throws SQLException {
        String sql =
            "SELECT * FROM buses " +
            "WHERE status = 'ACTIVE' " +
            "  AND id NOT IN (" +
            "    SELECT bus_id FROM trips " +
            "    WHERE trip_date IN (?, ?) AND id != ? " +
            "      AND (" +
            "        arrival_time IS NULL " +
            "        OR TIMESTAMP(" +
            "             COALESCE(arrival_date, IF(arrival_time >= dispatch_time, trip_date, DATE_ADD(trip_date, INTERVAL 1 DAY)))," +
            "             arrival_time" +
            "           ) > NOW()" +
            "      )" +
            "  ) ORDER BY bus_number";
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(date));
            ps.setDate(2, java.sql.Date.valueOf(date.minusDays(1)));
            ps.setInt(3, excludeTripId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public Map<String, Object> findById(int id) throws SQLException {
        String sql = "SELECT * FROM buses WHERE id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public Map<String, Object> create(String busNumber, String plateNo, String model) throws SQLException {
        String sql = "INSERT INTO buses (bus_number, plate_no, model) VALUES (?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, busNumber);
            ps.setString(2, plateNo);
            ps.setString(3, model);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return findById(keys.getInt(1));
            }
        }
        return null;
    }

    public boolean update(int id, String busNumber, String plateNo, String model) throws SQLException {
        String sql = "UPDATE buses SET bus_number=?, plate_no=?, model=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, busNumber);
            ps.setString(2, plateNo);
            ps.setString(3, model);
            ps.setInt(4, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean setActive(int id, boolean isActive) throws SQLException {
        String newStatus = isActive ? "ACTIVE" : "INACTIVE";
        return setStatus(id, newStatus);
    }

    public boolean setStatus(int id, String status) throws SQLException {
        boolean isActive = "ACTIVE".equals(status);
        String sql = "UPDATE buses SET status=?, is_active=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setBoolean(2, isActive);
            ps.setInt(3, id);
            return ps.executeUpdate() > 0;
        }
    }

    private Map<String, Object> mapRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new HashMap<>();
        m.put("id",        rs.getInt("id"));
        m.put("busNumber", rs.getString("bus_number"));
        m.put("plateNo",   rs.getString("plate_no"));
        m.put("model",     rs.getString("model"));
        String status = rs.getString("status");
        m.put("status",   status);
        m.put("isActive", "ACTIVE".equals(status));
        m.put("createdAt", rs.getTimestamp("created_at"));
        return m;
    }
}
