package com.metrolink.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metrolink.dao.*;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import jakarta.servlet.ServletException;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;

/**
 * /api/trips           GET (all), POST (create)
 * /api/trips/{id}      GET, PUT (admin — edit trip with changelog)
 * /api/trips/search    GET ?q=keyword
 * /api/trips/date      GET ?date=YYYY-MM-DD
 * /api/trips/range     GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * /api/trips/{id}/income    GET, POST
 * /api/trips/{id}/expenses  GET, POST
 */
@WebServlet("/api/trips/*")
public class TripServlet extends HttpServlet {

    private final TripDAO      tripDAO      = new TripDAO();
    private final IncomeDAO    incomeDAO    = new IncomeDAO();
    private final ExpensesDAO  expensesDAO  = new ExpensesDAO();
    private final ChangelogDAO changelogDAO = new ChangelogDAO();
    private final AuditDAO     auditDAO     = new AuditDAO();
    private final EmployeeDAO  employeeDAO  = new EmployeeDAO();
    private final BusDAO       busDAO       = new BusDAO();
    private final ObjectMapper mapper       = ResponseUtil.getMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
                ResponseUtil.success(res, tripDAO.findAll());
                return;
            }

            if (pathInfo.equals("/available-staff")) {
                LocalDate date    = LocalDate.parse(req.getParameter("date"));
                String excludeStr = req.getParameter("excludeTripId");
                int excludeId     = (excludeStr != null && !excludeStr.isBlank()) ? Integer.parseInt(excludeStr) : 0;
                var drivers    = employeeDAO.findAvailableForDate(date, excludeId, "DRIVER");
                var conductors = employeeDAO.findAvailableForDate(date, excludeId, "CONDUCTOR");
                var buses      = busDAO.findAvailableForDate(date, excludeId);
                ResponseUtil.success(res, Map.of("drivers", drivers, "conductors", conductors, "buses", buses));
                return;
            }

            if (pathInfo.equals("/search")) {
                String q = req.getParameter("q");
                if (q == null || q.isBlank()) { ResponseUtil.error(res, 400, "Query param 'q' required"); return; }
                ResponseUtil.success(res, tripDAO.search(q));
                return;
            }
            if (pathInfo.equals("/date")) {
                String dateStr = req.getParameter("date");
                ResponseUtil.success(res, tripDAO.findByDate(LocalDate.parse(dateStr)));
                return;
            }
            if (pathInfo.equals("/range")) {
                LocalDate from = LocalDate.parse(req.getParameter("from"));
                LocalDate to   = LocalDate.parse(req.getParameter("to"));
                ResponseUtil.success(res, tripDAO.findByDateRange(from, to));
                return;
            }

            String[] parts = pathInfo.split("/");
            int id = Integer.parseInt(parts[1]);

            if (parts.length == 3 && parts[2].equals("income")) {
                var income = incomeDAO.findByTripId(id);
                if (income == null) { ResponseUtil.error(res, 404, "Income record not found"); return; }
                ResponseUtil.success(res, income);
                return;
            }
            if (parts.length == 3 && parts[2].equals("expenses")) {
                var expenses = expensesDAO.findByTripId(id);
                if (expenses == null) { ResponseUtil.error(res, 404, "Expenses record not found"); return; }
                ResponseUtil.success(res, expenses);
                return;
            }

            var trip = tripDAO.findById(id);
            if (trip == null) { ResponseUtil.error(res, 404, "Trip not found"); return; }
            ResponseUtil.success(res, trip);

        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");

            // POST /api/trips/{id}/income
            if (pathInfo != null && pathInfo.matches("/\\d+/income")) {
                int tripId = Integer.parseInt(pathInfo.split("/")[1]);
                Map<String, Object> body = ResponseUtil.parseBody(req);
                var before = incomeDAO.findByTripId(tripId);
                var saved = incomeDAO.save(
                    tripId,
                    bd(body, "grossIncome"),
                    bd(body, "driverIncome"),
                    bd(body, "conductorIncome"),
                    bd(body, "driverBond"),
                    bd(body, "conductorBond"),
                    bd(body, "commission")
                );
                
                if (before != null) {
                    boolean changed = diffBD(before, body, "grossIncome") ||
                                      diffBD(before, body, "driverIncome") ||
                                      diffBD(before, body, "conductorIncome") ||
                                      diffBD(before, body, "driverBond") ||
                                      diffBD(before, body, "conductorBond") ||
                                      diffBD(before, body, "commission");
                    if (changed) tripDAO.markModified(tripId, userId);
                }
                
                auditDAO.log(userId, username, "CREATE_INCOME", "TRIP", tripId, null);
                ResponseUtil.created(res, saved);
                return;
            }

            // POST /api/trips/{id}/expenses
            if (pathInfo != null && pathInfo.matches("/\\d+/expenses")) {
                int tripId = Integer.parseInt(pathInfo.split("/")[1]);
                Map<String, Object> body = ResponseUtil.parseBody(req);
                String  damageRemark = (String) body.get("damageRemark");
                Integer employeeId   = body.get("employeeId") != null
                    ? ((Number) body.get("employeeId")).intValue() : null;
                
                var before = expensesDAO.findByTripId(tripId);
                var saved = expensesDAO.save(
                    tripId,
                    bd(body, "diesel"),       bd(body, "washing"),
                    bd(body, "driverSalary"), bd(body, "overtime"),
                    bd(body, "nightDiff"),    bd(body, "bonus"),
                    bd(body, "cashAdvance"),  bd(body, "damages"),
                    damageRemark, employeeId,
                    bd(body, "otherExpenses")
                );

                if (before != null) {
                    boolean changed = diffBD(before, body, "diesel") || diffBD(before, body, "washing") ||
                                      diffBD(before, body, "driverSalary") || diffBD(before, body, "overtime") ||
                                      diffBD(before, body, "nightDiff") || diffBD(before, body, "bonus") ||
                                      diffBD(before, body, "cashAdvance") || diffBD(before, body, "damages") ||
                                      diffBD(before, body, "otherExpenses") ||
                                      !Objects.equals(normStr((String) before.get("damageRemark")), normStr(damageRemark)) ||
                                      !Objects.equals(before.get("employeeId"), employeeId);
                    if (changed) tripDAO.markModified(tripId, userId);
                }

                auditDAO.log(userId, username, "CREATE_EXPENSES", "TRIP", tripId, null);
                ResponseUtil.created(res, saved);
                return;
            }

            // POST /api/trips — create trip
            Map<String, Object> body = ResponseUtil.parseBody(req);
            LocalDate tripDate = LocalDate.parse((String) body.get("tripDate"));
            String dispatchTime = (String) body.get("dispatchTime");
            String arrivalTime = (String) body.getOrDefault("arrivalTime", null);
            LocalDate arrivalDate = resolveArrivalDate(tripDate, dispatchTime, arrivalTime,
                (String) body.getOrDefault("arrivalDate", null));
            var created = tripDAO.create(
                tripDate,
                (int) body.get("busId"),
                (int) body.get("driverId"),
                (int) body.get("conductorId"),
                dispatchTime,
                arrivalTime,
                arrivalDate,
                (int) body.getOrDefault("tripCount", 0),
                (String) body.getOrDefault("remarks", null),
                userId
            );
            auditDAO.log(userId, username, "CREATE_TRIP", "TRIP", (Integer) created.get("id"), null);
            ResponseUtil.created(res, created);

        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse res) throws ServletException, IOException {
        if ("PATCH".equalsIgnoreCase(req.getMethod())) {
            doPatch(req, res);
        } else {
            super.service(req, res);
        }
    }

    /** PATCH /api/trips/{id} — update arrival time only (staff + admin) */
    private void doPatch(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();
            if (pathInfo == null || pathInfo.equals("/")) {
                ResponseUtil.error(res, 400, "Trip ID required"); return;
            }
            int id = Integer.parseInt(pathInfo.split("/")[1]);
            int userId = (int) req.getAttribute("userId");
            String username = (String) req.getAttribute("username");

            Map<String, Object> body = ResponseUtil.parseBody(req);
            String arrivalTime = (String) body.getOrDefault("arrivalTime", null);

            var trip = tripDAO.findById(id);
            if (trip == null) { ResponseUtil.error(res, 404, "Trip not found"); return; }
            LocalDate arrivalDate = resolveArrivalDate(
                (LocalDate) trip.get("tripDate"), (String) trip.get("dispatchTime"),
                arrivalTime, (String) body.getOrDefault("arrivalDate", null));

            boolean updated = tripDAO.updateArrival(id, arrivalTime, arrivalDate);
            if (updated) {
                auditDAO.log(userId, username, "UPDATE_ARRIVAL", "TRIP", id, null);
            }
            ResponseUtil.success(res, Map.of("updated", updated));

        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req);
            int id = Integer.parseInt(req.getPathInfo().split("/")[1]);
            int editorId = (int) req.getAttribute("userId");
            String editorName = (String) req.getAttribute("username");

            var before = tripDAO.findById(id);
            if (before == null) { ResponseUtil.error(res, 404, "Trip not found"); return; }

            Map<String, Object> body = ResponseUtil.parseBody(req);
            
            LocalDate bodyTripDate = LocalDate.parse((String) body.get("tripDate"));
            int bodyBusId = (int) body.get("busId");
            int bodyDriverId = (int) body.get("driverId");
            int bodyConductorId = (int) body.get("conductorId");
            String bodyDispatchTime = (String) body.get("dispatchTime");
            String bodyArrivalTime = (String) body.getOrDefault("arrivalTime", null);
            LocalDate bodyArrivalDate = resolveArrivalDate(bodyTripDate, bodyDispatchTime, bodyArrivalTime,
                (String) body.getOrDefault("arrivalDate", null));
            int bodyTripCount = (int) body.getOrDefault("tripCount", 0);
            String bodyRemarks = (String) body.getOrDefault("remarks", null);

            boolean changed = !Objects.equals(before.get("tripDate"), bodyTripDate)
                           || !Objects.equals(before.get("busId"), bodyBusId)
                           || !Objects.equals(before.get("driverId"), bodyDriverId)
                           || !Objects.equals(before.get("conductorId"), bodyConductorId)
                           || !Objects.equals(normTime((String) before.get("dispatchTime")), normTime(bodyDispatchTime))
                           || !Objects.equals(normTime((String) before.get("arrivalTime")), normTime(bodyArrivalTime))
                           || !Objects.equals(before.get("arrivalDate"), bodyArrivalDate)
                           || !Objects.equals(before.get("tripCount"), bodyTripCount)
                           || !Objects.equals(normStr((String) before.get("remarks")), normStr(bodyRemarks));

            if (!changed) {
                ResponseUtil.success(res, Map.of("updated", false, "message", "No changes detected"));
                return;
            }

            boolean updated = tripDAO.update(
                id,
                bodyTripDate,
                bodyBusId,
                bodyDriverId,
                bodyConductorId,
                bodyDispatchTime,
                bodyArrivalTime,
                bodyArrivalDate,
                bodyTripCount,
                bodyRemarks,
                editorId
            );

            if (updated) {
                var after = tripDAO.findById(id);
                changelogDAO.log(id, editorId, "TRIP_DETAILS",
                    mapper.writeValueAsString(before),
                    mapper.writeValueAsString(after));
                auditDAO.log(editorId, editorName, "UPDATE_TRIP", "TRIP", id, null);
            }

            ResponseUtil.success(res, Map.of("updated", updated));

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

    private java.math.BigDecimal bd(Map<String, Object> body, String key) {
        return new java.math.BigDecimal(body.getOrDefault(key, 0).toString());
    }

    /**
     * Resolves the calendar date a trip arrived on. If the client supplied an explicit
     * arrivalDate, that wins. Otherwise, falls back to the day-rollover heuristic:
     * arrivalTime >= dispatchTime => arrived same day as tripDate, else the next day.
     */
    private LocalDate resolveArrivalDate(LocalDate tripDate, String dispatchTime,
                                          String arrivalTime, String arrivalDateStr) {
        if (arrivalTime == null || arrivalTime.isBlank()) return null;
        if (arrivalDateStr != null && !arrivalDateStr.isBlank()) return LocalDate.parse(arrivalDateStr);
        String at = normTime(arrivalTime);
        String dt = normTime(dispatchTime);
        return (dt != null && at.compareTo(dt) >= 0) ? tripDate : tripDate.plusDays(1);
    }

    private String normTime(String t) {
        if (t == null || t.isBlank()) return null;
        String[] p = t.split("\\.")[0].split(":");
        String hh = p.length > 0 ? p[0] : "00";
        String mm = p.length > 1 ? p[1] : "00";
        String ss = p.length > 2 ? p[2] : "00";
        return String.format("%2s:%2s:%2s", hh, mm, ss).replace(' ', '0');
    }

    private String normStr(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private boolean diffBD(Map<String, Object> existing, Map<String, Object> body, String key) {
        if (existing == null) return false;
        java.math.BigDecimal oldVal = (java.math.BigDecimal) existing.get(key);
        java.math.BigDecimal newVal = bd(body, key);
        if (oldVal == null && newVal == null) return false;
        if (oldVal == null || newVal == null) return true;
        return oldVal.compareTo(newVal) != 0;
    }
}