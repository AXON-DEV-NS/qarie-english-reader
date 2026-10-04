window.TapSelect = (function () {
  const WORD = /[A-Za-z0-9\u2019']/;
  const PUNCT = /[.!?\u2026\n]/;
  const st = {
    range: null, map: null, s: 0, e: 0, text: '', rect: null,
    popupOpen: false, lastTap: 0, lastX: 0, lastY: 0, tapTimer: null,
    down: null, bound: false, onCommit: null, onEmpty: null
  };

  function root() { return document.getElementById('viewer-container'); }
  function layer() { return document.getElementById('sel-layer'); }
  function barEl() { return document.getElementById('tap-bar'); }

  function mode() {
    const m = (Settings.all().selectionMode || 'auto');
    if (m === 'free') return 'free';
    if (m === 'tap') return 'tap';
    return window.matchMedia('(pointer: coarse)').matches ? 'tap' : 'free';
  }
  function isTapMode() { return mode() === 'tap'; }

  function blockOf(node) {
    const el = node.parentElement;
    if (!el) return null;
    if (el.closest('.textLayer')) return el.closest('span') || el;
    return el.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,td,pre') || el.parentElement || el;
  }

  function buildMap() {
    const r = root();
    if (!r) return null;
    const nodes = [];
    let text = '';
    const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let prevBlock = null;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const block = blockOf(node);
      if (prevBlock && block !== prevBlock) text += '\n';
      const s0 = text.length;
      text += node.nodeValue;
      nodes.push({ node: node, s: s0, e: text.length, block: block });
      prevBlock = block;
    }
    st.map = { text: text, nodes: nodes };
    return st.map;
  }

  function boundsWord(text, pos) {
    pos = U.clamp(pos, 0, text.length);
    const isW = (c) => WORD.test(c);
    let s = pos;
    let e = pos;
    while (s > 0 && isW(text[s - 1])) s--;
    while (e < text.length && isW(text[e])) e++;
    if (s === e) {
      while (e < text.length && !isW(text[e])) e++;
      s = e;
      while (e < text.length && isW(text[e])) e++;
    }
    return [s, e];
  }
  function nextWordEnd(text, e) {
    let i = e;
    while (i < text.length && !WORD.test(text[i])) i++;
    while (i < text.length && WORD.test(text[i])) i++;
    return i;
  }
  function prevWordStart(text, s) {
    let i = s;
    while (i > 0 && !WORD.test(text[i - 1])) i--;
    while (i > 0 && WORD.test(text[i - 1])) i--;
    return i;
  }
  function boundsSent(text, s, e) {
    let a = Math.max(
      text.lastIndexOf('.', s - 1),
      text.lastIndexOf('!', s - 1),
      text.lastIndexOf('?', s - 1),
      text.lastIndexOf('\u2026', s - 1),
      text.lastIndexOf('\n', s - 1)
    );
    a = a < 0 ? 0 : a + 1;
    let b = -1;
    for (let i = e; i < text.length; i++) {
      if (PUNCT.test(text[i])) { b = i + 1; break; }
    }
    if (b < 0) b = text.length;
    return [a, b];
  }
  function boundsPara(text, s, e) {
    const a = text.lastIndexOf('\n', s - 1) + 1;
    let b = text.indexOf('\n', e);
    if (b < 0) b = text.length;
    return [a, b];
  }

  function locate(map, abs) {
    const nodes = map.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const m = nodes[i];
      if (abs >= m.s && abs <= m.e) {
        return { node: m.node, off: U.clamp(abs - m.s, 0, m.node.nodeValue.length) };
      }
    }
    const last = nodes[nodes.length - 1];
    return last ? { node: last.node, off: last.node.nodeValue.length } : null;
  }
  function rangeFromOffsets(map, s, e) {
    const a = locate(map, s);
    const b = locate(map, e);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a.node, a.off);
    r.setEnd(b.node, b.off);
    return r;
  }
  function rectsOf(range) {
    if (!range) return [];
    const list = range.getClientRects ? range.getClientRects() : [];
    return Array.prototype.slice.call(list).filter((r) => r.width > 1 && r.height > 1);
  }
  function textNodeRects(node) {
    const r = document.createRange();
    r.selectNodeContents(node);
    return rectsOf(r);
  }

  function setSelection(s, e) {
    if (!st.map) buildMap();
    if (!st.map) return;
    const len = st.map.text.length;
    s = U.clamp(s, 0, len);
    e = U.clamp(e, 0, len);
    while (s < e && /\s/.test(st.map.text[s])) s++;
    while (e > s && /\s/.test(st.map.text[e - 1])) e--;
    if (s >= e) return;
    st.s = s;
    st.e = e;
    st.text = st.map.text.slice(s, e);
    try { st.range = rangeFromOffsets(st.map, s, e); } catch (err) { st.range = null; }
    draw();
  }

  function draw() {
    const l = layer();
    if (!l) return;
    l.innerHTML = '';
    if (!st.range || !st.range.startContainer.isConnected) {
      hideBar();
      return;
    }
    const rects = rectsOf(st.range);
    if (!rects.length) { hideBar(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rects.forEach((r) => {
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
      const d = document.createElement('div');
      d.className = 'sel-rect';
      d.style.left = Math.round(r.left) + 'px';
      d.style.top = Math.round(r.top) + 'px';
      d.style.width = Math.round(r.width) + 'px';
      d.style.height = Math.round(r.height) + 'px';
      l.appendChild(d);
    });
    st.rect = { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
    positionBar();
  }

  function positionBar() {
    const bar = barEl();
    if (!bar || !st.rect) return;
    bar.classList.remove('hidden');
    const bw = bar.offsetWidth || 330;
    const bh = bar.offsetHeight || 52;
    const m = 8;
    let left = U.clamp(st.rect.left + st.rect.width / 2 - bw / 2, m, Math.max(m, window.innerWidth - bw - m));
    let top = st.rect.top - bh - 10;
    if (top < 56) top = st.rect.bottom + 10;
    if (top + bh > window.innerHeight - 8) top = Math.max(56, window.innerHeight - bh - 8);
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
  }
  function hideBar() {
    const b = barEl();
    if (b) b.classList.add('hidden');
  }

  function clear() {
    st.range = null;
    st.text = '';
    st.rect = null;
    st.map = null;
    const l = layer();
    if (l) l.innerHTML = '';
    hideBar();
  }
  function rebuild() {
    clear();
    buildMap();
  }

  function pointToOffset(x, y) {
    let node = null;
    let off = 0;
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; off = r.startOffset; }
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) { node = p.offsetNode; off = p.offset; }
    }
    if (!st.map) return -1;
    if (node && node.nodeType === 3) {
      const m = st.map.nodes.find((n) => n.node === node);
      if (m) return m.s + off;
    }
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < st.map.nodes.length; i++) {
      const m = st.map.nodes[i];
      if (!m.node.isConnected) continue;
      const rects = textNodeRects(m.node);
      for (let j = 0; j < rects.length; j++) {
        const rc = rects[j];
        const cx = U.clamp(x, rc.left, rc.right);
        const cy = U.clamp(y, rc.top, rc.bottom);
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (d < bestD) {
          bestD = d;
          const ratio = rc.width > 1 ? U.clamp((x - rc.left) / rc.width, 0, 1) : 0;
          best = m.s + Math.round(ratio * m.node.nodeValue.length);
        }
      }
    }
    return bestD < 44 ? best : -1;
  }

  function tapAt(x, y) {
    if (!st.map || !st.map.nodes.length || !st.map.nodes[0].node.isConnected) buildMap();
    if (!st.map) return false;
    const abs = pointToOffset(x, y);
    if (abs < 0) return false;
    const r = boundsWord(st.map.text, abs);
    if (r[0] === r[1]) return false;
    setSelection(r[0], r[1]);
    return true;
  }

  function currentDetail() {
    if (!st.text || !st.rect) return null;
    return { text: st.text, rect: st.rect, range: st.range, type: U.classify(st.text) };
  }

  function expand() {
    if (!st.map) return;
    setSelection(st.s, nextWordEnd(st.map.text, st.e));
  }
  function shrink() {
    if (!st.map) return;
    setSelection(st.s, prevWordStart(st.map.text, st.e));
  }
  function toSentence() {
    if (!st.map) return;
    const r = boundsSent(st.map.text, st.s, st.e);
    setSelection(r[0], r[1]);
  }
  function toParagraph() {
    if (!st.map) return;
    const r = boundsPara(st.map.text, st.s, st.e);
    setSelection(r[0], r[1]);
  }

  function commit() {
    const d = currentDetail();
    if (!d) return;
    clearTimeout(st.tapTimer);
    if (st.onCommit) st.onCommit(d, { auto: st.popupOpen });
  }

  function bind() {
    if (st.bound) return;
    st.bound = true;
    const r = root();
    if (r) {
      r.addEventListener('pointerdown', (e) => {
        if (!isTapMode()) return;
        st.down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
      }, true);
      r.addEventListener('pointermove', (e) => {
        if (!st.down) return;
        if (Math.abs(e.clientX - st.down.x) > 8 || Math.abs(e.clientY - st.down.y) > 8) st.down.moved = true;
      }, true);
      r.addEventListener('pointerup', (e) => {
        if (!isTapMode()) return;
        const d = st.down;
        st.down = null;
        if (!d || d.moved || Date.now() - d.t > 600) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const now = Date.now();
        const isDouble = now - st.lastTap < 300 && Math.sqrt(Math.pow(e.clientX - st.lastX, 2) + Math.pow(e.clientY - st.lastY, 2)) < 44;
        st.lastTap = now;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        if (isDouble) {
          clearTimeout(st.tapTimer);
          clear();
          if (window.Viewer && Viewer.doubleTapZoom) Viewer.doubleTapZoom(e.clientX, e.clientY);
          return;
        }
        clearTimeout(st.tapTimer);
        st.tapTimer = setTimeout(() => {
          const hit = tapAt(e.clientX, e.clientY);
          if (hit) {
            if (st.popupOpen) commit();
          } else if (st.onEmpty) {
            st.onEmpty();
          }
        }, 260);
      }, true);
      r.addEventListener('contextmenu', (e) => { if (isTapMode()) e.preventDefault(); });
      r.addEventListener('selectstart', (e) => { if (isTapMode()) e.preventDefault(); });
    }
    const bar = barEl();
    if (bar) {
      bar.addEventListener('pointerdown', (e) => e.stopPropagation());
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'expand') expand();
        else if (act === 'shrink') shrink();
        else if (act === 'sentence') toSentence();
        else if (act === 'paragraph') toParagraph();
        else if (act === 'translate') commit();
      });
    }
    window.addEventListener('scroll', () => { if (st.range) draw(); }, true);
    window.addEventListener('resize', U.debounce(() => { if (st.range) draw(); }, 150));
    document.addEventListener('viewer:rerender', () => clear());
  }

  document.addEventListener('settings:changed', () => {
    document.body.classList.toggle('tap-select', isTapMode());
    if (!isTapMode()) clear();
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('tap-select', isTapMode());
  });

  function init(opts) {
    st.onCommit = opts && opts.onCommit;
    st.onEmpty = opts && opts.onEmpty;
    bind();
    document.body.classList.toggle('tap-select', isTapMode());
  }
  function setPopupOpen(v) {
    st.popupOpen = !!v;
    if (!v) hideBar();
  }

  return { init, setPopupOpen, clear, rebuild, isTapMode, mode, currentDetail, expand, shrink, toSentence, toParagraph };
})();
