window.U = (function () {
  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'dataset') Object.assign(node.dataset, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function normalizeWord(w) {
    return String(w || '').toLowerCase().replace(/[^a-z\u2019'-]/g, '').replace(/^[-'\u2019]+|[-'\u2019]+$/g, '');
  }
  function countWords(t) { return String(t || '').trim().split(/\s+/).filter(Boolean).length; }
  function classify(text) {
    const t = String(text || '').trim();
    if (!t) return 'word';
    const words = countWords(t);
    if (words <= 1) return 'word';
    if (words <= 18 && !/[\n\r]/.test(t) && !/[.!?…]["')\]]*\s+[A-Z]/.test(t.slice(0, -1))) return 'sentence';
    return 'paragraph';
  }
  function todayKey(d) {
    const dt = d ? new Date(d) : new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function formatDate(ts) {
    if (!ts) return '—';
    try {
      return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch (e) { return new Date(ts).toLocaleString(); }
  }
  function formatBytes(n) {
    if (!n && n !== 0) return '—';
    const units = ['بايت', 'KB', 'MB', 'GB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
  }
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 250);
    };
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function toast(msg, type) {
    const wrap = qs('#toast-wrap');
    if (!wrap) return;
    const node = el('div', { class: 'toast ' + (type || ''), text: msg });
    wrap.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .3s';
      setTimeout(() => node.remove(), 320);
    }, type === 'error' ? 4200 : 2600);
  }
  function modal(opts) {
    return new Promise((resolve) => {
      const root = qs('#modal-root');
      const backdrop = el('div', { class: 'modal-backdrop' });
      const box = el('div', { class: 'modal' });
      box.appendChild(el('h3', { text: opts.title || '' }));
      if (opts.html) box.appendChild(el('div', { html: opts.html }));
      const actions = el('div', { class: 'modal-actions' });
      (opts.actions || [{ label: 'حسناً', value: true, primary: true }]).forEach((a) => {
        actions.appendChild(el('button', {
          class: 'btn ' + (a.primary ? 'primary' : (a.danger ? 'danger' : '')),
          text: a.label,
          onclick: () => { backdrop.remove(); resolve(a.value); }
        }));
      });
      box.appendChild(actions);
      backdrop.appendChild(box);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) { backdrop.remove(); resolve(null); }
      });
      root.appendChild(backdrop);
    });
  }
  function confirmBox(title, message, okLabel) {
    return modal({
      title: title,
      html: '<p>' + esc(message) + '</p>',
      actions: [
        { label: 'إلغاء', value: false },
        { label: okLabel || 'تأكيد', value: true, danger: true }
      ]
    });
  }
  function promptBox(title, value, label) {
    const id = uid();
    return new Promise((resolve) => {
      const root = qs('#modal-root');
      const backdrop = el('div', { class: 'modal-backdrop' });
      const box = el('div', { class: 'modal' });
      box.appendChild(el('h3', { text: title || '' }));
      const field = el('div', { class: 'field' });
      field.appendChild(el('label', { for: id, text: label || 'القيمة' }));
      const input = el('input', { id: id, class: 'input', value: value || '' });
      field.appendChild(input);
      box.appendChild(field);
      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', {
        class: 'btn', text: 'إلغاء',
        onclick: () => { backdrop.remove(); resolve(null); }
      }));
      actions.appendChild(el('button', {
        class: 'btn primary', text: 'حفظ',
        onclick: () => { const v = input.value; backdrop.remove(); resolve(v); }
      }));
      box.appendChild(actions);
      backdrop.appendChild(box);
      root.appendChild(backdrop);
      setTimeout(() => input.focus(), 60);
    });
  }
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function readAsText(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(blob);
    });
  }
  function readAsDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function readAsArrayBuffer(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(blob);
    });
  }
  function dataURLToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const meta = parts[0];
    const b64 = parts.slice(1).join(',');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function chunkText(text, maxLen) {
    const t = String(text || '');
    if (t.length <= maxLen) return [t];
    const chunks = [];
    let rest = t;
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf('. ', maxLen);
      if (cut < maxLen * 0.4) cut = rest.lastIndexOf(' ', maxLen);
      if (cut < maxLen * 0.4) cut = maxLen;
      chunks.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) chunks.push(rest);
    return chunks;
  }
  function decodeEntities(s) {
    const ta = document.createElement('textarea');
    ta.innerHTML = s || '';
    return ta.value;
  }
  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }
  function dateKeyOffset(days) {
    return todayKey(new Date(Date.now() + days * 86400000));
  }
  const VOWELS = 'aeiouy';
  function syllables(word) {
    const raw = String(word || '');
    const w = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return [raw];
    if (w.length <= 3) return [w];
    const isV = (c) => VOWELS.indexOf(c) >= 0;
    const groups = [];
    let s = -1;
    for (let i = 0; i < w.length; i++) {
      if (isV(w[i])) { if (s < 0) s = i; }
      else if (s >= 0) { groups.push([s, i - 1]); s = -1; }
    }
    if (s >= 0) groups.push([s, w.length - 1]);
    if (groups.length < 2) return [w];
    let cuts = [0];
    for (let k = 0; k < groups.length - 1; k++) {
      const endV = groups[k][1];
      const startNext = groups[k + 1][0];
      const cluster = w.slice(endV + 1, startNext);
      let cut;
      if (cluster.length === 0) cut = startNext;
      else cut = endV + 1 + Math.floor(cluster.length / 2);
      if (cut > cuts[cuts.length - 1]) cuts.push(cut);
    }
    const parts = [];
    for (let i = 0; i < cuts.length; i++) {
      parts.push(w.slice(cuts[i], cuts[i + 1] === undefined ? w.length : cuts[i + 1]));
    }
    if (parts.length > 1 && /^[^aeiouy]*e$/.test(parts[parts.length - 1]) && parts[parts.length - 1].length <= 2) {
      const last = parts.pop();
      parts[parts.length - 1] += last;
    }
    return parts.filter(Boolean);
  }
  const DIGRAPHS = [
    ['tion', '\u0634\u0646'], ['sion', '\u0634\u0646'], ['ture', '\u062a\u0634\u0631'],
    ['igh', '\u0627\u064a'], ['ough', '\u0627\u0648'], ['ch', '\u062a\u0634'], ['sh', '\u0634'],
    ['th', '\u062b'], ['ph', '\u0641'], ['wh', '\u0648'], ['ck', '\u0643'], ['ng', '\u0646\u062c'],
    ['qu', '\u0643\u0648'], ['ee', '\u064a'], ['ea', '\u064a'], ['ai', '\u064a'], ['ay', '\u064a'],
    ['oo', '\u0648'], ['oa', '\u0648'], ['ou', '\u0627\u0648'], ['ow', '\u0627\u0648'], ['oi', '\u0648\u064a'],
    ['oy', '\u0648\u064a'], ['au', '\u0627\u0648'], ['aw', '\u0627\u0648'], ['ei', '\u064a'], ['ie', '\u064a']
  ];
  const CONS = { b: '\u0628', c: '\u0643', d: '\u062f', f: '\u0641', g: '\u062c', h: '\u0647', j: '\u062c', k: '\u0643', l: '\u0644', m: '\u0645', n: '\u0646', p: '\u0628', q: '\u0642', r: '\u0631', s: '\u0633', t: '\u062a', v: '\u0641', w: '\u0648', x: '\u0643\u0633', y: '\u064a', z: '\u0632' };
  const SHORT = { a: '\u064e', e: '\u0650', i: '\u0650', o: '\u064f', u: '\u064f' };
  const LONG = { a: '\u0627', e: '\u064a', i: '\u064a', o: '\u0648', u: '\u0648' };
  const INITIAL = { a: '\u0623', e: '\u0625', i: '\u0625', o: '\u0623\u0648', u: '\u0623' };
  function translitWord(word) {
    let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return '';
    let out = '';
    let i = 0;
    while (i < w.length) {
      const rest = w.slice(i);
      let matched = null;
      for (let d = 0; d < DIGRAPHS.length; d++) {
        if (rest.indexOf(DIGRAPHS[d][0]) === 0) { matched = DIGRAPHS[d]; break; }
      }
      if (matched) { out += matched[1]; i += matched[0].length; continue; }
      const c = w[i];
      if (CONS[c]) {
        if (w[i + 1] === c && CONS[c].length === 1 && 'aeiou'.indexOf(c) < 0) {
          out += CONS[c]; i += 2;
        } else {
          out += CONS[c]; i += 1;
        }
        continue;
      }
      if (SHORT[c]) {
        const isLast = i === w.length - 1;
        const isSilentE = c === 'e' && isLast && i > 1 && 'aeiou'.indexOf(w[i - 1]) < 0 && /[aeiou]/.test(w.slice(0, i - 1));
        if (isSilentE) { i += 1; continue; }
        if (isLast) { out += LONG[c]; i += 1; continue; }
        if (!out) { out += INITIAL[c]; i += 1; continue; }
        const next1 = w[i + 1];
        const next2 = w[i + 2];
        const openSyllable = CONS[next1] && next2 && 'aeiouy'.indexOf(next2) >= 0 && w[i + 3] !== undefined;
        const magicE = CONS[next1] && next2 === 'e' && w[i + 3] === undefined;
        if (openSyllable || magicE) out += LONG[c];
        else out += SHORT[c];
        i += 1;
        continue;
      }
      i += 1;
    }
    return out;
  }
  function translitText(text) {
    return String(text || '').split(/\s+/).map((w) => translitWord(w) || w).join(' ').trim();
  }
  function getContextAround(full, sel, pad) {
    const p = pad || 160;
    if (!full || !sel) return '';
    const i = full.indexOf(sel);
    if (i < 0) return full.slice(0, p * 2);
    return full.slice(Math.max(0, i - p), i + sel.length + p).replace(/\s+/g, ' ').trim();
  }
  function posArabic(pos) {
    const map = {
      noun: 'اسم', verb: 'فعل', adjective: 'صفة', adverb: 'حال', pronoun: 'ضمير',
      preposition: 'حرف جر', conjunction: 'حرف ربط', interjection: 'حرف نداء',
      determiner: 'أداة', numeral: 'عدد', article: 'أداة تعريف', phrase: 'عبارة',
      idiom: 'تعبير اصطلاحي', exclamation: 'تعجب'
    };
    const key = String(pos || '').toLowerCase().trim();
    return map[key] || pos || '';
  }
  function isMobile() { return window.matchMedia('(max-width: 767px)').matches; }
  function stripMarkup(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return {
    uid, qs, qsa, el, esc, escapeRe, normalizeWord, countWords, classify,
    todayKey, dateKeyOffset, formatDate, formatBytes, debounce, sleep, clamp,
    toast, modal, confirmBox, promptBox, download, readAsText, readAsDataURL,
    readAsArrayBuffer, dataURLToBlob, chunkText, decodeEntities, extOf,
    syllables, translitWord, translitText, getContextAround, posArabic,
    isMobile, stripMarkup
  };
})();
