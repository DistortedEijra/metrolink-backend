; =============================================================
;  Metrolink FOMS — Inno Setup Installer Script
;  Compile with:  iscc setup.iss
;  Requires:      Inno Setup 6.x (https://jrsoftware.org/isinfo.php)
;                 Pre-built WAR at  ..\target\metrolink-backend.war
;                 Desktop app at    ..\desktop-app\MetrolinkDesktop\bin\Release\net9.0-windows\win-x64\
; =============================================================

#define MyAppName      "Metrolink FOMS"
#define MyAppVersion   "1.0.0"
#define MyAppPublisher "Baclaran Metrolink Bus Corporation"
#define MyAppExe       "app\MetrolinkDesktop.exe"

[Setup]
AppId={{A3F2C8B1-4D7E-4F2A-9C1B-E8D5F3A72B0C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/DistortedEijra/metrolink-backend
AppSupportURL=https://github.com/DistortedEijra/metrolink-backend
DefaultDirName={autopf}\MetrolinkFOMS
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=Metrolink FOMS Setup
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern
WizardResizable=no
DisableWelcomePage=no
LicenseFile=SETUP GUIDE.txt
ShowLanguageDialog=no

; Minimum Windows 10
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";    Description: "Create a &desktop shortcut";       GroupDescription: "Additional icons:"; Flags: checked
Name: "startmenuicon";  Description: "Create a &Start Menu shortcut";    GroupDescription: "Additional icons:"; Flags: checked

[Files]
; ── Pre-built backend WAR ────────────────────────────────────
Source: "..\target\metrolink-backend.war";        DestDir: "{app}\backend";    Flags: ignoreversion

; ── Database schema and config template ──────────────────────
Source: "..\src\main\resources\schema.sql";                DestDir: "{app}\backend";    Flags: ignoreversion
Source: "..\src\main\resources\config.properties.example"; DestDir: "{app}\backend";    Flags: ignoreversion

; ── Frontend static files ────────────────────────────────────
Source: "..\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Desktop app (WinForms + WebView2) ────────────────────────
Source: "..\desktop-app\MetrolinkDesktop\bin\Release\net9.0-windows\win-x64\*";
  DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Console launcher ────────────────────────────────────────
Source: "..\launcher\*"; DestDir: "{app}\launcher"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Post-install payload script ─────────────────────────────
Source: "setup-payload.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Desktop shortcut
Name: "{autodesktop}\{#MyAppName}";  Filename: "{app}\{#MyAppExe}"; \
  Tasks: desktopicon; IconFilename: "{app}\{#MyAppExe}"

; Start Menu shortcuts
Name: "{group}\{#MyAppName}";               Filename: "{app}\{#MyAppExe}"; \
  Tasks: startmenuicon; IconFilename: "{app}\{#MyAppExe}"
Name: "{group}\Uninstall {#MyAppName}";     Filename: "{uninstallexe}"

[Run]
; Run the payload script after installation (hidden window, wait for exit)
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File ""{app}\setup-payload.ps1"" -MysqlPass ""{code:GetMysqlPass}"" -AppDir ""{app}"" -TomcatBase ""{userdocs}\tomcat"""; \
  StatusMsg: "Configuring database and deploying application..."; \
  Flags: runhidden waituntilterminated; \
  Description: "Configure and deploy Metrolink FOMS"

; Offer to launch the app on finish
Filename: "{app}\{#MyAppExe}"; \
  Description: "Launch {#MyAppName}"; \
  Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop Tomcat before uninstall (best-effort — ignore errors)
Filename: "net.exe";          Parameters: "stop MySQL80";   Flags: runhidden; RunOnceId: "StopMySQL";   Check: MySQLServiceExists
Filename: "cmd.exe";          Parameters: "/c taskkill /F /IM java.exe /T"; Flags: runhidden; RunOnceId: "KillJava"

; ─────────────────────────────────────────────────────────────
; Pascal / Inno Setup code section
; Handles the custom MySQL password wizard page
; ─────────────────────────────────────────────────────────────
[Code]

var
  MysqlPassPage:   TInputQueryWizardPage;
  MysqlPassValue:  String;

// Called by [Run] Parameters to inject the password
function GetMysqlPass(Param: String): String;
begin
  Result := MysqlPassValue;
end;

// Check whether MySQL80 service exists (used in [UninstallRun])
function MySQLServiceExists(): Boolean;
var
  Svc: TStringList;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\MySQL80');
end;

procedure InitializeWizard;
begin
  // Custom page: MySQL root password — inserted before "Ready to Install"
  MysqlPassPage := CreateInputQueryPage(
    wpReady,
    'MySQL Root Password',
    'Required to create the Metrolink database',
    'Enter the root password you set when you installed MySQL 8.0.' + #13#10 +
    'If MySQL is not yet installed, leave this blank — you can re-run this installer after MySQL is set up.' + #13#10#13#10 +
    'This password is stored only in config.properties on this machine.'
  );
  MysqlPassPage.Add('MySQL root password:', True);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = MysqlPassPage.ID then begin
    MysqlPassValue := MysqlPassPage.Values[0];
    // Allow blank (MySQL may have no password or be installed later)
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    // Ensure value captured (should already be set by NextButtonClick)
    if MysqlPassPage <> nil then
      MysqlPassValue := MysqlPassPage.Values[0];
  end;
end;
