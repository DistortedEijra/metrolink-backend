package com.metrolink.controller;

import com.metrolink.dao.AuditDAO;
import com.metrolink.dao.BusDAO;
import com.metrolink.util.DiffUtil;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * /api/buses         GET (all), POST
 * /api/buses/{id}    GET, PUT
 * /api/buses/{id}/status  PATCH
 */
@WebServlet("/api/buses/*")
public class BusServlet extends HttpServlet {

    private final BusDAO   dao      = new BusDAO();
    private final AuditDAO auditDAO = new AuditDAO();

    private static final Map<String, String> BUS_DIFF_LABELS = new LinkedHashMap<>();
    static {
        BUS_DIFF_LABELS.put("busNumber", "Bus Number");
        BUS_DIFF_LABELS.put("plateNo", "Plate No.");
        BUS_DIFF_LABELS.put("model", "Model");
        BUS_DIFF_LABELS.put("franchiseNo", "Franchise No.");
        BUS_DIFF_LABELS.put("franchiseExpiry", "Franchise Expiry");
        BUS_DIFF_LABELS.put("registrationExpiry", "LTO Reg. Expiry");
        BUS_DIFF_LABELS.put("insuranceNo", "Insurance No.");
        BUS_DIFF_LABELS.put("insuranceExpiry", "Insurance Expiry");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
                ResponseUtil.success(res, dao.findAll());
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
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String busNumber = (String) body.get("busNumber");
            String plateNo   = (String) body.get("plateNo");
            String model     = (String) body.getOrDefault("model", "");
            if (busNumber == null || plateNo == null) {
                ResponseUtil.error(res, 400, "busNumber and plateNo are required"); return;
            }
            var created = dao.create(busNumber, plateNo, model,
                (String) body.getOrDefault("franchiseNo", null),
                parseDate(body.get("franchiseExpiry")),
                parseDate(body.get("registrationExpiry")),
                (String) body.getOrDefault("insuranceNo", null),
                parseDate(body.get("insuranceExpiry")));
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "CREATE_BUS", "BUS", (Integer) created.get("id"), "busNumber=" + busNumber);
            ResponseUtil.created(res, created);
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            int id = parseId(req.getPathInfo());
            Map<String, Object> body = ResponseUtil.parseBody(req);
            var before = dao.findById(id);
            dao.update(id, (String) body.get("busNumber"), (String) body.get("plateNo"), (String) body.get("model"),
                (String) body.getOrDefault("franchiseNo", null),
                parseDate(body.get("franchiseExpiry")),
                parseDate(body.get("registrationExpiry")),
                (String) body.getOrDefault("insuranceNo", null),
                parseDate(body.get("insuranceExpiry")));
            var after = dao.findById(id);
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");
            auditDAO.log(userId, username, "UPDATE_BUS", "BUS", id, DiffUtil.diff(before, after, BUS_DIFF_LABELS));
            ResponseUtil.success(res, Map.of("updated", true));
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
            String pathInfo = req.getPathInfo();
            if (pathInfo != null && pathInfo.endsWith("/status")) {
                int id = parseId(pathInfo.replace("/status", ""));
                Map<String, Object> body = ResponseUtil.parseBody(req);
                int userId = (int) req.getAttribute("userId");
                String username = (String) req.getAttribute("username");
                var before = dao.findById(id);
                if (body.containsKey("status")) {
                    String status = (String) body.get("status");
                    if (!java.util.Set.of("ACTIVE","INACTIVE","MAINTENANCE").contains(status)) {
                        ResponseUtil.error(res, 400, "Invalid status"); return;
                    }
                    dao.setStatus(id, status);
                    String details = "Status: " + DiffUtil.display(before != null ? before.get("status") : null) + " -> " + status;
                    auditDAO.log(userId, username, "CHANGE_BUS_STATUS", "BUS", id, details);
                    ResponseUtil.success(res, Map.of("updated", true, "status", status));
                } else {
                    Object isActiveValue = body.get("isActive");
                    if (!(isActiveValue instanceof Boolean)) {
                        ResponseUtil.error(res, 400, "status or isActive is required");
                        return;
                    }
                    boolean isActive = (Boolean) isActiveValue;
                    dao.setActive(id, isActive);
                    String details = "Active: " + DiffUtil.display(before != null ? before.get("isActive") : null) + " -> " + isActive;
                    auditDAO.log(userId, username, "CHANGE_BUS_STATUS", "BUS", id, details);
                    ResponseUtil.success(res, Map.of("updated", true, "isActive", isActive));
                }
            }
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    private int parseId(String pathInfo) {
        return Integer.parseInt(pathInfo.split("/")[1]);
    }

    private LocalDate parseDate(Object value) {
        if (!(value instanceof String s) || s.isBlank()) return null;
        return LocalDate.parse(s);
    }
}
