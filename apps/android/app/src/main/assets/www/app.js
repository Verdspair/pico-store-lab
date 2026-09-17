const pending = new Map();
let nextId = 1;
let product = null;
let selected = null;
let catalog = [];
let searchItems = [];
let favorites = [];
try { favorites = JSON.parse(localStorage.getItem('pico-store-favorites') || '[]'); } catch { favorites = []; }
if (!Array.isArray(favorites)) favorites = [];
let loggedIn = false;
let accountEmail = '';
let locale = navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
let currentStatus = { key: 'ready', detail: '' };

const translations = {
  en: {
    edition: 'ON-DEVICE / 001', nativeEyebrow: 'PICO GLOBAL / NATIVE VR',
    currentLabel: '01 / RECOMMENDED', chooseApp: 'Choose an app', accountLabel: '02 / YOUR ACCOUNT',
    searchLabel: 'Search PICO apps', searchPlaceholder: 'App name', searchButton: 'Search', searching: 'Searching PICO Store…', searchEmpty: 'No apps found', favoritesLabel: 'FAVORITES', favoriteAdd: 'Save ☆', favoriteRemove: 'Saved ★',
    installLabel: '03 / VERIFIED INSTALL', communityLabel: 'INDEPENDENT COMMUNITY CLIENT',
    heroOne: 'Bring updates', heroTwo: 'into the headset.',
    lede: 'Check official releases, sign in, verify downloads and request installation directly on PICO.',
    checking: 'Checking official store…', refresh: 'Refresh release',
    accountTitle: 'Your PICO account',
    accountNote: 'Sign in with your PICO email to get your selected app.',
    email: 'PICO account email', sendCode: 'Send code', code: 'Code', login: 'Sign in to PICO',
    signedOut: 'Not signed in', signedIn: 'Signed in', logout: 'Switch account', logoutOk: 'Signed out',
    installTitle: 'Get the APK from the official CDN',
    installNote: 'The app checks MD5, package and version before Android asks for installation confirmation. No silent install.',
    install: 'Download and install', ready: 'Ready',
    disclaimer: 'Independent project; app rights belong to their owners',
    price: 'Official price: ', loaded: 'Official PICO release loaded',
    versionError: 'Release lookup failed: ', operationError: 'Operation failed: ', codeSent: 'Verification email sent',
    loginOk: 'Signed in to PICO',
    needLogin: 'Check the release and sign in first',
    installing: 'Requesting the official download…',
    downloadProgress: 'Downloading: ', verifying: 'Verifying the APK…',
    confirming: 'Confirm installation in the Android system prompt.',
    installPermission: 'Allow PICO Store Lab to install apps in system settings, return here, then tap Download and install again.',
    installOk: 'App installed', installError: 'Installation incomplete: ',
    download_in_progress: 'A download or install is already in progress', unapproved_request: 'Request is not supported',
    response_too_large: 'Store response is too large', invalid_apk_url: 'Invalid APK download URL',
    invalid_apk_size: 'Invalid APK size', invalid_apk_digest: 'Invalid APK checksum',
    apk_digest_mismatch: 'APK checksum did not match', apk_package_mismatch: 'APK package or version did not match',
    language: '中文', languageLabel: 'Switch to Chinese',
  },
  'zh-CN': {
    edition: '设备端 / 001', nativeEyebrow: 'PICO 国际版 / 原生 VR',
    currentLabel: '01 / 推荐应用', chooseApp: '选择应用', accountLabel: '02 / 你的账户',
    searchLabel: '搜索 PICO 应用', searchPlaceholder: '输入应用名称', searchButton: '搜索', searching: '正在搜索 PICO 商店…', searchEmpty: '没有找到应用', favoritesLabel: '收藏', favoriteAdd: '收藏 ☆', favoriteRemove: '已收藏 ★',
    installLabel: '03 / 校验安装', communityLabel: '独立社区客户端',
    heroOne: '把更新，', heroTwo: '带到头显里。',
    lede: '直接在 PICO 上查询官方版本、登录个人账户、校验下载并请求安装。',
    checking: '正在查询官方商店…', refresh: '刷新版本',
    accountTitle: '你的 PICO 账号', accountNote: '用你的 PICO 邮箱登录，获取所选应用。',
    email: 'PICO 账户邮箱', sendCode: '发送验证码', code: '验证码', login: '登录 PICO 账户',
    signedOut: '尚未登录', signedIn: '已登录', logout: '切换账号', logoutOk: '已退出登录',
    installTitle: '从官方 CDN 获取 APK',
    installNote: '核对 MD5、包名和版本后，Android 将显示安装确认。不会静默安装。',
    install: '下载并安装', ready: '准备就绪', disclaimer: '独立社区项目；应用权利归各自权利人所有',
    price: '官方价格：', loaded: '已从 PICO 官方商店读取版本',
    versionError: '版本查询失败：', operationError: '操作失败：', codeSent: '验证码已发送到 PICO 账户邮箱',
    loginOk: '已登录 PICO 账户',
    needLogin: '请先查询版本并登录 PICO 账户',
    installing: '正在向 PICO 请求官方下载…',
    downloadProgress: '正在下载：', verifying: '正在校验 APK…',
    confirming: '请在 Android 系统提示中确认安装。',
    installPermission: '请在系统设置允许 PICO Store Lab 安装应用，返回这里后再次点击「下载并安装」。',
    installOk: '应用安装成功', installError: '安装未完成：',
    download_in_progress: '已有下载或安装任务在进行', unapproved_request: '不支持此请求',
    response_too_large: '商店响应过大', invalid_apk_url: 'APK 下载地址无效',
    invalid_apk_size: 'APK 容量无效', invalid_apk_digest: 'APK 校验值无效',
    apk_digest_mismatch: 'APK 校验值不匹配', apk_package_mismatch: 'APK 包名或版本与官方信息不一致',
    language: 'EN', languageLabel: 'Switch to English',
  },
};

function t(key) { return translations[locale][key]; }
function errorText(error) { return t(error.message) || error.message; }

function updateAccountState() {
  document.getElementById('sign-in-form').hidden = loggedIn;
  document.getElementById('logout').hidden = !loggedIn;
  document.getElementById('login-state').textContent = loggedIn && accountEmail
    ? `${t('signedIn')}: ${accountEmail}` : t(loggedIn ? 'signedIn' : 'signedOut');
  document.getElementById('install').disabled = !loggedIn || !product;
  document.getElementById('favorite-toggle').disabled = !selected;
  document.getElementById('favorite-toggle').textContent = t(selected && favorites.some(item => item.itemId === selected.itemId) ? 'favoriteRemove' : 'favoriteAdd');
}

function renderFavorites() {
  const container = document.getElementById('favorite-items');
  container.replaceChildren();
  for (const item of favorites) {
    const button = document.createElement('button');
    button.className = 'ghost';
    button.textContent = item.name;
    button.addEventListener('click', () => selectTarget(item));
    container.append(button);
  }
}

function selectTarget(item) {
  selected = item;
  const picker = document.getElementById('catalog');
  if (![...picker.options].some(option => option.value === item.itemId)) {
    const option = document.createElement('option');
    option.value = item.itemId;
    option.textContent = item.name;
    picker.append(option);
  }
  picker.value = item.itemId;
  document.getElementById('product-name').textContent = item.name;
  document.getElementById('package-name').textContent = item.packageName;
  document.getElementById('version').textContent = '—';
  refresh();
}

function applyLocale() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
  document.getElementById('language').textContent = t('language');
  document.getElementById('language').setAttribute('aria-label', t('languageLabel'));
  updateAccountState();
  renderFavorites();
  if (product) document.getElementById('price').textContent = `${t('price')}${product.price}`;
  document.getElementById('status').textContent = `${t(currentStatus.key)}${currentStatus.detail}`;
}

window.__nativeComplete = (id, result) => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  result.error ? entry.reject(new Error(result.error)) : entry.resolve(result);
};

window.__nativeProgress = (phase, percent) => {
  if (phase === 'downloading') status('downloadProgress', `${percent}%`);
  else if (phase === 'verifying' || phase === 'confirming') status(phase);
};

function nativeCall(method, payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    window.PicoNative[method](id, JSON.stringify(payload));
  });
}

function status(key, detail = '') {
  currentStatus = { key, detail };
  document.getElementById('status').textContent = `${t(key)}${detail}`;
}

async function refresh() {
  if (!selected) return;
  const button = document.getElementById('refresh');
  button.disabled = true;
  const itemId = selected.itemId;
  product = null;
  updateAccountState();
  try {
    const result = await nativeCall('request', { action: 'public', ...selected });
    if (selected.itemId !== itemId) return;
    product = result;
    document.getElementById('product-name').textContent = result.name;
    document.getElementById('package-name').textContent = result.packageName;
    document.getElementById('version').textContent = product.versionCode;
    document.getElementById('price').textContent = `${t('price')}${product.price}`;
    updateAccountState();
    status('loaded');
  } catch (error) { status('versionError', errorText(error)); }
  finally { button.disabled = false; }
}

async function loadCatalog() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
    catalog = await response.json();
    if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('empty catalog');
    const picker = document.getElementById('catalog');
    for (const item of catalog) {
      const option = document.createElement('option');
      option.value = item.itemId;
      option.textContent = item.name;
      picker.append(option);
    }
    picker.addEventListener('change', () => {
      const item = [...catalog, ...searchItems, ...favorites].find(entry => entry.itemId === picker.value);
      if (item) selectTarget(item);
    });
    selectTarget(catalog[0]);
  } catch (error) { status('versionError', errorText(error)); }
}

async function search() {
  const word = document.getElementById('search-word').value.trim();
  if (!word) return;
  status('searching');
  const container = document.getElementById('search-results');
  container.replaceChildren();
  try {
    const result = await nativeCall('request', { action: 'search', word });
    searchItems = result.items;
    if (!result.items.length) status('searchEmpty');
    else status('ready');
    for (const item of result.items) {
      const button = document.createElement('button');
      button.className = 'ghost';
      button.textContent = item.name;
      button.addEventListener('click', () => selectTarget(item));
      container.append(button);
    }
  } catch (error) { status('operationError', errorText(error)); }
}

async function sendCode() {
  const button = document.getElementById('send-code');
  button.disabled = true;
  try {
    await nativeCall('request', {
      action: 'send-code', email: document.getElementById('email').value.trim(),
    });
    status('codeSent');
  } catch (error) { status('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function login() {
  const button = document.getElementById('login');
  button.disabled = true;
  try {
    const email = document.getElementById('email').value.trim();
    await nativeCall('request', {
      action: 'login', email,
      code: document.getElementById('code').value.trim(),
    });
    loggedIn = true;
    accountEmail = email;
    document.getElementById('code').value = '';
    updateAccountState();
    status('loginOk');
  } catch (error) { status('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function restoreSession() {
  try {
    const session = await nativeCall('request', { action: 'session' });
    loggedIn = Boolean(session.loggedIn);
    accountEmail = session.email || '';
    updateAccountState();
  } catch (error) { status('operationError', errorText(error)); }
}

async function logout() {
  const button = document.getElementById('logout');
  button.disabled = true;
  try {
    await nativeCall('request', { action: 'logout' });
    loggedIn = false;
    accountEmail = '';
    updateAccountState();
    status('logoutOk');
  } catch (error) { status('operationError', errorText(error)); }
  finally { button.disabled = false; }
}

async function install() {
  const button = document.getElementById('install');
  button.disabled = true;
  document.getElementById('logout').disabled = true;
  try {
    if (!loggedIn || !product) throw new Error(t('needLogin'));
    status('installing');
    const result = await nativeCall('install', selected);
    if (!result.installed) throw new Error(result.message || t('installError'));
    status('installOk');
  } catch (error) {
    if (error.message === 'install_permission_required') status('installPermission');
    else status('installError', errorText(error));
  }
  finally {
    button.disabled = !loggedIn || !product;
    document.getElementById('logout').disabled = false;
  }
}

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('search-form').addEventListener('submit', event => { event.preventDefault(); search(); });
document.getElementById('favorite-toggle').addEventListener('click', () => {
  if (!selected) return;
  favorites = favorites.some(item => item.itemId === selected.itemId)
    ? favorites.filter(item => item.itemId !== selected.itemId)
    : [...favorites, selected];
  localStorage.setItem('pico-store-favorites', JSON.stringify(favorites));
  updateAccountState();
  renderFavorites();
});
document.getElementById('send-code').addEventListener('click', sendCode);
document.getElementById('login').addEventListener('click', login);
document.getElementById('logout').addEventListener('click', logout);
document.getElementById('install').addEventListener('click', install);
document.getElementById('language').addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en';
  applyLocale();
});
applyLocale();
restoreSession();
loadCatalog();
