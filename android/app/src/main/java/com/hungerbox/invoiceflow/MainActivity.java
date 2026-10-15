package com.hungerbox.invoiceflow;

import android.app.DownloadManager;
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
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
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

    private static final String TAG = "InvoiceFlow";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register official Capacitor plugin BEFORE super.onCreate
        registerPlugin(AndroidPdfPlugin.class);
        super.onCreate(savedInstanceState);

        // Configure WebView for reliable in-app downloads without opening external browsers
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // 1. Register direct JavaScriptInterface bridge
                webView.addJavascriptInterface(new AndroidPdfBridge(), "AndroidBridge");

                // 2. Set DownloadListener to intercept ALL downloads (blob:, data:, https:) in-app
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                        handleInAppDownload(webView, url, userAgent, contentDisposition, mimeType);
                    }
                });
                Log.d(TAG, "AndroidBridge and DownloadListener registered successfully on WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring WebView downloads", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Intercept and Handle Downloads In-App (No Chrome, No External Browser)
    // ─────────────────────────────────────────────────────────────────────────────

    private void handleInAppDownload(WebView webView, String url, String userAgent, String contentDisposition, String mimeType) {
        if (url == null || url.isEmpty()) return;
        Log.d(TAG, "handleInAppDownload: url=" + (url.length() > 60 ? url.substring(0, 60) + "..." : url) + " mimeType=" + mimeType);

        String guessName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (guessName == null || guessName.isEmpty() || guessName.equals("downloadfile.bin")) {
            guessName = "Delivery_Challan.pdf";
        }
        if (!guessName.toLowerCase().endsWith(".pdf") && (mimeType != null && mimeType.contains("pdf"))) {
            guessName += ".pdf";
        }
        final String fileName = guessName;

        // Case 1: Blob URL (jsPDF, pdf.save, URL.createObjectURL)
        // Convert blob to base64 inside WebView and pass to doSavePdf
        if (url.startsWith("blob:")) {
            Log.d(TAG, "Intercepted blob download: " + fileName);
            String js = "(() => {"
                    + "  try {"
                    + "    fetch('" + url + "')"
                    + "      .then(function(r){ return r.blob(); })"
                    + "      .then(function(b){"
                    + "        var reader = new FileReader();"
                    + "        reader.onloadend = function(){"
                    + "          if (window.AndroidBridge && window.AndroidBridge.savePdfToDownloads) {"
                    + "            window.AndroidBridge.savePdfToDownloads(reader.result, '" + fileName + "', 'Delivery Challan');"
                    + "          }"
                    + "        };"
                    + "        reader.readAsDataURL(b);"
                    + "      })"
                    + "      .catch(function(err){ console.error('Blob fetch failed in native listener', err); });"
                    + "  } catch(e) { console.error('Blob error', e); }"
                    + "})();";
            runOnUiThread(() -> webView.evaluateJavascript(js, null));
            return;
        }

        // Case 2: Data URL (base64)
        if (url.startsWith("data:")) {
            Log.d(TAG, "Intercepted data URI download: " + fileName);
            doSavePdf(url, fileName);
            return;
        }

        // Case 3: HTTP/HTTPS standard URL - download via system DownloadManager
        if (url.startsWith("http://") || url.startsWith("https://")) {
            Log.d(TAG, "Intercepted HTTP download via DownloadManager: " + fileName);
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/pdf");
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }
                if (userAgent != null) {
                    request.addRequestHeader("User-Agent", userAgent);
                }
                request.setTitle(fileName);
                request.setDescription("Downloading Delivery Challan...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Downloading to Downloads: " + fileName, Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                Log.e(TAG, "DownloadManager error", e);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Native In-App PDF Save to Device Downloads (100% in-app, no browser popup)
    // ─────────────────────────────────────────────────────────────────────────────

    public boolean doSavePdf(String base64Data, String fileName) {
        try {
            if (base64Data == null || base64Data.trim().isEmpty()) {
                Log.e(TAG, "doSavePdf: base64Data is empty");
                return false;
            }

            String cleanBase64 = base64Data.contains(",")
                    ? base64Data.substring(base64Data.indexOf(",") + 1)
                    : base64Data;
            byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            if (pdfBytes == null || pdfBytes.length == 0) {
                Log.e(TAG, "doSavePdf: decoded bytes are empty");
                return false;
            }

            String safeName = fileName != null && !fileName.trim().isEmpty() ? fileName.trim() : "Delivery_Challan.pdf";
            safeName = safeName.replaceAll("[\\\\/:*?\"<>|]", "_");
            if (!safeName.toLowerCase().endsWith(".pdf")) {
                safeName += ".pdf";
            }

            Uri savedUri = null;
            String savedFilePath = null;

            // Strategy 1: Android 10+ (API 29+) MediaStore.Downloads (Universal Scoped Storage)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                    ContentResolver resolver = getContentResolver();
                    Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
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
                        Log.d(TAG, "Saved to MediaStore.Downloads: " + savedUri);
                    }
                } catch (Exception msEx) {
                    Log.w(TAG, "MediaStore save failed, falling back to direct public file", msEx);
                    savedUri = null;
                }
            }

            // Strategy 2: Direct public Download folder write (Android <10 or MediaStore fallback)
            if (savedUri == null) {
                try {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();

                    File targetFile = new File(downloadsDir, safeName);
                    int count = 1;
                    String baseName = safeName.substring(0, safeName.length() - 4);
                    while (targetFile.exists()) {
                        targetFile = new File(downloadsDir, baseName + " (" + count + ").pdf");
                        count++;
                    }

                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        fos.write(pdfBytes);
                        fos.flush();
                    }
                    savedFilePath = targetFile.getAbsolutePath();
                    savedUri = Uri.fromFile(targetFile);
                    Log.d(TAG, "Saved directly to file: " + savedFilePath);
                } catch (Exception fileEx) {
                    Log.w(TAG, "Direct public file write failed, using app external directory", fileEx);
                }
            }

            // Strategy 3: App external files directory if public directory access was blocked
            if (savedUri == null && savedFilePath == null) {
                File appDocs = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (appDocs == null) appDocs = getFilesDir();
                File targetFile = new File(appDocs, safeName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
                savedFilePath = targetFile.getAbsolutePath();
                savedUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", targetFile);
            }

            // Notify Android MediaScanner so file appears IMMEDIATELY in "Downloads" and "Recent Files"
            if (savedFilePath != null) {
                MediaScannerConnection.scanFile(
                    this,
                    new String[]{savedFilePath},
                    new String[]{"application/pdf"},
                    (path, uri) -> Log.d(TAG, "MediaScanner indexed file: " + path)
                );
            }

            final String finalFileName = safeName;
            final Uri finalUri = savedUri;

            // Show Toast inside the app (user stays on current screen!)
            runOnUiThread(() -> {
                Toast.makeText(
                    MainActivity.this,
                    "Saved to Downloads: " + finalFileName,
                    Toast.LENGTH_LONG
                ).show();
            });

            // Post system status bar notification with tap-to-view
            showDownloadNotification(finalUri, finalFileName, pdfBytes);

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Critical error in doSavePdf", e);
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Save error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            });
            return false;
        }
    }

    public boolean doOpenPdf(String base64Data, String fileName) {
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
            Log.e(TAG, "Error in doOpenPdf", e);
            return false;
        }
    }

    public boolean doSharePdf(String base64Data, String fileName) {
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
            Log.e(TAG, "Error in doSharePdf", e);
            return false;
        }
    }

    private void showDownloadNotification(Uri fileUri, String fileName, byte[] pdfBytes) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String channelId = "downloads_channel";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Delivery Challan Downloads",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Notifications for downloaded delivery challans");
                nm.createNotificationChannel(channel);
            }

            // Always create a cache file with FileProvider so tapping the notification opens the PDF
            File cacheDir = new File(getCacheDir(), "downloads");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            File cacheFile = new File(cacheDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(pdfBytes);
                fos.flush();
            }
            Uri viewUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", cacheFile);

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(viewUri, "application/pdf");
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
                    .setSubText("Saved to Downloads")
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT);

            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (Exception e) {
            Log.w(TAG, "Notification error: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Official Capacitor Plugin Interface (invocable via Capacitor.Plugins.AndroidPdf)
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
    // 2. Direct JavaScriptInterface for WebView (invocable via window.AndroidBridge)
    // ─────────────────────────────────────────────────────────────────────────────
    public class AndroidPdfBridge {

        @JavascriptInterface
        public boolean isNativeBridgeAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean savePdfToDownloads(String base64Data, String fileName, String title) {
            Log.d(TAG, "AndroidBridge.savePdfToDownloads called for: " + fileName);
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
