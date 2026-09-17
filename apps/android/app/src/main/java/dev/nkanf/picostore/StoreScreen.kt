package dev.nkanf.picostore

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items as rowItems
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.nkanf.picostore.sdk.PublicItem
import dev.nkanf.picostore.sdk.StoreTarget
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL

private val ink = Color(0xFF10191C)
private val panel = Color(0xFF19282C)
private val accent = Color(0xFFD8FF57)
private val pale = Color(0xFFEAF0EA)

@Composable
fun StoreScreen(
    entries: List<StoreEntry>, selected: PublicItem?, busy: Boolean, message: String,
    email: String, signedIn: Boolean, favorites: Set<String>,
    onSearch: (String) -> Unit, onSelect: (StoreTarget) -> Unit,
    onFavorite: (String) -> Unit, onSendCode: (String) -> Unit,
    onLogin: (String, String) -> Unit, onLogout: () -> Unit,
    onGet: (PublicItem) -> Unit, onBack: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var address by remember(email) { mutableStateOf(email) }
    var code by remember { mutableStateOf("") }
    var onlyFavorites by remember { mutableStateOf(false) }
    Surface(color = ink, contentColor = pale) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wide = maxWidth >= 700.dp
            Row(Modifier.fillMaxSize()) {
                if (wide) {
                    Column(Modifier.width(220.dp).fillMaxSize().background(panel).padding(22.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("PICO / STORE", fontSize = 21.sp, fontWeight = FontWeight.Black, color = accent)
                        Text(stringResource(R.string.discover), Modifier.clickable { onBack(); onlyFavorites = false })
                        Text(stringResource(R.string.favorites), Modifier.clickable { onBack(); onlyFavorites = true })
                        Spacer(Modifier.weight(1f))
                        Text(stringResource(R.string.region_hint), fontSize = 12.sp, color = pale.copy(alpha = .65f))
                    }
                }
                Column(Modifier.weight(1f).fillMaxSize().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    if (!wide) Text("PICO / STORE", fontSize = 22.sp, fontWeight = FontWeight.Black, color = accent)
                    if (selected == null) {
                        Text(stringResource(R.string.discover), fontSize = 31.sp, fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(query, { query = it }, Modifier.weight(1f),
                                label = { Text(stringResource(R.string.search_apps)) }, singleLine = true)
                            ActionButton(stringResource(R.string.search), !busy) { onSearch(query) }
                        }
                        if (!wide) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text(stringResource(R.string.all_apps), Modifier.clickable { onlyFavorites = false })
                            Text(stringResource(R.string.favorites), Modifier.clickable { onlyFavorites = true })
                        }
                        val visible = if (onlyFavorites) entries.filter { it.target.itemId in favorites } else entries
                        LazyVerticalGrid(GridCells.Adaptive(230.dp), modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(visible, key = { it.target.itemId }) { entry ->
                                AppCard(entry, entry.target.itemId in favorites,
                                    onOpen = { onSelect(entry.target) },
                                    onFavorite = { onFavorite(entry.target.itemId) })
                            }
                        }
                    } else {
                        Text("←  ${stringResource(R.string.back_to_store)}", Modifier.clickable(onClick = onBack), color = accent)
                        Box(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                            AppDetail(selected, selected.itemId in favorites,
                                onFavorite = { onFavorite(selected.itemId) }, onGet = { onGet(selected) }, busy = busy)
                        }
                    }
                    if (message.isNotBlank()) Text(message, color = accent, fontSize = 14.sp)
                    if (busy) Text(stringResource(R.string.working), fontSize = 13.sp)
                    if (signedIn) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(address, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(stringResource(R.string.sign_out), Modifier.clickable(onClick = onLogout), color = accent)
                        }
                    } else {
                        Text(stringResource(R.string.account), fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(address, { address = it }, Modifier.weight(1f),
                                label = { Text(stringResource(R.string.email)) }, singleLine = true)
                            ActionButton(stringResource(R.string.send_code), !busy && address.isNotBlank()) { onSendCode(address) }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(code, { code = it }, Modifier.weight(1f),
                                label = { Text(stringResource(R.string.verification_code)) }, singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii))
                            ActionButton(stringResource(R.string.sign_in), !busy && code.isNotBlank()) { onLogin(address, code) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AppCard(entry: StoreEntry, favorite: Boolean, onOpen: () -> Unit, onFavorite: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(panel).clickable(onClick = onOpen).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        StoreImage(entry.info?.coverUrl, Modifier.fillMaxWidth().height(120.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(entry.info?.name ?: entry.target.name, Modifier.weight(1f),
                fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(if (favorite) "★" else "☆", Modifier.clickable(onClick = onFavorite), fontSize = 24.sp, color = accent)
        }
        Text(entry.info?.summary.orEmpty(), maxLines = 2, overflow = TextOverflow.Ellipsis,
            fontSize = 13.sp, color = pale.copy(alpha = .7f))
        Text(entry.info?.price?.let { if (it.toDoubleOrNull() == 0.0) stringResource(R.string.free)
            else "$it ${entry.info.currency}" } ?: "—", color = accent, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun AppDetail(item: PublicItem, favorite: Boolean, onFavorite: () -> Unit,
    onGet: () -> Unit, busy: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        StoreImage(item.coverUrl, Modifier.fillMaxWidth().height(160.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            StoreImage(item.iconUrl, Modifier.size(64.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.name, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text(item.publisher, color = pale.copy(alpha = .7f), fontSize = 13.sp)
            }
            Text(if (favorite) "★" else "☆", Modifier.clickable(onClick = onFavorite),
                fontSize = 28.sp, color = accent)
        }
        Text(item.summary, fontSize = 16.sp)
        Text(item.description, maxLines = 5, overflow = TextOverflow.Ellipsis,
            color = pale.copy(alpha = .8f), fontSize = 14.sp)
        if (item.screenshots.isNotEmpty()) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            rowItems(item.screenshots.take(8)) { screenshot ->
                StoreImage(screenshot, Modifier.width(180.dp).height(120.dp))
            }
        }
        Text(listOf(item.appVersion, item.genres, item.ageRating).filter { it.isNotBlank() }.joinToString("   ·   "),
            color = pale.copy(alpha = .65f), fontSize = 12.sp)
        val label = when {
            item.entitlementStatus == 1 -> stringResource(R.string.download)
            item.price.toDoubleOrNull() == 0.0 -> stringResource(R.string.get_free)
            else -> stringResource(R.string.view_official_offer)
        }
        ActionButton(label, !busy, onGet)
        Text(stringResource(R.string.region_hint), fontSize = 12.sp, color = pale.copy(alpha = .65f))
    }
}

@Composable
private fun ActionButton(text: String, enabled: Boolean, action: () -> Unit) {
    Button(onClick = action, enabled = enabled,
        colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = ink)) { Text(text) }
}

@Composable
private fun StoreImage(url: String?, modifier: Modifier) {
    val bitmap by produceState<android.graphics.Bitmap?>(null, url) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val uri = android.net.Uri.parse(url ?: return@runCatching null)
                val host = uri.host.orEmpty()
                if (uri.scheme != "https" || !(host == "picovr.com" || host.endsWith(".picovr.com") ||
                    host == "picoxr.com" || host.endsWith(".picoxr.com"))) return@runCatching null
                val connection = URL(url).openConnection()
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                connection.getInputStream().use { BitmapFactory.decodeStream(it, null,
                    BitmapFactory.Options().apply { inSampleSize = 4 }) }
            }.getOrNull()
        }
    }
    Box(modifier.background(Color(0xFF24383D)), contentAlignment = Alignment.Center) {
        if (bitmap != null) Image(bitmap!!.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Text("PICO", color = pale.copy(alpha = .4f), fontWeight = FontWeight.Black)
    }
}
