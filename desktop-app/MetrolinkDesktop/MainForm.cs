using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.Net.Http;
using System.ServiceProcess;

namespace MetrolinkDesktop;

public class MainForm : Form {

    const string APP_URL    = "http://localhost:8080/metrolink-frontend/";
    const string HEALTH_URL = "http://localhost:8080/metrolink-frontend/";

    static string javaHome     = "";
    static string catalinaHome = "";
    static string mysqlService = "";

    // ── UI controls ──────────────────────────────────────
    WebView2 webView      = new();
    Panel    loadingPanel = new();
    Label    statusLabel  = new();
    Label    titleLabel   = new();
    Label    subLabel     = new();

    bool _closing = false;

    public MainForm() {
        BuildUI();
        this.Load    += OnLoad;
        this.FormClosing += OnFormClosing;
    }

    void BuildUI() {
        // Window
        Text            = "Metrolink FOMS";
        Size            = new Size(1366, 768);
        MinimumSize     = new Size(1024, 640);
        StartPosition   = FormStartPosition.CenterScreen;
        WindowState     = FormWindowState.Maximized;
        BackColor       = Color.FromArgb(26, 35, 126);
        Icon            = SystemIcons.Application;

        // WebView (hidden until ready)
        webView.Dock    = DockStyle.Fill;
        webView.Visible = false;
        Controls.Add(webView);

        // Loading overlay
        loadingPanel.Dock      = DockStyle.Fill;
        loadingPanel.BackColor = Color.FromArgb(26, 35, 126);

        titleLabel.Text      = "METROLINK FOMS";
        titleLabel.ForeColor = Color.White;
        titleLabel.Font      = new Font("Segoe UI", 28, FontStyle.Bold);
        titleLabel.AutoSize  = true;

        subLabel.Text      = "Financial and Operational Management System";
        subLabel.ForeColor = Color.FromArgb(159, 168, 218);
        subLabel.Font      = new Font("Segoe UI", 11, FontStyle.Regular);
        subLabel.AutoSize  = true;

        statusLabel.Text      = "Initializing...";
        statusLabel.ForeColor = Color.FromArgb(200, 210, 255);
        statusLabel.Font      = new Font("Segoe UI", 10);
        statusLabel.AutoSize  = true;

        loadingPanel.Controls.AddRange([titleLabel, subLabel, statusLabel]);
        Controls.Add(loadingPanel);
        loadingPanel.BringToFront();

        // Center labels on resize
        loadingPanel.Resize += (s, e) => CenterLoadingLabels();
        CenterLoadingLabels();
    }

    void CenterLoadingLabels() {
        int cx = loadingPanel.Width  / 2;
        int cy = loadingPanel.Height / 2;
        titleLabel.Location  = new Point(cx - titleLabel.Width  / 2, cy - 80);
        subLabel.Location    = new Point(cx - subLabel.Width    / 2, cy - 30);
        statusLabel.Location = new Point(cx - statusLabel.Width / 2, cy + 20);
    }

    async void OnLoad(object? sender, EventArgs e) {
        // Init WebView2 (uses Edge runtime already on the PC)
        try {
            string cacheDir = Path.Combine(Path.GetTempPath(), "MetrolinkFOMS", "WebView2");
            if (Directory.Exists(cacheDir)) Directory.Delete(cacheDir, true);
            webView.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = cacheDir };
            await webView.EnsureCoreWebView2Async();
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled            = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled            = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled          = false;
            webView.CoreWebView2.NewWindowRequested += (s, args) => args.Handled = true;
        } catch (Exception ex) {
            MessageBox.Show(
                "WebView2 runtime not found.\n\nPlease install Microsoft Edge WebView2 Runtime:\n" +
                "https://developer.microsoft.com/en-us/microsoft-edge/webview2/\n\n" + ex.Message,
                "Metrolink FOMS — Missing Component",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            Application.Exit(); return;
        }

        // Start server on background thread
        await Task.Run(StartServer);

        // Show app
        webView.Source  = new Uri(APP_URL);
        webView.Visible = true;
        loadingPanel.Visible = false;
    }

    // ── Auto-logout on close ──────────────────────────────
    void OnFormClosing(object? sender, FormClosingEventArgs e) {
        if (_closing) return;
        _closing = true;
    }

    // ── Server startup ────────────────────────────────────
    void StartServer() {
        SetStatus("Reading configuration...");
        if (!ResolveConfig()) {
            Invoke(() => {
                MessageBox.Show(
                    "Could not find Java or Tomcat.\n\n" +
                    "Please create  desktop-app\\launcher.config  with:\n" +
                    "  JAVA_HOME=<path to JDK>\n" +
                    "  CATALINA_HOME=<path to Tomcat>",
                    "Metrolink FOMS — Setup Required",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Application.Exit();
            });
            return;
        }

        SetStatus("Starting MySQL...");
        EnsureMySQL();

        SetStatus("Stopping any existing server instance...");
        StopExistingTomcat();

        SetStatus("Starting application server...");
        StartTomcat();

        SetStatus("Waiting for server to be ready...");
        for (int i = 0; i < 40; i++) {
            if (PortResponds()) return;
            SetStatus($"Starting server... ({i + 1}s)");
            Thread.Sleep(1000);
        }
    }

    // ── Config ────────────────────────────────────────────
    bool ResolveConfig() {
        var cfg = ReadConfigFile();

        javaHome = Get(cfg, "JAVA_HOME")
                ?? Environment.GetEnvironmentVariable("JAVA_HOME")
                ?? FindJava() ?? "";

        catalinaHome = Get(cfg, "CATALINA_HOME")
                    ?? Environment.GetEnvironmentVariable("CATALINA_HOME")
                    ?? FindTomcat() ?? "";

        mysqlService = Get(cfg, "MYSQL_SERVICE") ?? FindMySQLService() ?? "";

        return !string.IsNullOrEmpty(javaHome)     && Directory.Exists(javaHome)
            && !string.IsNullOrEmpty(catalinaHome) && Directory.Exists(catalinaHome);
    }

    static Dictionary<string, string> ReadConfigFile() {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string f = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher.config");
        if (!File.Exists(f)) return map;
        foreach (var line in File.ReadAllLines(f)) {
            var l = line.Trim();
            if (l.StartsWith('#') || !l.Contains('=')) continue;
            var parts = l.Split('=', 2);
            if (parts.Length == 2) map[parts[0].Trim()] = parts[1].Trim();
        }
        return map;
    }

    static string? Get(Dictionary<string, string> d, string key) =>
        d.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

    static string? FindJava() {
        string[] roots = [
            @"C:\Program Files\Java",
            @"C:\Program Files\Eclipse Adoptium",
            @"C:\Program Files\Microsoft",
            @"C:\Program Files\OpenJDK",
            @"C:\Program Files\Semeru"
        ];
        string? best = null;
        foreach (var root in roots) {
            if (!Directory.Exists(root)) continue;
            foreach (var dir in Directory.GetDirectories(root))
                if (File.Exists(Path.Combine(dir, "bin", "java.exe"))) best = dir;
        }
        return best;
    }

    static string? FindTomcat() {
        string user = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string[] roots = [
            Path.Combine(user, "tomcat"),
            Path.Combine(user, "apache-tomcat"),
            @"C:\tomcat", @"C:\apache-tomcat",
            @"C:\Program Files\Apache Software Foundation"
        ];
        foreach (var root in roots) {
            if (!Directory.Exists(root)) continue;
            if (File.Exists(Path.Combine(root, "bin", "startup.bat"))) return root;
            foreach (var sub in Directory.GetDirectories(root)) {
                if (File.Exists(Path.Combine(sub, "bin", "startup.bat"))) return sub;
                foreach (var sub2 in Directory.GetDirectories(sub))
                    if (File.Exists(Path.Combine(sub2, "bin", "startup.bat"))) return sub2;
            }
        }
        return null;
    }

    static string? FindMySQLService() {
        foreach (var name in new[] { "MySQL80", "MySQL8", "MySQL57", "MySQL5", "MySQL" }) {
            try { new ServiceController(name).Refresh(); return name; } catch { }
        }
        return null;
    }

    // ── MySQL ─────────────────────────────────────────────
    static void EnsureMySQL() {
        if (string.IsNullOrEmpty(mysqlService)) return;
        try {
            var sc = new ServiceController(mysqlService);
            if (sc.Status != ServiceControllerStatus.Running) {
                sc.Start();
                sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
            }
        } catch { }
    }

    // ── Tomcat ────────────────────────────────────────────
    static void StopExistingTomcat() {
        try {
            var psi = new ProcessStartInfo("cmd.exe") {
                Arguments        = $"/c \"{Path.Combine(catalinaHome, "bin", "shutdown.bat")}\"",
                WorkingDirectory = catalinaHome,
                UseShellExecute  = false,
                CreateNoWindow   = true
            };
            psi.EnvironmentVariables["JAVA_HOME"]     = javaHome;
            psi.EnvironmentVariables["CATALINA_HOME"] = catalinaHome;
            var p = Process.Start(psi);
            p?.WaitForExit(6000);
        } catch { }
        // Kill only the java.exe that owns port 8080 (not VS Code or other Java tools)
        try {
            var findPid = new ProcessStartInfo("cmd.exe") {
                Arguments = "/c netstat -ano | findstr \":8080 \" | findstr \"LISTENING\"",
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true
            };
            var fp = Process.Start(findPid);
            string line = fp?.StandardOutput.ReadToEnd() ?? "";
            fp?.WaitForExit(3000);
            string[] parts = line.Trim().Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 0) {
                Process.Start(new ProcessStartInfo("taskkill") {
                    Arguments = $"/F /PID {parts[^1]}",
                    UseShellExecute = false, CreateNoWindow = true
                })?.WaitForExit(3000);
            }
        } catch { }
        Thread.Sleep(2000);
        // Delete extracted folder so Tomcat re-extracts cleanly from WAR
        string extracted = Path.Combine(catalinaHome, "webapps", "metrolink-backend");
        if (Directory.Exists(extracted)) {
            try { Directory.Delete(extracted, true); } catch { }
        }
    }

    static void StartTomcat() {
        StopExistingTomcat();
        try {
            var psi = new ProcessStartInfo("cmd.exe") {
                Arguments        = $"/c \"{Path.Combine(catalinaHome, "bin", "startup.bat")}\"",
                WorkingDirectory = catalinaHome,
                UseShellExecute  = false,
                CreateNoWindow   = true
            };
            psi.EnvironmentVariables["JAVA_HOME"]     = javaHome;
            psi.EnvironmentVariables["CATALINA_HOME"] = catalinaHome;
            Process.Start(psi);
        } catch { }
    }

    static bool PortResponds() {
        try {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            client.GetAsync(HEALTH_URL).GetAwaiter().GetResult();
            return true;
        } catch { return false; }
    }

    void SetStatus(string msg) =>
        Invoke(() => {
            statusLabel.Text = msg;
            CenterLoadingLabels();
        });
}
