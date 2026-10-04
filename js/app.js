window.App = (function () {
  const TITLES = {
    library: 'مكتبتي', reader: 'القارئ', dictionary: 'قاموسي',
    study: 'بطاقات المراجعة', quiz: 'اختبارات', stats: 'تقدّمي', settings: 'الإعدادات'
  };
  let currentView = 'library';
  let currentSel = null;
  let lookupToken = 0;
  let analysisTimer = null;
  let lookupCtrl = null;
  let lastRect = null;
  let installPrompt = null;
  let swReg = null;
  let lastRate = 0.75;
  let autoOpening = false;

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
      a.classList.toggle('active', nav === name);
    });
    const title = g('page-title');
    if (title) title.textContent = TITLES[name] || 'قارئي';
    if (name === 'library') Library.render();
    else if (name === 'dictionary') Dictionary.render();
    else if (name === 'stats') Study.renderStats();
    else if (name === 'settings') Settings.renderUI();
    else if (name === 'study') Study.updateChips();
    else if (name === 'reader') {
      if (!Viewer.currentFile() && !autoOpening) {
        try {
          const files = await DB.all('files');
          const last = files.filter((f) => f.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened)[0] ||
            files.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
          if (last) {
            autoOpening = true;
            try { await openFile(last.id); } finally { autoOpening = false; }
            return;
          }
        } catch (e) {}
      }
      const empty = g('reader-empty');
      if (empty) empty.classList.toggle('hidden', !!Viewer.currentFile());
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
        btn.textContent = '📖 متابعة: ' + last.name.slice(0, 20);
        btn.onclick = () => openFile(last.id);
      } else {
        btn.classList.add('hidden');
      }
    } catch (e) { btn.classList.add('hidden'); }
  }

  async function openFile(id, loc) {
    const file = await DB.get('files', id);
    if (!file) { U.toast('الملف غير موجود — قد يكون محذوفاً', 'error'); return; }
    autoOpening = true;
    try {
      hidePopup();
      if (location.hash !== '#/reader') location.hash = '#/reader';
      await showView('reader');
      const target = loc || file.lastLocation || null;
      await Viewer.open(file, { loc: target });
    } finally {
      autoOpening = false;
    }
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
      await Settings.save({ theme: s.theme === 'dark' ? 'light' : 'dark' });
      Settings.applyTheme();
    });
    const topSettings = g('topbar-settings');
    if (topSettings) topSettings.addEventListener('click', () => { location.hash = '#/settings'; });
    const helpFab = g('help-fab');
    if (helpFab) helpFab.addEventListener('click', showHelp);
    const btnHelp = g('btn-help');
    if (btnHelp) btnHelp.addEventListener('click', showHelp);
    const heroHelp = g('hero-help');
    if (heroHelp) heroHelp.addEventListener('click', showHelp);
  }

  function showHelp() {
    U.modal({
      title: '❓ كيف تستخدم قارئي؟',
      html: '' +
        '<div class="help-steps">' +
        '<div class="help-step"><span class="step-num">1</span><div><strong>ارفع ملفك</strong><br><span class="muted small">من «مكتبتي» اضغط «ارفع ملفك» واختر PDF أو Word أو TXT أو EPUB.</span></div></div>' +
        '<div class="help-step"><span class="step-num">2</span><div><strong>حدّد كلمة أو جملة</strong><br><span class="muted small">على الموبايل: اضغط مطولاً ثم اسحب. على الكمبيوتر: انقر مرتين للكلمة أو اسحب للجملة. ستظهر نافذة المعنى والنطق.</span></div></div>' +
        '<div class="help-step"><span class="step-num">3</span><div><strong>استمع واحفظ ⭐</strong><br><span class="muted small">اضغط «استماع» لتسمع النطق، ثم «حفظ» لتجدها في قاموسي وتراجعها بالبطاقات.</span></div></div>' +
        '</div>' +
        '<div class="help-faq">' +
        '<details><summary>لا يظهر معنى الكلمة</summary><p>بدون مفتاح AI تظهر ترجمة مجانية للكلمات الشائعة. لجودة أفضل: الإعدادات ← الذكاء الاصطناعي ← أضف مفتاحاً (Gemini Flash أو GPT mini).</p></details>' +
        '<details><summary>الملف عبارة عن صور</summary><p>إذا كان الملف نسخة ممسوحة ضوئياً (صور بلا نص) فلا يمكن تحديد كلمات منه. استخدم نسخة PDF نصية.</p></details>' +
        '<details><summary>كيف أزامن بين أجهزتي؟</summary><p>الإعدادات ← المزامنة السحابية: أضف بيانات Supabase ثم سجّل الدخول، وستتزامن كلماتك وتقدمك تلقائياً.</p></details>' +
        '<details><summary>كيف أصدّر كلماتي؟</summary><p>من «قاموسي»: زر «تصدير CSV» أو «تصدير Anki». ولنسخة كاملة: الإعدادات ← البيانات ← تصدير كل بياناتي.</p></details>' +
        '<details><summary>الصوت لا يعمل</summary><p>اضغط زر «استماع» مباشرة (المتصفح يحتاج لمسة من المستخدم). على الآيفون تأكد أن وضع الصامت غير مفعّل. يمكنك أيضاً إضافة صوت عالي الجودة من الإعدادات.</p></details>' +
        '</div>',
      actions: [{ label: 'فهمت، لنبدأ 👌', value: true, primary: true }]
    });
  }

  async function maybeShowTour() {
    try {
      const seen = await DB.getMeta('tourSeen', false);
      if (!seen) {
        await DB.setMeta('tourSeen', true);
        setTimeout(showHelp, 700);
      }
    } catch (e) {}
  }

  function initPopup() {
    const pop = g('sel-popup');
    if (!pop) return;
    document.addEventListener('app:selection', (e) => onSelection(e.detail));
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    const close = g('pop-close');
    if (close) close.addEventListener('click', hidePopup);
    const copy = g('pop-copy');
    if (copy) copy.addEventListener('click', async () => {
      if (!currentSel) return;
      try { await navigator.clipboard.writeText(currentSel.text); U.toast('تم نسخ النص'); }
      catch (e) { U.toast('تعذّر النسخ — انسخه يدوياً', 'warn'); }
    });
    const play = g('pop-play');
    if (play) play.addEventListener('click', () => { playCurrent(lastRate); });
    const stop = g('pop-stop');
    if (stop) stop.addEventListener('click', () => TTS.stop());
    const repeat = g('pop-repeat');
    if (repeat) repeat.addEventListener('click', () => { if (TTS.isSpeaking()) TTS.stop(); else TTS.repeat() || playCurrent(lastRate); });
    const syl = g('pop-syl');
    if (syl) syl.addEventListener('click', () => { if (currentSel) TTS.speakSyllables(currentSel.text); });
    const spell = g('pop-spell');
    if (spell) spell.addEventListener('click', () => { if (currentSel) TTS.speakSpelling(currentSel.text); });
    const save = g('pop-save');
    if (save) save.addEventListener('click', toggleSave);
    const vol = g('pop-volume');
    if (vol) vol.addEventListener('input', () => {
      const v = parseInt(vol.value, 10) || 0;
      Settings.save({ volume: v });
      const sv = g('set-volume');
      if (sv) sv.value = String(v);
      const vl = g('vol-label');
      if (vl) vl.textContent = v + '%';
    });
    U.qsa('.chip-btn[data-rate]').forEach((b) => {
      b.addEventListener('click', () => {
        U.qsa('.chip-btn[data-rate]').forEach((x) => x.classList.toggle('active', x === b));
        lastRate = parseFloat(b.dataset.rate);
        playCurrent(lastRate);
      });
    });
    document.addEventListener('pointerdown', (e) => {
      const p = g('sel-popup');
      if (!p || p.classList.contains('hidden')) return;
      if (e.target.closest && e.target.closest('#sel-popup')) return;
      if (e.target.closest && e.target.closest('.viewer-container')) return;
      hidePopup();
    }, true);
    TTS.onState((state) => {
      const playBtn = g('pop-play');
      const stopBtn = g('pop-stop');
      if (!playBtn || !stopBtn) return;
      const speaking = state === 'speaking';
      playBtn.classList.toggle('hidden', speaking);
      stopBtn.classList.toggle('hidden', !speaking);
      if (!speaking) highlightLine(-1);
    });
  }

  function positionPopup(rect) {
    const pop = g('sel-popup');
    if (!pop || !rect) return;
    if (U.isMobile()) { pop.style.top = ''; pop.style.left = ''; return; }
    const w = pop.offsetWidth || 370;
    const h = pop.offsetHeight || 320;
    const margin = 12;
    let top = rect.bottom + 10;
    if (top + h > window.innerHeight - margin) top = rect.top - h - 10;
    top = U.clamp(top, margin, Math.max(margin, window.innerHeight - h - margin));
    let left = rect.left + (rect.width || 0) / 2 - w / 2;
    left = U.clamp(left, margin, Math.max(margin, window.innerWidth - w - margin));
    pop.style.top = Math.round(top) + 'px';
    pop.style.left = Math.round(left) + 'px';
  }

  function onSelection(detail) {
    if (!detail || !detail.text) return;
    const text = String(detail.text).trim();
    if (!text) return;
    lastRect = detail.rect;
    const kind = U.classify(text);
    const pop = g('sel-popup');
    if (!pop) return;
    pop.classList.remove('hidden');
    g('pop-text').textContent = text;
    const typeEl = g('pop-type');
    if (typeEl) typeEl.textContent = kind === 'word' ? 'كلمة / عبارة' : (kind === 'sentence' ? 'جملة' : 'فقرة');
    const src = g('pop-source');
    if (src) src.textContent = '';
    const body = g('pop-body');
    body.innerHTML = '<div class="loading-inline">جارٍ جلب المعنى…</div>';
    hideLines();
    currentSel = {
      text: text, type: kind, meaning: '', pron: '', pos: '', ipa: '',
      entries: [], examples: [], synonyms: [], syllables: [],
      fileId: detail.fileId, location: detail.location, fileName: detail.fileName
    };
    updateSaveState();
    positionPopup(detail.rect);
    const token = ++lookupToken;
    clearTimeout(analysisTimer);
    if (lookupCtrl) { try { lookupCtrl.abort(); } catch (e) {} lookupCtrl = null; }
    TTS.stop();
    analysisTimer = setTimeout(() => analyze(token, detail, kind), 300);
  }

  async function analyze(token, detail, kind) {
    if (token !== lookupToken) return;
    const ctrl = new AbortController();
    lookupCtrl = ctrl;
    let context = '';
    try {
      const cf = Viewer.currentFile();
      if (cf && cf.id === detail.fileId) context = Viewer.getContext(detail.text);
    } catch (e) {}
    try {
      const res = await AI.lookup(detail.text, context, { signal: ctrl.signal });
      if (token !== lookupToken) return;
      res.fileId = detail.fileId;
      res.location = detail.location;
      res.fileName = detail.fileName;
      currentSel = res;
      renderPopup(res);
      positionPopup(lastRect);
      updateSaveState();
      if (Settings.all().autoSpeak && res.type === 'word') playCurrent(lastRate);
    } catch (e) {
      if (token !== lookupToken) return;
      if (/abort/i.test((e && e.name) || '')) return;
      renderLookupError(e);
      positionPopup(lastRect);
      updateSaveState();
    } finally {
      if (lookupCtrl === ctrl) lookupCtrl = null;
    }
  }

  function renderLookupError(e) {
    const body = g('pop-body');
    const msg = (e && e.message) || 'تعذّر جلب الشرح';
    body.innerHTML =
      '<div class="error-box">⚠️ ' + U.esc(msg) +
      '<div class="fix">الحل: تحقّق من الاتصال بالإنترنت، أو افتح الإعدادات ← الذكاء الاصطناعي وأدخل مفتاحاً صحيحاً. الكلمات الشائعة تعمل حتى بدون مفتاح.</div></div>';
  }

  function renderPopup(res) {
    const body = g('pop-body');
    const src = g('pop-source');
    const labels = { ai: '🤖 ذكاء اصطناعي', free: '🌐 ترجمة مجانية', mini: '📗 قاموس محلي' };
    if (src) src.textContent = labels[res.source] || '';
    const parts = [];
    const isWord = res.type === 'word';
    parts.push('<div class="pop-meaning">' + U.esc(res.meaning || '—') + '</div>');
    const bits = [];
    if (res.pos) bits.push('<span class="chip tiny">' + U.esc(res.pos) + '</span>');
    if (res.pron) bits.push('<span class="pop-pron"><span class="muted small">النطق:</span> <span class="pron">' + U.esc(res.pron) + '</span></span>');
    if (bits.length) parts.push('<div class="row wrap gap" style="margin-top:6px">' + bits.join('') + '</div>');
    if (res.entries && res.entries.length) {
      parts.push('<ul class="entries">' + res.entries.slice(0, 3).map((en) =>
        '<li>' + (en.pos ? '<span class="chip tiny alt">' + U.esc(en.pos) + '</span> ' : '') + U.esc(en.meaning) + '</li>'
      ).join('') + '</ul>');
    }
    if (res.examples && res.examples[0] && res.examples[0].en) {
      const ex = res.examples[0];
      parts.push('<div class="pop-ex"><div class="en">' + U.esc(ex.en) + '</div>' +
        (ex.ar ? '<div class="ar">' + U.esc(ex.ar) + '</div>' : '') + '</div>');
    }
    if (res.synonyms && res.synonyms.length) {
      parts.push('<div class="muted small">مرادفات: ' + U.esc(res.synonyms.slice(0, 6).join('، ')) + '</div>');
    }
    if (!isWord && !res.pron) {
      parts.push('<div class="pron-request"><button class="btn small" id="pop-pron-req">✍️ اكتب النطق</button></div>');
    }
    if (res.note) parts.push('<div class="muted tiny">ملاحظة: ' + U.esc(res.note) + '</div>');
    if (res.fileName) {
      parts.push('<div class="muted tiny">📄 ' + U.esc(res.fileName) + (res.location && res.location.page ? ' — صفحة ' + res.location.page : '') + '</div>');
    }
    body.innerHTML = parts.join('');
    const pronBtn = g('pop-pron-req');
    if (pronBtn) pronBtn.addEventListener('click', requestPron);
    if (!isWord) prepareLines(res.text);
  }

  async function requestPron() {
    const btn = g('pop-pron-req');
    if (!btn || !currentSel) return;
    btn.disabled = true;
    btn.textContent = '⏳ جارٍ كتابة النطق…';
    try {
      const pron = await AI.pronounce(currentSel.text);
      currentSel.pron = pron;
      const holder = btn.parentNode;
      holder.outerHTML = '<div class="pop-pron" style="margin-top:6px"><span class="muted small">النطق:</span> <span class="pron">' + U.esc(pron) + '</span></div>';
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✍️ حاول مرة أخرى';
      U.toast('تعذّر كتابة النطق — تحقق من الإنترنت', 'warn');
    }
  }

  function prepareLines(text) {
    const lines = U.splitSentences(text);
    const wrap = g('pop-lines');
    if (!wrap || lines.length < 2) { if (wrap) wrap.classList.add('hidden'); return; }
    wrap.innerHTML = lines.map((l, i) => '<div class="speak-line" data-i="' + i + '">' + U.esc(l) + '</div>').join('');
    wrap.classList.remove('hidden');
    U.qsa('.speak-line', wrap).forEach((el) => {
      el.addEventListener('click', () => { TTS.speak(el.textContent); });
    });
  }

  function highlightLine(i) {
    const wrap = g('pop-lines');
    if (!wrap || wrap.classList.contains('hidden')) return;
    U.qsa('.speak-line', wrap).forEach((el, idx) => el.classList.toggle('active', idx === i));
    if (i >= 0) {
      const el = U.qs('.speak-line[data-i="' + i + '"]', wrap);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }

  function hideLines() {
    const wrap = g('pop-lines');
    if (wrap) { wrap.classList.add('hidden'); wrap.innerHTML = ''; }
  }

  function playCurrent(rate) {
    if (!currentSel || !currentSel.text) return;
    const r = U.clamp(rate || lastRate || 0.75, 0.1, 2);
    const text = currentSel.text;
    const lines = U.splitSentences(text);
    if (lines.length > 1) {
      if (!g('pop-lines') || g('pop-lines').classList.contains('hidden')) prepareLines(text);
      if (TTS.isSpeaking()) TTS.stop();
      TTS.speakText(text, { rate: r, onLine: highlightLine });
    } else {
      TTS.speak(text, { rate: r });
    }
  }

  async function updateSaveState() {
    const btn = g('pop-save');
    if (!btn || !currentSel) return;
    const words = await DB.all('words');
    const exists = words.some((w) => w.type === currentSel.type && String(w.text).toLowerCase() === String(currentSel.text).toLowerCase());
    btn.textContent = exists ? '✅ محفوظة' : '⭐ حفظ';
    btn.classList.toggle('primary', !exists);
  }

  async function toggleSave() {
    if (!currentSel || !currentSel.text) return;
    const text = currentSel.text;
    const words = await DB.all('words');
    const existing = words.find((w) => w.type === currentSel.type && String(w.text).toLowerCase() === text.toLowerCase());
    if (existing) {
      const ok = await U.confirmBox('إزالة من قاموسي', 'هل تريد إزالة «' + text + '» من قاموسي؟', 'إزالة');
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
    clearTimeout(analysisTimer);
    if (lookupCtrl) { try { lookupCtrl.abort(); } catch (e) {} lookupCtrl = null; }
    lookupToken++;
    TTS.stop();
    currentSel = null;
    hideLines();
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
        if (TTS.isSpeaking()) TTS.stop(); else playCurrent(lastRate);
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
      if (!email || !pass) { U.toast('أدخل البريد الإلكتروني وكلمة المرور', 'warn'); return; }
      try {
        await Settings.save({ supabase: { url: g('set-sb-url').value.trim(), key: g('set-sb-key').value.trim() } });
        await Sync.signIn(email, pass);
      } catch (e) { U.toast('فشل الدخول: ' + (e.message || e) + ' — تحقق من البيانات', 'error'); }
    });
    bind('btn-sb-signup', async () => {
      const email = (g('sb-email').value || '').trim();
      const pass = g('sb-pass').value || '';
      if (!email || !pass) { U.toast('أدخل البريد الإلكتروني وكلمة المرور', 'warn'); return; }
      try {
        await Settings.save({ supabase: { url: g('set-sb-url').value.trim(), key: g('set-sb-key').value.trim() } });
        await Sync.signUp(email, pass);
      } catch (e) { U.toast('فشل إنشاء الحساب: ' + (e.message || e), 'error'); }
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
      if (!installPrompt) { U.toast('التثبيت غير متاح في هذا المتصفح — استخدم قائمة المتصفح: إضافة إلى الشاشة الرئيسية', 'warn'); return; }
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
    maybeShowTour();
    document.addEventListener('sync:done', () => { showView(currentView); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Study.updateChips();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  window.addEventListener('beforeunload', () => {
    try { Viewer.saveProgress(); } catch (e) {}
  });

  return { init, openFile, showView, toggleSave, hidePopup, showHelp, get currentView() { return currentView; } };
})();
