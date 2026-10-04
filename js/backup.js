window.Backup = (function () {
  async function exportAll() {
    U.toast('جارٍ تجهيز النسخة… قد يستغرق لحظات');
    try {
      const files = await DB.all('files');
      const outFiles = [];
      for (const f of files) {
        const copy = Object.assign({}, f);
        if (f.blob) {
          try { copy.blobData = await U.readAsDataURL(f.blob); } catch (e) {}
        }
        delete copy.blob;
        outFiles.push(copy);
      }
      const words = await DB.all('words');
      const settings = await DB.getMeta('settings', null);
      const stats = await DB.getMeta('stats', null);
      const syncMeta = await DB.getMeta('syncMeta', null);
      const payload = {
        app: 'qarie',
        version: 1,
        exportedAt: Date.now(),
        files: outFiles,
        words: words,
        meta: { settings: settings, stats: stats, syncMeta: syncMeta }
      };
      const name = 'qarie-backup-' + U.todayKey() + '.json';
      U.download(name, JSON.stringify(payload), 'application/json');
      U.toast('تم تصدير النسخة الاحتياطية ✓', 'ok');
    } catch (e) {
      console.error(e);
      U.toast('تعذّر التصدير: ' + (e.message || e), 'error');
    }
  }

  async function importAll(file) {
    if (!file) return;
    const ok = await U.confirmBox('استيراد نسخة احتياطية',
      'سيتم استبدال كل البيانات الحالية (الملفات والكلمات والإعدادات) بمحتوى النسخة. هل أنت متأكد؟', 'استيراد');
    if (!ok) return;
    try {
      const text = await U.readAsText(file);
      const data = JSON.parse(text);
      if (!data || data.app !== 'qarie') throw new Error('الملف ليس نسخة احتياطية صحيحة');
      await DB.clear('files');
      await DB.clear('words');
      const files = (data.files || []).map((f) => {
        const copy = Object.assign({}, f);
        if (copy.blobData) {
          try { copy.blob = U.dataURLToBlob(copy.blobData); } catch (e) {}
        }
        delete copy.blobData;
        return copy;
      });
      await DB.bulkPut('files', files);
      await DB.bulkPut('words', data.words || []);
      if (data.meta) {
        if (data.meta.settings) await DB.setMeta('settings', data.meta.settings);
        if (data.meta.stats) await DB.setMeta('stats', data.meta.stats);
        if (data.meta.syncMeta) await DB.setMeta('syncMeta', data.meta.syncMeta);
      }
      U.toast('تم الاستيراد ✓ — سيُعاد تحميل الموقع', 'ok');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      console.error(e);
      U.toast('تعذّر الاستيراد: ' + (e.message || e), 'error');
    }
  }

  function csvCell(v) {
    const s = String(v === null || v === undefined ? '' : v).replace(/"/g, '""');
    return '"' + s.replace(/\r?\n/g, ' ') + '"';
  }

  async function exportWordsCSV() {
    const words = await DB.all('words');
    if (!words.length) { U.toast('لا توجد كلمات للتصدير', 'warn'); return; }
    const header = ['English', 'Arabic', 'Pronunciation', 'Type', 'POS', 'Example EN', 'Example AR', 'File', 'Page', 'Added'];
    const rows = words.map((w) => {
      const ex = (w.examples && w.examples[0]) || {};
      return [
        w.text, w.meaning, w.pron, w.type, w.pos,
        ex.en || '', ex.ar || '',
        w.fileName || '', w.location && w.location.page ? w.location.page : '',
        new Date(w.createdAt || Date.now()).toISOString()
      ].map(csvCell).join(',');
    });
    const csv = '\ufeff' + header.map(csvCell).join(',') + '\n' + rows.join('\n');
    U.download('qarie-words-' + U.todayKey() + '.csv', csv, 'text/csv;charset=utf-8');
    U.toast('تم تصدير CSV ✓', 'ok');
  }

  async function exportWordsAnki() {
    const words = await DB.all('words');
    if (!words.length) { U.toast('لا توجد كلمات للتصدير', 'warn'); return; }
    const lines = ['#separator:Tab', '#html:true', '#columns:English\tArabic\tPronunciation\tType\tExample EN\tExample AR\tFile'];
    words.forEach((w) => {
      const ex = (w.examples && w.examples[0]) || {};
      const cols = [w.text, w.meaning, w.pron || '', w.type || '', ex.en || '', ex.ar || '', w.fileName || '']
        .map((c) => String(c === null || c === undefined ? '' : c).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>'));
      lines.push(cols.join('\t'));
    });
    U.download('qarie-anki-' + U.todayKey() + '.txt', lines.join('\n'), 'text/plain;charset=utf-8');
    U.toast('تم تصدير ملف Anki ✓', 'ok');
  }

  function init() {
    const ex = document.getElementById('btn-export-all');
    const imp = document.getElementById('import-file');
    if (ex) ex.addEventListener('click', exportAll);
    if (imp) imp.addEventListener('change', () => { importAll(imp.files[0]); imp.value = ''; });
  }

  return { init, exportAll, importAll, exportWordsCSV, exportWordsAnki };
})();
