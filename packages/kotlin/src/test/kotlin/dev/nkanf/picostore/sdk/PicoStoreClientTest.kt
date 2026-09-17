package dev.nkanf.picostore.sdk

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PicoStoreClientTest {
    private val fixture = JSONObject(File("../../contracts/v1/fixtures.json").readText())

    @Test fun fullFlowUsesInjectedTransport() {
        val client = PicoStoreClient(StoreTransport { request, retries ->
            require(retries > 0)
            when {
                request.url.contains("search/aggregation") -> StoreResponse(
                    """{"code":0,"data":{"search_list":[{"items":[{"item_id":7288745304105664518,"package_name":"com.vrchat.android"}]}]}}""",
                )
                request.url.contains("item/info") -> StoreResponse(fixture.getString("publicResponse"))
                request.url.contains("send_code") -> StoreResponse("""{"message":"success"}""")
                request.url.contains("code_login") -> StoreResponse(
                    """{"message":"success","data":{"user_id_str":"123"}}""",
                    mapOf("Set-Cookie" to listOf("sessionid=abc; Path=/"), "x-tt-token" to listOf("token")),
                )
                else -> StoreResponse(fixture.getString("downloadResponse"))
            }
        })
        val found = client.search("sample").first()
        val target = StoreTarget(found.itemId, found.packageName)
        assertEquals(972240L, client.item(target).versionCode)
        client.sendCode("test@example.com")
        val auth = client.login("test@example.com", "123456")
        assertEquals("abc", auth.cookies["sessionid"])
        assertEquals(333887069L, client.downloadInfo(target, auth).size)
    }

    @Test fun freeAppIsAcquiredBeforeDownloadInfo() {
        val calls = mutableListOf<String>()
        var owned = false
        val client = PicoStoreClient(StoreTransport { request, _ ->
            val path = java.net.URI(request.url).path
            calls += path
            when (path) {
                "/api/app/v1/item/info" -> StoreResponse(itemResponse(if (owned) 1 else 2))
                "/api/app/v1/item/price" -> {
                    val body = JSONObject(request.body)
                    assertEquals(true, body.getBoolean("is_free_entitlment"))
                    assertEquals("JPY", body.getString("currency"))
                    owned = true
                    StoreResponse("""{"code":0,"data":{"free":true,"order_id":42}}""")
                }
                "/api/app/v1/download/info" -> StoreResponse(fixture.getString("downloadResponse"))
                else -> error("unexpected $path")
            }
        })
        val info = client.entitledDownloadInfo(DEFAULT_TARGET, PicoAuth(cookies = mapOf("sessionid" to "test")))
        assertEquals(972240L, info.versionCode)
        assertEquals(listOf("/api/app/v1/item/info", "/api/app/v1/item/price",
            "/api/app/v1/item/info", "/api/app/v1/download/info"), calls)
    }

    @Test fun missingOrderIdStillChecksCommittedEntitlement() {
        var owned = false
        val client = PicoStoreClient(StoreTransport { request, _ ->
            when (java.net.URI(request.url).path) {
                "/api/app/v1/item/info" -> StoreResponse(itemResponse(if (owned) 1 else 2))
                "/api/app/v1/item/price" -> {
                    owned = true
                    StoreResponse("""{"code":0,"data":{"free":true}}""")
                }
                "/api/app/v1/download/info" -> StoreResponse(fixture.getString("downloadResponse"))
                else -> error("unexpected request")
            }
        })
        assertEquals(972240L, client.entitledDownloadInfo(DEFAULT_TARGET,
            PicoAuth(cookies = mapOf("sessionid" to "test"))).versionCode)
    }

    @Test fun noOfferOrFailedClaimNeverRequestsDownloadInfo() {
        for (offer in listOf(false, true)) {
            val calls = mutableListOf<String>()
            val client = PicoStoreClient(StoreTransport { request, _ ->
                val path = java.net.URI(request.url).path
                calls += path
                when (path) {
                    "/api/app/v1/item/info" -> StoreResponse(itemResponse(2, offer))
                    "/api/app/v1/item/price" -> StoreResponse("""{"code":110004,"msg":"no offer in this region"}""")
                    else -> error("download must not start")
                }
            })
            assertThrows(IllegalStateException::class.java) {
                client.entitledDownloadInfo(DEFAULT_TARGET, PicoAuth(cookies = mapOf("sessionid" to "test")))
            }
            assertEquals(false, calls.contains("/api/app/v1/download/info"))
        }
    }

    @Test fun customStoreIdentityIsUsedByAccountAndDownloadRequests() {
        val config = PicoStoreConfig(deviceName = "CustomDevice", language = "en",
            zone = "UTC", webRegion = "us")
        val auth = PicoAuth(uid = "123", token = "token")
        val request = PicoProtocol.accountItemRequest(auth, DEFAULT_TARGET, config)
        assertEquals(true, request.url.contains("device_name=CustomDevice"))
        assertEquals(true, request.url.contains("app_language=en"))
        assertEquals("en", request.headers["Locale"])
        assertEquals(true, PicoProtocol.downloadInfoRequest(auth, DEFAULT_TARGET, config).url.contains("zone_name=UTC"))
        assertEquals(true, PicoProtocol.parsePublicItem(itemResponse(1), DEFAULT_TARGET, config)
            .officialUrl.contains("/us/detail/"))
    }

    private fun itemResponse(status: Int, offer: Boolean = true): String = JSONObject().put("code", 0)
        .put("data", JSONObject().put("item_id", PICO_ITEM_ID).put("package_name", PICO_PACKAGE)
            .put("name", "VRChat").put("version_code", 972240).put("price", "0")
            .put("currency", "JPY").put("entitlement_status", status).put("is_offer_exist", offer))
        .toString()
}
