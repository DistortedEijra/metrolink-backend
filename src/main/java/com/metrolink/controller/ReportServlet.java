package com.metrolink.controller;

import com.metrolink.dao.ReportDAO;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;

/**
 * /api/reports/trips      GET ?from=YYYY-MM-DD&to=YYYY-MM-DD  (full trip report)
 * /api/reports/summary    GET ?from=&to=                       (aggregated totals)
 * /api/reports/low-income GET ?from=&to=                       (gross < 13000 quota)
 * /api/reports/changelog  GET ?from=&to=                       (edited trip audit log)
 */
@WebServlet("/api/reports/*")
public class ReportServlet extends HttpServlet {

    private final ReportDAO dao = new ReportDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            String pathInfo = req.getPathInfo();
            LocalDate from = LocalDate.parse(req.getParameter("from"));
            LocalDate to   = LocalDate.parse(req.getParameter("to"));

            switch (pathInfo == null ? "/" : pathInfo) {
                case "/trips"      -> ResponseUtil.success(res, dao.getTripReport(from, to));
                case "/summary"    -> ResponseUtil.success(res, dao.getSummary(from, to));
                case "/low-income" -> ResponseUtil.success(res, dao.getLowIncomeReport(from, to));
                case "/changelog"  -> {
                    requireAdmin(req);
                    ResponseUtil.success(res, dao.getChangelogReport(from, to));
                }
                default -> ResponseUtil.error(res, 404, "Unknown report type");
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
