package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

public class PayrollDAO {

    private static final BigDecimal QUOTA      = new BigDecimal("13000");
    private static final BigDecimal BONUS_STEP = new BigDecimal("1000");
    private static final BigDecimal BONUS_RATE = new BigDecimal("100");

    public List<Map<String, Object>> computePayroll(LocalDate from, LocalDate to) throws SQLException {
        // Driver: base = daily_rate × distinct days driven
        //         bonus = FLOOR(GREATEST(0, gross_income - 13000) / 1000) × 100 per trip
        //         deductions = driver_bond + cash_advance
        String driverSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  COUNT(DISTINCT t.id)   AS trip_count, " +
            "  COUNT(DISTINCT t.trip_date) AS days_worked, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) AS base_pay, " +
            "  COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) AS bonus_pay, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) + " +
            "    COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) AS gross_pay, " +
            "  COALESCE(SUM(i.driver_bond + COALESCE(ex.cash_advance, 0)), 0) AS deductions, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) + " +
            "    COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) - " +
            "    COALESCE(SUM(i.driver_bond + COALESCE(ex.cash_advance, 0)), 0) AS net_pay " +
            "FROM employees e " +
            "JOIN trips t ON t.driver_id = e.id AND t.trip_date BETWEEN ? AND ? " +
            "JOIN income i ON i.trip_id = t.id " +
            "LEFT JOIN expenses ex ON ex.trip_id = t.id " +
            "WHERE e.position = 'DRIVER' " +
            "GROUP BY e.id, e.full_name, e.employee_code, e.position, e.daily_rate";

        // Conductor: same formula, uses conductor_bond (no cash_advance deduction)
        String conductorSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  COUNT(DISTINCT t.id)   AS trip_count, " +
            "  COUNT(DISTINCT t.trip_date) AS days_worked, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) AS base_pay, " +
            "  COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) AS bonus_pay, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) + " +
            "    COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) AS gross_pay, " +
            "  COALESCE(SUM(i.conductor_bond), 0) AS deductions, " +
            "  ROUND(e.daily_rate * COUNT(DISTINCT t.trip_date), 2) + " +
            "    COALESCE(SUM(FLOOR(GREATEST(0, i.gross_income - 13000) / 1000) * 100), 0) - " +
            "    COALESCE(SUM(i.conductor_bond), 0) AS net_pay " +
            "FROM employees e " +
            "JOIN trips t ON t.conductor_id = e.id AND t.trip_date BETWEEN ? AND ? " +
            "JOIN income i ON i.trip_id = t.id " +
            "WHERE e.position = 'CONDUCTOR' " +
            "GROUP BY e.id, e.full_name, e.employee_code, e.position, e.daily_rate";

        // Fixed staff: bi_monthly_rate, no trip dependency
        String fixedSql =
            "SELECT e.id AS employee_id, e.full_name, e.employee_code, e.position, " +
            "  0 AS trip_count, 0 AS days_worked, " +
            "  e.bi_monthly_rate AS base_pay, 0 AS bonus_pay, " +
            "  e.bi_monthly_rate AS gross_pay, 0 AS deductions, e.bi_monthly_rate AS net_pay " +
            "FROM employees e " +
            "WHERE e.position IN ('HR','OPERATIONS','MECHANIC') AND e.is_active = TRUE";

        List<Map<String, Object>> rows = new ArrayList<>();
        try (Connection c = DatabaseConfig.getConnection()) {
            for (String[] pair : new String[][]{ {driverSql, "DRIVER"}, {conductorSql, "CONDUCTOR"} }) {
                try (PreparedStatement ps = c.prepareStatement(pair[0])) {
                    ps.setDate(1, java.sql.Date.valueOf(from));
                    ps.setDate(2, java.sql.Date.valueOf(to));
                    rows.addAll(readPayrollRows(ps.executeQuery()));
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(fixedSql)) {
                rows.addAll(readPayrollRows(rs));
            }
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> (String) r.get("position"))
                            .thenComparing(r -> (String) r.get("fullName")));
        return rows;
    }

    private List<Map<String, Object>> readPayrollRows(ResultSet rs) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("employeeId",   rs.getInt("employee_id"));
            row.put("fullName",     rs.getString("full_name"));
            row.put("employeeCode", rs.getString("employee_code"));
            row.put("position",     rs.getString("position"));
            row.put("tripCount",    rs.getInt("trip_count"));
            row.put("daysWorked",   rs.getInt("days_worked"));
            row.put("basePay",      rs.getBigDecimal("base_pay"));
            row.put("bonusPay",     rs.getBigDecimal("bonus_pay"));
            row.put("grossPay",     rs.getBigDecimal("gross_pay"));
            row.put("deductions",   rs.getBigDecimal("deductions"));
            row.put("netPay",       rs.getBigDecimal("net_pay"));
            rows.add(row);
        }
        return rows;
    }

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

    public int generatePayroll(LocalDate from, LocalDate to, int createdBy) throws SQLException {
        List<Map<String, Object>> computed = computePayroll(from, to);

        String checkSql = "SELECT employee_id FROM payroll_records WHERE period_start=? AND period_end=?";
        Set<Integer> existing = new HashSet<>();
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(checkSql)) {
            ps.setDate(1, java.sql.Date.valueOf(from));
            ps.setDate(2, java.sql.Date.valueOf(to));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) existing.add(rs.getInt("employee_id"));
            }
        }

        String ins = "INSERT INTO payroll_records " +
            "(period_start, period_end, employee_id, gross_pay, deductions, net_pay, trip_count, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')";
        int count = 0;
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(ins)) {
            for (Map<String, Object> row : computed) {
                int empId = (int) row.get("employeeId");
                if (existing.contains(empId)) continue;
                ps.setDate(1, java.sql.Date.valueOf(from));
                ps.setDate(2, java.sql.Date.valueOf(to));
                ps.setInt(3, empId);
                ps.setBigDecimal(4, (BigDecimal) row.get("grossPay"));
                ps.setBigDecimal(5, (BigDecimal) row.get("deductions"));
                ps.setBigDecimal(6, (BigDecimal) row.get("netPay"));
                ps.setInt(7, (int) row.get("tripCount"));
                ps.addBatch();
                count++;
            }
            if (count > 0) ps.executeBatch();
        }
        return count;
    }

    public List<Map<String, Object>> getPayrollRecords(LocalDate from, LocalDate to) throws SQLException {
        String sql =
            "SELECT pr.*, e.full_name, e.employee_code, e.position, " +
            "  u.full_name AS paid_by_name " +
            "FROM payroll_records pr " +
            "JOIN employees e ON pr.employee_id = e.id " +
            "LEFT JOIN users u ON pr.paid_by = u.id " +
            "WHERE pr.period_start = ? AND pr.period_end = ? " +
            "ORDER BY e.position, e.full_name";

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
                    row.put("employeeId",   rs.getInt("employee_id"));
                    row.put("fullName",     rs.getString("full_name"));
                    row.put("employeeCode", rs.getString("employee_code"));
                    row.put("position",     rs.getString("position"));
                    row.put("grossPay",     rs.getBigDecimal("gross_pay"));
                    row.put("deductions",   rs.getBigDecimal("deductions"));
                    row.put("netPay",       rs.getBigDecimal("net_pay"));
                    row.put("tripCount",    rs.getInt("trip_count"));
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
