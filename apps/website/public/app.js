const $ = id => document.getElementById(id);
const translations = {
  en: {
    indexLabel: 'INDEPENDENT RELEASE INDEX', currentLabel: '01 / CURRENT RELEASE',
    packageLabel: 'PACKAGE', versionLabel: 'LATEST VERSION CODE',
    historyLabel: '02 / RELEASE HISTORY', trackingLabel: 'MONOTONIC TRACKING',
    workflowLabel: '03 / HOW IT WORKS', communityLabel: 'PICO STORE LAB / COMMUNITY EXPERIMENT',
    heroLine: 'Beyond the store,', heroAccent: 'see every release.',
    intro: 'Track native PICO VRChat releases. The public index records version changes; your own client handles account sign-in and installation.',
    official: 'Official listing', workflowLink: 'How it works', loading: 'Loading',
    nativeNote: 'Native PICO Android build, not the Google Play mobile app.',
    reading: 'Reading release data', readingHistory: 'Reading release history…',
    workflowOne: 'Public version signals.', workflowTwo: 'Private download sessions.',
    stepOne: "The TypeScript SDK reads PICO's public listing and tracks version changes.",
    stepTwo: 'Desktop or PICO Android uses your account to request the official package.',
    stepThree: 'Clients verify the official MD5 and package before installation.',
    disclaimer: 'Not affiliated with PICO or VRChat. App rights belong to their owners.',
    never: 'No successful check yet', unknownTime: 'Unknown time',
    lastCheck: 'Last successful check: ', stale: 'Previous snapshot / needs recheck',
    fresh: 'Up to date', empty: 'No releases recorded yet', unavailable: 'Unavailable',
    unable: 'Unable to load release data', language: '中文', languageLabel: 'Switch to Chinese',
  },
  'zh-CN': {
    indexLabel: '独立发布索引', currentLabel: '01 / 当前版本',
    packageLabel: '包名', versionLabel: '最新版本码',
    historyLabel: '02 / 发布记录', trackingLabel: '版本只增不退',
    workflowLabel: '03 / 工作原理', communityLabel: 'PICO STORE LAB / 社区实验',
    heroLine: '在官方商店之外，', heroAccent: '看清每一次更新。',
    intro: '追踪 PICO 原生 VRChat 的发布版本。公开目录记录版本变化；账号认证和设备安装由你自己的客户端完成。',
    official: '前往官方商品页', workflowLink: '了解下载流程', loading: '读取中',
    nativeNote: 'PICO 原生 Android 包；不同于 Google Play 手机版。',
    reading: '正在读取发布信息', readingHistory: '正在读取发布记录…',
    workflowOne: '公开的版本信号。', workflowTwo: '私有的下载会话。',
    stepOne: 'TypeScript SDK 读取 PICO 官方公开商品接口，记录版本码变化。',
    stepTwo: 'Desktop 或 PICO Android 客户端使用你自己的账号获取官方包。',
    stepThree: '客户端核对官方 MD5 和包名，再请求安装。',
    disclaimer: '非 PICO 或 VRChat 官方产品。应用权利归各自权利人所有。',
    never: '尚未完成检查', unknownTime: '时间未知',
    lastCheck: '最后成功检查：', stale: '上次快照 / 待复查',
    fresh: '数据已更新', empty: '尚无发布记录', unavailable: '暂不可用',
    unable: '无法读取发布数据', language: 'EN', languageLabel: 'Switch to English',
  },
};

const requested = new URL(location.href).searchParams.get('lang');
let locale = requested === 'en' || requested === 'zh-CN'
  ? requested : navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
let currentState = null;
let fromSnapshot = false;

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
  $('language').textContent = t('language');
  $('language').setAttribute('aria-label', t('languageLabel'));
  document.title = locale === 'en' ? 'PICO Store Lab — VRChat Release Radar' : 'PICO Store Lab — VRChat 发布追踪';
  if (currentState) render(currentState, fromSnapshot);
}

function render(state, snapshot = false) {
  currentState = state;
  fromSnapshot = snapshot;
  $('version-code').textContent = state.latestVersionCode ?? '—';
  $('package-name').textContent = state.packageName ?? 'com.vrchat.android';
  $('last-check').textContent = `${t('lastCheck')}${formatTime(state.lastSuccessfulCheckAt)}`;
  $('status-pill').textContent = snapshot || state.stale ? t('stale') : t('fresh');
  if (state.officialUrl?.startsWith('https://store-global.picoxr.com/')) $('official-link').href = state.officialUrl;
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

async function loadState() {
  try {
    const response = await fetch('/api/releases', { cache: 'no-store' });
    if (!response.ok) throw new Error(`release API ${response.status}`);
    const state = await response.json();
    if (!state.latestVersionCode) throw new Error('release API has no snapshot');
    render(state);
  } catch {
    try {
      const response = await fetch('/catalog.json');
      if (!response.ok) throw new Error('snapshot unavailable');
      render(await response.json(), true);
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
