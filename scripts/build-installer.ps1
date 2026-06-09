# =============================================================
#  Metrolink FOMS — Build the installer EXE
#  Run this from the scripts\ folder (or from anywhere):
#    powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1
#
#  What it does:
#   1. Checks for (or installs) Inno Setup 6 via winget
#   2. Ensures a pre-built WAR exists (runs mvn if not)
#   3. Compiles setup.iss  →  dist\Metrolink FOMS Setup.exe
# =============================================================

$ErrorActionPreference = 'Stop'
$SCRIPTS_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPTS_DIR

Write-Host "`n══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Metrolink FOMS — Installer Builder" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════`n" -ForegroundColor Cyan

# ── 1. Locate or install Inno Setup ──────────────────────────
Write-Host "  ► Checking Inno Setup..." -ForegroundColor White

$isccExe = Get-Command iscc -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue

if (-not $isccExe) {
    # Try common install paths
    $candidates = @(
        "$env:ProgramFiles (x86)\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $isccExe = $c; break }
    }
}

if (-not $isccExe) {
    Write-Host "    [--] Inno Setup not found — installing via winget..." -ForegroundColor DarkYellow
    $hasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)
    if ($hasWinget) {
        winget install --id JRSoftware.InnoSetup --exact --silent --accept-package-agreements --accept-source-agreements
        # Refresh PATH and search again
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        $isccExe = (Get-Command iscc -ErrorAction SilentlyContinue)?.Source
        if (-not $isccExe) {
            # Re-scan common paths after install
            $candidates | ForEach-Object { if (Test-Path $_) { $isccExe = $_ } }
        }
    }
    if (-not $isccExe) {
        Write-Host "`n  [XX] Inno Setup could not be installed automatically." -ForegroundColor Red
        Write-Host "       Download and install from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
        Write-Host "       Then re-run this script.`n" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "    [OK] Inno Setup found: $isccExe" -ForegroundColor Green

# ── 2. Ensure pre-built WAR exists ───────────────────────────
Write-Host "`n  ► Checking backend WAR..." -ForegroundColor White
$warPath = Join-Path $PROJECT_ROOT "target\metrolink-backend.war"

if (-not (Test-Path $warPath)) {
    Write-Host "    [--] WAR not found — building with Maven..." -ForegroundColor DarkYellow
    $mvnExe = Get-Command mvn -ErrorAction SilentlyContinue
    if (-not $mvnExe) {
        Write-Host "  [XX] Maven not found. Install Maven or build manually first: mvn clean package" -ForegroundColor Red
        exit 1
    }
    Push-Location $PROJECT_ROOT
    & mvn clean package -q
    $buildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $buildOk) {
        Write-Host "  [XX] Maven build failed. Fix build errors and re-run." -ForegroundColor Red
        exit 1
    }
    Write-Host "    [OK] WAR built: $warPath" -ForegroundColor Green
} else {
    Write-Host "    [OK] WAR found: $warPath" -ForegroundColor Green
}

# ── 3. Ensure desktop app release binaries exist ─────────────
$desktopAppRelease = Join-Path $PROJECT_ROOT "desktop-app\MetrolinkDesktop\bin\Release\net9.0-windows\win-x64\MetrolinkDesktop.exe"
if (-not (Test-Path $desktopAppRelease)) {
    Write-Host "`n  [!!] Desktop app binaries not found at expected path:" -ForegroundColor Yellow
    Write-Host "       $desktopAppRelease" -ForegroundColor Yellow
    Write-Host "       Build it first: cd desktop-app\MetrolinkDesktop && dotnet publish -c Release" -ForegroundColor Yellow
    Write-Host "       (Continuing anyway — installer will fail at [Files] if missing)`n" -ForegroundColor Yellow
}

# ── 4. Create dist\ output folder ────────────────────────────
$distDir = Join-Path $PROJECT_ROOT "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# ── 5. Compile the installer ─────────────────────────────────
Write-Host "`n  ► Compiling installer..." -ForegroundColor White
$issFile = Join-Path $SCRIPTS_DIR "setup.iss"

& $isccExe $issFile
$compileOk = $LASTEXITCODE -eq 0

if ($compileOk) {
    $outputExe = Join-Path $distDir "Metrolink FOMS Setup.exe"
    Write-Host "`n  ══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "    Build successful!" -ForegroundColor Green
    Write-Host "    Output: $outputExe" -ForegroundColor Green
    Write-Host "  ══════════════════════════════════════════════════`n" -ForegroundColor Green
} else {
    Write-Host "`n  [XX] Inno Setup compilation failed. Check errors above." -ForegroundColor Red
    exit 1
}
