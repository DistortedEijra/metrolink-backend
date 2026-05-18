package com.metrolink.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.Properties;

/**
 * JWT utility for generating and validating tokens.
 * Encodes userId, username, and role in the claims.
 */
public class JwtUtil {

    private static final String SECRET;
    private static final long   EXPIRATION_MS;

    static {
        Properties props = new Properties();
        try (InputStream is = JwtUtil.class.getClassLoader().getResourceAsStream("config.properties")) {
            props.load(is);
        } catch (IOException e) {
            throw new RuntimeException("Cannot load config.properties for JWT", e);
        }
        SECRET        = props.getProperty("jwt.secret");
        EXPIRATION_MS = Long.parseLong(props.getProperty("jwt.expirationMs", "86400000"));
    }

    private static Key getSigningKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    /** Generate a JWT token for an authenticated user. */
    public static String generateToken(int userId, String username, String role) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_MS))
                .signWith(getSigningKey())
                .compact();
    }

    /** Validate and parse a JWT token. Returns Claims if valid, throws otherwise. */
    public static Claims validateToken(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public static int getUserIdFromToken(String token) {
        return Integer.parseInt(validateToken(token).getSubject());
    }

    public static String getRoleFromToken(String token) {
        return (String) validateToken(token).get("role");
    }

    public static String getUsernameFromToken(String token) {
        return (String) validateToken(token).get("username");
    }

    /** Extract token from Authorization header (Bearer <token>) */
    public static String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
