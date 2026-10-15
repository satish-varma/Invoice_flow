package com.hungerbox.invoiceflow;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        try {
                            String effectiveMimeType = mimetype != null && !mimetype.isEmpty() ? mimetype : "application/pdf";
                            String fileName = URLUtil.guessFileName(url, contentDisposition, effectiveMimeType);
                            if (fileName == null || !fileName.toLowerCase().endsWith(".pdf")) {
                                fileName = "delivery_challan.pdf";
                            }

                            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                            request.setMimeType(effectiveMimeType);
                            try {
                                String cookies = CookieManager.getInstance().getCookie(url);
                                if (cookies != null) {
                                    request.addRequestHeader("cookie", cookies);
                                }
                            } catch (Exception ignored) {}
                            if (userAgent != null) {
                                request.addRequestHeader("User-Agent", userAgent);
                            }
                            request.setDescription("Downloading Delivery Challan...");
                            request.setTitle(fileName);
                            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                            if (dm != null) {
                                dm.enqueue(request);
                                Toast.makeText(MainActivity.this, "Downloading " + fileName + " to Downloads...", Toast.LENGTH_SHORT).show();
                                return;
                            }
                        } catch (Exception e) {
                            // Fallback to opening PDF with external viewer/browser
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW);
                                intent.setDataAndType(Uri.parse(url), mimetype != null && !mimetype.isEmpty() ? mimetype : "application/pdf");
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Exception fallbackErr) {
                                try {
                                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(browserIntent);
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
