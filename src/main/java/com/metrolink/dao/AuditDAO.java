package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;
import java.time.LocalDate;
import java.util.*;

public class AuditDAO {

    public void log(Integer userId, String username, String action,
                    String entity, Integer entityId, String details) {
        String sql = "INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            if (userId != null) ps.setInt(1, userId); else ps.setNull(1, Types.INTEGER);
            ps.setString(2, username != null ? username : "unknown");
            ps.setString(3, action);
            ps.setString(4, entity);
            if (entityId != null) ps.setInt(5, entityId); else ps.setNull(5, Types.INTEGER);
            ps.setString(6, details);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("[AuditDAO] Failed to write audit log: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> findAll(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT id, user_id, username, action, entity, entity_id, details, logged_at " +
            "FROM audit_logs " +
            "WHERE DATE(logged_at) BETWEEN ? AND ? " +
            "ORDER BY logged_at DESC";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",        rs.getInt("id"));
                    row.put("userId",    rs.getObject("user_id"));
                    row.put("username",  rs.getString("username"));
                    row.put("action",    rs.getString("action"));
                    row.put("entity",    rs.getString("entity"));
                    row.put("entityId",  rs.getObject("entity_id"));
                    row.put("details",   rs.getString("details"));
                    row.put("loggedAt",  rs.getTimestamp("logged_at"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }
}
