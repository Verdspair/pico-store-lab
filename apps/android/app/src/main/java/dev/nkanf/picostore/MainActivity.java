package dev.nkanf.picostore;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    private static final String PACKAGE = "com.vrchat.android";
    private static final int MAX_API_BYTES = 4 * 1024 * 1024;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private WebView webView;
    private BroadcastReceiver installReceiver;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        webView.setBackgroundColor(0xff171915);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setDomStorageEnabled(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ASSET_ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())) return blocked();
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/www/") || path.contains("..")) return blocked();
                try {
                    String asset = path.substring("/assets/".length());
                    String type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
                    return new WebResourceResponse(type, "UTF-8", getAssets().open(asset));
                } catch (Exception error) { return blocked(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !ASSET_ORIGIN.equals(request.getUrl().getScheme() + "://" + request.getUrl().getAuthority());
            }
        });
        webView.addJavascriptInterface(new Bridge(), "PicoNative");
        setContentView(webView);
        webView.loadUrl(ASSET_ORIGIN + "/assets/www/index.html");
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Map.of(), new ByteArrayInputStream(new byte[0]));
    }

    private void callback(int id, JSONObject result) {
        runOnUiThread(() -> webView.evaluateJavascript("window.__nativeComplete(" + id + "," + result + ")", null));
    }

    private JSONObject error(String message) {
        JSONObject json = new JSONObject();
        try { json.put("error", message); } catch (Exception ignored) { }
        return json;
    }

    private final class Bridge {
        @JavascriptInterface public void request(int id, String specification) {
            executor.execute(() -> {
                try { callback(id, performRequest(new JSONObject(specification))); }
                catch (Exception failure) { callback(id, error(failure.getMessage())); }
            });
        }

        @JavascriptInterface public void install(int id, String metadata) {
            if (!installing.compareAndSet(false, true)) {
                callback(id, error("已有下载或安装任务在进行"));
                return;
            }
            executor.execute(() -> {
                try { downloadAndInstall(id, new JSONObject(metadata)); }
                catch (Exception failure) {
                    installing.set(false);
                    callback(id, error(failure.getMessage()));
                }
            });
        }
    }

    private static boolean approvedApi(Uri uri) {
        if (!"https".equals(uri.getScheme())) return false;
        String host = uri.getHost();
        String path = uri.getPath();
        return ("appstore-us.picoxr.com".equals(host) &&
                ("/api/app/v1/item/info".equals(path) || "/api/app/v1/download/info".equals(path))) ||
                ("matrix-us.picovr.com".equals(host) &&
                ("/passport/email/send_code/".equals(path) || "/passport/app/email/code_login/".equals(path)));
    }

    private JSONObject performRequest(JSONObject spec) throws Exception {
        Uri uri = Uri.parse(spec.getString("url"));
        if (!approvedApi(uri)) throw new Exception("请求地址不在 PICO 官方接口列表中");
        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");
        JSONObject headers = spec.optJSONObject("headers");
        if (headers != null) {
            JSONArray names = headers.names();
            if (names != null) for (int i = 0; i < names.length(); i++) {
                String name = names.getString(i);
                if (!List.of("Content-Type", "Locale", "Cookie", "X-Tt-Token").contains(name))
                    throw new Exception("请求包含未批准的 header");
                connection.setRequestProperty(name, headers.getString(name));
            }
        }
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(spec.getString("body").getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (input != null) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_API_BYTES) throw new Exception("接口响应过大");
                    bytes.write(buffer, 0, count);
                }
            }
            JSONObject result = new JSONObject();
            result.put("status", status);
            result.put("body", bytes.toString(StandardCharsets.UTF_8));
            result.put("token", connection.getHeaderField("x-tt-token"));
            JSONArray cookies = new JSONArray();
            for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase("set-cookie")) {
                    for (String cookie : entry.getValue()) cookies.put(cookie);
                }
            }
            result.put("cookies", cookies);
            return result;
        } finally { connection.disconnect(); }
    }

    private void downloadAndInstall(int id, JSONObject metadata) throws Exception {
        if (!PACKAGE.equals(metadata.getString("packageName"))) throw new Exception("APK 包名不符合预期");
        Uri uri = Uri.parse(metadata.getString("url"));
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null) throw new Exception("APK 下载地址必须是 HTTPS");
        long expectedSize = metadata.getLong("size");
        if (expectedSize <= 0 || expectedSize > 2L * 1024 * 1024 * 1024) throw new Exception("APK 容量不符合预期");
        String expectedMd5 = metadata.getString("md5");
        if (!expectedMd5.matches("(?i)[0-9a-f]{32}")) throw new Exception("APK MD5 无效");
        if (!getPackageManager().canRequestPackageInstalls()) {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()))));
            throw new Exception("请在系统设置允许此应用安装 APK，然后再次点击安装");
        }

        File apk = new File(getCacheDir(), "pico-store-download.apk");
        MessageDigest md5 = MessageDigest.getInstance("MD5");
        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        try {
            if (connection.getResponseCode() != 200) throw new Exception("APK 下载 HTTP " + connection.getResponseCode());
            long total = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > 2L * 1024 * 1024 * 1024) throw new Exception("APK 超出容量上限");
                    md5.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                }
            }
            StringBuilder digest = new StringBuilder();
            for (byte value : md5.digest()) digest.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            if (!digest.toString().equalsIgnoreCase(expectedMd5)) throw new Exception("APK MD5 校验失败");
            PackageInfo packageInfo = getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
            if (packageInfo == null || !PACKAGE.equals(packageInfo.packageName) ||
                    packageInfo.getLongVersionCode() != metadata.getLong("versionCode"))
                throw new Exception("APK 包名或版本与官方元数据不一致");
            installPackage(id, apk);
        } finally {
            connection.disconnect();
            if (apk.exists() && !apk.delete()) apk.deleteOnExit();
        }
    }

    private void installPackage(int id, File apk) throws Exception {
        PackageInstaller installer = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(PACKAGE);
        params.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId);
             FileInputStream input = new FileInputStream(apk);
             OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
            byte[] buffer = new byte[65536];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            session.fsync(output);
            String action = getPackageName() + ".INSTALL_RESULT." + sessionId;
            installReceiver = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                        Intent confirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                        if (confirmation != null) {
                            confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(confirmation);
                        }
                        return;
                    }
                    installing.set(false);
                    JSONObject result = new JSONObject();
                    try {
                        result.put("installed", status == PackageInstaller.STATUS_SUCCESS);
                        result.put("message", intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
                    } catch (Exception ignored) { }
                    callback(id, result);
                    unregisterReceiver(this);
                    installReceiver = null;
                }
            };
            IntentFilter filter = new IntentFilter(action);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(installReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(installReceiver, filter);
            PendingIntent pending = PendingIntent.getBroadcast(this, sessionId, new Intent(action).setPackage(getPackageName()),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            session.commit(pending.getIntentSender());
        } catch (Exception failure) {
            installer.abandonSession(sessionId);
            if (installReceiver != null) { unregisterReceiver(installReceiver); installReceiver = null; }
            throw failure;
        }
    }

    @Override protected void onDestroy() {
        if (installReceiver != null) unregisterReceiver(installReceiver);
        executor.shutdownNow();
        webView.destroy();
        super.onDestroy();
    }
}
