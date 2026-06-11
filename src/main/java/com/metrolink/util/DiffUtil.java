package com.metrolink.util;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Builds human-readable "Label: old -> new" summaries for audit log
 * "details" columns by comparing labeled fields of two value maps.
 */
public final class DiffUtil {

    private DiffUtil() {}

    /**
     * Compares the fields named in {@code labels} between {@code before} and
     * {@code after} and returns a "Label: old -> new; Label2: old2 -> new2"
     * string for the fields that changed, or {@code null} if nothing changed.
     */
    public static String diff(Map<String, Object> before, Map<String, Object> after, Map<String, String> labels) {
        if (before == null) before = Map.of();
        if (after == null) after = Map.of();
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : labels.entrySet()) {
            Object oldVal = before.get(entry.getKey());
            Object newVal = after.get(entry.getKey());
            if (valuesEqual(oldVal, newVal)) continue;
            if (sb.length() > 0) sb.append("; ");
            sb.append(entry.getValue()).append(": ")
              .append(display(oldVal)).append(" -> ").append(display(newVal));
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private static boolean valuesEqual(Object a, Object b) {
        boolean aBlank = a == null || (a instanceof String aStr && aStr.isBlank());
        boolean bBlank = b == null || (b instanceof String bStr && bStr.isBlank());
        if (aBlank && bBlank) return true;
        if (aBlank || bBlank) return false;
        if (a instanceof Number && b instanceof Number) {
            return new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString())) == 0;
        }
        return a.equals(b);
    }

    /** Formats a value for display: null/blank -> "(none)", BigDecimal -> plain string, HH:MM:SS -> HH:MM. */
    public static String display(Object v) {
        if (v == null) return "(none)";
        if (v instanceof String s) {
            if (s.isBlank()) return "(none)";
            return s.matches("\\d{2}:\\d{2}:\\d{2}") ? s.substring(0, 5) : s;
        }
        if (v instanceof BigDecimal bd) return bd.toPlainString();
        return String.valueOf(v);
    }
}
