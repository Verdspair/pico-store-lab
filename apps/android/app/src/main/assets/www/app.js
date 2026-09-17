const pending = new Map();
let nextId = 1;
let product = null;
let loggedIn = false;
let locale = navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
let currentStatus = { key: 'ready', detail: '' };

const translations = {
  en: {
    edition: 'ON-DEVICE / 001', nativeEyebrow: 'PICO GLOBAL / NATIVE VR',
    currentLabel: '01 / CURRENT RELEASE', accountLabel: '02 / YOUR ACCOUNT',
    installLabel: '03 / VERIFIED INSTALL', communityLabel: 'INDEPENDENT COMMUNITY CLIENT',
    heroOne: 'Bring updates', heroTwo: 'into the headset.',
    lede: 'Check official releases, sign in, verify downloads and request installation directly on PICO.',
    checking: 'Checking official store…', refresh: 'Refresh release',
    accountTitle: 'Private download session',
    accountNote: 'Email-code sign-in. Your session stays in native app memory for this run only.',
    email: 'PICO account email', sendCode: 'Send code', code: 'Code', login: 'Sign in to PICO',
    signedOut: 'Not signed in', signedIn: 'Signed in for this run',
    installTitle: 'Get the APK from the official CDN',
    installNote: 'The app checks MD5, package and version before Android asks for installation confirmation. No silent install.',
    install: 'Download and install', ready: 'Ready',
    disclaimer: 'Not affiliated with PICO or VRChat',
    price: 'Official price: ', loaded: 'Official PICO release loaded',
    versionError: 'Release lookup failed: ', operationError: 'Operation failed: ', codeSent: 'Verification email sent',
    loginOk: 'Signed in; session stays in native app memory',
    needLogin: 'Check the release and sign in first',
    installing: 'Fetching and verifying the official APK; Android will ask for confirmation…',
    installOk: 'VRChat installed', installError: 'Installation incomplete: ',
    language: '中文', languageLabel: 'Switch to Chinese',
  },
  'zh-CN': {
    edition: '设备端 / 001', nativeEyebrow: 'PICO 国际版 / 原生 VR',
    currentLabel: '01 / 当前版本', accountLabel: '02 / 你的账户',
    installLabel: '03 / 校验安装', communityLabel: '独立社区客户端',
    heroOne: '把更新，', heroTwo: '带到头显里。',
    lede: '直接在 PICO 上查询官方版本、登录个人账户、校验下载并请求安装。',
    checking: '正在查询官方商店…', refresh: '刷新版本',
    accountTitle: '个人下载会话', accountNote: '邮箱验证码登录。会话只保存在本次运行的原生内存里。',
    email: 'PICO 账户邮箱', sendCode: '发送验证码', code: '验证码', login: '登录 PICO 账户',
    signedOut: '尚未登录', signedIn: '本次运行已登录',
    installTitle: '从官方 CDN 获取 APK',
    installNote: '核对 MD5、包名和版本后，Android 将显示安装确认。不会静默安装。',
    install: '下载并安装', ready: '准备就绪', disclaimer: '非 PICO 或 VRChat 官方产品',
    price: '官方价格：', loaded: '已从 PICO 官方商店读取版本',
    versionError: '版本查询失败：', operationError: '操作失败：', codeSent: '验证码已发送到 PICO 账户邮箱',
    loginOk: '登录成功；会话仅保存在原生应用内存中',
    needLogin: '请先查询版本并登录 PICO 账户',
    installing: '正在获取官方 APK、校验并请求系统安装确认…',
    installOk: '安装成功：VRChat', installError: '安装未完成：',
    language: 'EN', languageLabel: 'Switch to English',
  },
};

function t(key) { return translations[locale][key]; }

function applyLocale() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
  document.getElementById('language').textContent = t('language');
  document.getElementById('language').setAttribute('aria-label', t('languageLabel'));
  document.getElementById('login-state').textContent = t(loggedIn ? 'signedIn' : 'signedOut');
  if (product) document.getElementById('price').textContent = `${t('price')}${product.price}`;
  document.getElementById('status').textContent = `${t(currentStatus.key)}${currentStatus.detail}`;
}

window.__nativeComplete = (id, result) => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  result.error ? entry.reject(new Error(result.error)) : entry.resolve(result);
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
  const button = document.getElementById('refresh');
  button.disabled = true;
  try {
    product = await nativeCall('request', { action: 'public' });
    document.getElementById('version').textContent = product.versionCode;
    document.getElementById('price').textContent = `${t('price')}${product.price}`;
    status('loaded');
  } catch (error) { status('versionError', error.message); }
  finally { button.disabled = false; }
}

async function sendCode() {
  const button = document.getElementById('send-code');
  button.disabled = true;
  try {
    await nativeCall('request', {
      action: 'send-code', email: document.getElementById('email').value.trim(),
    });
    status('codeSent');
  } catch (error) { status('operationError', error.message); }
  finally { button.disabled = false; }
}

async function login() {
  const button = document.getElementById('login');
  button.disabled = true;
  try {
    await nativeCall('request', {
      action: 'login', email: document.getElementById('email').value.trim(),
      code: document.getElementById('code').value.trim(),
    });
    loggedIn = true;
    document.getElementById('code').value = '';
    document.getElementById('login-state').textContent = t('signedIn');
    document.getElementById('install').disabled = false;
    status('loginOk');
  } catch (error) { status('operationError', error.message); }
  finally { button.disabled = false; }
}

async function install() {
  const button = document.getElementById('install');
  button.disabled = true;
  try {
    if (!loggedIn || !product) throw new Error(t('needLogin'));
    status('installing');
    const result = await nativeCall('install', {});
    if (!result.installed) throw new Error(result.message || t('installError'));
    status('installOk');
  } catch (error) { status('installError', error.message); }
  finally { button.disabled = false; }
}

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('send-code').addEventListener('click', sendCode);
document.getElementById('login').addEventListener('click', login);
document.getElementById('install').addEventListener('click', install);
document.getElementById('language').addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en';
  applyLocale();
});
applyLocale();
refresh();
