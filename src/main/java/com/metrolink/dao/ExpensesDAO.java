package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.math.BigDecimal;
import java.sql.*;
import java.util.LinkedHashMap;
import java.util.Map;

public class ExpensesDAO {

    public Map<String, Object> findByTripId(int tripId) throws SQLException {
        String sql = "SELECT * FROM expenses WHERE trip_id = ?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public Map<String, Object> save(int tripId, BigDecimal diesel, BigDecimal washing,
                                    BigDecimal driverSalary, BigDecimal overtime,
                                    BigDecimal nightDiff, BigDecimal bonus,
                                    BigDecimal cashAdvance, BigDecimal damages,
                                    BigDecimal otherExpenses) throws SQLException {
        String sql = "INSERT INTO expenses " +
                     "(trip_id, diesel, washing, driver_salary, overtime, night_diff, " +
                     "bonus, cash_advance, damages, other_expenses) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                     "ON DUPLICATE KEY UPDATE " +
                     "diesel=VALUES(diesel), washing=VALUES(washing), " +
                     "driver_salary=VALUES(driver_salary), overtime=VALUES(overtime), " +
                     "night_diff=VALUES(night_diff), bonus=VALUES(bonus), " +
                     "cash_advance=VALUES(cash_advance), damages=VALUES(damages), " +
                     "other_expenses=VALUES(other_expenses)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            ps.setBigDecimal(2, diesel);
            ps.setBigDecimal(3, washing);
            ps.setBigDecimal(4, driverSalary);
            ps.setBigDecimal(5, overtime);
            ps.setBigDecimal(6, nightDiff);
            ps.setBigDecimal(7, bonus);
            ps.setBigDecimal(8, cashAdvance);
            ps.setBigDecimal(9, damages);
            ps.setBigDecimal(10, otherExpenses);
            ps.executeUpdate();
        }
        return findByTripId(tripId);
    }

    private Map<String, Object> mapRow(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",             rs.getInt("id"));
        m.put("tripId",         rs.getInt("trip_id"));
        m.put("diesel",         rs.getBigDecimal("diesel"));
        m.put("washing",        rs.getBigDecimal("washing"));
        m.put("driverSalary",   rs.getBigDecimal("driver_salary"));
        m.put("overtime",       rs.getBigDecimal("overtime"));
        m.put("nightDiff",      rs.getBigDecimal("night_diff"));
        m.put("bonus",          rs.getBigDecimal("bonus"));
        m.put("cashAdvance",    rs.getBigDecimal("cash_advance"));
        m.put("damages",        rs.getBigDecimal("damages"));
        m.put("otherExpenses",  rs.getBigDecimal("other_expenses"));
        m.put("totalExpenses",  rs.getBigDecimal("total_expenses"));
        m.put("createdAt",      rs.getTimestamp("created_at"));
        m.put("updatedAt",      rs.getTimestamp("updated_at"));
        return m;
    }
}
