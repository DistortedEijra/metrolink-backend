package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;
import com.metrolink.model.User;

import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class UserDAO {

    public User findByUsername(String username) throws SQLException {
        String sql = "SELECT * FROM users WHERE username = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public User findById(int id) throws SQLException {
        String sql = "SELECT * FROM users WHERE id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public List<User> findAll() throws SQLException {
        List<User> list = new ArrayList<>();
        String sql = "SELECT * FROM users ORDER BY full_name";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public User create(String username, String hashedPassword, String fullName,
                       LocalDate birthdate, String address, String email, String role) throws SQLException {
        String sql = "INSERT INTO users (username, password, full_name, birthdate, address, email, role) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, username);
            ps.setString(2, hashedPassword);
            ps.setString(3, fullName);
            ps.setObject(4, birthdate);
            ps.setString(5, address);
            ps.setString(6, email);
            ps.setString(7, role);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return findById(keys.getInt(1));
            }
        }
        return null;
    }

    public boolean update(int id, String fullName, LocalDate birthdate,
                          String address, String email, String role) throws SQLException {
        String sql = "UPDATE users SET full_name=?, birthdate=?, address=?, email=?, role=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, fullName);
            ps.setObject(2, birthdate);
            ps.setString(3, address);
            ps.setString(4, email);
            ps.setString(5, role);
            ps.setInt(6, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updatePassword(int id, String hashedPassword) throws SQLException {
        String sql = "UPDATE users SET password=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, hashedPassword);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean setActive(int id, boolean isActive) throws SQLException {
        String sql = "UPDATE users SET is_active=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setBoolean(1, isActive);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    private User mapRow(ResultSet rs) throws SQLException {
        User u = new User();
        u.setId(rs.getInt("id"));
        u.setUsername(rs.getString("username"));
        u.setPassword(rs.getString("password"));
        u.setFullName(rs.getString("full_name"));
        Date bd = rs.getDate("birthdate");
        if (bd != null) u.setBirthdate(bd.toLocalDate());
        u.setAddress(rs.getString("address"));
        u.setEmail(rs.getString("email"));
        u.setRole(rs.getString("role"));
        u.setActive(rs.getBoolean("is_active"));
        Timestamp ca = rs.getTimestamp("created_at");
        if (ca != null) u.setCreatedAt(ca.toLocalDateTime());
        Timestamp ua = rs.getTimestamp("updated_at");
        if (ua != null) u.setUpdatedAt(ua.toLocalDateTime());
        return u;
    }
}
