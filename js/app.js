window.App = (function () {
  const TITLES = {
    library: 'مكتبتي', reader: 'القراءة', dictionary: 'قاموسي',
    study: 'بطاقات المراجعة', quiz: 'اختبارات', stats: 'تقدّمي', settings: 'الإعدادات'
  };
  let currentView = 'library';
  let currentSel = null;
  let lookupToken = 0;
  let installPrompt = null;
  let swReg = null;
  let lastRate = null;

  function speakWithRate(rate) {
    if (!currentSel || !currentSel.text) return;
    if (rate === null || rate === undefined) { TTS.speak(currentSel.text); return; }
    lastRate = rate;
    TTS.speak(currentSel.text, { rate: rate });
  }

  function g(id) { return document.getElementById(id); }

  function parseHash() {
    const h = String(location.hash || '').replace(/^#\/?/, '');
    const name = h.split('/')[0];
    return TITLES[name] ? name : 'library';
  }

  async function showView(name, initial) {
    if (currentView === 'reader' && name !== 'reader' && Viewer.currentFile()) {
      try { await Viewer.saveProgress(); } catch (e) {}
    }
    if (name !== 'reader') hidePopup();
    currentView = name;
    U.qsa('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    U.qsa('[data-nav]').forEach((a) => {
      const nav = a.getAttribute('data-nav');
      a.classList.toggle('active', nav === name || (nav === 'library' && name === 'reader'));
    });
    const title = g('page-title');
    if (title) title.textContent = TITLES[name] || 'قارئي';
    if (name === 'library') Library.render();
    else if (name === 'dictionary') Dictionary.render();
    else if (name === 'stats') Study.renderStats();
    else if (name === 'settings') Settings.renderUI();
    else if (name === 'study') Study.updateChips();
    else if (name === 'reader') {
      const empty = g('reader-empty');
      if (empty) empty.classList.toggle('hidden', !!Viewer.currentFile());
      if (initial && !Viewer.currentFile()) { /* nothing */ }
    }
    updateContinue();
    window.scrollTo({ top: 0 });
  }

  async function updateContinue() {
    const btn = g('continue-btn');
    if (!btn) return;
    if (currentView === 'reader') { btn.classList.add('hidden'); return; }
    try {
      const files = await DB.all('files');
      const last = files.filter((f) => f.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened)[0];
      if (last) {
        btn.classList.remove('hidden');
        btn.textContent = '📖 متابعة: ' + last.name.slice(0, 22);
        btn.onclick = () => openFile(last.id);
      } else {
        btn.classList.add('hidden');
      }
    } catch (e) { btn.classList.add('hidden'); }
  }

  async function openFile(id, loc) {
    const file = await DB.get('files', id);
    if (!file) { U.toast('الملف غير موجود', 'error'); return; }
    hidePopup();
    if (location.hash !== '#/reader') location.hash = '#/reader';
    await showView('reader');
    const target = loc || file.lastLocation || null;
    await Viewer.open(file, { loc: target });
  }

  function initRouter() {
    window.addEventListener('hashchange', () => { showView(parseHash()); });
  }

  function initNav() {
    const menu = g('menu-btn');
    if (menu) menu.addEventListener('click', () => document.body.classList.toggle('sidebar-expanded'));
    const theme = g('theme-btn');
    if (theme) theme.addEventListener('click', async () => {
      const s = Settings.all();
      const cur = s.theme === 'auto' ? (document.documentElement.dataset.theme || 'light') : s.theme;
      await Settings.save({ theme: cur === 'dark' ? 'light' : 'dark' });
      Settings.applyTheme();
    });
  }

  function initPopup() {
    const pop = g('sel-popup');
    if (!pop) return;
    document.addEventListener('app:selection', (e) => showPopup(e.detail));
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    const close = g('pop-close');
    if (close) close.addEventListener('click', hidePopup);
    const copy = g('pop-copy');
    if (copy) copy.addEventListener('click', async () => {
      if (!currentSel) return;
      try { await navigator.clipboard.writeText(currentSel.text); U.toast('تم النسخ'); } catch (e) { U.toast('تعذّر النسخ', 'warn'); }
    });
    const play = g('pop-play');
    if (play) play.addEventListener('click', () => { if (currentSel) speakWithRate(null); });
    U.qsa('.chip-btn[data-rate]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!currentSel) return;
        U.qsa('.chip-btn[data-rate]').forEach((x) => x.classList.toggle('active', x === b));
        speakWithRate(parseFloat(b.dataset.rate));
      });
    });
    const repeat = g('pop-repeat');
    if (repeat) repeat.addEventListener('click', () => { if (currentSel) speakWithRate(lastRate); });
    const slow = g('pop-slow');
    if (slow) slow.addEventListener('click', () => { if (currentSel) TTS.speakSlow(currentSel.text); });
    const syl = g('pop-syl');
    if (syl) syl.addEventListener('click', () => { if (currentSel) TTS.speakSyllables(currentSel.text); });
    const save = g('pop-save');
    if (save) save.addEventListener('click', toggleSave);
    document.addEventListener('pointerdown', (e) => {
      const p = g('sel-popup');
      if (!p || p.classList.contains('hidden')) return;
      if (e.target.closest && e.target.closest('#sel-popup')) return;
      if (e.target.closest && e.target.closest('.viewer-container')) return;
      hidePopup();
    }, true);
  }

  function positionPopup(rect) {
    const pop = g('sel-popup');
    if (!pop || !rect) return;
    if (U.isMobile()) { pop.style.top = ''; pop.style.left = ''; return; }
    const w = pop.offsetWidth || 370;
    const h = pop.offsetHeight || 320;
    const margin = 12;
    let top = rect.bottom + 10;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, rect.top - h - 10);
    let left = rect.left + (rect.width || 0) / 2 - w / 2;
    left = U.clamp(left, margin, window.innerWidth - w - margin);
    pop.style.top = Math.round(top) + 'px';
    pop.style.left = Math.round(left) + 'px';
  }

  async function showPopup(detail) {
    if (!detail || !detail.text) return;
    const pop = g('sel-popup');
    if (!pop) return;
    const text = detail.text.trim();
    if (!text) return;
    pop.classList.remove('hidden');
    g('pop-text').textContent = text;
    const kind = U.classify(text);
    const typeEl = g('pop-type');
    if (typeEl) typeEl.textContent = kind === 'word' ? 'كلمة' : (kind === 'sentence' ? 'جملة' : 'فقرة');
    const src = g('pop-source');
    if (src) src.textContent = '';
    const body = g('pop-body');
    body.innerHTML = '<div class="skeleton"></div><div class="skeleton" style="margin-top:8px;height:32px"></div>';
    const token = ++lookupToken;
    let context = '';
    try {
      const cf = Viewer.currentFile();
      if (cf && cf.id === detail.fileId) context = Viewer.getContext(text);
    } catch (e) {}
    try {
      const res = await AI.lookup(text, context);
      if (token !== lookupToken) return;
      res.fileId = detail.fileId;
      res.location = detail.location;
      res.fileName = detail.fileName;
      currentSel = res;
      renderPopup(res);
      positionPopup(detail.rect);
      updateSaveState();
      if (Settings.all().autoSpeak) TTS.speak(text);
    } catch (e) {
      if (token !== lookupToken) return;
      body.innerHTML = '<p class="muted small">تعذّر جلب الشرح. تحقق من الاتصال بالإنترنت، أو أضف مفتاح AI من الإعدادات لنتائج أفضل.</p>';
      currentSel = { text: text, type: kind, meaning: '', fileId: detail.fileId, location: detail.location, fileName: detail.fileName };
      updateSaveState();
      positionPopup(detail.rect);
    }
  }

  function renderPopup(res) {
    const body = g('pop-body');
    const src = g('pop-source');
    const sourceLabels = { ai: '🤖 من الذكاء الاصطناعي', free: '🌐 ترجمة مجانية', mini: '📗 قاموس محلي' };
    if (src) src.textContent = sourceLabels[res.source] || '';
    const parts = [];
    parts.push('<div class="pop-meaning">' + U.esc(res.meaning || '—') + '</div>');
    if (res.pron) {
      parts.push('<div class="pop-pron"><span class="muted small">النطق:</span> <span class="pron">' + U.esc(res.pron) + '</span>' +
        (res.ipa ? ' <span class="muted tiny">/ ' + U.esc(res.ipa) + ' /</span>' : '') + '</div>');
    }
    if (res.syllables && res.syllables.length) {
      parts.push('<div class="muted tiny" style="direction:ltr;text-align:left">' + res.syllables.map(U.esc).join(' - ') + '</div>');
    }
    if (res.entries && res.entries.length) {
      parts.push('<ul class="entries">' + res.entries.slice(0, 4).map((e) =>
        '<li>' + (e.pos ? '<span class="chip tiny alt">' + U.esc(e.pos) + '</span> ' : '') + U.esc(e.meaning) + '</li>'
      ).join('') + '</ul>');
    }
    if (res.examples && res.examples[0]) {
      const ex = res.examples[0];
      parts.push('<div class="pop-ex"><div class="en">' + U.esc(ex.en) + '</div>' +
        (ex.ar ? '<div class="ar">' + U.esc(ex.ar) + '</div>' : '') + '</div>');
    }
    if (res.synonyms && res.synonyms.length) {
      parts.push('<div class="muted small">مرادفات: ' + U.esc(res.synonyms.slice(0, 6).join('، ')) + '</div>');
    }
    if (res.fileName) {
      parts.push('<div class="muted tiny">📄 ' + U.esc(res.fileName) + (res.location && res.location.page ? ' — صفحة ' + res.location.page : '') + '</div>');
    }
    body.innerHTML = parts.join('');
  }

  async function updateSaveState() {
    const btn = g('pop-save');
    if (!btn || !currentSel) return;
    const words = await DB.all('words');
    const exists = words.some((w) => w.type === currentSel.type && String(w.text).toLowerCase() === String(currentSel.text).toLowerCase());
    btn.textContent = exists ? '✓ محفوظة' : '⭐ حفظ';
    btn.classList.toggle('primary', !exists);
  }

  async function toggleSave() {
    if (!currentSel || !currentSel.text) return;
    const text = currentSel.text;
    const words = await DB.all('words');
    const existing = words.find((w) => w.type === currentSel.type && String(w.text).toLowerCase() === text.toLowerCase());
    if (existing) {
      const ok = await U.confirmBox('إزالة', 'إزالة «' + text + '» من قاموسي؟', 'إزالة');
      if (!ok) return;
      await DB.del('words', existing.id);
      U.toast('أُزيلت من قاموسي');
      DB.changed();
      await updateSaveState();
      Viewer.applyHighlights();
      return;
    }
    const rec = {
      id: U.uid(),
      text: text,
      type: currentSel.type || U.classify(text),
      meaning: currentSel.meaning || '',
      pron: currentSel.pron || '',
      ipa: currentSel.ipa || '',
      pos: currentSel.pos || '',
      entries: currentSel.entries || [],
      examples: currentSel.examples || [],
      syllables: currentSel.syllables || U.syllables(text),
      synonyms: currentSel.synonyms || [],
      fileId: currentSel.fileId || null,
      fileName: currentSel.fileName || '',
      location: currentSel.location || null,
      context: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      srs: { ease: 2.5, interval: 0, reps: 0, due: Date.now() },
      status: 'new'
    };
    try {
      const cf = Viewer.currentFile();
      if (cf && cf.id === rec.fileId) rec.context = Viewer.getContext(text);
    } catch (e) {}
    if ((!rec.examples || !rec.examples.length) && rec.context && rec.context.length > text.length) {
      rec.examples = [{ en: rec.context.slice(0, 220).trim(), ar: '' }];
    }
    await DB.put('words', rec);
    await Study.markActivity('word', 1);
    DB.changed();
    U.toast('حُفظت في قاموسي ⭐', 'ok');
    await updateSaveState();
    Viewer.applyHighlights();
  }

  function hidePopup() {
    const pop = g('sel-popup');
    if (pop) pop.classList.add('hidden');
    currentSel = null;
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest('#sel-popup')) sel.removeAllRanges();
    } catch (e) {}
  }

  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      const t = e.target || {};
      const tag = String(t.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
      if (e.key === 'Escape') {
        if (!g('sel-popup') || g('sel-popup').classList.contains('hidden')) return;
        e.preventDefault();
        hidePopup();
        return;
      }
      if (inField) return;
      if ((e.code === 'Space' || e.key === ' ') && currentSel) {
        e.preventDefault();
        TTS.speak(currentSel.text);
        return;
      }
      if ((e.key === 's' || e.key === 'S' || e.key === 'س') && currentSel) {
        e.preventDefault();
        toggleSave();
        return;
      }
      if (currentView === 'reader') {
        if (e.key === 'ArrowLeft' || e.key === 'PageDown') { e.preventDefault(); Viewer.nextPage(); }
        else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); Viewer.prevPage(); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); Viewer.zoomBy(0.15); }
        else if (e.key === '-') { e.preventDefault(); Viewer.zoomBy(-0.15); }
      } else if (currentView === 'study') {
        if (e.key === 'f' || e.key === 'F') Study.flip();
        else if (e.key === '1') Study.rateCurrent(1);
        else if (e.key === '2') Study.rateCurrent(2);
        else if (e.key === '3') Study.rateCurrent(3);
      }
    });
  }

  function jumpToPageFromInput() {
    const input = g('rt-jump');
    if (!input) return;
    const n = parseInt(input.value, 10);
    if (n) Viewer.goToPage(n);
    input.value = '';
    input.blur();
  }

  function initReaderToolbar() {
    const bind = (id, fn) => { const n = g(id); if (n) n.addEventListener('click', fn); };
    bind('rt-back', async () => { await Viewer.saveProgress(); location.hash = '#/library'; });
    bind('rt-prev', () => Viewer.prevPage());
    bind('rt-next', () => Viewer.nextPage());
    bind('rt-zoom-in', () => Viewer.zoomBy(0.15));
    bind('rt-zoom-out', () => Viewer.zoomBy(-0.15));
    bind('rt-ocr', () => Viewer.runOcr());
    bind('rt-highlight', () => Viewer.toggleHighlights());
    bind('rt-go', jumpToPageFromInput);
    const jump = g('rt-jump');
    if (jump) {
      jump.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); jumpToPageFromInput(); }
      });
    }
  }

  function initSettingsButtons() {
    const bind = (id, fn) => { const n = g(id); if (n) n.addEventListener('click', fn); };
    bind('btn-sb-signin', async () => {
      const email = (g('sb-email').value || '').trim();
      const pass = g('sb-pass').value || '';
      if (!email || !pass) { U.toast('أدخل البريد وكلمة المرور', 'warn'); return; }
      try {
        await Settings.save({ supabase: { url: g('set-sb-url').value.trim(), key: g('set-sb-key').value.trim() } });
        await Sync.signIn(email, pass);
      } catch (e) { U.toast('فشل الدخول: ' + (e.message || e), 'error'); }
    });
    bind('btn-sb-signup', async () => {
      const email = (g('sb-email').value || '').trim();
      const pass = g('sb-pass').value || '';
      if (!email || !pass) { U.toast('أدخل البريد وكلمة المرور', 'warn'); return; }
      try {
        await Settings.save({ supabase: { url: g('set-sb-url').value.trim(), key: g('set-sb-key').value.trim() } });
        await Sync.signUp(email, pass);
      } catch (e) { U.toast('فشل الإنشاء: ' + (e.message || e), 'error'); }
    });
    bind('btn-sb-signout', () => Sync.signOut());
    bind('btn-sync-now', () => Sync.syncNow());
    bind('btn-sw-update', async () => {
      if (swReg) {
        try { await swReg.update(); } catch (e) {}
        U.toast('تم تحديث الملفات المخزّنة — أعد تحميل الصفحة', 'ok');
      } else {
        U.toast('التحديث غير متاح الآن', 'warn');
      }
    });
    const install = g('btn-install');
    if (install) install.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const res = await installPrompt.userChoice;
      if (res && res.outcome === 'accepted') U.toast('تم التثبيت 🎉', 'ok');
      installPrompt = null;
      install.disabled = true;
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      if (install) install.disabled = false;
    });
    window.addEventListener('appinstalled', () => {
      U.toast('تم تثبيت قارئي على جهازك 🎉', 'ok');
      if (install) install.disabled = true;
    });
  }

  function initOnlineChip() {
    const chip = g('online-chip');
    const update = () => {
      if (!chip) return;
      const on = navigator.onLine;
      chip.textContent = on ? '🌐 متصل' : '✈️ بدون إنترنت';
      chip.style.opacity = on ? '1' : '0.75';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      reg.addEventListener('updatefound', () => {});
    }).catch((e) => console.warn('SW', e));
  }

  async function init() {
    await Settings.load();
    Settings.applyTheme();
    document.documentElement.style.setProperty('--reader-scale', String((Settings.all().readerFontSize || 100) / 100));
    Settings.initUI();
    Library.init();
    Dictionary.init();
    Study.init();
    Backup.init();
    initPopup();
    initRouter();
    initNav();
    initShortcuts();
    initReaderToolbar();
    initSettingsButtons();
    initOnlineChip();
    TTS.init();
    registerSW();
    await showView(parseHash(), true);
    await Study.updateChips();
    Sync.init();
    if ('matchMedia' in window) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (Settings.all().theme === 'auto') Settings.applyTheme();
      });
    }
    document.addEventListener('sync:done', () => { showView(currentView); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Study.updateChips();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  window.addEventListener('beforeunload', () => {
    try { Viewer.saveProgress(); } catch (e) {}
  });

  return { init, openFile, showView, toggleSave, hidePopup, get currentView() { return currentView; } };
})();
