package com.metrolink.controller;

import com.metrolink.dao.UserDAO;
import com.metrolink.model.User;
import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import org.mindrot.jbcrypt.BCrypt;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Properties;

/**
 * POST /api/backup
 * Admin-only. Triggers a mysqldump of the metrolink_db database
 * and returns the backup file as a downloadable attachment.
 */
@WebServlet("/api/backup")
public class BackupServlet extends HttpServlet {

    private final UserDAO userDAO = new UserDAO();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            if (!"ADMIN".equals(req.getAttribute("role"))) {
                ResponseUtil.error(res, 403, "Admin access required"); return;
            }

            Map<String, Object> body = ResponseUtil.parseBody(req);
            String password = (String) body.get("password");
            if (password == null || password.isEmpty()) {
                ResponseUtil.error(res, 400, "Password confirmation is required"); return;
            }

            int userId = (int) req.getAttribute("userId");
            User user = userDAO.findById(userId);
            if (user == null || !BCrypt.checkpw(password, user.getPassword())) {
                ResponseUtil.error(res, 401, "Incorrect password"); return;
            }

            Properties props = new Properties();
            props.load(getClass().getClassLoader().getResourceAsStream("config.properties"));

            String dbUser = props.getProperty("db.username");
            String dbPass = props.getProperty("db.password");
            String dbName = "metrolink_db";

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String filename  = "metrolink_backup_" + timestamp + ".sql";

            // Create backup directory if it doesn't exist
            File backupDir = new File(System.getProperty("java.io.tmpdir"), "metrolink_backups");
            backupDir.mkdirs();
            File backupFile = new File(backupDir, filename);
            File defaultsFile = File.createTempFile("metrolink_mysqldump_", ".cnf");
            File errorFile = File.createTempFile("metrolink_mysqldump_", ".err");

            try {
                try (Writer writer = new OutputStreamWriter(new FileOutputStream(defaultsFile), StandardCharsets.UTF_8)) {
                    writer.write("[client]\n");
                    writer.write("user=" + optionValue(dbUser) + "\n");
                    writer.write("password=" + optionValue(dbPass) + "\n");
                }

                ProcessBuilder pb = new ProcessBuilder(
                    findMysqldumpExecutable(),
                    "--defaults-extra-file=" + defaultsFile.getAbsolutePath(),
                    "--single-transaction",
                    "--routines",
                    "--triggers",
                    dbName
                );
                pb.redirectOutput(backupFile);
                pb.redirectError(errorFile);

                Process process = pb.start();
                int exitCode = process.waitFor();

                if (exitCode != 0) {
                    ResponseUtil.error(res, 500, "Backup failed with exit code: " + exitCode + backupError(errorFile));
                    return;
                }
            } finally {
                defaultsFile.delete();
                errorFile.delete();
            }

            // Stream the file as a download
            res.setContentType("application/octet-stream");
            res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
            res.setContentLengthLong(backupFile.length());

            try (InputStream in = new FileInputStream(backupFile);
                 OutputStream out = res.getOutputStream()) {
                byte[] buf = new byte[8192];
                int len;
                while ((len = in.read(buf)) != -1) out.write(buf, 0, len);
            }

            // Clean up temp file after sending
            backupFile.delete();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            ResponseUtil.error(res, 500, "Backup interrupted");
        } catch (Exception e) {
            ResponseUtil.error(res, 500, "Backup error: " + e.getMessage());
        }
    }

    /** GET /api/backup — returns backup status info */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        if (!"ADMIN".equals(req.getAttribute("role"))) {
            ResponseUtil.error(res, 403, "Admin access required"); return;
        }
        ResponseUtil.success(res, Map.of(
            "message", "POST to /api/backup to trigger a database backup download",
            "format",  "SQL dump (mysqldump)",
            "database","metrolink_db"
        ));
    }

    private String optionValue(String value) {
        if (value == null) return "\"\"";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private String findMysqldumpExecutable() {
        String configured = System.getenv("MYSQLDUMP_PATH");
        if (configured != null && !configured.isBlank() && new File(configured).isFile()) {
            return configured;
        }

        String[] candidates = {
            "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
            "C:\\Program Files\\MySQL\\MySQL Workbench 8.0\\mysqldump.exe",
            "C:\\xampp\\mysql\\bin\\mysqldump.exe"
        };
        for (String candidate : candidates) {
            if (new File(candidate).isFile()) {
                return candidate;
            }
        }
        return "mysqldump";
    }

    private String backupError(File errorFile) {
        if (!errorFile.isFile() || errorFile.length() == 0) return "";
        try {
            String text = new String(java.nio.file.Files.readAllBytes(errorFile.toPath()), StandardCharsets.UTF_8).trim();
            if (text.isEmpty()) return "";
            return ": " + text.replaceAll("(?i)password\\s*=\\s*\\S+", "password=****");
        } catch (IOException e) {
            return "";
        }
    }
}
