window.TTS = (function () {
  const PREFERRED = {
    'en-US': ['Natural Online', 'Natural', 'Neural', 'Google US English', 'Aria', 'Jenny', 'Guy', 'Samantha', 'Ava', 'Allison', 'Michelle', 'Zira', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy'],
    'en-GB': ['Natural Online', 'Natural', 'Neural', 'Google UK English Female', 'Google UK English Male', 'Libby', 'Sonia', 'Ryan', 'Serena', 'Hazel', 'Daniel', 'Kate', 'Microsoft Libby', 'Microsoft Sonia', 'Microsoft Ryan']
  };
  let voices = [];
  let voicesPromise = null;
  let token = 0;
  let audio = null;
  let lastSpeech = null;
  let speakingNow = false;
  const stateListeners = [];

  function onState(fn) { if (typeof fn === 'function') stateListeners.push(fn); }
  function emitState(state) {
    stateListeners.forEach((fn) => { try { fn(state); } catch (e) {} });
  }
  function isSpeaking() { return speakingNow; }

  function loadVoices() {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return voices;
  }
  function init() {
    if (!('speechSynthesis' in window)) return Promise.resolve([]);
    loadVoices();
    if (voices.length) { voicesPromise = Promise.resolve(voices); return voicesPromise; }
    voicesPromise = new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; loadVoices(); resolve(voices); };
      window.speechSynthesis.onvoiceschanged = finish;
      setTimeout(finish, 1800);
    });
    return voicesPromise;
  }
  function pickVoice(accent) {
    const acc = accent || Settings.all().accent || 'en-US';
    const all = voices.length ? voices : loadVoices();
    if (!all.length) return null;
    const code = acc.toLowerCase().replace('_', '-');
    const sameLang = all.filter((v) => String(v.lang || '').toLowerCase().replace('_', '-').indexOf(code) === 0);
    const pool = sameLang.length ? sameLang : all.filter((v) => /^en/i.test(v.lang || ''));
    if (!pool.length) return null;
    const prefs = PREFERRED[acc] || PREFERRED['en-US'];
    for (let i = 0; i < prefs.length; i++) {
      const p = prefs[i].toLowerCase();
      const found = pool.find((v) => String(v.name || '').toLowerCase().indexOf(p) >= 0);
      if (found) return found;
    }
    const local = pool.find((v) => v.localService) || pool[0];
    return local;
  }
  function defaultRate(text) {
    const s = Settings.all();
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    if (words > 6) return U.clamp(s.sentRate || 0.8, 0.1, 2);
    return U.clamp(s.rate || 0.75, 0.1, 2);
  }
  function volumeLevel() {
    const v = Settings.all().volume;
    return U.clamp((v === null || v === undefined ? 100 : v) / 100, 0, 1);
  }
  function hasHQ() {
    const t = Settings.all().tts || {};
    return !!(t.provider && t.provider !== 'none' && t.key);
  }
  function friendlyError(e) {
    const m = String((e && e.message) || e || '');
    if (/401|403|invalid|incorrect|unauthorized/i.test(m)) return 'المفتاح غير صحيح';
    if (/429|quota|rate/i.test(m)) return 'تجاوزت حد الاستخدام';
    if (/Failed to fetch|NetworkError|load failed/i.test(m)) return 'تعذّر الاتصال';
    return m;
  }

  async function hqSynthesize(text, rate) {
    const t = Settings.all().tts;
    if (t.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.key },
        body: JSON.stringify({
          model: t.model || 'tts-1',
          voice: t.voice || 'alloy',
          input: String(text).slice(0, 900),
          speed: U.clamp(rate, 0.25, 4),
          response_format: 'mp3'
        })
      });
      if (!res.ok) throw new Error('TTS HTTP ' + res.status);
      return { blob: await res.blob(), rate: 1 };
    }
    if (t.provider === 'elevenlabs') {
      const voice = t.voice || '21m00Tcm4TlvDq8ikWAM';
      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': t.key },
        body: JSON.stringify({ text: String(text).slice(0, 900), model_id: t.model || 'eleven_multilingual_v2' })
      });
      if (!res.ok) throw new Error('TTS HTTP ' + res.status);
      return { blob: await res.blob(), rate: rate };
    }
    throw new Error('لا يوجد مزوّد صوت عالي الجودة');
  }
  function stopAudio() {
    if (!audio) return;
    try { audio.pause(); } catch (e) {}
    if (audio.src && audio.src.indexOf('blob:') === 0) URL.revokeObjectURL(audio.src);
    audio = null;
  }
  function playBlob(blob, rate) {
    stopAudio();
    audio = new Audio(URL.createObjectURL(blob));
    audio.volume = volumeLevel();
    audio.playbackRate = U.clamp(rate || 1, 0.5, 2);
    audio.onended = () => { audio = null; speakingNow = false; emitState('idle'); };
    audio.onerror = () => { audio = null; speakingNow = false; emitState('idle'); };
    audio.play().catch(() => {});
    speakingNow = true;
    emitState('speaking');
    return audio;
  }
  function webSpeak(clean, o) {
    const opts = o || {};
    if (!('speechSynthesis' in window)) { if (opts.onend) opts.onend(); return null; }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const utt = new SpeechSynthesisUtterance(clean);
    const s = Settings.all();
    utt.lang = opts.accent || s.accent || 'en-US';
    const v = pickVoice(utt.lang);
    if (v) { utt.voice = v; utt.lang = v.lang || utt.lang; }
    utt.rate = U.clamp(opts.rate || defaultRate(clean), 0.1, 2);
    utt.pitch = opts.pitch || 1;
    utt.volume = opts.volume !== undefined ? opts.volume : volumeLevel();
    utt.onstart = () => { speakingNow = true; emitState('speaking'); if (opts.onstart) opts.onstart(); };
    utt.onend = () => { speakingNow = false; emitState('idle'); if (opts.onend) opts.onend(); };
    utt.onerror = () => { speakingNow = false; emitState('idle'); if (opts.onend) opts.onend(); };
    window.speechSynthesis.speak(utt);
    return utt;
  }
  function speak(text, opts) {
    const o = opts || {};
    const clean = U.stripMarkup(text);
    if (!clean) return null;
    lastSpeech = { text: clean, opts: Object.assign({}, o) };
    stop();
    const rate = o.rate || defaultRate(clean);
    if (hasHQ()) {
      hqSynthesize(clean, rate)
        .then((r) => playBlob(r.blob, r.rate))
        .catch((e) => {
          U.toast('الصوت عالي الجودة تعذّر (' + friendlyError(e) + ') — تم استخدام صوت المتصفح', 'warn');
          webSpeak(clean, Object.assign({}, o, { rate: rate }));
        });
      return true;
    }
    return webSpeak(clean, Object.assign({}, o, { rate: rate }));
  }
  function speakSlow(text, opts) {
    return speak(text, Object.assign({}, opts, { rate: 0.5 }));
  }
  function stop() {
    token++;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    stopAudio();
    speakingNow = false;
    emitState('idle');
  }
  function repeat() {
    if (!lastSpeech) return null;
    return speak(lastSpeech.text, lastSpeech.opts);
  }
  async function speakText(text, opts) {
    const o = opts || {};
    const clean = U.stripMarkup(text);
    if (!clean) return;
    lastSpeech = { text: clean, opts: Object.assign({}, o) };
    stop();
    const my = ++token;
    const lines = U.splitSentences(clean);
    const rate = o.rate || defaultRate(clean);
    for (let i = 0; i < lines.length; i++) {
      if (my !== token) return;
      if (o.onLine) o.onLine(i, lines.length);
      await new Promise((resolve) => {
        let finished = false;
        const done = () => { if (finished) return; finished = true; setTimeout(resolve, o.gap === undefined ? 280 : o.gap); };
        const utt = webSpeak(lines[i], { rate: rate, accent: o.accent, onend: done });
        if (!utt) done();
        setTimeout(done, Math.max(2500, lines[i].length * 220));
      });
      if (my !== token) return;
    }
    if (o.onLine) o.onLine(-1, lines.length);
    if (o.onend) o.onend();
  }
  function speakSyllables(word, opts) {
    const clean = U.stripMarkup(word).trim();
    if (!clean) return null;
    if (/\s/.test(clean)) return speakText(clean, opts);
    lastSpeech = { text: clean, opts: Object.assign({}, opts) };
    stop();
    const syl = U.syllables(clean);
    const items = syl.length > 1 ? syl.concat([clean]) : [clean, clean];
    const my = ++token;
    let i = 0;
    const next = () => {
      if (my !== token) return;
      if (i >= items.length) { if (opts && opts.onend) opts.onend(); return; }
      const piece = items[i++];
      const utt = webSpeak(piece, { rate: i === items.length ? 0.7 : 0.55, onend: () => setTimeout(next, 320) });
      if (!utt) next();
    };
    next();
    return true;
  }
  function speakSpelling(word, opts) {
    const clean = U.stripMarkup(word).replace(/[^A-Za-z']/g, '');
    if (!clean) return null;
    lastSpeech = { text: clean, opts: Object.assign({}, opts) };
    stop();
    const letters = clean.split('');
    const my = ++token;
    let i = 0;
    const next = () => {
      if (my !== token) return;
      if (i >= letters.length) {
        const utt = webSpeak(clean, { rate: 0.7, onend: opts && opts.onend });
        if (!utt && opts && opts.onend) opts.onend();
        return;
      }
      const utt = webSpeak(letters[i++], { rate: 0.6, onend: () => setTimeout(next, 240) });
      if (!utt) next();
    };
    next();
    return true;
  }
  async function test() {
    if (hasHQ()) {
      const r = await hqSynthesize('Hello, this is a test.', 1);
      stopAudio();
      return hasHQ() ? 'الخدمة تعمل ✓' : 'لا يوجد مزوّد';
    }
    await init();
    const v = pickVoice(Settings.all().accent);
    if (!v) throw new Error('لا يوجد صوت متاح على هذا الجهاز');
    speak('Hello, this is a test.');
    return 'تم تشغيل الصوت: ' + v.name;
  }
  async function listVoices() {
    await init();
    return voices.map((v) => ({ name: v.name, lang: v.lang, local: !!v.localService }));
  }
  return {
    init, speak, speakText, speakSlow, speakSyllables, speakSpelling,
    stop, repeat, isSpeaking, onState, pickVoice, listVoices, test, hasHQ
  };
})();
