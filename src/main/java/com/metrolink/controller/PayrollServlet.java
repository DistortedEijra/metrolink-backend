package com.metrolink.controller;

import com.metrolink.dao.PayrollDAO;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;

@WebServlet("/api/payroll/*")
public class PayrollServlet extends HttpServlet {

    private final PayrollDAO payrollDAO = new PayrollDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            String pathInfo = req.getPathInfo();

            if ("/compute".equals(pathInfo)) {
                LocalDate from = LocalDate.parse(req.getParameter("from"));
                LocalDate to   = LocalDate.parse(req.getParameter("to"));
                ResponseUtil.success(res, payrollDAO.computePayroll(from, to));

            } else if ("/summary".equals(pathInfo)) {
                LocalDate from = LocalDate.parse(req.getParameter("from"));
                LocalDate to   = LocalDate.parse(req.getParameter("to"));
                ResponseUtil.success(res, payrollDAO.getCompanySummary(from, to));

            } else if ("/records".equals(pathInfo)) {
                LocalDate from = LocalDate.parse(req.getParameter("from"));
                LocalDate to   = LocalDate.parse(req.getParameter("to"));
                ResponseUtil.success(res, payrollDAO.getPayrollRecords(from, to));

            } else {
                ResponseUtil.error(res, 404, "Unknown payroll path");
            }
        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            String pathInfo = req.getPathInfo();

            if ("/generate".equals(pathInfo)) {
                Map<String, Object> body = ResponseUtil.parseBody(req);
                LocalDate from = LocalDate.parse((String) body.get("from"));
                LocalDate to   = LocalDate.parse((String) body.get("to"));
                int userId = (int) req.getAttribute("userId");
                int inserted = payrollDAO.generatePayroll(from, to, userId);
                ResponseUtil.success(res, Map.of("generated", inserted));
            } else {
                ResponseUtil.error(res, 404, "Unknown payroll path");
            }
        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        if ("PATCH".equalsIgnoreCase(req.getMethod())) {
            doPatch(req, res);
        } else {
            super.service(req, res);
        }
    }

    protected void doPatch(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            String pathInfo = req.getPathInfo();
            // PATCH /api/payroll/{id}/pay
            if (pathInfo != null && pathInfo.endsWith("/pay")) {
                String[] parts = pathInfo.split("/");
                int recordId = Integer.parseInt(parts[1]);
                int userId   = (int) req.getAttribute("userId");
                boolean ok   = payrollDAO.markAsPaid(recordId, userId);
                ResponseUtil.success(res, Map.of("updated", ok));
            } else {
                ResponseUtil.error(res, 404, "Unknown payroll path");
            }
        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    private void requireAdmin(HttpServletRequest req) {
        if (!"ADMIN".equals(req.getAttribute("role")))
            throw new SecurityException("Admin access required");
    }
}
