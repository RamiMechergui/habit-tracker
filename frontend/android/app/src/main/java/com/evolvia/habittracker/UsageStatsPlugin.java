package com.evolvio.habittracker;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    private static final Set<String> SOCIAL_MEDIA_PACKAGES = new HashSet<>(Arrays.asList(
        "com.instagram.android",
        "com.zhiliaoapp.musically",
        "com.facebook.katana",
        "com.facebook.lite",
        "com.twitter.android",
        "com.snapchat.android",
        "com.reddit.frontpage",
        "com.linkedin.android",
        "com.pinterest",
        "com.tumblr",
        "com.quora.android",
        "com.discord",
        "com.google.android.youtube"
    ));

    @PluginMethod
    public void getTodayUsage(PluginCall call) {
        Context ctx = getContext();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) {
            call.reject("UsageStatsManager not available");
            return;
        }

        if (!hasUsagePermission(ctx)) {
            call.reject("Usage Access permission not granted");
            return;
        }

        long[] range = getTodayRange();
        long startTime = range[0];
        long endTime = range[1];

        List<UsageStats> statsList = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, startTime, endTime
        );

        if (statsList == null || statsList.isEmpty()) {
            call.reject("No usage data available");
            return;
        }

        long totalScreenTimeMs = 0;
        long socialMediaTimeMs = 0;

        for (UsageStats stats : statsList) {
            long usageMs = stats.getTotalTimeInForeground();
            if (usageMs <= 0) continue;

            totalScreenTimeMs += usageMs;
            String pkg = stats.getPackageName();

            if (SOCIAL_MEDIA_PACKAGES.contains(pkg)) {
                socialMediaTimeMs += usageMs;
            }
        }

        int totalMinutes = (int) TimeUnit.MILLISECONDS.toMinutes(totalScreenTimeMs);
        int socialMinutes = (int) TimeUnit.MILLISECONDS.toMinutes(socialMediaTimeMs);

        JSObject result = new JSObject();
        result.put("socialMinutes", socialMinutes);
        result.put("totalMinutes", totalMinutes);
        call.resolve(result);
    }

    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        boolean granted = hasUsagePermission(getContext());
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = null;

        // Try 1: Open Usage Access settings filtered by package (works on stock Android)
        try {
            intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
            return;
        } catch (Exception ignored) {}

        // Try 2: Open Usage Access settings without package filter (Samsung, Xiaomi, etc.)
        try {
            intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
            return;
        } catch (Exception ignored) {}

        // Try 3: Open this app's own settings page
        try {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
            return;
        } catch (Exception ignored) {}

        // Try 4: Open general settings as last resort
        try {
            intent = new Intent(Settings.ACTION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not open settings");
        }
    }

    private boolean hasUsagePermission(Context ctx) {
        try {
            AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    ctx.getPackageName()
                );
            } else {
                mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    ctx.getPackageName()
                );
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            // Fallback: try querying and checking if data is actually available
            try {
                UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
                if (usm == null) return false;
                long[] range = getTodayRange();
                List<UsageStats> stats = usm.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, range[0], range[1]
                );
                if (stats == null || stats.isEmpty()) return false;
                // Check if ANY app has non-zero usage (proves permission is granted)
                for (UsageStats s : stats) {
                    if (s.getTotalTimeInForeground() > 0) return true;
                }
                return false;
            } catch (Exception e2) {
                return false;
            }
        }
    }

    private long[] getTodayRange() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        long start = cal.getTimeInMillis();
        long end = System.currentTimeMillis();
        return new long[]{start, end};
    }
}
