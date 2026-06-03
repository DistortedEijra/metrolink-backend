package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

public class PayrollDAO {

    // ── Compute payroll (preview, not saved) ─────────────────
    public List<Map<String, Object>> computePayroll(LocalDate from, LocalDate to) throws SQLException {
        // Drivers: one row per employee per working day — income stored directly in driver_income
        String driverSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  t.trip_date, " +
            "  COALESCE(SUM(i.driver_income), 0) AS base_pay, " +
            "  0 AS bonus_pay, " +
            "  COALESCE(SUM(i.driver_income), 0) AS gross_pay, " +
            "  COALESCE(SUM(i.driver_bond + COALESCE(ex.cash_advance, 0)), 0) AS deductions, " +
            "  COALESCE(SUM(i.driver_income), 0) " +
            "    - COALESCE(SUM(i.driver_bond + COALESCE(ex.cash_advance, 0)), 0) AS net_pay " +
            "FROM employees e " +
            "JOIN trips t ON t.driver_id = e.id AND t.trip_date BETWEEN ? AND ? " +
            "JOIN income i ON i.trip_id = t.id " +
            "LEFT JOIN expenses ex ON ex.trip_id = t.id " +
            "WHERE e.position = 'DRIVER' " +
            "GROUP BY e.id, e.full_name, e.employee_code, e.position, t.trip_date " +
            "ORDER BY t.trip_date, e.full_name";

        // Conductors: one row per employee per working day
        String conductorSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  t.trip_date, " +
            "  COALESCE(SUM(i.conductor_income), 0) AS base_pay, " +
            "  0 AS bonus_pay, " +
            "  COALESCE(SUM(i.conductor_income), 0) AS gross_pay, " +
            "  COALESCE(SUM(i.conductor_bond), 0) AS deductions, " +
            "  COALESCE(SUM(i.conductor_income), 0) - COALESCE(SUM(i.conductor_bond), 0) AS net_pay " +
            "FROM employees e " +
            "JOIN trips t ON t.conductor_id = e.id AND t.trip_date BETWEEN ? AND ? " +
            "JOIN income i ON i.trip_id = t.id " +
            "WHERE e.position = 'CONDUCTOR' " +
            "GROUP BY e.id, e.full_name, e.employee_code, e.position, t.trip_date " +
            "ORDER BY t.trip_date, e.full_name";

        // Fixed staff: one row per employee, trip_date = NULL
        String fixedSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  NULL AS trip_date, " +
            "  e.bi_monthly_rate AS base_pay, 0 AS bonus_pay, " +
            "  e.bi_monthly_rate AS gross_pay, 0 AS deductions, e.bi_monthly_rate AS net_pay " +
            "FROM employees e " +
            "WHERE e.position IN ('HR','OPERATIONS','MECHANIC') AND e.is_active = TRUE " +
            "ORDER BY e.position, e.full_name";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection()) {
            for (String sql : new String[]{driverSql, conductorSql}) {
                try (PreparedStatement ps = c.prepareStatement(sql)) {
                    ps.setDate(1, java.sql.Date.valueOf(from));
                    ps.setDate(2, java.sql.Date.valueOf(to));
                    rows.addAll(readRows(ps.executeQuery(), true));
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(fixedSql)) {
                rows.addAll(readRows(rs, false));
            }
        }
        return rows;
    }

    private List<Map<String, Object>> readRows(ResultSet rs, boolean hasDate) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("employeeId",   rs.getInt("employee_id"));
            row.put("fullName",     rs.getString("full_name"));
            row.put("employeeCode", rs.getString("employee_code"));
            row.put("position",     rs.getString("position"));
            java.sql.Date td = hasDate ? rs.getDate("trip_date") : null;
            row.put("tripDate",     td != null ? td.toLocalDate() : null);
            row.put("basePay",      rs.getBigDecimal("base_pay"));
            row.put("bonusPay",     rs.getBigDecimal("bonus_pay"));
            row.put("grossPay",     rs.getBigDecimal("gross_pay"));
            row.put("deductions",   rs.getBigDecimal("deductions"));
            row.put("netPay",       rs.getBigDecimal("net_pay"));
            rows.add(row);
        }
        return rows;
    }

    // ── Company financial summary ─────────────────────────────
    public Map<String, Object> getCompanySummary(LocalDate from, LocalDate to) throws SQLException {
        String tripSql =
            "SELECT " +
            "  COALESCE(SUM(i.gross_income), 0)                          AS total_gross, " +
            "  COALESCE(SUM(i.driver_income + i.conductor_income), 0)    AS total_operator_wages, " +
            "  COALESCE(SUM(i.driver_bond + i.conductor_bond), 0)        AS total_bonds, " +
            "  COALESCE(SUM(i.commission), 0)                            AS total_commission, " +
            "  COALESCE(SUM(i.net_income), 0)                            AS total_net_income, " +
            "  COALESCE(SUM(ex.total_expenses), 0)                       AS total_expenses, " +
            "  COALESCE(SUM(i.net_income - ex.total_expenses), 0)        AS net_profit " +
            "FROM trips t " +
            "JOIN income i ON i.trip_id = t.id " +
            "JOIN expenses ex ON ex.trip_id = t.id " +
            "WHERE t.trip_date BETWEEN ? AND ?";

        String fixedSql =
            "SELECT COALESCE(SUM(bi_monthly_rate), 0) AS fixed_payroll " +
            "FROM employees WHERE position IN ('HR','OPERATIONS','MECHANIC') AND is_active = TRUE";

        Map<String, Object> m = new LinkedHashMap<>();
        try (Connection c = DatabaseConfig.getConnection()) {
            try (PreparedStatement ps = c.prepareStatement(tripSql)) {
                ps.setDate(1, java.sql.Date.valueOf(from));
                ps.setDate(2, java.sql.Date.valueOf(to));
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        m.put("totalGrossIncome",    rs.getBigDecimal("total_gross"));
                        m.put("totalOperatorWages",  rs.getBigDecimal("total_operator_wages"));
                        m.put("totalBondsRetained",  rs.getBigDecimal("total_bonds"));
                        m.put("totalCommission",     rs.getBigDecimal("total_commission"));
                        m.put("totalNetIncome",      rs.getBigDecimal("total_net_income"));
                        m.put("totalExpenses",       rs.getBigDecimal("total_expenses"));
                        m.put("netProfit",           rs.getBigDecimal("net_profit"));
                    }
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(fixedSql)) {
                if (rs.next()) {
                    BigDecimal fixed = rs.getBigDecimal("fixed_payroll");
                    m.put("fixedStaffPayroll", fixed);
                    BigDecimal netProfit = (BigDecimal) m.getOrDefault("netProfit", BigDecimal.ZERO);
                    m.put("companyFinal", netProfit.subtract(fixed));
                }
            }
        }
        m.put("from", from);
        m.put("to",   to);
        return m;
    }

    // ── Generate (save) payroll records ──────────────────────
    public int generatePayroll(LocalDate from, LocalDate to, int createdBy) throws SQLException {
        List<Map<String, Object>> computed = computePayroll(from, to);

        // Build set of already-existing (employeeId, tripDate) pairs for this period
        String checkSql =
            "SELECT employee_id, trip_date FROM payroll_records " +
            "WHERE period_start = ? AND period_end = ?";
        Set<String> existing = new HashSet<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(checkSql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    java.sql.Date td = rs.getDate("trip_date");
                    existing.add(rs.getInt("employee_id") + "|" + (td != null ? td.toString() : "null"));
                }
            }
        }

        String ins =
            "INSERT INTO payroll_records " +
            "(period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING')";

        int count = 0;
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(ins)) {
            for (Map<String, Object> row : computed) {
                int empId = (int) row.get("employeeId");
                LocalDate tripDate = (LocalDate) row.get("tripDate");
                String key = empId + "|" + (tripDate != null ? tripDate.toString() : "null");
                if (existing.contains(key)) continue;

                ps.setDate(1, java.sql.Date.valueOf(from));
                ps.setDate(2, java.sql.Date.valueOf(to));
                if (tripDate != null) ps.setDate(3, java.sql.Date.valueOf(tripDate));
                else ps.setNull(3, Types.DATE);
                ps.setInt(4, empId);
                ps.setBigDecimal(5, (BigDecimal) row.get("grossPay"));
                ps.setBigDecimal(6, (BigDecimal) row.get("deductions"));
                ps.setBigDecimal(7, (BigDecimal) row.get("netPay"));
                ps.addBatch();
                count++;
            }
            if (count > 0) ps.executeBatch();
        }
        return count;
    }

    // ── Fetch saved payroll records ───────────────────────────
    public List<Map<String, Object>> getPayrollRecords(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT pr.*, e.full_name, e.employee_code, e.position, " +
            "  u.full_name AS paid_by_name " +
            "FROM payroll_records pr " +
            "JOIN employees e ON pr.employee_id = e.id " +
            "LEFT JOIN users u ON pr.paid_by = u.id " +
            "WHERE pr.period_start = ? AND pr.period_end = ? " +
            "ORDER BY ISNULL(pr.trip_date), pr.trip_date, e.position, e.full_name";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",           rs.getInt("id"));
                    row.put("periodStart",  rs.getDate("period_start").toLocalDate());
                    row.put("periodEnd",    rs.getDate("period_end").toLocalDate());
                    java.sql.Date td = rs.getDate("trip_date");
                    row.put("tripDate",     td != null ? td.toLocalDate() : null);
                    row.put("employeeId",   rs.getInt("employee_id"));
                    row.put("fullName",     rs.getString("full_name"));
                    row.put("employeeCode", rs.getString("employee_code"));
                    row.put("position",     rs.getString("position"));
                    row.put("grossPay",     rs.getBigDecimal("gross_pay"));
                    row.put("deductions",   rs.getBigDecimal("deductions"));
                    row.put("netPay",       rs.getBigDecimal("net_pay"));
                    row.put("status",       rs.getString("status"));
                    row.put("paidAt",       rs.getTimestamp("paid_at"));
                    row.put("paidByName",   rs.getString("paid_by_name"));
                    row.put("notes",        rs.getString("notes"));
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    // ── Mark a record as paid ─────────────────────────────────
    public boolean markAsPaid(int recordId, int paidBy) throws SQLException {
        String sql = "UPDATE payroll_records SET status='PAID', paid_at=NOW(), paid_by=? WHERE id=?";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, paidBy);
            ps.setInt(2, recordId);
            return ps.executeUpdate() > 0;
        }
    }
}
