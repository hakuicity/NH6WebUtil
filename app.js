// app.js — NH6 Practice main app
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const S = {
  screen:     'menu',
  unit:       null,
  mode:       null,    // 'grammar' | 'response' | 'writing'
  questions:  [],
  qIndex:     0,
  score:      0,
  writeItems: [],
  writeIdx:   0,
  writeMode:  'trace', // 'trace' | 'copy'
  theme:      localStorage.getItem('nh6-theme') || 'light',
  loginTab:   'email',
  wcanvas:    null,    // WritingCanvas instance
};

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  S.screen = id;
  window.scrollTo(0,0);
}

// ── Theme ──────────────────────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle('dark', S.theme === 'dark');
  $('theme-btn').textContent = S.theme === 'dark' ? '☀️' : '🌙';
}
$('theme-btn').onclick = () => {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('nh6-theme', S.theme);
  applyTheme();
};
applyTheme();

// ── Main menu ──────────────────────────────────────────────────────────────
function buildMenu() {
  const grid = $('unit-grid');
  grid.innerHTML = NH6_UNITS.map(u => `
    <button class="unit-card" data-unit="${u.id}" style="--uc:${u.color}">
      <div class="uc-num">Unit ${u.id}</div>
      <div class="uc-emoji">${u.emoji}</div>
      <div class="uc-title">${esc(u.title)}</div>
      <div class="uc-ja">${esc(u.titleJa)}</div>
    </button>`).join('');

  grid.querySelectorAll('.unit-card').forEach(btn => {
    btn.onclick = () => {
      S.unit = parseInt(btn.dataset.unit);
      buildUnitScreen();
      showScreen('screen-unit');
    };
  });
  updateMenuStats();
}

// ── Unit screen ────────────────────────────────────────────────────────────
function buildUnitScreen() {
  const u = NH6_UNITS[S.unit - 1];
  $('unit-header').style.background = u.color;
  $('unit-num').textContent  = `Unit ${u.id}`;
  $('unit-title').textContent = u.title;
  $('unit-ja').textContent    = u.titleJa;
  $('unit-emoji').textContent = u.emoji;

  const grammar = NH6_GRAMMAR[S.unit]  || [];
  const response = NH6_RESPONSE[S.unit] || [];
  const writing  = NH6_WRITING[S.unit]  || [];

  $('unit-grammar-count').textContent  = `${grammar.length} 問`;
  $('unit-response-count').textContent = `${response.length} 問`;
  $('unit-writing-count').textContent  = `${writing.length} 項目`;

  // Vocab link
  const vu = NH6_UNITS[S.unit-1];
  const cats = vu.vocabCats.split(',')[0]; // first category for deep link
  $('unit-vocab-link').href = `https://hakuicity.github.io/TangoApp/?cat=${cats}`;
}

$('back-to-menu').onclick = () => showScreen('screen-menu');

document.getElementById('mode-grammar').onclick  = () => startQuiz('grammar');
document.getElementById('mode-response').onclick = () => startQuiz('response');
document.getElementById('mode-writing').onclick  = () => startWriting();

// ── Quiz engine ────────────────────────────────────────────────────────────
const SESSION = 10;

function startQuiz(mode) {
  S.mode  = mode;
  const pool = mode === 'grammar' ? NH6_GRAMMAR[S.unit] : NH6_RESPONSE[S.unit];
  if (!pool || !pool.length) return;

  S.questions = sample(pool, Math.min(SESSION, pool.length));
  S.qIndex    = 0;
  S.score     = 0;

  $('quiz-back').onclick = () => { if (confirm('やめますか？')) showScreen('screen-unit'); };
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = S.questions[S.qIndex];
  if (!q) { showResults(); return; }

  // Progress
  const pct = (S.qIndex / S.questions.length) * 100;
  $('quiz-progress-fill').style.width = pct + '%';
  $('quiz-progress-text').textContent = `${S.qIndex + 1} / ${S.questions.length}`;
  $('quiz-score-disp').textContent    = `⭐ ${S.score}`;
  $('result-overlay').classList.add('hidden');

  if (S.mode === 'grammar') {
    // Show sentence with blank
    const parts = q.prompt.split('___');
    $('question-prompt').innerHTML =
      `<span class="qp-text">${esc(parts[0])}</span>` +
      `<span class="qp-blank">____</span>` +
      `<span class="qp-text">${esc(parts[1] || '')}</span>`;
    $('question-hint').textContent = q.hint || '';
    $('question-hint').style.display = q.hint ? '' : 'none';
  } else {
    // Response mode: show question
    $('question-prompt').innerHTML = `<span class="qp-question">${esc(q.q)}</span>`;
    $('question-hint').style.display = 'none';
  }

  // Choices - shuffle with correct answer tracking
  const indexed = q.choices.map((c, i) => ({ text: c, orig: i }));
  const shuffled = shuffle(indexed);
  const correctOrig = q.correct;

  $('choices-grid').innerHTML = shuffled.map(item => `
    <button class="choice-btn" data-orig="${item.orig}">
      ${esc(item.text)}
    </button>`).join('');

  $('choices-grid').querySelectorAll('.choice-btn').forEach(btn => {
    btn.onclick = () => handleAnswer(parseInt(btn.dataset.orig) === correctOrig, btn, q);
  });

  // Animate in
  const card = $('question-card');
  card.style.opacity = '0'; card.style.transform = 'translateY(8px)';
  requestAnimationFrame(() => {
    card.style.transition = 'opacity .2s, transform .2s';
    card.style.opacity = '1'; card.style.transform = 'none';
  });
}

function handleAnswer(correct, btn, q) {
  $('choices-grid').querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  if (correct) {
    btn.classList.add('correct');
    S.score++;
    showResult('✅', 'せいかい！');
  } else {
    btn.classList.add('wrong');
    // Highlight correct
    $('choices-grid').querySelectorAll('.choice-btn').forEach(b => {
      if (parseInt(b.dataset.orig) === q.correct) b.classList.add('correct');
    });
    showResult('❌', esc(q.choices[q.correct]));
  }

  setTimeout(() => { S.qIndex++; renderQuestion(); }, 1300);
}

function showResult(icon, msg) {
  $('result-overlay').classList.remove('hidden');
  $('result-icon').textContent = icon;
  $('result-msg').textContent  = msg;
}

// ── Writing practice ───────────────────────────────────────────────────────
function startWriting() {
  const items = NH6_WRITING[S.unit] || [];
  if (!items.length) return;
  S.writeItems = items;
  S.writeIdx   = 0;
  S.writeMode  = 'trace';

  $('write-back').onclick = () => {
    if (S.wcanvas) S.wcanvas.clear();
    showScreen('screen-unit');
  };
  $('write-clear-btn').onclick = () => { if (S.wcanvas) S.wcanvas.clear(); };
  $('write-undo-btn').onclick  = () => { if (S.wcanvas) S.wcanvas.undo(); };
  $('write-prev-btn').onclick  = () => { if (S.writeIdx > 0) { S.writeIdx--; renderWriteItem(); } };
  $('write-next-btn').onclick  = () => {
    S.writeIdx++;
    if (S.writeIdx >= S.writeItems.length) { showResults(); return; }
    renderWriteItem();
  };
  $('write-mode-btn').onclick = toggleWriteMode;

  showScreen('screen-writing');

  // Init canvas
  const canvasEl = $('write-canvas');
  if (S.wcanvas) S.wcanvas.destroy();
  S.wcanvas = new WritingCanvas(canvasEl);

  renderWriteItem();
}

function toggleWriteMode() {
  S.writeMode = S.writeMode === 'trace' ? 'copy' : 'trace';
  $('write-mode-btn').textContent = S.writeMode === 'trace' ? '🙈 コピーモード' : '👀 なぞりモード';
  $('guide-overlay').style.opacity = S.writeMode === 'trace' ? '1' : '0';
  if (S.wcanvas) S.wcanvas.clear();
}

function renderWriteItem() {
  if (S.wcanvas) S.wcanvas.clear();
  const items = S.writeItems;
  const item  = items[S.writeIdx];
  if (!item) return;

  $('write-progress-text').textContent = `${S.writeIdx + 1} / ${items.length}`;
  $('write-progress-fill').style.width = ((S.writeIdx + 1) / items.length * 100) + '%';
  $('write-prev-btn').disabled = S.writeIdx === 0;
  $('write-mode-btn').textContent = S.writeMode === 'trace' ? '🙈 コピーモード' : '👀 なぞりモード';

  const overlay = $('guide-overlay');
  overlay.style.opacity = S.writeMode === 'trace' ? '1' : '0';

  if (item.type === 'letter') {
    overlay.textContent = S.writeMode === 'trace' ? item.upper : '';
    $('write-instruction').innerHTML =
      `<strong>${item.upper}${item.lower}</strong> を書こう &nbsp;
       <span class="write-word-eg">${item.emoji} ${esc(item.word)} = ${esc(item.hint)}</span>`;
    $('write-tabs').innerHTML = `
      <button class="wtab active" data-char="${esc(item.upper)}">大文字 ${esc(item.upper)}</button>
      <button class="wtab"        data-char="${esc(item.lower)}">小文字 ${esc(item.lower)}</button>
      <button class="wtab"        data-char="${esc(item.word)}">単語 ${esc(item.word)}</button>`;
  } else if (item.type === 'digraph') {
    overlay.textContent = S.writeMode === 'trace' ? item.chars : '';
    $('write-instruction').innerHTML =
      `<strong>${esc(item.chars)}</strong> を書こう &nbsp;
       <span class="write-word-eg">${item.emoji} ${esc(item.word)} = ${esc(item.hint)}</span>`;
    $('write-tabs').innerHTML = `
      <button class="wtab active" data-char="${esc(item.chars)}">${esc(item.chars)}</button>
      <button class="wtab"        data-char="${esc(item.chars.toUpperCase())}">${esc(item.chars.toUpperCase())}</button>
      <button class="wtab"        data-char="${esc(item.word)}">単語 ${esc(item.word)}</button>`;
  } else if (item.type === 'word') {
    overlay.textContent = S.writeMode === 'trace' ? item.word : '';
    $('write-instruction').innerHTML =
      `<strong>${esc(item.word)}</strong> を書こう &nbsp;
       <span class="write-word-eg">${esc(item.hint)}</span>`;
    $('write-tabs').innerHTML = '';
  } else if (item.type === 'sentence') {
    overlay.textContent = S.writeMode === 'trace' ? item.text : '';
    $('write-instruction').innerHTML =
      `<span style="font-size:14px">${esc(item.text)}</span><br>
       <span class="write-word-eg">${esc(item.hint)}</span>`;
    $('write-tabs').innerHTML = '';
  }

  // Wire up letter tabs
  document.querySelectorAll('.wtab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.wtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      overlay.textContent = S.writeMode === 'trace' ? tab.dataset.char : '';
      if (S.wcanvas) S.wcanvas.clear();
    };
  });

  // Adjust guide font size based on content length
  const text = overlay.textContent;
  if (text.length <= 1) overlay.style.fontSize = '220px';
  else if (text.length <= 4) overlay.style.fontSize = '140px';
  else if (text.length <= 8) overlay.style.fontSize = '80px';
  else overlay.style.fontSize = '42px';
}

// ── Results ────────────────────────────────────────────────────────────────
async function showResults() {
  const isWriting = (S.mode === null || S.mode === 'writing');
  const total   = isWriting ? S.writeItems.length : S.questions.length;
  const correct = isWriting ? total : S.score;
  const pct     = Math.round(correct / total * 100);

  $('results-emoji').textContent = pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪';
  $('results-score').textContent = isWriting
    ? `${total} 項目 完了！`
    : `${correct} / ${total} 正解 (${pct}%)`;
  $('results-bar').style.width = pct + '%';
  $('results-msg').textContent  = pct >= 80 ? 'すばらしい！よくできました！'
    : pct >= 60 ? 'よくがんばりました！'
    : 'もう一度チャレンジしよう！';
  $('results-sync').textContent = '';
  showScreen('screen-results');

  // Supabase sync
  if (!isWriting && typeof window.hk !== 'undefined') {
    const user = await window.hk.getUser();
    if (user) {
      try {
        await window.hk.syncQuizResult({
          level:    `u${S.unit}`,
          setId:    S.mode,
          category: S.mode,
          correct,
          total,
          app_id:   'nh6'
        });
        $('results-sync').textContent = '✓ 成績を保存しました';
      } catch(e) { console.warn('[NH6] sync error:', e.message); }
    }
  }

  saveLocalStats(S.unit, S.mode, correct, total);
  updateMenuStats();

  $('results-retry').onclick = () => {
    if (S.mode === 'writing') startWriting();
    else startQuiz(S.mode);
  };
  $('results-menu').onclick = () => showScreen('screen-menu');
  $('results-unit').onclick = () => showScreen('screen-unit');
}

// ── Local stats ────────────────────────────────────────────────────────────
function saveLocalStats(unit, mode, correct, total) {
  const d = JSON.parse(localStorage.getItem('nh6-stats') || '{}');
  const key = `u${unit}-${mode}`;
  if (!d[key]) d[key] = { correct:0, total:0, sessions:0 };
  d[key].correct  += correct;
  d[key].total    += total;
  d[key].sessions += 1;
  d.overall = d.overall || { correct:0, total:0, sessions:0 };
  d.overall.correct  += correct;
  d.overall.total    += total;
  d.overall.sessions += 1;
  localStorage.setItem('nh6-stats', JSON.stringify(d));
}

function updateMenuStats() {
  const d  = JSON.parse(localStorage.getItem('nh6-stats') || '{}');
  const ov = d.overall;
  if (!ov || ov.sessions === 0) { $('menu-stats').style.display = 'none'; return; }
  $('menu-stats').style.display = '';
  const pct = ov.total > 0 ? Math.round(ov.correct / ov.total * 100) : 0;
  $('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-num">${ov.sessions}</div><div class="stat-lbl">セッション</div></div>
    <div class="stat-card"><div class="stat-num">${ov.total}</div><div class="stat-lbl">回答数</div></div>
    <div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-lbl">正答率</div></div>`;
}

// ── Auth modal ─────────────────────────────────────────────────────────────
$('auth-btn').onclick    = openAuth;
$('modal-close').onclick = closeAuth;
$('auth-modal').addEventListener('click', e => { if(e.target === $('auth-modal')) closeAuth(); });

document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.onclick = () => {
    S.loginTab = tab.dataset.tab;
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === S.loginTab));
    $('modal-email-form').style.display = S.loginTab === 'email' ? '' : 'none';
    $('modal-sid-form').style.display   = S.loginTab === 'sid'   ? '' : 'none';
    clearModalMsg();
  };
});

$('modal-submit').onclick = doLogin;
$('m-pass').addEventListener('keydown',    e => { if(e.key==='Enter') doLogin(); });
$('m-sidpass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

async function openAuth() {
  clearModalMsg();
  $('modal-tabs').style.display       = '';
  $('modal-email-form').style.display = '';
  $('modal-sid-form').style.display   = 'none';
  $('modal-loggedin').style.display   = 'none';
  $('modal-submit').textContent       = 'ログイン';
  $('modal-submit').onclick           = doLogin;
  $('modal-title').textContent        = 'ログイン';
  $('modal-sub').textContent          = '成績をクラウドに保存します';

  if (typeof window.hk !== 'undefined') {
    const user = await window.hk.getUser();
    if (user) {
      const p = await window.hk.getProfile(user.id);
      $('modal-user-name').textContent  = (p && p.display_name) ? p.display_name : user.email;
      $('modal-user-email').textContent = user.email;
      $('modal-tabs').style.display       = 'none';
      $('modal-email-form').style.display = 'none';
      $('modal-sid-form').style.display   = 'none';
      $('modal-loggedin').style.display   = '';
      $('modal-submit').textContent       = 'ログアウト';
      $('modal-submit').onclick           = doLogout;
      $('modal-title').textContent        = 'アカウント';
      $('modal-sub').textContent          = 'ログイン済み';
    }
  }
  $('auth-modal').classList.remove('hidden');
}

function closeAuth() { $('auth-modal').classList.add('hidden'); }
function showModalErr(m) { $('modal-err').textContent=m; $('modal-err').classList.remove('hidden'); $('modal-ok').classList.add('hidden'); }
function showModalOk(m)  { $('modal-ok').textContent=m;  $('modal-ok').classList.remove('hidden'); $('modal-err').classList.add('hidden'); }
function clearModalMsg()  { $('modal-err').classList.add('hidden'); $('modal-ok').classList.add('hidden'); }

async function doLogin() {
  if (typeof window.hk === 'undefined') { showModalErr('接続中...'); return; }
  const btn = $('modal-submit');
  btn.disabled = true; btn.textContent = '処理中...';
  clearModalMsg();
  try {
    if (S.loginTab === 'sid') {
      const sid  = $('m-sid').value.trim();
      const pass = $('m-sidpass').value;
      if (!sid||!pass) { showModalErr('学籍番号とパスワードを入力してください。'); return; }
      await window.hk.signInWithStudentId(sid, pass);
    } else {
      const email = $('m-email').value.trim();
      const pass  = $('m-pass').value;
      if (!email||!pass) { showModalErr('メールとパスワードを入力してください。'); return; }
      await window.hk.signIn(email, pass);
    }
    closeAuth();
  } catch(e) {
    showModalErr('ログインに失敗しました：' + (e.message||''));
  } finally {
    btn.disabled = false; btn.textContent = 'ログイン';
  }
}

async function doLogout() {
  if (typeof window.hk !== 'undefined') {
    try { await window.hk.signOut(); closeAuth(); } catch(e) {}
  }
}

// Auth state → button
function pollHk() {
  if (typeof window.hk === 'undefined') { setTimeout(pollHk, 100); return; }
  window.hk.onAuthChange(async user => {
    const btn = $('auth-btn');
    if (user) {
      const p = await window.hk.getProfile(user.id);
      btn.textContent = '👤 ' + ((p&&p.display_name) ? p.display_name.split(' ')[0] : user.email.split('@')[0]);
      btn.classList.add('signed-in');
    } else {
      btn.textContent = 'ログイン';
      btn.classList.remove('signed-in');
    }
  });
}
pollHk();

// ── Boot ───────────────────────────────────────────────────────────────────
buildMenu();
