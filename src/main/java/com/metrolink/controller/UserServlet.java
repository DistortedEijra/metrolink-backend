package com.metrolink.controller;

import com.metrolink.dao.AuditDAO;
import com.metrolink.dao.UserDAO;
import com.metrolink.model.User;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.time.LocalDate;
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

    private final UserDAO  userDAO  = new UserDAO();
    private final AuditDAO auditDAO = new AuditDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            requireAdmin(req, res);
            String pathInfo = req.getPathInfo();

            if (pathInfo == null || pathInfo.equals("/")) {
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
            String username     = (String) body.get("username");
            String password     = (String) body.get("password");
            String fullName     = (String) body.get("fullName");
            String birthdateStr = (String) body.get("birthdate");
            String address      = (String) body.get("address");
            String email        = (String) body.get("email");
            String role         = (String) body.getOrDefault("role", "STAFF");
            LocalDate birthdate = (birthdateStr != null && !birthdateStr.isEmpty()) ? LocalDate.parse(birthdateStr) : null;

            if (username == null || password == null || fullName == null) {
                ResponseUtil.error(res, 400, "username, password, fullName are required"); return;
            }
            if (!Set.of("ADMIN", "STAFF").contains(role)) {
                ResponseUtil.error(res, 400, "role must be ADMIN or STAFF"); return;
            }

            String hashed = BCrypt.hashpw(password, BCrypt.gensalt(12));
            User created = userDAO.create(username, hashed, fullName, birthdate, address, email, role);
            int requesterId = (int) req.getAttribute("userId");
            String requesterName = (String) req.getAttribute("username");
            auditDAO.log(requesterId, requesterName, "CREATE_USER", "USER", created.getId(), "username=" + username);
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
            String fullName     = (String) body.get("fullName");
            String birthdateStr = (String) body.get("birthdate");
            String address      = (String) body.get("address");
            String email        = (String) body.get("email");
            String role         = (String) body.get("role");
            LocalDate birthdate = (birthdateStr != null && !birthdateStr.isEmpty()) ? LocalDate.parse(birthdateStr) : null;
            userDAO.update(id, fullName, birthdate, address, email, role);
            int requesterId = (int) req.getAttribute("userId");
            String requesterName = (String) req.getAttribute("username");
            auditDAO.log(requesterId, requesterName, "UPDATE_USER", "USER", id, null);
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
            int requesterId = (int) req.getAttribute("userId");
            String requesterName = (String) req.getAttribute("username");

            if (pathInfo != null && pathInfo.endsWith("/status")) {
                requireAdmin(req, res);
                int id = parseId(pathInfo.replace("/status", ""));
                Object isActiveValue = body.get("isActive");
                if (!(isActiveValue instanceof Boolean)) {
                    ResponseUtil.error(res, 400, "isActive is required");
                    return;
                }
                boolean isActive = (Boolean) isActiveValue;
                userDAO.setActive(id, isActive);
                auditDAO.log(requesterId, requesterName, "CHANGE_USER_STATUS", "USER", id, "isActive=" + isActive);
                ResponseUtil.success(res, Map.of("updated", true, "isActive", isActive));

            } else if (pathInfo != null && pathInfo.endsWith("/password")) {
                int targetId = parseId(pathInfo.replace("/password", ""));
                String requesterRole = (String) req.getAttribute("role");

                if (!requesterRole.equals("ADMIN") && requesterId != targetId) {
                    ResponseUtil.error(res, 403, "Forbidden"); return;
                }
                String newPassword = (String) body.get("newPassword");
                String hashed = BCrypt.hashpw(newPassword, BCrypt.gensalt(12));
                userDAO.updatePassword(targetId, hashed);
                auditDAO.log(requesterId, requesterName, "CHANGE_PASSWORD", "USER", targetId, null);
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

    private Map<String, Object> safeUser(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        u.getId());
        m.put("username",  u.getUsername());
        m.put("fullName",  u.getFullName());
        m.put("birthdate", u.getBirthdate());
        m.put("address",   u.getAddress());
        m.put("email",     u.getEmail());
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
        String[] parts = pathInfo.split("/");
        return Integer.parseInt(parts[1]);
    }
}
