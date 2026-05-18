using System;
using System.Diagnostics;
using System.Net;
using System.ServiceProcess;
using System.Threading;

class MetrolinkLauncher {

    const string JAVA_HOME     = @"C:\Program Files\Java\jdk-22";
    const string CATALINA_HOME = @"C:\Users\Arjie\tomcat\apache-tomcat-10.1.39";
    const string MYSQL_SERVICE = "MySQL80";
    const string APP_URL       = "http://localhost:8080/metrolink-frontend/";
    const string HEALTH_URL    = "http://localhost:8080/metrolink-frontend/";

    static void Main() {
        Console.Title = "Metrolink FOMS Launcher";
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        Header();

        EnsureMySQL();
        StartTomcat();
        WaitForServer();
        OpenBrowser();

        Console.WriteLine();
        Color("  App is running at: " + APP_URL, ConsoleColor.Cyan);
        Console.WriteLine("  Close this window to exit (Tomcat keeps running in background).");
        Console.WriteLine();
        Console.Write("  Press any key to exit... ");
        Console.ReadKey(true);
    }

    static void Header() {
        Console.ForegroundColor = ConsoleColor.DarkBlue;
        Console.WriteLine();
        Console.WriteLine("  +===========================================+");
        Console.WriteLine("  |   BACLARAN METROLINK BUS CORPORATION     |");
        Console.WriteLine("  |   Financial & Operational Mgmt System    |");
        Console.WriteLine("  +===========================================+");
        Console.ResetColor();
        Console.WriteLine();
    }

    static void EnsureMySQL() {
        Step("Checking MySQL service");
        try {
            var sc = new ServiceController(MYSQL_SERVICE);
            if (sc.Status == ServiceControllerStatus.Running) {
                OK("Already running");
            } else {
                Console.Write("Starting... ");
                sc.Start();
                sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
                OK("Started");
            }
        } catch (Exception ex) {
            WARN("Could not control service: " + ex.Message.Split('\n')[0]);
            WARN("MySQL may already be running — continuing.");
        }
    }

    static void StartTomcat() {
        Step("Checking Tomcat");

        // Already running?
        if (PortResponds()) { OK("Already running"); return; }

        Step("Starting Tomcat");
        try {
            var psi = new ProcessStartInfo("cmd.exe") {
                Arguments        = "/c \"" + CATALINA_HOME + "\\bin\\startup.bat\"",
                WorkingDirectory = CATALINA_HOME,
                UseShellExecute  = false,
                CreateNoWindow   = true
            };
            psi.EnvironmentVariables["JAVA_HOME"]     = JAVA_HOME;
            psi.EnvironmentVariables["CATALINA_HOME"] = CATALINA_HOME;
            Process.Start(psi);
            OK("Startup command sent");
        } catch (Exception ex) {
            FAIL("Failed: " + ex.Message);
            Pause();
            Environment.Exit(1);
        }
    }

    static void WaitForServer() {
        Step("Waiting for server");
        Console.Write("    ");
        for (int i = 0; i < 40; i++) {
            if (PortResponds()) {
                Console.WriteLine();
                OK("Server is ready!");
                return;
            }
            Console.Write(".");
            Thread.Sleep(1000);
        }
        Console.WriteLine();
        WARN("Server taking longer than expected. Check Tomcat window for errors.");
    }

    static bool PortResponds() {
        try {
            var req = (HttpWebRequest)WebRequest.Create(HEALTH_URL);
            req.Timeout = 2000;
            req.Method  = "HEAD";
            try { req.GetResponse().Close(); }
            catch (WebException we) {
                if (we.Response != null) { we.Response.Close(); }
            }
            return true;
        } catch { return false; }
    }

    static void OpenBrowser() {
        Step("Opening browser");
        try {
            Process.Start(new ProcessStartInfo { FileName = APP_URL, UseShellExecute = true });
            OK("Done");
        } catch {
            WARN("Please open manually: " + APP_URL);
        }
    }

    // ── Helpers ───────────────────────────────────────
    static void Step(string msg) {
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("  [" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg + "... ");
        Console.ResetColor();
    }
    static void OK(string msg) {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine(msg);
        Console.ResetColor();
    }
    static void WARN(string msg) {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n  ! " + msg);
        Console.ResetColor();
    }
    static void FAIL(string msg) {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("\n  X " + msg);
        Console.ResetColor();
    }
    static void Color(string msg, ConsoleColor c) {
        Console.ForegroundColor = c; Console.WriteLine(msg); Console.ResetColor();
    }
    static void Pause() {
        Console.Write("\n  Press any key to exit... ");
        Console.ReadKey(true);
    }
}
