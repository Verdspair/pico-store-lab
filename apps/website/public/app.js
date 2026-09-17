const $ = id => document.getElementById(id);

function formatTime(value) {
  if (!value) return '尚未完成检查';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function render(state, fromSnapshot = false) {
  $('version-code').textContent = state.latestVersionCode ?? '—';
  $('package-name').textContent = state.packageName ?? 'com.vrchat.android';
  $('last-check').textContent = `最后成功检查：${formatTime(state.lastSuccessfulCheckAt)}`;
  $('status-pill').textContent = fromSnapshot || state.stale ? '上次快照 / 待复查' : '数据已更新';
  if (state.officialUrl?.startsWith('https://store-global.picoxr.com/')) $('official-link').href = state.officialUrl;
  const list = $('releases');
  list.replaceChildren();
  const releases = [...(state.releases ?? [])].reverse();
  if (!releases.length) {
    const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = '尚无发布记录'; list.append(empty); return;
  }
  releases.forEach((release, index) => {
    const li = document.createElement('li');
    const number = document.createElement('span'); number.className = 'ordinal'; number.textContent = String(releases.length - index).padStart(2, '0');
    const version = document.createElement('strong'); version.className = 'version'; version.textContent = `BUILD ${release.versionCode}`;
    const time = document.createElement('time'); time.dateTime = release.firstSeenAt; time.textContent = formatTime(release.firstSeenAt);
    li.append(number, version, time); list.append(li);
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
      $('status-pill').textContent = '暂不可用';
      $('last-check').textContent = '无法读取发布数据';
    }
  }
}

loadState();
