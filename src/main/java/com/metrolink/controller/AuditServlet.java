package com.metrolink.controller;

import com.metrolink.dao.AuditDAO;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;

@WebServlet("/api/audit/*")
public class AuditServlet extends HttpServlet {

    private final AuditDAO auditDAO = new AuditDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            if (!"ADMIN".equals(req.getAttribute("role"))) {
                ResponseUtil.error(res, 403, "Admin access required");
                return;
            }
            String fromStr = req.getParameter("from");
            String toStr   = req.getParameter("to");
            LocalDate from = (fromStr != null && !fromStr.isBlank()) ? LocalDate.parse(fromStr) : LocalDate.now().minusDays(30);
            LocalDate to   = (toStr   != null && !toStr.isBlank())   ? LocalDate.parse(toStr)   : LocalDate.now();
            ResponseUtil.success(res, auditDAO.findAll(from, to));
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }
}
