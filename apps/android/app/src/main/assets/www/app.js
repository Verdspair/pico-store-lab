import {
  makeAccountRequest, makeDownloadInfoRequest, makePublicItemRequest,
  parseDownloadInfo, parseOfficialJson, parsePublicItem,
} from './shared/pico.js';

const pending = new Map();
let nextId = 1;
let auth = null;
let product = null;

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

async function officialRequest(spec) {
  const result = await nativeCall('request', spec);
  if (result.status !== 200) throw new Error(`PICO 接口 HTTP ${result.status}`);
  return { body: parseOfficialJson(result.body), headers: result };
}

function status(message) { document.getElementById('status').textContent = message; }
function busy(button, active) { button.disabled = active; }

async function refresh() {
  const button = document.getElementById('refresh');
  busy(button, true);
  try {
    const { body } = await officialRequest(makePublicItemRequest());
    product = parsePublicItem(body);
    document.getElementById('version').textContent = product.versionCode;
    document.getElementById('price').textContent = `官方价格：${product.price} ${product.currency}`;
    status('已从 PICO 官方商店读取版本');
  } catch (error) { status(`版本查询失败：${error.message}`); }
  finally { busy(button, false); }
}

async function sendCode() {
  const button = document.getElementById('send-code');
  busy(button, true);
  try {
    const email = document.getElementById('email').value.trim();
    const { body } = await officialRequest(makeAccountRequest('send-code', email));
    if (body.message !== 'success') throw new Error(`验证码发送失败 (${body.data?.error_code ?? 'unknown'})`);
    status('验证码已发送到 PICO 账户邮箱');
  } catch (error) { status(error.message); }
  finally { busy(button, false); }
}

function parseCookies(lines) {
  const cookies = {};
  for (const line of lines ?? []) {
    const pair = line.split(';', 1)[0];
    const position = pair.indexOf('=');
    if (position > 0) cookies[pair.slice(0, position)] = pair.slice(position + 1);
  }
  return cookies;
}

async function login() {
  const button = document.getElementById('login');
  busy(button, true);
  try {
    const email = document.getElementById('email').value.trim();
    const code = document.getElementById('code').value.trim();
    const { body, headers } = await officialRequest(makeAccountRequest('login', email, code));
    if (body.message !== 'success') throw new Error(`登录失败 (${body.data?.error_code ?? 'unknown'})`);
    const cookies = parseCookies(headers.cookies);
    if (!headers.token && !cookies.sessionid && !cookies.sessionid_ss) throw new Error('没有获得可用的 PICO 会话');
    auth = { uid: String(body.data?.user_id_str ?? body.data?.user_id ?? '0'), x_tt_token: headers.token ?? '', cookies };
    document.getElementById('code').value = '';
    document.getElementById('login-state').textContent = '本次运行已登录';
    document.getElementById('install').disabled = false;
    status('登录成功；会话仅在内存中');
  } catch (error) { status(error.message); }
  finally { busy(button, false); }
}

async function install() {
  const button = document.getElementById('install');
  busy(button, true);
  try {
    if (!auth || !product) throw new Error('请先查询版本并登录 PICO 账户');
    status('正在获取官方 APK 信息…');
    const { body } = await officialRequest(makeDownloadInfoRequest(auth));
    const metadata = parseDownloadInfo(body);
    if (metadata.versionCode < product.versionCode) throw new Error('官方下载包版本低于商品页，暂不安装');
    status('正在下载、校验 APK；完成后将弹出系统安装确认…');
    const result = await nativeCall('install', metadata);
    if (!result.installed) throw new Error(result.message || '系统安装未完成');
    status(`安装成功：VRChat ${metadata.version}`);
  } catch (error) { status(`安装未完成：${error.message}`); }
  finally { busy(button, false); }
}

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('send-code').addEventListener('click', sendCode);
document.getElementById('login').addEventListener('click', login);
document.getElementById('install').addEventListener('click', install);
refresh();
