window.TTS = (function () {
  let voices = [];
  let voicesPromise = null;
  let seqToken = 0;

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
      setTimeout(finish, 1400);
    });
    return voicesPromise;
  }
  const PREFERRED = {
    'en-US': ['Google US English', 'Samantha', 'Aria', 'Jenny', 'Zira', 'Microsoft Aria', 'Microsoft Jenny', 'Allison', 'Ava', 'Alex'],
    'en-GB': ['Google UK English Female', 'Serena', 'Libby', 'Sonia', 'Hazel', 'Microsoft Libby', 'Microsoft Sonia', 'Daniel', 'Kate']
  };
  function pickVoice(accent) {
    const acc = accent || Settings.all().accent || 'en-US';
    const all = voices.length ? voices : loadVoices();
    if (!all.length) return null;
    const code = acc.toLowerCase().replace('_', '-');
    const sameLang = all.filter((v) => String(v.lang || '').toLowerCase().replace('_', '-').indexOf(code) === 0);
    const pool = sameLang.length ? sameLang : all.filter((v) => /^en/.test(v.lang || ''));
    if (!pool.length) return null;
    const prefs = PREFERRED[acc] || [];
    for (let i = 0; i < prefs.length; i++) {
      const found = pool.find((v) => String(v.name).indexOf(prefs[i]) >= 0);
      if (found) return found;
    }
    const local = pool.find((v) => v.localService);
    return local || pool[0];
  }
  function stop() {
    seqToken++;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  function speak(text, opts) {
    const o = opts || {};
    const clean = U.stripMarkup(text);
    if (!clean || !('speechSynthesis' in window)) {
      if (o.onend) o.onend();
      return null;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const utt = new SpeechSynthesisUtterance(clean);
    const s = Settings.all();
    utt.lang = o.accent || s.accent || 'en-US';
    const v = pickVoice(utt.lang);
    if (v) { utt.voice = v; utt.lang = v.lang || utt.lang; }
    utt.rate = U.clamp(o.rate || s.rate || 1, 0.1, 2);
    utt.pitch = o.pitch || 1;
    utt.onstart = o.onstart || null;
    utt.onend = () => { if (o.onend) o.onend(); };
    utt.onerror = () => { if (o.onend) o.onend(); };
    window.speechSynthesis.speak(utt);
    return utt;
  }
  function speakSlow(text, opts) {
    return speak(text, Object.assign({}, opts, { rate: 0.5 }));
  }
  function speakSequence(items, opts) {
    const o = opts || {};
    const token = ++seqToken;
    stop();
    seqToken = token;
    let i = 0;
    const next = () => {
      if (token !== seqToken) return;
      if (i >= items.length) { if (o.onend) o.onend(); return; }
      const piece = items[i++];
      const utt = speak(piece, {
        rate: o.rate || 0.62,
        accent: o.accent,
        onend: () => setTimeout(next, o.gap === undefined ? 360 : o.gap)
      });
      if (!utt) next();
    };
    next();
  }
  function speakSyllables(word, opts) {
    const clean = U.stripMarkup(word).trim();
    if (!clean) return null;
    if (/\s/.test(clean)) {
      const words = clean.split(/\s+/).filter(Boolean);
      return speakSequence(words.concat([clean]), Object.assign({}, opts, { rate: 0.62 }));
    }
    const syl = U.syllables(clean);
    if (!syl.length || syl.length === 1) return speakSequence([clean, clean], Object.assign({}, opts, { rate: 0.55 }));
    return speakSequence(syl.concat([clean]), Object.assign({}, opts, { rate: 0.5 }));
  }
  async function listVoices() {
    await init();
    return voices;
  }
  return { init, speak, speakSlow, speakSyllables, speakSequence, stop, pickVoice, listVoices };
})();
