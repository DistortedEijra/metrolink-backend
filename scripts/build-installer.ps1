# =============================================================
#  Metrolink FOMS - Build the installer EXE
#  Run from project root or scripts\ folder:
#    powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1
# =============================================================

$ErrorActionPreference = 'Stop'
$SCRIPTS_DIR  = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPTS_DIR

Write-Host ""
Write-Host "  Metrolink FOMS - Installer Builder" -ForegroundColor Cyan
Write-Host ""

# -- 1. Locate or install Inno Setup --------------------------
Write-Host "  Checking Inno Setup..." -ForegroundColor White

$isccExe = $null

$cmd = Get-Command iscc -ErrorAction SilentlyContinue
if ($cmd) { $isccExe = $cmd.Source }

if (-not $isccExe) {
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
    Write-Host "  Inno Setup not found - installing via winget..." -ForegroundColor DarkYellow
    $hasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)
    if ($hasWinget) {
        winget install --id JRSoftware.InnoSetup --exact --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        $cmd2 = Get-Command iscc -ErrorAction SilentlyContinue
        if ($cmd2) { $isccExe = $cmd2.Source }
        if (-not $isccExe) {
            foreach ($c in $candidates) { if (Test-Path $c) { $isccExe = $c } }
        }
    }
    if (-not $isccExe) {
        Write-Host "  [ERROR] Inno Setup could not be installed automatically." -ForegroundColor Red
        Write-Host "  Download from: https://jrsoftware.org/isdl.php then re-run." -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "  [OK] Inno Setup: $isccExe" -ForegroundColor Green

# -- 2. Ensure WAR exists -------------------------------------
Write-Host ""
Write-Host "  Checking backend WAR..." -ForegroundColor White
$warPath = Join-Path $PROJECT_ROOT "target\metrolink-backend.war"

if (-not (Test-Path $warPath)) {
    Write-Host "  WAR not found - building with Maven..." -ForegroundColor DarkYellow
    $mvnCmd = Get-Command mvn -ErrorAction SilentlyContinue
    if (-not $mvnCmd) {
        Write-Host "  [ERROR] Maven not found. Run: mvn clean package" -ForegroundColor Red
        exit 1
    }
    Push-Location $PROJECT_ROOT
    & mvn clean package -q
    $buildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $buildOk) {
        Write-Host "  [ERROR] Maven build failed." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [OK] WAR: $warPath" -ForegroundColor Green

# -- 3. Warn if desktop app binaries missing ------------------
$desktopExe = Join-Path $PROJECT_ROOT "desktop-app\MetrolinkDesktop\bin\Release\net9.0-windows\win-x64\MetrolinkDesktop.exe"
if (-not (Test-Path $desktopExe)) {
    Write-Host ""
    Write-Host "  [WARN] Desktop app binary not found:" -ForegroundColor Yellow
    Write-Host "  $desktopExe" -ForegroundColor Yellow
    Write-Host "  Build it first: cd desktop-app\MetrolinkDesktop && dotnet publish -c Release" -ForegroundColor Yellow
}

# -- 4. Create dist\ ------------------------------------------
$distDir = Join-Path $PROJECT_ROOT "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# -- 5. Compile -----------------------------------------------
Write-Host ""
Write-Host "  Compiling installer..." -ForegroundColor White
$issFile = Join-Path $SCRIPTS_DIR "setup.iss"

& $isccExe $issFile
$ok = $LASTEXITCODE -eq 0

if ($ok) {
    $out = Join-Path $distDir "Metrolink FOMS Setup.exe"
    Write-Host ""
    Write-Host "  Build successful!" -ForegroundColor Green
    Write-Host "  Output: $out" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Inno Setup compilation failed." -ForegroundColor Red
    exit 1
}
