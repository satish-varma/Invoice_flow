package com.hungerbox.invoiceflow;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register official Capacitor plugin BEFORE super.onCreate
        registerPlugin(AndroidPdfPlugin.class);
        super.onCreate(savedInstanceState);

        // Also register direct WebView JavascriptInterface for hybrid web compatibility
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidPdfBridge(), "AndroidBridge");
            }
        } catch (Exception ignored) {}
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helper Methods for Native In-App PDF Operations
    // ─────────────────────────────────────────────────────────────────────────────

    private boolean doSavePdf(String base64Data, String fileName) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return false;

            String cleanBase64 = base64Data.contains(",")
                    ? base64Data.substring(base64Data.indexOf(",") + 1)
                    : base64Data;
            byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            String safeName = fileName != null && !fileName.isEmpty() ? fileName : "delivery_challan.pdf";
            if (!safeName.toLowerCase().endsWith(".pdf")) {
                safeName += ".pdf";
            }

            Uri savedUri = null;
            String savedFilePath = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+) MediaStore.Downloads
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                // Note: RELATIVE_PATH must end with a forward slash
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                ContentResolver resolver = getContentResolver();
                Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                savedUri = resolver.insert(collection, values);

                if (savedUri != null) {
                    try (OutputStream os = resolver.openOutputStream(savedUri)) {
                        if (os != null) {
                            os.write(pdfBytes);
                            os.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    resolver.update(savedUri, values, null, null);
                }
            }

            // Fallback for Android < 10 or if MediaStore insert failed
            if (savedUri == null) {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) downloadsDir.mkdirs();
                File targetFile = new File(downloadsDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
                savedFilePath = targetFile.getAbsolutePath();
                savedUri = Uri.fromFile(targetFile);
                MediaScannerConnection.scanFile(
                    this,
                    new String[]{targetFile.getAbsolutePath()},
                    new String[]{"application/pdf"},
                    null
                );
            }

            final Uri finalUri = savedUri;
            final String finalFileName = safeName;

            runOnUiThread(() -> {
                Toast.makeText(
                    MainActivity.this,
                    "Saved to Downloads: " + finalFileName,
                    Toast.LENGTH_LONG
                ).show();
            });

            if (finalUri != null) {
                showDownloadNotification(finalUri, finalFileName);
            }

            // Immediately launch PDF viewer so the user sees the file directly
            doOpenPdf(base64Data, finalFileName);

            return true;
        } catch (Exception e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Save error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            });
            return false;
        }
    }

    private boolean doOpenPdf(String base64Data, String fileName) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return false;
            String cleanBase64 = base64Data.contains(",")
                    ? base64Data.substring(base64Data.indexOf(",") + 1)
                    : base64Data;
            byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            File cacheDir = new File(getCacheDir(), "challans");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            String safeName = fileName != null && !fileName.isEmpty() ? fileName : "challan.pdf";
            File file = new File(cacheDir, safeName);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(pdfBytes);
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    file
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            startActivity(intent);
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private boolean doSharePdf(String base64Data, String fileName) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return false;
            String cleanBase64 = base64Data.contains(",")
                    ? base64Data.substring(base64Data.indexOf(",") + 1)
                    : base64Data;
            byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            File cacheDir = new File(getCacheDir(), "challans");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            String safeName = fileName != null && !fileName.isEmpty() ? fileName : "challan.pdf";
            File file = new File(cacheDir, safeName);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(pdfBytes);
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.putExtra(Intent.EXTRA_SUBJECT, safeName);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, "Share Delivery Challan");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(chooser);
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private void showDownloadNotification(Uri fileUri, String fileName) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String channelId = "downloads_channel";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Delivery Challan Downloads",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifications for downloaded delivery challans");
                nm.createNotificationChannel(channel);
            }

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(fileUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), viewIntent, flags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Delivery Challan Downloaded")
                    .setContentText(fileName)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setPriority(NotificationCompat.PRIORITY_HIGH);

            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (Exception ignored) {}
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Official Capacitor Plugin Interface
    // ─────────────────────────────────────────────────────────────────────────────
    @CapacitorPlugin(name = "AndroidPdf")
    public static class AndroidPdfPlugin extends Plugin {

        @PluginMethod
        public void savePdf(PluginCall call) {
            String base64 = call.getString("base64");
            String fileName = call.getString("fileName", "delivery_challan.pdf");
            MainActivity activity = (MainActivity) getActivity();
            boolean ok = activity != null && activity.doSavePdf(base64, fileName);
            JSObject ret = new JSObject();
            ret.put("success", ok);
            call.resolve(ret);
        }

        @PluginMethod
        public void openPdf(PluginCall call) {
            String base64 = call.getString("base64");
            String fileName = call.getString("fileName", "delivery_challan.pdf");
            MainActivity activity = (MainActivity) getActivity();
            boolean ok = activity != null && activity.doOpenPdf(base64, fileName);
            JSObject ret = new JSObject();
            ret.put("success", ok);
            call.resolve(ret);
        }

        @PluginMethod
        public void sharePdf(PluginCall call) {
            String base64 = call.getString("base64");
            String fileName = call.getString("fileName", "delivery_challan.pdf");
            MainActivity activity = (MainActivity) getActivity();
            boolean ok = activity != null && activity.doSharePdf(base64, fileName);
            JSObject ret = new JSObject();
            ret.put("success", ok);
            call.resolve(ret);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Direct JavaScriptInterface for WebView
    // ─────────────────────────────────────────────────────────────────────────────
    public class AndroidPdfBridge {

        @JavascriptInterface
        public boolean isNativeBridgeAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean savePdfToDownloads(String base64Data, String fileName, String title) {
            return doSavePdf(base64Data, fileName);
        }

        @JavascriptInterface
        public boolean openPdf(String base64Data, String fileName) {
            return doOpenPdf(base64Data, fileName);
        }

        @JavascriptInterface
        public boolean sharePdf(String base64Data, String fileName) {
            return doSharePdf(base64Data, fileName);
        }
    }
}
