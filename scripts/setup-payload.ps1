# =============================================================
#  Metrolink FOMS — Installer Payload Script
#  Called by the Inno Setup installer after file extraction.
#  NOT intended to be run directly by end-users (use setup.ps1
#  for manual installation or the GUI installer for first-time setup).
#
#  Parameters:
#    -MysqlPass   MySQL root password entered in the installer wizard
#    -AppDir      Installation directory chosen by the user (e.g. C:\Program Files\MetrolinkFOMS)
#    -TomcatBase  Where to install Tomcat if not already present (e.g. %USERPROFILE%\tomcat)
# =============================================================

param(
    [string]$MysqlPass  = "",
    [string]$AppDir     = "$env:ProgramFiles\MetrolinkFOMS",
    [string]$TomcatBase = "$env:USERPROFILE\tomcat"
)

$ErrorActionPreference = 'Continue'
$LOG = Join-Path $AppDir "setup.log"

function Log($msg) {
    $ts = (Get-Date).ToString("HH:mm:ss")
    "$ts  $msg" | Tee-Object -FilePath $LOG -Append | Out-Null
    Write-Host $msg
}

Log "=== Metrolink FOMS Installer Payload ==="
Log "AppDir     : $AppDir"
Log "TomcatBase : $TomcatBase"

# ── winget availability ───────────────────────────────────────
$hasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)

function Install-Via-Winget($id, $label) {
    if (-not $hasWinget) { Log "[SKIP] winget not available — $label must be installed manually"; return $false }
    Log "Installing $label via winget..."
    winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

# Refresh PATH from registry (winget installs update Machine PATH)
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

# =============================================================
# PHASE 1 — Java JDK 21+
# =============================================================
Log "`n--- Phase 1: Java JDK 21+ ---"
$JAVA_HOME_PATH = $null
$javaOk = $false

$javaExe = Get-Command java -ErrorAction SilentlyContinue
if ($javaExe) {
    $jver = & java -version 2>&1 | Select-String 'version'
    $match = [regex]::Match("$jver", '"(\d+)')
    if ($match.Success -and [int]$match.Groups[1].Value -ge 21) {
        Log "[OK] Java $($match.Groups[1].Value) found"
        $javaOk = $true
        $JAVA_HOME_PATH = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
            $env:JAVA_HOME } else { Split-Path (Split-Path $javaExe.Source) }
    } else {
        Log "[!!] Java version too old — installing JDK 21"
    }
}

if (-not $javaOk) {
    $ok = Install-Via-Winget "EclipseAdoptium.Temurin.21.JDK" "Java JDK 21"
    Refresh-Path
    $javaExe = Get-Command java -ErrorAction SilentlyContinue
    if ($javaExe) {
        $JAVA_HOME_PATH = Split-Path (Split-Path $javaExe.Source)
        $javaOk = $true
        Log "[OK] Java installed"
    } else {
        Log "[XX] Java install failed — manual install required: https://adoptium.net"
    }
}

# Set JAVA_HOME user env var
if ($JAVA_HOME_PATH -and (Test-Path "$JAVA_HOME_PATH\bin\java.exe")) {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $JAVA_HOME_PATH, "User")
    $env:JAVA_HOME = $JAVA_HOME_PATH
    Log "[OK] JAVA_HOME = $JAVA_HOME_PATH"
}

# =============================================================
# PHASE 2 — MySQL 8+
# =============================================================
Log "`n--- Phase 2: MySQL 8+ ---"
$mysqlOk = $false

$mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
if ($mysqlSvc -and $mysqlSvc.Status -eq 'Running') {
    Log "[OK] MySQL80 service is running"
    $mysqlOk = $true
} elseif ($mysqlSvc) {
    Log "[!!] MySQL80 service found but stopped — starting..."
    try { Start-Service MySQL80; Start-Sleep -Seconds 4; $mysqlOk = $true; Log "[OK] MySQL80 started" }
    catch { Log "[XX] Could not start MySQL80: $($_.Exception.Message)" }
} else {
    Log "[--] MySQL not found — installing via winget..."
    $ok = Install-Via-Winget "Oracle.MySQL" "MySQL 8.0"
    Start-Sleep -Seconds 8
    $mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
    if ($mysqlSvc) { $mysqlOk = $true; Log "[OK] MySQL installed and running" }
    else { Log "[XX] MySQL install failed — install manually: https://dev.mysql.com/downloads/installer/" }
}

# =============================================================
# PHASE 3 — Apache Tomcat 10.1
# =============================================================
Log "`n--- Phase 3: Apache Tomcat 10.1 ---"
$TOMCAT_HOME = $null
$tomcatOk = $false

# Search common locations
$tomcatPaths = @($env:CATALINA_HOME, "$env:USERPROFILE\tomcat", "C:\tomcat") | Where-Object { $_ }
foreach ($p in $tomcatPaths) {
    $found = Get-ChildItem $p -Filter "apache-tomcat-10*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $found -and (Test-Path "$p\bin\catalina.bat")) { $found = Get-Item $p }
    elseif ($found -and (Test-Path "$($found.FullName)\bin\catalina.bat")) { }
    else { $found = $null }
    if ($found) { $TOMCAT_HOME = $found.FullName; $tomcatOk = $true; break }
}

if (-not $tomcatOk) {
    Log "[--] Tomcat not found — downloading 10.1.33..."
    $tomcatVersion = "10.1.33"
    $tomcatUrl = "https://dlcdn.apache.org/tomcat/tomcat-10/v$tomcatVersion/bin/apache-tomcat-$tomcatVersion-windows-x64.zip"
    $tomcatZip = "$env:TEMP\apache-tomcat.zip"
    try {
        New-Item -ItemType Directory -Path $TomcatBase -Force | Out-Null
        Invoke-WebRequest -Uri $tomcatUrl -OutFile $tomcatZip -UseBasicParsing
        Expand-Archive -Path $tomcatZip -DestinationPath $TomcatBase -Force
        Remove-Item $tomcatZip -Force
        $extracted = Get-ChildItem $TomcatBase -Filter "apache-tomcat-*" -Directory | Select-Object -First 1
        if ($extracted) {
            $TOMCAT_HOME = $extracted.FullName
            $tomcatOk = $true
            Log "[OK] Tomcat extracted to $TOMCAT_HOME"
        }
    } catch {
        Log "[XX] Tomcat download failed: $($_.Exception.Message)"
        Log "     Download manually: https://tomcat.apache.org/download-10.cgi"
    }
} else {
    Log "[OK] Tomcat found at $TOMCAT_HOME"
}

# Write setenv.bat so Tomcat uses the right Java
if ($TOMCAT_HOME -and $JAVA_HOME_PATH) {
    $setenv = "$TOMCAT_HOME\bin\setenv.bat"
    "@echo off`r`nset JAVA_HOME=$JAVA_HOME_PATH`r`nset JRE_HOME=$JAVA_HOME_PATH`r`n" | Set-Content $setenv -Encoding ASCII
    Log "[OK] Created $setenv"
}

# =============================================================
# PHASE 4 — .NET 9 Desktop Runtime
# =============================================================
Log "`n--- Phase 4: .NET 9 Desktop Runtime ---"
$dotnetOk = $false
$dotnetExe = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnetExe) {
    $runtimes = & dotnet --list-runtimes 2>&1
    if ($runtimes | Where-Object { $_ -match 'Microsoft\.WindowsDesktop\.App 9\.' }) {
        $dotnetOk = $true; Log "[OK] .NET 9 Desktop Runtime found"
    }
}
if (-not $dotnetOk) {
    $ok = Install-Via-Winget "Microsoft.DotNet.DesktopRuntime.9" ".NET 9 Desktop Runtime"
    if ($ok) { $dotnetOk = $true; Log "[OK] .NET 9 Desktop Runtime installed" }
    else { Log "[!!] Install manually: https://dotnet.microsoft.com/en-us/download/dotnet/9.0" }
}

# =============================================================
# PHASE 5 — config.properties
# =============================================================
Log "`n--- Phase 5: config.properties ---"
$configSrc  = Join-Path $AppDir "backend\config.properties.example"
$configDest = Join-Path $AppDir "backend\config.properties"

if (-not (Test-Path $configDest)) {
    if (Test-Path $configSrc) {
        $content = Get-Content $configSrc -Raw
        $content = $content -replace 'your_password_here', $MysqlPass
        Set-Content $configDest $content -Encoding UTF8
        Log "[OK] Created config.properties"
    } else {
        # Write config from scratch
        @"
db.url=jdbc:mysql://localhost:3306/metrolink_db?useSSL=false&serverTimezone=Asia/Manila&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&useUnicode=true
db.username=root
db.password=$MysqlPass
db.driver=com.mysql.cj.jdbc.Driver
db.pool.maximumPoolSize=10
db.pool.minimumIdle=2
db.pool.connectionTimeout=30000
db.pool.idleTimeout=600000
db.pool.maxLifetime=1800000
jwt.secret=MetrolinkSuperSecretKey2025ChangeThisInProduction!
jwt.expirationMs=86400000
app.name=Metrolink FOMS
app.version=1.0.0
app.timezone=Asia/Manila
"@ | Set-Content $configDest -Encoding UTF8
        Log "[OK] config.properties generated"
    }
} else {
    Log "[OK] config.properties already exists — skipping"
}

# Copy config.properties into the WAR's WEB-INF/classes so the app can find it
# (Tomcat auto-deploys the WAR — we update config after deployment below)

# =============================================================
# PHASE 6 — Database setup
# =============================================================
Log "`n--- Phase 6: Database setup ---"
if ($mysqlOk) {
    $mysqlArgs = @("-u", "root", "--connect-timeout=10")
    if ($MysqlPass) { $mysqlArgs += "--password=$MysqlPass" }

    # Create database
    & mysql @mysqlArgs -e "CREATE DATABASE IF NOT EXISTS metrolink_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Log "[OK] Database 'metrolink_db' ready" }
    else { Log "[!!] Could not create database — check MySQL credentials" }

    # Run schema
    $schemaFile = Join-Path $AppDir "backend\schema.sql"
    if (Test-Path $schemaFile) {
        # Use pipe method (most reliable across MySQL versions)
        Get-Content $schemaFile -Raw | & mysql @mysqlArgs metrolink_db 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "[OK] Schema applied" }
        else { Log "[!!] Schema apply failed — run manually: mysql -u root -p metrolink_db < $schemaFile" }
    } else {
        Log "[!!] schema.sql not found at $schemaFile"
    }
} else {
    Log "[SKIP] MySQL not available — database setup skipped"
}

# =============================================================
# PHASE 7 — Deploy WAR and frontend to Tomcat
# =============================================================
Log "`n--- Phase 7: Deploy to Tomcat ---"
if ($TOMCAT_HOME) {
    # Deploy backend WAR
    $warSrc  = Join-Path $AppDir "backend\metrolink-backend.war"
    $warDest = "$TOMCAT_HOME\webapps\metrolink-backend.war"
    if (Test-Path $warSrc) {
        Copy-Item $warSrc $warDest -Force
        Log "[OK] WAR deployed to $warDest"
    } else {
        Log "[XX] WAR not found at $warSrc"
    }

    # Deploy frontend
    $feSrc  = Join-Path $AppDir "frontend"
    $feDest = "$TOMCAT_HOME\webapps\metrolink-frontend"
    if (Test-Path $feSrc) {
        if (Test-Path $feDest) { Remove-Item $feDest -Recurse -Force }
        Copy-Item $feSrc $feDest -Recurse -Force
        Log "[OK] Frontend deployed to $feDest"
    } else {
        Log "[XX] Frontend folder not found at $feSrc"
    }

    # Inject config.properties into deployed WAR classes directory
    # (WAR auto-exploded by Tomcat; wait briefly then copy if already exploded)
    $warExpandedConfig = "$TOMCAT_HOME\webapps\metrolink-backend\WEB-INF\classes\config.properties"
    if (Test-Path (Split-Path $warExpandedConfig)) {
        Copy-Item $configDest $warExpandedConfig -Force
        Log "[OK] config.properties injected into exploded WAR"
    }
    # Also create a post-start script that copies it once Tomcat expands the WAR
    $postScript = "$TOMCAT_HOME\bin\post-deploy-config.bat"
    @"
@echo off
set DEST=$TOMCAT_HOME\webapps\metrolink-backend\WEB-INF\classes\config.properties
timeout /t 10 /nobreak >nul
if not exist "%DEST%" mkdir "%DEST%\.."
copy /Y "$configDest" "%DEST%"
"@ | Set-Content $postScript -Encoding ASCII
    Log "[OK] post-deploy-config.bat created (runs after Tomcat starts)"
} else {
    Log "[SKIP] Tomcat not available — deployment skipped"
}

# =============================================================
# PHASE 8 — launcher.config
# =============================================================
Log "`n--- Phase 8: launcher.config ---"
if ($TOMCAT_HOME -and $JAVA_HOME_PATH) {
    $lcPath = Join-Path $AppDir "app\launcher.config"
    @"
JAVA_HOME=$JAVA_HOME_PATH
CATALINA_HOME=$TOMCAT_HOME
MYSQL_SERVICE=MySQL80
"@ | Set-Content $lcPath -Encoding ASCII
    Log "[OK] launcher.config created at $lcPath"
}

# =============================================================
# DONE
# =============================================================
Log "`n=== Setup Complete ==="
Log "Default login : admin / admin123"
Log "Browser URL   : http://localhost:8080/metrolink-frontend/"
Log "Desktop app   : $AppDir\app\MetrolinkDesktop.exe"
Log ""
Log "IMPORTANT: Change the admin password after first login."

if (-not ($javaOk -and $mysqlOk -and $tomcatOk)) {
    Log "`n[!!] Some components may need attention. See above for details."
    exit 1
}
exit 0
