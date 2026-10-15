package com.hungerbox.invoiceflow;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.DownloadListener;
import android.webkit.WebView;
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
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setDataAndType(Uri.parse(url), mimetype != null && !mimetype.isEmpty() ? mimetype : "application/pdf");
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            try {
                                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(fallback);
                            } catch (Exception ignored) {}
                        }
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
