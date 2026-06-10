# =============================================================
#  Metrolink FOMS — Update an existing installation
#  Pulls the latest code from master, rebuilds the backend,
#  and redeploys both backend (WAR) and frontend to Tomcat.
#
#  Usage:  Right-click > Run with PowerShell
#          (or)  powershell -ExecutionPolicy Bypass -File update.ps1
# =============================================================

$ErrorActionPreference = 'Stop'
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "`n► $msg" -ForegroundColor Cyan }
function OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Pause-Continue {
    Write-Host "`n  Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Push-Location $PROJECT_ROOT
try {

    # ── 1. Pull latest code ───────────────────────────────────
    Step "Pulling latest changes from origin/master..."
    git pull origin master
    if ($LASTEXITCODE -ne 0) { throw "git pull failed — resolve conflicts and re-run." }
    OK "Up to date with origin/master"

    # ── 2. Rebuild backend ─────────────────────────────────────
    Step "Building backend (mvn clean package)..."
    mvn clean package -q
    if ($LASTEXITCODE -ne 0) { throw "Maven build failed — see output above." }
    OK "Build successful"

    # ── 3. Locate Tomcat ────────────────────────────────────────
    Step "Locating Tomcat..."
    $TOMCAT_HOME = $null
    $candidates = @($env:CATALINA_HOME, "$env:USERPROFILE\tomcat", "C:\tomcat", "C:\apache-tomcat") | Where-Object { $_ }

    $launcherConfig = Join-Path $PROJECT_ROOT "desktop-app\release\launcher.config"
    if (Test-Path $launcherConfig) {
        Get-Content $launcherConfig | ForEach-Object {
            if ($_ -match '^CATALINA_HOME=(.+)') { $candidates = @($Matches[1].Trim()) + $candidates }
        }
    }

    foreach ($p in $candidates) {
        if ($p -and (Test-Path "$p\bin\catalina.bat")) { $TOMCAT_HOME = $p; break }
    }
    if (-not $TOMCAT_HOME) {
        foreach ($root in @("$env:USERPROFILE", "C:\")) {
            $found = Get-ChildItem $root -Filter "apache-tomcat-10*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found -and (Test-Path "$($found.FullName)\bin\catalina.bat")) { $TOMCAT_HOME = $found.FullName; break }
        }
    }
    if (-not $TOMCAT_HOME) {
        throw "Could not find Tomcat. Set CATALINA_HOME or create desktop-app\release\launcher.config"
    }
    OK "Tomcat found at $TOMCAT_HOME"

    # ── 4. Make sure the app isn't locking files ───────────────
    Write-Host "`n  IMPORTANT: Close 'Metrolink FOMS' (and Tomcat) if it is running." -ForegroundColor Yellow
    Pause-Continue

    # ── 5. Deploy backend WAR ───────────────────────────────────
    Step "Deploying backend..."
    Copy-Item "$PROJECT_ROOT\target\metrolink-backend.war" "$TOMCAT_HOME\webapps\metrolink-backend.war" -Force
    $exploded = "$TOMCAT_HOME\webapps\metrolink-backend"
    if (Test-Path $exploded) { Remove-Item $exploded -Recurse -Force }
    OK "WAR deployed to $TOMCAT_HOME\webapps\metrolink-backend.war"

    # ── 6. Deploy frontend ───────────────────────────────────────
    Step "Deploying frontend..."
    $feDest = "$TOMCAT_HOME\webapps\metrolink-frontend"
    if (Test-Path $feDest) { Remove-Item $feDest -Recurse -Force }
    Copy-Item "$PROJECT_ROOT\frontend" $feDest -Recurse -Force
    OK "Frontend deployed to $feDest"

    Write-Host "`n  Update complete! Reopen 'Metrolink FOMS' to start the app with the latest version.`n" -ForegroundColor Green

} finally {
    Pop-Location
    Pause-Continue
}
