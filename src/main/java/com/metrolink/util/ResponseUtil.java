package com.metrolink.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Utility for writing standardized JSON responses.
 */
public class ResponseUtil {

    private static final ObjectMapper mapper;

    static {
        mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    public static ObjectMapper getMapper() {
        return mapper;
    }

    /** Write a success response: { "success": true, "data": ... } */
    public static void success(HttpServletResponse res, Object data) throws IOException {
        res.setStatus(HttpServletResponse.SC_OK);
        res.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new HashMap<>();
        body.put("success", true);
        body.put("data", data);
        mapper.writeValue(res.getWriter(), body);
    }

    /** Write a created (201) response */
    public static void created(HttpServletResponse res, Object data) throws IOException {
        res.setStatus(HttpServletResponse.SC_CREATED);
        res.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new HashMap<>();
        body.put("success", true);
        body.put("data", data);
        mapper.writeValue(res.getWriter(), body);
    }

    /** Write an error response: { "success": false, "message": ... } */
    public static void error(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("message", message);
        mapper.writeValue(res.getWriter(), body);
    }

    /** Parse the request body into a Map */
    public static Map<String, Object> parseBody(jakarta.servlet.http.HttpServletRequest req) throws IOException {
        return mapper.readValue(req.getInputStream(), Map.class);
    }
}
