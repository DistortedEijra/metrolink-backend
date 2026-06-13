package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;
import java.time.LocalDate;
import java.util.*;

public class ReportDAO {

    public List<Map<String, Object>> getTripReport(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT t.id AS trip_id, t.trip_date, t.trip_count, t.status, " +
            "b.bus_number, d.full_name AS driver_name, co.full_name AS conductor_name, " +
            "i.gross_income, i.driver_income, i.conductor_income, " +
            "i.driver_bond, i.conductor_bond, i.commission, i.net_income, " +
            "e.total_expenses, " +
            "(i.net_income - e.total_expenses) AS net_profit " +
            "FROM trips t " +
            "JOIN buses b ON t.bus_id = b.id " +
            "JOIN employees d  ON t.driver_id = d.id " +
            "JOIN employees co ON t.conductor_id = co.id " +
            "LEFT JOIN income   i ON i.trip_id = t.id " +
            "LEFT JOIN expenses e ON e.trip_id = t.id " +
            "WHERE t.trip_date BETWEEN ? AND ? " +
            "ORDER BY t.trip_date, b.bus_number";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("tripId",          rs.getInt("trip_id"));
                    row.put("tripDate",        rs.getDate("trip_date") != null ? rs.getDate("trip_date").toLocalDate() : null);
                    row.put("tripCount",       rs.getObject("trip_count") != null ? rs.getInt("trip_count") : null);
                    row.put("status",          rs.getString("status"));
                    row.put("busNumber",       rs.getString("bus_number"));
                    row.put("driverName",      rs.getString("driver_name"));
                    row.put("conductorName",   rs.getString("conductor_name"));
                    row.put("grossIncome",     rs.getBigDecimal("gross_income"));
                    row.put("driverIncome",    rs.getBigDecimal("driver_income"));
                    row.put("conductorIncome", rs.getBigDecimal("conductor_income"));
                    row.put("driverBond",      rs.getBigDecimal("driver_bond"));
                    row.put("conductorBond",   rs.getBigDecimal("conductor_bond"));
                    row.put("commission",      rs.getBigDecimal("commission"));
                    row.put("netIncome",       rs.getBigDecimal("net_income"));
                    row.put("totalExpenses",   rs.getBigDecimal("total_expenses"));
                    row.put("netProfit",       rs.getBigDecimal("net_profit"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    public List<Map<String, Object>> getLowIncomeReport(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT t.id AS trip_id, t.trip_date, b.bus_number, " +
            "d.full_name AS driver_name, co.full_name AS conductor_name, " +
            "i.gross_income, i.net_income " +
            "FROM trips t " +
            "JOIN buses b ON t.bus_id = b.id " +
            "JOIN employees d  ON t.driver_id = d.id " +
            "JOIN employees co ON t.conductor_id = co.id " +
            "JOIN income i ON i.trip_id = t.id " +
            "WHERE t.trip_date BETWEEN ? AND ? AND i.gross_income < 13000 " +
            "ORDER BY i.gross_income ASC";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("tripId",        rs.getInt("trip_id"));
                    row.put("tripDate",      rs.getDate("trip_date").toLocalDate());
                    row.put("busNumber",     rs.getString("bus_number"));
                    row.put("driverName",    rs.getString("driver_name"));
                    row.put("conductorName", rs.getString("conductor_name"));
                    row.put("grossIncome",   rs.getBigDecimal("gross_income"));
                    row.put("netIncome",     rs.getBigDecimal("net_income"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    public Map<String, Object> getSummary(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT " +
            "COUNT(DISTINCT t.id)                              AS total_trips, " +
            "SUM(i.gross_income)                              AS total_gross_income, " +
            "SUM(i.driver_bond + i.conductor_bond)            AS total_bond_deduction, " +
            "SUM(i.driver_income + i.conductor_income)        AS total_operator_income, " +
            "SUM(i.commission)                                AS total_commission, " +
            "SUM(i.net_income)                                AS total_net_income, " +
            "SUM(e.total_expenses)                            AS total_expenses, " +
            "SUM(i.net_income - e.total_expenses)             AS total_net_profit, " +
            "AVG(i.gross_income)                              AS avg_gross_income " +
            "FROM trips t " +
            "LEFT JOIN income   i ON i.trip_id = t.id " +
            "LEFT JOIN expenses e ON e.trip_id = t.id " +
            "WHERE t.trip_date BETWEEN ? AND ?";

        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("totalTrips",          rs.getInt("total_trips"));
                    m.put("totalGrossIncome",    rs.getBigDecimal("total_gross_income"));
                    m.put("totalBondDeduction",  rs.getBigDecimal("total_bond_deduction"));
                    m.put("totalOperatorIncome", rs.getBigDecimal("total_operator_income"));
                    m.put("totalCommission",     rs.getBigDecimal("total_commission"));
                    m.put("totalNetIncome",      rs.getBigDecimal("total_net_income"));
                    m.put("totalExpenses",       rs.getBigDecimal("total_expenses"));
                    m.put("totalNetProfit",      rs.getBigDecimal("total_net_profit"));
                    m.put("avgGrossIncome",      rs.getBigDecimal("avg_gross_income"));
                    m.put("from",                from);
                    m.put("to",                  to);
                    return m;
                }
            }
        }
        return Collections.emptyMap();
    }

    public List<Map<String, Object>> getChangelogReport(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT cl.*, u.full_name AS changed_by_name, t.trip_date " +
            "FROM trip_changelogs cl " +
            "JOIN users u ON cl.changed_by = u.id " +
            "JOIN trips t ON cl.trip_id = t.id " +
            "WHERE t.trip_date BETWEEN ? AND ? " +
            "ORDER BY cl.changed_at DESC";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("changelogId",   rs.getInt("id"));
                    row.put("tripId",        rs.getInt("trip_id"));
                    row.put("tripDate",      rs.getDate("trip_date").toLocalDate());
                    row.put("changedBy",     rs.getInt("changed_by"));
                    row.put("changedByName", rs.getString("changed_by_name"));
                    row.put("changeType",    rs.getString("change_type"));
                    row.put("oldValue",      rs.getString("old_value"));
                    row.put("newValue",      rs.getString("new_value"));
                    row.put("changedAt",     rs.getTimestamp("changed_at"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }
}
