/* Classic Imposter – Party-Spiel. Online (MQTT-Relay, Host-autoritativ) + lokal (ein Gerät). */
(function () {
  'use strict';

  const VERSION = '1.2.0';
  const SITE_URL = 'https://classicimposter.github.io/classicimposter/';
  const APK_URL = 'https://github.com/classicimposter/classicimposter/releases/latest/download/imposter.apk';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MODES = ['classic', 'undercover', 'chaos', 'write'];
  const MODE_ICON = { classic: '🕵️', undercover: '🎭', chaos: '🌪️', write: '✍️' };
  const THEMES = ['sun', 'ocean', 'candy', 'forest', 'night'];
  const THEME_ICON = { sun: '🌞', ocean: '🌊', candy: '🍬', forest: '🌲', night: '🌙' };
  const $app = document.getElementById('app');

  // ---------- Helpers ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('imp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('imp_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const rand = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join('');
  const isApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const parseCustom = txt => Array.from(new Set(String(txt || '').split(/[,;\n]+/).map(s => s.trim().slice(0, 40)).filter(Boolean))).slice(0, 300);

  // ---------- App config (device settings) ----------
  const CFG_DEFAULT = { easy: false, textSize: 'normal', contrast: false, animations: true, sound: true, vibration: true,
    reveal: 'swipe', theme: 'sun', readAloud: false, showHelp: false, showOrder: true, keepAwake: true, confirmLeave: true };
  const EASY_ON = { textSize: 'xl', contrast: true, animations: false, reveal: 'tap', readAloud: true, showHelp: true, confirmLeave: true };
  const EASY_OFF = { textSize: 'normal', contrast: false, animations: true, reveal: 'swipe', readAloud: false, showHelp: false };

  const navLang = (navigator.language || 'de').slice(0, 2);
  const app = {
    lang: store.get('lang', navLang === 'sr' || navLang === 'hr' || navLang === 'bs' ? 'sr' : navLang === 'en' ? 'en' : 'de'),
    cfg: Object.assign({}, CFG_DEFAULT, store.get('cfg', {})),
    profile: store.get('profile', null),
    screen: 'home', params: {}, toast: null, modal: null, drafts: {},
    net: null, G: null, V: null, L: null,
    photos: {}, hostAway: false, netDown: false,
    dragging: false, pendingRender: false, cardUp: false, revealed: null, voteSel: null
  };
  if (!app.profile) {
    app.profile = { id: uid(), name: '', avatar: { type: 'char', id: CHARACTERS[rand(CHARACTERS.length)].id } };
    store.set('profile', app.profile);
  }
  if (!I18N[app.lang]) app.lang = 'de';
  const t = k => (I18N[app.lang][k] != null ? I18N[app.lang][k] : (I18N.en[k] != null ? I18N.en[k] : k));
  const wordText = w => (w ? (w[app.lang] || w.de || '?') : '?');
  const catName = id => {
    if (id === 'custom') return '✏️ ' + t('customCat');
    const c = CATEGORIES.find(c => c.id === id); return c ? c.icon + ' ' + c.name[app.lang] : '';
  };
  const defaultSettings = () => ({ mode: 'classic', imposters: 1, cats: CATEGORIES.map(c => c.id), timer: 0, hint: true, lastChance: true, custom: [] });

  function applyCfg() {
    const d = document.documentElement, c = app.cfg;
    d.dataset.theme = c.theme; d.dataset.size = c.textSize; d.dataset.contrast = c.contrast ? 'on' : 'off'; d.dataset.motion = c.animations ? 'on' : 'off';
    d.dataset.easy = c.easy ? 'on' : 'off';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(d).getPropertyValue('--bg2').trim() || '#ffd02b';
  }
  function saveCfg() { store.set('cfg', app.cfg); applyCfg(); }

  // ---------- Sound / vibration / speech / wake lock ----------
  let actx = null;
  function sfx(kind) {
    if (!app.cfg.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = {
        click: [[660, 0.05]], pop: [[520, 0.06], [880, 0.07]], reveal: [[440, 0.08], [660, 0.08], [990, 0.12]],
        stop: [[300, 0.12], [200, 0.2]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.25]], lose: [[400, 0.15], [300, 0.15], [200, 0.3]],
        tick: [[880, 0.03]]
      }[kind] || [[600, 0.05]];
      let tm = actx.currentTime;
      seq.forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.06, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + d);
        o.connect(g); g.connect(actx.destination); o.start(tm); o.stop(tm + d); tm += d * 0.9;
      });
    } catch (e) { /* no audio */ }
  }
  const buzz = ms => { if (!app.cfg.vibration) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  function speak(text) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = { de: 'de-DE', en: 'en-US', sr: 'sr-RS' }[app.lang]; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* no tts */ }
  }
  let wakeLock = null;
  async function updateWakeLock() {
    const want = app.cfg.keepAwake && (app.screen === 'online' || (app.screen === 'local' && app.L && app.L.phase !== 'setup'));
    try {
      if (want && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateWakeLock(); });

  // ---------- UI building blocks ----------
  function avatarHTML(av, size = 64, extraCls = '') {
    const photo = av && av.type === 'photo' ? (av.data || (app.photos && app.photos[av.id])) : null;
    if (photo) {
      return `<div class="avatar photo ${extraCls}" style="width:${size}px;height:${size}px"><img src="${esc(photo)}" alt=""></div>`;
    }
    const id = (av && av.id) || 'blobbo';
    const c = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
    return `<div class="avatar ${extraCls}" style="width:${size}px;height:${size}px;--av:${c.color}">${getCharSVG(c.id)}</div>`;
  }
  function topbar(title, backAction, opts = {}) {
    return `<header class="topbar">
      ${backAction ? `<button class="icon-btn" data-a="${backAction}" aria-label="${t('back')}">←</button>` : (opts.left || '<span class="icon-btn ghost"></span>')}
      <h2>${title}</h2>
      ${opts.right || `<button class="icon-btn" data-a="langCycle" aria-label="${t('language')}">${LANGS.find(l => l.id === app.lang).flag}</button>`}
    </header>`;
  }
  const helpHTML = key => app.cfg.showHelp ? `<div class="help"><b>${t('whatNow')}</b> ${esc(t('help_' + key))}</div>` : '';
  function toastHTML() { return app.toast ? `<div class="toast">${esc(app.toast)}</div>` : ''; }
  function modalHTML() {
    if (!app.modal) return '';
    return `<div class="modal-bg"><div class="modal panel">
      <p>${esc(app.modal.text)}</p>
      <div class="btn-row"><button class="btn red" data-a="modalYes">${t('yes')}</button><button class="btn" data-a="modalNo">${t('no')}</button></div>
    </div></div>`;
  }
  function confirmThen(text, fn) { app.modal = { text, fn }; render(); }
  function showToast(msg, ms = 2200) {
    app.toast = msg; render();
    clearTimeout(showToast._t); showToast._t = setTimeout(() => { app.toast = null; render(); }, ms);
  }
  const draft = (key, fallback) => (app.drafts[key] != null ? app.drafts[key] : fallback);

  function maxImposters(n) { return Math.max(1, Math.min(10, Math.max(n, 3) - 1)); }

  function settingsHTML(s, nPlayers, editable, online) {
    const maxImp = maxImposters(nPlayers);
    const dis = editable ? '' : 'disabled';
    const modes = MODES.map(m => {
      const off = m === 'write' && !online;
      return `<button class="mode-card ${s.mode === m ? 'on' : ''}" data-a="setMode" data-v="${m}" ${dis || (off ? 'disabled' : '')}>
        <span class="mode-ic">${MODE_ICON[m]}</span><b>${t('mode_' + m)}</b><small>${esc(t('mode_' + m + '_d'))}${off ? ` <i>(${t('onlineOnly')})</i>` : ''}</small></button>`;
    }).join('');
    const cats = CATEGORIES.map(c => `<button class="chip ${s.cats.includes(c.id) ? 'on' : ''}" data-a="setCat" data-v="${c.id}" ${dis}>${c.icon} ${esc(c.name[app.lang])} <small>${c.count}</small></button>`).join('')
      + `<button class="chip ${s.cats.includes('custom') ? 'on' : ''}" data-a="setCat" data-v="custom" ${dis || (s.custom.length ? '' : 'disabled')}>✏️ ${t('customCat')} <small>${s.custom.length}</small></button>`;
    const total = WORDS.filter(w => s.cats.includes(w.cat)).length + (s.cats.includes('custom') ? s.custom.length : 0);
    const chaos = s.mode === 'chaos';
    return `<section class="panel">
      <h3>🎮 ${t('gameMode')}</h3>
      <div class="modes">${modes}</div>
    </section>
    <section class="panel">
      <h3>⚙️ ${t('settings')}</h3>
      <div class="row"><span>🕵️ ${t('imposters')}</span>
        ${chaos ? `<b class="chaos-pill">${t('chaosImp')}</b>` : `<div class="stepper">
          <button class="step" data-a="setImp" data-v="-1" ${dis || (s.imposters <= 1 ? 'disabled' : '')}>−</button><b>${Math.min(s.imposters, maxImp)}</b><button class="step" data-a="setImp" data-v="1" ${dis || (s.imposters >= maxImp ? 'disabled' : '')}>+</button>
        </div>`}</div>
      ${!chaos && editable && s.imposters >= maxImp && nPlayers >= 3 ? `<div class="note">${t('maxImpNote')}</div>` : ''}
      <div class="row"><span>⏱️ ${t('timer')}</span>
        <div class="seg">${[0, 1, 2, 3, 5, 10].map(m => `<button class="${s.timer === m ? 'on' : ''}" data-a="setTimer" data-v="${m}" ${dis}>${m === 0 ? '∞' : m + ' ' + t('min')}</button>`).join('')}</div></div>
      ${s.mode === 'classic' || s.mode === 'chaos' || s.mode === 'write' ? toggleRow('💡 ' + t('hint'), s.hint, 'setHint', dis) : ''}
      ${toggleRow(t('lastChance'), s.lastChance, 'setLast', dis)}
      <div class="row col"><span>📚 ${t('categories')} <small class="muted">(${total})</small>
        ${editable ? `<span class="mini-links"><a data-a="catsAll">${t('all')}</a> · <a data-a="catsNone">${t('none')}</a> · <a data-a="editWords">${t('editWords')}</a></span>` : ''}</span>
        <div class="chips">${cats}</div></div>
    </section>`;
  }
  function toggleRow(label, on, action, dis) {
    return `<div class="row"><span>${label}</span>
      <button class="switch ${on ? 'on' : ''}" data-a="${action}" data-v="${on ? '0' : '1'}" ${dis || ''} role="switch" aria-checked="${on}"><span></span></button></div>`;
  }
  function applySetting(s, a, v, nPlayers) {
    const maxImp = maxImposters(nPlayers);
    if (a === 'setImp') s.imposters = Math.max(1, Math.min(maxImp, Math.min(s.imposters, maxImp) + Number(v)));
    if (a === 'setTimer') s.timer = Number(v);
    if (a === 'setHint') s.hint = v === '1';
    if (a === 'setLast') s.lastChance = v === '1';
    if (a === 'setMode' && MODES.includes(v)) s.mode = v;
    if (a === 'setCat') {
      if (s.cats.includes(v)) { if (s.cats.length > 1) s.cats = s.cats.filter(c => c !== v); }
      else if (v !== 'custom' || s.custom.length) s.cats = s.cats.concat(v);
    }
    if (a === 'catsAll') s.cats = CATEGORIES.map(c => c.id).concat(s.custom.length ? ['custom'] : []);
    if (a === 'catsNone') s.cats = s.custom.length ? ['custom'] : [CATEGORIES[0].id];
    if (a === 'setCustom') {
      s.custom = parseCustom(v);
      if (s.custom.length && !s.cats.includes('custom')) s.cats = s.cats.concat('custom');
      if (!s.custom.length) { s.cats = s.cats.filter(c => c !== 'custom'); if (!s.cats.length) s.cats = CATEGORIES.map(c => c.id); }
    }
  }
  function sanitizeSettings(s) {
    const d = defaultSettings();
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    const ids = CATEGORIES.map(c => c.id).concat('custom');
    s.custom = parseCustom((s.custom || []).join('\n'));
    s.cats = (s.cats || []).filter(c => ids.includes(c) && (c !== 'custom' || s.custom.length)); if (!s.cats.length) s.cats = CATEGORIES.map(c => c.id);
    s.imposters = Math.max(1, Math.min(10, s.imposters | 0 || 1)); if (![0, 1, 2, 3, 5, 10].includes(s.timer)) s.timer = 0;
    if (!MODES.includes(s.mode)) s.mode = 'classic';
    s.hint = s.hint !== false; s.lastChance = s.lastChance !== false;
    return s;
  }

  // Reveal card (hold / swipe up, or tap)
  function cardHTML(inner, label) {
    const tap = app.cfg.reveal === 'tap';
    return `<div class="card-wrap" id="card">
      <div class="card-under">${inner}</div>
      <div class="card-cover ${app.cardUp ? 'up' : ''}" id="cover">
        <div class="cover-pattern"></div>
        <div class="cover-content">
          <div class="cover-logo">?</div>
          <div class="cover-label">${label || t('yourCard')}</div>
          <div class="cover-hint">${tap ? '👆 ' + t('showWord').replace('👁 ', '') : `<span class="arrow">⬆</span> ${t('holdOrSwipe')}`}</div>
        </div>
      </div>
    </div>
    ${tap ? `<button class="btn big yellow" data-a="toggleCard" id="toggleCard">${app.cardUp ? t('hideWord') : t('showWord')}</button>` : ''}`;
  }
  function roleInner(isImp, word, catId, showCat) {
    const speakBtn = txt => app.cfg.readAloud ? `<button class="btn small speak" data-a="speak" data-v="${esc(txt)}">${t('readWord')}</button>` : '';
    if (isImp) {
      return `<div class="role imp">
        <div class="role-small">${t('youAre')}</div>
        <div class="role-big">${t('imposter')}</div>
        ${showCat && catId ? `<div class="role-cat">${t('category')}: ${esc(catName(catId))}</div>` : ''}
        <div class="role-tip">${t('imposterTip')}</div>${speakBtn(t('youAre') + ' ' + t('imposter'))}</div>`;
    }
    return `<div class="role crew">
      <div class="role-small">${t('yourWord')}</div>
      <div class="role-big word">${esc(wordText(word))}</div>
      ${catId ? `<div class="role-cat">${esc(catName(catId))}</div>` : ''}
      <div class="role-tip">${t('crewTip')}</div>${speakBtn(wordText(word))}</div>`;
  }
  function reveal() {
    if (app.screen === 'online' && app.V && app.V.round) {
      app.revealed = 'o' + app.V.roundNo;
      const btn = document.getElementById('seenBtn'); if (btn && !app.V.round.seen.includes(app.V.me)) btn.disabled = false;
    }
    if (app.screen === 'local' && app.L) { app.revealed = 'L' + app.L.roundNo + ':' + app.L.idx; const btn = document.getElementById('seenBtn'); if (btn) btn.disabled = false; }
  }
  function bindCard() {
    const cover = document.getElementById('cover');
    if (!cover) return;
    if (app.cfg.reveal === 'tap') {
      cover.addEventListener('click', () => actions.toggleCard());
      return;
    }
    let startY = 0, dy = 0, holdT = null, active = false, done = false;
    const h = () => cover.offsetHeight || 400;
    const set = (y, anim) => { cover.style.transition = anim ? 'transform .35s cubic-bezier(.2,1.4,.4,1)' : 'none'; cover.style.transform = `translateY(${y}px) rotate(${y / h() * 4}deg)`; };
    const rv = () => { if (!done) { done = true; sfx('reveal'); buzz(30); reveal(); } };
    cover.addEventListener('pointerdown', e => {
      active = true; app.dragging = true; startY = e.clientY; dy = 0;
      try { cover.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      holdT = setTimeout(() => { if (active && Math.abs(dy) < 10) { set(-h() * 0.78, true); rv(); } }, 280);
    });
    cover.addEventListener('pointermove', e => {
      if (!active) return;
      dy = Math.min(0, e.clientY - startY);
      if (Math.abs(dy) > 10) { clearTimeout(holdT); set(Math.max(dy, -h() * 0.9), false); if (-dy > h() * 0.4) rv(); }
    });
    const end = () => {
      if (!active) return; active = false; clearTimeout(holdT); set(0, true);
      setTimeout(() => { app.dragging = false; if (app.pendingRender) { app.pendingRender = false; render(); } }, 380);
    };
    cover.addEventListener('pointerup', end); cover.addEventListener('pointercancel', end); cover.addEventListener('lostpointercapture', end);
    cover.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Avatar / name editor (profile & local players)
  function editorHTML(name, av) {
    const chars = CHARACTERS.map(c => `<button class="char-pick ${av.type === 'char' && av.id === c.id ? 'on' : ''}" data-a="pickChar" data-v="${c.id}">
      ${avatarHTML({ type: 'char', id: c.id }, 64)}<span>${c.name}</span></button>`).join('');
    return `<div class="editor">
      <div class="editor-preview">${avatarHTML(av, 120, 'big')}</div>
      <label class="lbl" for="nameInput">${t('yourName')}</label>
      <input id="nameInput" data-draft="name" class="input" maxlength="16" placeholder="${t('namePh')}" value="${esc(name)}" autocomplete="off">
      <label class="lbl">${t('chooseChar')}</label>
      <div class="char-grid">${chars}</div>
      <label class="lbl">${t('orPhoto')}</label>
      <div class="photo-row">
        <label class="btn small blue">${t('uploadPhoto')}<input type="file" accept="image/*" id="photoInput" hidden></label>
        ${av.type === 'photo' ? `<button class="btn small" data-a="removePhoto">${t('removePhoto')}</button>` : ''}
      </div>
    </div>`;
  }
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
          const s = Math.min(img.width, img.height);
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject; img.src = fr.result;
      };
      fr.onerror = reject; fr.readAsDataURL(file);
    });
  }

  // ---------- Game logic (shared) ----------
  function wordPool(settings) {
    const pool = [];
    WORDS.forEach((w, i) => { if (settings.cats.includes(w.cat)) pool.push({ key: 'b' + i, w: { de: w.de, en: w.en, sr: w.sr }, cat: w.cat }); });
    if (settings.cats.includes('custom')) settings.custom.forEach(txt => pool.push({ key: 'c:' + txt, w: { de: txt, en: txt, sr: txt }, cat: 'custom' }));
    if (!pool.length) WORDS.forEach((w, i) => pool.push({ key: 'b' + i, w: { de: w.de, en: w.en, sr: w.sr }, cat: w.cat }));
    return pool;
  }
  function pickRound(players, settings, used) {
    const pool = wordPool(settings);
    let fresh = pool.filter(p => !used.includes(p.key));
    if (!fresh.length) { used.length = 0; fresh = pool; }
    const pick = fresh[rand(fresh.length)];
    used.push(pick.key);
    const ids = players.map(p => p.id);
    const maxImp = maxImposters(ids.length);
    const n = settings.mode === 'chaos' ? 1 + rand(maxImp) : Math.min(settings.imposters, maxImp);
    const imposters = shuffle(ids).slice(0, n);
    let impWord = null;
    if (settings.mode === 'undercover') {
      let others = pool.filter(p => p.cat === pick.cat && p.key !== pick.key);
      if (!others.length) others = pool.filter(p => p.key !== pick.key);
      impWord = others.length ? others[rand(others.length)].w : null;
    }
    const order = shuffle(ids);
    return { mode: settings.mode, word: pick.w, impWord, cat: pick.cat, imposters, starter: order[0], order, participants: ids,
      seen: {}, votes: {}, clues: {}, submitted: {}, clueRound: 0, stoppedBy: null, endsAt: null, guess: null, result: null };
  }
  function tallyVotes(round) {
    const tally = {};
    Object.values(round.votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(id => tally[id] === max);
    return { votedOut: max > 0 && top.length === 1 ? top[0] : null, tally };
  }
  function makeGuess(round, settings) {
    const pool = wordPool(settings);
    let decoys = pool.filter(p => p.cat === round.cat && wordText(p.w) !== wordText(round.word));
    if (decoys.length < 7) decoys = decoys.concat(pool.filter(p => p.cat !== round.cat));
    const opts = shuffle([round.word].concat(shuffle(decoys).slice(0, 7).map(p => p.w)));
    return { by: round.result.votedOut, options: opts, correct: opts.indexOf(round.word), pick: null };
  }
  function finishRound(round, players, stolen) {
    const res = round.result; res.stolen = !!stolen;
    res.crewWin = res.caught && !res.stolen;
    players.forEach(p => {
      if (!round.participants.includes(p.id)) return;
      const imp = round.imposters.includes(p.id);
      if (res.crewWin && !imp) p.score = (p.score || 0) + 1 + (round.votes[p.id] && round.imposters.includes(round.votes[p.id]) ? 1 : 0);
      if (!res.crewWin && imp) p.score = (p.score || 0) + 2 + (res.stolen ? 1 : 0);
    });
  }

  // ---------- ONLINE: Host ----------
  function photoOf(p) { return p.avatar && p.avatar.type === 'photo' && p.avatar.data ? p.avatar.data : null; }
  function publicAvatar(p) { return p.avatar && p.avatar.type === 'photo' ? { type: 'photo', id: p.id } : p.avatar; }

  async function hostCreate() {
    leaveOnline(true);
    if (!window.RoomNet || !RoomNet.available()) return showToast(t('connError'));
    const code = makeCode();
    const token = { pending: true };
    app.net = token; app.screen = 'connecting'; render();
    const me = { id: app.profile.id, name: app.profile.name, avatar: app.profile.avatar, score: 0, online: true };
    const G = { code, hostId: me.id, phase: 'lobby', roundNo: 0, players: [me], settings: sanitizeSettings(store.get('settings', defaultSettings())), used: [], round: null, seq: 0 };
    let room;
    try {
      room = await RoomNet.host(code, {
        onMessage: m => { if (app.net && app.net.room === room) hostHandle(m); },
        onReconnect: () => { if (app.net && app.net.room === room) { app.netDown = false; hostBroadcast(); } },
        onStatus: up => { if (app.net && app.net.room === room) { app.netDown = !up; render(); } }
      });
    } catch (e) {
      if (app.net === token) { app.net = null; goHome(t('connError')); }
      return;
    }
    if (app.net !== token) { room.close(); return; }
    app.net = { isHost: true, code, room, timer: null };
    app.G = G; app.photos = {};
    if (photoOf(me)) app.photos[me.id] = photoOf(me);
    app.netDown = false; app.screen = 'online';
    hostBroadcast();
  }
  function hostHandle(msg) {
    const G = app.G; if (!G || !msg || typeof msg !== 'object') return;
    const pid = String(msg.from || '').slice(0, 40); if (!pid || pid === G.hostId) return;
    let p = G.players.find(x => x.id === pid);
    if (msg.t === 'hello') {
      const pl = msg.player || {};
      const av = sanitizeAvatar(pl.avatar);
      const name = String(pl.name || '???').slice(0, 16);
      if (p) { p.name = name; p.avatar = av; p.online = true; }
      else {
        if (G.players.length >= 20) { app.net.room.send(pid, { t: 'error', code: 'full' }); return; }
        p = { id: pid, name, avatar: av, score: 0, online: true }; G.players.push(p); sfx('pop');
      }
      const photo = photoOf(p);
      if (photo && app.photos[pid] !== photo) {
        app.photos[pid] = photo;
        G.players.forEach(o => { if (o.id !== G.hostId && o.id !== pid) app.net.room.send(o.id, { t: 'photos', map: { [pid]: photo } }); });
      }
      app.net.room.send(pid, { t: 'photos', map: app.photos });
      hostCheckProgress(); hostBroadcast(); return;
    }
    if (!p) { app.net.room.send(pid, { t: 'rehello' }); return; }
    if (msg.t === 'drop') {
      if (G.phase === 'lobby') G.players = G.players.filter(x => x.id !== pid); else p.online = false;
      hostCheckProgress(); hostBroadcast(); return;
    }
    if (!p.online) p.online = true;
    hostAction(pid, msg);
  }
  function sanitizeAvatar(av) {
    if (av && av.type === 'photo' && typeof av.data === 'string' && av.data.startsWith('data:image/') && av.data.length < 60000) return { type: 'photo', data: av.data };
    const id = av && CHARACTERS.find(c => c.id === av.id) ? av.id : CHARACTERS[0].id;
    return { type: 'char', id };
  }
  function hostAction(pid, msg) {
    const G = app.G; if (!G) return; const r = G.round; const isHost = pid === G.hostId;
    const inRound = r && r.participants.includes(pid);
    switch (msg.t) {
      case 'seen': if (G.phase === 'reveal' && inRound) r.seen[pid] = true; break;
      case 'clue':
        if (G.phase === 'clues' && inRound && !r.submitted[pid]) {
          const txt = String(msg.text || '').trim().slice(0, 30);
          if (txt) { (r.clues[pid] = r.clues[pid] || []).push(txt); r.submitted[pid] = true; }
        }
        break;
      case 'moreClues': if (isHost && G.phase === 'discuss' && r.mode === 'write') { G.phase = 'clues'; r.submitted = {}; r.clueRound++; } break;
      case 'stop': if ((G.phase === 'discuss' || G.phase === 'clues') && inRound) { G.phase = 'vote'; r.stoppedBy = pid; clearTimeout(app.net.timer); } break;
      case 'vote':
        if (G.phase === 'vote' && inRound && r.participants.includes(msg.target) && msg.target !== pid) r.votes[pid] = msg.target;
        break;
      case 'guess':
        if (G.phase === 'guess' && r.guess && r.guess.by === pid && r.guess.pick == null) {
          const i = Number(msg.i); if (i >= 0 && i < r.guess.options.length) { r.guess.pick = i; finishRound(r, G.players, i === r.guess.correct); G.phase = 'result'; }
        }
        break;
      case 'skipGuess': if (isHost && G.phase === 'guess') { finishRound(r, G.players, false); G.phase = 'result'; } break;
      case 'leave':
        if (G.phase === 'lobby') G.players = G.players.filter(x => x.id !== pid);
        else { const p = G.players.find(x => x.id === pid); if (p) p.online = false; }
        break;
      // nur Host
      case 'settings': if (isHost && G.phase === 'lobby') { applySetting(G.settings, msg.a, msg.v, G.players.length); store.set('settings', G.settings); } break;
      case 'start':
        if (isHost && (G.phase === 'lobby' || G.phase === 'result')) {
          const pl = G.players.filter(p => p.online);
          if (pl.length < 3) return showToast(t('needPlayers'));
          G.players = pl;
          G.round = pickRound(G.players, G.settings, G.used); G.roundNo++; G.phase = 'reveal';
        }
        break;
      case 'lobby': if (isHost) { G.phase = 'lobby'; G.round = null; G.players = G.players.filter(p => p.online); clearTimeout(app.net.timer); } break;
      case 'resetScores': if (isHost && G.phase === 'lobby') { G.players.forEach(p => { p.score = 0; }); G.roundNo = 0; } break;
      case 'endVote': if (isHost && G.phase === 'vote') hostFinishVote(); break;
      case 'skipReveal': if (isHost && G.phase === 'reveal') hostAfterReveal(); break;
      case 'skipClues': if (isHost && G.phase === 'clues') G.phase = 'discuss'; break;
      case 'kick':
        if (isHost && msg.target !== G.hostId) {
          app.net.room.send(msg.target, { t: 'kicked' });
          G.players = G.players.filter(p => p.id !== msg.target);
        }
        break;
    }
    hostCheckProgress(); hostBroadcast();
  }
  function onlineIds() { return app.G.round.participants.filter(id => { const p = app.G.players.find(x => x.id === id); return p && p.online; }); }
  function hostAfterReveal() {
    const G = app.G;
    G.round.endsAt = G.settings.timer ? Date.now() + G.settings.timer * 60000 : null;
    clearTimeout(app.net.timer);
    if (G.round.endsAt) app.net.timer = setTimeout(() => { if (app.G === G && (G.phase === 'discuss' || G.phase === 'clues')) { G.phase = 'vote'; G.round.stoppedBy = '__time'; hostBroadcast(); } }, G.settings.timer * 60000);
    G.phase = G.round.mode === 'write' ? 'clues' : 'discuss';
  }
  function hostFinishVote() {
    const G = app.G, r = G.round; clearTimeout(app.net.timer);
    const { votedOut, tally } = tallyVotes(r);
    r.result = { votedOut, tally, caught: !!votedOut && r.imposters.includes(votedOut) };
    const guesser = r.result.caught && G.players.find(p => p.id === votedOut && p.online);
    if (r.result.caught && G.settings.lastChance && guesser) { r.guess = makeGuess(r, G.settings); G.phase = 'guess'; }
    else { finishRound(r, G.players, false); G.phase = 'result'; }
  }
  function hostCheckProgress() {
    const G = app.G; if (!G || !G.round) return;
    const ids = onlineIds();
    if (G.phase === 'reveal' && ids.length && ids.every(id => G.round.seen[id])) hostAfterReveal();
    if (G.phase === 'clues' && ids.length && ids.every(id => G.round.submitted[id])) G.phase = 'discuss';
    if (G.phase === 'vote' && ids.length && ids.every(id => G.round.votes[id])) hostFinishVote();
    if (G.phase === 'guess' && G.round.guess && !ids.includes(G.round.guess.by)) { finishRound(G.round, G.players, false); G.phase = 'result'; }
  }
  function viewFor(pid) {
    const G = app.G, r = G.round;
    const v = { code: G.code, hostId: G.hostId, me: pid, phase: G.phase, roundNo: G.roundNo, settings: G.settings,
      players: G.players.map(p => ({ id: p.id, name: p.name, avatar: publicAvatar(p), score: p.score || 0, online: p.online })) };
    if (r) {
      const part = r.participants.includes(pid), imp = r.imposters.includes(pid), done = G.phase === 'result';
      const under = r.mode === 'undercover';
      const knowsImp = part && imp && !under;
      v.round = { mode: r.mode, participants: r.participants, order: r.order, starter: r.starter, seen: Object.keys(r.seen), voted: Object.keys(r.votes),
        stoppedBy: r.stoppedBy, remaining: r.endsAt ? Math.max(0, r.endsAt - Date.now()) : null, part, imp: knowsImp,
        word: part ? (imp ? (under ? r.impWord : null) : r.word) : null,
        cat: part && (!imp || under || G.settings.hint) ? r.cat : null,
        myVote: r.votes[pid] || null, nImp: r.mode === 'chaos' && !done ? null : r.imposters.length,
        clues: r.clues, submitted: Object.keys(r.submitted), clueRound: r.clueRound,
        guess: r.guess ? { by: r.guess.by, options: r.guess.options, pick: r.guess.pick } : null };
      if (done) {
        v.round.word = r.word; v.round.cat = r.cat; v.round.impWord = r.impWord;
        v.round.result = Object.assign({}, r.result, { imposters: r.imposters, votes: r.votes, guessCorrect: r.guess ? r.guess.correct : null });
      }
    }
    return v;
  }
  function hostBroadcast() {
    if (!app.net || !app.net.isHost || !app.G) return;
    const G = app.G; G.seq++;
    G.players.forEach(p => { if (p.id !== G.hostId) app.net.room.send(p.id, { t: 'state', seq: G.seq, v: viewFor(p.id) }); });
    receiveView(viewFor(G.hostId));
  }

  // ---------- ONLINE: Mitspieler ----------
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  async function clientJoin(code) {
    code = normCode(code);
    if (code.length !== 5) return showToast(t('roomNotFound'));
    leaveOnline(true);
    if (!window.RoomNet || !RoomNet.available()) return showToast(t('connError'));
    const token = { pending: true };
    app.net = token; app.screen = 'connecting'; render();
    let room;
    try {
      room = await RoomNet.join(code, app.profile.id, {
        onMessage: m => { if (app.net && app.net.room === room) clientMessage(m); },
        onHost: s => { if (app.net && app.net.room === room) clientHostStatus(s); },
        onReconnect: () => { if (app.net && app.net.room === room) { app.netDown = false; sendHello(); render(); } },
        onStatus: up => { if (app.net && app.net.room === room) { app.netDown = !up; render(); } }
      });
    } catch (e) {
      if (app.net === token) { app.net = null; goHome(e && e.message === 'notfound' ? t('roomNotFound') : t('connError')); }
      return;
    }
    if (app.net !== token) { room.close(); return; }
    app.net = { isHost: false, code, room, lastSeq: 0, helloTries: 0 };
    app.photos = {}; app.hostAway = false; app.netDown = false;
    sendHello();
  }
  function sendHello() {
    const n = app.net; if (!n || n.isHost || !n.room) return;
    n.room.send({ t: 'hello', player: { name: app.profile.name, avatar: app.profile.avatar } });
    clearTimeout(n.helloT);
    n.helloT = setTimeout(() => {
      if (app.net !== n || app.V) return;
      if (++n.helloTries < 4) sendHello();
      else { leaveOnline(true); goHome(t('connError')); }
    }, 4000);
  }
  function clientMessage(m) {
    const n = app.net;
    if (m.t === 'state') {
      if (m.seq && m.seq <= n.lastSeq && app.V) return;
      n.lastSeq = m.seq || n.lastSeq; clearTimeout(n.helloT);
      receiveView(m.v);
    }
    if (m.t === 'photos' && m.map) { Object.assign(app.photos, m.map); render(); }
    if (m.t === 'rehello') sendHello();
    if (m.t === 'error') { leaveOnline(true); goHome(t('roomFull')); }
    if (m.t === 'kicked') { leaveOnline(true); goHome(t('kicked')); }
  }
  function clientHostStatus(s) {
    const n = app.net;
    if (s === 'closed') { leaveOnline(true); goHome(t('hostLeft')); return; }
    clearTimeout(n.awayT);
    app.hostAway = !s;
    if (!s) n.awayT = setTimeout(() => { if (app.net === n && app.hostAway) { leaveOnline(true); goHome(t('hostLeft')); } }, 180000);
    else sendHello();
    render();
  }
  function send(msg) {
    const n = app.net; if (!n || !n.room) return;
    if (n.isHost) hostAction(app.G.hostId, msg);
    else n.room.send(msg);
  }
  function leaveOnline(silent) {
    const n = app.net; app.net = null; app.G = null; app.V = null; app.hostAway = false; app.netDown = false;
    if (!n || !n.room) return;
    clearTimeout(n.timer); clearTimeout(n.helloT); clearTimeout(n.awayT);
    if (!n.isHost && !silent) { n.room.send({ t: 'leave' }); setTimeout(() => n.room.close(), 400); }
    else n.room.close();
  }
  let lastPhaseKey = '';
  function receiveView(v) {
    const key = v.phase + ':' + v.roundNo;
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      app.voteSel = null;
      if (v.phase === 'reveal') { sfx('pop'); app.cardUp = false; }
      if (v.phase === 'vote') { sfx('stop'); buzz([80, 60, 80]); }
      if (v.phase === 'guess') sfx('stop');
      if (v.phase === 'result' && v.round && v.round.result) {
        const meImp = v.round.result.imposters.includes(v.me);
        sfx(v.round.result.crewWin !== meImp ? 'win' : 'lose');
      }
    }
    if (v.round && v.round.remaining != null) v.round.localEnds = Date.now() + v.round.remaining;
    app.V = v;
    if (app.screen === 'connecting') app.screen = 'online';
    render();
  }

  // ---------- Screens: shared parts ----------
  function playerName(players, id) { const p = players.find(p => p.id === id); return p ? p.name : '?'; }
  function playerTile(p, opts = {}) {
    const cls = ['ptile', opts.cls || '', p.online === false ? 'off' : ''].join(' ');
    const tag = opts.action ? 'button' : 'div';
    return `<${tag} class="${cls}" ${opts.action ? `data-a="${opts.action}" data-v="${p.id}"` : ''}>
      ${opts.num ? `<span class="pnum">${opts.num}</span>` : ''}
      ${avatarHTML(p.avatar, opts.size || 58)}
      <span class="pname">${esc(p.name)}${opts.badge || ''}</span>
      ${opts.clue ? `<span class="pclue">${opts.clue}</span>` : ''}
      ${opts.sub ? `<span class="psub">${opts.sub}</span>` : ''}
    </${tag}>`;
  }
  function modeBadge(mode, nImp) {
    return `<div class="mode-badge">${MODE_ICON[mode]} ${t('mode_' + mode)} · 🕵️ ${nImp == null ? '?' : nImp}</div>`;
  }
  function discussHTML(players, r, opts) {
    const starter = players.find(p => p.id === r.starter);
    const ordered = (app.cfg.showOrder ? r.order : r.participants).map(id => players.find(p => p.id === id)).filter(Boolean);
    const clueOf = id => (r.clues && r.clues[id] ? r.clues[id].map(esc).join(' · ') : '');
    return `${helpHTML('discuss')}
      ${modeBadge(r.mode, r.nImp)}
      ${starter ? `<section class="panel starter">
        ${avatarHTML(starter.avatar, 84, 'bob')}
        <div><div class="starter-name">${esc(starter.name)}</div><div class="starter-sub">${t('starts')}</div></div>
      </section>` : ''}
      ${r.localEnds ? `<div class="timer" id="timer" data-ends="${r.localEnds}">--:--</div>` : ''}
      ${r.mode === 'chaos' ? `<p class="tip">🌪️ ${t('howManyImp')}</p>` : ''}
      <p class="tip">${t('discussTip')}</p>
      ${app.cfg.showOrder ? `<h3 class="sec-title">🔢 ${t('order')}</h3>` : ''}
      <div class="pgrid ${r.mode === 'write' ? 'with-clues' : ''}">${ordered.map((p, i) => playerTile(p, { size: 52, num: app.cfg.showOrder ? i + 1 : 0, clue: r.mode === 'write' ? (clueOf(p.id) || '…') : '' })).join('')}</div>
      ${opts.peek || ''}
      <div class="sticky-bottom">
        ${opts.extra || ''}
        <button class="btn stop-btn" data-a="${opts.stopAction}">✋ ${t('stop')}</button>
        <div class="muted center">${t('stopTip')}</div>
      </div>`;
  }
  function resultHTML(players, r, res) {
    const out = res.votedOut ? players.find(p => p.id === res.votedOut) : null;
    const imps = players.filter(p => res.imposters.includes(p.id));
    let head = out
      ? `<div class="reveal-out ${res.caught ? 'good' : 'bad'}">
          ${avatarHTML(out.avatar, 110, 'pop-in')}
          <div class="out-name">${esc(out.name)}</div>
          <div class="out-text">${res.caught ? t('wasImposter') : t('wasNotImposter')}</div></div>`
      : `<div class="reveal-out bad"><div class="big-emoji">🤷</div><div class="out-text">${t('tie')}</div></div>`;
    if (out && res.caught && r.guess && r.guess.pick != null) {
      head += `<div class="guess-res ${res.stolen ? 'bad' : 'good'}">🎯 <b>${esc(out.name)}</b> ${res.stolen ? t('stolen') : t('guessFail')}
        ${!res.stolen ? `<small>(${esc(wordText(r.guess.options[r.guess.pick]))})</small>` : ''}</div>`;
    }
    const sorted = players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    const votes = Object.entries(res.votes || {});
    return `${helpHTML('result')}
      <div class="winner-banner ${res.crewWin ? 'crew' : 'imp'}">${res.crewWin ? '🎉 ' + t('crewWins') : '😈 ' + t('impostersWin')}</div>
      ${head}
      <section class="panel result-info">
        <div class="row"><span>${t('theWord')}:</span><b class="word-pill">${esc(wordText(r.word))}</b></div>
        ${r.impWord ? `<div class="row"><span>${t('impWordWas')}:</span><b class="word-pill imp">${esc(wordText(r.impWord))}</b></div>` : ''}
        <div class="row"><span>${t('category')}:</span><span>${esc(catName(r.cat))}</span></div>
        <div class="row col"><span>🕵️ ${t('theImposters')} (${imps.length}):</span><div class="pgrid small">${imps.map(p => playerTile(p, { size: 48, cls: 'imp' })).join('')}</div></div>
      </section>
      ${votes.length ? `<section class="panel"><h3>🗳️ ${t('votesTitle')}</h3><ul class="votes">${votes.map(([a, b]) =>
        `<li>${esc(playerName(players, a))} <span>→</span> <b class="${res.imposters.includes(b) ? 'hit' : ''}">${esc(playerName(players, b))}</b></li>`).join('')}</ul></section>` : ''}
      <section class="panel">
        <h3>🏆 ${t('score')}</h3>
        <ol class="scores">${sorted.map(p => `<li>${avatarHTML(p.avatar, 36)}<span>${esc(p.name)}${res.imposters.includes(p.id) ? ' 🕵️' : ''}</span>
          ${res.tally && res.tally[p.id] ? `<small class="muted">🗳️${res.tally[p.id]}</small>` : ''}<b>${p.score || 0}</b></li>`).join('')}</ol>
      </section>`;
  }
  function guessOptionsHTML(options, action) {
    return `<div class="guess-grid">${options.map((w, i) => `<button class="btn guess-opt" data-a="${action}" data-v="${i}">${esc(wordText(w))}</button>`).join('')}</div>`;
  }

  // ---------- Online screens ----------
  function screenOnline() {
    const v = app.V;
    if (!v) return screenConnecting();
    const isHost = v.me === v.hostId;
    const r = v.round;
    const banner = app.netDown ? `<div class="net-banner">📶 ${t('reconnecting')}</div>` : (app.hostAway ? `<div class="net-banner">⏳ ${t('hostAway')}</div>` : '');
    const bar = title => topbar(title, 'leave') + banner;
    if (v.phase === 'lobby') {
      const players = v.players.map(p => playerTile(p, {
        badge: (p.id === v.hostId ? ' 👑' : '') + (p.id === v.me ? ` <small>(${t('you')})</small>` : ''),
        sub: isHost && p.id !== v.me ? `<button class="tiny" data-a="kick" data-v="${p.id}" aria-label="${t('kick')}">✕</button>` : (p.score ? `<small class="score-dot">${p.score}</small>` : '')
      })).join('');
      return `${bar(t('lobby'))}
        <main class="screen">
          ${helpHTML('lobby')}
          <section class="panel code-panel">
            <div class="muted">${t('shareCode')}</div>
            <button class="room-code" data-a="copyCode">${esc(v.code)}</button>
            <div class="btn-row"><button class="btn small blue" data-a="share">${t('copyLink')}</button></div>
          </section>
          <section class="panel">
            <h3>👥 ${t('players')} <span class="badge">${v.players.length}</span>
              ${isHost && v.roundNo ? `<button class="link-btn small-link" data-a="resetScores">${t('resetScores')}</button>` : ''}</h3>
            <div class="pgrid">${players}</div>
          </section>
          ${settingsHTML(v.settings, v.players.length, isHost, true)}
          <div class="sticky-bottom">
            ${isHost ? `<button class="btn big red" data-a="start" ${v.players.length < 3 ? 'disabled' : ''}>▶ ${t('start')}</button>
              ${v.players.length < 3 ? `<div class="muted center">${t('needPlayers')}</div>` : ''}`
              : `<div class="waiting"><span class="dots"></span> ${t('waitHost')}</div>`}
          </div>
        </main>`;
    }
    if (!r || !r.part) {
      return `${bar(t('round') + ' ' + v.roundNo)}<main class="screen center-screen">
        <div class="big-emoji bob">⏳</div><h2>${t('roomFull')}</h2></main>`;
    }
    const peek = `<details class="peek"><summary>👁 ${t('yourCard')}</summary>${roleInner(r.imp, r.word, r.cat, true)}</details>`;
    if (v.phase === 'reveal') {
      const iSeen = r.seen.includes(v.me);
      return `${bar(t('round') + ' ' + v.roundNo)}
        <main class="screen reveal-screen">
          ${helpHTML('reveal')}
          ${cardHTML(roleInner(r.imp, r.word, r.cat, true), esc(playerName(v.players, v.me)))}
          <div class="reveal-actions">
            <button class="btn big green" data-a="seen" id="seenBtn" ${iSeen ? 'disabled' : (app.revealed === 'o' + v.roundNo ? '' : 'disabled')}>${iSeen ? t('waitingOthers') : t('seenIt')}</button>
            <div class="progress-dots">${r.participants.map(id => `<span class="${r.seen.includes(id) ? 'on' : ''}" title="${esc(playerName(v.players, id))}"></span>`).join('')}</div>
            <div class="muted center">${r.seen.length}/${r.participants.length} ${t('seen')}</div>
            ${isHost ? `<button class="link-btn" data-a="skipReveal">⏭ ${t('next')}</button>` : ''}
          </div>
        </main>`;
    }
    if (v.phase === 'clues') {
      const sent = r.submitted.includes(v.me);
      const tiles = r.order.map(id => v.players.find(p => p.id === id)).filter(Boolean).map((p, i) => playerTile(p, {
        size: 48, num: i + 1, sub: r.submitted.includes(p.id) ? '✅' : '✍️',
        clue: r.clues[p.id] ? r.clues[p.id].map(esc).join(' · ') : '' })).join('');
      return `${bar(t('clueRound') + ' ' + (r.clueRound + 1))}
        <main class="screen">
          ${helpHTML('clues')}
          ${r.localEnds ? `<div class="timer" id="timer" data-ends="${r.localEnds}">--:--</div>` : ''}
          ${sent ? `<div class="waiting">✅ ${t('clueSent')} ${r.submitted.length}/${r.participants.length}</div>` : `<section class="panel">
            <h3>✍️ ${t('yourClue')}</h3>
            <input id="clueInput" data-draft="clue" class="input" maxlength="30" placeholder="${t('cluePh')}" value="${esc(draft('clue', ''))}" autocomplete="off">
            <button class="btn big blue mt" data-a="sendClue">📨 ${t('send')}</button>
          </section>`}
          <div class="pgrid with-clues">${tiles}</div>
          ${peek}
          ${isHost ? `<button class="link-btn" data-a="skipClues">⏭ ${t('next')}</button>` : ''}
        </main>`;
    }
    if (v.phase === 'discuss') {
      return `${bar(t('discuss'))}
        <main class="screen discuss-screen">${discussHTML(v.players, r, {
          stopAction: 'stop', peek,
          extra: isHost && r.mode === 'write' ? `<button class="btn blue" data-a="moreClues">${t('moreClues')}</button>` : '' })}</main>`;
    }
    if (v.phase === 'vote') {
      const voted = !!r.myVote;
      const sel = app.voteSel;
      const who = r.stoppedBy === '__time' ? `⏰ ${t('timeUp')}` : `✋ <b>${esc(playerName(v.players, r.stoppedBy))}</b> ${t('stoppedBy')}`;
      const tiles = r.participants.map(id => v.players.find(p => p.id === id)).filter(Boolean).map(p => playerTile(p, {
        size: 64, action: !voted && p.id !== v.me ? 'selVote' : '', cls: (voted ? r.myVote === p.id : sel === p.id) ? 'selected' : (p.id === v.me ? 'self' : ''),
        sub: r.voted.includes(p.id) ? '✅' : '…', clue: r.mode === 'write' && r.clues[p.id] ? r.clues[p.id].map(esc).join(' · ') : ''
      })).join('');
      return `${bar(t('vote'))}
        <main class="screen">
          ${helpHTML('vote')}
          <div class="banner red">${who}</div>
          <h2 class="center">${t('whoIsImposter')}</h2>
          <div class="pgrid vote-grid">${tiles}</div>
          <div class="sticky-bottom">
            ${voted ? `<div class="waiting">🗳️ ${t('youVoted')} ${r.voted.length}/${r.participants.length}</div>`
              : `<button class="btn big red" data-a="castVote" ${sel ? '' : 'disabled'}>🗳️ ${t('voteFor')}${sel ? ': ' + esc(playerName(v.players, sel)) : ''}</button>`}
            ${isHost ? `<button class="link-btn" data-a="endVote">⏭ ${t('result')} (${r.voted.length}/${r.participants.length})</button>` : ''}
          </div>
        </main>`;
    }
    if (v.phase === 'guess') {
      const g = r.guess; const guesser = v.players.find(p => p.id === g.by);
      return `${bar(t('guessTitle'))}
        <main class="screen">
          ${helpHTML('guess')}
          <div class="banner red">🎯 ${t('guessTitle')}</div>
          <div class="reveal-out bad">${guesser ? avatarHTML(guesser.avatar, 96, 'pop-in') : ''}<div class="out-name">${esc(guesser ? guesser.name : '')}</div>
            <div class="out-text">${t('wasImposter')}</div></div>
          ${g.by === v.me ? `<p class="tip"><b>${t('guessYou')}</b></p>${guessOptionsHTML(g.options, 'guessPick')}`
            : `<div class="waiting"><span class="dots"></span> ${esc(guesser ? guesser.name : '')} ${t('guessWait')}</div>`}
          ${isHost && g.by !== v.me ? `<button class="link-btn" data-a="skipGuess">⏭ ${t('guessSkip')}</button>` : ''}
        </main>`;
    }
    if (v.phase === 'result') {
      return `${bar(t('result'))}<main class="screen">${resultHTML(v.players, r, r.result)}
        <div class="sticky-bottom">${isHost ? `<button class="btn big red" data-a="start">🔁 ${t('nextRound')}</button><button class="btn blue" data-a="toLobby">🏠 ${t('toLobby')}</button>`
          : `<div class="waiting"><span class="dots"></span> ${t('waitHost')}</div>`}</div></main>`;
    }
    return '';
  }

  // ---------- Local mode ----------
  function localInit() {
    const saved = store.get('localPlayers', null);
    app.L = { phase: 'setup', players: saved || [
      { id: uid(), name: app.profile.name || 'Spieler 1', avatar: app.profile.avatar, score: 0 }
    ], settings: sanitizeSettings(store.get('localSettings', defaultSettings())), used: [], idx: 0, round: null, roundNo: 0 };
    if (app.L.settings.mode === 'write') app.L.settings.mode = 'classic';
    app.L.players.forEach(p => { p.score = 0; });
    app.screen = 'local';
  }
  function localSave() { store.set('localPlayers', app.L.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }))); store.set('localSettings', app.L.settings); }
  function localRoleFor(p) {
    const r = app.L.round, imp = r.imposters.includes(p.id), under = r.mode === 'undercover';
    return { knowsImp: imp && !under, word: imp ? (under ? r.impWord : null) : r.word, cat: !imp || under || app.L.settings.hint ? r.cat : null };
  }
  function screenLocal() {
    const L = app.L;
    if (L.phase === 'setup') {
      return `${topbar(t('localSetup'), 'home')}
        <main class="screen">
          <section class="panel">
            <h3>👥 ${t('players')} <span class="badge">${L.players.length}</span></h3>
            <div class="pgrid">${L.players.map(p => playerTile(p, { action: 'lEdit', sub: `<span class="tiny" data-a="lRemove" data-v="${p.id}" role="button" aria-label="${t('remove')}">✕</span>` })).join('')}
              <button class="ptile add" data-a="lAdd"><span class="add-plus">＋</span><span class="pname">${t('addPlayer')}</span></button></div>
          </section>
          ${settingsHTML(L.settings, L.players.length, true, false)}
          <div class="sticky-bottom"><button class="btn big red" data-a="lStart" ${L.players.length < 3 ? 'disabled' : ''}>▶ ${t('start')}</button>
            ${L.players.length < 3 ? `<div class="muted center">${t('needPlayers')}</div>` : ''}</div>
        </main>`;
    }
    const r = L.round;
    const view = Object.assign({}, r, { nImp: r.mode === 'chaos' ? null : r.imposters.length });
    if (L.phase === 'pass' || L.phase === 'passGuess') {
      const p = L.phase === 'pass' ? L.players[L.idx] : L.players.find(x => x.id === r.result.votedOut);
      return `${topbar(t('round') + ' ' + L.roundNo, 'lQuit')}
        <main class="screen center-screen pass-screen">
          ${helpHTML('pass')}
          ${L.phase === 'pass' ? `<div class="muted">${L.idx + 1} / ${L.players.length}</div>` : `<div class="banner red">🎯 ${t('guessTitle')}</div>`}
          <h2>${t('passTo')}</h2>
          ${avatarHTML(p.avatar, 140, 'bob')}
          <div class="pass-name">${esc(p.name)}</div>
          <button class="btn big blue" data-a="lPassed">👆 ${t('ready')}</button>
          <div class="muted">${t('tapWhenReady')}</div>
        </main>`;
    }
    if (L.phase === 'reveal') {
      const p = L.players[L.idx]; const role = localRoleFor(p);
      return `${topbar(esc(p.name), 'lQuit')}
        <main class="screen reveal-screen">
          ${helpHTML('reveal')}
          ${cardHTML(roleInner(role.knowsImp, role.word, role.cat, true), esc(p.name))}
          <div class="reveal-actions"><button class="btn big green" data-a="lNext" id="seenBtn" ${app.revealed === 'L' + L.roundNo + ':' + L.idx ? '' : 'disabled'}>${t('next')} →</button></div>
        </main>`;
    }
    if (L.phase === 'discuss') {
      return `${topbar(t('discuss'), 'lQuit')}<main class="screen discuss-screen">${discussHTML(L.players, view, { stopAction: 'lStop' })}</main>`;
    }
    if (L.phase === 'vote') {
      return `${topbar(t('vote'), 'lQuit')}
        <main class="screen">
          ${helpHTML('vote')}
          <h2 class="center">${t('whoVotedOut')}</h2>
          <div class="pgrid vote-grid">${L.players.map(p => playerTile(p, { size: 64, action: 'lSel', cls: app.voteSel === p.id ? 'selected' : '' })).join('')}</div>
          <div class="sticky-bottom">
            <button class="btn big red" data-a="lVote" ${app.voteSel ? '' : 'disabled'}>🗳️ ${t('voteFor')}${app.voteSel ? ': ' + esc(L.players.find(p => p.id === app.voteSel).name) : ''}</button>
            <button class="link-btn" data-a="lTie">🤷 ${t('noOne')}</button>
          </div>
        </main>`;
    }
    if (L.phase === 'guess') {
      return `${topbar(t('guessTitle'), 'lQuit')}
        <main class="screen">
          ${helpHTML('guess')}
          <p class="tip"><b>${t('guessYou')}</b></p>${guessOptionsHTML(r.guess.options, 'lGuess')}
        </main>`;
    }
    if (L.phase === 'result') {
      const res = Object.assign({ imposters: r.imposters, votes: {} }, r.result);
      return `${topbar(t('result'), 'lQuit')}<main class="screen">${resultHTML(L.players, r, res)}
        <div class="sticky-bottom"><button class="btn big red" data-a="lStart">🔁 ${t('nextRound')}</button><button class="btn blue" data-a="lSetup">⚙️ ${t('settings')}</button></div></main>`;
    }
    return '';
  }
  function localResolve(votedOut) {
    const L = app.L, r = L.round;
    r.result = { votedOut, tally: null, caught: !!votedOut && r.imposters.includes(votedOut) };
    if (r.result.caught && L.settings.lastChance) { r.guess = makeGuess(r, L.settings); L.phase = 'passGuess'; render(); return; }
    finishRound(r, L.players, false); L.phase = 'result';
    sfx(r.result.crewWin ? 'win' : 'lose'); render();
  }

  // ---------- Other screens ----------
  function screenHome() {
    const needName = !app.profile.name;
    return `<header class="topbar home-top">
        <button class="icon-btn" data-a="openSettings" aria-label="${t('appSettings')}">⚙️</button>
        <div class="lang-pills">${LANGS.map(l => `<button class="lang-pill ${l.id === app.lang ? 'on' : ''}" data-a="lang" data-v="${l.id}" aria-label="${l.label}">${l.flag}</button>`).join('')}</div></header>
      <main class="screen home">
        <div class="logo-wrap">
          <div class="logo-chars">${['foxi', 'zappy', 'momo', 'grumbo', 'luma'].map((id, i) => `<div class="lc lc${i}">${avatarHTML({ type: 'char', id }, 64)}</div>`).join('')}</div>
          <div class="logo-classic">CLASSIC</div>
          <h1 class="logo" aria-label="Classic Imposter">${'IMPOSTER'.split('').map(c => `<span>${c}</span>`).join('')}</h1>
          <div class="tagline">${t('tagline')}</div>
        </div>
        <button class="profile-card" data-a="profile">
          ${avatarHTML(app.profile.avatar, 64)}
          <span><span class="pc-name">${needName ? '✏️ ' + t('yourName') : esc(app.profile.name)}</span><span class="muted d-block">${t('profile')} ›</span></span>
        </button>
        <div class="menu">
          <button class="btn big red" data-a="onlineMenu">🌐 ${t('playOnline')}</button>
          <button class="btn big blue" data-a="local">📱 ${t('playLocal')}</button>
          <div class="btn-row two">
            <button class="btn yellow" data-a="howto">❓ ${t('howTo')}</button>
            <button class="btn" data-a="openSettings">⚙️ ${t('appSettings')}</button>
          </div>
          <button class="btn easy-toggle ${app.cfg.easy ? 'on' : ''}" data-a="toggleEasy">${app.cfg.easy ? t('easyOn') : t('easyOff')}</button>
          ${isApp() ? '' : `<a class="btn small dl" href="${APK_URL}" rel="noopener">🤖 ${t('downloadApk')}</a>`}
        </div>
        <div class="footer">${WORDS.length} ${t('words')} · ${CATEGORIES.length} ${t('categories')} · ${MODES.length} ${t('modesTitle')} · ${CHARACTERS.length} 🎭</div>
      </main>`;
  }
  function screenSettings() {
    const c = app.cfg;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, label]) => `<button class="${c[key] === v ? 'on' : ''}" data-a="cfgSet" data-k="${key}" data-v="${v}">${label}</button>`).join('')}</div>`;
    const sw = (key, label) => `<div class="row"><span>${label}</span><button class="switch ${c[key] ? 'on' : ''}" data-a="cfgToggle" data-v="${key}" role="switch" aria-checked="${!!c[key]}"><span></span></button></div>`;
    return `${topbar(t('appSettings'), 'home')}
      <main class="screen">
        <section class="panel easy-panel ${c.easy ? 'on' : ''}">
          <h3>${t('secEasy')}</h3>
          <button class="btn big easy-toggle ${c.easy ? 'on' : ''}" data-a="toggleEasy">${c.easy ? t('easyOn') : t('easyOff')}</button>
          <p class="muted">${t('easyModeDesc')}</p>
        </section>
        <section class="panel">
          <h3>🌍 ${t('language')}</h3>
          <div class="seg wide">${LANGS.map(l => `<button class="${app.lang === l.id ? 'on' : ''}" data-a="lang" data-v="${l.id}">${l.flag} ${l.label}</button>`).join('')}</div>
        </section>
        <section class="panel">
          <h3>🎨 ${t('secLook')}</h3>
          <div class="row col"><span>🔠 ${t('textSize')}</span>${seg('textSize', [['normal', t('sizeNormal')], ['large', t('sizeLarge')], ['xl', t('sizeXL')]])}</div>
          <div class="row col"><span>🖌️ ${t('theme')}</span><div class="themes">${THEMES.map(th => `<button class="theme-dot th-${th} ${c.theme === th ? 'on' : ''}" data-a="cfgSet" data-k="theme" data-v="${th}"><span>${THEME_ICON[th]}</span>${t('th_' + th)}</button>`).join('')}</div></div>
          ${sw('contrast', '◐ ' + t('contrast'))}
          ${sw('animations', '✨ ' + t('animations'))}
        </section>
        <section class="panel">
          <h3>🎴 ${t('secPlay')}</h3>
          <div class="row col"><span>👆 ${t('revealMode')}</span>${seg('reveal', [['swipe', '⬆ ' + t('revealSwipe')], ['tap', '👆 ' + t('revealTap')]])}</div>
          ${sw('showHelp', '💬 ' + t('showHelp'))}
          ${sw('readAloud', t('readAloud'))}
          ${sw('showOrder', '🔢 ' + t('showOrder'))}
          ${sw('keepAwake', '🔆 ' + t('keepAwake'))}
          ${sw('confirmLeave', '🚪 ' + t('confirmLeave'))}
        </section>
        <section class="panel">
          <h3>🔊 ${t('secSound')}</h3>
          ${sw('sound', '🎵 ' + t('sound'))}
          ${sw('vibration', '📳 ' + t('vibration'))}
        </section>
        <section class="panel">
          <h3>💾 ${t('secData')}</h3>
          <button class="btn" data-a="profile">👤 ${t('profile')}</button>
          <button class="btn red mt" data-a="resetAll">🗑️ ${t('resetAll')}</button>
          <p class="muted center">IMPOSTER · ${t('version')} ${VERSION}</p>
        </section>
      </main>`;
  }
  function currentSettings() {
    if (app.wordsFrom === 'online' && app.V) return app.V.settings;
    if (app.L) return app.L.settings;
    return defaultSettings();
  }
  function screenCustomWords() {
    const s = currentSettings();
    return `${topbar(t('customWords'), 'wordsBack')}
      <main class="screen">
        <p class="tip">${t('customHint')}</p>
        <textarea id="wordsInput" data-draft="words" class="input textarea" rows="10" placeholder="${esc(t('customWordsPh'))}">${esc(draft('words', s.custom.join('\n')))}</textarea>
        <div class="muted center">${parseCustom(draft('words', s.custom.join('\n'))).length} ${t('words')}</div>
        <div class="sticky-bottom"><button class="btn big green" data-a="wordsSave">✔ ${t('save')}</button></div>
      </main>`;
  }
  function screenOnlineMenu() {
    return `${topbar(t('playOnline'), 'home')}
      <main class="screen">
        <section class="panel center">
          ${avatarHTML(app.profile.avatar, 80)}<div class="pc-name">${esc(app.profile.name)}</div>
        </section>
        <button class="btn big red" data-a="create">✨ ${t('createRoom')}</button>
        <section class="panel">
          <h3>🔑 ${t('joinRoom')}</h3>
          <input id="codeInput" data-draft="code" class="input code-input" maxlength="6" placeholder="${t('codePh')}" value="${esc(draft('code', app.params.code || ''))}" autocomplete="off" autocapitalize="characters">
          <button class="btn big blue" data-a="joinCode">🚪 ${t('join')}</button>
        </section>
      </main>`;
  }
  function screenProfile() {
    return `${topbar(t('profile'), 'home')}<main class="screen">${editorHTML(draft('name', app.edit.name), app.edit.avatar)}
      <div class="sticky-bottom"><button class="btn big green" data-a="editSave">✔ ${t('save')}</button></div></main>`;
  }
  function screenEditPlayer() {
    return `${topbar(t('playerName'), 'editCancel')}<main class="screen">${editorHTML(draft('name', app.edit.name), app.edit.avatar)}
      <div class="sticky-bottom"><button class="btn big green" data-a="editSave">✔ ${t('save')}</button></div></main>`;
  }
  function screenHowto() {
    return `${topbar(t('howTo'), 'home')}<main class="screen">
      ${t('howToText').map((s, i) => `<section class="panel howto-step" style="--d:${i * 70}ms"><div class="step-n">${i + 1}</div><p>${esc(s)}</p></section>`).join('')}
      <section class="panel"><h3>🎮 ${t('modesTitle')}</h3>
        ${MODES.map(m => `<div class="row"><span><b>${MODE_ICON[m]} ${t('mode_' + m)}</b><br><small class="muted">${esc(t('mode_' + m + '_d'))}</small></span></div>`).join('')}
        <div class="row"><span><b>${t('lastChance')}</b></span></div>
      </section>
      <section class="panel"><h3>🎭 ${CHARACTERS.length}</h3><div class="pgrid small">${CHARACTERS.map(c => playerTile({ name: c.name, avatar: { type: 'char', id: c.id } }, { size: 56 })).join('')}</div></section>
    </main>`;
  }
  function screenConnecting() {
    return `${topbar(t('connecting'), 'leave')}<main class="screen center-screen"><div class="spinner"></div><h2>${t('connecting')}</h2></main>`;
  }

  // ---------- Render ----------
  function render() {
    if (app.dragging) { app.pendingRender = true; return; }
    const active = document.activeElement;
    const keep = active && active.id && /Input$/.test(active.id) ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null;
    let html = '';
    switch (app.screen) {
      case 'home': html = screenHome(); break;
      case 'settings': html = screenSettings(); break;
      case 'onlineMenu': html = screenOnlineMenu(); break;
      case 'profile': html = screenProfile(); break;
      case 'editPlayer': html = screenEditPlayer(); break;
      case 'customWords': html = screenCustomWords(); break;
      case 'howto': html = screenHowto(); break;
      case 'connecting': html = screenConnecting(); break;
      case 'online': html = screenOnline(); break;
      case 'local': html = screenLocal(); break;
    }
    // Karte nicht neu zeichnen, wenn sich nur der Fortschritt geändert hat
    const key = cardKey();
    if (key && key === render._cardKey && document.getElementById('card') && !app.modal && !$app.querySelector('.modal-bg')) {
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const oldAct = $app.querySelector('.reveal-actions'), newAct = tmp.querySelector('.reveal-actions');
      if (oldAct && newAct) oldAct.innerHTML = newAct.innerHTML;
      updateToast(); return;
    }
    render._cardKey = key;
    const scrollY = render._screen === app.screen ? window.scrollY : 0;
    render._screen = app.screen;
    $app.innerHTML = html + toastHTML() + modalHTML();
    document.documentElement.lang = app.lang;
    window.scrollTo(0, scrollY);
    if (document.getElementById('cover')) bindCard();
    if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (e) { /* ignore */ } } }
    tickTimer();
    updateWakeLock();
  }
  function updateToast() {
    const old = $app.querySelector('.toast'); if (old) old.remove();
    if (app.toast) $app.insertAdjacentHTML('beforeend', toastHTML());
  }
  function cardKey() {
    if (app.screen === 'online' && app.V && app.V.phase === 'reveal') return 'o' + app.V.roundNo + app.lang + app.cfg.reveal + app.cardUp;
    if (app.screen === 'local' && app.L && app.L.phase === 'reveal') return 'l' + app.L.roundNo + ':' + app.L.idx + app.lang + app.cfg.reveal + app.cardUp;
    return null;
  }
  function tickTimer() {
    const el = document.getElementById('timer');
    clearTimeout(tickTimer._t);
    if (!el) return;
    const left = Math.max(0, Number(el.dataset.ends) - Date.now());
    const s = Math.ceil(left / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', s <= 10);
    if (s <= 5 && s > 0 && s !== tickTimer._last) { tickTimer._last = s; sfx('tick'); }
    if (left <= 0) {
      el.textContent = t('timeUp');
      if (app.screen === 'local' && app.L && app.L.phase === 'discuss') { sfx('stop'); buzz(200); app.L.phase = 'vote'; app.voteSel = null; render(); }
      return;
    }
    tickTimer._t = setTimeout(tickTimer, 250);
  }

  function goHome(msg) {
    app.screen = 'home'; app.voteSel = null;
    render(); if (msg) showToast(msg, 3200);
  }
  function requireName(next) {
    if (app.profile.name && app.profile.name.trim()) return next();
    app.edit = { name: '', avatar: app.profile.avatar, after: next, target: 'profile' };
    app.drafts.name = null;
    app.screen = 'profile'; render(); showToast(t('invalidName'));
  }
  function shareLink() {
    const base = (location.protocol.startsWith('http') && !isApp() && !/localhost|127\.0\.0\.1/.test(location.hostname)) ? location.origin + location.pathname : SITE_URL;
    return base + '?room=' + app.V.code;
  }
  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ } ta.remove(); return ok;
    }
  }
  function inGame() {
    return (app.screen === 'online' && app.V && app.V.phase !== 'lobby') || (app.screen === 'local' && app.L && app.L.phase !== 'setup');
  }
  function guarded(fn) { return () => (app.cfg.confirmLeave && inGame() ? confirmThen(t('leaveConfirm'), fn) : fn()); }

  // ---------- Actions ----------
  const actions = {
    home() { leaveOnline(); app.screen = 'home'; render(); },
    lang(v) { app.lang = v; store.set('lang', v); render(); },
    langCycle() { const i = LANGS.findIndex(l => l.id === app.lang); actions.lang(LANGS[(i + 1) % LANGS.length].id); },
    openSettings() { app.screen = 'settings'; render(); },
    cfgToggle(v) { app.cfg[v] = !app.cfg[v]; saveCfg(); sfx('click'); render(); },
    cfgSet(v, a, el) { app.cfg[el.dataset.k] = v; saveCfg(); sfx('click'); render(); },
    toggleEasy() {
      app.cfg.easy = !app.cfg.easy;
      Object.assign(app.cfg, app.cfg.easy ? EASY_ON : EASY_OFF);
      saveCfg(); sfx('pop'); render();
    },
    resetAll() {
      confirmThen(t('resetConfirm'), () => {
        try { Object.keys(localStorage).filter(k => k.startsWith('imp_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
        location.reload();
      });
    },
    modalYes() { const fn = app.modal && app.modal.fn; app.modal = null; render(); if (fn) fn(); },
    modalNo() { app.modal = null; render(); },
    speak(v) { speak(v); },
    toggleCard() {
      app.cardUp = !app.cardUp;
      if (app.cardUp) { sfx('reveal'); buzz(30); reveal(); }
      const cover = document.getElementById('cover'), btn = document.getElementById('toggleCard');
      if (cover) cover.classList.toggle('up', app.cardUp);
      if (btn) btn.textContent = app.cardUp ? t('hideWord') : t('showWord');
      render._cardKey = cardKey();
    },
    profile() { app.edit = { name: app.profile.name, avatar: app.profile.avatar, target: 'profile' }; app.drafts.name = null; app.screen = 'profile'; render(); },
    pickChar(v) { app.edit.avatar = { type: 'char', id: v }; sfx('click'); render(); },
    removePhoto() { app.edit.avatar = { type: 'char', id: CHARACTERS[0].id }; render(); },
    editSave() {
      const name = (draft('name', app.edit.name) || '').trim().slice(0, 16);
      if (!name) return showToast(t('invalidName'));
      app.drafts.name = null;
      if (app.edit.target === 'profile') {
        app.profile.name = name; app.profile.avatar = app.edit.avatar; store.set('profile', app.profile);
        const after = app.edit.after; app.edit = null; sfx('pop');
        if (after) return after();
        app.screen = 'home'; return render();
      }
      const L = app.L; const ex = L.players.find(p => p.id === app.edit.target);
      if (ex) { ex.name = name; ex.avatar = app.edit.avatar; } else L.players.push({ id: app.edit.target, name, avatar: app.edit.avatar, score: 0 });
      localSave(); app.edit = null; app.screen = 'local'; sfx('pop'); render();
    },
    editCancel() { app.edit = null; app.drafts.name = null; app.screen = 'local'; render(); },
    howto() { app.screen = 'howto'; render(); },
    onlineMenu() { requireName(() => { app.screen = 'onlineMenu'; render(); }); },
    create() { hostCreate(); },
    joinCode() {
      const code = draft('code', app.params.code || '');
      app.params.code = code;
      clientJoin(code);
    },
    leave() { guarded(() => { leaveOnline(); app.screen = 'onlineMenu'; render(); })(); },
    copyCode() { copyText(app.V.code).then(ok => ok && showToast(t('copied'))); },
    async share() {
      const link = shareLink();
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { try { await navigator.share({ title: 'Classic Imposter', text: `Classic Imposter – ${t('roomCode')}: ${app.V.code}`, url: link }); return; } catch (e) { /* fallthrough */ } }
      if (await copyText(link)) showToast(t('copied'));
    },
    kick(v) { send({ t: 'kick', target: v }); },
    setImp: settingAction, setTimer: settingAction, setHint: settingAction, setLast: settingAction, setMode: settingAction,
    setCat: settingAction, catsAll: settingAction, catsNone: settingAction,
    editWords() { app.wordsFrom = app.screen; app.drafts.words = null; app.screen = 'customWords'; render(); },
    wordsBack() { app.drafts.words = null; app.screen = app.wordsFrom === 'online' && app.V ? 'online' : 'local'; render(); },
    wordsSave() {
      const txt = draft('words', currentSettings().custom.join('\n'));
      settingAction(txt, 'setCustom');
      app.screen = app.wordsFrom === 'online' && app.V ? 'online' : 'local';
      app.drafts.words = null; showToast(t('saved'));
    },
    start() { if (app.screen === 'online') { app.voteSel = null; send({ t: 'start' }); } },
    toLobby() { send({ t: 'lobby' }); },
    resetScores() { send({ t: 'resetScores' }); },
    seen() { send({ t: 'seen' }); sfx('click'); },
    skipReveal() { send({ t: 'skipReveal' }); },
    skipClues() { send({ t: 'skipClues' }); },
    sendClue() {
      const txt = (draft('clue', '') || '').trim();
      if (!txt) return;
      app.drafts.clue = null; send({ t: 'clue', text: txt }); sfx('pop');
    },
    moreClues() { send({ t: 'moreClues' }); },
    stop() { send({ t: 'stop' }); },
    selVote(v) { app.voteSel = v; sfx('click'); render(); },
    castVote() { if (app.voteSel) { send({ t: 'vote', target: app.voteSel }); sfx('pop'); } },
    endVote() { send({ t: 'endVote' }); },
    guessPick(v) { send({ t: 'guess', i: Number(v) }); },
    skipGuess() { send({ t: 'skipGuess' }); },
    // lokal
    local() { localInit(); render(); },
    lAdd() { app.edit = { name: '', avatar: { type: 'char', id: CHARACTERS[app.L.players.length % CHARACTERS.length].id }, target: uid() }; app.drafts.name = null; app.screen = 'editPlayer'; render(); },
    lEdit(v) { const p = app.L.players.find(p => p.id === v); app.edit = { name: p.name, avatar: p.avatar, target: p.id }; app.drafts.name = null; app.screen = 'editPlayer'; render(); },
    lRemove(v) { app.L.players = app.L.players.filter(p => p.id !== v); localSave(); render(); },
    lStart() {
      const L = app.L; if (L.players.length < 3) return showToast(t('needPlayers'));
      localSave(); L.round = pickRound(L.players, L.settings, L.used); L.roundNo++; L.idx = 0; L.phase = 'pass'; app.voteSel = null; app.cardUp = false; sfx('pop'); render();
    },
    lPassed() { app.L.phase = app.L.phase === 'passGuess' ? 'guess' : 'reveal'; app.cardUp = false; render(); },
    lNext() {
      const L = app.L; app.cardUp = false;
      if (L.idx < L.players.length - 1) { L.idx++; L.phase = 'pass'; }
      else { L.phase = 'discuss'; L.round.localEnds = L.settings.timer ? Date.now() + L.settings.timer * 60000 : null; }
      render();
    },
    lStop() { sfx('stop'); buzz([80, 60, 80]); app.L.phase = 'vote'; app.voteSel = null; render(); },
    lSel(v) { app.voteSel = v; sfx('click'); render(); },
    lVote() { localResolve(app.voteSel); },
    lTie() { localResolve(null); },
    lGuess(v) {
      const L = app.L, r = L.round; r.guess.pick = Number(v);
      finishRound(r, L.players, r.guess.pick === r.guess.correct); L.phase = 'result';
      sfx(r.result.crewWin ? 'win' : 'lose'); render();
    },
    lSetup() { app.L.phase = 'setup'; render(); },
    lQuit() { guarded(() => { app.L.phase = 'setup'; render(); })(); }
  };
  function settingAction(v, a) {
    if (app.screen === 'online' || (app.screen === 'customWords' && app.wordsFrom === 'online')) return send({ t: 'settings', a, v });
    if (app.L) {
      applySetting(app.L.settings, a, v, app.L.players.length);
      if (app.L.settings.mode === 'write') app.L.settings.mode = 'classic';
      localSave(); sfx('click'); render();
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const a = el.dataset.a; const fn = actions[a];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el.dataset.v, a, el); }
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.draft;
    if (k) {
      app.drafts[k] = e.target.value;
      if (k === 'words') { const m = $app.querySelector('.textarea + .muted'); if (m) m.textContent = parseCustom(e.target.value).length + ' ' + t('words'); }
    }
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'photoInput') return;
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const data = await readPhoto(f); app.edit.avatar = { type: 'photo', data }; render(); } catch (err) { /* ignore */ }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'codeInput') actions.joinCode();
    if (e.target.id === 'nameInput') actions.editSave();
    if (e.target.id === 'clueInput') actions.sendClue();
  });
  window.addEventListener('beforeunload', () => leaveOnline());

  // Android-Zurück-Taste (Capacitor)
  try {
    const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp) CapApp.addListener('backButton', () => {
      if (app.modal) return actions.modalNo();
      if (app.screen === 'home') CapApp.exitApp();
      else if (app.screen === 'online' || app.screen === 'connecting') actions.leave();
      else if (app.screen === 'local' && app.L && app.L.phase !== 'setup') actions.lQuit();
      else if (app.screen === 'editPlayer') actions.editCancel();
      else if (app.screen === 'customWords') actions.wordsBack();
      else actions.home();
    });
  } catch (e) { /* nicht in der App */ }

  // Deep-Link ?room=CODE
  applyCfg();
  const qRoom = new URLSearchParams(location.search).get('room');
  if (qRoom) {
    app.params.code = qRoom.toUpperCase();
    requireName(() => { app.screen = 'onlineMenu'; render(); });
  }
  render();

  window.__imp = { app, actions };
})();
