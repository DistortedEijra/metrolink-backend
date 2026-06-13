package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
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
            String dispatchTime, String arrivalTime, LocalDate arrivalDate, Integer tripCount,
            String remarks, int createdBy) throws SQLException {

        String status = arrivalTime != null ? "FINISHED" : "SCHEDULED";
        String sql = "INSERT INTO trips (trip_date, bus_id, driver_id, conductor_id, status, " +
                     "dispatch_time, arrival_time, arrival_date, trip_count, remarks, created_by) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setDate(1, java.sql.Date.valueOf(tripDate));
            ps.setInt(2, busId);
            ps.setInt(3, driverId);
            ps.setInt(4, conductorId);
            ps.setString(5, status);
            ps.setString(6, normalizeTime(dispatchTime));
            ps.setString(7, normalizeTime(arrivalTime));
            setNullableDate(ps, 8, arrivalDate);
            setNullableInt(ps, 9, tripCount);
            ps.setString(10, remarks);
            ps.setInt(11, createdBy);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return findById(keys.getInt(1));
            }
        }
        return null;
    }

    /** Admin-only: edit trip details. Keeps current status unless finishing data provided. */
    public boolean update(int id, LocalDate tripDate, int busId, int driverId,
                          int conductorId, String dispatchTime, String arrivalTime, LocalDate arrivalDate,
                          Integer tripCount, String remarks) throws SQLException {
        String sql = "UPDATE trips SET trip_date=?, bus_id=?, driver_id=?, conductor_id=?, " +
                     "dispatch_time=?, arrival_time=?, arrival_date=?, trip_count=?, remarks=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(tripDate));
            ps.setInt(2, busId);
            ps.setInt(3, driverId);
            ps.setInt(4, conductorId);
            ps.setString(5, normalizeTime(dispatchTime));
            ps.setString(6, normalizeTime(arrivalTime));
            setNullableDate(ps, 7, arrivalDate);
            setNullableInt(ps, 8, tripCount);
            ps.setString(9, remarks);
            ps.setInt(10, id);
            return ps.executeUpdate() > 0;
        }
    }

    /** Staff/admin: start a trip (SCHEDULED -> ONGOING) */
    public boolean startTrip(int id) throws SQLException {
        String sql = "UPDATE trips SET status='ONGOING' WHERE id=? AND status='SCHEDULED'";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    /** Staff/admin: finish a trip — set arrival time, arrival date, trip count, and status to FINISHED */
    public boolean finishTrip(int id, String arrivalTime, LocalDate arrivalDate, int tripCount) throws SQLException {
        String sql = "UPDATE trips SET arrival_time=?, arrival_date=?, trip_count=?, status='FINISHED' WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, normalizeTime(arrivalTime));
            setNullableDate(ps, 2, arrivalDate);
            ps.setInt(3, tripCount);
            ps.setInt(4, id);
            return ps.executeUpdate() > 0;
        }
    }

    private void setNullableDate(PreparedStatement ps, int index, LocalDate date) throws SQLException {
        if (date != null) ps.setDate(index, java.sql.Date.valueOf(date));
        else ps.setNull(index, Types.DATE);
    }

    private void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value != null) ps.setInt(index, value);
        else ps.setNull(index, Types.INTEGER);
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
        m.put("status",        rs.getString("status"));
        m.put("dispatchTime",  rs.getString("dispatch_time"));
        m.put("arrivalTime",   rs.getString("arrival_time"));
        m.put("arrivalDate",   rs.getDate("arrival_date") != null ? rs.getDate("arrival_date").toLocalDate() : null);
        m.put("tripCount",     rs.getObject("trip_count") != null ? rs.getInt("trip_count") : null);
        m.put("remarks",       rs.getString("remarks"));
        m.put("createdBy",     rs.getInt("created_by"));
        m.put("createdAt",     rs.getTimestamp("created_at"));
        return m;
    }

    /**
     * Normalize a time string to HH:MM:SS format.
     * Handles malformed values like "15:51:00:00" by taking only the first 3 segments.
     */
    private String normalizeTime(String time) {
        if (time == null || time.isBlank()) return null;
        // Strip anything after a dot (e.g. "15:51:00.0")
        String clean = time.split("\\.")[0];
        String[] parts = clean.split(":");
        String hh = parts.length > 0 ? parts[0] : "00";
        String mm = parts.length > 1 ? parts[1] : "00";
        String ss = parts.length > 2 ? parts[2] : "00";
        // Pad each to 2 digits and return exactly HH:MM:SS
        return String.format("%2s:%2s:%2s", hh, mm, ss).replace(' ', '0');
    }
}
