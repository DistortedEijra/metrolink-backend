package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;
import java.time.LocalDate;
import java.util.*;

public class TripDAO {

    private static final String SELECT_FULL =
        "SELECT t.*, b.bus_number, " +
        "d.full_name AS driver_name, co.full_name AS conductor_name " +
        "FROM trips t " +
        "JOIN buses b ON t.bus_id = b.id " +
        "JOIN employees d  ON t.driver_id = d.id " +
        "JOIN employees co ON t.conductor_id = co.id ";

    public List<Map<String, Object>> findAll() throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = SELECT_FULL + "ORDER BY t.trip_date DESC, t.dispatch_time DESC";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    /** Binary-search style: find trips by exact date (uses date index) */
    public List<Map<String, Object>> findByDate(LocalDate date) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = SELECT_FULL + "WHERE t.trip_date = ? ORDER BY t.dispatch_time";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(date));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    /** Date range search (uses date index) */
    public List<Map<String, Object>> findByDateRange(LocalDate from, LocalDate to) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = SELECT_FULL + "WHERE t.trip_date BETWEEN ? AND ? ORDER BY t.trip_date, t.dispatch_time";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public Map<String, Object> findById(int id) throws SQLException {
        String sql = SELECT_FULL + "WHERE t.id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public Map<String, Object> create(
            LocalDate tripDate, int busId, int driverId, int conductorId,
            String dispatchTime, String arrivalTime, int tripCount,
            String remarks, int createdBy) throws SQLException {

        String sql = "INSERT INTO trips (trip_date, bus_id, driver_id, conductor_id, " +
                     "dispatch_time, arrival_time, trip_count, remarks, created_by) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setDate(1, java.sql.Date.valueOf(tripDate));
            ps.setInt(2, busId);
            ps.setInt(3, driverId);
            ps.setInt(4, conductorId);
            ps.setString(5, dispatchTime);
            ps.setString(6, arrivalTime);
            ps.setInt(7, tripCount);
            ps.setString(8, remarks);
            ps.setInt(9, createdBy);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return findById(keys.getInt(1));
            }
        }
        return null;
    }

    /** Admin-only: edit trip. Automatically flags as modified + logs who/when. */
    public boolean update(int id, LocalDate tripDate, int busId, int driverId,
                          int conductorId, String dispatchTime, String arrivalTime,
                          int tripCount, String remarks, int modifiedBy) throws SQLException {
        String sql = "UPDATE trips SET trip_date=?, bus_id=?, driver_id=?, conductor_id=?, " +
                     "dispatch_time=?, arrival_time=?, trip_count=?, remarks=?, " +
                     "is_modified=TRUE, modified_by=?, modified_at=NOW() WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(tripDate));
            ps.setInt(2, busId);
            ps.setInt(3, driverId);
            ps.setInt(4, conductorId);
            ps.setString(5, dispatchTime);
            ps.setString(6, arrivalTime);
            ps.setInt(7, tripCount);
            ps.setString(8, remarks);
            ps.setInt(9, modifiedBy);
            ps.setInt(10, id);
            return ps.executeUpdate() > 0;
        }
    }

    /** Keyword search across bus number, driver name, conductor name, remarks */
    public List<Map<String, Object>> search(String keyword) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = SELECT_FULL +
                     "WHERE b.bus_number LIKE ? OR d.full_name LIKE ? " +
                     "OR co.full_name LIKE ? OR t.remarks LIKE ? " +
                     "ORDER BY t.trip_date DESC";
        String kw = "%" + keyword + "%";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, kw); ps.setString(2, kw);
            ps.setString(3, kw); ps.setString(4, kw);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    private Map<String, Object> mapRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",            rs.getInt("id"));
        m.put("tripDate",      rs.getDate("trip_date") != null ? rs.getDate("trip_date").toLocalDate() : null);
        m.put("busId",         rs.getInt("bus_id"));
        m.put("busNumber",     rs.getString("bus_number"));
        m.put("driverId",      rs.getInt("driver_id"));
        m.put("driverName",    rs.getString("driver_name"));
        m.put("conductorId",   rs.getInt("conductor_id"));
        m.put("conductorName", rs.getString("conductor_name"));
        m.put("dispatchTime",  rs.getString("dispatch_time"));
        m.put("arrivalTime",   rs.getString("arrival_time"));
        m.put("tripCount",     rs.getInt("trip_count"));
        m.put("remarks",       rs.getString("remarks"));
        m.put("isModified",    rs.getBoolean("is_modified"));
        m.put("modifiedBy",    rs.getInt("modified_by"));
        m.put("modifiedAt",    rs.getTimestamp("modified_at"));
        m.put("createdBy",     rs.getInt("created_by"));
        m.put("createdAt",     rs.getTimestamp("created_at"));
        return m;
    }
}
