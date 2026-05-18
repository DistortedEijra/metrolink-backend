package com.metrolink.controller;

import com.metrolink.dao.UserDAO;
import com.metrolink.model.User;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * /api/users
 *   GET    - list all users (Admin)
 *   POST   - register new staff (Admin)
 *
 * /api/users/{id}
 *   GET    - get user by ID (Admin)
 *   PUT    - update user details (Admin)
 *
 * /api/users/{id}/status
 *   PATCH  - activate/deactivate staff (Admin)
 *
 * /api/users/{id}/password
 *   PATCH  - change password (Admin or self)
 */
@WebServlet("/api/users/*")
public class UserServlet extends HttpServlet {

    private final UserDAO userDAO = new UserDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req, res);
            String pathInfo = req.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
                // GET /api/users — list all
                List<User> users = userDAO.findAll();
                List<Map<String, Object>> result = users.stream()
                    .map(this::safeUser).collect(Collectors.toList());
                ResponseUtil.success(res, result);
            } else {
                int id = parseId(pathInfo);
                User user = userDAO.findById(id);
                if (user == null) { ResponseUtil.error(res, 404, "User not found"); return; }
                ResponseUtil.success(res, safeUser(user));
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
            requireAdmin(req, res);
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String username = (String) body.get("username");
            String password = (String) body.get("password");
            String fullName = (String) body.get("fullName");
            String role     = (String) body.getOrDefault("role", "STAFF");

            if (username == null || password == null || fullName == null) {
                ResponseUtil.error(res, 400, "username, password, fullName are required"); return;
            }
            if (!Set.of("ADMIN", "STAFF").contains(role)) {
                ResponseUtil.error(res, 400, "role must be ADMIN or STAFF"); return;
            }

            String hashed = BCrypt.hashpw(password, BCrypt.gensalt(12));
            User created = userDAO.create(username, hashed, fullName, role);
            ResponseUtil.created(res, safeUser(created));

        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("Duplicate")) {
                ResponseUtil.error(res, 409, "Username already exists");
            } else {
                ResponseUtil.error(res, 500, msg);
            }
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req, res);
            int id = parseId(req.getPathInfo());
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String fullName = (String) body.get("fullName");
            String role     = (String) body.get("role");
            userDAO.update(id, fullName, role);
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
            String pathInfo = req.getPathInfo();
            Map<String, Object> body = ResponseUtil.parseBody(req);

            if (pathInfo != null && pathInfo.endsWith("/status")) {
                requireAdmin(req, res);
                int id = parseId(pathInfo.replace("/status", ""));
                boolean isActive = (Boolean) body.get("isActive");
                userDAO.setActive(id, isActive);
                ResponseUtil.success(res, Map.of("updated", true, "isActive", isActive));

            } else if (pathInfo != null && pathInfo.endsWith("/password")) {
                int targetId = parseId(pathInfo.replace("/password", ""));
                int requesterId = (int) req.getAttribute("userId");
                String requesterRole = (String) req.getAttribute("role");

                // Only admin or the user themselves can change password
                if (!requesterRole.equals("ADMIN") && requesterId != targetId) {
                    ResponseUtil.error(res, 403, "Forbidden"); return;
                }
                String newPassword = (String) body.get("newPassword");
                String hashed = BCrypt.hashpw(newPassword, BCrypt.gensalt(12));
                userDAO.updatePassword(targetId, hashed);
                ResponseUtil.success(res, Map.of("updated", true));

            } else {
                ResponseUtil.error(res, 404, "Unknown PATCH path");
            }
        } catch (SecurityException e) {
            ResponseUtil.error(res, 403, e.getMessage());
        } catch (Exception e) {
            ResponseUtil.error(res, 500, e.getMessage());
        }
    }

    // Strip password from user object before sending
    private Map<String, Object> safeUser(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        u.getId());
        m.put("username",  u.getUsername());
        m.put("fullName",  u.getFullName());
        m.put("role",      u.getRole());
        m.put("isActive",  u.isActive());
        m.put("createdAt", u.getCreatedAt());
        return m;
    }

    private void requireAdmin(HttpServletRequest req, HttpServletResponse res) {
        String role = (String) req.getAttribute("role");
        if (!"ADMIN".equals(role)) throw new SecurityException("Admin access required");
    }

    private int parseId(String pathInfo) {
        // pathInfo looks like "/123" or "/123/status"
        String[] parts = pathInfo.split("/");
        return Integer.parseInt(parts[1]);
    }
}
