package com.metrolink.dao;

import com.metrolink.config.DatabaseConfig;

import java.sql.*;

public class ChangelogDAO {

    /** Log a change to a trip (stores before/after as JSON strings) */
    public void log(int tripId, int changedBy, String changeType,
                    String oldValueJson, String newValueJson) throws SQLException {
        String sql = "INSERT INTO trip_changelogs (trip_id, changed_by, change_type, old_value, new_value) " +
                     "VALUES (?, ?, ?, ?, ?)";
        try (Connection c = DatabaseConfig.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, tripId);
            ps.setInt(2, changedBy);
            ps.setString(3, changeType);
            ps.setString(4, oldValueJson);
            ps.setString(5, newValueJson);
            ps.executeUpdate();
        }
    }
}
