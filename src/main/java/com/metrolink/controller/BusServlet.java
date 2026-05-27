package com.metrolink.controller;

import com.metrolink.dao.AuditDAO;
import com.metrolink.dao.BusDAO;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;

/**
 * /api/buses         GET (all/active by role), POST (admin)
 * /api/buses/{id}    GET, PUT (admin)
 * /api/buses/{id}/status  PATCH (admin)
 */
@WebServlet("/api/buses/*")
public class BusServlet extends HttpServlet {

    private final BusDAO   dao      = new BusDAO();
    private final AuditDAO auditDAO = new AuditDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();
            String role = (String) req.getAttribute("role");

            if (pathInfo == null || pathInfo.equals("/")) {
                var list = "ADMIN".equals(role) ? dao.findAll() : dao.findActive();
                ResponseUtil.success(res, list);
            } else {
                int id = parseId(pathInfo);
                var bus = dao.findById(id);
                if (bus == null) { ResponseUtil.error(res, 404, "Bus not found"); return; }
                ResponseUtil.success(res, bus);
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
            String busNumber = (String) body.get("busNumber");
            String plateNo   = (String) body.get("plateNo");
            String model     = (String) body.getOrDefault("model", "");
            if (busNumber == null || plateNo == null) {
                ResponseUtil.error(res, 400, "busNumber and plateNo are required"); return;
            }
            var created = dao.create(busNumber, plateNo, model);
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "CREATE_BUS", "BUS", (Integer) created.get("id"), "busNumber=" + busNumber);
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
            dao.update(id, (String) body.get("busNumber"), (String) body.get("plateNo"), (String) body.get("model"));
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "UPDATE_BUS", "BUS", id, null);
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
                boolean isActive = (Boolean) body.get("isActive");
                dao.setActive(id, isActive);
                int userId = (int) req.getAttribute("userId");
                String username = (String) req.getAttribute("username");
                auditDAO.log(userId, username, "CHANGE_BUS_STATUS", "BUS", id, "isActive=" + isActive);
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
