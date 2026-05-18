package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.math.BigDecimal;
import java.sql.*;
import java.util.LinkedHashMap;
import java.util.Map;

// ============================================================
// IncomeDAO
// ============================================================
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
                                    BigDecimal bondDeduction, BigDecimal commission) throws SQLException {
        // Upsert: insert or update if tripId already has an income record
        String sql = "INSERT INTO income (trip_id, gross_income, bond_deduction, commission) " +
                     "VALUES (?, ?, ?, ?) " +
                     "ON DUPLICATE KEY UPDATE gross_income=VALUES(gross_income), " +
                     "bond_deduction=VALUES(bond_deduction), commission=VALUES(commission)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            ps.setBigDecimal(2, grossIncome);
            ps.setBigDecimal(3, bondDeduction);
            ps.setBigDecimal(4, commission);
            ps.executeUpdate();
        }
        return findByTripId(tripId);
    }

    private Map<String, Object> mapRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",            rs.getInt("id"));
        m.put("tripId",        rs.getInt("trip_id"));
        m.put("grossIncome",   rs.getBigDecimal("gross_income"));
        m.put("bondDeduction", rs.getBigDecimal("bond_deduction"));
        m.put("commission",    rs.getBigDecimal("commission"));
        m.put("netIncome",     rs.getBigDecimal("net_income"));
        m.put("createdAt",     rs.getTimestamp("created_at"));
        m.put("updatedAt",     rs.getTimestamp("updated_at"));
        return m;
    }
}
