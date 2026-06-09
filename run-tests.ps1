$BASE = "http://localhost:8080/metrolink-backend/api"
$LOG  = "$PSScriptRoot\test-results.txt"
$pass = 0; $fail = 0; $warn = 0

function Log($msg) { Write-Host $msg; Add-Content $LOG $msg }

function Check($label, $code, $expected) {
    if ($code -eq $expected) {
        $script:pass++
        Log "  [PASS] $label (HTTP $code)"
    } else {
        $script:fail++
        Log "  [FAIL] $label — expected $expected, got $code"
    }
}

function Api($method, $path, $body=$null, $token=$null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $params = @{ Method=$method; Uri="$BASE$path"; Headers=$headers; UseBasicParsing=$true }
        if ($body) { $params["Body"] = ($body | ConvertTo-Json -Compress) }
        $r = Invoke-WebRequest @params -ErrorAction Stop
        return @{ code=$r.StatusCode; body=($r.Content | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $sc = [int]$_.Exception.Response.StatusCode
        return @{ code=$sc; body=$null }
    } catch {
        return @{ code=0; body=$null }
    }
}

Remove-Item $LOG -ErrorAction SilentlyContinue
Log "============================================================"
Log "  METROLINK FOMS — Full API Feature Test"
Log "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "============================================================"

# ── 1. AUTH ──────────────────────────────────────────────────
Log ""
Log "[ 1 ] AUTH"

$r = Api POST "/auth/login" @{ username="admin"; password="wrongpass" }
Check "Login with wrong password → 401" $r.code 401

$r = Api POST "/auth/login" @{ username="admin"; password="admin123" }
Check "Login admin/admin123 → 200" $r.code 200
$adminToken = $r.body.token
if ($adminToken) { Log "       Token acquired: $($adminToken.Substring(0,20))..." }
else { Log "  [WARN] No token returned — subsequent tests will fail"; $warn++ }

$r = Api POST "/auth/login" @{ username="jdelacruz"; password="admin123" }
Check "Login staff user → 200" $r.code 200
$staffToken = $r.body.token

# ── 2. BUSES ─────────────────────────────────────────────────
Log ""
Log "[ 2 ] BUSES"

$r = Api GET "/buses" -token $adminToken
Check "GET /buses → 200" $r.code 200
$busCount = if ($r.body) { $r.body.Count } else { 0 }
Log "       Found $busCount buses"

$newBus = @{ busNumber="TEST-99"; plateNumber="ZZZ-9999"; model="Hyundai Test"; status="ACTIVE" }
$r = Api POST "/buses" $newBus $adminToken
Check "POST /buses (create) → 200 or 201" $r.code 200
$busId = if ($r.body.id) { $r.body.id } else { $r.body }
Log "       Created bus id=$busId"

if ($busId) {
    $r = Api PUT "/buses/$busId" @{ busNumber="TEST-99"; plateNumber="ZZZ-9999"; model="Hyundai Test Updated"; status="MAINTENANCE" } $adminToken
    Check "PUT /buses/$busId (update status) → 200" $r.code 200
}

# ── 3. EMPLOYEES ─────────────────────────────────────────────
Log ""
Log "[ 3 ] EMPLOYEES"

$r = Api GET "/employees" -token $adminToken
Check "GET /employees → 200" $r.code 200
$empCount = if ($r.body) { $r.body.Count } else { 0 }
Log "       Found $empCount employees"

$r = Api GET "/employees?position=DRIVER" -token $adminToken
Check "GET /employees?position=DRIVER → 200" $r.code 200

$newEmp = @{ firstName="Test"; lastName="Driver"; position="DRIVER"; dailyRate=1225; status="ACTIVE" }
$r = Api POST "/employees" $newEmp $adminToken
Check "POST /employees (create driver) → 200" $r.code 200
$driverId = if ($r.body.id) { $r.body.id } else { $r.body }
Log "       Created driver id=$driverId"

$newCon = @{ firstName="Test"; lastName="Conductor"; position="CONDUCTOR"; dailyRate=1225; status="ACTIVE" }
$r = Api POST "/employees" $newCon $adminToken
Check "POST /employees (create conductor) → 200" $r.code 200
$conductorId = if ($r.body.id) { $r.body.id } else { $r.body }
Log "       Created conductor id=$conductorId"

if ($driverId) {
    $r = Api PUT "/employees/$driverId" @{ firstName="Test"; lastName="Driver Updated"; position="DRIVER"; dailyRate=1300; status="ACTIVE" } $adminToken
    Check "PUT /employees/$driverId (update) → 200" $r.code 200
}

# ── 4. TRIPS ─────────────────────────────────────────────────
Log ""
Log "[ 4 ] TRIPS"

$r = Api GET "/trips" -token $adminToken
Check "GET /trips → 200" $r.code 200
$tripCount = if ($r.body) { $r.body.Count } else { 0 }
Log "       Found $tripCount trips"

# Create a trip (need a real bus, driver, conductor)
$r2 = Api GET "/buses" -token $adminToken
$realBusId = if ($r2.body -and $r2.body.Count -gt 0) { $r2.body[0].id } else { $null }
$r3 = Api GET "/employees?position=DRIVER" -token $adminToken
$realDriverId = if ($r3.body -and $r3.body.Count -gt 0) { $r3.body[0].id } else { $null }
$r4 = Api GET "/employees?position=CONDUCTOR" -token $adminToken
$realConductorId = if ($r4.body -and $r4.body.Count -gt 0) { $r4.body[0].id } else { $null }

if ($realBusId -and $realDriverId -and $realConductorId) {
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $newTrip = @{ tripDate=$today; busId=$realBusId; driverId=$realDriverId; conductorId=$realConductorId; departureTime="06:00"; tripCount=5 }
    $r = Api POST "/trips" $newTrip $adminToken
    Check "POST /trips (dispatch) → 200" $r.code 200
    $tripId = if ($r.body.id) { $r.body.id } else { $r.body }
    Log "       Created trip id=$tripId"

    if ($tripId) {
        # Record arrival
        $r = Api PUT "/trips/$tripId/arrive" @{ arrivalTime="22:00" } $adminToken
        Check "PUT /trips/$tripId/arrive → 200" $r.code 200

        # Record income
        $r = Api POST "/trips/$tripId/income" @{ grossIncome=15000; driverIncome=1425; conductorIncome=1425; driverBond=0; conductorBond=0; commission=0 } $adminToken
        Check "POST /trips/$tripId/income → 200" $r.code 200

        # Record expenses
        $r = Api POST "/trips/$tripId/expenses" @{ diesel=2500; washing=150; driverSalary=0; overtime=0; nightDiff=0; bonus=0; cashAdvance=0; damages=0; otherExpenses=100 } $adminToken
        Check "POST /trips/$tripId/expenses → 200" $r.code 200

        # Update trip count
        $r = Api PUT "/trips/$tripId" @{ tripCount=6; remark="Test update" } $adminToken
        Check "PUT /trips/$tripId (edit) → 200" $r.code 200
    }
} else {
    Log "  [WARN] Could not find bus/driver/conductor for trip creation"
    $warn++
}

# Duplicate driver check
Log ""
Log "[ 4b ] TRIP — Duplicate assignment guard"
if ($realBusId -and $realDriverId -and $realConductorId) {
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $dupTrip = @{ tripDate=$today; busId=$realBusId; driverId=$realDriverId; conductorId=$realConductorId; departureTime="07:00"; tripCount=3 }
    $r = Api POST "/trips" $dupTrip $adminToken
    if ($r.code -ge 400) {
        $pass++
        Log "  [PASS] Duplicate driver/conductor same day → rejected (HTTP $($r.code))"
    } else {
        $warn++
        Log "  [WARN] Duplicate driver/conductor same day was NOT rejected (HTTP $($r.code))"
    }
}

# ── 5. REPORTS ───────────────────────────────────────────────
Log ""
Log "[ 5 ] REPORTS"

$today = (Get-Date).ToString("yyyy-MM-dd")
$start = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")

$r = Api GET "/reports/summary?startDate=$start&endDate=$today" $adminToken
Check "GET /reports/summary → 200" $r.code 200

$r = Api GET "/reports/trip-report?startDate=$start&endDate=$today" $adminToken
Check "GET /reports/trip-report → 200" $r.code 200

$r = Api GET "/reports/low-income?startDate=$start&endDate=$today" $adminToken
Check "GET /reports/low-income → 200" $r.code 200

$r = Api GET "/reports/changelog?startDate=$start&endDate=$today" $adminToken
Check "GET /reports/changelog → 200" $r.code 200

# ── 6. PAYROLL ───────────────────────────────────────────────
Log ""
Log "[ 6 ] PAYROLL"

$r = Api GET "/payroll/daily?date=$today" $adminToken
Check "GET /payroll/daily?date=$today → 200" $r.code 200

$month = (Get-Date).ToString("yyyy-MM")
$r = Api GET "/payroll/bimonthly?month=$month&half=1" $adminToken
Check "GET /payroll/bimonthly?month=$month&half=1 → 200" $r.code 200

# ── 7. USERS (ADMIN) ─────────────────────────────────────────
Log ""
Log "[ 7 ] USERS"

$r = Api GET "/users" $adminToken
Check "GET /users (admin) → 200" $r.code 200
$userCount = if ($r.body) { $r.body.Count } else { 0 }
Log "       Found $userCount users"

# STAFF should be blocked
$r = Api GET "/users" $staffToken
if ($r.code -eq 403 -or $r.code -eq 401) {
    $pass++
    Log "  [PASS] GET /users (staff) → 403/401 (correctly blocked)"
} else {
    $fail++
    Log "  [FAIL] GET /users (staff) should be blocked, got $($r.code)"
}

$newUser = @{ username="testuser99"; password="test123"; fullName="Test User"; role="STAFF" }
$r = Api POST "/users" $newUser $adminToken
Check "POST /users (create staff) → 200" $r.code 200
$newUserId = if ($r.body.id) { $r.body.id } else { $r.body }

# ── 8. AUDIT LOG ─────────────────────────────────────────────
Log ""
Log "[ 8 ] AUDIT LOG"

$r = Api GET "/audit" $adminToken
Check "GET /audit (admin) → 200" $r.code 200
$auditCount = if ($r.body) { $r.body.Count } else { 0 }
Log "       Found $auditCount audit entries"

$r = Api GET "/audit" $staffToken
if ($r.code -eq 403 -or $r.code -eq 401) {
    $pass++
    Log "  [PASS] GET /audit (staff) → 403/401 (correctly blocked)"
} else {
    $fail++
    Log "  [FAIL] GET /audit (staff) should be blocked, got $($r.code)"
}

# ── SUMMARY ──────────────────────────────────────────────────
Log ""
Log "============================================================"
Log "  RESULTS: $pass passed  |  $fail failed  |  $warn warnings"
Log "============================================================"
if ($fail -eq 0) {
    Log "  ALL TESTS PASSED"
} else {
    Log "  $fail TEST(S) FAILED — check above for details"
}
Log ""
Write-Host ""
Write-Host "Results saved to: $LOG" -ForegroundColor Cyan
pause
