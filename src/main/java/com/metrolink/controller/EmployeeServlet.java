package com.metrolink.controller;

import com.metrolink.dao.AuditDAO;
import com.metrolink.dao.EmployeeDAO;
import com.metrolink.model.Employee;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * /api/employees
 *   GET  - list all (Admin) or active only (Staff)
 *   POST - add new operator (Admin)
 *
 * /api/employees/{id}
 *   GET   - get by ID
 *   PUT   - update details (Admin)
 *
 * /api/employees/{id}/status
 *   PATCH - activate/deactivate (Admin)
 */
@WebServlet("/api/employees/*")
public class EmployeeServlet extends HttpServlet {

    private final EmployeeDAO dao      = new EmployeeDAO();
    private final AuditDAO    auditDAO = new AuditDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();
            String role = (String) req.getAttribute("role");

            if (pathInfo == null || pathInfo.equals("/")) {
                List<Employee> list = "ADMIN".equals(role) ? dao.findAll() : dao.findActive();
                ResponseUtil.success(res, list);
            } else {
                int id = parseId(pathInfo);
                Employee e = dao.findById(id);
                if (e == null) { ResponseUtil.error(res, 404, "Employee not found"); return; }
                ResponseUtil.success(res, e);
            }
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String employeeCode = (String) body.get("employeeCode");
            String fullName     = (String) body.get("fullName");
            String birthdateStr = (String) body.get("birthdate");
            String address      = (String) body.get("address");
            String position     = (String) body.get("position");
            LocalDate birthdate = (birthdateStr != null && !birthdateStr.isEmpty()) ? LocalDate.parse(birthdateStr) : null;

            if (employeeCode == null || fullName == null || position == null) {
                ResponseUtil.error(res, 400, "employeeCode, fullName, position are required"); return;
            }
            if (!Set.of("DRIVER","CONDUCTOR","HR","OPERATIONS","MECHANIC").contains(position)) {
                ResponseUtil.error(res, 400, "Invalid position"); return;
            }
            boolean isDaily = Set.of("DRIVER","CONDUCTOR").contains(position);
            BigDecimal dailyRate     = isDaily ? new BigDecimal(body.getOrDefault("dailyRate",     1225.00).toString()) : null;
            BigDecimal biMonthlyRate = isDaily ? null : new BigDecimal(body.getOrDefault("biMonthlyRate", 0).toString());
            Employee created = dao.create(employeeCode, fullName, birthdate, address, position, dailyRate, biMonthlyRate);
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "CREATE_EMPLOYEE", "EMPLOYEE", created.getId(), "code=" + employeeCode);
            ResponseUtil.created(res, created);
        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            int id = parseId(req.getPathInfo());
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String fullName     = (String) body.get("fullName");
            String birthdateStr = (String) body.get("birthdate");
            String address      = (String) body.get("address");
            String position     = (String) body.get("position");
            LocalDate birthdate = (birthdateStr != null && !birthdateStr.isEmpty()) ? LocalDate.parse(birthdateStr) : null;
            if (position != null && !Set.of("DRIVER","CONDUCTOR","HR","OPERATIONS","MECHANIC").contains(position)) {
                ResponseUtil.error(res, 400, "Invalid position"); return;
            }
            boolean isDaily = Set.of("DRIVER","CONDUCTOR").contains(position);
            BigDecimal dailyRate     = isDaily ? new BigDecimal(body.getOrDefault("dailyRate",     1225.00).toString()) : null;
            BigDecimal biMonthlyRate = isDaily ? null : new BigDecimal(body.getOrDefault("biMonthlyRate", 0).toString());
            dao.update(id, fullName, birthdate, address, position, dailyRate, biMonthlyRate);
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "UPDATE_EMPLOYEE", "EMPLOYEE", id, null);
            ResponseUtil.success(res, Map.of("updated", true));
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
            if (pathInfo != null && pathInfo.endsWith("/status")) {
                int id = parseId(pathInfo.replace("/status", ""));
                Map<String, Object> body = ResponseUtil.parseBody(req);
                Object isActiveValue = body.get("isActive");
                if (!(isActiveValue instanceof Boolean)) {
                    ResponseUtil.error(res, 400, "isActive is required");
                    return;
                }
                boolean isActive = (Boolean) isActiveValue;
                dao.setActive(id, isActive);
                int userId = (int) req.getAttribute("userId");
                String username = (String) req.getAttribute("username");
                auditDAO.log(userId, username, "CHANGE_EMPLOYEE_STATUS", "EMPLOYEE", id, "isActive=" + isActive);
                ResponseUtil.success(res, Map.of("updated", true, "isActive", isActive));
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

    private int parseId(String pathInfo) {
        return Integer.parseInt(pathInfo.split("/")[1]);
    }
}
