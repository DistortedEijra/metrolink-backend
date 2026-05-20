using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.ServiceProcess;
using System.Threading;

class MetrolinkLauncher {

    const string APP_URL    = "http://localhost:8080/metrolink-frontend/";
    const string HEALTH_URL = "http://localhost:8080/metrolink-frontend/";

    static string javaHome     = "";
    static string catalinaHome = "";
    static string mysqlService = "";

    static void Main() {
        Console.Title = "Metrolink FOMS Launcher";
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Header();

        if (!ResolveConfig()) { Pause(); return; }
        if (!CheckSetup())    { Pause(); return; }

        EnsureMySQL();
        StartTomcat();
        WaitForServer();
        OpenBrowser();

        Console.WriteLine();
        Color("  App is running at: " + APP_URL, ConsoleColor.Cyan);
        Console.WriteLine("  Close this window to exit (Tomcat keeps running).");
        Console.WriteLine();
        Console.Write("  Press any key to exit... ");
        Console.ReadKey(true);
    }

    // ── Config resolution ─────────────────────────────────
    static bool ResolveConfig() {
        var cfg = ReadConfigFile();

        // Java
        javaHome = GetCfg(cfg, "JAVA_HOME")
                ?? Environment.GetEnvironmentVariable("JAVA_HOME")
                ?? FindJava();

        if (string.IsNullOrEmpty(javaHome) || !Directory.Exists(javaHome)) {
            FAIL("Java JDK not found.");
            Console.WriteLine("       Install JDK 21+ from https://adoptium.net");
            Console.WriteLine("       Then set JAVA_HOME in System Environment Variables,");
            Console.WriteLine("       or add  JAVA_HOME=<path>  to launcher\\launcher.config");
            return false;
        }
        Step("Java");  OK(javaHome);

        // Tomcat
        catalinaHome = GetCfg(cfg, "CATALINA_HOME")
                    ?? Environment.GetEnvironmentVariable("CATALINA_HOME")
                    ?? FindTomcat();

        if (string.IsNullOrEmpty(catalinaHome) || !Directory.Exists(catalinaHome)) {
            FAIL("Apache Tomcat 10+ not found.");
            Console.WriteLine("       Download from https://tomcat.apache.org/download-10.cgi");
            Console.WriteLine("       Then set CATALINA_HOME in System Environment Variables,");
            Console.WriteLine("       or add  CATALINA_HOME=<path>  to launcher\\launcher.config");
            return false;
        }
        Step("Tomcat");  OK(catalinaHome);

        // MySQL service name
        mysqlService = GetCfg(cfg, "MYSQL_SERVICE") ?? FindMySQLService();
        Step("MySQL service");
        if (string.IsNullOrEmpty(mysqlService)) WARN("not found — assuming MySQL is already running");
        else OK(mysqlService);

        return true;
    }

    static Dictionary<string,string> ReadConfigFile() {
        var map = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        string f = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher.config");
        if (!File.Exists(f)) return map;
        foreach (var line in File.ReadAllLines(f)) {
            var l = line.Trim();
            if (l.StartsWith("#") || !l.Contains("=")) continue;
            var parts = l.Split(new char[]{'='}, 2);
            if (parts.Length == 2) map[parts[0].Trim()] = parts[1].Trim();
        }
        return map;
    }

    static string GetCfg(Dictionary<string,string> d, string key) {
        string v;
        return (d.TryGetValue(key, out v) && !string.IsNullOrWhiteSpace(v)) ? v : null;
    }

    // ── Auto-detect Java ──────────────────────────────────
    static string FindJava() {
        string[] roots = {
            @"C:\Program Files\Java",
            @"C:\Program Files\Eclipse Adoptium",
            @"C:\Program Files\Microsoft",
            @"C:\Program Files\OpenJDK",
            @"C:\Program Files\Semeru",
            @"C:\Program Files\BellSoft"
        };
        string best = null;
        foreach (var root in roots) {
            if (!Directory.Exists(root)) continue;
            try {
                foreach (var dir in Directory.GetDirectories(root)) {
                    if (File.Exists(Path.Combine(dir, "bin", "java.exe")))
                        best = dir;
                }
            } catch { }
        }
        return best;
    }

    // ── Auto-detect Tomcat ────────────────────────────────
    static string FindTomcat() {
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string[] searchRoots = {
            Path.Combine(userProfile, "tomcat"),
            Path.Combine(userProfile, "apache-tomcat"),
            @"C:\tomcat",
            @"C:\apache-tomcat",
            @"C:\Program Files\Apache Software Foundation",
            @"C:\Program Files (x86)\Apache Software Foundation"
        };
        foreach (var searchRoot in searchRoots) {
            if (!Directory.Exists(searchRoot)) continue;
            if (File.Exists(Path.Combine(searchRoot, "bin", "startup.bat"))) return searchRoot;
            try {
                foreach (var sub in Directory.GetDirectories(searchRoot)) {
                    if (File.Exists(Path.Combine(sub, "bin", "startup.bat"))) return sub;
                    foreach (var sub2 in Directory.GetDirectories(sub)) {
                        if (File.Exists(Path.Combine(sub2, "bin", "startup.bat"))) return sub2;
                    }
                }
            } catch { }
        }
        return null;
    }

    // ── Auto-detect MySQL service ─────────────────────────
    static string FindMySQLService() {
        string[] names = { "MySQL80", "MySQL8", "MySQL57", "MySQL5", "MySQL" };
        foreach (var name in names) {
            try { var sc = new ServiceController(name); sc.Refresh(); return name; }
            catch { }
        }
        return null;
    }

    // ── Setup checks ──────────────────────────────────────
    static bool CheckSetup() {
        string war     = Path.Combine(catalinaHome, "webapps", "metrolink-backend.war");
        string webapp  = Path.Combine(catalinaHome, "webapps", "metrolink-backend");
        string frEnd   = Path.Combine(catalinaHome, "webapps", "metrolink-frontend");
        string frEndIdx= Path.Combine(catalinaHome, "webapps", "metrolink-frontend", "index.html");

        if (!File.Exists(war) && !Directory.Exists(webapp)) {
            FAIL("metrolink-backend.war is not deployed.");
            Console.WriteLine("       Build: mvn clean package");
            Console.WriteLine("       Then copy target\\metrolink-backend.war to:");
            Console.WriteLine("       " + Path.Combine(catalinaHome, "webapps"));
            return false;
        }
        Step("Backend WAR"); OK("found");

        if (!File.Exists(frEndIdx)) {
            WARN("frontend not found in Tomcat webapps.");
            Console.WriteLine("       Copy the frontend\\ folder from the repo to:");
            Console.WriteLine("       " + frEnd);
        } else {
            Step("Frontend"); OK("found");
        }
        return true;
    }

    // ── MySQL ─────────────────────────────────────────────
    static void EnsureMySQL() {
        if (string.IsNullOrEmpty(mysqlService)) return;
        Step("Starting MySQL");
        try {
            var sc = new ServiceController(mysqlService);
            if (sc.Status == ServiceControllerStatus.Running) { OK("Already running"); return; }
            sc.Start();
            sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
            OK("Started");
        } catch (Exception ex) {
            WARN("Could not start MySQL: " + ex.Message.Split('\n')[0]);
        }
    }

    // ── Tomcat ────────────────────────────────────────────
    static void StopExistingTomcat() {
        Step("Stopping any existing Tomcat");
        try {
            var psi = new ProcessStartInfo("cmd.exe") {
                Arguments        = "/c \"" + Path.Combine(catalinaHome, "bin", "shutdown.bat") + "\"",
                WorkingDirectory = catalinaHome,
                UseShellExecute  = false,
                CreateNoWindow   = true
            };
            psi.EnvironmentVariables["JAVA_HOME"]     = javaHome;
            psi.EnvironmentVariables["CATALINA_HOME"] = catalinaHome;
            var p = Process.Start(psi);
            p.WaitForExit(6000);
        } catch { }
        // Force-kill any remaining java.exe
        try {
            var kill = new ProcessStartInfo("taskkill");
            kill.Arguments = "/F /IM java.exe /T";
            kill.UseShellExecute = false;
            kill.CreateNoWindow = true;
            var kp = Process.Start(kill);
            if (kp != null) kp.WaitForExit(3000);
        } catch { }
        Thread.Sleep(2000);
        // Delete corrupted extracted folder so Tomcat re-extracts cleanly
        string extracted = Path.Combine(catalinaHome, "webapps", "metrolink-backend");
        if (Directory.Exists(extracted)) {
            try { Directory.Delete(extracted, true); } catch { }
        }
        OK("Done");
    }

    static void StartTomcat() {
        StopExistingTomcat();
        Step("Starting Tomcat");
        try {
            var psi = new ProcessStartInfo("cmd.exe") {
                Arguments        = "/c \"" + Path.Combine(catalinaHome, "bin", "startup.bat") + "\"",
                WorkingDirectory = catalinaHome,
                UseShellExecute  = false,
                CreateNoWindow   = true
            };
            psi.EnvironmentVariables["JAVA_HOME"]     = javaHome;
            psi.EnvironmentVariables["CATALINA_HOME"] = catalinaHome;
            Process.Start(psi);
            OK("Startup command sent");
        } catch (Exception ex) {
            FAIL("Failed to start Tomcat: " + ex.Message);
            Pause(); Environment.Exit(1);
        }
    }

    // ── Wait for server ───────────────────────────────────
    static void WaitForServer() {
        Step("Waiting for server");
        Console.Write("    ");
        for (int i = 0; i < 40; i++) {
            if (PortResponds()) { Console.WriteLine(); OK("Server is ready!"); return; }
            Console.Write("."); Thread.Sleep(1000);
        }
        Console.WriteLine();
        WARN("Server is taking too long. Check: " + Path.Combine(catalinaHome, "logs"));
    }

    static bool PortResponds() {
        try {
            var req = (HttpWebRequest)WebRequest.Create(HEALTH_URL);
            req.Timeout = 2000; req.Method = "HEAD";
            try { req.GetResponse().Close(); }
            catch (WebException we) { if (we.Response != null) we.Response.Close(); }
            return true;
        } catch { return false; }
    }

    // ── Open browser ──────────────────────────────────────
    static void OpenBrowser() {
        Step("Opening browser");
        try { Process.Start(new ProcessStartInfo { FileName = APP_URL, UseShellExecute = true }); OK("Done"); }
        catch { WARN("Open manually: " + APP_URL); }
    }

    // ── UI helpers ────────────────────────────────────────
    static void Header() {
        Console.ForegroundColor = ConsoleColor.DarkBlue;
        Console.WriteLine();
        Console.WriteLine("  +===========================================+");
        Console.WriteLine("  |   BACLARAN METROLINK BUS CORPORATION     |");
        Console.WriteLine("  |   Financial & Operational Mgmt System    |");
        Console.WriteLine("  +===========================================+");
        Console.ResetColor(); Console.WriteLine();
    }
    static void Step(string msg) {
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("  [" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg + "... ");
        Console.ResetColor();
    }
    static void OK(string msg)   { Console.ForegroundColor = ConsoleColor.Green;  Console.WriteLine(msg); Console.ResetColor(); }
    static void WARN(string msg) { Console.ForegroundColor = ConsoleColor.Yellow; Console.WriteLine("\n  ! " + msg); Console.ResetColor(); }
    static void FAIL(string msg) { Console.ForegroundColor = ConsoleColor.Red;    Console.WriteLine("\n  X " + msg); Console.ResetColor(); }
    static void Color(string msg, ConsoleColor c) { Console.ForegroundColor = c; Console.WriteLine(msg); Console.ResetColor(); }
    static void Pause() { Console.Write("\n  Press any key to exit... "); Console.ReadKey(true); }
}
