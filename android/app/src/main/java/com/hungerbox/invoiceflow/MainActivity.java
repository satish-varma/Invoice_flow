package com.hungerbox.invoiceflow;

import android.Manifest;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
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
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "InvoiceFlow";
    private static final int REQUEST_NOTIFICATION_PERMISSION = 1001;

    private static final String INJECTED_DOWNLOAD_JS =
        "(function() {" +
        "  if (window.__invoice_flow_native_injected__) return;" +
        "  window.__invoice_flow_native_injected__ = true;" +
        "  console.log('[NativeBridge] Hook installed on window');" +
        "  var origClick = HTMLAnchorElement.prototype.click;" +
        "  HTMLAnchorElement.prototype.click = function() {" +
        "    var href = this.href || '';" +
        "    var download = this.download || this.getAttribute('download') || 'Delivery_Challan.pdf';" +
        "    var isPdf = download.toLowerCase().indexOf('.pdf') !== -1 || href.indexOf('blob:') === 0 || href.indexOf('data:') === 0 || href.toLowerCase().indexOf('.pdf') !== -1;" +
        "    if (isPdf && window.AndroidBridge && window.AndroidBridge.savePdfToDownloads) {" +
        "      console.log('[NativeBridge] Intercepted programmatic anchor click:', download);" +
        "      if (href.indexOf('data:') === 0) {" +
        "        window.AndroidBridge.savePdfToDownloads(href, download, 'Delivery Challan');" +
        "        return;" +
        "      }" +
        "      if (href.indexOf('blob:') === 0) {" +
        "        fetch(href)" +
        "          .then(function(r) { return r.blob(); })" +
        "          .then(function(b) {" +
        "            var reader = new FileReader();" +
        "            reader.onloadend = function() {" +
        "              window.AndroidBridge.savePdfToDownloads(reader.result, download, 'Delivery Challan');" +
        "            };" +
        "            reader.readAsDataURL(b);" +
        "          })" +
        "          .catch(function(err) { console.error('[NativeBridge] Blob fetch error:', err); });" +
        "        return;" +
        "      }" +
        "    }" +
        "    return origClick.apply(this, arguments);" +
        "  };" +
        "})();";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register official Capacitor plugin BEFORE super.onCreate
        registerPlugin(AndroidPdfPlugin.class);
        super.onCreate(savedInstanceState);

        // Prompt for notification permissions on Android 13+ (API 33+)
        requestNotificationPermissionIfNeeded();

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Clear stale cache and ServiceWorker caches so fresh web code loads
                webView.clearCache(true);

                // 1. Direct JavaScriptInterface bridge
                webView.addJavascriptInterface(new AndroidPdfBridge(), "AndroidBridge");

                // 2. DownloadListener to intercept browser-initiated downloads
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                        handleInAppDownload(webView, url, userAgent, contentDisposition, mimeType);
                    }
                });

                // 3. Inject JS anchor interception on page load
                bridge.addWebViewListener(new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView loadedWebView) {
                        injectNativeDownloadHook(loadedWebView);
                    }
                });

                Log.d(TAG, "AndroidBridge, DownloadListener, and WebViewListener successfully installed");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring WebView", e);
        }
    }

    public void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Requesting POST_NOTIFICATIONS runtime permission");
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_NOTIFICATION_PERMISSION
                );
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS runtime permission already granted");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATION_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "POST_NOTIFICATIONS runtime permission granted by user");
            } else {
                Log.w(TAG, "POST_NOTIFICATIONS runtime permission denied by user");
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                injectNativeDownloadHook(webView);
            }
        } catch (Exception ignored) {}
    }

    private void injectNativeDownloadHook(WebView webView) {
        if (webView == null) return;
        runOnUiThread(() -> {
            try {
                webView.evaluateJavascript(INJECTED_DOWNLOAD_JS, null);
                Log.d(TAG, "Evaluated native download hook JS");
            } catch (Exception e) {
                Log.w(TAG, "Failed to evaluate download hook JS", e);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Intercept and Handle Downloads In-App (No Chrome, No External Browser)
    // ─────────────────────────────────────────────────────────────────────────────

    public void handleInAppDownload(WebView webView, String url, String userAgent, String contentDisposition, String mimeType) {
        if (url == null || url.isEmpty()) return;
        Log.d(TAG, "handleInAppDownload: url=" + (url.length() > 60 ? url.substring(0, 60) + "..." : url));

        String guessName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (guessName == null || guessName.isEmpty() || guessName.equals("downloadfile.bin")) {
            guessName = "Delivery_Challan.pdf";
        }
        if (!guessName.toLowerCase().endsWith(".pdf") && (mimeType != null && mimeType.contains("pdf"))) {
            guessName += ".pdf";
        }
        final String fileName = guessName;

        // Case 1: Blob URL (jsPDF, pdf.save, URL.createObjectURL)
        if (url.startsWith("blob:")) {
            Log.d(TAG, "Intercepted blob URL: " + fileName);
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
                    + "      .catch(function(err){ console.error('Blob fetch failed:', err); });"
                    + "  } catch(e) { console.error('Blob error:', e); }"
                    + "})();";
            runOnUiThread(() -> webView.evaluateJavascript(js, null));
            return;
        }

        // Case 2: Data URL (base64)
        if (url.startsWith("data:")) {
            Log.d(TAG, "Intercepted data URI: " + fileName);
            doSavePdf(url, fileName);
            return;
        }

        // Case 3: HTTP/HTTPS standard URL via DownloadManager
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
    // Native In-App PDF Save to Device Downloads (100% in-app, NO BROWSER)
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

            // Strategy 1: Android 10+ (API 29+) MediaStore.Downloads
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
            final String finalBase64 = cleanBase64;

            // 1. Show interactive in-app dialog with Open, Share, and Done buttons directly over the screen
            runOnUiThread(() -> {
                showDownloadSuccessDialog(finalFileName, finalBase64);
            });

            // 2. Post system status bar notification with explicit [ OPEN ] and [ SHARE ] action buttons
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

    private void showDownloadSuccessDialog(String fileName, String base64Data) {
        try {
            if (isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed())) {
                return;
            }

            DialogInterface.OnClickListener openListener = (dialog, which) -> {
                Log.d(TAG, "User clicked Open in download dialog");
                doOpenPdf(base64Data, fileName);
            };

            DialogInterface.OnClickListener shareListener = (dialog, which) -> {
                Log.d(TAG, "User clicked Share in download dialog");
                doSharePdf(base64Data, fileName);
            };

            DialogInterface.OnClickListener doneListener = (dialog, which) -> {
                Log.d(TAG, "User clicked Done in download dialog");
                dialog.dismiss();
            };

            // Platform AlertDialog does NOT require Theme.AppCompat and works on any theme (including Theme.SplashScreen)
            AlertDialog.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                builder = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert);
            } else {
                builder = new AlertDialog.Builder(this);
            }

            builder.setTitle("Delivery Challan Downloaded")
                   .setMessage("Saved to Downloads folder:\n\n" + fileName + "\n\nWould you like to open or share it now?")
                   .setIcon(android.R.drawable.stat_sys_download_done)
                   .setPositiveButton("Open", openListener)
                   .setNeutralButton("Share", shareListener)
                   .setNegativeButton("Done", doneListener)
                   .setCancelable(true);

            AlertDialog dialog = builder.create();
            dialog.setCanceledOnTouchOutside(true);
            dialog.show();
            Log.d(TAG, "Download success dialog displayed successfully for: " + fileName);
        } catch (Throwable t) {
            Log.w(TAG, "Error displaying dialog with platform AlertDialog, trying themed fallback", t);
            try {
                androidx.appcompat.view.ContextThemeWrapper themedContext =
                        new androidx.appcompat.view.ContextThemeWrapper(this, androidx.appcompat.R.style.Theme_AppCompat_Light_Dialog_Alert);
                new androidx.appcompat.app.AlertDialog.Builder(themedContext)
                        .setTitle("Delivery Challan Downloaded")
                        .setMessage("Saved to Downloads folder:\n\n" + fileName + "\n\nWould you like to open or share it now?")
                        .setIcon(android.R.drawable.stat_sys_download_done)
                        .setPositiveButton("Open", (d, w) -> doOpenPdf(base64Data, fileName))
                        .setNeutralButton("Share", (d, w) -> doSharePdf(base64Data, fileName))
                        .setNegativeButton("Done", (d, w) -> d.dismiss())
                        .setCancelable(true)
                        .show();
                Log.d(TAG, "Download success dialog displayed via themed fallback");
            } catch (Throwable t2) {
                Log.e(TAG, "Fatal dialog error", t2);
                Toast.makeText(MainActivity.this, "Saved to Downloads: " + fileName, Toast.LENGTH_LONG).show();
            }
        }
    }

    public boolean doOpenPdf(String base64Data, String fileName) {
        try {
            File fileToOpen = null;
            if (base64Data != null && !base64Data.isEmpty()) {
                String cleanBase64 = base64Data.contains(",")
                        ? base64Data.substring(base64Data.indexOf(",") + 1)
                        : base64Data;
                byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                File cacheDir = new File(getCacheDir(), "challans");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                String safeName = fileName != null && !fileName.isEmpty() ? fileName : "challan.pdf";
                fileToOpen = new File(cacheDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(fileToOpen)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
            } else if (fileName != null) {
                File cached = new File(new File(getCacheDir(), "downloads"), fileName);
                if (cached.exists()) {
                    fileToOpen = cached;
                } else {
                    File publicFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fileName);
                    if (publicFile.exists()) fileToOpen = publicFile;
                }
            }

            if (fileToOpen == null || !fileToOpen.exists()) {
                Log.e(TAG, "No file found to open for: " + fileName);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Cannot locate PDF file to open", Toast.LENGTH_SHORT).show());
                return false;
            }

            Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    fileToOpen
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setClipData(ClipData.newRawUri("", contentUri));

            Intent chooser = Intent.createChooser(intent, "Open " + fileName);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(chooser);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error in doOpenPdf", e);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "No PDF viewer app found to open file", Toast.LENGTH_SHORT).show());
            return false;
        }
    }

    public boolean doSharePdf(String base64Data, String fileName) {
        try {
            File fileToShare = null;
            if (base64Data != null && !base64Data.isEmpty()) {
                String cleanBase64 = base64Data.contains(",")
                        ? base64Data.substring(base64Data.indexOf(",") + 1)
                        : base64Data;
                byte[] pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                File cacheDir = new File(getCacheDir(), "challans");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                String safeName = fileName != null && !fileName.isEmpty() ? fileName : "challan.pdf";
                fileToShare = new File(cacheDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(fileToShare)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
            } else if (fileName != null) {
                File cached = new File(new File(getCacheDir(), "downloads"), fileName);
                if (cached.exists()) {
                    fileToShare = cached;
                } else {
                    File publicFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), fileName);
                    if (publicFile.exists()) fileToShare = publicFile;
                }
            }

            if (fileToShare == null || !fileToShare.exists()) {
                Log.e(TAG, "No file found to share for: " + fileName);
                return false;
            }

            Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    fileToShare
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.putExtra(Intent.EXTRA_SUBJECT, fileName);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("", contentUri));

            Intent chooser = Intent.createChooser(intent, "Share Delivery Challan");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
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

            // Prompt permission if not yet granted on Android 13+ (API 33+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "POST_NOTIFICATIONS permission not granted. Requesting...");
                    runOnUiThread(this::requestNotificationPermissionIfNeeded);
                    return;
                }
            }

            String channelId = "downloads_channel_v2";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId,
                        "Delivery Challan Downloads",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifications for downloaded delivery challans");
                channel.enableLights(true);
                channel.enableVibration(true);
                channel.setShowBadge(true);
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

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            // Open Intent with Chooser
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(viewUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            viewIntent.setClipData(ClipData.newRawUri("", viewUri));
            Intent openChooser = Intent.createChooser(viewIntent, "Open " + fileName);
            openChooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            PendingIntent openPendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), openChooser, flags);

            // Share Intent with Chooser
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/pdf");
            shareIntent.putExtra(Intent.EXTRA_STREAM, viewUri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.setClipData(ClipData.newRawUri("", viewUri));
            Intent shareChooser = Intent.createChooser(shareIntent, "Share Delivery Challan");
            shareChooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            PendingIntent sharePendingIntent = PendingIntent.getActivity(this, (int) (System.currentTimeMillis() + 1), shareChooser, flags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Delivery Challan Downloaded")
                    .setContentText(fileName)
                    .setSubText("Saved to Downloads")
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(openPendingIntent)
                    .addAction(android.R.drawable.ic_menu_view, "OPEN", openPendingIntent)
                    .addAction(android.R.drawable.ic_menu_share, "SHARE", sharePendingIntent);

            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
            Log.d(TAG, "Download notification posted successfully for: " + fileName);
        } catch (Exception e) {
            Log.w(TAG, "Notification error: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Official Capacitor Plugin Interface (invocable via Capacitor.Plugins.AndroidPdf)
    // ─────────────────────────────────────────────────────────────────────────────
    @CapacitorPlugin(name = "AndroidPdf")
    public static class AndroidPdfPlugin extends Plugin {

        @Override
        public Boolean shouldOverrideLoad(Uri url) {
            String urlStr = url != null ? url.toString() : "";
            // Intercept any download or PDF link so Capacitor NEVER hands it to an external browser!
            if (urlStr.endsWith(".pdf") || urlStr.contains("download") || urlStr.contains(".pdf?") || urlStr.startsWith("blob:") || urlStr.startsWith("data:")) {
                Log.d(TAG, "shouldOverrideLoad BLOCKED external browser for: " + urlStr);
                MainActivity activity = (MainActivity) getActivity();
                if (activity != null) {
                    activity.handleInAppDownload(getBridge().getWebView(), urlStr, null, null, "application/pdf");
                }
                return true; // TRUE = handled completely inside the app!
            }
            return null; // Let default handling proceed
        }

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
            Log.d(TAG, "AndroidBridge.savePdfToDownloads called directly for: " + fileName);
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
