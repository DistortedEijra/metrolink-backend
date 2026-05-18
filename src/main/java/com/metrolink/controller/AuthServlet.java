package com.metrolink.controller;

import com.metrolink.dao.UserDAO;
import com.metrolink.model.User;
import com.metrolink.util.JwtUtil;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * POST /api/auth/login
 * Body: { "username": "...", "password": "..." }
 * Returns JWT token + user info
 */
@WebServlet("/api/auth/login")
public class AuthServlet extends HttpServlet {

    private final UserDAO userDAO = new UserDAO();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            Map<String, Object> body = ResponseUtil.parseBody(req);
            String username = (String) body.get("username");
            String password = (String) body.get("password");

            if (username == null || password == null) {
                ResponseUtil.error(res, 400, "Username and password are required");
                return;
            }

            User user = userDAO.findByUsername(username.trim());

            if (user == null || !user.isActive()) {
                ResponseUtil.error(res, 401, "Invalid credentials or account inactive");
                return;
            }

            if (!BCrypt.checkpw(password, user.getPassword())) {
                ResponseUtil.error(res, 401, "Invalid credentials or account inactive");
                return;
            }

            String token = JwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

            Map<String, Object> data = new HashMap<>();
            data.put("token",    token);
            data.put("userId",   user.getId());
            data.put("username", user.getUsername());
            data.put("fullName", user.getFullName());
            data.put("role",     user.getRole());

            ResponseUtil.success(res, data);

        } catch (Exception e) {
            ResponseUtil.error(res, 500, "Internal server error: " + e.getMessage());
        }
    }
}
