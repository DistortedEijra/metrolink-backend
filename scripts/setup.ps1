# =============================================================
#  Metrolink FOMS — Prerequisites Checker & Installer
#  Run once on a new machine to set everything up.
#  Usage:  Right-click > Run with PowerShell
#          (or)  powershell -ExecutionPolicy Bypass -File setup.ps1
# =============================================================

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

# ── Colour helpers ───────────────────────────────────────────
function Write-Header($msg) {
    Write-Host "`n══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
}
function Write-Step($msg)    { Write-Host "`n  ► $msg" -ForegroundColor White }
function Write-OK($msg)      { Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "    [!!]  $msg" -ForegroundColor Yellow }
function Write-Missing($msg) { Write-Host "    [--]  $msg — will install" -ForegroundColor DarkYellow }
function Write-Fail($msg)    { Write-Host "    [XX]  $msg" -ForegroundColor Red }
function Pause-Continue {
    Write-Host "`n  Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# ── Admin check ──────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "`n  [!!] Not running as Administrator." -ForegroundColor Yellow
    Write-Host "       Some installs may fail. Re-launch as Admin for best results." -ForegroundColor Yellow
    Pause-Continue
}

# ── winget check ─────────────────────────────────────────────
$hasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)
if (-not $hasWinget) {
    Write-Warn "winget not found. Automatic installs will fall back to manual downloads."
}

function Install-WithWinget($id, $label) {
    if (-not $hasWinget) { return $false }
    Write-Step "Installing $label via winget..."
    try {
        winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements
        return $true
    } catch {
        Write-Warn "winget install failed for $label. Manual install required."
        return $false
    }
}

# =============================================================
Write-Header "PHASE 1 — Checking Requirements"
# =============================================================

$javaOk    = $false
$mysqlOk   = $false
$tomcatOk  = $false
$mavenOk   = $false
$dotnetOk  = $false
$webview2Ok = $false

$TOMCAT_HOME = $null
$JAVA_HOME_PATH = $null
$MAVEN_HOME = $null

# ── 1. Java JDK 21+ ──────────────────────────────────────────
Write-Step "Checking Java JDK 21+..."
$javaExe = Get-Command java -ErrorAction SilentlyContinue
if ($javaExe) {
    try {
        $jver = & java -version 2>&1 | Select-String 'version'
        $verMatch = [regex]::Match($jver, '"(\d+)')
        $majorVer = [int]$verMatch.Groups[1].Value
        if ($majorVer -ge 21) {
            Write-OK "Java $majorVer found at $($javaExe.Source)"
            $javaOk = $true
            # Try to find JAVA_HOME
            if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
                $JAVA_HOME_PATH = $env:JAVA_HOME
            } else {
                $JAVA_HOME_PATH = Split-Path (Split-Path $javaExe.Source)
            }
        } else {
            Write-Missing "Java $majorVer found but JDK 21+ is required"
        }
    } catch {
        Write-Missing "Java found but could not determine version"
    }
} else {
    Write-Missing "Java JDK not found"
}

# ── 2. MySQL 8+ ──────────────────────────────────────────────
Write-Step "Checking MySQL 8+..."
$mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
$mysqlExe = Get-Command mysql -ErrorAction SilentlyContinue
if ($mysqlSvc -and $mysqlSvc.Status -eq 'Running') {
    Write-OK "MySQL80 service is running"
    $mysqlOk = $true
} elseif ($mysqlSvc) {
    Write-Warn "MySQL80 service found but NOT running — will attempt to start"
    $mysqlOk = $false
} elseif ($mysqlExe) {
    Write-Warn "mysql.exe found but MySQL80 service not detected"
    $mysqlOk = $false
} else {
    Write-Missing "MySQL 8.0 not found"
}

# ── 3. Apache Tomcat 10.1 ────────────────────────────────────
Write-Step "Checking Apache Tomcat 10.1..."
$tomcatPaths = @(
    $env:CATALINA_HOME,
    "$env:USERPROFILE\tomcat",
    "C:\tomcat",
    "C:\apache-tomcat"
) | Where-Object { $_ }

# Also check launcher.config
$launcherConfig = Join-Path $PROJECT_ROOT "desktop-app\release\launcher.config"
if (Test-Path $launcherConfig) {
    Get-Content $launcherConfig | ForEach-Object {
        if ($_ -match '^CATALINA_HOME=(.+)') { $tomcatPaths += $Matches[1].Trim() }
    }
}

$foundTomcat = $null
foreach ($p in $tomcatPaths) {
    if ($p -and (Test-Path "$p\bin\catalina.bat")) {
        $foundTomcat = $p; break
    }
}
# Also search for apache-tomcat-10.x folders
if (-not $foundTomcat) {
    $searchRoots = @("$env:USERPROFILE", "C:\")
    foreach ($root in $searchRoots) {
        $found = Get-ChildItem $root -Filter "apache-tomcat-10*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path "$($found.FullName)\bin\catalina.bat")) {
            $foundTomcat = $found.FullName; break
        }
    }
}

if ($foundTomcat) {
    Write-OK "Tomcat found at $foundTomcat"
    $TOMCAT_HOME = $foundTomcat
    $tomcatOk = $true
} else {
    Write-Missing "Apache Tomcat 10.1 not found — will download"
}

# ── 4. Maven 3.9+ ────────────────────────────────────────────
Write-Step "Checking Apache Maven..."
$mvnExe = Get-Command mvn -ErrorAction SilentlyContinue
if ($mvnExe) {
    try {
        $mver = & mvn --version 2>&1 | Select-String 'Apache Maven'
        Write-OK "Maven found: $mver"
        $mavenOk = $true
        $MAVEN_HOME = Split-Path (Split-Path $mvnExe.Source)
    } catch {
        Write-Missing "Maven found but version check failed"
    }
} else {
    Write-Missing "Maven not found"
}

# ── 5. .NET 9 Desktop Runtime ────────────────────────────────
Write-Step "Checking .NET 9 Desktop Runtime..."
$dotnetExe = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnetExe) {
    try {
        $runtimes = & dotnet --list-runtimes 2>&1
        $hasDesktop9 = $runtimes | Where-Object { $_ -match 'Microsoft\.WindowsDesktop\.App 9\.' }
        if ($hasDesktop9) {
            Write-OK ".NET 9 Desktop Runtime found"
            $dotnetOk = $true
        } else {
            Write-Missing ".NET 9 Desktop Runtime not found (dotnet present but wrong version)"
        }
    } catch {
        Write-Missing ".NET found but runtime check failed"
    }
} else {
    Write-Missing ".NET SDK/Runtime not found"
}

# ── 6. WebView2 Runtime ──────────────────────────────────────
Write-Step "Checking WebView2 Runtime..."
$wv2Keys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$webview2Ok = $wv2Keys | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($webview2Ok) {
    Write-OK "WebView2 Runtime is installed"
} else {
    Write-Warn "WebView2 not found in registry (usually pre-installed on Windows 11 / Edge)"
}

# =============================================================
Write-Header "PHASE 2 — Installing Missing Components"
# =============================================================

# ── Java ─────────────────────────────────────────────────────
if (-not $javaOk) {
    Write-Step "Installing Java JDK 21 (Eclipse Temurin)..."
    $ok = Install-WithWinget "EclipseAdoptium.Temurin.21.JDK" "Java JDK 21"
    if (-not $ok) {
        Write-Warn "Please install manually: https://adoptium.net"
        Write-Warn "Download the Windows x64 .msi and run it."
        Pause-Continue
    } else {
        # Refresh PATH so java is available
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        $javaExe = Get-Command java -ErrorAction SilentlyContinue
        if ($javaExe) {
            $JAVA_HOME_PATH = Split-Path (Split-Path $javaExe.Source)
            $javaOk = $true
        }
    }
}

# ── MySQL ─────────────────────────────────────────────────────
if (-not $mysqlOk) {
    $mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
    if ($mysqlSvc -and $mysqlSvc.Status -ne 'Running') {
        Write-Step "Starting MySQL80 service..."
        try {
            Start-Service MySQL80
            Start-Sleep -Seconds 3
            $mysqlOk = $true
            Write-OK "MySQL80 started"
        } catch {
            Write-Warn "Could not start MySQL80 service: $($_.Exception.Message)"
        }
    } else {
        Write-Step "Installing MySQL 8.0 via winget..."
        $ok = Install-WithWinget "Oracle.MySQL" "MySQL 8.0"
        if (-not $ok) {
            Write-Warn "Please install manually: https://dev.mysql.com/downloads/installer/"
            Write-Warn "Choose 'Developer Default', note your root password."
            Pause-Continue
        } else {
            Start-Sleep -Seconds 5
            $mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
            if ($mysqlSvc) { $mysqlOk = $true }
        }
    }
}

# ── Tomcat ────────────────────────────────────────────────────
if (-not $tomcatOk) {
    Write-Step "Downloading Apache Tomcat 10.1..."
    $tomcatVersion = "10.1.33"
    $tomcatUrl  = "https://dlcdn.apache.org/tomcat/tomcat-10/v$tomcatVersion/bin/apache-tomcat-$tomcatVersion-windows-x64.zip"
    $tomcatDest = "$env:USERPROFILE\tomcat"
    $tomcatZip  = "$env:TEMP\apache-tomcat.zip"

    try {
        New-Item -ItemType Directory -Path $tomcatDest -Force | Out-Null
        Write-Host "    Downloading Tomcat $tomcatVersion..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $tomcatUrl -OutFile $tomcatZip -UseBasicParsing
        Write-Host "    Extracting..." -ForegroundColor Gray
        Expand-Archive -Path $tomcatZip -DestinationPath $tomcatDest -Force
        Remove-Item $tomcatZip -Force

        $extracted = Get-ChildItem $tomcatDest -Filter "apache-tomcat-*" -Directory | Select-Object -First 1
        if ($extracted) {
            $TOMCAT_HOME = $extracted.FullName
            $tomcatOk = $true
            Write-OK "Tomcat extracted to $TOMCAT_HOME"
        }
    } catch {
        Write-Fail "Failed to download Tomcat: $($_.Exception.Message)"
        Write-Warn "Download manually: https://tomcat.apache.org/download-10.cgi"
        Write-Warn "Extract and set CATALINA_HOME environment variable."
        Pause-Continue
    }
}

# ── Maven ─────────────────────────────────────────────────────
if (-not $mavenOk) {
    Write-Step "Installing Apache Maven..."
    $ok = Install-WithWinget "Apache.Maven" "Apache Maven"
    if (-not $ok) {
        # Manual download fallback
        Write-Step "Downloading Maven 3.9.6 manually..."
        $mvnVersion = "3.9.6"
        $mvnUrl  = "https://archive.apache.org/dist/maven/maven-3/$mvnVersion/binaries/apache-maven-$mvnVersion-bin.zip"
        $mvnDest = "$env:USERPROFILE\maven"
        $mvnZip  = "$env:TEMP\apache-maven.zip"

        try {
            New-Item -ItemType Directory -Path $mvnDest -Force | Out-Null
            Write-Host "    Downloading Maven $mvnVersion..." -ForegroundColor Gray
            Invoke-WebRequest -Uri $mvnUrl -OutFile $mvnZip -UseBasicParsing
            Write-Host "    Extracting..." -ForegroundColor Gray
            Expand-Archive -Path $mvnZip -DestinationPath $mvnDest -Force
            Remove-Item $mvnZip -Force

            $extracted = Get-ChildItem $mvnDest -Filter "apache-maven-*" -Directory | Select-Object -First 1
            if ($extracted) {
                $MAVEN_HOME = $extracted.FullName
                $mvnBin = "$MAVEN_HOME\bin"
                # Add to user PATH
                $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
                if ($userPath -notlike "*$mvnBin*") {
                    [Environment]::SetEnvironmentVariable("Path", "$userPath;$mvnBin", "User")
                    $env:Path += ";$mvnBin"
                }
                $mavenOk = $true
                Write-OK "Maven installed to $MAVEN_HOME"
            }
        } catch {
            Write-Fail "Failed to download Maven: $($_.Exception.Message)"
            Write-Warn "Download manually: https://maven.apache.org/download.cgi"
            Pause-Continue
        }
    } else {
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        $mavenOk = $null -ne (Get-Command mvn -ErrorAction SilentlyContinue)
    }
}

# ── .NET 9 Desktop Runtime ───────────────────────────────────
if (-not $dotnetOk) {
    Write-Step "Installing .NET 9 Desktop Runtime..."
    $ok = Install-WithWinget "Microsoft.DotNet.DesktopRuntime.9" ".NET 9 Desktop Runtime"
    if (-not $ok) {
        Write-Warn "Please install manually: https://dotnet.microsoft.com/en-us/download/dotnet/9.0"
        Write-Warn "Download '.NET Desktop Runtime 9.x' Windows x64 installer."
        Pause-Continue
    } else {
        $dotnetOk = $true
    }
}

# ── WebView2 ─────────────────────────────────────────────────
if (-not $webview2Ok) {
    Write-Warn "WebView2 not detected. The desktop app uses WebView2."
    Write-Warn "On Windows 11 it is pre-installed with Microsoft Edge."
    Write-Warn "If the desktop app fails to open, install from:"
    Write-Warn "  https://developer.microsoft.com/en-us/microsoft-edge/webview2/"
}

# =============================================================
Write-Header "PHASE 3 — Environment Configuration"
# =============================================================

# ── JAVA_HOME ────────────────────────────────────────────────
Write-Step "Setting JAVA_HOME..."
if ($JAVA_HOME_PATH -and (Test-Path "$JAVA_HOME_PATH\bin\java.exe")) {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $JAVA_HOME_PATH, "User")
    $env:JAVA_HOME = $JAVA_HOME_PATH
    Write-OK "JAVA_HOME = $JAVA_HOME_PATH"
} elseif ($javaOk) {
    $javaExe = Get-Command java -ErrorAction SilentlyContinue
    if ($javaExe) {
        $guess = Split-Path (Split-Path $javaExe.Source)
        [Environment]::SetEnvironmentVariable("JAVA_HOME", $guess, "User")
        $env:JAVA_HOME = $guess
        Write-OK "JAVA_HOME = $guess"
        $JAVA_HOME_PATH = $guess
    }
} else {
    Write-Warn "Skipping JAVA_HOME — Java not installed"
}

# ── Tomcat setenv.bat ────────────────────────────────────────
if ($TOMCAT_HOME -and $JAVA_HOME_PATH) {
    Write-Step "Creating Tomcat setenv.bat..."
    $setenvPath = "$TOMCAT_HOME\bin\setenv.bat"
    $setenvContent = "@echo off`r`nset JAVA_HOME=$JAVA_HOME_PATH`r`nset JRE_HOME=$JAVA_HOME_PATH`r`n"
    Set-Content -Path $setenvPath -Value $setenvContent -Encoding ASCII
    Write-OK "Created $setenvPath"
}

# ── MySQL root password ───────────────────────────────────────
Write-Step "MySQL root password needed for database setup..."
$mysqlPass = ""
if ($mysqlOk) {
    # Test if password-less login works first
    $testResult = & mysql -u root --connect-timeout=5 -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "MySQL root has no password (or blank password works)"
    } else {
        $secure = Read-Host "    Enter MySQL root password" -AsSecureString
        $mysqlPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    }
}

# ── config.properties ────────────────────────────────────────
Write-Step "Setting up config.properties..."
$configSrc  = Join-Path $PROJECT_ROOT "src\main\resources\config.properties.example"
$configDest = Join-Path $PROJECT_ROOT "src\main\resources\config.properties"

if (-not (Test-Path $configDest)) {
    if (Test-Path $configSrc) {
        $configContent = Get-Content $configSrc -Raw
        $configContent = $configContent -replace 'your_password_here', $mysqlPass
        Set-Content -Path $configDest -Value $configContent -Encoding UTF8
        Write-OK "Created config.properties"
    } else {
        Write-Warn "config.properties.example not found — skipping"
    }
} else {
    # Update password if already exists
    $configContent = Get-Content $configDest -Raw
    if ($configContent -match 'your_password_here') {
        $configContent = $configContent -replace 'your_password_here', $mysqlPass
        Set-Content -Path $configDest -Value $configContent -Encoding UTF8
        Write-OK "Updated config.properties with MySQL password"
    } else {
        Write-OK "config.properties already exists — skipping"
    }
}

# ── launcher.config ──────────────────────────────────────────
if ($TOMCAT_HOME -and $JAVA_HOME_PATH) {
    Write-Step "Creating launcher.config..."
    $lcPath = Join-Path $PROJECT_ROOT "desktop-app\release\launcher.config"
    $lcContent = "JAVA_HOME=$JAVA_HOME_PATH`r`nCATALINA_HOME=$TOMCAT_HOME`r`nMYSQL_SERVICE=MySQL80`r`n"
    Set-Content -Path $lcPath -Value $lcContent -Encoding ASCII
    Write-OK "Created launcher.config"
}

# =============================================================
Write-Header "PHASE 4 — Database Setup"
# =============================================================

if ($mysqlOk) {
    $mysqlArgs = @("-u", "root")
    if ($mysqlPass) { $mysqlArgs += "--password=$mysqlPass" }
    $mysqlArgs += "--connect-timeout=10"

    Write-Step "Creating database 'metrolink_db' if not exists..."
    try {
        $createDb = "CREATE DATABASE IF NOT EXISTS metrolink_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        & mysql @mysqlArgs -e $createDb 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Database 'metrolink_db' ready"
        } else {
            Write-Warn "Could not create database — check MySQL credentials"
        }
    } catch {
        Write-Warn "MySQL command failed: $($_.Exception.Message)"
    }

    Write-Step "Running schema.sql..."
    $schemaFile = Join-Path $PROJECT_ROOT "src\main\resources\schema.sql"
    if (Test-Path $schemaFile) {
        try {
            & mysql @mysqlArgs metrolink_db -e "source $schemaFile" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-OK "Schema applied"
            } else {
                # Try alternate method
                $content = Get-Content $schemaFile -Raw
                & mysql @mysqlArgs metrolink_db -e $content 2>&1
                Write-OK "Schema applied (alternate method)"
            }
        } catch {
            Write-Warn "Schema execution failed: $($_.Exception.Message)"
            Write-Warn "Run manually: mysql -u root -p metrolink_db < src\main\resources\schema.sql"
        }
    } else {
        Write-Warn "schema.sql not found at expected path — skipping"
    }
} else {
    Write-Warn "Skipping database setup — MySQL not available"
}

# =============================================================
Write-Header "PHASE 5 — Build & Deploy"
# =============================================================

if ($mavenOk) {
    Write-Step "Building backend (mvn clean package)..."
    Write-Host "    This may take a minute on first run..." -ForegroundColor Gray
    try {
        Push-Location $PROJECT_ROOT
        & mvn clean package -q 2>&1
        $buildOk = $LASTEXITCODE -eq 0
        Pop-Location

        if ($buildOk) {
            Write-OK "Build successful"
        } else {
            Write-Fail "Maven build failed — check the output above"
        }
    } catch {
        Write-Fail "Maven build error: $($_.Exception.Message)"
        $buildOk = $false
        Pop-Location
    }

    if ($buildOk -and $TOMCAT_HOME) {
        Write-Step "Deploying WAR to Tomcat..."
        $warSrc  = Join-Path $PROJECT_ROOT "target\metrolink-backend.war"
        $warDest = "$TOMCAT_HOME\webapps\metrolink-backend.war"
        if (Test-Path $warSrc) {
            Copy-Item $warSrc $warDest -Force
            Write-OK "WAR deployed to $warDest"
        } else {
            Write-Warn "WAR not found at $warSrc"
        }

        Write-Step "Deploying frontend to Tomcat..."
        $feSrc  = Join-Path $PROJECT_ROOT "frontend"
        $feDest = "$TOMCAT_HOME\webapps\metrolink-frontend"
        if (Test-Path $feSrc) {
            if (Test-Path $feDest) { Remove-Item $feDest -Recurse -Force }
            Copy-Item $feSrc $feDest -Recurse -Force
            Write-OK "Frontend deployed to $feDest"
        } else {
            Write-Warn "frontend folder not found at $feSrc"
        }
    } elseif ($buildOk -and -not $TOMCAT_HOME) {
        Write-Warn "Build succeeded but Tomcat not found — manual deployment needed"
        Write-Warn "Copy target\metrolink-backend.war to <TOMCAT>\webapps\"
        Write-Warn "Copy frontend\ folder to <TOMCAT>\webapps\metrolink-frontend\"
    }
} else {
    Write-Warn "Skipping build — Maven not available"
    Write-Warn "Install Maven and run: mvn clean package"
}

# =============================================================
Write-Header "SUMMARY"
# =============================================================

function Status($label, $ok) {
    if ($ok) { Write-Host "  [OK]  $label" -ForegroundColor Green }
    else      { Write-Host "  [!!]  $label — action may be needed" -ForegroundColor Yellow }
}

Status "Java JDK 21+"           $javaOk
Status "MySQL 8.0"              $mysqlOk
Status "Apache Tomcat 10.1"     $tomcatOk
Status "Apache Maven"           $mavenOk
Status ".NET 9 Desktop Runtime" $dotnetOk
Status "WebView2 Runtime"       ([bool]$webview2Ok)

if ($TOMCAT_HOME) {
    Write-Host "`n  Tomcat path  : $TOMCAT_HOME" -ForegroundColor Cyan
}
if ($JAVA_HOME_PATH) {
    Write-Host "  JAVA_HOME    : $JAVA_HOME_PATH" -ForegroundColor Cyan
}

Write-Host "`n  Default login: admin / admin123" -ForegroundColor White
Write-Host "  Desktop app  : desktop-app\release\Metrolink FOMS.exe" -ForegroundColor White
Write-Host "  Browser      : http://localhost:8080/metrolink-frontend/" -ForegroundColor White

$allGood = $javaOk -and $mysqlOk -and $tomcatOk -and $mavenOk
if ($allGood) {
    Write-Host "`n  All prerequisites met! You're ready to run Metrolink FOMS." -ForegroundColor Green
} else {
    Write-Host "`n  Some components need attention. Fix the items above, then re-run setup.ps1." -ForegroundColor Yellow
}

Write-Host ""
Pause-Continue
