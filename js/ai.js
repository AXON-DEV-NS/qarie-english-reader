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
    which: ['أي', 'وِتش']
  };

  function hasAI() {
    const ai = Settings.all().ai;
    return !!(ai && ai.provider && ai.provider !== 'none' && ai.key);
  }

  function parseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(t); } catch (e) {}
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) {}
    }
    return null;
  }

  async function callAI(system, user) {
    const ai = Settings.all().ai;
    if (!hasAI()) throw new Error('لا يوجد مفتاح AI');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      if (ai.provider === 'gemini') {
        const model = ai.model || 'gemini-1.5-flash';
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
          ':generateContent?key=' + encodeURIComponent(ai.key);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
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
      const base = (ai.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const body = {
        model: ai.model || 'gpt-4o-mini',
        temperature: 0.2,
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

  const SYS = 'أنت معجم ومترجم إنجليزي-عربي خبير لتعليم اللغة للناطقين بالعربية. ' +
    'تجيب دائماً بكائن JSON صحيح فقط، دون أي شرح إضافي ودون أسطر برمجية ودون نص قبل JSON أو بعده.';

  function buildPrompt(text, type, context) {
    const kind = type === 'word' ? 'كلمة' : (type === 'sentence' ? 'جملة' : 'فقرة');
    return 'النص المحدد: "' + text + '"\n' +
      'نوعه: ' + kind + '\n' +
      (context ? 'السياق الذي ورد فيه: "' + context.slice(0, 700) + '"\n' : '') +
      'أعد كائن JSON بهذه الحقول:\n' +
      '{\n' +
      '  "meaning": "المعنى أو الترجمة الكاملة بالعربية الفصحى الواضحة (للكلمة: حسب السياق)",\n' +
      '  "pos": "نوع الكلمة بالعربية: اسم/فعل/صفة/حال/حرف جر/عبارة (للكلمة فقط)",\n' +
      '  "pron": "النطق التقريبي بالحروف العربية مع التشكيل الكامل (مثال: hello -> هَلُو)",\n' +
      '  "ipa": "النطق بالرموز الصوتية إن أمكن (للكلمة فقط، وإلا اتركه فارغاً)",\n' +
      '  "syllables": ["المقاطع الصوتية للكلمة بالإنجليزية فقط"],\n' +
      '  "entries": [{"pos": "اسم", "meaning": "أهم المعاني الأخرى" }],\n' +
      '  "examples": [{"en": "جملة إنجليزية مناسبة", "ar": "ترجمتها العربية"}],\n' +
      '  "synonyms": ["مرادفات إنجليزية"]\n' +
      '}\n' +
      'إذا كان النص جملة أو فقرة: اجعل type الحقل meaning ترجمة كاملة سليمة، وpron نطقاً عربياً تقريبياً للنص، والمقاطع فارغة.';
  }

  function normalizeEntries(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, 5).map((e) => ({
      pos: U.posArabic(e && e.pos) || '',
      meaning: String((e && (e.meaning || e.definition)) || '')
    })).filter((e) => e.meaning);
  }
  function normalizeExamples(examples) {
    if (!Array.isArray(examples)) return [];
    return examples.slice(0, 3).map((e) => ({
      en: String((e && (e.en || e.english)) || ''),
      ar: String((e && (e.ar || e.arabic)) || '')
    })).filter((e) => e.en);
  }

  async function aiLookup(text, type, context) {
    const out = await callAI(SYS, buildPrompt(text, type, context));
    const j = parseJson(out);
    if (!j || !j.meaning) throw new Error('رد AI غير مفهوم');
    return {
      meaning: String(j.meaning),
      pos: U.posArabic(j.pos) || String(j.pos || ''),
      pron: String(j.pron || ''),
      ipa: String(j.ipa || ''),
      syllables: Array.isArray(j.syllables) ? j.syllables.map(String).slice(0, 8) : [],
      entries: normalizeEntries(j.entries || j.meanings),
      examples: normalizeExamples(j.examples),
      synonyms: Array.isArray(j.synonyms) ? j.synonyms.map(String).slice(0, 8) : [],
      source: 'ai'
    };
  }

  async function translateFree(text) {
    const chunks = U.chunkText(text, 440);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunks[i]) + '&langpair=en|ar';
      const res = await fetch(url);
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
      const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
      if (!res.ok) return null;
      const j = await res.json();
      if (!Array.isArray(j) || !j[0]) return null;
      const first = j[0];
      const phonetic = first.phonetic || ((first.phonetics || []).find((p) => p && p.text) || {}).text || '';
      const meanings = (first.meanings || []).map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: (m.definitions || []).slice(0, 2)
      }));
      const synonyms = [];
      (first.meanings || []).forEach((m) => (m.synonyms || []).forEach((s) => { if (synonyms.length < 8) synonyms.push(s); }));
      return { phonetic: phonetic, meanings: meanings, synonyms: synonyms };
    } catch (e) {
      return null;
    }
  }

  async function wordFreeLookup(text) {
    const w = U.normalizeWord(text) || text.toLowerCase().trim();
    if (MINI[w]) {
      return {
        meaning: MINI[w][0], pos: '', pron: MINI[w][1], ipa: '',
        entries: [], examples: [], synonyms: [], syllables: U.syllables(w), source: 'mini'
      };
    }
    const dict = await dictApi(w);
    let meaning = '';
    try { meaning = await translateFree(text); } catch (e) {}
    const entries = [];
    if (dict && dict.meanings) {
      dict.meanings.slice(0, 3).forEach((m) => {
        const def = m.definitions && m.definitions[0] ? m.definitions[0].definition : '';
        entries.push({ pos: U.posArabic(m.partOfSpeech), meaning: def });
      });
    }
    if (!meaning && entries.length) {
      try { meaning = await translateFree(entries[0].meaning); } catch (e) {}
    }
    if (!meaning) meaning = entries.map((e) => e.meaning).slice(0, 2).join(' — ') || '—';
    const examples = [];
    if (dict && dict.meanings && dict.meanings[0] && dict.meanings[0].definitions && dict.meanings[0].definitions[0] && dict.meanings[0].definitions[0].example) {
      const en = dict.meanings[0].definitions[0].example;
      let ar = '';
      try { ar = await translateFree(en); } catch (e) {}
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
      meaning: meaning, pos: '', pron: U.translitText(text), ipa: '',
      entries: [], examples: [], synonyms: [], syllables: [], source: 'free'
    };
  }

  async function lookup(text, context) {
    const t = String(text || '').trim();
    if (!t) return null;
    const type = U.classify(t);
    const key = 'lu:' + type + ':' + t.toLowerCase().replace(/\s+/g, ' ').slice(0, 180);
    const cached = await DB.cacheGet(key);
    if (cached && cached.meaning) return cached;
    let res = null;
    if (hasAI()) {
      try { res = await aiLookup(t, type, context); } catch (e) { res = null; }
    }
    if (!res) res = await freeLookup(t, type);
    res.text = t;
    res.type = type;
    const ttl = type === 'word' ? 30 * 86400000 : 7 * 86400000;
    await DB.cacheSet(key, res, ttl);
    return res;
  }

  async function test() {
    const out = await callAI(
      'أعد JSON صحيحاً فقط.',
      'أعد {"ok":true,"msg":"مرحباً"} فقط.'
    );
    const j = parseJson(out);
    if (!j) throw new Error('لم يصل JSON صحيح');
    return JSON.stringify(j);
  }

  return { lookup, callAI, test, translateFree, hasAI, MINI, parseJson };
})();
