package dev.nkanf.picostore.sdk

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PicoProtocolTest {
    private val fixture = JSONObject(File("../../contracts/v1/fixtures.json").readText())

    @Test fun exactItemAndRequest() {
        val request = PicoProtocol.publicItemRequest(1)
        val item = PicoProtocol.parsePublicItem(fixture.getString("publicResponse"))
        assertEquals(fixture.getString("packageName"), JSONObject(request.body).getString("package_name"))
        assertEquals(fixture.getString("itemId"), item.itemId)
        assertEquals(fixture.getLong("versionCode"), item.versionCode)
        assertEquals("eligible", PicoProtocol.mirrorDecision(item.price, 1).name.lowercase())
    }

    @Test fun validatedDownloadAndRejection() {
        val info = PicoProtocol.parseDownloadInfo(fixture.getString("downloadResponse"))
        assertEquals(fixture.getLong("apkSize"), info.size)
        assertEquals(fixture.getString("md5"), info.md5)
        val wrong = JSONObject(fixture.getString("publicResponse"))
        wrong.getJSONObject("data").put("package_name", "com.example.wrong")
        assertThrows(IllegalArgumentException::class.java) { PicoProtocol.parsePublicItem(wrong.toString()) }
    }
}
