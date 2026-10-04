window.Settings = (function () {
  const DEFAULTS = {
    theme: 'auto',
    accent: 'en-US',
    rate: 1,
    autoSpeak: false,
    readerFontSize: 100,
    ai: {
      provider: 'none',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      key: ''
    },
    supabase: { url: '', key: '' }
  };
  let data = JSON.parse(JSON.stringify(DEFAULTS));

  async function load() {
    const saved = await DB.getMeta('settings', null);
    if (saved && typeof saved === 'object') {
      data = Object.assign({}, DEFAULTS, saved);
      data.ai = Object.assign({}, DEFAULTS.ai, saved.ai || {});
      data.supabase = Object.assign({}, DEFAULTS.supabase, saved.supabase || {});
    }
    return data;
  }
  function all() { return data; }
  async function save(patch) {
    Object.assign(data, patch || {});
    if (patch && patch.ai) data.ai = Object.assign({}, data.ai, patch.ai);
    if (patch && patch.supabase) data.supabase = Object.assign({}, data.supabase, patch.supabase);
    await DB.setMeta('settings', data);
    document.dispatchEvent(new CustomEvent('settings:changed', { detail: data }));
    return data;
  }

  const SQL = [
    'create table if not exists public.files (',
    '  id text primary key,',
    '  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,',
    '  name text, ext text, size bigint, mime text,',
    '  last_location jsonb, progress numeric default 0,',
    '  ocr jsonb default \'{}\'::jsonb,',
    '  added_at bigint, updated_at bigint,',
    '  storage_path text',
    ');',
    'alter table public.files enable row level security;',
    'create policy "files_own" on public.files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
    '',
    'create table if not exists public.words (',
    '  id text primary key,',
    '  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,',
    '  text text, type text, meaning text, pron text, ipa text, pos text,',
    '  entries jsonb, examples jsonb, syllables jsonb, synonyms jsonb,',
    '  file_id text, file_name text, location jsonb, context text,',
    '  srs jsonb, status text,',
    '  created_at bigint, updated_at bigint',
    ');',
    'alter table public.words enable row level security;',
    'create policy "words_own" on public.words for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
    '',
    'insert into storage.buckets (id, name, public) values (\'files\', \'files\', false) on conflict (id) do nothing;',
    'create policy "files_storage_read" on storage.objects for select using (bucket_id = \'files\' and (storage.foldername(name))[1] = auth.uid()::text);',
    'create policy "files_storage_insert" on storage.objects for insert with check (bucket_id = \'files\' and (storage.foldername(name))[1] = auth.uid()::text);',
    'create policy "files_storage_update" on storage.objects for update using (bucket_id = \'files\' and (storage.foldername(name))[1] = auth.uid()::text);',
    'create policy "files_storage_delete" on storage.objects for delete using (bucket_id = \'files\' and (storage.foldername(name))[1] = auth.uid()::text);'
  ].join('\n');

  function applyTheme() {
    const t = data.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : data.theme;
    document.documentElement.dataset.theme = t;
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b1220' : '#0d9488');
  }

  function initUI() {
    const g = (id) => document.getElementById(id);
    const theme = g('set-theme');
    const accent = g('set-accent');
    const rate = g('set-rate');
    const font = g('set-font');
    const autospeak = g('set-autospeak');
    const provider = g('set-provider');
    const baseurl = g('set-baseurl');
    const model = g('set-model');
    const key = g('set-key');
    const sbUrl = g('set-sb-url');
    const sbKey = g('set-sb-key');

    if (theme) theme.addEventListener('change', () => save({ theme: theme.value }).then(applyTheme));
    if (accent) accent.addEventListener('change', () => save({ accent: accent.value }));
    if (rate) rate.addEventListener('change', () => save({ rate: parseFloat(rate.value) }));
    if (font) font.addEventListener('input', () => {
      const v = parseInt(font.value, 10) || 100;
      document.documentElement.style.setProperty('--reader-scale', String(v / 100));
      save({ readerFontSize: v });
    });
    if (autospeak) autospeak.addEventListener('change', () => save({ autoSpeak: autospeak.checked }));
    if (provider) provider.addEventListener('change', () => {
      const p = provider.value;
      if (p === 'gemini' && (!model.value || /gpt/.test(model.value))) model.value = 'gemini-1.5-flash';
      if (p === 'openai' && (!model.value || /gemini/.test(model.value))) model.value = 'gpt-4o-mini';
      saveAI();
    });
    [baseurl, model, key].forEach((inp) => { if (inp) inp.addEventListener('change', saveAI); });
    if (sbUrl) sbUrl.addEventListener('change', () => save({ supabase: { url: sbUrl.value.trim(), key: sbKey.value.trim() } }));
    if (sbKey) sbKey.addEventListener('change', () => save({ supabase: { url: sbUrl.value.trim(), key: sbKey.value.trim() } }));

    function saveAI() {
      save({ ai: { provider: provider.value, baseUrl: baseurl.value.trim(), model: model.value.trim(), key: key.value.trim() } });
      const st = g('ai-status');
      if (st) st.textContent = provider.value === 'none' ? 'الوضع المجاني فقط' : 'سيُختبر الاتصال عند أول استخدام';
    }

    const testBtn = g('btn-test-ai');
    if (testBtn) testBtn.addEventListener('click', async () => {
      const st = g('ai-status');
      const s = all().ai;
      if (s.provider === 'none' || !s.key) { if (st) st.textContent = 'أدخل مفتاحاً أولاً'; return; }
      if (st) st.textContent = 'جارٍ الاختبار…';
      testBtn.disabled = true;
      try {
        const out = await AI.test();
        if (st) st.textContent = '✅ نجح الاتصال: ' + String(out).slice(0, 40);
      } catch (e) {
        if (st) st.textContent = '❌ فشل: ' + (e.message || e);
      } finally {
        testBtn.disabled = false;
      }
    });

    const copySql = g('btn-copy-sql');
    if (copySql) copySql.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SQL);
        U.toast('تم نسخ SQL');
      } catch (e) {
        U.toast('تعذّر النسخ تلقائياً، انسخه يدوياً', 'warn');
      }
    });
  }

  function renderUI() {
    const g = (id) => document.getElementById(id);
    const set = (id, val) => { const n = g(id); if (n) n.value = val; };
    set('set-theme', data.theme);
    set('set-accent', data.accent);
    set('set-rate', String(data.rate));
    set('set-font', String(data.readerFontSize));
    const autospeak = g('set-autospeak');
    if (autospeak) autospeak.checked = !!data.autoSpeak;
    set('set-provider', data.ai.provider);
    set('set-baseurl', data.ai.baseUrl);
    set('set-model', data.ai.model);
    set('set-key', data.ai.key);
    set('set-sb-url', data.supabase.url);
    set('set-sb-key', data.supabase.key);
    const sql = g('sql-text');
    if (sql) sql.textContent = SQL;
    document.documentElement.style.setProperty('--reader-scale', String((data.readerFontSize || 100) / 100));
  }

  return { DEFAULTS, SQL, load, all, save, applyTheme, initUI, renderUI };
})();
