package com.metrolink.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metrolink.dao.*;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;

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
    private final ObjectMapper mapper       = ResponseUtil.getMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();   // null | "/" | "/123" | "/search" | etc.

            if (pathInfo == null || pathInfo.equals("/")) {
                ResponseUtil.success(res, tripDAO.findAll());
                return;
            }

            // Special paths
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

            // Sub-resources
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

            // Get single trip
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

            // POST /api/trips/{id}/income
            if (pathInfo != null && pathInfo.matches("/\\d+/income")) {
                int tripId = Integer.parseInt(pathInfo.split("/")[1]);
                Map<String, Object> body = ResponseUtil.parseBody(req);
                var saved = incomeDAO.save(
                    tripId,
                    bd(body, "grossIncome"),
                    bd(body, "driverIncome"),
                    bd(body, "conductorIncome"),
                    bd(body, "driverBond"),
                    bd(body, "conductorBond"),
                    bd(body, "commission")
                );
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
                var saved = expensesDAO.save(
                    tripId,
                    bd(body, "diesel"),       bd(body, "washing"),
                    bd(body, "driverSalary"), bd(body, "overtime"),
                    bd(body, "nightDiff"),    bd(body, "bonus"),
                    bd(body, "cashAdvance"),  bd(body, "damages"),
                    damageRemark, employeeId,
                    bd(body, "otherExpenses")
                );
                ResponseUtil.created(res, saved);
                return;
            }

            // POST /api/trips — create trip
            Map<String, Object> body = ResponseUtil.parseBody(req);
            var created = tripDAO.create(
                LocalDate.parse((String) body.get("tripDate")),
                (int) body.get("busId"),
                (int) body.get("driverId"),
                (int) body.get("conductorId"),
                (String) body.get("dispatchTime"),
                (String) body.getOrDefault("arrivalTime", null),
                (int) body.getOrDefault("tripCount", 0),
                (String) body.getOrDefault("remarks", null),
                userId
            );
            ResponseUtil.created(res, created);

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

            // Snapshot before edit for changelog
            var before = tripDAO.findById(id);
            if (before == null) { ResponseUtil.error(res, 404, "Trip not found"); return; }

            Map<String, Object> body = ResponseUtil.parseBody(req);
            boolean updated = tripDAO.update(
                id,
                LocalDate.parse((String) body.get("tripDate")),
                (int) body.get("busId"),
                (int) body.get("driverId"),
                (int) body.get("conductorId"),
                (String) body.get("dispatchTime"),
                (String) body.getOrDefault("arrivalTime", null),
                (int) body.getOrDefault("tripCount", 0),
                (String) body.getOrDefault("remarks", null),
                editorId
            );

            // Log change to audit trail
            if (updated) {
                var after = tripDAO.findById(id);
                changelogDAO.log(id, editorId, "TRIP_DETAILS",
                    mapper.writeValueAsString(before),
                    mapper.writeValueAsString(after));
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
}
