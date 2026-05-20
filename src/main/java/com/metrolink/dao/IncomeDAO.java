package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.math.BigDecimal;
import java.sql.*;
import java.util.LinkedHashMap;
import java.util.Map;

public class IncomeDAO {

    public Map<String, Object> findByTripId(int tripId) throws SQLException {
        String sql = "SELECT * FROM income WHERE trip_id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public Map<String, Object> save(int tripId, BigDecimal grossIncome,
                                    BigDecimal driverIncome, BigDecimal conductorIncome,
                                    BigDecimal driverBond, BigDecimal conductorBond,
                                    BigDecimal commission) throws SQLException {
        String sql =
            "INSERT INTO income (trip_id, gross_income, driver_income, conductor_income, " +
            "driver_bond, conductor_bond, commission) VALUES (?, ?, ?, ?, ?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE gross_income=VALUES(gross_income), " +
            "driver_income=VALUES(driver_income), conductor_income=VALUES(conductor_income), " +
            "driver_bond=VALUES(driver_bond), conductor_bond=VALUES(conductor_bond), " +
            "commission=VALUES(commission)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            ps.setBigDecimal(2, grossIncome);
            ps.setBigDecimal(3, driverIncome);
            ps.setBigDecimal(4, conductorIncome);
            ps.setBigDecimal(5, driverBond);
            ps.setBigDecimal(6, conductorBond);
            ps.setBigDecimal(7, commission);
            ps.executeUpdate();
        }
        return findByTripId(tripId);
    }

    private Map<String, Object> mapRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",              rs.getInt("id"));
        m.put("tripId",          rs.getInt("trip_id"));
        m.put("grossIncome",     rs.getBigDecimal("gross_income"));
        m.put("driverIncome",    rs.getBigDecimal("driver_income"));
        m.put("conductorIncome", rs.getBigDecimal("conductor_income"));
        m.put("driverBond",      rs.getBigDecimal("driver_bond"));
        m.put("conductorBond",   rs.getBigDecimal("conductor_bond"));
        m.put("commission",      rs.getBigDecimal("commission"));
        m.put("netIncome",       rs.getBigDecimal("net_income"));
        m.put("createdAt",       rs.getTimestamp("created_at"));
        m.put("updatedAt",       rs.getTimestamp("updated_at"));
        return m;
    }
}
