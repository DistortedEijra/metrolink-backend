package com.metrolink.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.After;
import org.junit.Test;

import java.lang.reflect.Field;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class DatabaseConfigTest {

    private static final String VALID_CONFIG = String.join(System.lineSeparator(),
            "db.url=jdbc:h2:mem:metrolink_test;DB_CLOSE_DELAY=-1",
            "db.username=sa",
            "db.password=",
            "db.driver=org.h2.Driver",
            "db.pool.maximumPoolSize=2",
            "db.pool.minimumIdle=1",
            "db.pool.connectionTimeout=1000",
            "db.pool.idleTimeout=10000",
            "db.pool.maxLifetime=30000",
            "");

    @After
    public void tearDown() throws Exception {
        writeConfig(VALID_CONFIG);
        DatabaseConfig.close();
        setDataSource(null);
    }

    @Test
    public void getConnectionInitializesPoolLazilyAndReturnsConnection() throws Exception {
        setDataSource(null);

        try (Connection connection = DatabaseConfig.getConnection()) {
            assertNotNull(connection);
            assertFalse(connection.isClosed());
        }

        HikariDataSource dataSource = getDataSource();
        assertNotNull(dataSource);
        assertFalse(dataSource.isClosed());
        assertEquals("MetrolinkPool", dataSource.getPoolName());
    }

    @Test
    public void getConnectionReusesExistingOpenPool() throws Exception {
        setDataSource(null);

        try (Connection ignored = DatabaseConfig.getConnection()) {
            HikariDataSource first = getDataSource();
            try (Connection ignoredAgain = DatabaseConfig.getConnection()) {
                assertSame(first, getDataSource());
            }
        }
    }

    @Test
    public void closeClosesExistingPool() throws Exception {
        setDataSource(null);
        try (Connection ignored = DatabaseConfig.getConnection()) {
            assertNotNull(ignored);
        }

        HikariDataSource dataSource = getDataSource();
        DatabaseConfig.close();

        assertTrue(dataSource.isClosed());
    }

    @Test
    public void getConnectionReinitializesAfterClose() throws Exception {
        setDataSource(null);
        try (Connection ignored = DatabaseConfig.getConnection()) {
            assertNotNull(ignored);
        }

        HikariDataSource first = getDataSource();
        DatabaseConfig.close();

        try (Connection ignored = DatabaseConfig.getConnection()) {
            assertNotNull(ignored);
        }

        assertNotSame(first, getDataSource());
        assertFalse(getDataSource().isClosed());
    }

    @Test
    public void failedInitializationDoesNotPoisonFutureAttempts() throws Exception {
        setDataSource(null);
        writeConfig(String.join(System.lineSeparator(),
                "db.url=jdbc:h2:mem:metrolink_test",
                "db.username=sa",
                "db.password=",
                "db.driver=com.metrolink.DoesNotExist",
                "db.pool.connectionTimeout=1000",
                ""));

        try {
            DatabaseConfig.getConnection();
            fail("Expected invalid driver configuration to fail");
        } catch (SQLException e) {
            assertTrue(e.getMessage().contains("Failed to initialize database connection pool"));
        }
        assertTrue(getDataSource() == null || getDataSource().isClosed());

        writeConfig(VALID_CONFIG);

        try (Connection connection = DatabaseConfig.getConnection()) {
            assertNotNull(connection);
            assertFalse(connection.isClosed());
        }
    }

    private static HikariDataSource getDataSource() throws Exception {
        Field field = DatabaseConfig.class.getDeclaredField("dataSource");
        field.setAccessible(true);
        return (HikariDataSource) field.get(null);
    }

    private static void setDataSource(HikariDataSource dataSource) throws Exception {
        Field field = DatabaseConfig.class.getDeclaredField("dataSource");
        field.setAccessible(true);
        HikariDataSource current = (HikariDataSource) field.get(null);
        if (current != null && !current.isClosed()) {
            current.close();
        }
        field.set(null, dataSource);
    }

    private static void writeConfig(String contents) throws Exception {
        URL resource = DatabaseConfig.class.getClassLoader().getResource("config.properties");
        if (resource == null) {
            throw new IllegalStateException("Test config.properties not found");
        }
        Files.writeString(Path.of(resource.toURI()), contents, StandardCharsets.UTF_8);
    }
}
