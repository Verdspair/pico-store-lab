const pending = new Map();
const details = new Map();
let nextId = 1;
let catalog = [];
let searchItems = [];
let selected = null;
let product = null;
let loggedIn = false;
let accountEmail = '';
let locale = navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
let currentStatus = null;
let favorites;
try { favorites = JSON.parse(localStorage.getItem('pico-store-favorites') || '[]'); }
catch { favorites = []; }
if (!Array.isArray(favorites)) favorites = [];

const translations = {
  en: {
    discover: 'Discover', favorites: 'Favorites', account: 'Account', storeLabel: 'PICO APP DISCOVERY',
    storeTitle: 'Find your next experience', storeIntro: 'Explore apps, inspect official details, and install with your PICO account.',
    searchLabel: 'Search apps', searchPlaceholder: 'Search PICO apps', searchButton: 'Search',
    regionNotice: 'Apps and download rights vary by PICO account region. A listing here may not be available to your account.',
    curated: 'CURATED START', recommended: 'Recommended for you', browseHint: 'Open a card to view details',
    catalogLabel: 'OFFICIAL CATALOG', searchResults: 'Search results', searchEmpty: 'No apps found. Try another name.',
    yourList: 'YOUR LIST', favoritesEmpty: 'Save apps to find them here later.', appDetails: 'APP DETAILS',
    rating: 'Rating', version: 'Version', age: 'Age', price: 'Price', free: 'Free', getApp: 'Get app',
    signInToGet: 'Sign in to get', refresh: 'Refresh details',
    regionDetail: 'Availability is checked with your own PICO account when you get the app.',
    screenshots: 'Screenshots', aboutApp: 'About this app', moreInfo: 'More information',
    genres: 'Genres', platforms: 'Supported devices', package: 'Package',
    accountLabel: 'YOUR PICO ACCOUNT', accountTitle: 'Sign in to get apps',
    accountNote: 'Use your PICO account email. Enter the code exactly as sent, including letters.',
    signedOut: 'Sign in', signedIn: 'Signed in', email: 'Email', code: 'Email code',
    codePlaceholder: 'Letters and numbers', sendCode: 'Send code', signIn: 'Sign in', switchAccount: 'Switch account',
    footerOne: 'Independent PICO app discovery', footerTwo: 'App rights belong to their respective owners.',
    language: '中文', languageLabel: 'Switch to Chinese', favoriteAdd: 'Add to favorites', favoriteRemove: 'Remove from favorites',
    searching: 'Searching PICO Store…', checking: 'Loading official app details…',
    loaded: 'Official app details loaded', codeSent: 'Verification email sent', loginOk: 'Signed in to PICO',
    logoutOk: 'Signed out', needLogin: 'Sign in with your PICO account to get this app.',
    installing: 'Requesting the official download…', downloadProgress: 'Downloading: ',
    verifying: 'Verifying the APK…', confirming: 'Confirm installation in the Android system prompt.',
    installOk: 'App installed', installPermission: 'Allow this app to install packages in Android settings, then try again.',
    listingError: 'Could not load this app. It may not be available in this catalog region.',
    searchError: 'Search failed. Check your connection and try again.',
    operationError: 'Operation failed: ', installError: 'Installation incomplete: ',
    download_in_progress: 'A download or install is already in progress',
    unapproved_request: 'Request is not supported', response_too_large: 'Store response is too large',
    invalid_apk_url: 'Invalid APK download URL', invalid_apk_size: 'Invalid APK size',
    invalid_apk_digest: 'Invalid APK checksum', apk_digest_mismatch: 'APK checksum did not match',
    apk_package_mismatch: 'APK package or version did not match',
    'PICO account request rejected': 'Check your email and code, then try again.',
    'PICO download info failed': 'This app may not be offered to your PICO account or region.',
    'PICO returned incomplete APK metadata': 'This app may not be downloadable for your PICO account or region.',
  },
  'zh-CN': {
    discover: '发现', favorites: '收藏', account: '账号', storeLabel: 'PICO 应用发现',
    storeTitle: '发现下一段体验', storeIntro: '探索应用、查看官方详情，用自己的 PICO 账号获取并安装。',
    searchLabel: '搜索应用', searchPlaceholder: '搜索 PICO 应用', searchButton: '搜索',
    regionNotice: '应用展示和下载资格因 PICO 账号区服而异。这里看得到的应用，不一定能由你的账号获取。',
    curated: '精选推荐', recommended: '为你推荐', browseHint: '打开卡片查看详情',
    catalogLabel: '官方目录', searchResults: '搜索结果', searchEmpty: '没有找到应用，试试别的名称。',
    yourList: '你的清单', favoritesEmpty: '收藏应用后，可以在这里快速找到。', appDetails: '应用详情',
    rating: '评分', version: '版本', age: '年龄', price: '价格', free: '免费', getApp: '获取应用',
    signInToGet: '登录后获取', refresh: '刷新详情',
    regionDetail: '获取应用时，会以你自己的 PICO 账号确认下载资格。',
    screenshots: '应用截图', aboutApp: '应用介绍', moreInfo: '更多信息',
    genres: '类别', platforms: '支持设备', package: '包名',
    accountLabel: '你的 PICO 账号', accountTitle: '登录后获取应用',
    accountNote: '使用 PICO 账号邮箱。验证码请按邮件原样输入，可能同时包含字母和数字。',
    signedOut: '未登录', signedIn: '已登录', email: '邮箱', code: '邮箱验证码',
    codePlaceholder: '字母和数字', sendCode: '发送验证码', signIn: '登录', switchAccount: '切换账号',
    footerOne: '独立的 PICO 应用发现工具', footerTwo: '应用权利归各自权利人所有。',
    language: 'EN', languageLabel: 'Switch to English', favoriteAdd: '加入收藏', favoriteRemove: '取消收藏',
    searching: '正在搜索 PICO 商店…', checking: '正在读取官方应用详情…',
    loaded: '已读取官方应用详情', codeSent: '验证码已发送到邮箱', loginOk: '已登录 PICO 账号',
    logoutOk: '已退出登录', needLogin: '请先登录自己的 PICO 账号，再获取这个应用。',
    installing: '正在请求官方下载…', downloadProgress: '正在下载：',
    verifying: '正在校验 APK…', confirming: '请在 Android 系统提示中确认安装。',
    installOk: '应用安装成功', installPermission: '请在 Android 设置中允许本应用安装软件包，然后重试。',
    listingError: '无法读取该应用。它可能不在当前商店区服提供。',
    searchError: '搜索失败，请检查网络后重试。',
    operationError: '操作失败：', installError: '安装未完成：',
    download_in_progress: '已有下载或安装任务在进行',
    unapproved_request: '不支持此请求', response_too_large: '商店响应过大',
    invalid_apk_url: 'APK 下载地址无效', invalid_apk_size: 'APK 容量无效',
    invalid_apk_digest: 'APK 校验值无效', apk_digest_mismatch: 'APK 校验值不匹配',
    apk_package_mismatch: 'APK 包名或版本与官方信息不一致',
    'PICO account request rejected': '请检查邮箱和验证码后重试。',
    'PICO download info failed': '该应用可能不向你的 PICO 账号或区服提供。',
    'PICO returned incomplete APK metadata': '该应用可能无法由你的 PICO 账号或区服下载。',
  },
};

const byId = id => document.getElementById(id);
const t = key => translations[locale][key] || key;
const errorText = error => t(error?.message || String(error));
const isFavorite = item => favorites.some(saved => saved.itemId === item?.itemId);

function showStatus(key, detail = '') {
  currentStatus = { key, detail };
  const element = byId('status');
  element.hidden = key === 'loaded' || key === 'ready';
  element.textContent = `${t(key)}${detail}`;
}

function artUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname.endsWith('.picovr.com') || url.hostname.endsWith('.picoxr.com'))
      ? url.href : null;
  } catch { return null; }
}

function putArt(container, url) {
  const safeUrl = artUrl(url);
  if (!safeUrl) return;
  const placeholder = container.querySelector('.art-placeholder');
  const image = document.createElement('img');
  image.alt = '';
  image.addEventListener('load', () => { if (placeholder) placeholder.hidden = true; });
  image.addEventListener('error', () => { image.remove(); if (placeholder) placeholder.hidden = false; });
  image.src = safeUrl;
  container.append(image);
}

function setExistingArt(image, placeholder, url) {
  const safeUrl = artUrl(url);
  image.hidden = true;
  image.removeAttribute('src');
  placeholder.hidden = false;
  if (!safeUrl) return;
  image.onload = () => { image.hidden = false; placeholder.hidden = true; };
  image.onerror = () => { image.hidden = true; placeholder.hidden = false; };
  image.src = safeUrl;
}

function formatPrice(item) {
  if (!item || item.price === undefined || item.price === '') return '—';
  return Number(item.price) === 0 ? t('free') : `${item.price}${item.currency ? ` ${item.currency}` : ''}`;
}

function card(item) {
  const value = details.get(item.itemId) || item;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `store-card${selected?.itemId === item.itemId ? ' is-selected' : ''}`;
  button.setAttribute('aria-label', value.name);
  const art = document.createElement('div');
  art.className = 'card-art';
  const placeholder = document.createElement('span');
  placeholder.className = 'art-placeholder';
  placeholder.textContent = 'P/';
  art.append(placeholder);
  putArt(art, value.coverUrl || value.iconUrl);
  const content = document.createElement('div');
  content.className = 'card-content';
  const name = document.createElement('p');
  name.className = 'card-name';
  name.textContent = value.name;
  const summary = document.createElement('p');
  summary.className = 'card-summary';
  summary.textContent = value.summary || value.genres || value.packageName;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const price = document.createElement('span');
  price.textContent = formatPrice(value);
  const end = document.createElement('span');
  end.textContent = value.score ? `★ ${Number(value.score).toFixed(1)}` : '↗';
  meta.append(price, end);
  content.append(name, summary, meta);
  button.append(art, content);
  button.addEventListener('click', () => selectTarget(item, true));
  return button;
}

function renderCards() {
  byId('catalog-cards').replaceChildren(...catalog.map(card));
  byId('search-results').replaceChildren(...searchItems.map(card));
  byId('favorite-items').replaceChildren(...favorites.map(card));
  byId('favorites-empty').hidden = favorites.length > 0;
}

function renderDetails() {
  const item = product || selected;
  if (!item) return;
  byId('product-name').textContent = item.name;
  byId('publisher').textContent = item.publisher || item.packageName;
  byId('summary').textContent = item.summary || '';
  byId('summary').hidden = !item.summary;
  byId('score').textContent = item.score ? Number(item.score).toFixed(1) : '—';
  byId('app-version').textContent = item.appVersion || item.versionCode || '—';
  byId('age-rating').textContent = item.ageRating || '—';
  byId('price').textContent = formatPrice(item);
  byId('package-name').textContent = item.packageName;
  byId('genres').textContent = item.genres || '';
  byId('genres-row').hidden = !item.genres;
  byId('platforms').textContent = item.supportedPlatforms || '';
  byId('platforms-row').hidden = !item.supportedPlatforms;
  byId('more-info').hidden = !product;
  byId('description').textContent = item.description || '';
  byId('description-section').hidden = !item.description;
  setExistingArt(byId('detail-cover-image'), byId('detail-cover-placeholder'), item.coverUrl);
  const icon = byId('detail-icon');
  icon.replaceChildren();
  const iconPlaceholder = document.createElement('span');
  iconPlaceholder.className = 'art-placeholder';
  iconPlaceholder.textContent = 'P/';
  icon.append(iconPlaceholder);
  putArt(icon, item.iconUrl || item.coverUrl);
  const shots = byId('screenshots');
  shots.replaceChildren();
  for (const source of item.screenshots || []) {
    const safeUrl = artUrl(source);
    if (!safeUrl) continue;
    const image = document.createElement('img');
    image.src = safeUrl;
    image.alt = `${item.name} ${t('screenshots')}`;
    image.loading = 'lazy';
    shots.append(image);
  }
  byId('screenshots-section').hidden = shots.children.length === 0;
  const favorite = byId('favorite-toggle');
  favorite.disabled = !selected;
  favorite.textContent = isFavorite(selected) ? '★' : '☆';
  favorite.classList.toggle('is-favorite', isFavorite(selected));
  favorite.setAttribute('aria-label', t(isFavorite(selected) ? 'favoriteRemove' : 'favoriteAdd'));
  updateAccountState();
}

function updateAccountState() {
  byId('sign-in-form').hidden = loggedIn;
  byId('logout').hidden = !loggedIn;
  const state = loggedIn && accountEmail ? `${t('signedIn')}: ${accountEmail}` : t('signedOut');
  byId('login-state').textContent = state;
  byId('account-indicator').textContent = state;
  byId('install').disabled = !product;
  byId('install').textContent = t(loggedIn ? 'getApp' : 'signInToGet');
}

function applyLocale() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
  byId('language').textContent = t('language');
  byId('language').setAttribute('aria-label', t('languageLabel'));
  if (currentStatus) showStatus(currentStatus.key, currentStatus.detail);
  renderCards();
  renderDetails();
  updateAccountState();
}

window.__nativeComplete = (id, result) => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  result.error ? entry.reject(new Error(result.error)) : entry.resolve(result);
};
window.__nativeProgress = (phase, percent) => {
  if (phase === 'downloading') showStatus('downloadProgress', `${percent}%`);
  else if (phase === 'verifying' || phase === 'confirming') showStatus(phase);
};
function nativeCall(method, payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    window.PicoNative[method](id, JSON.stringify(payload));
  });
}

async function refresh() {
  if (!selected) return;
  const target = selected;
  const button = byId('refresh');
  button.disabled = true;
  showStatus('checking');
  try {
    const result = await nativeCall('request', { action: 'public', ...target });
    details.set(target.itemId, result);
    if (selected?.itemId !== target.itemId) return;
    product = result;
    selected = { ...target, ...result };
    renderDetails();
    renderCards();
    showStatus('loaded');
  } catch (error) {
    if (selected?.itemId === target.itemId) showStatus('listingError', ` ${errorText(error)}`);
  } finally { button.disabled = false; }
}

function selectTarget(item, scroll = false) {
  selected = { ...item, ...(details.get(item.itemId) || {}) };
  product = details.get(item.itemId) || null;
  renderDetails();
  renderCards();
  if (!product) refresh();
  if (scroll) byId('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadCatalog() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
    catalog = await response.json();
    if (!Array.isArray(catalog)) catalog = [];
    renderCards();
    if (catalog.length) selectTarget(catalog[0]);
    for (const item of catalog.slice(1)) {
      nativeCall('request', { action: 'public', ...item }).then(result => {
        details.set(item.itemId, result);
        renderCards();
      }).catch(() => {});
    }
  } catch (error) { showStatus('listingError', ` ${errorText(error)}`); }
}

async function search() {
  const word = byId('search-word').value.trim();
  if (!word) return;
  showStatus('searching');
  byId('search-section').hidden = false;
  try {
    const result = await nativeCall('request', { action: 'search', word });
    searchItems = result.items || [];
    byId('search-empty').hidden = searchItems.length > 0;
    byId('search-count').textContent = String(searchItems.length);
    renderCards();
    showStatus('ready');
    byId('search-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { showStatus('searchError', ` ${errorText(error)}`); }
}

async function sendCode() {
  const button = byId('send-code');
  button.disabled = true;
  try {
    await nativeCall('request', { action: 'send-code', email: byId('email').value.trim() });
    showStatus('codeSent');
    byId('code').focus();
  } catch (error) { showStatus('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function login() {
  const button = byId('login');
  button.disabled = true;
  try {
    const email = byId('email').value.trim();
    await nativeCall('request', { action: 'login', email, code: byId('code').value.trim() });
    loggedIn = true;
    accountEmail = email;
    byId('code').value = '';
    updateAccountState();
    showStatus('loginOk');
  } catch (error) { showStatus('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function restoreSession() {
  try {
    const session = await nativeCall('request', { action: 'session' });
    loggedIn = Boolean(session.loggedIn);
    accountEmail = session.email || '';
    updateAccountState();
  } catch (error) { showStatus('operationError', errorText(error)); }
}

async function logout() {
  const button = byId('logout');
  button.disabled = true;
  try {
    await nativeCall('request', { action: 'logout' });
    loggedIn = false;
    accountEmail = '';
    updateAccountState();
    showStatus('logoutOk');
  } catch (error) { showStatus('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function install() {
  if (!loggedIn) {
    showStatus('needLogin');
    byId('account').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (!product || !selected) return;
  const button = byId('install');
  button.disabled = true;
  byId('logout').disabled = true;
  try {
    showStatus('installing');
    const result = await nativeCall('install', selected);
    if (!result.installed) throw new Error(result.message || t('installError'));
    showStatus('installOk');
  } catch (error) {
    if (error.message === 'install_permission_required') showStatus('installPermission');
    else showStatus('installError', errorText(error));
  } finally {
    button.disabled = false;
    byId('logout').disabled = false;
  }
}

byId('search-form').addEventListener('submit', event => { event.preventDefault(); search(); });
byId('refresh').addEventListener('click', refresh);
byId('favorite-toggle').addEventListener('click', () => {
  if (!selected) return;
  favorites = isFavorite(selected) ? favorites.filter(item => item.itemId !== selected.itemId) : [...favorites, selected];
  localStorage.setItem('pico-store-favorites', JSON.stringify(favorites));
  renderCards();
  renderDetails();
});
byId('send-code').addEventListener('click', sendCode);
byId('login').addEventListener('click', login);
byId('logout').addEventListener('click', logout);
byId('install').addEventListener('click', install);
byId('language').addEventListener('click', () => { locale = locale === 'en' ? 'zh-CN' : 'en'; applyLocale(); });
applyLocale();
restoreSession();
loadCatalog();
