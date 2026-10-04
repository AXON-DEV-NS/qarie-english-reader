window.Study = (function () {
  let deck = [];
  let deckIndex = 0;
  let flipped = false;
  let quiz = null;

  const DEFAULT_STATS = { streak: 0, best: 0, lastDay: null, days: {}, totalReviews: 0 };

  async function getStats() {
    return await DB.getMeta('stats', JSON.parse(JSON.stringify(DEFAULT_STATS)));
  }

  async function markActivity(kind, n) {
    const count = n || 1;
    const st = await getStats();
    if (!st.days) st.days = {};
    const today = U.todayKey();
    if (st.lastDay !== today) {
      const yesterday = U.dateKeyOffset(-1);
      st.streak = st.lastDay === yesterday ? (st.streak || 0) + 1 : 1;
      st.lastDay = today;
      st.best = Math.max(st.best || 0, st.streak);
    }
    st.best = Math.max(st.best || 0, st.streak || 0);
    if (!st.days[today]) st.days[today] = { reviews: 0, words: 0, quiz: 0 };
    if (kind === 'review') st.days[today].reviews += count;
    else if (kind === 'word') st.days[today].words += count;
    else if (kind === 'quiz') st.days[today].quiz += count;
    if (kind === 'review') st.totalReviews = (st.totalReviews || 0) + count;
    await DB.setMeta('stats', st);
    updateChips(st);
    return st;
  }

  function dueCount(words) {
    const now = Date.now();
    return words.filter((w) => !w.srs || !w.srs.due || w.srs.due <= now).length;
  }

  async function updateChips(stats) {
    const st = stats || await getStats();
    const chip = document.getElementById('streak-chip');
    if (chip) chip.textContent = '🔥 ' + (st.streak || 0);
    const words = await DB.all('words');
    const due = dueCount(words);
    const dueEl = document.getElementById('due-count');
    if (dueEl) dueEl.textContent = String(due);
    return { due: due, total: words.length };
  }

  function rateWord(w, rating) {
    w.srs = w.srs || { ease: 2.5, interval: 0, reps: 0, due: 0 };
    const s = w.srs;
    if (rating === 1) {
      s.ease = Math.max(1.3, (s.ease || 2.5) - 0.2);
      s.interval = s.interval ? Math.max(1, s.interval * 0.5) : 1;
    } else if (rating === 2) {
      s.interval = s.interval ? Math.max(1, s.interval * (s.ease || 2.5) * 0.85) : 1;
    } else {
      s.ease = Math.min(2.9, (s.ease || 2.5) + 0.06);
      s.interval = s.interval ? s.interval * (s.ease || 2.5) * 1.15 : 2;
    }
    s.interval = Math.min(365, Math.round(s.interval * 10) / 10);
    s.reps = (s.reps || 0) + 1;
    s.due = Date.now() + s.interval * 86400000;
    s.lastRating = rating;
    w.status = (s.reps >= 4 && s.interval >= 14) ? 'mastered' : 'learning';
    w.updatedAt = Date.now();
  }

  async function startReview(mode) {
    const all = await DB.all('words');
    if (!all.length) {
      U.toast('لا توجد كلمات محفوظة بعد', 'warn');
      return;
    }
    const now = Date.now();
    deck = mode === 'all'
      ? all.slice().sort(() => Math.random() - 0.5)
      : all.filter((w) => !w.srs || !w.srs.due || w.srs.due <= now).sort((a, b) => ((a.srs && a.srs.due) || 0) - ((b.srs && b.srs.due) || 0));
    if (!deck.length) {
      U.toast('لا توجد بطاقات مستحقة الآن — راجع كل الكلمات إن شئت', 'ok');
      return;
    }
    deckIndex = 0;
    flipped = false;
    renderCard();
  }

  function renderCard() {
    const area = document.getElementById('study-area');
    if (!area || !deck.length) return;
    area.innerHTML = '';
    if (deckIndex >= deck.length) {
      area.appendChild(U.el('div', { class: 'empty big' }, [
        U.el('p', { text: '🎉 أنهيت الجلسة! راجعت ' + deck.length + ' بطاقة.' }),
        U.el('button', {
          class: 'btn primary', text: 'مراجعة المستحق مرة أخرى',
          onclick: () => startReview('due')
        })
      ]));
      updateChips();
      return;
    }
    const w = deck[deckIndex];
    const progress = U.el('div', { class: 'quiz-progress' }, [
      U.el('span', { text: (deckIndex + 1) + ' / ' + deck.length }),
      U.el('div', { class: 'progressbar' }, [U.el('div', { style: 'width:' + Math.round((deckIndex / deck.length) * 100) + '%' })])
    ]);
    const front = U.el('div', { class: 'fc-face fc-front' }, [
      U.el('div', { class: 'fc-en', text: w.text }),
      U.el('div', { class: 'fc-hint', text: 'اضغط البطاقة أو F لقلبها' }),
      U.el('button', {
        class: 'btn small', text: '🔊',
        onclick: (e) => { e.stopPropagation(); TTS.speak(w.text); }
      })
    ]);
    const back = U.el('div', { class: 'fc-face fc-back' }, [
      U.el('div', { class: 'fc-meaning', text: w.meaning || '—' }),
      w.pron ? U.el('div', { class: 'w-pron', text: w.pron }) : null,
      w.examples && w.examples[0] ? U.el('div', { class: 'w-ex', html: '<div class="en">' + U.esc(w.examples[0].en) + '</div>' + (w.examples[0].ar ? '<div class="ar">' + U.esc(w.examples[0].ar) + '</div>' : '') }) : null
    ].filter(Boolean));
    const fc = U.el('div', { class: 'flashcard' + (flipped ? ' flipped' : '') }, [
      U.el('div', { class: 'fc-inner' }, [front, back])
    ]);
    fc.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      flip();
    });
    const actions = U.el('div', { class: 'fc-actions' }, [
      U.el('button', { class: 'btn', id: 'fc-flip', text: '🔄 قلب (F)', onclick: () => flip() }),
      U.el('button', { class: 'btn rate-hard', text: '😰 صعبة (1)', onclick: () => rateCurrent(1) }),
      U.el('button', { class: 'btn rate-ok', text: '🙂 متوسطة (2)', onclick: () => rateCurrent(2) }),
      U.el('button', { class: 'btn rate-easy', text: '😎 سهلة (3)', onclick: () => rateCurrent(3) })
    ]);
    area.appendChild(progress);
    area.appendChild(fc);
    area.appendChild(actions);
    updateChips();
  }

  function flip() {
    flipped = !flipped;
    const fc = document.querySelector('.flashcard');
    if (fc) fc.classList.toggle('flipped', flipped);
  }

  async function rateCurrent(rating) {
    const w = deck[deckIndex];
    if (!w) return;
    if (!flipped) flip();
    rateWord(w, rating);
    await DB.put('words', w);
    await markActivity('review', 1);
    DB.changed();
    deckIndex++;
    flipped = false;
    renderCard();
  }

  async function startQuiz(mode) {
    const words = (await DB.all('words')).filter((w) => w.type === 'word' && w.meaning && w.text);
    if (words.length < 3) {
      U.toast('تحتاج 3 كلمات محفوظة على الأقل لبدء الاختبار', 'warn');
      return;
    }
    const pool = words.slice().sort(() => Math.random() - 0.5).slice(0, 10);
    quiz = { mode: mode, queue: pool, index: 0, score: 0, answered: false };
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const area = document.getElementById('quiz-area');
    if (!area || !quiz) return;
    area.innerHTML = '';
    if (quiz.index >= quiz.queue.length) {
      const pct = Math.round((quiz.score / quiz.queue.length) * 100);
      area.appendChild(U.el('div', { class: 'card quiz-card center' }, [
        U.el('h3', { text: pct >= 80 ? '🎉 ممتاز!' : pct >= 50 ? '👍 جيد' : '💪 واصل التدريب' }),
        U.el('p', { class: 'stat-num', text: quiz.score + ' / ' + quiz.queue.length }),
        U.el('div', { class: 'row gap', style: 'justify-content:center' }, [
          U.el('button', { class: 'btn primary', text: 'اختبار جديد', onclick: () => startQuiz(quiz.mode) })
        ])
      ]));
      updateChips();
      return;
    }
    const w = quiz.queue[quiz.index];
    quiz.answered = false;
    const progress = U.el('div', { class: 'quiz-progress' }, [
      U.el('span', { text: (quiz.index + 1) + ' / ' + quiz.queue.length }),
      U.el('div', { class: 'progressbar' }, [U.el('div', { style: 'width:' + Math.round((quiz.index / quiz.queue.length) * 100) + '%' })])
    ]);
    const card = U.el('div', { class: 'card quiz-card' }, [progress]);

    if (quiz.mode === 'mcq') {
      card.appendChild(U.el('div', { class: 'quiz-q', text: w.text }));
      if (w.pron) card.appendChild(U.el('div', { class: 'muted small', text: '🔉 ' + w.pron }));
      const others = quiz.queue.filter((x) => x.id !== w.id).slice(0, 3).map((x) => x.meaning);
      const options = [w.meaning].concat(others).sort(() => Math.random() - 0.5);
      const optWrap = U.el('div', { class: 'quiz-options' });
      options.forEach((opt) => {
        const btn = U.el('button', { class: 'quiz-opt', text: opt });
        btn.addEventListener('click', () => answerQuiz(w, opt === w.meaning, btn, optWrap));
        optWrap.appendChild(btn);
      });
      card.appendChild(optWrap);
      card.appendChild(U.el('div', { class: 'row gap', style: 'margin-top:12px' }, [
        U.el('button', { class: 'btn small', text: '🔊 استماع', onclick: () => TTS.speak(w.text) })
      ]));
    } else {
      card.appendChild(U.el('div', { class: 'muted small', text: 'استمع واكتب الكلمة الإنجليزية:' }));
      card.appendChild(U.el('div', { class: 'row gap', style: 'margin:10px 0' }, [
        U.el('button', {
          class: 'btn primary', text: '🔊 استمع', id: 'quiz-play',
          onclick: () => TTS.speak(w.text)
        })
      ]));
      const input = U.el('input', { class: 'input ltr', placeholder: 'اكتب الكلمة هنا…', autocomplete: 'off', autocapitalize: 'off' });
      const check = U.el('button', { class: 'btn primary', text: 'تحقق' });
      const row = U.el('div', { class: 'quiz-input' }, [input, check]);
      const fb = U.el('div', { style: 'margin-top:10px' });
      check.addEventListener('click', () => {
        if (quiz.answered) return;
        const ok = U.normalizeWord(input.value) === U.normalizeWord(w.text);
        answerQuiz(w, ok, check, row, fb);
        input.disabled = true;
        check.disabled = true;
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check.click(); });
      card.appendChild(row);
      card.appendChild(fb);
      TTS.speak(w.text);
    }
    area.innerHTML = '';
    area.appendChild(card);
  }

  async function answerQuiz(w, correct, btn, wrap, feedback) {
    if (quiz.answered) return;
    quiz.answered = true;
    if (correct) {
      quiz.score++;
      if (btn) { btn.classList.add('correct'); }
      if (feedback) feedback.innerHTML = '<span class="test-badge ok">إجابة صحيحة ✓</span>';
      w.srs = w.srs || { ease: 2.5, interval: 0, reps: 0, due: 0 };
      w.srs.ease = Math.min(2.9, (w.srs.ease || 2.5) + 0.04);
    } else {
      if (btn) { btn.classList.add('wrong'); }
      if (wrap) {
        Array.prototype.forEach.call(wrap.querySelectorAll('.quiz-opt'), (o) => {
          if (o.textContent === w.meaning) o.classList.add('correct');
        });
      }
      if (feedback) feedback.innerHTML = '<span class="test-badge bad">خطأ — الصحيح: ' + U.esc(w.text) + '</span>';
      w.srs = w.srs || { ease: 2.5, interval: 0, reps: 0, due: 0 };
      w.srs.ease = Math.max(1.3, (w.srs.ease || 2.5) - 0.15);
      w.srs.due = Math.min(w.srs.due || 0, Date.now() + 86400000 / 4) || Date.now();
      w.srs.reps = Math.max(0, (w.srs.reps || 0) - 1);
      w.updatedAt = Date.now();
      await DB.put('words', w);
    }
    await markActivity('quiz', 1);
    DB.changed();
    const area = document.getElementById('quiz-area');
    const next = U.el('button', {
      class: 'btn primary', text: 'التالي ›', style: 'margin-top:14px',
      onclick: () => { quiz.index++; renderQuizQuestion(); }
    });
    (area.querySelector('.quiz-card') || area).appendChild(next);
    TTS.speak(w.text);
  }

  async function renderStats() {
    const st = await getStats();
    const words = await DB.all('words');
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = String(v); };
    const today = U.todayKey();
    const due = dueCount(words);
    set('stat-streak', st.streak || 0);
    set('stat-best', st.best || 0);
    set('stat-words', words.length);
    set('stat-mastered', words.filter((w) => w.status === 'mastered').length);
    set('stat-due', due);
    set('stat-reviews', (st.days && st.days[today] && st.days[today].reviews) || 0);

    const chart = document.getElementById('chart-7');
    if (chart) {
      chart.innerHTML = '';
      const days = [];
      for (let i = 6; i >= 0; i--) days.push(U.dateKeyOffset(-i));
      const values = days.map((d) => (st.days && st.days[d]) ? ((st.days[d].reviews || 0) + (st.days[d].words || 0) + (st.days[d].quiz || 0)) : 0);
      const max = Math.max(1, Math.max.apply(null, values));
      const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      days.forEach((d, i) => {
        const date = new Date(d);
        const h = Math.round((values[i] / max) * 100);
        chart.appendChild(U.el('div', { class: 'bar-wrap' }, [
          U.el('div', { class: 'bar-val', text: values[i] ? String(values[i]) : '' }),
          U.el('div', { class: 'bar', style: 'height:' + Math.max(3, h) + '%' }),
          U.el('div', { class: 'bar-lbl', text: dayNames[date.getDay()] })
        ]));
      });
    }

    const top = document.getElementById('top-files');
    if (top) {
      top.innerHTML = '';
      const files = await DB.all('files');
      const rows = files.map((f) => ({ f: f, n: words.filter((w) => w.fileId === f.id).length }))
        .sort((a, b) => b.n - a.n).slice(0, 8);
      if (!rows.length) top.appendChild(U.el('div', { class: 'muted small', text: 'لا ملفات بعد.' }));
      rows.forEach((r) => {
        top.appendChild(U.el('div', { class: 'tf-row' }, [
          U.el('span', { text: '📄' }),
          U.el('span', { class: 'tf-name', text: r.f.name }),
          U.el('span', { class: 'chip tiny', text: r.n + ' كلمة' })
        ]));
      });
    }
    updateChips(st);
  }

  function init() {
    const due = document.getElementById('btn-review-due');
    const all = document.getElementById('btn-review-all');
    const mcq = document.getElementById('quiz-mode-mcq');
    const listen = document.getElementById('quiz-mode-listen');
    if (due) due.addEventListener('click', () => startReview('due'));
    if (all) all.addEventListener('click', () => startReview('all'));
    if (mcq) mcq.addEventListener('click', () => startQuiz('mcq'));
    if (listen) listen.addEventListener('click', () => startQuiz('listen'));
  }

  return { init, markActivity, updateChips, renderStats, startReview, startQuiz, flip, rateCurrent, getStats, rateWord };
})();
