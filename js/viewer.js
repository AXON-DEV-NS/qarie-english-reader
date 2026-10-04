window.Viewer = (function () {
  const PDF_VERSION = '3.11.174';
  const PDF_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDF_VERSION + '/';
  const WORKER_SRC = PDF_BASE + 'build/pdf.worker.min.js';
  const CMAP_URL = PDF_BASE + 'cmaps/';
  const STANDARD_FONTS_URL = PDF_BASE + 'standard_fonts/';
  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  const PAGE_GAP = 14;

  const st = {
    file: null,
    ext: '',
    container: null,
    pdf: null,
    numPages: 0,
    pdfZoom: 1,
    pdfFit: 1,
    pdfScale: 1,
    pdfBase: { w: 612, h: 792 },
    pdfPages: [],
    pdfPagesEl: null,
    pdfObserver: null,
    pdfCurrent: 1,
    book: null,
    rendition: null,
    epubLoc: null,
    img: null,
    imgNat: null,
    objectUrl: null,
    canvas: null,
    textLayer: null,
    hlEnabled: true
  };

  function g(id) { return document.getElementById(id); }
  function scrollEl() { return g('reader-scroll'); }
  function pdfQuality() { return U.clamp(Math.max(window.devicePixelRatio || 1, 2), 2, 3); }

  function setProgress(pct, show) {
    const wrap = g('reader-progress');
    const bar = g('reader-progress-bar');
    if (!wrap || !bar) return;
    if (show && pct !== undefined && pct !== null) {
      wrap.classList.remove('hidden');
      bar.style.width = Math.round(U.clamp(pct, 0, 100)) + '%';
    } else if (show === false) {
      wrap.classList.add('hidden');
    }
  }
  function showHint(html) {
    const h = g('reader-hint');
    if (!h) return;
    if (!html) { h.classList.add('hidden'); h.innerHTML = ''; return; }
    h.innerHTML = html;
    h.classList.remove('hidden');
  }
  function parseExt(name) { return U.extOf(name); }
  function isImageExt(e) { return IMAGE_EXT.indexOf(e) >= 0; }

  function ensurePdfJs() {
    if (!window.pdfjsLib) return false;
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      if (window.pdfjsLib.version && window.pdfjsLib.version !== PDF_VERSION) {
        console.warn('pdf.js version mismatch', window.pdfjsLib.version, PDF_VERSION);
      }
    } catch (e) {}
    return true;
  }

  async function blobToArrayBuffer(blob) {
    if (blob instanceof ArrayBuffer) return blob;
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return U.readAsArrayBuffer(blob);
  }

  async function open(file, opts) {
    const o = opts || {};
    await close(true);
    st.file = file;
    st.ext = file.ext || parseExt(file.name);
    st.pdfZoom = 1;
    st.numPages = 0;
    st.pdfCurrent = 1;
    st.pdfPages = [];
    st.epubLoc = null;
    st.imgNat = null;
    const container = g('viewer-container');
    container.innerHTML = '';
    container.classList.toggle('pdf-mode', st.ext === 'pdf');
    container.setAttribute('dir', 'ltr');
    st.container = container;
    const empty = g('reader-empty');
    if (empty) empty.classList.add('hidden');
    const scroll = scrollEl();
    scroll.scrollTop = 0;
    const title = g('reader-title');
    if (title) title.textContent = file.name;
    showHint('');
    setProgress(0, false);
    updateToolbar();
    const loc = o.loc || file.lastLocation || null;
    try {
      const ext = st.ext;
      if (ext === 'pdf') { if (!ensurePdfJs()) throw new Error('تعذّر تحميل محرّك PDF'); await openPdf(file, loc); }
      else if (ext === 'docx' || ext === 'doc') await openDocx(file, loc);
      else if (ext === 'epub') await openEpub(file, loc);
      else if (isImageExt(ext)) await openImage(file, loc);
      else await openTxt(file, loc);
    } catch (err) {
      console.error(err);
      U.toast('تعذّر فتح الملف: ' + (err.message || err), 'error');
      container.innerHTML = '<div class="empty big"><p>تعذّر عرض هذا الملف.</p><p class="small">' + U.esc(err.message || '') + '</p></div>';
    }
    bindContainer();
    if (st.hlEnabled) applyHighlights();
  }

  async function close(silent) {
    if (st.pdfObserver) { try { st.pdfObserver.disconnect(); } catch (e) {} st.pdfObserver = null; }
    st.pdfPages.forEach((e) => {
      if (e.task) { try { e.task.cancel(); } catch (err) {} e.task = null; }
    });
    if (st.rendition) { try { st.rendition.destroy(); } catch (e) {} st.rendition = null; }
    if (st.book) { try { st.book.destroy(); } catch (e) {} st.book = null; }
    if (st.pdf) { try { st.pdf.destroy(); } catch (e) {} st.pdf = null; }
    if (st.objectUrl) { URL.revokeObjectURL(st.objectUrl); st.objectUrl = null; }
    TTS.stop();
    st.pdfPages = [];
    st.pdfPagesEl = null;
    st.canvas = null;
    st.textLayer = null;
    st.img = null;
  }

  function updateToolbar() {
    const isPdf = st.ext === 'pdf';
    const isEpub = st.ext === 'epub';
    const pager = g('rt-pager');
    const zoomIn = g('rt-zoom-in');
    const zoomOut = g('rt-zoom-out');
    if (pager) pager.classList.toggle('hidden', !(isPdf || isEpub));
    if (zoomIn) zoomIn.classList.toggle('hidden', !isPdf);
    if (zoomOut) zoomOut.classList.toggle('hidden', !isPdf);
    updatePageLabel();
  }

  function updatePageLabel() {
    const ind = g('rt-page');
    const jump = g('rt-jump');
    const go = g('rt-go');
    const isPdf = st.ext === 'pdf' && !!st.pdf;
    if (jump) {
      jump.classList.toggle('hidden', !isPdf);
      if (isPdf) jump.max = String(st.numPages || '');
    }
    if (go) go.classList.toggle('hidden', !isPdf);
    if (!ind) return;
    if (isPdf) ind.textContent = st.pdfCurrent + ' / ' + st.numPages;
    else if (st.ext === 'epub' && st.epubLoc && st.epubLoc.start) ind.textContent = Math.round((st.epubLoc.start.percentage || 0) * 100) + '%';
    else ind.textContent = '';
  }

  async function openPdf(file, loc) {
    const buf = await blobToArrayBuffer(file.blob);
    st.pdf = await window.pdfjsLib.getDocument({
      data: buf,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL
    }).promise;
    st.numPages = st.pdf.numPages;
    const p1 = await st.pdf.getPage(1);
    const vp1 = p1.getViewport({ scale: 1 });
    st.pdfBase = { w: vp1.width, h: vp1.height };
    const pagesEl = U.el('div', { class: 'pdf-pages' });
    pagesEl.setAttribute('dir', 'ltr');
    st.container.appendChild(pagesEl);
    st.pdfPagesEl = pagesEl;
    st.pdfPages = [];
    for (let i = 1; i <= st.numPages; i++) {
      const wrap = U.el('div', { class: 'pdf-page-wrap', dataset: { page: String(i) } });
      const canvas = U.el('canvas', { class: 'pdf-canvas' });
      const tl = U.el('div', { class: 'textLayer' });
      tl.setAttribute('dir', 'ltr');
      wrap.appendChild(canvas);
      wrap.appendChild(tl);
      pagesEl.appendChild(wrap);
      st.pdfPages.push({
        num: i, wrap: wrap, canvas: canvas, textLayer: tl,
        rendered: false, rendering: false, task: null,
        w: st.pdfBase.w, h: st.pdfBase.h, top: 0, empty: false,
        renderToken: 0
      });
    }
    layoutPdfPages();
    if (loc && loc.page && st.pdfPages[loc.page - 1]) {
      const e = st.pdfPages[U.clamp(loc.page, 1, st.numPages) - 1];
      scrollEl().scrollTop = e.top + (loc.offset || 0);
      st.pdfCurrent = e.num;
    } else if (loc && loc.scroll) {
      scrollEl().scrollTop = loc.scroll;
    }
    updatePdfCurrent();
    setupPdfObserver();
    renderVisiblePages();
    updatePageLabel();
    setProgress(progressPercent(currentLocation()), true);
  }

  function recomputeTops() {
    let top = 0;
    st.pdfPages.forEach((e) => { e.top = top; top += e.h + PAGE_GAP; });
  }

  function layoutPdfPages() {
    const sc = scrollEl();
    const avail = Math.max(220, (sc ? sc.clientWidth : 600) - 24);
    st.pdfFit = avail / st.pdfBase.w;
    st.pdfScale = U.clamp(st.pdfFit * st.pdfZoom, 0.1, 10);
    st.pdfPages.forEach((e) => {
      if (e.task) { try { e.task.cancel(); } catch (err) {} e.task = null; }
      e.renderToken = (e.renderToken || 0) + 1;
      e.rendering = false;
      e.rendered = false;
      e.w = st.pdfBase.w * st.pdfScale;
      e.h = st.pdfBase.h * st.pdfScale;
      e.wrap.style.width = Math.round(e.w) + 'px';
      e.wrap.style.height = Math.round(e.h) + 'px';
      e.wrap.style.marginBottom = PAGE_GAP + 'px';
    });
    recomputeTops();
  }

  function updatePdfCurrent() {
    if (!st.pdf || !st.pdfPages.length) return;
    const sc = scrollEl();
    if (!sc) return;
    const mark = sc.scrollTop + Math.min(sc.clientHeight * 0.3, 160);
    let cur = 1;
    for (let i = 0; i < st.pdfPages.length; i++) {
      const e = st.pdfPages[i];
      if (e.top <= mark) cur = e.num; else break;
    }
    if (cur !== st.pdfCurrent) {
      st.pdfCurrent = cur;
      updatePageLabel();
      updateEmptyHint();
      setProgress(progressPercent(currentLocation()), true);
      scheduleSave();
    }
  }

  function updateEmptyHint() {
    if (st.ext !== 'pdf' || !st.pdf) return;
    const e = st.pdfPages[st.pdfCurrent - 1];
    if (e && e.rendered && e.empty) {
      showHint('🖼️ هذا الملف عبارة عن صور ولا يمكن تحديد كلمات منه — استخدم نسخة PDF تحتوي نصاً.');
    } else {
      showHint('');
    }
  }

  async function renderPdfPage(e, force) {
    if (!st.pdf || !e) return;
    if (e.rendering || (e.rendered && !force)) return;
    e.rendering = true;
    const token = (e.renderToken = (e.renderToken || 0) + 1);
    try {
      const page = await st.pdf.getPage(e.num);
      if (token !== e.renderToken) return;
      const vp1 = page.getViewport({ scale: 1 });
      if (Math.abs(vp1.width - st.pdfBase.w) > 1 || Math.abs(vp1.height - st.pdfBase.h) > 1) {
        e.w = vp1.width * st.pdfScale;
        e.h = vp1.height * st.pdfScale;
        e.wrap.style.width = Math.round(e.w) + 'px';
        e.wrap.style.height = Math.round(e.h) + 'px';
        recomputeTops();
      }
      const vp = page.getViewport({ scale: st.pdfScale });
      const q = pdfQuality();
      const rvp = page.getViewport({ scale: st.pdfScale * q });
      const canvas = e.canvas;
      const ctx = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.max(1, Math.floor(rvp.width));
      canvas.height = Math.max(1, Math.floor(rvp.height));
      canvas.style.width = Math.floor(vp.width) + 'px';
      canvas.style.height = Math.floor(vp.height) + 'px';
      e.task = page.render({ canvasContext: ctx, viewport: rvp });
      await e.task.promise;
      e.task = null;
      if (token !== e.renderToken) return;
      const tl = e.textLayer;
      tl.innerHTML = '';
      tl.setAttribute('dir', 'ltr');
      tl.style.width = Math.floor(vp.width) + 'px';
      tl.style.height = Math.floor(vp.height) + 'px';
      tl.style.setProperty('--scale-factor', String(st.pdfScale));
      let hasText = false;
      const tc = await page.getTextContent();
      if (token !== e.renderToken) return;
      hasText = !!(tc.items && tc.items.some((it) => it.str && it.str.trim()));
      try {
        const task = window.pdfjsLib.renderTextLayer({
          textContent: tc,
          textContentSource: tc,
          container: tl,
          viewport: vp,
          textDivs: []
        });
        if (task && task.promise) await task.promise;
      } catch (err) { if (!/cancel/i.test((err && err.name) || '')) console.warn(err); }
      e.empty = !hasText;
      if (st.hlEnabled) applyHighlights(tl);
      if (token !== e.renderToken) return;
      e.rendered = true;
      if (st.pdfCurrent === e.num) updateEmptyHint();
    } catch (err) {
      if (!/cancel/i.test((err && err.name) || '')) console.warn('render page', e.num, err);
    } finally {
      e.rendering = false;
    }
  }

  function renderVisiblePages(force) {
    if (!st.pdf || !st.pdfPages.length) return;
    const sc = scrollEl();
    if (!sc) return;
    const top = sc.scrollTop - sc.clientHeight;
    const bottom = sc.scrollTop + sc.clientHeight * 2;
    st.pdfPages.forEach((e) => {
      if (e.top + e.h >= top && e.top <= bottom) renderPdfPage(e, force);
    });
  }

  function setupPdfObserver() {
    if (st.pdfObserver) { try { st.pdfObserver.disconnect(); } catch (e) {} }
    st.pdfObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const e = st.pdfPages[Number(en.target.dataset.page) - 1];
        if (e) renderPdfPage(e);
      });
    }, { root: scrollEl(), rootMargin: '900px 0px 1100px 0px', threshold: 0 });
    st.pdfPages.forEach((e) => st.pdfObserver.observe(e.wrap));
  }

  function cleanupPdfMemory() {
    if (!st.pdf || st.pdfPages.length < 8) return;
    const sc = scrollEl();
    if (!sc) return;
    const keepTop = sc.scrollTop - sc.clientHeight * 2.5;
    const keepBottom = sc.scrollTop + sc.clientHeight * 3.5;
    st.pdfPages.forEach((e) => {
      if (!e.rendered || e.rendering) return;
      const bottom = e.top + e.h;
      if (bottom < keepTop || e.top > keepBottom) {
        if (e.task) { try { e.task.cancel(); } catch (err) {} e.task = null; }
        e.canvas.width = 1;
        e.canvas.height = 1;
        e.canvas.style.width = '0px';
        e.canvas.style.height = '0px';
        e.textLayer.innerHTML = '';
        e.rendered = false;
      }
    });
  }

  function goToPage(n) {
    if (st.ext !== 'pdf' || !st.pdf) return;
    const num = U.clamp(parseInt(n, 10) || 1, 1, st.numPages);
    const e = st.pdfPages[num - 1];
    if (!e) return;
    scrollEl().scrollTop = Math.max(0, e.top);
    st.pdfCurrent = num;
    updatePageLabel();
    renderPdfPage(e);
    renderVisiblePages();
    scheduleSave();
  }

  function zoomTo(z, anchorNum) {
    if (st.ext !== 'pdf' || !st.pdf) return;
    const sc = scrollEl();
    const anchor = anchorNum || st.pdfCurrent;
    const a0 = st.pdfPages[anchor - 1];
    const rel = a0 ? U.clamp((sc.scrollTop - a0.top) / Math.max(1, a0.h), 0, 1) : 0;
    st.pdfZoom = U.clamp(z, 0.5, 4);
    layoutPdfPages();
    const a1 = st.pdfPages[anchor - 1];
    if (a1) sc.scrollTop = a1.top + rel * a1.h;
    renderVisiblePages(true);
    updatePageLabel();
    scheduleSave();
  }


  async function openDocx(file, loc) {
    const buf = await blobToArrayBuffer(file.blob);
    const container = st.container;
    try {
      if (!(window.docx && window.docx.renderAsync)) throw new Error('مكوّن عرض Word غير متاح');
      await window.docx.renderAsync(buf, container, null, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        experimental: true,
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true
      });
      if (st.ext === 'doc') U.toast('ملفات DOC القديمة قد لا تظهر بتنسيقها الكامل، يفضّل تحويلها إلى DOCX', 'warn');
    } catch (e) {
      console.warn(e);
      const text = extractReadableText(buf);
      container.innerHTML = '';
      container.appendChild(buildTxtView(text));
      U.toast('تعذّر عرض التنسيق الأصلي، عُرض النص فقط', 'warn');
    }
    if (loc && loc.scroll) scrollEl().scrollTop = loc.scroll;
  }

  function extractReadableText(buf) {
    let raw = '';
    try { raw = new TextDecoder('latin1').decode(new Uint8Array(buf)); } catch (e) { raw = ''; }
    const matches = raw.match(/[A-Za-z][A-Za-z0-9 ,.;:'"!?()\-\u2019]{24,}/g) || [];
    const clean = matches.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 24);
    const arabic = raw.match(/[\u0600-\u06FF][\u0600-\u06FF\s،.؛:!؟()\-]{18,}/g) || [];
    return clean.concat(arabic.map((s) => s.replace(/\s+/g, ' ').trim())).join('\n\n');
  }

  function buildTxtView(text) {
    const div = U.el('div', { class: 'txt-view' });
    let blocks = String(text || '').split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (blocks.length <= 1) {
      blocks = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    blocks.forEach((t) => {
      div.appendChild(U.el('p', { class: 'text-block', text: t }));
    });
    return div;
  }

  async function openTxt(file, loc) {
    const text = file.blob instanceof Blob ? await U.readAsText(file.blob) : String(file.blob || '');
    st.container.appendChild(buildTxtView(text));
    if (loc && loc.scroll) scrollEl().scrollTop = loc.scroll;
  }

  async function openEpub(file, loc) {
    const buf = await blobToArrayBuffer(file.blob);
    if (!window.ePub) throw new Error('مكوّن عرض EPUB غير متاح');
    st.book = window.ePub(buf);
    const holder = U.el('div', { class: 'epub-holder' });
    st.container.appendChild(holder);
    st.rendition = st.book.renderTo(holder, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false
    });
    const fontSize = (Settings.all().readerFontSize || 100);
    try {
      st.rendition.themes.default({
        body: { 'font-size': fontSize + '%', 'line-height': '1.6' }
      });
    } catch (e) {}
    st.rendition.hooks.content.register((contents) => {
      const doc = contents.document;
      if (st.hlEnabled) applyHighlights(doc);
      const onUp = () => setTimeout(() => emitSelectionFromDoc(doc, contents), 20);
      doc.addEventListener('pointerup', onUp);
      doc.addEventListener('touchend', onUp);
      doc.addEventListener('click', (e) => {
        const mark = e.target && e.target.closest ? e.target.closest('.hl') : null;
        if (mark) {
          const range = doc.createRange();
          range.selectNodeContents(mark);
          const r = range.getBoundingClientRect();
          const fr = doc.defaultView.frameElement ? doc.defaultView.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
          emit(mark.dataset.word || mark.textContent, { left: r.left + fr.left, top: r.top + fr.top, width: r.width, height: r.height, bottom: r.bottom + fr.top });
        }
      });
    });
    st.rendition.on('relocated', (l) => {
      st.epubLoc = l;
      updatePageLabel();
      const pct = l && l.start ? (l.start.percentage || 0) * 100 : 0;
      setProgress(pct, true);
      scheduleSave();
    });
    st.rendition.on('selected', (cfiRange, contents) => emitSelectionFromDoc(contents.document, contents));
    await Promise.race([
      st.book.ready,
      U.sleep(12000).then(() => { throw new Error('تعذّر قراءة ملف EPUB — قد يكون الملف تالفاً'); })
    ]);
    await Promise.race([
      st.rendition.display((loc && loc.cfi) || undefined),
      U.sleep(15000).then(() => { throw new Error('تأخّر عرض ملف EPUB — جرّب ملفاً آخر'); })
    ]);
  }

  function emitSelectionFromDoc(doc, contents) {
    const win = doc.defaultView;
    const sel = win.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = U.cleanSelection(sel.toString());
    if (!text) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const frame = win.frameElement;
    const fr = frame ? frame.getBoundingClientRect() : { left: 0, top: 0 };
    emit(text, {
      left: rect.left + fr.left,
      top: rect.top + fr.top,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + fr.top
    });
  }

  async function openImage(file, loc) {
    st.objectUrl = URL.createObjectURL(file.blob);
    const wrap = U.el('div', { class: 'img-wrap' });
    const img = U.el('img', { class: 'img-view', src: st.objectUrl, alt: file.name });
    const tl = U.el('div', { class: 'textLayer img-text-layer' });
    wrap.appendChild(img);
    wrap.appendChild(tl);
    st.container.appendChild(wrap);
    st.img = img;
    st.textLayer = tl;
    await new Promise((resolve) => {
      if (img.complete) resolve();
      else { img.onload = resolve; img.onerror = resolve; }
    });
    st.imgNat = { w: img.naturalWidth, h: img.naturalHeight };
    showHint('🖼️ هذا الملف عبارة عن صور ولا يمكن تحديد كلمات منه — ارفع ملف PDF يحتوي نصاً.');
    if (loc && loc.scroll) scrollEl().scrollTop = loc.scroll;
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveProgress(); }, 900);
  }

  function currentLocation() {
    if (!st.file) return null;
    if (st.ext === 'pdf') {
      const e = st.pdfPages[st.pdfCurrent - 1];
      const sc = scrollEl();
      const off = e && sc ? sc.scrollTop - e.top : 0;
      return { type: 'pdf', page: st.pdfCurrent, offset: Math.round(off), scroll: sc ? Math.round(sc.scrollTop) : 0 };
    }
    if (st.ext === 'epub') {
      return {
        type: 'epub',
        cfi: st.epubLoc && st.epubLoc.start ? st.epubLoc.start.cfi : null,
        percent: st.epubLoc && st.epubLoc.start ? st.epubLoc.start.percentage : 0
      };
    }
    return { type: st.ext, scroll: scrollEl() ? scrollEl().scrollTop : 0 };
  }

  function progressPercent(loc) {
    if (!st.file) return 0;
    if (st.ext === 'pdf' && st.numPages) {
      const sc = scrollEl();
      const e = st.pdfPages[st.pdfCurrent - 1];
      let within = 0;
      if (e && e.h && sc) within = U.clamp((sc.scrollTop - e.top) / e.h, 0, 1);
      return ((st.pdfCurrent - 1) + within) / st.numPages * 100;
    }
    if (st.ext === 'epub' && loc && loc.percent) return loc.percent * 100;
    const sc = scrollEl();
    if (sc && sc.scrollHeight > sc.clientHeight) {
      return (sc.scrollTop / (sc.scrollHeight - sc.clientHeight)) * 100;
    }
    return 0;
  }

  async function saveProgress() {
    if (!st.file) return;
    const loc = currentLocation();
    st.file.lastLocation = loc;
    st.file.lastOpened = Date.now();
    st.file.progress = progressPercent(loc);
    st.file.updatedAt = Date.now();
    try {
      await DB.put('files', st.file);
      DB.changed();
    } catch (e) {}
  }

  async function goTo(loc) {
    if (!loc || !st.file) return;
    try {
      if (st.ext === 'pdf' && loc.page) {
        goToPage(loc.page);
        if (loc.offset && st.pdfPages[loc.page - 1]) {
          scrollEl().scrollTop = st.pdfPages[loc.page - 1].top + loc.offset;
        }
      } else if (st.ext === 'epub' && loc.cfi && st.rendition) {
        await st.rendition.display(loc.cfi);
      } else if (scrollEl()) {
        scrollEl().scrollTop = loc.scroll || 0;
      }
    } catch (e) { console.warn(e); }
  }

  function nextPage() {
    if (st.ext === 'pdf' && st.pdf) goToPage(st.pdfCurrent + 1);
    else if (st.ext === 'epub' && st.rendition) st.rendition.next();
    else if (scrollEl()) scrollEl().scrollBy({ top: scrollEl().clientHeight * 0.9, behavior: 'smooth' });
  }
  function prevPage() {
    if (st.ext === 'pdf' && st.pdf) goToPage(st.pdfCurrent - 1);
    else if (st.ext === 'epub' && st.rendition) st.rendition.prev();
    else if (scrollEl()) scrollEl().scrollBy({ top: -scrollEl().clientHeight * 0.9, behavior: 'smooth' });
  }
  function zoomBy(delta) {
    if (st.ext !== 'pdf' || !st.pdf) return;
    zoomTo(st.pdfZoom + delta);
  }

  let lastEmit = { text: '', t: 0 };
  function emit(text, rect) {
    const clean = U.cleanSelection(text);
    if (!clean) return;
    const now = Date.now();
    if (clean === lastEmit.text && now - lastEmit.t < 1400) return;
    lastEmit = { text: clean, t: now };
    document.dispatchEvent(new CustomEvent('app:selection', {
      detail: {
        text: clean,
        rect: rect,
        fileId: st.file ? st.file.id : null,
        fileName: st.file ? st.file.name : '',
        location: currentLocation()
      }
    }));
  }

  function handleContainerSelection() {
    const c = st.container;
    if (!c) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const text = sel.toString();
      if (!text || !text.trim()) return;
      const range = sel.getRangeAt(0);
      if (!c.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      emit(text, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom });
    }, 30);
  }

  function bindContainer() {
    const c = st.container;
    if (!c || c._bound) return;
    c._bound = true;
    c.addEventListener('pointerup', handleContainerSelection);
    c.addEventListener('touchend', handleContainerSelection);
    document.addEventListener('selectionchange', U.debounce(() => {
      if (st.ext === 'epub') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const text = sel.toString();
      if (!text || !text.trim()) return;
      const range = sel.getRangeAt(0);
      if (!st.container || !st.container.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      emit(text, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom });
    }, 250));
    c.addEventListener('click', (e) => {
      const mark = e.target && e.target.closest ? e.target.closest('mark.hl') : null;
      if (!mark) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().indexOf(mark.textContent) >= 0) return;
      const r = mark.getBoundingClientRect();
      emit(mark.dataset.word || mark.textContent, { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom });
    });
    const sc = scrollEl();
    const onScroll = U.debounce(() => {
      if (st.ext === 'pdf') {
        updatePdfCurrent();
        cleanupPdfMemory();
      }
      scheduleSave();
    }, 130);
    sc.addEventListener('scroll', onScroll, { passive: true });
    setupPinch(sc);
  }

  function setupPinch(sc) {
    if (!sc || sc._pinchBound) return;
    sc._pinchBound = true;
    let startDist = 0;
    let startZoom = 1;
    let preview = 1;
    const dist = (t) => Math.sqrt(Math.pow(t[0].clientX - t[1].clientX, 2) + Math.pow(t[0].clientY - t[1].clientY, 2));
    sc.addEventListener('touchstart', (e) => {
      if (st.ext !== 'pdf' || e.touches.length !== 2) return;
      startDist = dist(e.touches);
      startZoom = st.pdfZoom;
      preview = 1;
    }, { passive: true });
    sc.addEventListener('touchmove', (e) => {
      if (st.ext !== 'pdf' || !startDist || e.touches.length !== 2) return;
      e.preventDefault();
      preview = U.clamp(dist(e.touches) / startDist, 0.4, 3);
      if (st.pdfPagesEl) st.pdfPagesEl.style.transform = 'scale(' + preview.toFixed(3) + ')';
    }, { passive: false });
    const endPinch = () => {
      if (st.ext !== 'pdf' || !startDist) return;
      const factor = preview;
      startDist = 0;
      preview = 1;
      if (st.pdfPagesEl) st.pdfPagesEl.style.transform = '';
      if (Math.abs(factor - 1) > 0.03) zoomTo(startZoom * factor);
    };
    sc.addEventListener('touchend', endPinch);
    sc.addEventListener('touchcancel', endPinch);
    sc.addEventListener('gesturestart', (e) => {
      if (st.ext !== 'pdf') return;
      e.preventDefault();
      startZoom = st.pdfZoom;
      preview = 1;
    });
    sc.addEventListener('gesturechange', (e) => {
      if (st.ext !== 'pdf') return;
      e.preventDefault();
      preview = U.clamp(e.scale, 0.4, 3);
      if (st.pdfPagesEl) st.pdfPagesEl.style.transform = 'scale(' + preview.toFixed(3) + ')';
    });
    sc.addEventListener('gestureend', () => {
      if (st.ext !== 'pdf' || preview === 1) return;
      const factor = preview;
      preview = 1;
      if (st.pdfPagesEl) st.pdfPagesEl.style.transform = '';
      if (Math.abs(factor - 1) > 0.03) zoomTo(startZoom * factor);
    });
  }

  async function savedWordSet() {
    const words = await DB.all('words');
    const set = new Set();
    words.forEach((w) => {
      if (w.type === 'word' && w.text) set.add(w.text.toLowerCase());
    });
    return set;
  }

  async function applyHighlights(root) {
    if (!st.hlEnabled) return;
    let targets = [];
    if (root) targets = [root];
    else if (st.ext === 'pdf') targets = st.pdfPages.filter((e) => e.rendered && e.textLayer.childNodes.length).map((e) => e.textLayer);
    else if (st.container) targets = [st.container];
    if (!targets.length) return;
    let list;
    try { list = await savedWordSet(); } catch (e) { return; }
    if (!list.size) return;
    const arr = Array.from(list).filter((w) => w.length > 1).sort((a, b) => b.length - a.length);
    if (!arr.length) return;
    const re = new RegExp('\\b(' + arr.map(U.escapeRe).join('|') + ')\\b', 'gi');
    targets.forEach((t) => highlightIn(t, re));
  }

  function highlightIn(root, re) {
    if (!root) return;
    const doc = root.ownerDocument || (root.documentElement ? root : document);
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || node.nodeValue.length < 2) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.hl,script,style,textarea,select')) return NodeFilter.FILTER_REJECT;
        re.lastIndex = 0;
        if (!re.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => wrapMatches(node, re));
  }

  function wrapMatches(node, re) {
    const text = node.nodeValue;
    const parent = node.parentNode;
    if (!parent) return;
    const doc = node.ownerDocument || document;
    const frag = doc.createDocumentFragment();
    let last = 0;
    let m;
    let found = false;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex++; continue; }
      found = true;
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
      const mark = doc.createElement('mark');
      mark.className = 'hl';
      mark.dataset.word = m[0].toLowerCase();
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
    }
    if (!found) return;
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    parent.replaceChild(frag, node);
  }

  function unwrapHighlights(root) {
    if (!root || !root.querySelectorAll) return;
    const doc = root.ownerDocument || document;
    Array.prototype.forEach.call(root.querySelectorAll('mark.hl'), (m) => {
      if (m.parentNode) m.parentNode.replaceChild(doc.createTextNode(m.textContent), m);
    });
  }

  async function toggleHighlights() {
    st.hlEnabled = !st.hlEnabled;
    const btn = g('rt-highlight');
    if (btn) btn.classList.toggle('primary', st.hlEnabled);
    if (st.hlEnabled) {
      U.toast('الإبراز مفعّل');
      if (st.ext === 'epub' && st.rendition) { try { await st.rendition.display(); } catch (e) {} }
      else applyHighlights();
    } else {
      U.toast('الإبراز متوقف');
      if (st.ext === 'pdf') {
        st.pdfPages.forEach((e) => { if (e.rendered) unwrapHighlights(e.textLayer); });
      } else if (st.ext === 'epub' && st.rendition) {
        try { await st.rendition.display(); } catch (e) {}
      } else if (st.container) {
        unwrapHighlights(st.container);
      }
    }
  }

  function getContext(selectionText) {
    if (!st.container) return '';
    let txt = '';
    try {
      if (st.ext === 'epub' && st.rendition) {
        const contents = st.rendition.getContents();
        if (contents && contents[0] && contents[0].document && contents[0].document.body) {
          txt = contents[0].document.body.innerText;
        }
      } else {
        txt = st.container.innerText || '';
      }
    } catch (e) { txt = ''; }
    txt = String(txt).replace(/\s+/g, ' ').trim();
    if (!selectionText) return txt.slice(0, 500);
    return U.getContextAround(txt, selectionText, 170);
  }

  const onResize = U.debounce(() => {
    if (st.ext === 'pdf' && st.pdf) {
      zoomTo(st.pdfZoom);
    } else if (st.ext === 'epub' && st.rendition) {
      try { st.rendition.resize(); } catch (e) {}
    }
  }, 350);
  window.addEventListener('resize', onResize);

  function getState() {
    return { file: st.file, ext: st.ext, page: st.pdfCurrent, numPages: st.numPages };
  }
  function currentFile() { return st.file; }

  return {
    open, close, goTo, goToPage, nextPage, prevPage, zoomBy,
    applyHighlights, toggleHighlights, getContext, currentLocation, saveProgress,
    currentFile, getState, updateToolbar
  };
})();
