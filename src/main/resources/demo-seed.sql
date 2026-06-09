-- ============================================================
-- Metrolink FOMS — Demo Dataset (June 2026)
-- Run this AFTER schema.sql on a fresh install, or to refresh
-- an existing database to the latest demo state.
--
-- Covers: Trips, Income, Expenses, Trip Changelogs,
--         Payroll Records (June 1-15), Audit Log entries
-- ============================================================

USE metrolink_db;

-- ============================================================
-- CLEAN SLATE — wipe transactional tables before re-seeding
-- (safe to re-run; audit_logs kept to preserve history)
-- ============================================================
DELETE FROM trip_changelogs;
DELETE FROM payroll_records;
DELETE FROM income;
DELETE FROM expenses;
DELETE FROM trips;

-- ============================================================
-- USERS — staff accounts (admin already seeded by schema.sql)
-- ============================================================
INSERT INTO users (username, password, full_name, role)
VALUES
  ('jdelacruz', '$2a$12$xRLFI0.LJaIPcHcFhHGUWeKdJLLxv3lmblWh7B1z0EeSGBnqHHyU2', 'Dela Cruz, Juan R.', 'STAFF'),
  ('msantos',   '$2a$12$xRLFI0.LJaIPcHcFhHGUWeKdJLLxv3lmblWh7B1z0EeSGBnqHHyU2', 'Santos, Maria T.',   'STAFF')
ON DUPLICATE KEY UPDATE username = username;
-- Note: password hash = bcrypt('admin123', 12) — demo password for all accounts

-- ============================================================
-- EMPLOYEES — drivers, conductors, and support staff
-- ============================================================
INSERT INTO employees (employee_code, full_name, birthdate, address, position, daily_rate, bi_monthly_rate, is_active) VALUES
  ('DRV-001', 'Santos, Jose R.',      '1985-04-10', 'Las Piñas, Metro Manila',    'DRIVER',     1225.00, NULL,     TRUE),
  ('DRV-002', 'Reyes, Miguel A.',     '1988-11-23', 'Bacoor, Cavite',             'DRIVER',     1225.00, NULL,     TRUE),
  ('DRV-003', 'Cruz, Roberto M.',     '1990-06-15', 'Parañaque, Metro Manila',    'DRIVER',     1225.00, NULL,     TRUE),
  ('CON-001', 'Dela Cruz, Maria T.',  '1992-02-18', 'Pasay, Metro Manila',        'CONDUCTOR',  1225.00, NULL,     TRUE),
  ('CON-002', 'Villanueva, Ana L.',   '1995-09-05', 'Dasmariñas, Cavite',         'CONDUCTOR',  1225.00, NULL,     TRUE),
  ('CON-003', 'Mendoza, Liza P.',     '1993-07-30', 'Taguig, Metro Manila',       'CONDUCTOR',  1225.00, NULL,     TRUE),
  ('HR-001',  'Ramos, Elena B.',      '1980-03-22', 'Parañaque, Metro Manila',    'HR',         NULL,    12000.00, TRUE),
  ('OPS-001', 'Flores, Dante V.',     '1975-11-10', 'Las Piñas, Metro Manila',    'OPERATIONS', NULL,    10000.00, TRUE),
  ('MCH-001', 'Bautista, Carlo J.',   '1983-08-14', 'Bacoor, Cavite',             'MECHANIC',   NULL,    8500.00,  TRUE),
  ('DRV-004', 'Garcia, Ramon F.',     '1979-07-05', 'Cavite City, Cavite',        'DRIVER',     1225.00, NULL,     FALSE)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name), birthdate = VALUES(birthdate),
  address = VALUES(address), is_active = VALUES(is_active);

-- ============================================================
-- BUSES — fleet (0003 and 0005 in maintenance to demo status mix)
-- ============================================================
INSERT INTO buses (bus_number, plate_no, model, status, is_active) VALUES
  ('0001', 'BAC-1001', 'Hino RN2PSST',       'ACTIVE',       TRUE),
  ('0002', 'BAC-1002', 'Hino RN2PSST',       'ACTIVE',       TRUE),
  ('0003', 'BAC-1003', 'King Long XMQ6900',  'MAINTENANCE',  FALSE),
  ('0004', 'BAC-1004', 'King Long XMQ6900',  'ACTIVE',       TRUE),
  ('0005', 'BAC-1005', 'Hino RN2PSST',       'MAINTENANCE',  FALSE)
ON DUPLICATE KEY UPDATE
  model = VALUES(model), status = VALUES(status), is_active = VALUES(is_active);

-- ============================================================
-- CLEAN UP — remove anomalous zero-income duplicate trip
-- (June 3: bus 0001 assigned to wrong driver, 0 income recorded)
-- ============================================================
DELETE FROM trips
WHERE trip_date = '2026-06-03' AND bus_id = (SELECT id FROM buses WHERE bus_number = '0001')
  AND driver_id = (SELECT id FROM employees WHERE employee_code = 'DRV-003');

-- ============================================================
-- TRIPS — May 28 – June 9, 2026
-- Bus pairings: 0001→DRV-001/CON-001, 0002→DRV-002/CON-002, 0004→DRV-003/CON-003
-- Bus 0003 used in late-May data to show MAINTENANCE backstory
-- ============================================================
INSERT INTO trips (trip_date, bus_id, driver_id, conductor_id, dispatch_time, arrival_time, trip_count, remarks, is_modified, modified_by, modified_at, created_by)
SELECT * FROM (SELECT
  '2026-05-28' d, b.id bi, drv.id di, con.id ci, '05:30:00' dsp, '22:15:00' arr, 7  tc, NULL                                     rm, FALSE m, NULL mb, NULL            ma, 2 cb FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-05-28', b.id, drv.id, con.id, '05:30:00', '22:00:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-05-28', b.id, drv.id, con.id, '05:30:00', '21:45:00', 6,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0003' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
SELECT '2026-05-29', b.id, drv.id, con.id, '05:00:00', '22:30:00', 8,  'Updated trip count after field review',  TRUE,  u.id, '2026-05-29 20:05:00', 2 FROM buses b, employees drv, employees con, users u WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' AND u.username='admin' UNION ALL
SELECT '2026-05-29', b.id, drv.id, con.id, '05:00:00', '22:15:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-05-29', b.id, drv.id, con.id, '05:00:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0003' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
SELECT '2026-05-30', b.id, drv.id, con.id, '05:30:00', '21:00:00', 5,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-05-30', b.id, drv.id, con.id, '05:30:00', '20:45:00', 5,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-05-30', b.id, drv.id, con.id, '05:30:00', '20:30:00', 4,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0003' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
SELECT '2026-05-31', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-05-31', b.id, drv.id, con.id, '05:30:00', '21:00:00', 4,  'Low income — holiday eve traffic',       FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-01', b.id, drv.id, con.id, '05:30:00', '22:00:00', 8,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-01', b.id, drv.id, con.id, '05:30:00', '21:45:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-01', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
SELECT '2026-06-02', b.id, drv.id, con.id, '05:30:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-02', b.id, drv.id, con.id, '05:30:00', '21:45:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-02', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
SELECT '2026-06-03', b.id, drv.id, con.id, '05:30:00', '21:45:00', 7,  'Income corrected after recount',         TRUE,  u.id, '2026-06-03 21:30:00', 2 FROM buses b, employees drv, employees con, users u WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' AND u.username='admin' UNION ALL
SELECT '2026-06-03', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
-- June 4
SELECT '2026-06-04', b.id, drv.id, con.id, '05:30:00', '22:15:00', 8,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-04', b.id, drv.id, con.id, '05:30:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-04', b.id, drv.id, con.id, '05:30:00', '22:15:00', 8,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
-- June 5
SELECT '2026-06-05', b.id, drv.id, con.id, '05:30:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-05', b.id, drv.id, con.id, '05:30:00', '20:30:00', 5,  'Low income — heavy rain all day',        FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-05', b.id, drv.id, con.id, '05:30:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
-- June 6 (Saturday — reduced service)
SELECT '2026-06-06', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-06', b.id, drv.id, con.id, '05:30:00', '21:00:00', 5,  'Low income — Saturday',                  FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
-- June 7 (Sunday — minimal service)
SELECT '2026-06-07', b.id, drv.id, con.id, '06:00:00', '20:00:00', 4,  'Low income — Sunday reduced service',    FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-07', b.id, drv.id, con.id, '06:00:00', '20:30:00', 5,  'Low income — Sunday',                    FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' UNION ALL
-- June 8
SELECT '2026-06-08', b.id, drv.id, con.id, '05:30:00', '22:15:00', 8,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-08', b.id, drv.id, con.id, '05:30:00', '22:00:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-08', b.id, drv.id, con.id, '05:30:00', '22:00:00', 8,  'Expenses corrected by admin',            TRUE,  u.id, '2026-06-08 23:15:00', 3 FROM buses b, employees drv, employees con, users u WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003' AND u.username='admin' UNION ALL
-- June 9 (today)
SELECT '2026-06-09', b.id, drv.id, con.id, '05:30:00', '21:45:00', 7,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0001' AND drv.employee_code='DRV-001' AND con.employee_code='CON-001' UNION ALL
SELECT '2026-06-09', b.id, drv.id, con.id, '05:30:00', '21:30:00', 6,  NULL,                                     FALSE, NULL, NULL,            2 FROM buses b, employees drv, employees con WHERE b.bus_number='0002' AND drv.employee_code='DRV-002' AND con.employee_code='CON-002' UNION ALL
SELECT '2026-06-09', b.id, drv.id, con.id, '05:30:00', '21:45:00', 7,  NULL,                                     FALSE, NULL, NULL,            3 FROM buses b, employees drv, employees con WHERE b.bus_number='0004' AND drv.employee_code='DRV-003' AND con.employee_code='CON-003'
) AS src
ON DUPLICATE KEY UPDATE trip_count = VALUES(trip_count);

-- ============================================================
-- INCOME — one record per trip
-- Formula: driver_income=15%, conductor_income=10%,
--          driver_bond=3%, conductor_bond=2%, commission=5%
--          net_income (computed) = gross - bonds - commission = 90%
-- ============================================================
INSERT INTO income (trip_id, gross_income, driver_income, conductor_income, driver_bond, conductor_bond, commission)
SELECT t.id,
  g.gross,
  ROUND(g.gross * 0.15, 2),
  ROUND(g.gross * 0.10, 2),
  ROUND(g.gross * 0.03, 2),
  ROUND(g.gross * 0.02, 2),
  ROUND(g.gross * 0.05, 2)
FROM trips t
JOIN buses b   ON t.bus_id    = b.id
JOIN (VALUES
  ROW('2026-05-28','0001',14000), ROW('2026-05-28','0002',13500), ROW('2026-05-28','0003',12800),
  ROW('2026-05-29','0001',17500), ROW('2026-05-29','0002',16000), ROW('2026-05-29','0003',15000),
  ROW('2026-05-30','0001',11500), ROW('2026-05-30','0002',10800), ROW('2026-05-30','0003', 9200),
  ROW('2026-05-31','0001',13200), ROW('2026-05-31','0002', 8000),
  ROW('2026-06-01','0001',16000), ROW('2026-06-01','0002',15000), ROW('2026-06-01','0004',14000),
  ROW('2026-06-02','0001',15500), ROW('2026-06-02','0002',13500), ROW('2026-06-02','0004',13000),
  ROW('2026-06-03','0001',14200), ROW('2026-06-03','0002',13200),
  ROW('2026-06-04','0001',16800), ROW('2026-06-04','0002',15500), ROW('2026-06-04','0004',17200),
  ROW('2026-06-05','0001',15000), ROW('2026-06-05','0002',11500), ROW('2026-06-05','0004',15200),
  ROW('2026-06-06','0001',13500), ROW('2026-06-06','0002',11200),
  ROW('2026-06-07','0002', 9500), ROW('2026-06-07','0004',12500),
  ROW('2026-06-08','0001',17000), ROW('2026-06-08','0002',16200), ROW('2026-06-08','0004',16800),
  ROW('2026-06-09','0001',15500), ROW('2026-06-09','0002',14000), ROW('2026-06-09','0004',15800)
) AS g(trip_date, bus_num, gross) ON t.trip_date = g.trip_date AND b.bus_number = g.bus_num
ON DUPLICATE KEY UPDATE
  gross_income      = VALUES(gross_income),
  driver_income     = VALUES(driver_income),
  conductor_income  = VALUES(conductor_income),
  driver_bond       = VALUES(driver_bond),
  conductor_bond    = VALUES(conductor_bond),
  commission        = VALUES(commission);

-- ============================================================
-- EXPENSES — one record per trip
-- diesel ≈ trip_count × 325, washing = 250, driver_salary = 1225
-- overtime: trip_count ≥ 8 → 350; ≥ 7 → 200; else 0
-- night_diff: trip_count ≥ 7 → 75; else 0
-- ============================================================
INSERT INTO expenses (trip_id, diesel, washing, driver_salary, overtime, night_diff, bonus, cash_advance, damages, other_expenses)
SELECT t.id,
  t.trip_count * 325,
  250.00,
  1225.00,
  CASE WHEN t.trip_count >= 8 THEN 350.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END,
  CASE WHEN t.trip_count >= 7 THEN 75.00 ELSE 0.00 END,
  CASE WHEN i.gross_income >= 17000 THEN 300.00 ELSE 0.00 END,
  0.00, 0.00,
  CASE WHEN t.trip_count >= 6 THEN 150.00 ELSE 100.00 END
FROM trips t
JOIN income i ON t.id = i.trip_id
ON DUPLICATE KEY UPDATE
  diesel       = VALUES(diesel),
  overtime     = VALUES(overtime),
  night_diff   = VALUES(night_diff),
  bonus        = VALUES(bonus),
  other_expenses = VALUES(other_expenses);

-- ============================================================
-- TRIP CHANGELOGS — demonstrates the changelog report feature
-- ============================================================
INSERT INTO trip_changelogs (trip_id, changed_by, change_type, old_value, new_value, changed_at)
SELECT
  t.id,
  (SELECT id FROM users WHERE username = 'admin'),
  'TRIP_DETAILS',
  JSON_OBJECT(
    'id',           t.id,
    'tripDate',     DATE_FORMAT(t.trip_date, '%Y-%m-%d'),
    'busId',        t.bus_id,
    'driverId',     t.driver_id,
    'conductorId',  t.conductor_id,
    'tripCount',    t.trip_count - 1,
    'dispatchTime', t.dispatch_time,
    'arrivalTime',  t.arrival_time,
    'remarks',      NULL,
    'isModified',   FALSE
  ),
  JSON_OBJECT(
    'id',           t.id,
    'tripDate',     DATE_FORMAT(t.trip_date, '%Y-%m-%d'),
    'busId',        t.bus_id,
    'driverId',     t.driver_id,
    'conductorId',  t.conductor_id,
    'tripCount',    t.trip_count,
    'dispatchTime', t.dispatch_time,
    'arrivalTime',  t.arrival_time,
    'remarks',      t.remarks,
    'isModified',   TRUE
  ),
  t.modified_at
FROM trips t
WHERE t.is_modified = TRUE
  AND t.modified_at IS NOT NULL
ON DUPLICATE KEY UPDATE changed_at = VALUES(changed_at);

-- Changelog for expenses correction on June 8 bus 0004
INSERT INTO trip_changelogs (trip_id, changed_by, change_type, old_value, new_value, changed_at)
SELECT
  t.id,
  (SELECT id FROM users WHERE username = 'admin'),
  'EXPENSES',
  JSON_OBJECT('diesel', 2400.00, 'washing', 250.00, 'driverSalary', 1225.00,
              'overtime', 0.00, 'nightDiff', 0.00, 'bonus', 0.00,
              'cashAdvance', 0.00, 'damages', 0.00, 'otherExpenses', 100.00),
  JSON_OBJECT('diesel', e.diesel, 'washing', e.washing, 'driverSalary', e.driver_salary,
              'overtime', e.overtime, 'nightDiff', e.night_diff, 'bonus', e.bonus,
              'cashAdvance', e.cash_advance, 'damages', e.damages, 'otherExpenses', e.other_expenses),
  '2026-06-08 23:15:00'
FROM trips t
JOIN buses b    ON t.bus_id = b.id
JOIN expenses e ON t.id = e.trip_id
WHERE t.trip_date = '2026-06-08' AND b.bus_number = '0004'
ON DUPLICATE KEY UPDATE changed_at = VALUES(changed_at);

-- ============================================================
-- PAYROLL RECORDS — May 16-31 period (historical, already paid)
-- ============================================================
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-05-16', '2026-05-31', t.trip_date, t.driver_id,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END,
  395.00,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END - 395.00,
  1, 'PAID', CONCAT(t.trip_date + INTERVAL 1 DAY, ' 09:00:00'),
  (SELECT id FROM users WHERE username = 'admin')
FROM trips t
WHERE t.trip_date BETWEEN '2026-05-28' AND '2026-05-31'
ON DUPLICATE KEY UPDATE status = VALUES(status), paid_at = VALUES(paid_at);

INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-05-16', '2026-05-31', t.trip_date, t.conductor_id,
  1225.00, 395.00, 830.00, 1, 'PAID',
  CONCAT(t.trip_date + INTERVAL 1 DAY, ' 09:00:00'),
  (SELECT id FROM users WHERE username = 'admin')
FROM trips t
WHERE t.trip_date BETWEEN '2026-05-28' AND '2026-05-31'
ON DUPLICATE KEY UPDATE status = VALUES(status), paid_at = VALUES(paid_at);

-- Fixed staff — May 16-31 bi-monthly (PAID)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-05-16', '2026-05-31', NULL, e.id,
  e.bi_monthly_rate / 2,
  ROUND(e.bi_monthly_rate / 2 * 0.10, 2),
  ROUND(e.bi_monthly_rate / 2 * 0.90, 2),
  0, 'PAID', '2026-06-01 09:00:00',
  (SELECT id FROM users WHERE username = 'admin')
FROM employees e
WHERE e.position IN ('HR', 'OPERATIONS', 'MECHANIC') AND e.is_active = TRUE
ON DUPLICATE KEY UPDATE status = VALUES(status), paid_at = VALUES(paid_at);

-- ============================================================
-- PAYROLL RECORDS — June 1-15 current period
-- June 1-7: PAID  |  June 8-9: PENDING  |  Fixed staff: PENDING
-- ============================================================

-- Drivers (June 1-7, PAID)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-06-01', '2026-06-15', t.trip_date, t.driver_id,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END,
  395.00,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END - 395.00,
  1, 'PAID', CONCAT(t.trip_date + INTERVAL 1 DAY, ' 09:00:00'),
  (SELECT id FROM users WHERE username = 'admin')
FROM trips t
WHERE t.trip_date BETWEEN '2026-06-01' AND '2026-06-07'
ON DUPLICATE KEY UPDATE status = VALUES(status), paid_at = VALUES(paid_at);

-- Conductors (June 1-7, PAID)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-06-01', '2026-06-15', t.trip_date, t.conductor_id,
  1225.00, 395.00, 830.00, 1, 'PAID',
  CONCAT(t.trip_date + INTERVAL 1 DAY, ' 09:00:00'),
  (SELECT id FROM users WHERE username = 'admin')
FROM trips t
WHERE t.trip_date BETWEEN '2026-06-01' AND '2026-06-07'
ON DUPLICATE KEY UPDATE status = VALUES(status), paid_at = VALUES(paid_at);

-- Drivers (June 8-9, PENDING)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-06-01', '2026-06-15', t.trip_date, t.driver_id,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END,
  395.00,
  1225.00 + CASE WHEN t.trip_count >= 8 THEN 400.00 WHEN t.trip_count >= 7 THEN 200.00 ELSE 0.00 END - 395.00,
  1, 'PENDING', NULL, NULL
FROM trips t
WHERE t.trip_date BETWEEN '2026-06-08' AND '2026-06-09'
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Conductors (June 8-9, PENDING)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-06-01', '2026-06-15', t.trip_date, t.conductor_id,
  1225.00, 395.00, 830.00, 1, 'PENDING', NULL, NULL
FROM trips t
WHERE t.trip_date BETWEEN '2026-06-08' AND '2026-06-09'
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Fixed staff — June 1-15 bi-monthly (PENDING)
INSERT INTO payroll_records (period_start, period_end, trip_date, employee_id, gross_pay, deductions, net_pay, trip_count, status, paid_at, paid_by)
SELECT '2026-06-01', '2026-06-15', NULL, e.id,
  e.bi_monthly_rate / 2,
  ROUND(e.bi_monthly_rate / 2 * 0.10, 2),
  ROUND(e.bi_monthly_rate / 2 * 0.90, 2),
  0, 'PENDING', NULL, NULL
FROM employees e
WHERE e.position IN ('HR', 'OPERATIONS', 'MECHANIC') AND e.is_active = TRUE
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ============================================================
-- AUDIT LOG — representative June 2026 system activity
-- ============================================================
INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, logged_at) VALUES
  (1, 'admin',    'LOGIN_SUCCESS',    'USER',     1,  NULL,                                   '2026-06-01 07:45:10'),
  (2, 'jdelacruz','LOGIN_SUCCESS',    'USER',     2,  NULL,                                   '2026-06-01 08:02:33'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 1',      '2026-06-01 08:15:44'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 1',      '2026-06-01 08:18:02'),
  (3, 'msantos',  'LOGIN_SUCCESS',    'USER',     3,  NULL,                                   '2026-06-01 08:30:15'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 1',      '2026-06-01 08:35:21'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 1 payroll as PAID',        '2026-06-02 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 2',      '2026-06-02 08:10:05'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 2',      '2026-06-02 08:12:45'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 2',      '2026-06-02 08:22:11'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 2 payroll as PAID',        '2026-06-03 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 3',      '2026-06-03 08:11:30'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 3',      '2026-06-03 08:14:55'),
  (1, 'admin',    'TRIP_EDITED',      'TRIP',     NULL,'Corrected income recount — Bus 0001, Jun 3', '2026-06-03 21:30:00'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 3 payroll as PAID',        '2026-06-04 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 4',      '2026-06-04 08:08:40'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 4',      '2026-06-04 08:11:22'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 4',      '2026-06-04 08:20:55'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 4 payroll as PAID',        '2026-06-05 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 5',      '2026-06-05 08:09:14'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 5 (low income)', '2026-06-05 08:12:33'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 5',      '2026-06-05 08:21:07'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 5 payroll as PAID',        '2026-06-06 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 6 (Sat)', '2026-06-06 08:05:30'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 6 (Sat, low income)', '2026-06-06 08:08:15'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 6 payroll as PAID',        '2026-06-07 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 7 (Sun, low income)', '2026-06-07 08:30:40'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 7 (Sun, low income)', '2026-06-07 08:35:12'),
  (1, 'admin',    'PAYROLL_PAID',     'PAYROLL',  NULL,'Marked Jun 7 payroll as PAID',        '2026-06-08 09:00:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 8',      '2026-06-08 08:07:55'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 8',      '2026-06-08 08:10:20'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 8',      '2026-06-08 08:19:45'),
  (1, 'admin',    'TRIP_EDITED',      'TRIP',     NULL,'Corrected expenses — Bus 0004, Jun 8','2026-06-08 23:15:00'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0001, Jun 9',      '2026-06-09 08:06:18'),
  (2, 'jdelacruz','TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0002, Jun 9',      '2026-06-09 08:09:44'),
  (3, 'msantos',  'TRIP_CREATED',     'TRIP',     NULL,'Trip recorded: Bus 0004, Jun 9',      '2026-06-09 08:18:30');
