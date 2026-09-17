package dev.nkanf.picostore;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
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

import dev.nkanf.picostore.sdk.DownloadInfo;
import dev.nkanf.picostore.sdk.PicoAuth;
import dev.nkanf.picostore.sdk.PicoProtocol;
import dev.nkanf.picostore.sdk.PublicItem;
import dev.nkanf.picostore.sdk.RequestSpec;
import dev.nkanf.picostore.sdk.StoreTarget;
import dev.nkanf.picostore.sdk.SearchItem;

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
import java.util.HashMap;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    private static final String SESSION_PREFS = "pico_account";
    private static final String SESSION_KEY = "session";
    private static final int MAX_API_BYTES = 4 * 1024 * 1024;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private WebView webView;
    private BroadcastReceiver installReceiver;
    private PicoAuth auth;
    private String authEmail = "";

    private StoreTarget targetFor(String itemId) throws Exception {
        try (InputStream stream = getAssets().open("www/catalog.json")) {
            JSONArray items = new JSONArray(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if (item.getString("itemId").equals(itemId)) return new StoreTarget(
                        itemId, item.getString("packageName"), item.getString("name"));
            }
        }
        throw new Exception("Unknown catalog item");
    }

    private StoreTarget selectedTarget(JSONObject input) throws Exception {
        String itemId = input.getString("itemId");
        String packageName = input.optString("packageName");
        if (packageName.isEmpty()) return targetFor(itemId);
        return new StoreTarget(itemId, packageName, input.optString("name", packageName));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        auth = readSession();
        webView = new WebView(this);
        webView.setBackgroundColor(0xff171915);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setDomStorageEnabled(true);
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

    private void progress(String phase, int percent) {
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.__nativeProgress(" + JSONObject.quote(phase) + "," + percent + ")", null));
    }

    private JSONObject error(String message) {
        JSONObject json = new JSONObject();
        try { json.put("error", message); } catch (Exception ignored) { }
        return json;
    }

    private SharedPreferences sessionPrefs() {
        return getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE);
    }

    private PicoAuth readSession() {
        String value = sessionPrefs().getString(SESSION_KEY, null);
        if (value == null) return null;
        try {
            JSONObject saved = new JSONObject(value);
            JSONObject savedCookies = saved.getJSONObject("cookies");
            Map<String, String> cookies = new HashMap<>();
            Iterator<String> names = savedCookies.keys();
            while (names.hasNext()) {
                String name = names.next();
                cookies.put(name, savedCookies.getString(name));
            }
            PicoAuth restored = new PicoAuth(saved.getString("uid"), saved.getString("token"), cookies);
            authEmail = saved.optString("email", "");
            return restored.getToken().isEmpty() && restored.getCookies().isEmpty() ? null : restored;
        } catch (Exception ignored) {
            sessionPrefs().edit().remove(SESSION_KEY).apply();
            return null;
        }
    }

    private void saveSession(PicoAuth session, String email) throws Exception {
        JSONObject saved = new JSONObject().put("uid", session.getUid())
                .put("token", session.getToken())
                .put("cookies", new JSONObject(session.getCookies()))
                .put("email", email);
        if (!sessionPrefs().edit().putString(SESSION_KEY, saved.toString()).commit())
            throw new Exception("Could not save PICO session on this device");
        auth = session;
        authEmail = email;
    }

    private void clearSession() throws Exception {
        if (!sessionPrefs().edit().remove(SESSION_KEY).commit())
            throw new Exception("Could not sign out on this device");
        auth = null;
        authEmail = "";
    }

    private final class Bridge {
        @JavascriptInterface public void request(int id, String specification) {
            executor.execute(() -> {
                try { callback(id, handleRequest(new JSONObject(specification))); }
                catch (Exception failure) { callback(id, error(failure.getMessage())); }
            });
        }

        @JavascriptInterface public void install(int id, String metadata) {
            if (!installing.compareAndSet(false, true)) {
                callback(id, error("download_in_progress"));
                return;
            }
            executor.execute(() -> {
                try { downloadAndInstall(id, selectedTarget(new JSONObject(metadata))); }
                catch (Exception failure) {
                    installing.set(false);
                    callback(id, error(failure.getMessage()));
                }
            });
        }
    }

    private JSONObject handleRequest(JSONObject input) throws Exception {
        String action = input.getString("action");
        if ("session".equals(action)) return new JSONObject().put("loggedIn", auth != null)
                .put("email", authEmail);
        if ("logout".equals(action)) {
            clearSession();
            return new JSONObject().put("loggedIn", false);
        }
        RequestSpec request;
        StoreTarget selected = "public".equals(action) ? selectedTarget(input) : null;
        if ("public".equals(action)) request = PicoProtocol.publicItemRequest(System.currentTimeMillis() / 1000, selected);
        else if ("search".equals(action)) request = PicoProtocol.searchRequest(input.getString("word"));
        else if ("send-code".equals(action) || "login".equals(action)) {
            request = PicoProtocol.accountRequest(action, input.getString("email"),
                    "login".equals(action) ? input.getString("code") : null);
        } else throw new Exception("Unknown action");

        JSONObject response = performRequest(request);
        if (response.getInt("status") != 200) throw new Exception("PICO HTTP " + response.getInt("status"));
        if ("public".equals(action)) {
            PublicItem item = PicoProtocol.parsePublicItem(response.getString("body"), selected);
            return new JSONObject().put("name", item.getName())
                    .put("packageName", item.getPackageName())
                    .put("versionCode", item.getVersionCode())
                    .put("price", item.getPrice());
        }
        if ("search".equals(action)) {
            JSONArray items = new JSONArray();
            for (SearchItem item : PicoProtocol.parseSearchResults(response.getString("body"))) {
                items.put(new JSONObject().put("itemId", item.getItemId())
                        .put("packageName", item.getPackageName()).put("name", item.getName())
                        .put("versionCode", item.getVersionCode()));
            }
            return new JSONObject().put("items", items);
        }
        JSONObject account = new JSONObject(response.getString("body"));
        if (!"success".equals(account.optString("message"))) throw new Exception("PICO account request rejected");
        if ("send-code".equals(action)) return new JSONObject().put("sent", true);
        JSONObject data = account.optJSONObject("data");
        Map<String, String> cookies = new HashMap<>();
        JSONArray cookieLines = response.getJSONArray("cookies");
        for (int i = 0; i < cookieLines.length(); i++) {
            String pair = cookieLines.getString(i).split(";", 2)[0];
            int equals = pair.indexOf('=');
            if (equals > 0) cookies.put(pair.substring(0, equals), pair.substring(equals + 1));
        }
        String token = response.optString("token", "");
        if (token.isEmpty() && !cookies.containsKey("sessionid") && !cookies.containsKey("sessionid_ss"))
            throw new Exception("PICO login returned no usable session");
        String uid = data == null ? "0" : data.optString("user_id_str", data.optString("user_id", "0"));
        saveSession(new PicoAuth(uid, token, cookies), input.getString("email"));
        return new JSONObject().put("loggedIn", true);
    }

    private static boolean approvedApi(Uri uri) {
        if (!"https".equals(uri.getScheme())) return false;
        String host = uri.getHost();
        String path = uri.getPath();
        return ("appstore-us.picoxr.com".equals(host) &&
                ("/api/app/v1/item/info".equals(path) || "/api/app/v1/download/info".equals(path)
                        || "/api/app/v2/search/aggregation".equals(path))) ||
                ("matrix-us.picovr.com".equals(host) &&
                ("/passport/email/send_code/".equals(path) || "/passport/app/email/code_login/".equals(path)));
    }

    private JSONObject performRequest(RequestSpec spec) throws Exception {
        Uri uri = Uri.parse(spec.getUrl());
        if (!approvedApi(uri)) throw new Exception("unapproved_request");
        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");
        Map<String, String> headers = spec.getHeaders();
        if (headers != null) {
            for (Map.Entry<String, String> header : headers.entrySet()) {
                String name = header.getKey();
                if (!List.of("Content-Type", "Locale", "Cookie", "X-Tt-Token").contains(name))
                    throw new Exception("unapproved_request");
                connection.setRequestProperty(name, header.getValue());
            }
        }
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(spec.getBody().getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (input != null) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > MAX_API_BYTES) throw new Exception("response_too_large");
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

    private void downloadAndInstall(int id, StoreTarget target) throws Exception {
        if (auth == null) throw new Exception("PICO account login required");
        JSONObject infoResponse = performRequest(PicoProtocol.downloadInfoRequest(auth, target));
        if (infoResponse.getInt("status") != 200) throw new Exception("PICO HTTP " + infoResponse.getInt("status"));
        DownloadInfo metadata = PicoProtocol.parseDownloadInfo(infoResponse.getString("body"), target);
        Uri uri = Uri.parse(metadata.getUrl());
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null) throw new Exception("invalid_apk_url");
        long expectedSize = metadata.getSize();
        if (expectedSize <= 0 || expectedSize > 2L * 1024 * 1024 * 1024) throw new Exception("invalid_apk_size");
        String expectedMd5 = metadata.getMd5();
        if (!expectedMd5.matches("(?i)[0-9a-f]{32}")) throw new Exception("invalid_apk_digest");
        if (!getPackageManager().canRequestPackageInstalls()) {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()))));
            throw new Exception("install_permission_required");
        }

        File apk = new File(getCacheDir(), "pico-store-download.apk");
        MessageDigest md5 = MessageDigest.getInstance("MD5");
        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        try {
            if (connection.getResponseCode() != 200) throw new Exception("APK HTTP " + connection.getResponseCode());
            long total = 0;
            int nextProgress = 5;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > 2L * 1024 * 1024 * 1024) throw new Exception("invalid_apk_size");
                    md5.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                    int percent = (int) Math.min(99, total * 100 / expectedSize);
                    if (percent >= nextProgress) {
                        progress("downloading", percent);
                        nextProgress = percent + 5;
                    }
                }
            }
            progress("verifying", 100);
            StringBuilder digest = new StringBuilder();
            for (byte value : md5.digest()) digest.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            if (!digest.toString().equalsIgnoreCase(expectedMd5)) throw new Exception("apk_digest_mismatch");
            PackageInfo packageInfo = getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
            if (packageInfo == null || !target.getPackageName().equals(packageInfo.packageName) ||
                    packageInfo.getLongVersionCode() != metadata.getVersionCode())
                throw new Exception("apk_package_mismatch");
            progress("confirming", 100);
            installPackage(id, apk, target);
        } finally {
            connection.disconnect();
            if (apk.exists() && !apk.delete()) apk.deleteOnExit();
        }
    }

    private void installPackage(int id, File apk, StoreTarget target) throws Exception {
        PackageInstaller installer = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(target.getPackageName());
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
