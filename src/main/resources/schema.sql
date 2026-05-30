-- ============================================================
-- Metrolink Financial & Operational Management System
-- Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS metrolink_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE metrolink_db;

-- ============================================================
-- USERS TABLE (Staff accounts - Login module)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,          -- bcrypt hash
    full_name   VARCHAR(100) NOT NULL,
    role        ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- EMPLOYEES TABLE (Operators: Drivers & Conductors)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_code   VARCHAR(30)  NOT NULL UNIQUE,
    full_name       VARCHAR(100) NOT NULL,
    position        ENUM('DRIVER','CONDUCTOR','HR','OPERATIONS','MECHANIC') NOT NULL,
    daily_rate      DECIMAL(10,2) NOT NULL DEFAULT 1225.00,  -- base rate per doc
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- BUSES TABLE (Bus Management module)
-- ============================================================
CREATE TABLE IF NOT EXISTS buses (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    bus_number  VARCHAR(20)  NOT NULL UNIQUE,
    plate_no    VARCHAR(20)  NOT NULL UNIQUE,
    model       VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TRIPS TABLE (Trip Management module)
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    trip_date       DATE        NOT NULL,
    bus_id          INT         NOT NULL,
    driver_id       INT         NOT NULL,
    conductor_id    INT         NOT NULL,
    dispatch_time   TIME        NOT NULL,
    arrival_time    TIME,
    trip_count      INT         NOT NULL DEFAULT 0,  -- number of rotations (PITX->Monumento->PITX)
    remarks         TEXT,
    is_modified     BOOLEAN     NOT NULL DEFAULT FALSE,  -- flagged if admin edits it
    modified_by     INT,                                 -- user_id who last edited
    modified_at     DATETIME,
    created_by      INT         NOT NULL,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id)      REFERENCES buses(id),
    FOREIGN KEY (driver_id)   REFERENCES employees(id),
    FOREIGN KEY (conductor_id) REFERENCES employees(id),
    FOREIGN KEY (modified_by) REFERENCES users(id),
    FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ============================================================
-- INCOME TABLE (Income sub-module)
-- ============================================================
CREATE TABLE IF NOT EXISTS income (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    trip_id         INT            NOT NULL UNIQUE,   -- one income record per trip
    gross_income    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    driver_income   DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    conductor_income DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    driver_bond     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    conductor_bond  DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    commission      DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    net_income      DECIMAL(12,2)  GENERATED ALWAYS AS (gross_income - driver_bond - conductor_bond - commission) STORED,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- ============================================================
-- EXPENSES TABLE (Expenses sub-module)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    trip_id         INT            NOT NULL UNIQUE,   -- one expense record per trip
    diesel          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    washing         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    driver_salary   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    overtime        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    night_diff      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,  -- 8.69/hr per doc
    bonus           DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    cash_advance    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    damages         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    other_expenses  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    total_expenses  DECIMAL(12,2)  GENERATED ALWAYS AS (
                        diesel + washing + driver_salary + overtime +
                        night_diff + bonus + cash_advance + damages + other_expenses
                    ) STORED,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- ============================================================
-- TRIP CHANGELOGS TABLE (Audit trail for edited trips)
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_changelogs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    trip_id         INT          NOT NULL,
    changed_by      INT          NOT NULL,
    change_type     ENUM('TRIP_DETAILS', 'INCOME', 'EXPENSES') NOT NULL,
    old_value       JSON         NOT NULL,
    new_value       JSON         NOT NULL,
    changed_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id)    REFERENCES trips(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- ============================================================
-- AUDIT LOGS TABLE (System-wide action trail, admin-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT           NULL,
    username    VARCHAR(100)  NOT NULL,
    action      VARCHAR(100)  NOT NULL,
    entity      VARCHAR(50)   NULL,
    entity_id   INT           NULL,
    details     TEXT          NULL,
    logged_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES for Binary Search on date-based queries
-- ============================================================
CREATE INDEX idx_trips_date        ON trips(trip_date);
CREATE INDEX idx_trips_bus         ON trips(bus_id);
CREATE INDEX idx_income_trip       ON income(trip_id);
CREATE INDEX idx_expenses_trip     ON expenses(trip_id);
CREATE INDEX idx_changelogs_trip   ON trip_changelogs(trip_id);
CREATE INDEX idx_audit_logged_at   ON audit_logs(logged_at);

-- ============================================================
-- DEFAULT ADMIN SEED (password: admin123 — change on first login)
-- ============================================================
INSERT INTO users (username, password, full_name, role)
VALUES ('admin', '$2a$12$xRLFI0.LJaIPcHcFhHGUWeKdJLLxv3lmblWh7B1z0EeSGBnqHHyU2', 'System Administrator', 'ADMIN')
ON DUPLICATE KEY UPDATE username = username;
-- Note: hash above = bcrypt('admin123', 12)
