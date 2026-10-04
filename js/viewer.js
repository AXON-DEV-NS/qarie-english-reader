window.Viewer = (function () {
  const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  const TESS = { worker: null, promise: null };

  const st = {
    file: null,
    ext: '',
    container: null,
    pdf: null,
    page: 1,
    numPages: 0,
    zoom: 1,
    canvas: null,
    textLayer: null,
    renderTask: null,
    book: null,
    rendition: null,
    epubLoc: null,
    img: null,
    imgNat: null,
    objectUrl: null,
    renderSeq: 0,
    hlEnabled: true
  };

  function g(id) { return document.getElementById(id); }
  function scrollEl() { return g('reader-scroll'); }

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
    st.zoom = 1;
    st.page = 1;
    st.epubLoc = null;
    st.imgNat = null;
    const container = g('viewer-container');
    container.innerHTML = '';
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

  function ensurePdfJs() {
    if (window.pdfjsLib) {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC; } catch (e) {}
      return true;
    }
    return false;
  }

  async function close(silent) {
    if (st.renderTask) { try { st.renderTask.cancel(); } catch (e) {} st.renderTask = null; }
    if (!silent) await saveProgress();
    if (st.rendition) { try { st.rendition.destroy(); } catch (e) {} st.rendition = null; }
    if (st.book) { try { st.book.destroy(); } catch (e) {} st.book = null; }
    if (st.pdf) { try { st.pdf.destroy(); } catch (e) {} st.pdf = null; }
    if (st.objectUrl) { URL.revokeObjectURL(st.objectUrl); st.objectUrl = null; }
    TTS.stop();
    st.canvas = null; st.textLayer = null; st.img = null;
  }

  function updateToolbar() {
    const isPdf = st.ext === 'pdf';
    const isEpub = st.ext === 'epub';
    const pager = g('rt-pager');
    const zoom = g('rt-zoom-in');
    const ocr = g('rt-ocr');
    if (pager) pager.classList.toggle('hidden', !(isPdf || isEpub));
    if (zoom) zoom.classList.toggle('hidden', !isPdf);
    if (ocr) ocr.classList.toggle('hidden', !(isPdf || isImageExt(st.ext)));
    const next = g('rt-next'); const prev = g('rt-prev');
    if (next) next.classList.toggle('hidden', !(isPdf || isEpub));
    if (prev) prev.classList.toggle('hidden', !(isPdf || isEpub));
    updatePageLabel();
  }

  function updatePageLabel() {
    const ind = g('rt-page');
    if (!ind) return;
    if (st.ext === 'pdf' && st.numPages) {
      ind.textContent = st.page + ' / ' + st.numPages;
    } else if (st.ext === 'epub' && st.epubLoc && st.epubLoc.start) {
      ind.textContent = Math.round((st.epubLoc.start.percentage || 0) * 100) + '%';
    } else {
      ind.textContent = '';
    }
  }

  async function openPdf(file, loc) {
    const buf = await blobToArrayBuffer(file.blob);
    st.pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    st.numPages = st.pdf.numPages;
    const wrap = U.el('div', { class: 'pdf-page-wrap' });
    const canvas = U.el('canvas', { class: 'pdf-canvas' });
    const tl = U.el('div', { class: 'textLayer' });
    wrap.appendChild(canvas);
    wrap.appendChild(tl);
    st.container.appendChild(wrap);
    st.canvas = canvas;
    st.textLayer = tl;
    await renderPage((loc && loc.page) || 1);
    if (loc && loc.scroll) scrollEl().scrollTop = loc.scroll;
  }

  async function renderPage(n) {
    if (!st.pdf) return;
    n = U.clamp(parseInt(n, 10) || 1, 1, st.numPages || 1);
    const seq = ++st.renderSeq;
    const page = await st.pdf.getPage(n);
    const avail = Math.max(280, scrollEl().clientWidth - 28);
    const base = page.getViewport({ scale: 1 });
    const fit = avail / base.width;
    const cssScale = U.clamp(fit * st.zoom, 0.2, 4);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: cssScale });
    const canvas = st.canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.max(1, Math.floor(vp.width * dpr));
    canvas.height = Math.max(1, Math.floor(vp.height * dpr));
    canvas.style.width = Math.floor(vp.width) + 'px';
    canvas.style.height = Math.floor(vp.height) + 'px';
    if (st.renderTask) { try { st.renderTask.cancel(); } catch (e) {} }
    st.renderTask = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: cssScale * dpr }) });
    try { await st.renderTask.promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; throw e; }
    st.renderTask = null;
    if (seq !== st.renderSeq) return;
    const tl = st.textLayer;
    tl.innerHTML = '';
    tl.style.width = Math.floor(vp.width) + 'px';
    tl.style.height = Math.floor(vp.height) + 'px';
    let hasText = false;
    try {
      const tc = await page.getTextContent();
      hasText = tc.items && tc.items.some((it) => it.str && it.str.trim().length);
      const task = window.pdfjsLib.renderTextLayer({
        textContent: tc,
        textContentSource: tc,
        container: tl,
        viewport: vp,
        textDivs: []
      });
      if (task && task.promise) await task.promise;
    } catch (e) { console.warn(e); }
    st.page = n;
    updatePageLabel();
    const ocrKey = String(n);
    const ocrData = fileOcr(ocrKey);
    if (ocrData) {
      renderOcrOverlayOn(tl, ocrData, cssScale, vp.width, vp.height);
      showHint('');
    } else if (!hasText) {
      showHint('📷 هذه الصفحة صورة بلا نص — اضغط <strong>OCR</strong> لتحويلها إلى نص قابل للتحديد.');
    } else {
      showHint('');
    }
    if (st.hlEnabled) applyHighlights(tl);
    setProgress(((n - 1) / Math.max(1, st.numPages)) * 100, true);
    scheduleSave();
  }

  function fileOcr(key) {
    if (!st.file || !st.file.ocr) return null;
    return st.file.ocr[key] || null;
  }

  function renderOcrOverlayOn(tl, rec, cssScale, pageW, pageH) {
    tl.innerHTML = '';
    const scale = rec.scale || 2;
    const ratio = cssScale / scale;
    tl.style.width = Math.floor(pageW) + 'px';
    tl.style.height = Math.floor(pageH) + 'px';
    (rec.words || []).forEach((wd) => {
      const b = wd.bbox;
      if (!b || !wd.text || !wd.text.trim()) return;
      const span = U.el('span', { text: wd.text });
      span.style.position = 'absolute';
      span.style.left = Math.floor(b.x0 * ratio) + 'px';
      span.style.top = Math.floor(b.y0 * ratio) + 'px';
      span.style.width = Math.max(4, Math.floor((b.x1 - b.x0) * ratio)) + 'px';
      span.style.height = Math.max(4, Math.floor((b.y1 - b.y0) * ratio)) + 'px';
      span.style.fontSize = Math.max(6, (b.y1 - b.y0) * ratio * 0.85) + 'px';
      span.style.color = 'transparent';
      span.style.whiteSpace = 'pre';
      span.style.overflow = 'hidden';
      span.style.position = 'absolute';
      tl.appendChild(span);
    });
  }

  async function getTess() {
    if (TESS.worker) return TESS.worker;
    if (TESS.promise) return TESS.promise;
    if (!window.Tesseract) throw new Error('تعذّر تحميل محرّك OCR');
    TESS.promise = window.Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m && m.status === 'recognizing text') setProgress((m.progress || 0) * 100, true);
      }
    }).then((w) => { TESS.worker = w; return w; }).catch((e) => { TESS.promise = null; throw e; });
    return TESS.promise;
  }

  function wordsFromTesseract(data) {
    const out = [];
    const push = (w) => {
      if (!w || !w.text || !w.text.trim() || !w.bbox) return;
      out.push({ text: w.text, bbox: w.bbox });
    };
    if (data && Array.isArray(data.words) && data.words.length) {
      data.words.forEach(push);
      return out;
    }
    if (data && Array.isArray(data.blocks)) {
      data.blocks.forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => (l.words || []).forEach(push))));
      return out;
    }
    if (data && data.tsv) {
      String(data.tsv).split('\n').forEach((line) => {
        const c = line.split('\t');
        if (c.length >= 12 && c[0] === '5') {
          const text = c[11] || '';
          const bbox = { x0: +c[6], y0: +c[7], x1: +c[6] + +c[8], y1: +c[7] + +c[9] };
          push({ text: text, bbox: bbox });
        }
      });
    }
    return out;
  }

  async function runOcr() {
    if (!st.file) return;
    setProgress(0, true);
    try {
      if (st.ext === 'pdf' && st.pdf) {
        const n = st.page;
        const page = await st.pdf.getPage(n);
        const ocrScale = 2;
        const vp = page.getViewport({ scale: ocrScale });
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.floor(vp.width));
        cv.height = Math.max(1, Math.floor(vp.height));
        await page.render({ canvasContext: cv.getContext('2d', { alpha: false }), viewport: vp }).promise;
        const worker = await getTess();
        const res = await worker.recognize(cv);
        const data = res.data || {};
        const words = wordsFromTesseract(data);
        st.file.ocr = st.file.ocr || {};
        st.file.ocr[String(n)] = { text: data.text || '', words: words, scale: ocrScale };
        st.file.hasText = true;
        st.file.updatedAt = Date.now();
        await DB.put('files', st.file);
        DB.changed();
        U.toast('تم تحويل الصفحة إلى نص قابل للتحديد ✓', 'ok');
        const avail = Math.max(280, scrollEl().clientWidth - 28);
        const cssScale = U.clamp((avail / page.getViewport({ scale: 1 }).width) * st.zoom, 0.2, 4);
        const vp2 = page.getViewport({ scale: cssScale });
        renderOcrOverlayOn(st.textLayer, st.file.ocr[String(n)], cssScale, vp2.width, vp2.height);
        showHint('');
        if (st.hlEnabled) applyHighlights(st.textLayer);
      } else if (isImageExt(st.ext) && st.img) {
        const worker = await getTess();
        const res = await worker.recognize(st.img);
        const data = res.data || {};
        const words = wordsFromTesseract(data);
        const rec = { text: data.text || '', words: words, scale: 1, w: st.imgNat ? st.imgNat.w : st.img.naturalWidth, h: st.imgNat ? st.imgNat.h : st.img.naturalHeight };
        st.file.ocr = st.file.ocr || {};
        st.file.ocr['1'] = rec;
        st.file.hasText = true;
        st.file.updatedAt = Date.now();
        await DB.put('files', st.file);
        DB.changed();
        U.toast('تم تحويل الصورة إلى نص قابل للتحديد ✓', 'ok');
        renderImageOcr(rec);
      } else {
        U.toast('لا يوجد ما يُعالج في هذا النوع', 'warn');
      }
    } catch (e) {
      console.error(e);
      U.toast('تعذّر OCR: ' + (e.message || e), 'error');
    } finally {
      setProgress(0, false);
    }
  }

  function renderImageOcr(rec) {
    const tl = st.textLayer;
    const img = st.img;
    if (!tl || !img || !img.clientWidth) return;
    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    const scale = rec.scale || 1;
    tl.style.width = displayW + 'px';
    tl.style.height = displayH + 'px';
    renderOcrOverlayOn(tl, rec, (displayW / (rec.w || displayW)) * scale, displayW, displayH);
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
    String(text || '').split(/\r?\n\s*\r?\n/).forEach((par) => {
      const t = par.trim();
      if (!t) return;
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
      flow: 'paginated',
      spread: 'auto',
      allowScriptedContent: false
    });
    const fontSize = (Settings.all().readerFontSize || 100);
    try {
      st.rendition.themes.default({
        body: { 'font-size': fontSize + '%', 'line-height': '1.6', color: 'var(--text, #16212e)' }
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
    await st.book.ready;
    await st.rendition.display((loc && loc.cfi) || undefined);
  }

  function emitSelectionFromDoc(doc, contents) {
    const win = doc.defaultView;
    const sel = win.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
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
    const savedOcr = fileOcr('1');
    if (savedOcr) renderImageOcr(savedOcr);
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
      return { type: 'pdf', page: st.page, scroll: scrollEl() ? scrollEl().scrollTop : 0 };
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
    if (st.ext === 'pdf' && st.numPages) return ((st.page - 1) / st.numPages) * 100;
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
        await renderPage(loc.page);
        setTimeout(() => { if (scrollEl()) scrollEl().scrollTop = loc.scroll || 0; }, 80);
      } else if (st.ext === 'epub' && loc.cfi && st.rendition) {
        await st.rendition.display(loc.cfi);
      } else if (scrollEl()) {
        scrollEl().scrollTop = loc.scroll || 0;
      }
    } catch (e) { console.warn(e); }
  }

  function nextPage() {
    if (st.ext === 'pdf') renderPage(st.page + 1);
    else if (st.ext === 'epub' && st.rendition) st.rendition.next();
    else if (scrollEl()) scrollEl().scrollBy({ top: scrollEl().clientHeight * 0.9, behavior: 'smooth' });
  }
  function prevPage() {
    if (st.ext === 'pdf') renderPage(st.page - 1);
    else if (st.ext === 'epub' && st.rendition) st.rendition.prev();
    else if (scrollEl()) scrollEl().scrollBy({ top: -scrollEl().clientHeight * 0.9, behavior: 'smooth' });
  }
  function zoomBy(delta) {
    if (st.ext !== 'pdf') return;
    st.zoom = U.clamp(st.zoom + delta, 0.5, 3);
    renderPage(st.page);
  }

  let lastEmit = { text: '', t: 0 };
  function emit(text, rect) {
    const clean = String(text || '').trim();
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

  function bindContainer() {
    const c = st.container;
    if (!c || c._bound) return;
    c._bound = true;
    const handler = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const text = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const range = sel.getRangeAt(0);
        if (!c.contains(range.commonAncestorContainer)) return;
        const rect = range.getBoundingClientRect();
        emit(text, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom });
      }, 30);
    };
    c.addEventListener('pointerup', handler);
    c.addEventListener('touchend', handler);
    document.addEventListener('selectionchange', U.debounce(() => {
      if (st.ext === 'epub') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const text = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const range = sel.getRangeAt(0);
      if (!c.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      emit(text, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom });
    }, 420));
    c.addEventListener('click', (e) => {
      const mark = e.target && e.target.closest ? e.target.closest('mark.hl') : null;
      if (!mark) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().indexOf(mark.textContent) >= 0) return;
      const r = mark.getBoundingClientRect();
      emit(mark.dataset.word || mark.textContent, { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom });
    });
    const scroll = scrollEl();
    const onScroll = U.debounce(() => scheduleSave(), 900);
    scroll.addEventListener('scroll', onScroll, { passive: true });
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
    let target = root;
    if (!target) {
      target = st.ext === 'epub' ? null : st.container;
    }
    if (!target || !st.hlEnabled) return;
    let list;
    try { list = await savedWordSet(); } catch (e) { return; }
    if (!list.size) return;
    const arr = Array.from(list).filter((w) => w.length > 1).sort((a, b) => b.length - a.length);
    if (!arr.length) return;
    const re = new RegExp('\\b(' + arr.map(U.escapeRe).join('|') + ')\\b', 'gi');
    highlightIn(target, re);
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
    const frag = (node.ownerDocument || document).createDocumentFragment();
    let last = 0;
    let m;
    let found = false;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex++; continue; }
      found = true;
      if (m.index > last) frag.appendChild((node.ownerDocument || document).createTextNode(text.slice(last, m.index)));
      const mark = (node.ownerDocument || document).createElement('mark');
      mark.className = 'hl';
      mark.dataset.word = m[0].toLowerCase();
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
    }
    if (!found) return;
    if (last < text.length) frag.appendChild((node.ownerDocument || document).createTextNode(text.slice(last)));
    parent.replaceChild(frag, node);
  }

  async function toggleHighlights() {
    st.hlEnabled = !st.hlEnabled;
    const btn = g('rt-highlight');
    if (btn) btn.classList.toggle('primary', st.hlEnabled);
    if (st.hlEnabled) {
      U.toast('الإبراز مفعّل');
      if (st.ext === 'epub' && st.rendition) {
        try { await st.rendition.display(); } catch (e) {}
      } else {
        applyHighlights();
      }
    } else {
      U.toast('الإبراز متوقف');
      U.qsa('mark.hl').forEach((m) => {
        const t = document.createTextNode(m.textContent);
        if (m.parentNode) m.parentNode.replaceChild(t, m);
      });
      if (st.textLayer) {
        renderCurrentTextLayerHighlightsOff();
      }
    }
  }

  async function renderCurrentTextLayerHighlightsOff() {
    if (st.ext === 'pdf' && st.pdf) {
      await renderPage(st.page);
    } else if (st.ext === 'epub' && st.rendition) {
      try { await st.rendition.display(); } catch (e) {}
    }
  }

  function getContext(selectionText) {
    if (!st.container) return '';
    let txt = '';
    try {
      if (st.ext === 'epub' && st.rendition) {
        const contents = st.rendition.getContents();
        if (contents && contents[0] && contents[0].document) {
          txt = contents[0].document.body ? contents[0].document.body.innerText : '';
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
    if (st.ext === 'pdf' && st.pdf && st.canvas) {
      renderPage(st.page);
    }
  }, 350);
  window.addEventListener('resize', onResize);

  function getState() {
    return { file: st.file, ext: st.ext, page: st.page, numPages: st.numPages };
  }
  function currentFile() { return st.file; }

  return {
    open, close, goTo, nextPage, prevPage, zoomBy, runOcr, applyHighlights,
    toggleHighlights, getContext, currentLocation, saveProgress,
    currentFile, getState, updateToolbar
  };
})();
