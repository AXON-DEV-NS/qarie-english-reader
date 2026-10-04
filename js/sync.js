window.Sync = (function () {
  const LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const BUCKET = 'files';
  let client = null;
  let user = null;
  let lastSync = 0;
  let libPromise = null;
  let syncing = false;
  let autoTimer = null;

  function conf() { return Settings.all().supabase || {}; }
  function isConfigured() { return !!(conf().url && conf().key); }
  function currentUser() { return user; }
  function isSignedIn() { return !!user; }

  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB_URL;
      s.onload = () => resolve();
      s.onerror = () => { libPromise = null; reject(new Error('تعذّر تحميل Supabase (تحقق من الإنترنت)')); };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  async function getClient() {
    if (client) return client;
    if (!isConfigured()) throw new Error('أدخل رابط Supabase والمفتاح في الإعدادات أولاً');
    await loadLib();
    client = window.supabase.createClient(conf().url, conf().key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return client;
  }

  function chip(text, title) {
    const c = document.getElementById('sync-chip');
    if (c) { c.textContent = text; if (title) c.title = title; }
  }
  function status(text) {
    const s = document.getElementById('sb-status');
    if (s) s.textContent = text;
  }

  async function init() {
    const meta = await DB.getMeta('syncMeta', { lastSync: 0 });
    lastSync = meta.lastSync || 0;
    updateChip();
    if (!isConfigured()) return;
    try {
      const c = await getClient();
      const res = await c.auth.getSession();
      if (res && res.data && res.data.session) {
        user = res.data.session.user;
        updateChip();
        status('مسجّل: ' + user.email);
        setTimeout(() => { syncNow(true); }, 2500);
      }
    } catch (e) { console.warn(e); }
  }

  function updateChip() {
    if (user) chip('☁️ ' + (user.email || 'سحابي'), 'متزامن مع Supabase');
    else chip('💾 محلي', 'البيانات على هذا الجهاز');
  }

  async function signIn(email, password) {
    const c = await getClient();
    const res = await c.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw new Error(res.error.message);
    user = res.data.user;
    updateChip();
    status('مسجّل: ' + user.email);
    U.toast('تم تسجيل الدخول ✓', 'ok');
    await syncNow();
    return user;
  }
  async function signUp(email, password) {
    const c = await getClient();
    const res = await c.auth.signUp({ email: email, password: password });
    if (res.error) throw new Error(res.error.message);
    if (res.data.session) {
      user = res.data.session.user;
      updateChip();
      status('مسجّل: ' + user.email);
      await syncNow();
      U.toast('تم إنشاء الحساب وتسجيل الدخول ✓', 'ok');
    } else {
      U.toast('تم إنشاء الحساب — تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول', 'warn');
    }
    return res.data.user;
  }
  async function signOut() {
    try {
      const c = await getClient();
      await c.auth.signOut();
    } catch (e) {}
    user = null;
    updateChip();
    status('غير مسجّل');
    U.toast('تم تسجيل الخروج');
  }

  function wordToRow(w, uid) {
    return {
      id: w.id, user_id: uid, text: w.text, type: w.type, meaning: w.meaning,
      pron: w.pron, ipa: w.ipa, pos: w.pos,
      entries: w.entries || [], examples: w.examples || [], syllables: w.syllables || [], synonyms: w.synonyms || [],
      file_id: w.fileId || null, file_name: w.fileName || null, location: w.location || null, context: w.context || null,
      srs: w.srs || null, status: w.status || null,
      created_at: w.createdAt || Date.now(), updated_at: w.updatedAt || w.createdAt || Date.now()
    };
  }
  function rowToWord(r) {
    return {
      id: r.id, text: r.text, type: r.type, meaning: r.meaning, pron: r.pron, ipa: r.ipa, pos: r.pos,
      entries: r.entries || [], examples: r.examples || [], syllables: r.syllables || [], synonyms: r.synonyms || [],
      fileId: r.file_id, fileName: r.file_name, location: r.location, context: r.context,
      srs: r.srs, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at
    };
  }
  function fileToRow(f, uid) {
    return {
      id: f.id, user_id: uid, name: f.name, ext: f.ext, size: f.size, mime: f.mime,
      last_location: f.lastLocation || null, progress: f.progress || 0,
      ocr: f.ocr || {}, added_at: f.addedAt || Date.now(), updated_at: f.updatedAt || f.addedAt || Date.now(),
      storage_path: f.storagePath || null
    };
  }
  function rowToFile(r, blob) {
    return {
      id: r.id, name: r.name, ext: r.ext, size: r.size, mime: r.mime, blob: blob || null,
      lastLocation: r.last_location, progress: r.progress || 0, ocr: r.ocr || {},
      addedAt: r.added_at, updatedAt: r.updated_at, lastOpened: r.updated_at,
      storagePath: r.storage_path, hasText: !!(r.ocr && Object.keys(r.ocr).length)
    };
  }

  async function pull() {
    const c = await getClient();
    const uid = user.id;
    let changed = false;

    const wordsRes = await c.from('words').select('*').gt('updated_at', lastSync);
    if (wordsRes.error) throw new Error('pull words: ' + wordsRes.error.message);
    for (const row of (wordsRes.data || [])) {
      const local = await DB.get('words', row.id);
      if (!local || (local.updatedAt || 0) < (row.updated_at || 0)) {
        await DB.put('words', rowToWord(row));
        changed = true;
      }
    }

    const filesRes = await c.from('files').select('*').gt('updated_at', lastSync);
    if (filesRes.error) throw new Error('pull files: ' + filesRes.error.message);
    for (const row of (filesRes.data || [])) {
      const local = await DB.get('files', row.id);
      let blob = local && local.blob ? local.blob : null;
      const remoteNewer = !local || (local.updatedAt || 0) < (row.updated_at || 0);
      if (row.storage_path && (!blob || remoteNewer)) {
        try {
          const dl = await c.storage.from(BUCKET).download(row.storage_path);
          if (!dl.error && dl.data) blob = dl.data;
        } catch (e) { console.warn('download', e); }
      }
      if (remoteNewer || !local) {
        const rec = rowToFile(row, blob);
        if (!rec.blob && local) rec.blob = local.blob;
        await DB.put('files', rec);
        changed = true;
      }
    }
    return changed;
  }

  async function push() {
    const c = await getClient();
    const uid = user.id;
    const words = await DB.all('words');
    if (words.length) {
      const rows = words.map((w) => wordToRow(w, uid));
      const res = await c.from('words').upsert(rows, { onConflict: 'id' });
      if (res.error) throw new Error('push words: ' + res.error.message);
    }
    const files = await DB.all('files');
    for (const f of files) {
      if (f.blob && !f.storagePath) {
        const path = uid + '/' + f.id + '.' + (f.ext || 'bin');
        try {
          const up = await c.storage.from(BUCKET).upload(path, f.blob, { upsert: true, contentType: f.mime || 'application/octet-stream' });
          if (!up.error) {
            f.storagePath = path;
            await DB.put('files', f);
          } else if (!/exists/i.test(up.error.message || '')) {
            console.warn('upload', up.error.message);
          } else {
            f.storagePath = path;
            await DB.put('files', f);
          }
        } catch (e) { console.warn(e); }
      }
    }
    const refreshed = await DB.all('files');
    if (refreshed.length) {
      const rows = refreshed.map((f) => fileToRow(f, uid));
      const res = await c.from('files').upsert(rows, { onConflict: 'id' });
      if (res.error) throw new Error('push files: ' + res.error.message);
    }
  }

  async function syncNow(silent) {
    if (!isConfigured()) { if (!silent) U.toast('أدخل بيانات Supabase في الإعدادات أولاً', 'warn'); return; }
    if (syncing) return;
    if (!user) {
      try {
        const c = await getClient();
        const res = await c.auth.getSession();
        if (res && res.data && res.data.session) user = res.data.session.user;
      } catch (e) {}
    }
    if (!user) { if (!silent) U.toast('سجّل الدخول أولاً للمزامنة', 'warn'); return; }
    syncing = true;
    chip('⏳ جارٍ المزامنة…');
    try {
      await pull();
      await push();
      lastSync = Date.now();
      await DB.setMeta('syncMeta', { lastSync: lastSync });
      updateChip();
      status('آخر مزامنة: ' + U.formatDate(lastSync));
      if (!silent) U.toast('تمت المزامنة ✓', 'ok');
      document.dispatchEvent(new CustomEvent('sync:done'));
    } catch (e) {
      console.error(e);
      updateChip();
      if (!silent) U.toast('فشلت المزامنة: ' + (e.message || e), 'error');
    } finally {
      syncing = false;
    }
  }

  function scheduleAutoSync() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { if (user && isConfigured()) syncNow(true); }, 4000);
  }

  document.addEventListener('data:changed', () => { if (user) scheduleAutoSync(); });

  return { init, signIn, signUp, signOut, syncNow, isConfigured, isSignedIn, currentUser, updateChip };
})();
