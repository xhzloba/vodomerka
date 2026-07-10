const STORAGE_KEY = 'tv-leonid-overrides-ui';
const FETCH_TIMEOUT_MS = 45_000;
const GITHUB_API_BASE = `${window.location.origin}/github-api`;

let hasGithubProxy = false;

const state = {
  overrides: {},
  jsonSha: null,
  editingId: null,
  pendingFiles: {
    logo: null,
    poster: null,
    backdrop: null,
  },
  pendingUploads: {},
};

const els = {
  repoInput: document.getElementById('repoInput'),
  branchInput: document.getElementById('branchInput'),
  tokenInput: document.getElementById('tokenInput'),
  reloadBtn: document.getElementById('reloadBtn'),
  saveBtn: document.getElementById('saveBtn'),
  addBtn: document.getElementById('addBtn'),
  entriesList: document.getElementById('entriesList'),
  editorPanel: document.getElementById('editorPanel'),
  editorTitle: document.getElementById('editorTitle'),
  closeEditorBtn: document.getElementById('closeEditorBtn'),
  mediaIdInput: document.getElementById('mediaIdInput'),
  aboutInput: document.getElementById('aboutInput'),
  logoFile: document.getElementById('logoFile'),
  posterFile: document.getElementById('posterFile'),
  backdropFile: document.getElementById('backdropFile'),
  logoUrl: document.getElementById('logoUrl'),
  posterUrl: document.getElementById('posterUrl'),
  backdropUrl: document.getElementById('backdropUrl'),
  logoPreview: document.getElementById('logoPreview'),
  posterPreview: document.getElementById('posterPreview'),
  backdropPreview: document.getElementById('backdropPreview'),
  deleteEntryBtn: document.getElementById('deleteEntryBtn'),
  applyEntryBtn: document.getElementById('applyEntryBtn'),
  jsonPreview: document.getElementById('jsonPreview'),
  toast: document.getElementById('toast'),
  busy: document.getElementById('busy'),
  busyText: document.getElementById('busyText'),
  statusLine: document.getElementById('statusLine'),
  serverWarning: document.getElementById('serverWarning'),
};

function getConfig() {
  return {
    repo: els.repoInput.value.trim() || 'xhzloba/dbmovies',
    branch: els.branchInput.value.trim() || 'main',
    token: els.tokenInput.value.trim(),
  };
}

function rawBase(config) {
  return `https://raw.githubusercontent.com/${config.repo}/${config.branch}`;
}

function saveUiState() {
  const { repo, branch, token } = getConfig();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ repo, branch, token: token || undefined }),
  );
}

function restoreUiState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.repo) els.repoInput.value = saved.repo;
    if (saved.branch) els.branchInput.value = saved.branch;
    if (saved.token) els.tokenInput.value = saved.token;
  } catch {
    // ignore
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 5000);
}

function setBusy(isBusy, message = '') {
  if (!els.busy) return;
  els.busy.hidden = !isBusy;
  els.busy.classList.toggle('is-active', isBusy);
  if (els.busyText) {
    els.busyText.textContent = message;
  }
}

function setStatus(message) {
  if (!els.statusLine) return;
  if (!message) {
    els.statusLine.hidden = true;
    els.statusLine.textContent = '';
    return;
  }
  els.statusLine.hidden = false;
  els.statusLine.textContent = message;
}

async function detectServer() {
  try {
    const response = await fetchWithTimeout('/__health', {}, 4000);
    if (!response.ok) {
      hasGithubProxy = false;
      return;
    }
    const payload = await response.json();
    hasGithubProxy = payload?.proxy === true;
  } catch {
    hasGithubProxy = false;
  }

  if (els.serverWarning) {
    els.serverWarning.hidden = hasGithubProxy;
  }
}

function authHeader(token) {
  if (!token) return {};
  if (token.startsWith('ghp_') || token.startsWith('gho_')) {
    return { Authorization: `token ${token}` };
  }
  return { Authorization: `Bearer ${token}` };
}

function githubHeaders(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...authHeader(token),
    ...extra,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Таймаут запроса (${Math.round(timeoutMs / 1000)}с): ${url}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readGithubError(response) {
  try {
    const payload = await response.json();
    if (payload?.message) {
      return payload.message;
    }
  } catch {
    // ignore
  }

  return `HTTP ${response.status}`;
}

function githubApiUrl(path) {
  return `${GITHUB_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchJsonFromGitHub(path, token) {
  const config = getConfig();
  const response = await fetchWithTimeout(
    githubApiUrl(`/repos/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`),
    { headers: githubHeaders(token) },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  const payload = await response.json();
  const content = atob(payload.content.replace(/\n/g, ''));
  return {
    sha: payload.sha,
    data: JSON.parse(content),
  };
}

async function fetchRemoteOverrides() {
  const config = getConfig();
  const rawPath = `${config.repo}/${config.branch}/movie_overrides.json`;
  const urls = hasGithubProxy
    ? [`${window.location.origin}/raw-github/${rawPath}`, `${rawBase(config)}/movie_overrides.json`]
    : [`${rawBase(config)}/movie_overrides.json`];

  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { cache: 'no-store' }, 20_000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Не удалось загрузить movie_overrides.json');
}

async function getFileSha(path, token) {
  const config = getConfig();
  const response = await fetchWithTimeout(
    githubApiUrl(`/repos/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`),
    { headers: githubHeaders(token) },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  const payload = await response.json();
  return payload.sha;
}

async function verifyToken(token) {
  const response = await fetchWithTimeout(githubApiUrl('/user'), {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Токен не прошёл проверку: ${await readGithubError(response)}`);
  }
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function renderPreview(container, url) {
  if (!url) {
    container.textContent = '—';
    return;
  }

  container.innerHTML = `<img src="${url}" alt="" referrerpolicy="no-referrer" />`;
}

function summarizeEntry(entry) {
  return ['logo', 'poster', 'backdrop', 'about']
    .filter((key) => Boolean(entry[key]))
    .join(', ');
}

function renderEntries() {
  const ids = Object.keys(state.overrides).sort();

  if (ids.length === 0) {
    els.entriesList.innerHTML = '<p class="hint">Пока нет записей</p>';
    els.jsonPreview.textContent = '{}';
    return;
  }

  els.entriesList.innerHTML = ids
    .map(
      (id) => `
        <article class="entry">
          <div>
            <div class="entry__id">${id}</div>
            <div class="entry__meta">${summarizeEntry(state.overrides[id]) || 'пусто'}</div>
          </div>
          <button class="btn btn--ghost" type="button" data-edit="${id}">Редактировать</button>
        </article>
      `,
    )
    .join('');

  els.entriesList.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => openEditor(button.dataset.edit));
  });

  els.jsonPreview.textContent = JSON.stringify(state.overrides, null, 2);
}

function resetPendingFiles() {
  state.pendingFiles = { logo: null, poster: null, backdrop: null };
  els.logoFile.value = '';
  els.posterFile.value = '';
  els.backdropFile.value = '';
}

function openEditor(id = null) {
  state.editingId = id;
  resetPendingFiles();

  if (id && state.overrides[id]) {
    const entry = state.overrides[id];
    els.editorTitle.textContent = `Редактирование ${id}`;
    els.mediaIdInput.value = id;
    els.mediaIdInput.disabled = true;
    els.aboutInput.value = entry.about || '';
    els.logoUrl.value = entry.logo || '';
    els.posterUrl.value = entry.poster || '';
    els.backdropUrl.value = entry.backdrop || '';
    renderPreview(els.logoPreview, entry.logo);
    renderPreview(els.posterPreview, entry.poster);
    renderPreview(els.backdropPreview, entry.backdrop);
    els.deleteEntryBtn.hidden = false;
  } else {
    els.editorTitle.textContent = 'Новая запись';
    els.mediaIdInput.value = '';
    els.mediaIdInput.disabled = false;
    els.aboutInput.value = '';
    els.logoUrl.value = '';
    els.posterUrl.value = '';
    els.backdropUrl.value = '';
    renderPreview(els.logoPreview, '');
    renderPreview(els.posterPreview, '');
    renderPreview(els.backdropPreview, '');
    els.deleteEntryBtn.hidden = true;
  }

  els.editorPanel.hidden = false;
}

function closeEditor() {
  state.editingId = null;
  els.editorPanel.hidden = true;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function extensionForFile(file) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName === 'png') return 'png';
  if (fromName === 'jpg' || fromName === 'jpeg') return 'jpg';
  if (fromName === 'webp') return 'webp';
  return 'webp';
}

function buildImageFilename(mediaId, kind, file) {
  return `${mediaId}-${kind}.${extensionForFile(file)}`;
}

function bindAssetInput(fileInput, urlInput, preview, kind) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    state.pendingFiles[kind] = file;
    urlInput.value = '';
    renderPreview(preview, URL.createObjectURL(file));
  });

  urlInput.addEventListener('input', () => {
    state.pendingFiles[kind] = null;
    fileInput.value = '';
    renderPreview(preview, urlInput.value.trim());
  });
}

function flushEditorToPendingUploads() {
  if (els.editorPanel.hidden) {
    return;
  }

  const mediaId = (state.editingId || els.mediaIdInput.value).trim();
  if (!/^[a-f0-9]{24}$/i.test(mediaId)) {
    return;
  }

  const entry = {};
  const about = els.aboutInput.value.trim();
  const logoUrl = els.logoUrl.value.trim();
  const posterUrl = els.posterUrl.value.trim();
  const backdropUrl = els.backdropUrl.value.trim();

  if (about) entry.about = about;
  if (logoUrl) entry.logo = logoUrl;
  if (posterUrl) entry.poster = posterUrl;
  if (backdropUrl) entry.backdrop = backdropUrl;

  const hasPendingFiles = Object.values(state.pendingFiles).some(Boolean);
  if (Object.keys(entry).length > 0 || hasPendingFiles) {
    state.overrides[mediaId] = {
      ...(state.overrides[mediaId] || {}),
      ...entry,
    };
  }

  if (hasPendingFiles) {
    state.pendingUploads[mediaId] = {
      ...(state.pendingUploads[mediaId] || {}),
      ...Object.fromEntries(
        Object.entries(state.pendingFiles).filter(([, file]) => Boolean(file)),
      ),
    };
  }
}

function applyEntryLocally() {
  const mediaId = (state.editingId || els.mediaIdInput.value).trim();
  if (!/^[a-f0-9]{24}$/i.test(mediaId)) {
    showToast('Media ID должен быть 24-символьным hex ObjectId');
    return;
  }

  flushEditorToPendingUploads();
  renderEntries();
  closeEditor();
  showToast('Сохранено локально. Нажми «Опубликовать в GitHub» для загрузки файлов.');
}

async function uploadBinaryFile(path, file, message, token) {
  const content = await fileToBase64(file);
  const sha = await getFileSha(path, token);
  const config = getConfig();

  const response = await fetchWithTimeout(
    githubApiUrl(`/repos/${config.repo}/contents/${path}`),
    {
      method: 'PUT',
      headers: githubHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message,
        content,
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  return `${rawBase(config)}/${path}`;
}

async function publishToGitHub() {
  const { token } = getConfig();
  if (!token) {
    showToast('Для публикации нужен GitHub token (repo scope)');
    return;
  }

  if (!hasGithubProxy) {
    showToast('Запусти UI через npm run overrides-ui (нужен прокси /github-api)');
    return;
  }

  setBusy(true, 'Проверка токена…');

  try {
    await verifyToken(token);
    flushEditorToPendingUploads();

    const uploadEntries = Object.entries(state.pendingUploads);
    for (let index = 0; index < uploadEntries.length; index += 1) {
      const [mediaId, files] = uploadEntries[index];
      if (!state.overrides[mediaId]) {
        state.overrides[mediaId] = {};
      }

      for (const [kind, file] of Object.entries(files)) {
        if (!file) continue;
        setBusy(true, `Загрузка ${kind} (${index + 1}/${uploadEntries.length})…`);
        const imagePath = `images/${buildImageFilename(mediaId, kind, file)}`;
        state.overrides[mediaId][kind] = await uploadBinaryFile(
          imagePath,
          file,
          `Add ${kind} override for ${mediaId}`,
          token,
        );
      }
    }

    state.pendingUploads = {};
    resetPendingFiles();

    setBusy(true, 'Обновление movie_overrides.json…');

    const jsonText = `${JSON.stringify(state.overrides, null, 2)}\n`;
    const jsonContent = encodeBase64Utf8(jsonText);
    const jsonSha = state.jsonSha || (await getFileSha('movie_overrides.json', token));
    const config = getConfig();

    const response = await fetchWithTimeout(
      githubApiUrl(`/repos/${config.repo}/contents/movie_overrides.json`),
      {
        method: 'PUT',
        headers: githubHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: 'Update movie overrides',
          content: jsonContent,
          branch: config.branch,
          ...(jsonSha ? { sha: jsonSha } : {}),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(await readGithubError(response));
    }

    const payload = await response.json();
    state.jsonSha = payload.content?.sha ?? jsonSha;
    renderEntries();
    closeEditor();
    showToast('Опубликовано в GitHub');
  } catch (error) {
    console.error('[overrides-ui] publish failed', error);
    showToast(error instanceof Error ? error.message : 'Ошибка публикации');
  } finally {
    setBusy(false);
  }
}

async function reloadFromGitHub() {
  setStatus('Загрузка movie_overrides.json…');
  els.reloadBtn.disabled = true;

  try {
    const { token } = getConfig();
    const remote = await fetchRemoteOverrides();
    state.overrides = remote || {};

    if (token && hasGithubProxy) {
      try {
        const jsonMeta = await fetchJsonFromGitHub('movie_overrides.json', token);
        state.jsonSha = jsonMeta?.sha ?? null;
      } catch (error) {
        console.warn('[overrides-ui] sha fetch skipped', error);
      }
    }

    renderEntries();
    showToast(`Загружено: ${Object.keys(state.overrides).length} записей`);
  } catch (error) {
    console.error('[overrides-ui] reload failed', error);
    showToast(error instanceof Error ? error.message : 'Ошибка загрузки');
  } finally {
    els.reloadBtn.disabled = false;
    setStatus('');
  }
}

function deleteEntry() {
  if (!state.editingId) return;
  delete state.overrides[state.editingId];
  delete state.pendingUploads[state.editingId];
  renderEntries();
  closeEditor();
  showToast('Запись удалена локально');
}

els.reloadBtn.addEventListener('click', () => {
  saveUiState();
  void reloadFromGitHub();
});

els.saveBtn.addEventListener('click', () => {
  saveUiState();
  void publishToGitHub();
});

els.addBtn.addEventListener('click', () => openEditor());
els.closeEditorBtn.addEventListener('click', closeEditor);
els.applyEntryBtn.addEventListener('click', applyEntryLocally);
els.deleteEntryBtn.addEventListener('click', deleteEntry);

document.getElementById('cancelBusyBtn')?.addEventListener('click', () => {
  setBusy(false);
  showToast('Операция отменена в UI. Запрос на сервере мог ещё идти.');
});

[els.repoInput, els.branchInput, els.tokenInput].forEach((input) => {
  input.addEventListener('change', saveUiState);
});

bindAssetInput(els.logoFile, els.logoUrl, els.logoPreview, 'logo');
bindAssetInput(els.posterFile, els.posterUrl, els.posterPreview, 'poster');
bindAssetInput(els.backdropFile, els.backdropUrl, els.backdropPreview, 'backdrop');

restoreUiState();
setBusy(false);
void detectServer().then(() => reloadFromGitHub());
