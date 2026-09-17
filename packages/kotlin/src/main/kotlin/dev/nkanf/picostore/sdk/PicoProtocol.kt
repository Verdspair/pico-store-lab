package dev.nkanf.picostore.sdk

import java.net.URLEncoder
import org.json.JSONObject

const val PICO_ITEM_ID: String = "7288745304105664518"
const val PICO_PACKAGE: String = "com.vrchat.android"
const val OFFICIAL_STORE_URL: String =
    "https://store-global.picoxr.com/jp/detail/1/7288745304105664518"

data class RequestSpec(val url: String, val headers: Map<String, String>, val body: String)

data class PicoAuth(
    val uid: String = "0",
    val token: String = "",
    val cookies: Map<String, String> = emptyMap(),
)

data class PublicItem(
    val itemId: String,
    val packageName: String,
    val name: String,
    val versionCode: Long,
    val price: String,
    val officialUrl: String,
)

data class DownloadInfo(
    val itemId: String,
    val packageName: String,
    val versionCode: Long,
    val version: String,
    val size: Long,
    val md5: String,
    val url: String,
)

data class MirrorPolicy(
    val enabled: Boolean = true,
    val freeOnly: Boolean = true,
    val maxBytes: Long = 512L * 1024 * 1024,
)

enum class MirrorReason { ELIGIBLE, DISABLED, NOT_FREE, OVER_SIZE_LIMIT }

object PicoProtocol {
    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun storeUrl(path: String, uid: String = "0", timestamp: Long = System.currentTimeMillis() / 1000): String {
        val query = linkedMapOf(
            "manifest_version_code" to "400900005",
            "device_name" to "A9210",
            "uid" to uid,
            "app_id" to "314431",
            "app_language" to "ja",
            "client_type" to "1",
            "zone_name" to "Asia/Shanghai",
            "timestamp" to timestamp.toString(),
        ).entries.joinToString("&") { (key, value) -> "$key=${encode(value)}" }
        return "https://appstore-us.picoxr.com$path?$query"
    }

    @JvmStatic
    fun publicItemRequest(timestamp: Long = System.currentTimeMillis() / 1000): RequestSpec = RequestSpec(
        storeUrl("/api/app/v1/item/info", timestamp = timestamp),
        mapOf("Content-Type" to "application/json", "Locale" to "ja"),
        "{\"package_name\":\"$PICO_PACKAGE\"}",
    )

    @JvmStatic
    fun parsePublicItem(text: String): PublicItem {
        val root = JSONObject(text)
        require(root.getInt("code") == 0) { "PICO item lookup failed" }
        val data = root.getJSONObject("data")
        require(data.get("item_id").toString() == PICO_ITEM_ID && data.getString("package_name") == PICO_PACKAGE) {
            "PICO returned an unexpected item or package"
        }
        val version = data.getLong("version_code")
        require(version > 0) { "PICO returned an invalid version code" }
        return PublicItem(
            PICO_ITEM_ID, PICO_PACKAGE, data.optString("name", "VRChat").ifBlank { "VRChat" },
            version, data.opt("price")?.toString() ?: "", OFFICIAL_STORE_URL,
        )
    }

    @JvmStatic
    fun encodeAccountField(value: String): String = value.toByteArray(Charsets.UTF_8).joinToString("") {
        "%02x".format((it.toInt() and 0xff) xor 5)
    }

    @JvmStatic
    fun accountRequest(kind: String, email: String, code: String? = null): RequestSpec {
        require(Regex("^\\S+@\\S+\\.\\S+$").matches(email)) { "valid email required" }
        require(kind == "send-code" || kind == "login") { "unknown account action" }
        require(kind != "login" || !code.isNullOrEmpty()) { "verification code required" }
        val path = if (kind == "send-code") "/passport/email/send_code/" else "/passport/app/email/code_login/"
        val query = linkedMapOf(
            "multi_login" to "1", "account_sdk_source" to "app", "passport-sdk-version" to "30490",
            "aid" to "308733", "device_platform" to "android",
        ).entries.joinToString("&") { (key, value) -> "$key=${encode(value)}" }
        val fields = if (kind == "send-code") linkedMapOf(
            "email" to encodeAccountField(email), "type" to encodeAccountField("13"),
            "email_logic_type" to "0", "mix_mode" to "1",
        ) else linkedMapOf(
            "email" to encodeAccountField(email), "ect_type" to "13",
            "code" to encodeAccountField(code.orEmpty()), "mix_mode" to "1", "email_logic_type" to "0",
        )
        return RequestSpec(
            "https://matrix-us.picovr.com$path?$query",
            mapOf("Content-Type" to "application/x-www-form-urlencoded"),
            fields.entries.joinToString("&") { (key, value) -> "$key=${encode(value)}" },
        )
    }

    @JvmStatic
    fun downloadInfoRequest(auth: PicoAuth): RequestSpec {
        require(auth.token.isNotEmpty() || auth.cookies.isNotEmpty()) { "authenticated PICO session required" }
        val headers = mutableMapOf("Content-Type" to "application/json", "Locale" to "ja")
        if (auth.token.isNotEmpty()) headers["X-Tt-Token"] = auth.token
        if (auth.cookies.isNotEmpty()) headers["Cookie"] = auth.cookies.entries.joinToString("; ") { (key, value) -> "$key=$value" }
        return RequestSpec(
            storeUrl("/api/app/v1/download/info", auth.uid), headers,
            "{\"item_id\":$PICO_ITEM_ID,\"package_name\":\"$PICO_PACKAGE\"}",
        )
    }

    @JvmStatic
    fun parseDownloadInfo(text: String): DownloadInfo {
        val root = JSONObject(text)
        require(root.getInt("code") == 0) { "PICO download info failed" }
        val data = root.getJSONObject("data")
        val pkg = data.getJSONObject("package")
        require(data.get("item_id").toString() == PICO_ITEM_ID && pkg.getString("package_name") == PICO_PACKAGE) {
            "PICO returned an unexpected download package"
        }
        val version = pkg.getLong("version_code")
        val size = pkg.getLong("size")
        val md5 = pkg.getString("md5")
        val url = pkg.getString("path")
        require(version > 0 && size > 0 && Regex("^[a-fA-F0-9]{32}$").matches(md5) && url.startsWith("https://")) {
            "PICO returned incomplete APK metadata"
        }
        return DownloadInfo(PICO_ITEM_ID, PICO_PACKAGE, version, pkg.optString("version"), size, md5.lowercase(), url)
    }

    @JvmStatic
    fun mirrorDecision(price: String, size: Long, policy: MirrorPolicy = MirrorPolicy()): MirrorReason {
        require(size > 0 && policy.maxBytes >= 0) { "invalid APK size or mirror policy" }
        if (!policy.enabled) return MirrorReason.DISABLED
        if (policy.freeOnly && !Regex("^0(?:\\.0+)?$").matches(price)) return MirrorReason.NOT_FREE
        if (size > policy.maxBytes) return MirrorReason.OVER_SIZE_LIMIT
        return MirrorReason.ELIGIBLE
    }
}
