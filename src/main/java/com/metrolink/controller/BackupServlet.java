package com.metrolink.controller;

import com.metrolink.util.ResponseUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.*;
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

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            if (!"ADMIN".equals(req.getAttribute("role"))) {
                ResponseUtil.error(res, 403, "Admin access required"); return;
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

            ProcessBuilder pb = new ProcessBuilder(
                "mysqldump",
                "-u" + dbUser,
                "-p" + dbPass,
                "--single-transaction",
                "--routines",
                "--triggers",
                dbName
            );
            pb.redirectOutput(backupFile);
            pb.redirectErrorStream(false);

            Process process = pb.start();
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                ResponseUtil.error(res, 500, "Backup failed with exit code: " + exitCode);
                return;
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
}
