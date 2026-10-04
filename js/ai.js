window.AI = (function () {
  const MINI = {
    hello: ['مرحباً / أهلاً', 'هَلُو'],
    hi: ['أهلاً', 'هاي'],
    hey: ['يا / أهلاً', 'هَي'],
    goodbye: ['وداعاً', 'جُود باي'],
    bye: ['وداعاً', 'باي'],
    please: ['من فضلك', 'بليز'],
    thanks: ['شكراً', 'ثانكس'],
    thank: ['يشكر', 'ثانك'],
    sorry: ['آسف', 'سوري'],
    yes: ['نعم', 'يِس'],
    no: ['لا', 'نُو'],
    maybe: ['ربما', 'ميبِي'],
    book: ['كتاب', 'بُوك'],
    pen: ['قلم', 'پِن'],
    pencil: ['قلم رصاص', 'پِنسِل'],
    paper: ['ورق / ورقة', 'پَيپَر'],
    teacher: ['مُعلِّم', 'تيتشَر'],
    student: ['طالب', 'ستيودِنت'],
    school: ['مدرسة', 'سكُول'],
    class: ['فصل / حصة', 'كلاس'],
    lesson: ['درس', 'لِسِن'],
    homework: ['واجب منزلي', 'هوم وُرك'],
    exam: ['اختبار', 'إگزام'],
    question: ['سؤال', 'كْوِستشِن'],
    answer: ['جواب / يجيب', 'آنصَر'],
    word: ['كلمة', 'وُرد'],
    sentence: ['جملة', 'سِنتِنس'],
    language: ['لغة', 'لانگْوِج'],
    english: ['الإنجليزية', 'إنگلِش'],
    arabic: ['العربية', 'عَرَبِك'],
    read: ['يقرأ', 'ريد'],
    write: ['يكتب', 'رايت'],
    speak: ['يتحدث', 'سبيك'],
    listen: ['يستمع', 'لِسِن'],
    learn: ['يتعلّم', 'لِرن'],
    study: ['يدرس / دراسة', 'ستَدِي'],
    understand: ['يفهم', 'أندَرستاند'],
    remember: ['يتذكر', 'رِمِمبَر'],
    forget: ['ينسى', 'فورگِت'],
    know: ['يعرف', 'نُو'],
    think: ['يفكر / يظن', 'ثينك'],
    want: ['يريد', 'وُنت'],
    need: ['يحتاج', 'نيد'],
    like: ['يحب / مثل', 'لايك'],
    love: ['حب / يحب', 'لَف'],
    help: ['يساعد / مساعدة', 'هِلب'],
    work: ['عمل / يعمل', 'وُرك'],
    play: ['يلعب', 'پلاي'],
    go: ['يذهب', 'گُو'],
    come: ['يأتي', 'كَم'],
    see: ['يرى', 'سي'],
    look: ['ينظر', 'لُوك'],
    hear: ['يسمع', 'هير'],
    say: ['يقول', 'سَي'],
    tell: ['يخبر', 'تِل'],
    give: ['يعطي', 'گِف'],
    take: ['يأخذ', 'تَيك'],
    make: ['يصنع / يجعل', 'مَيك'],
    do: ['يفعل', 'دُو'],
    have: ['يملك / لديه', 'هاف'],
    be: ['يكون', 'بي'],
    good: ['جيد', 'گُود'],
    bad: ['سيئ', 'باد'],
    big: ['كبير', 'بِگ'],
    small: ['صغير', 'سمُول'],
    new: ['جديد', 'نيو'],
    old: ['قديم / عجوز', 'أولد'],
    happy: ['سعيد', 'هاپي'],
    sad: ['حزين', 'ساد'],
    easy: ['سهل', 'إيزي'],
    difficult: ['صعب', 'دِفِكُلت'],
    hot: ['حار', 'هات'],
    cold: ['بارد', 'كُولد'],
    water: ['ماء', 'وُوتَر'],
    food: ['طعام', 'فُود'],
    time: ['وقت', 'تايم'],
    day: ['يوم', 'دَي'],
    night: ['ليل', 'نايت'],
    morning: ['صباح', 'مورنِنگ'],
    friend: ['صديق', 'فرِند'],
    family: ['عائلة', 'فامِلي'],
    home: ['بيت / منزل', 'هوم'],
    house: ['منزل', 'هاوس'],
    city: ['مدينة', 'سِتي'],
    country: ['بلد / دولة', 'كَنتري'],
    world: ['عالم', 'وُورلد'],
    life: ['حياة', 'لايف'],
    people: ['ناس / شعب', 'پيپِل'],
    man: ['رجل', 'مان'],
    woman: ['امرأة', 'وُمَن'],
    child: ['طفل', 'تشايلد'],
    money: ['مال / نقود', 'مَني'],
    car: ['سيارة', 'كار'],
    phone: ['هاتف', 'فُون'],
    computer: ['حاسوب', 'كُمپيوتَر'],
    internet: ['إنترنت', 'إنترنِت'],
    music: ['موسيقى', 'ميوزِك'],
    movie: ['فيلم', 'مُوڤي'],
    beautiful: ['جميل', 'بيوتِفُل'],
    important: ['مهم', 'إمپُورتِنت'],
    because: ['لأن', 'بِكُوز'],
    about: ['حول / عن', 'أباوت'],
    with: ['مع', 'وِث'],
    without: ['بدون', 'وِثاوت'],
    before: ['قبل', 'بِفُور'],
    after: ['بعد', 'آفتَر'],
    always: ['دائماً', 'أُلوِيز'],
    never: ['أبداً', 'نِڤَر'],
    sometimes: ['أحياناً', 'سَمتايمز'],
    today: ['اليوم', 'تُودَي'],
    tomorrow: ['غداً', 'تُومُورُو'],
    yesterday: ['أمس', 'يِستَردَي'],
    now: ['الآن', 'ناو'],
    here: ['هنا', 'هير'],
    there: ['هناك', 'ثِير'],
    how: ['كيف', 'هاو'],
    what: ['ماذا', 'وُت'],
    when: ['متى', 'وِن'],
    where: ['أين', 'وير'],
    why: ['لماذا', 'واي'],
    who: ['من', 'هُو'],
    which: ['أي', 'وِتش'],
    'words to know': ['كلمات يجب معرفتها', 'وُوردز تو نُو'],
    'self-image': ['الصورة الذاتية', 'سِلف إيمِج'],
    'fast-changing': ['سريع التغيّر', 'فاست تشينجِنغ'],
    'play a major role': ['يلعب دوراً رئيسياً', 'پلَي أ مَيجَر رول'],
    shape: ['يُشكّل / يؤثر في', 'شَيب'],
    teenager: ['مراهق', 'تين إيجَر'],
    inspire: ['يُلهم / يحفّز', 'إنسبايَر'],
    healthy: ['صحي', 'هِلثي'],
    habit: ['عادة', 'هابِت'],
    positive: ['إيجابي', 'پوزِتِف'],
    unrealistic: ['غير واقعي', 'أنريلِستِك'],
    expectation: ['توقّع', 'إكسبِكتيشِن'],
    pressure: ['ضغط', 'پرِشَر'],
    decade: ['عقد (١٠ سنوات)', 'دِكيد'],
    transform: ['يحوّل / يغيّر', 'ترانسفورم'],
    stage: ['مرحلة / خشبة المسرح', 'ستِيج'],
    perform: ['يؤدي / يقوم بـ', 'پرفورم'],
    version: ['نسخة', 'ڤيرژِن'],
    sensitive: ['حسّاس', 'سِنسِتِف'],
    significant: ['مهم / كبير', 'سيگنِفِكِنت'],
    research: ['بحث / يبحث', 'رِسيرتش'],
    platform: ['منصة', 'پلَتفورم'],
    platforms: ['منصات', 'پلَتفورمز'],
    contact: ['تواصل / يتواصل', 'كونتاكت'],
    individual: ['فرد / فردي', 'إندِڤيدوَل'],
    individuals: ['أفراد', 'إندِڤيدوَلز'],
    model: ['نموذج / منشئ', 'مودِل'],
    particular: ['خاص / معيّن', 'پَرتِكيولَر'],
    identity: ['هوية', 'آيدِنتِتي'],
    formation: ['تكوين', 'فورميشِن'],
    psychological: ['نفسي', 'سايكولوجِكَل'],
    result: ['نتيجة', 'رِزَلت'],
    published: ['نُشر', 'پَبليشد'],
    association: ['جمعية / رابطة', 'أسوسييشِن'],
    spend: ['يمضي / ينفق', 'سبِند'],
    'image-based': ['قائم على الصور', 'إيمِج بيست'],
    likely: ['محتمل', 'لايكلي'],
    symptom: ['عرَض', 'سِمتُم'],
    dissatisfaction: ['عدم الرضا', 'دِسساتِسفاكشِن'],
    compare: ['يقارن', 'كُمپير'],
    communication: ['تواصل', 'كُميونِكيشِن'],
    tool: ['أداة', 'تُول'],
    tools: ['أدوات', 'تُولز'],
    carefully: ['بعناية', 'كيرفُلي'],
    construct: ['يبني / يشكّل', 'كُنسترَكت'],
    'self-esteem': ['احترام الذات', 'سِلف إستيم'],
    'social media': ['وسائل التواصل الاجتماعي', 'سوشَل ميديا'],
    'spent': ['أمضى / أنفق', 'سبِنت']
  };

  const MODELS = {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    gemini: { baseUrl: '', model: 'gemini-1.5-flash' },
    anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-latest' }
  };

  function hasAI() {
    const ai = Settings.all().ai;
    return !!(ai && ai.provider && ai.provider !== 'none' && ai.key);
  }

  function friendlyError(e) {
    const m = String((e && e.message) || e || '');
    if (/ألغ|abort/i.test(m)) return 'تم إلغاء الطلب';
    if (/401|403|invalid api key|incorrect api key|unauthorized|api key/i.test(m)) {
      return 'المفتاح غير صحيح أو منتهي';
    }
    if (/429|rate limit|quota|exceeded/i.test(m)) return 'تجاوزت حد الاستخدام، انتظر قليلاً';
    if (/5\d\d|overloaded|unavailable/i.test(m)) return 'خدمة الذكاء الاصطناعي غير متاحة الآن';
    if (/Failed to fetch|NetworkError|load failed|Network request failed/i.test(m)) return 'تعذّر الاتصال بالإنترنت';
    return m || 'خطأ غير معروف';
  }

  function parseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(t); } catch (e) {}
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    return null;
  }

  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  }
  function fetchWithTimeout(url, ms, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, Object.assign({}, options || {}, { signal: ctrl.signal })).finally(() => clearTimeout(timer));
  }

  async function callAI(system, user, opts) {
    const o = opts || {};
    const ai = Settings.all().ai;
    if (!hasAI()) throw new Error('لا يوجد مفتاح AI');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeout || 25000);
    if (o.signal) {
      if (o.signal.aborted) ctrl.abort();
      else o.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    const maxTokens = o.maxTokens || 400;
    try {
      if (ai.provider === 'gemini') {
        const model = ai.model || MODELS.gemini.model;
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
          ':generateContent?key=' + encodeURIComponent(ai.key);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
          })
        });
        if (!res.ok) throw new Error('AI HTTP ' + res.status);
        const j = await res.json();
        const t = j.candidates && j.candidates[0] && j.candidates[0].content &&
          j.candidates[0].content.parts && j.candidates[0].content.parts[0] &&
          j.candidates[0].content.parts[0].text;
        if (!t) throw new Error('رد فارغ من AI');
        return t;
      }
      if (ai.provider === 'anthropic') {
        const base = (ai.baseUrl || MODELS.anthropic.baseUrl).replace(/\/+$/, '');
        const res = await fetch(base + '/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ai.key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: ai.model || MODELS.anthropic.model,
            max_tokens: maxTokens,
            system: system,
            messages: [{ role: 'user', content: user }]
          })
        });
        if (!res.ok) throw new Error('AI HTTP ' + res.status);
        const j = await res.json();
        const part = (j.content || []).find((c) => c && c.type === 'text');
        if (!part || !part.text) throw new Error('رد فارغ من AI');
        return part.text;
      }
      const base = (ai.baseUrl || MODELS.openai.baseUrl).replace(/\/+$/, '');
      const body = {
        model: ai.model || MODELS.openai.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      };
      let res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.key },
        signal: ctrl.signal,
        body: JSON.stringify(body)
      });
      if (res.status === 400) {
        delete body.response_format;
        res = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.key },
          signal: ctrl.signal,
          body: JSON.stringify(body)
        });
      }
      if (!res.ok) throw new Error('AI HTTP ' + res.status);
      const j = await res.json();
      const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!t) throw new Error('رد فارغ من AI');
      return t;
    } finally {
      clearTimeout(timer);
    }
  }

  const SYS_WORD = 'أنت قاموس إنجليزي-عربي مدرسي. تجيب بكائن JSON صحيح فقط دون أي نص إضافي.';
  const SYS_SENT = 'أنت مترجم إنجليزي-عربي دقيق وسريع. تجيب بكائن JSON صحيح فقط دون أي نص إضافي.';

  function wordPrompt(text, context) {
    return 'الكلمة أو العبارة: "' + text + '"\n' +
      (context ? 'السياق: "' + String(context).slice(0, 300) + '"\n' : '') +
      'أعد JSON فقط:\n' +
      '{"m":"معنى مختصر بالعربية حسب السياق","p":"اسم/فعل/صفة/حال/عبارة","pron":"النطق بالحروف العربية مع التشكيل","ex":{"en":"جملة إنجليزية قصيرة","ar":"ترجمتها"}}';
  }
  function sentPrompt(text) {
    return 'ترجم النص إلى العربية الفصحى ترجمة كاملة وواضحة:\n"' + String(text).slice(0, 1200) + '"\n' +
      'أعد JSON فقط: {"t":"الترجمة"}';
  }

  async function aiLookup(text, type, context, signal) {
    if (type === 'word') {
      const out = await callAI(SYS_WORD, wordPrompt(text, context), { maxTokens: 260, signal: signal });
      const j = parseJson(out);
      if (!j || !(j.m || j.meaning)) throw new Error('رد غير مفهوم من AI');
      const m = j.m || j.meaning;
      const p = j.p || j.pos || '';
      const ex = j.ex || (Array.isArray(j.examples) ? j.examples[0] : null);
      return {
        meaning: String(m),
        pos: U.posArabic(p) || String(p),
        pron: String(j.pron || ''),
        ipa: '',
        syllables: U.syllables(text),
        entries: [],
        synonyms: [],
        examples: ex && (ex.en || ex.english) ? [{ en: String(ex.en || ex.english), ar: String(ex.ar || ex.arabic || '') }] : [],
        source: 'ai'
      };
    }
    const out = await callAI(SYS_SENT, sentPrompt(text), { maxTokens: 600, signal: signal });
    const j = parseJson(out);
    const tr = (j && (j.t || j.meaning)) ? String(j.t || j.meaning) : String(out || '').trim();
    if (!tr) throw new Error('رد غير مفهوم من AI');
    return {
      meaning: tr, pos: '', pron: '', ipa: '',
      entries: [], examples: [], synonyms: [], syllables: [], source: 'ai'
    };
  }

  async function translateFree(text) {
    const chunks = U.chunkText(text, 440);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunks[i]) + '&langpair=en|ar';
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) throw new Error('تعذّرت الترجمة المجانية');
      const j = await res.json();
      const tr = j && j.responseData && j.responseData.translatedText;
      if (!tr) throw new Error('تعذّرت الترجمة المجانية');
      out.push(U.decodeEntities(tr));
    }
    return out.join(' ');
  }

  async function dictApi(word) {
    try {
      const res = await fetchWithTimeout('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), 5000);
      if (!res.ok) return null;
      const j = await res.json();
      if (!Array.isArray(j) || !j[0]) return null;
      const first = j[0];
      const phonetic = first.phonetic || ((first.phonetics || []).find((p) => p && p.text) || {}).text || '';
      const meanings = (first.meanings || []).map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: (m.definitions || []).slice(0, 1)
      }));
      const synonyms = [];
      (first.meanings || []).forEach((m) => (m.synonyms || []).forEach((s) => { if (synonyms.length < 6) synonyms.push(s); }));
      return { phonetic: phonetic, meanings: meanings, synonyms: synonyms };
    } catch (e) {
      return null;
    }
  }

  async function wordFreeLookup(text) {
    const rawKey = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
    const w = U.normalizeWord(text) || rawKey;
    const miniHit = MINI[rawKey] || MINI[w];
    if (miniHit) {
      return {
        meaning: miniHit[0], pos: '', pron: miniHit[1], ipa: '',
        entries: [], examples: [], synonyms: [], syllables: U.syllables(w), source: 'mini'
      };
    }
    const dictP = dictApi(w);
    const trP = translateFree(text).catch(() => '');
    let meaning = await trP;
    const dict = await Promise.race([dictP, U.sleep(1300).then(() => null)]);
    const entries = [];
    if (dict && dict.meanings) {
      dict.meanings.slice(0, 2).forEach((m) => {
        const def = m.definitions && m.definitions[0] ? m.definitions[0].definition : '';
        entries.push({ pos: U.posArabic(m.partOfSpeech), meaning: def });
      });
    }
    if (!meaning && entries.length) {
      meaning = await withTimeout(translateFree(entries[0].meaning), 8000, '');
    }
    if (!meaning) meaning = entries.map((e) => e.meaning).slice(0, 2).join(' — ') || '—';
    const examples = [];
    if (dict && dict.meanings && dict.meanings[0] && dict.meanings[0].definitions && dict.meanings[0].definitions[0] && dict.meanings[0].definitions[0].example) {
      const en = dict.meanings[0].definitions[0].example;
      const ar = await withTimeout(translateFree(en), 8000, '');
      examples.push({ en: en, ar: ar });
    }
    return {
      meaning: meaning,
      pos: entries[0] ? entries[0].pos : '',
      pron: U.translitWord(w),
      ipa: (dict && dict.phonetic) || '',
      entries: entries,
      examples: examples,
      synonyms: (dict && dict.synonyms) || [],
      syllables: U.syllables(w),
      source: 'free'
    };
  }

  async function freeLookup(text, type) {
    if (type === 'word') return wordFreeLookup(text);
    const meaning = await translateFree(text);
    return {
      meaning: meaning, pos: '', pron: '', ipa: '',
      entries: [], examples: [], synonyms: [], syllables: [], source: 'free'
    };
  }

  const cache = {};

  async function lookup(text, context, opts) {
    const o = opts || {};
    const t = String(text || '').trim();
    if (!t) return null;
    const type = U.classify(t);
    const key = 'lu:' + type + ':' + t.toLowerCase().replace(/\s+/g, ' ').slice(0, 180);
    if (cache[key]) return cache[key];
    const cached = await DB.cacheGet(key);
    if (cached && cached.meaning) { cache[key] = cached; return cached; }
    let res = null;
    let aiError = null;
    if (hasAI()) {
      try {
        res = await aiLookup(t, type, context, o.signal);
      } catch (e) {
        if (/abort/i.test(e && e.name || '') || /ألغ|abort/i.test(e && e.message || '')) throw e;
        aiError = e;
        res = null;
      }
    }
    if (!res) {
      try {
        res = await withTimeout(freeLookup(t, type), 18000, null);
      } catch (e) {
        if (!aiError) throw e;
        res = null;
      }
    }
    if (!res && aiError) {
      const err = new Error(friendlyError(aiError));
      err.friendly = true;
      throw err;
    }
    if (!res) {
      const err = new Error('تأخّر جلب المعنى — تحقّق من الإنترنت أو أضف مفتاح AI من الإعدادات');
      err.friendly = true;
      throw err;
    }
    res.text = t;
    res.type = type;
    if (aiError) res.note = friendlyError(aiError);
    if (res.meaning && res.meaning !== '—') {
      cache[key] = res;
      const ttl = type === 'word' ? 30 * 86400000 : 7 * 86400000;
      DB.cacheSet(key, res, ttl).catch(() => {});
    }
    return res;
  }

  async function pronounce(text, opts) {
    const o = opts || {};
    const t = String(text || '').trim();
    if (!t) return '';
    const key = 'pr:' + U.normalizeWord(t).slice(0, 120);
    if (cache[key]) return cache[key];
    const cached = await DB.cacheGet(key);
    if (cached && cached.pron) { cache[key] = cached; return cached.pron; }
    let pron = '';
    if (hasAI()) {
      try {
        const out = await callAI('أعد JSON فقط.', 'اكتب نطق هذا النص بالحروف العربية مع التشكيل:\n"' + t.slice(0, 300) + '"\nأعد {"pron":"النطق"}', { maxTokens: 160, signal: o.signal });
        const j = parseJson(out);
        if (j && j.pron) pron = String(j.pron);
      } catch (e) {}
    }
    if (!pron) pron = U.translitText(t);
    cache[key] = { pron: pron };
    DB.cacheSet(key, { pron: pron }, 90 * 86400000).catch(() => {});
    return pron;
  }

  async function test() {
    const out = await callAI('أعد JSON صحيحاً فقط.', 'أعد {"ok":true,"msg":"مرحباً"} فقط.', { maxTokens: 60, timeout: 20000 });
    const j = parseJson(out);
    if (!j) throw new Error('لم يصل JSON صحيح');
    return JSON.stringify(j);
  }

  return { lookup, pronounce, translateFree, test, hasAI, parseJson, friendlyError, MINI, MODELS };
})();
