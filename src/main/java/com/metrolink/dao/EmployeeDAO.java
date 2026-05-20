package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;
import com.metrolink.model.Employee;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class EmployeeDAO {

    public List<Employee> findAll() throws SQLException {
        List<Employee> list = new ArrayList<>();
        String sql = "SELECT * FROM employees ORDER BY full_name";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<Employee> findActive() throws SQLException {
        List<Employee> list = new ArrayList<>();
        String sql = "SELECT * FROM employees WHERE is_active = TRUE ORDER BY full_name";
        try (Connection c = DatabaseConfig.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public Employee findById(int id) throws SQLException {
        String sql = "SELECT * FROM employees WHERE id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public Employee create(String employeeCode, String fullName, LocalDate birthdate,
                           String address, String position, BigDecimal dailyRate) throws SQLException {
        String sql = "INSERT INTO employees (employee_code, full_name, birthdate, address, position, daily_rate) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, employeeCode);
            ps.setString(2, fullName);
            ps.setObject(3, birthdate);
            ps.setString(4, address);
            ps.setString(5, position);
            ps.setBigDecimal(6, dailyRate);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return findById(keys.getInt(1));
            }
        }
        return null;
    }

    public boolean update(int id, String fullName, LocalDate birthdate,
                          String address, String position, BigDecimal dailyRate) throws SQLException {
        String sql = "UPDATE employees SET full_name=?, birthdate=?, address=?, position=?, daily_rate=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, fullName);
            ps.setObject(2, birthdate);
            ps.setString(3, address);
            ps.setString(4, position);
            ps.setBigDecimal(5, dailyRate);
            ps.setInt(6, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean setActive(int id, boolean isActive) throws SQLException {
        String sql = "UPDATE employees SET is_active=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setBoolean(1, isActive);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    private Employee mapRow(ResultSet rs) throws SQLException {
        Employee e = new Employee();
        e.setId(rs.getInt("id"));
        e.setEmployeeCode(rs.getString("employee_code"));
        e.setFullName(rs.getString("full_name"));
        Date bd = rs.getDate("birthdate");
        if (bd != null) e.setBirthdate(bd.toLocalDate());
        e.setAddress(rs.getString("address"));
        e.setPosition(rs.getString("position"));
        e.setDailyRate(rs.getBigDecimal("daily_rate"));
        e.setActive(rs.getBoolean("is_active"));
        Timestamp ca = rs.getTimestamp("created_at");
        if (ca != null) e.setCreatedAt(ca.toLocalDateTime());
        Timestamp ua = rs.getTimestamp("updated_at");
        if (ua != null) e.setUpdatedAt(ua.toLocalDateTime());
        return e;
    }
}
