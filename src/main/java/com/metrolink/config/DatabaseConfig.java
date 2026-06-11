package com.metrolink.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Singleton database connection manager using HikariCP connection pool.
 * Reads config from config.properties.
 */
public class DatabaseConfig {

    private static HikariDataSource dataSource;

    private DatabaseConfig() {}

    public static Connection getConnection() throws SQLException {
        ensureDataSource();
        return dataSource.getConnection();
    }

    public static void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }

    private static synchronized void ensureDataSource() throws SQLException {
        if (dataSource != null && !dataSource.isClosed()) {
            return;
        }

        try {
            Properties props = loadProperties();
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(resolveUrl(props));
            config.setUsername(firstNonBlank(env("DB_USERNAME"), env("MYSQLUSER"), props.getProperty("db.username"), "root"));
            config.setPassword(firstNonBlank(env("DB_PASSWORD"), env("MYSQLPASSWORD"), props.getProperty("db.password"), ""));
            config.setDriverClassName(props.getProperty("db.driver", "com.mysql.cj.jdbc.Driver"));
            config.setMaximumPoolSize(Integer.parseInt(props.getProperty("db.pool.maximumPoolSize", "10")));
            config.setMinimumIdle(Integer.parseInt(props.getProperty("db.pool.minimumIdle", "2")));
            config.setConnectionTimeout(Long.parseLong(props.getProperty("db.pool.connectionTimeout", "30000")));
            config.setIdleTimeout(Long.parseLong(props.getProperty("db.pool.idleTimeout", "600000")));
            config.setMaxLifetime(Long.parseLong(props.getProperty("db.pool.maxLifetime", "1800000")));
            config.setPoolName("MetrolinkPool");
            dataSource = new HikariDataSource(config);
        } catch (Exception e) {
            throw new SQLException("Failed to initialize database connection pool: " + e.getMessage(), e);
        }
    }

    /**
     * Resolves the JDBC URL with the following precedence: explicit DB_URL env
     * var, then a URL built from Railway-style MYSQLHOST/MYSQLPORT vars, then
     * config.properties, then a localhost default.
     */
    private static String resolveUrl(Properties props) {
        String url = env("DB_URL");
        if (url != null) return url;

        String host = env("MYSQLHOST");
        if (host != null) {
            String port = firstNonBlank(env("MYSQLPORT"), "3306");
            return "jdbc:mysql://" + host + ":" + port
                    + "/metrolink_db?useSSL=false&serverTimezone=Asia/Manila&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&useUnicode=true";
        }

        return props.getProperty("db.url",
                "jdbc:mysql://localhost:3306/metrolink_db?useSSL=false&serverTimezone=Asia/Manila&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&useUnicode=true");
    }

    private static String env(String name) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? null : v;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static Properties loadProperties() {
        Properties props = new Properties();
        try (InputStream is = DatabaseConfig.class
                .getClassLoader()
                .getResourceAsStream("config.properties")) {
            if (is != null) props.load(is);
        } catch (IOException e) {
            throw new RuntimeException("Could not load config.properties", e);
        }
        return props;
    }
}
