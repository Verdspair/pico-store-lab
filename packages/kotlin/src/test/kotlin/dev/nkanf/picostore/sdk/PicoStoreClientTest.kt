package dev.nkanf.picostore.sdk

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
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
}
