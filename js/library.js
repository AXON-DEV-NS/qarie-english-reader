window.Library = (function () {
  const ICONS = {
    pdf: '📕', doc: '📘', docx: '📘', txt: '📄', epub: '📗',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', webp: '🖼️', gif: '🖼️', bmp: '🖼️'
  };
  const ACCEPT = ['pdf', 'doc', 'docx', 'txt', 'epub', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

  async function handleUpload(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    let added = 0;
    for (const f of files) {
      const ext = U.extOf(f.name);
      if (ACCEPT.indexOf(ext) < 0) {
        U.toast(f.name + ': صيغة غير مدعومة', 'warn');
        continue;
      }
      const rec = {
        id: U.uid(),
        name: f.name,
        ext: ext,
        size: f.size,
        mime: f.type || '',
        blob: f,
        addedAt: Date.now(),
        updatedAt: Date.now(),
        lastOpened: 0,
        lastLocation: null,
        progress: 0,
        ocr: {},
        hasText: false
      };
      await DB.put('files', rec);
      added++;
    }
    if (added) {
      U.toast('أُضيف ' + added + ' ملف إلى مكتبتي ✓', 'ok');
      DB.changed();
      render();
    }
  }

  async function render() {
    const grid = document.getElementById('files-grid');
    if (!grid) return;
    const q = (document.getElementById('lib-search').value || '').trim().toLowerCase();
    let files = await DB.all('files');
    const total = files.length;
    files = files.filter((f) => !q || f.name.toLowerCase().indexOf(q) >= 0);
    files.sort((a, b) => (b.lastOpened || b.addedAt || 0) - (a.lastOpened || a.addedAt || 0));
    const hero = document.getElementById('start-hero');
    if (hero) hero.classList.toggle('hidden', total > 0);
    grid.innerHTML = '';
    if (!files.length) {
      grid.appendChild(U.el('div', { class: 'empty', text: q ? 'لا نتائج للبحث.' : 'لا توجد ملفات بعد — ارفع أول ملف من الأعلى ☝️' }));
    }
    const words = await DB.all('words');
    files.forEach((f) => grid.appendChild(card(f, words)));
    updateStorage();
  }

  function card(f, words) {
    const icon = ICONS[f.ext] || '📄';
    const thumb = U.el('div', { class: 'file-thumb', text: icon });
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].indexOf(f.ext) >= 0 && f.blob) {
      const url = URL.createObjectURL(f.blob);
      const img = U.el('img', { src: url, alt: '' });
      img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      thumb.textContent = '';
      thumb.appendChild(img);
    }
    const count = words.filter((w) => w.fileId === f.id).length;
    const sub = [];
    sub.push(U.formatBytes(f.size));
    sub.push(f.ext.toUpperCase());
    if (f.lastOpened) sub.push('آخر قراءة: ' + U.formatDate(f.lastOpened));
    else sub.push('أُضيف: ' + U.formatDate(f.addedAt));
    if (count) sub.push('⭐ ' + count + ' محفوظة');
    const meta = U.el('div', { class: 'file-meta' }, [
      U.el('div', { class: 'file-name', title: f.name, text: f.name }),
      U.el('div', { class: 'file-sub', text: sub.join(' · ') })
    ]);
    if (f.progress) {
      meta.appendChild(U.el('div', { class: 'progressbar' }, [U.el('div', { style: 'width:' + Math.round(f.progress) + '%' })]));
    }
    const actions = U.el('div', { class: 'file-actions' }, [
      U.el('button', {
        class: 'btn small primary',
        text: f.lastOpened ? 'متابعة' : 'فتح',
        onclick: (e) => { e.stopPropagation(); App.openFile(f.id); }
      }),
      U.el('button', {
        class: 'btn small danger',
        text: 'حذف',
        onclick: async (e) => {
          e.stopPropagation();
          const ok = await U.confirmBox('حذف الملف', 'هل تريد حذف «' + f.name + '» من مكتبتي؟ (الكلمات المحفوظة تبقى في قاموسي)', 'حذف');
          if (!ok) return;
          await DB.del('files', f.id);
          DB.changed();
          U.toast('تم حذف الملف');
          render();
        }
      })
    ]);
    const c = U.el('div', { class: 'file-card' }, [thumb, meta, actions]);
    c.addEventListener('click', () => App.openFile(f.id));
    return c;
  }

  async function updateStorage() {
    const info = document.getElementById('storage-info');
    if (!info) return;
    let used = 0;
    try {
      const files = await DB.all('files');
      used = files.reduce((s, f) => s + (f.size || 0), 0);
    } catch (e) {}
    let text = 'الملفات: ' + U.formatBytes(used);
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined && est.quota) {
          text += ' · استُخدم من المتصفح: ' + U.formatBytes(est.usage) + ' / ' + U.formatBytes(est.quota);
        }
      }
    } catch (e) {}
    info.textContent = text;
  }

  function init() {
    const dz = document.getElementById('dropzone');
    const input = document.getElementById('file-input');
    const search = document.getElementById('lib-search');
    const heroBtn = document.getElementById('hero-upload');
    if (heroBtn && input) heroBtn.addEventListener('click', () => input.click());
    if (dz && input) {
      dz.addEventListener('click', (e) => { if (e.target === input) return; input.click(); });
      input.addEventListener('change', () => { handleUpload(input.files); input.value = ''; });
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
      dz.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) handleUpload(e.dataTransfer.files);
      });
      document.addEventListener('dragover', (e) => e.preventDefault());
      document.addEventListener('drop', (e) => {
        if (e.target && e.target.closest && e.target.closest('#dropzone')) return;
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }
      });
    }
    if (search) search.addEventListener('input', U.debounce(render, 200));
  }

  return { init, render, handleUpload, updateStorage };
})();
