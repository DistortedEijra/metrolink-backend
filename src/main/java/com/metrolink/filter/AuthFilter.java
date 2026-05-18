package com.metrolink.filter;

import com.metrolink.util.JwtUtil;
import com.metrolink.util.ResponseUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Set;

/**
 * JWT Authentication Filter.
 * All /api/* routes are protected except /api/auth/login.
 * Sets userId, username, and role as request attributes for downstream use.
 */
@WebFilter("/api/*")
public class AuthFilter implements Filter {

    // Public routes that do NOT require a token
    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/api/auth/login"
    );

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest  req = (HttpServletRequest)  request;
        HttpServletResponse res = (HttpServletResponse) response;

        // CORS headers (for frontend integration)
        res.setHeader("Access-Control-Allow-Origin",  "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        // Preflight
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        String path = req.getServletPath();

        // Allow public paths without token
        if (PUBLIC_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        // Extract and validate token
        String authHeader = req.getHeader("Authorization");
        String token      = JwtUtil.extractToken(authHeader);

        if (token == null) {
            ResponseUtil.error(res, HttpServletResponse.SC_UNAUTHORIZED, "Missing Authorization token");
            return;
        }

        try {
            Claims claims = JwtUtil.validateToken(token);
            req.setAttribute("userId",   Integer.parseInt(claims.getSubject()));
            req.setAttribute("username", claims.get("username", String.class));
            req.setAttribute("role",     claims.get("role",     String.class));
            chain.doFilter(request, response);
        } catch (JwtException e) {
            ResponseUtil.error(res, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
        }
    }
}
