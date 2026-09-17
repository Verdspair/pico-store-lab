const $ = id => document.getElementById(id);
const translations = {
  en: {
    indexLabel: 'INDEPENDENT PICO APP INDEX', catalogLabel: '01 / RECOMMENDED', catalogHint: 'START EXPLORING', currentLabel: '02 / SELECTED RELEASE',
    searchLabel: 'Search PICO apps', searchPlaceholder: 'App name', searchButton: 'Search', searching: 'Searching PICO Store…', searchEmpty: 'No apps found', searchFailed: 'Search is unavailable; try again.',
    favoritesLabel: 'FAVORITES', favoritesHint: 'SAVED ON THIS DEVICE', favoriteAdd: 'Save favorite ☆', favoriteRemove: 'Remove favorite ★',
    packageLabel: 'PACKAGE', versionLabel: 'LATEST VERSION CODE',
    historyLabel: '03 / RELEASE HISTORY', trackingLabel: 'MONOTONIC TRACKING',
    workflowLabel: '04 / HOW IT WORKS', communityLabel: 'PICO STORE LAB / COMMUNITY EXPERIMENT',
    heroLine: 'Your PICO apps,', heroAccent: 'your way to get them.',
    intro: 'Explore PICO apps and their releases. Choose an app, then get it through your own account on your headset.',
    official: 'Official listing ↗', exploreCatalog: 'Explore catalog ↓', repositoryLink: 'GitHub repo ↗',
    playerGuide: 'Get the app & player guide', getClient: 'Get Android client ↗',
    fullGuide: 'Full player guide ↗', loading: 'Loading',
    nativeNote: 'Official PICO app listing.',
    reading: 'Reading release data', readingHistory: 'Reading release history…',
    workflowOne: 'Your PICO account.', workflowTwo: 'Your own download.',
    stepOne: 'Get our Android client from GitHub Releases and install it on your PICO headset.',
    stepTwo: 'Open PICO Store Lab, choose an app, and sign in with your own PICO email verification code.',
    stepThree: 'Choose Download and install. The client requests your entitled APK from PICO, verifies it, then asks for system installation approval.',
    disclaimer: 'Independent project. App rights belong to their owners.',
    never: 'No successful check yet', unknownTime: 'Unknown time',
    publicDetail: 'Official item data', catalogLookup: 'Current official listing',
    lastCheck: 'Last successful check: ', stale: 'Previous snapshot / needs recheck',
    fresh: 'Up to date', empty: 'No releases recorded yet', unavailable: 'Unavailable',
    unable: 'Unable to load release data', language: '中文', languageLabel: 'Switch to Chinese',
  },
  'zh-CN': {
    indexLabel: '独立 PICO 应用索引', catalogLabel: '01 / 推荐应用', catalogHint: '开始探索', currentLabel: '02 / 所选版本',
    searchLabel: '搜索 PICO 应用', searchPlaceholder: '输入应用名称', searchButton: '搜索', searching: '正在搜索 PICO 商店…', searchEmpty: '没有找到应用', searchFailed: '搜索暂不可用，请重试。',
    favoritesLabel: '收藏', favoritesHint: '保存在此设备', favoriteAdd: '加入收藏 ☆', favoriteRemove: '取消收藏 ★',
    packageLabel: '包名', versionLabel: '最新版本码',
    historyLabel: '03 / 发布记录', trackingLabel: '版本只增不退',
    workflowLabel: '04 / 使用流程', communityLabel: 'PICO STORE LAB / 社区实验',
    heroLine: '你的 PICO 应用，', heroAccent: '由你选择获取方式。',
    intro: '浏览 PICO 应用及其发布版本。选择应用后，在头显上通过自己的账号获取并安装。',
    official: '官方商品页 ↗', exploreCatalog: '浏览应用目录 ↓', repositoryLink: 'GitHub 仓库 ↗',
    playerGuide: '获取应用与玩家指南', getClient: '下载头显客户端 ↗',
    fullGuide: '完整玩家指南 ↗', loading: '读取中',
    nativeNote: 'PICO 官方应用商品页。',
    reading: '正在读取发布信息', readingHistory: '正在读取发布记录…',
    workflowOne: '用你自己的 PICO 账号，', workflowTwo: '获取你自己的下载。',
    stepOne: '从 GitHub Releases 获取我们的 Android 客户端，并安装到 PICO 头显。',
    stepTwo: '打开 PICO Store Lab，选择应用，再用自己的 PICO 邮箱验证码登录。',
    stepThree: '点击「下载并安装」。客户端向 PICO 请求你的账号可获取的官方包，校验后由系统询问安装许可。',
    disclaimer: '独立社区项目。应用权利归各自权利人所有。',
    never: '尚未完成检查', unknownTime: '时间未知',
    publicDetail: '官方商品信息', catalogLookup: '当前官方商品页',
    lastCheck: '最后成功检查：', stale: '上次快照 / 待复查',
    fresh: '数据已更新', empty: '尚无发布记录', unavailable: '暂不可用',
    unable: '无法读取发布数据', language: 'EN', languageLabel: 'Switch to English',
  },
};

const requested = new URL(location.href).searchParams.get('lang');
let locale = requested === 'en' || requested === 'zh-CN'
  ? requested : navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
let currentState = null;
let catalogItems = [];
let searchItems = [];
let selectedId = null;
let fromSnapshot = false;
let favorites = [];
try { favorites = JSON.parse(localStorage.getItem('pico-store-favorites') || '[]'); } catch { favorites = []; }
if (!Array.isArray(favorites)) favorites = [];

function t(key) { return translations[locale][key]; }

function formatTime(value) {
  if (!value) return t('never');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t('unknownTime')
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function applyLocale() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
  $('language').textContent = t('language');
  $('language').setAttribute('aria-label', t('languageLabel'));
  const guide = locale === 'zh-CN'
    ? 'https://github.com/nkanf-dev/pico-store-lab/blob/main/README.zh-CN.md#player-guide'
    : 'https://github.com/nkanf-dev/pico-store-lab#player-guide';
  $('guide-link').href = guide;
  $('workflow-guide-link').href = guide;
  document.title = locale === 'en' ? 'PICO Store Lab — Independent PICO app catalog' : 'PICO Store Lab — 独立 PICO 应用目录';
  if (currentState) render(currentState, fromSnapshot);
}

function renderCards(container, items) {
  container.replaceChildren();
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `catalog-item${item.itemId === selectedId ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(item.itemId === selectedId));
    const name = document.createElement('strong');
    name.textContent = item.name;
    const version = document.createElement('span');
    const versionCode = item.state?.latestVersionCode ?? item.versionCode;
    version.textContent = versionCode ? `BUILD ${versionCode}` : '—';
    button.append(name, version);
    button.addEventListener('click', () => selectItem(item.itemId));
    container.append(button);
  }
}

function renderCatalog() {
  renderCards($('catalog-items'), catalogItems);
  renderCards($('search-results'), searchItems);
  renderCards($('favorite-items'), favorites);
}

async function selectItem(itemId) {
  selectedId = itemId;
  const item = [...catalogItems, ...searchItems, ...favorites].find(entry => entry.itemId === itemId);
  if (!item) return;
  renderCatalog();
  render(item.state ?? { ...item, latestVersionCode: item.versionCode, releases: [], stale: true }, !item.state);
  if (!item.state) {
    try {
      const url = `/api/item?itemId=${encodeURIComponent(item.itemId)}&package=${encodeURIComponent(item.packageName)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('item unavailable');
      const detail = await response.json();
      item.versionCode = detail.versionCode;
      renderCatalog();
      if (selectedId === itemId) render({ ...detail, latestVersionCode: detail.versionCode, releases: [] });
    } catch { /* Search result remains selectable with its public summary. */ }
  }
}

function render(state, snapshot = false) {
  currentState = state;
  fromSnapshot = snapshot;
  $('version-code').textContent = state.latestVersionCode ?? '—';
  $('release-heading').textContent = state.name ?? state.packageName ?? '—';
  $('package-name').textContent = state.packageName ?? '—';
  $('favorite-toggle').textContent = t(favorites.some(item => item.itemId === state.itemId) ? 'favoriteRemove' : 'favoriteAdd');
  $('last-check').textContent = state.lastSuccessfulCheckAt
    ? `${t('lastCheck')}${formatTime(state.lastSuccessfulCheckAt)}` : t('catalogLookup');
  $('status-pill').textContent = !state.lastSuccessfulCheckAt && state.latestVersionCode
    ? t('publicDetail') : snapshot || state.stale ? t('stale') : t('fresh');
  $('official-link').href = state.officialUrl?.startsWith('https://store-global.picoxr.com/')
    ? state.officialUrl : `https://store-global.picoxr.com/global/detail/1/${state.itemId}`;
  const list = $('releases');
  list.replaceChildren();
  const releases = [...(state.releases ?? [])].reverse();
  if (!releases.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = t('empty');
    list.append(empty);
    return;
  }
  releases.forEach((release, index) => {
    const li = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'ordinal';
    number.textContent = String(releases.length - index).padStart(2, '0');
    const version = document.createElement('strong');
    version.className = 'version';
    version.textContent = `BUILD ${release.versionCode}`;
    const time = document.createElement('time');
    time.dateTime = release.firstSeenAt;
    time.textContent = formatTime(release.firstSeenAt);
    li.append(number, version, time);
    list.append(li);
  });
}

async function search() {
  const word = $('search-word').value.trim();
  if (!word) return;
  $('search-status').textContent = t('searching');
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error('search unavailable');
    const result = await response.json();
    searchItems = result.items ?? [];
    renderCatalog();
    $('search-status').textContent = searchItems.length ? '' : t('searchEmpty');
  } catch { $('search-status').textContent = t('searchFailed'); }
}

$('search-form').addEventListener('submit', event => { event.preventDefault(); search(); });
$('favorite-toggle').addEventListener('click', () => {
  if (!currentState?.itemId) return;
  favorites = favorites.some(item => item.itemId === currentState.itemId)
    ? favorites.filter(item => item.itemId !== currentState.itemId)
    : [...favorites, { itemId: currentState.itemId, packageName: currentState.packageName, name: currentState.name }];
  localStorage.setItem('pico-store-favorites', JSON.stringify(favorites));
  renderCatalog();
  $('favorite-toggle').textContent = t(favorites.some(item => item.itemId === currentState.itemId) ? 'favoriteRemove' : 'favoriteAdd');
});

async function loadState() {
  try {
    const response = await fetch('/api/catalog', { cache: 'no-store' });
    if (!response.ok) throw new Error(`release API ${response.status}`);
    catalogItems = await response.json();
    if (!Array.isArray(catalogItems) || !catalogItems.length) throw new Error('catalog unavailable');
    selectItem(selectedId ?? catalogItems[0].itemId);
  } catch {
    try {
      const response = await fetch('/catalog.json');
      if (!response.ok) throw new Error('snapshot unavailable');
      const state = await response.json();
      catalogItems = [{ itemId: state.itemId, packageName: state.packageName, name: state.name, state }];
      selectItem(state.itemId);
    } catch {
      $('status-pill').textContent = t('unavailable');
      $('last-check').textContent = t('unable');
    }
  }
}

$('language').addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en';
  const url = new URL(location.href);
  url.searchParams.set('lang', locale);
  history.replaceState(null, '', url);
  applyLocale();
});
applyLocale();
loadState();
