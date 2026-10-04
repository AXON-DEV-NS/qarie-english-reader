window.Dictionary = (function () {
  const TYPE_LABEL = { word: 'كلمة', sentence: 'جملة', paragraph: 'فقرة' };
  const STATUS_LABEL = { new: 'جديدة', learning: 'قيد التعلّم', mastered: 'متقنة' };

  function statusOf(w) {
    if (w.status) return w.status;
    const reps = w.srs && w.srs.reps ? w.srs.reps : 0;
    return reps > 0 ? 'learning' : 'new';
  }

  async function render() {
    const list = document.getElementById('words-list');
    if (!list) return;
    const q = (document.getElementById('dict-search').value || '').trim().toLowerCase();
    const type = document.getElementById('dict-type').value;
    const fileId = document.getElementById('dict-file').value;
    const status = document.getElementById('dict-status').value;
    const sort = document.getElementById('dict-sort').value;

    let words = await DB.all('words');
    const files = await DB.all('files');

    const sel = document.getElementById('dict-file');
    const current = sel.value;
    sel.innerHTML = '<option value="all">كل الملفات</option>';
    files.forEach((f) => {
      const opt = U.el('option', { value: f.id, text: f.name });
      sel.appendChild(opt);
    });
    sel.value = files.some((f) => f.id === current) ? current : 'all';

    words = words.filter((w) => {
      if (q && (w.text || '').toLowerCase().indexOf(q) < 0 && (w.meaning || '').indexOf(q) < 0) return false;
      if (type !== 'all' && w.type !== type) return false;
      if (fileId !== 'all' && w.fileId !== fileId) return false;
      if (status !== 'all' && statusOf(w) !== status) return false;
      return true;
    });

    if (sort === 'oldest') words.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    else if (sort === 'alpha') words.sort((a, b) => String(a.text).localeCompare(String(b.text)));
    else if (sort === 'due') words.sort((a, b) => ((a.srs && a.srs.due) || 0) - ((b.srs && b.srs.due) || 0));
    else words.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const total = document.getElementById('dict-total');
    if (total) total.textContent = String(words.length);
    list.innerHTML = '';
    if (!words.length) {
      list.appendChild(U.el('div', { class: 'empty', text: 'قاموسك فارغ حالياً — حدّد كلمة أو جملة داخل أي ملف واضغط ⭐ حفظ.' }));
      return;
    }
    words.forEach((w) => list.appendChild(card(w)));
  }

  function card(w) {
    const status = statusOf(w);
    const top = U.el('div', { class: 'w-top' }, [
      U.el('span', { class: 'w-en', text: w.text }),
      w.pron ? U.el('span', { class: 'w-pron', text: '🔉 ' + w.pron }) : null,
      U.el('span', { class: 'chip tiny', text: TYPE_LABEL[w.type] || 'كلمة' }),
      w.pos ? U.el('span', { class: 'chip tiny alt', text: w.pos }) : null,
      U.el('span', { class: 'chip tiny alt', text: STATUS_LABEL[status] || '' })
    ].filter(Boolean));

    const body = U.el('div', {}, [U.el('div', { class: 'w-meaning', text: w.meaning || '' })]);
    if (w.examples && w.examples.length) {
      const ex = w.examples[0];
      body.appendChild(U.el('div', { class: 'w-ex' }, [
        U.el('div', { class: 'en', text: ex.en || '' }),
        ex.ar ? U.el('div', { class: 'ar', text: ex.ar }) : null
      ].filter(Boolean)));
    }
    if (w.entries && w.entries.length) {
      const ul = U.el('ul', { class: 'entries' });
      w.entries.slice(0, 3).forEach((e) => {
        if (!e.meaning) return;
        ul.appendChild(U.el('li', {}, [
          e.pos ? U.el('span', { class: 'chip tiny alt', text: e.pos }) : null,
          ' ',
          U.el('span', { text: e.meaning })
        ].filter(Boolean)));
      });
      if (ul.children.length) body.appendChild(ul);
    }

    const src = w.fileName ? (w.fileName + (w.location && w.location.page ? ' — صفحة ' + w.location.page : '')) : '';
    const foot = U.el('div', { class: 'w-foot' }, [
      src ? U.el('button', {
        class: 'btn small', title: 'الانتقال إلى موضعه في الملف', text: '📍 ' + src,
        onclick: async () => {
          if (!w.fileId) return;
          const f = await DB.get('files', w.fileId);
          if (!f) { U.toast('الملف الأصلي محذوف', 'warn'); return; }
          App.openFile(w.fileId, w.location);
        }
      }) : null,
      U.el('button', {
        class: 'btn small', text: '🔊', title: 'استماع',
        onclick: () => TTS.speak(w.text)
      }),
      U.el('button', {
        class: 'btn small', text: '🐢', title: 'نطق بطيء',
        onclick: () => TTS.speakSlow(w.text)
      }),
      U.el('button', {
        class: 'btn small', text: '🔤', title: 'نطق مقطعي',
        onclick: () => TTS.speakSyllables(w.text)
      }),
      U.el('button', {
        class: 'btn small', text: '✏️ تعديل', title: 'تعديل المعنى',
        onclick: async () => {
          const v = await U.promptBox('تعديل المعنى', w.meaning || '', 'المعنى بالعربية');
          if (v === null) return;
          w.meaning = v;
          w.updatedAt = Date.now();
          await DB.put('words', w);
          DB.changed();
          U.toast('تم التعديل ✓', 'ok');
          render();
        }
      }),
      U.el('button', {
        class: 'btn small danger', text: '🗑', title: 'حذف',
        onclick: async () => {
          const ok = await U.confirmBox('حذف', 'حذف «' + w.text + '» من قاموسي؟', 'حذف');
          if (!ok) return;
          await DB.del('words', w.id);
          DB.changed();
          render();
          Viewer.applyHighlights();
        }
      })
    ].filter(Boolean));

    const c = U.el('div', { class: 'word-card' }, [top, body, foot]);
    if (w.srs && w.srs.due) {
      const dueIn = Math.ceil((w.srs.due - Date.now()) / 86400000);
      c.appendChild(U.el('div', { class: 'muted tiny', text: dueIn <= 0 ? '⏰ مستحقة للمراجعة الآن' : '⏳ المراجعة بعد ' + dueIn + ' يوم' }));
    }
    return c;
  }

  function init() {
    ['dict-search', 'dict-type', 'dict-file', 'dict-status', 'dict-sort'].forEach((id) => {
      const n = document.getElementById(id);
      if (!n) return;
      n.addEventListener('change', render);
      if (id === 'dict-search') n.addEventListener('input', U.debounce(render, 200));
    });
    const csv = document.getElementById('btn-export-csv');
    if (csv) csv.addEventListener('click', async () => { Backup.exportWordsCSV(); });
    const anki = document.getElementById('btn-export-anki');
    if (anki) anki.addEventListener('click', async () => { Backup.exportWordsAnki(); });
  }

  return { init, render };
})();
