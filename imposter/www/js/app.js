/* IMPOSTER – Party-Spiel. Online (PeerJS/WebRTC, Host-autoritativ) + lokal (ein Gerät). */
(function () {
  'use strict';

  const SITE_URL = 'https://rebyterebyte-dev.github.io/icegfx/';
  const APK_URL = 'https://github.com/rebyterebyte-dev/icegfx/releases/latest/download/imposter.apk';
  const PEER_PREFIX = 'imposter-party-v1-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

  // ---------- App state ----------
  const app = {
    lang: store.get('lang', (navigator.language || 'de').slice(0, 2) === 'sr' ? 'sr' : (navigator.language || 'de').startsWith('en') ? 'en' : 'de'),
    profile: store.get('profile', null),
    screen: 'home',
    params: {},
    toast: null,
    net: null,     // online connection info
    G: null,       // host: authoritative game state
    V: null,       // view received (or computed for host)
    L: null,       // local game
    dragging: false,
    pendingRender: false
  };
  if (!app.profile) {
    app.profile = { id: uid(), name: '', avatar: { type: 'char', id: CHARACTERS[rand(CHARACTERS.length)].id } };
    store.set('profile', app.profile);
  }
  if (!I18N[app.lang]) app.lang = 'de';
  const t = k => (I18N[app.lang][k] != null ? I18N[app.lang][k] : (I18N.en[k] != null ? I18N.en[k] : k));
  const wordText = idx => WORDS[idx] ? WORDS[idx][app.lang] : '?';
  const catName = id => { const c = CATEGORIES.find(c => c.id === id); return c ? c.icon + ' ' + c.name[app.lang] : ''; };
  const defaultSettings = () => ({ imposters: 1, cats: CATEGORIES.map(c => c.id), timer: 0, hint: true });

  // ---------- Sound ----------
  let actx = null;
  function sfx(kind) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = {
        click: [[660, 0.05]], pop: [[520, 0.06], [880, 0.07]], reveal: [[440, 0.08], [660, 0.08], [990, 0.12]],
        stop: [[300, 0.12], [200, 0.2]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.25]], lose: [[400, 0.15], [300, 0.15], [200, 0.3]]
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
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  // ---------- UI building blocks ----------
  function avatarHTML(av, size = 64, extraCls = '') {
    if (av && av.type === 'photo' && av.data) {
      return `<div class="avatar photo ${extraCls}" style="width:${size}px;height:${size}px"><img src="${esc(av.data)}" alt=""></div>`;
    }
    const id = (av && av.id) || 'blobbo';
    const c = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
    return `<div class="avatar ${extraCls}" style="width:${size}px;height:${size}px;--av:${c.color}">${getCharSVG(c.id)}</div>`;
  }
  function topbar(title, backAction) {
    return `<header class="topbar">
      ${backAction ? `<button class="icon-btn" data-a="${backAction}" aria-label="${t('back')}">←</button>` : '<span class="icon-btn ghost"></span>'}
      <h2>${title}</h2>
      <button class="icon-btn" data-a="langCycle" aria-label="${t('language')}">${LANGS.find(l => l.id === app.lang).flag}</button>
    </header>`;
  }
  function toastHTML() { return app.toast ? `<div class="toast">${esc(app.toast)}</div>` : ''; }
  function showToast(msg, ms = 2200) {
    app.toast = msg; render();
    clearTimeout(showToast._t); showToast._t = setTimeout(() => { app.toast = null; render(); }, ms);
  }

  function settingsHTML(s, nPlayers, editable) {
    const maxImp = Math.max(1, Math.min(5, Math.floor((Math.max(nPlayers, 3) - 1) / 2)));
    const dis = editable ? '' : 'disabled';
    const cats = CATEGORIES.map(c => `<button class="chip ${s.cats.includes(c.id) ? 'on' : ''}" data-a="setCat" data-v="${c.id}" ${dis}>${c.icon} ${esc(c.name[app.lang])} <small>${c.count}</small></button>`).join('');
    const total = WORDS.filter(w => s.cats.includes(w.cat)).length;
    return `<section class="panel">
      <h3>⚙️ ${t('settings')}</h3>
      <div class="row"><span>🕵️ ${t('imposters')}</span>
        <div class="stepper">
          <button class="step" data-a="setImp" data-v="-1" ${dis}>−</button><b>${s.imposters}</b><button class="step" data-a="setImp" data-v="1" ${dis || (s.imposters >= maxImp ? 'disabled' : '')}>+</button>
        </div></div>
      <div class="row"><span>⏱️ ${t('timer')}</span>
        <div class="seg">${[0, 1, 2, 3, 5].map(m => `<button class="${s.timer === m ? 'on' : ''}" data-a="setTimer" data-v="${m}" ${dis}>${m === 0 ? '∞' : m + ' ' + t('min')}</button>`).join('')}</div></div>
      <div class="row"><span>💡 ${t('hint')}</span>
        <div class="seg"><button class="${s.hint ? 'on' : ''}" data-a="setHint" data-v="1" ${dis}>${t('on')}</button><button class="${!s.hint ? 'on' : ''}" data-a="setHint" data-v="0" ${dis}>${t('off')}</button></div></div>
      <div class="row col"><span>📚 ${t('categories')} <small class="muted">(${total})</small>
        ${editable ? `<span class="mini-links"><a data-a="catsAll">${t('all')}</a> · <a data-a="catsNone">${t('none')}</a></span>` : ''}</span>
        <div class="chips">${cats}</div></div>
    </section>`;
  }
  function applySetting(s, a, v, nPlayers) {
    const maxImp = Math.max(1, Math.min(5, Math.floor((Math.max(nPlayers, 3) - 1) / 2)));
    if (a === 'setImp') s.imposters = Math.max(1, Math.min(maxImp, s.imposters + Number(v)));
    if (a === 'setTimer') s.timer = Number(v);
    if (a === 'setHint') s.hint = v === '1';
    if (a === 'setCat') {
      if (s.cats.includes(v)) { if (s.cats.length > 1) s.cats = s.cats.filter(c => c !== v); }
      else s.cats = s.cats.concat(v);
    }
    if (a === 'catsAll') s.cats = CATEGORIES.map(c => c.id);
    if (a === 'catsNone') s.cats = [CATEGORIES[0].id];
  }

  // Reveal card (hold or swipe up)
  function cardHTML(inner, label) {
    return `<div class="card-wrap" id="card">
      <div class="card-under">${inner}</div>
      <div class="card-cover" id="cover">
        <div class="cover-pattern"></div>
        <div class="cover-content">
          <div class="cover-logo">?</div>
          <div class="cover-label">${label || t('yourCard')}</div>
          <div class="cover-hint"><span class="arrow">⬆</span> ${t('holdOrSwipe')}</div>
        </div>
      </div>
    </div>`;
  }
  function roleInner(isImp, wordIdx, catId, showCat) {
    if (isImp) {
      return `<div class="role imp">
        <div class="role-small">${t('youAre')}</div>
        <div class="role-big">${t('imposter')}</div>
        ${showCat && catId ? `<div class="role-cat">${t('category')}: ${esc(catName(catId))}</div>` : ''}
        <div class="role-tip">${t('imposterTip')}</div></div>`;
    }
    return `<div class="role crew">
      <div class="role-small">${t('yourWord')}</div>
      <div class="role-big word">${esc(wordText(wordIdx))}</div>
      <div class="role-cat">${esc(catName(catId))}</div>
      <div class="role-tip">${t('crewTip')}</div></div>`;
  }
  function bindCard(onReveal) {
    const cover = document.getElementById('cover');
    if (!cover) return;
    let startY = 0, dy = 0, holdT = null, active = false, revealedOnce = false;
    const h = () => cover.offsetHeight || 400;
    const set = (y, anim) => { cover.style.transition = anim ? 'transform .35s cubic-bezier(.2,1.4,.4,1)' : 'none'; cover.style.transform = `translateY(${y}px) rotate(${y / h() * 4}deg)`; };
    const reveal = () => { if (!revealedOnce) { revealedOnce = true; sfx('reveal'); buzz(30); onReveal && onReveal(); } };
    cover.addEventListener('pointerdown', e => {
      active = true; app.dragging = true; startY = e.clientY; dy = 0;
      try { cover.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      holdT = setTimeout(() => { if (active && Math.abs(dy) < 10) { set(-h() * 0.78, true); reveal(); } }, 280);
    });
    cover.addEventListener('pointermove', e => {
      if (!active) return;
      dy = Math.min(0, e.clientY - startY);
      if (Math.abs(dy) > 10) { clearTimeout(holdT); set(Math.max(dy, -h() * 0.9), false); if (-dy > h() * 0.4) reveal(); }
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
      <label class="lbl">${t('yourName')}</label>
      <input id="nameInput" class="input" maxlength="16" placeholder="${t('namePh')}" value="${esc(name)}" autocomplete="off">
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
  // the editor works on app.edit = {name, avatar, onSave}
  function bindEditor() {
    const inp = document.getElementById('nameInput');
    if (inp) inp.addEventListener('input', () => { app.edit.name = inp.value; });
    const ph = document.getElementById('photoInput');
    if (ph) ph.addEventListener('change', async () => {
      const f = ph.files && ph.files[0]; if (!f) return;
      try { const data = await readPhoto(f); app.edit.avatar = { type: 'photo', data }; render(); } catch (e) { /* ignore */ }
    });
  }

  // ---------- Game logic (shared) ----------
  function pickRound(players, settings, used) {
    let pool = [];
    WORDS.forEach((w, i) => { if (settings.cats.includes(w.cat) && !used.includes(i)) pool.push(i); });
    if (!pool.length) { used.length = 0; WORDS.forEach((w, i) => { if (settings.cats.includes(w.cat)) pool.push(i); }); }
    const wordIdx = pool[rand(pool.length)];
    used.push(wordIdx);
    const ids = players.map(p => p.id);
    const maxImp = Math.max(1, Math.floor((ids.length - 1) / 2));
    const n = Math.min(settings.imposters, maxImp);
    const imposters = shuffle(ids).slice(0, n);
    const starter = ids[rand(ids.length)];
    return { wordIdx, cat: WORDS[wordIdx].cat, imposters, starter, participants: ids, seen: {}, votes: {}, stoppedBy: null, endsAt: null, result: null };
  }
  function resolveVotes(round, players, votedOutOverride) {
    let votedOut = null; const tally = {};
    if (votedOutOverride !== undefined) votedOut = votedOutOverride;
    else {
      Object.values(round.votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
      const max = Math.max(0, ...Object.values(tally));
      const top = Object.keys(tally).filter(id => tally[id] === max);
      votedOut = max > 0 && top.length === 1 ? top[0] : null;
    }
    const caught = !!votedOut && round.imposters.includes(votedOut);
    players.forEach(p => {
      if (!round.participants.includes(p.id)) return;
      const imp = round.imposters.includes(p.id);
      if (caught && !imp) p.score = (p.score || 0) + 1;
      if (!caught && imp) p.score = (p.score || 0) + 2;
    });
    return { votedOut, caught, tally };
  }

  // ---------- ONLINE: Host ----------
  function peerOptions() {
    const q = new URLSearchParams(location.search);
    const ps = q.get('peer'); // for testing: host:port
    const o = { debug: 0, config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }
    ] } };
    if (ps) { const [host, port] = ps.split(':'); Object.assign(o, { host, port: Number(port), path: '/', secure: false }); }
    return o;
  }

  function hostCreate(attempt = 0) {
    leaveOnline(true);
    const code = makeCode();
    app.screen = 'connecting'; render();
    const peer = new Peer(PEER_PREFIX + code, peerOptions());
    app.net = { peer, isHost: true, code, conns: new Map() };
    peer.on('open', () => {
      const me = { id: app.profile.id, name: app.profile.name, avatar: app.profile.avatar, score: 0, online: true };
      app.G = { code, hostId: me.id, phase: 'lobby', roundNo: 0, players: [me], settings: store.get('settings', defaultSettings()), used: [], round: null };
      sanitizeSettings(app.G.settings);
      app.screen = 'online'; hostBroadcast();
    });
    peer.on('connection', conn => {
      conn.on('data', msg => hostHandle(conn, msg));
      conn.on('close', () => hostDrop(conn));
      conn.on('error', () => hostDrop(conn));
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && attempt < 3) return hostCreate(attempt + 1);
      netError(err);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
  }
  function sanitizeSettings(s) {
    const ids = CATEGORIES.map(c => c.id);
    s.cats = (s.cats || []).filter(c => ids.includes(c)); if (!s.cats.length) s.cats = ids;
    s.imposters = Math.max(1, s.imposters | 0 || 1); if (![0, 1, 2, 3, 5].includes(s.timer)) s.timer = 0;
    s.hint = s.hint !== false;
  }
  function hostHandle(conn, msg) {
    const G = app.G; if (!G || !msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const pl = msg.player || {};
      const id = String(pl.id || '').slice(0, 40); if (!id) return;
      let p = G.players.find(x => x.id === id);
      const av = sanitizeAvatar(pl.avatar);
      const name = String(pl.name || '???').slice(0, 16);
      if (p) { p.name = name; p.avatar = av; p.online = true; }
      else { if (G.players.length >= 20) { conn.send({ t: 'error', code: 'full' }); return; } p = { id, name, avatar: av, score: 0, online: true }; G.players.push(p); }
      // close an old connection of the same player
      for (const [c, pid] of app.net.conns) if (pid === id && c !== conn) { app.net.conns.delete(c); try { c.close(); } catch (e) { /* ignore */ } }
      app.net.conns.set(conn, id);
      sfx('pop'); hostBroadcast(); return;
    }
    const pid = app.net.conns.get(conn); if (!pid) return;
    hostAction(pid, msg);
  }
  function sanitizeAvatar(av) {
    if (av && av.type === 'photo' && typeof av.data === 'string' && av.data.startsWith('data:image/') && av.data.length < 60000) return { type: 'photo', data: av.data };
    const id = av && CHARACTERS.find(c => c.id === av.id) ? av.id : CHARACTERS[0].id;
    return { type: 'char', id };
  }
  function hostDrop(conn) {
    const pid = app.net && app.net.conns.get(conn);
    if (!pid) return;
    app.net.conns.delete(conn);
    const G = app.G; if (!G) return;
    const p = G.players.find(x => x.id === pid);
    if (G.phase === 'lobby') G.players = G.players.filter(x => x.id !== pid);
    else if (p) p.online = false;
    hostCheckProgress(); hostBroadcast();
  }
  // actions from any player (including host itself)
  function hostAction(pid, msg) {
    const G = app.G; const r = G.round; const isHost = pid === G.hostId;
    switch (msg.t) {
      case 'seen': if (G.phase === 'reveal' && r.participants.includes(pid)) r.seen[pid] = true; break;
      case 'stop': if (G.phase === 'discuss' && r.participants.includes(pid)) { G.phase = 'vote'; r.stoppedBy = pid; } break;
      case 'vote':
        if (G.phase === 'vote' && r.participants.includes(pid) && r.participants.includes(msg.target) && msg.target !== pid) r.votes[pid] = msg.target;
        break;
      case 'leave': {
        for (const [c, id] of app.net.conns) if (id === pid) { app.net.conns.delete(c); setTimeout(() => { try { c.close(); } catch (e) { /* ignore */ } }, 300); }
        if (G.phase === 'lobby') G.players = G.players.filter(x => x.id !== pid);
        else { const p = G.players.find(x => x.id === pid); if (p) p.online = false; }
        break;
      }
      // host only
      case 'settings': if (isHost && G.phase === 'lobby') { applySetting(G.settings, msg.a, msg.v, G.players.length); store.set('settings', G.settings); } break;
      case 'start':
        if (isHost && (G.phase === 'lobby' || G.phase === 'result')) {
          const pl = G.players.filter(p => p.online);
          if (pl.length < 3) return showToast(t('needPlayers'));
          G.players = G.players.filter(p => p.online);
          G.round = pickRound(G.players, G.settings, G.used); G.roundNo++; G.phase = 'reveal';
        }
        break;
      case 'lobby': if (isHost) { G.phase = 'lobby'; G.round = null; G.players = G.players.filter(p => p.online); } break;
      case 'forceVote': if (isHost && G.phase === 'discuss') { G.phase = 'vote'; r.stoppedBy = pid; } break;
      case 'endVote': if (isHost && G.phase === 'vote') hostFinishVote(); break;
      case 'skipReveal': if (isHost && G.phase === 'reveal') hostStartDiscuss(); break;
      case 'kick':
        if (isHost && msg.target !== G.hostId) {
          for (const [c, id] of app.net.conns) if (id === msg.target) { try { c.send({ t: 'kicked' }); } catch (e) { /* ignore */ } app.net.conns.delete(c); setTimeout(() => { try { c.close(); } catch (e) { /* ignore */ } }, 300); }
          G.players = G.players.filter(p => p.id !== msg.target);
        }
        break;
    }
    hostCheckProgress(); hostBroadcast();
  }
  function onlineIds() { return app.G.round.participants.filter(id => { const p = app.G.players.find(x => x.id === id); return p && p.online; }); }
  function hostStartDiscuss() {
    const G = app.G; G.phase = 'discuss';
    G.round.endsAt = G.settings.timer ? Date.now() + G.settings.timer * 60000 : null;
    clearTimeout(app.net.timer);
    if (G.round.endsAt) app.net.timer = setTimeout(() => { if (G.phase === 'discuss') { G.phase = 'vote'; G.round.stoppedBy = '__time'; hostBroadcast(); } }, G.settings.timer * 60000);
  }
  function hostFinishVote() {
    const G = app.G; clearTimeout(app.net.timer);
    G.round.result = resolveVotes(G.round, G.players); G.phase = 'result';
  }
  function hostCheckProgress() {
    const G = app.G; if (!G || !G.round) return;
    const ids = onlineIds();
    if (G.phase === 'reveal' && ids.length && ids.every(id => G.round.seen[id])) hostStartDiscuss();
    if (G.phase === 'vote' && ids.length && ids.every(id => G.round.votes[id])) hostFinishVote();
  }
  function viewFor(pid) {
    const G = app.G, r = G.round;
    const v = { code: G.code, hostId: G.hostId, me: pid, phase: G.phase, roundNo: G.roundNo, settings: G.settings,
      players: G.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score || 0, online: p.online })) };
    if (r) {
      const part = r.participants.includes(pid), imp = r.imposters.includes(pid), done = G.phase === 'result';
      v.round = { participants: r.participants, starter: r.starter, seen: Object.keys(r.seen), voted: Object.keys(r.votes), stoppedBy: r.stoppedBy,
        remaining: r.endsAt ? Math.max(0, r.endsAt - Date.now()) : null, part, imp: part && imp,
        wordIdx: (part && !imp) || done ? r.wordIdx : null,
        cat: (part && (!imp || G.settings.hint)) || done ? r.cat : null,
        myVote: r.votes[pid] || null, nImp: r.imposters.length };
      if (done) v.round.result = Object.assign({}, r.result, { imposters: r.imposters, votes: r.votes });
    }
    return v;
  }
  function hostBroadcast() {
    if (!app.net || !app.net.isHost || !app.G) return;
    for (const [conn, pid] of app.net.conns) { try { if (conn.open) conn.send({ t: 'state', v: viewFor(pid) }); } catch (e) { /* ignore */ } }
    receiveView(viewFor(app.G.hostId));
  }

  // ---------- ONLINE: Client ----------
  function clientJoin(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return showToast(t('roomNotFound'));
    leaveOnline(true);
    app.screen = 'connecting'; render();
    const peer = new Peer(peerOptions());
    app.net = { peer, isHost: false, code, conn: null };
    const failT = setTimeout(() => { if (app.net && app.net.peer === peer && !app.V) netError({ type: 'timeout' }); }, 15000);
    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      app.net.conn = conn;
      conn.on('open', () => { clearTimeout(failT); conn.send({ t: 'hello', player: { id: app.profile.id, name: app.profile.name, avatar: app.profile.avatar } }); });
      conn.on('data', msg => {
        if (!msg) return;
        if (msg.t === 'state') receiveView(msg.v);
        if (msg.t === 'error') { leaveOnline(true); goHome(t('roomFull')); }
        if (msg.t === 'kicked') { leaveOnline(true); goHome(t('kicked')); }
      });
      conn.on('close', () => { if (app.net && app.net.conn === conn) { leaveOnline(true); goHome(t('hostLeft')); } });
    });
    peer.on('error', err => { clearTimeout(failT); netError(err); });
  }
  function netError(err) {
    const type = err && err.type;
    const wasClient = app.net && !app.net.isHost;
    if (wasClient && app.V && type !== 'peer-unavailable') return; // transient errors while playing
    leaveOnline(true);
    goHome(type === 'peer-unavailable' ? t('roomNotFound') : t('connError'));
  }
  function send(msg) {
    if (!app.net) return;
    if (app.net.isHost) hostAction(app.G.hostId, msg);
    else if (app.net.conn && app.net.conn.open) app.net.conn.send(msg);
  }
  function leaveOnline(silent) {
    const n = app.net; app.net = null; app.G = null; app.V = null;
    if (!n) return;
    clearTimeout(n.timer);
    try { if (!n.isHost && n.conn && n.conn.open && !silent) n.conn.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    setTimeout(() => { try { n.peer.destroy(); } catch (e) { /* ignore */ } }, silent ? 0 : 250);
  }
  let lastPhaseKey = '';
  function receiveView(v) {
    const key = v.phase + ':' + v.roundNo;
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      if (v.phase === 'vote') { sfx('stop'); buzz([80, 60, 80]); }
      if (v.phase === 'result' && v.round && v.round.result) sfx(v.round.result.caught === (!v.round.imp) ? 'win' : 'lose');
      if (v.phase === 'reveal') sfx('pop');
    }
    if (v.round && v.round.remaining != null) v.round.localEnds = Date.now() + v.round.remaining;
    app.V = v;
    if (app.screen === 'connecting') app.screen = 'online';
    render();
  }

  // ---------- Online screens ----------
  function playerName(v, id) { const p = v.players.find(p => p.id === id); return p ? p.name : '?'; }
  function playerTile(p, opts = {}) {
    const cls = ['ptile', opts.cls || '', p.online === false ? 'off' : ''].join(' ');
    return `<div class="${cls}" ${opts.action ? `data-a="${opts.action}" data-v="${p.id}"` : ''}>
      ${avatarHTML(p.avatar, opts.size || 58)}
      <div class="pname">${esc(p.name)}${opts.badge || ''}</div>
      ${opts.sub ? `<div class="psub">${opts.sub}</div>` : ''}
    </div>`;
  }

  function screenOnline() {
    const v = app.V;
    if (!v) return screenConnecting();
    const isHost = v.me === v.hostId;
    const r = v.round;
    if (v.phase === 'lobby') {
      const players = v.players.map(p => playerTile(p, {
        badge: (p.id === v.hostId ? ' 👑' : '') + (p.id === v.me ? ` <small>(${t('you')})</small>` : ''),
        sub: isHost && p.id !== v.me ? `<button class="tiny" data-a="kick" data-v="${p.id}">✕</button>` : ''
      })).join('');
      return `${topbar(t('lobby'), 'leave')}
        <main class="screen">
          <section class="panel code-panel">
            <div class="muted">${t('shareCode')}</div>
            <div class="room-code" data-a="copyCode">${esc(v.code)}</div>
            <div class="btn-row"><button class="btn small blue" data-a="share">${t('copyLink')}</button></div>
          </section>
          <section class="panel">
            <h3>👥 ${t('players')} <span class="badge">${v.players.length}</span></h3>
            <div class="pgrid">${players}</div>
          </section>
          ${settingsHTML(v.settings, v.players.length, isHost)}
          <div class="sticky-bottom">
            ${isHost ? `<button class="btn big red" data-a="start" ${v.players.length < 3 ? 'disabled' : ''}>▶ ${t('start')}</button>
              ${v.players.length < 3 ? `<div class="muted center">${t('needPlayers')}</div>` : ''}`
              : `<div class="waiting"><span class="dots"></span> ${t('waitHost')}</div>`}
          </div>
        </main>`;
    }
    if (!r || !r.part) {
      return `${topbar(t('round') + ' ' + v.roundNo, 'leave')}<main class="screen center-screen">
        <div class="big-emoji bob">⏳</div><h2>${t('roomFull')}</h2></main>`;
    }
    if (v.phase === 'reveal') {
      const iSeen = r.seen.includes(v.me);
      return `${topbar(t('round') + ' ' + v.roundNo, 'leave')}
        <main class="screen reveal-screen">
          ${cardHTML(roleInner(r.imp, r.wordIdx, r.cat, true), esc(playerName(v, v.me)))}
          <div class="reveal-actions">
            <button class="btn big green" data-a="seen" id="seenBtn" ${iSeen ? 'disabled' : (app.revealed === v.roundNo ? '' : 'disabled')}>${iSeen ? t('waitingOthers') : t('seenIt')}</button>
            <div class="progress-dots">${r.participants.map(id => `<span class="${r.seen.includes(id) ? 'on' : ''}" title="${esc(playerName(v, id))}"></span>`).join('')}</div>
            <div class="muted center">${r.seen.length}/${r.participants.length} ${t('seen')}</div>
            ${isHost ? `<button class="link-btn" data-a="skipReveal">⏭ ${t('next')}</button>` : ''}
          </div>
        </main>`;
    }
    if (v.phase === 'discuss') {
      const starter = v.players.find(p => p.id === r.starter);
      return `${topbar(t('discuss'), 'leave')}
        <main class="screen discuss-screen">
          <section class="panel starter">
            ${starter ? avatarHTML(starter.avatar, 84, 'bob') : ''}
            <div><div class="starter-name">${esc(starter ? starter.name : '')}</div><div class="starter-sub">${t('starts')}</div></div>
          </section>
          ${r.localEnds ? `<div class="timer" id="timer" data-ends="${r.localEnds}">--:--</div>` : ''}
          <p class="tip">${t('discussTip')}</p>
          <div class="pgrid">${r.participants.map(id => v.players.find(p => p.id === id)).filter(Boolean).map(p => playerTile(p, { size: 52 })).join('')}</div>
          <details class="peek"><summary>👁 ${t('yourCard')}</summary>${roleInner(r.imp, r.wordIdx, r.cat, true)}</details>
          <div class="sticky-bottom">
            <button class="btn stop-btn" data-a="stop">✋ ${t('stop')}</button>
            <div class="muted center">${t('stopTip')}</div>
          </div>
        </main>`;
    }
    if (v.phase === 'vote') {
      const voted = !!r.myVote;
      const sel = app.voteSel;
      const who = r.stoppedBy === '__time' ? `⏰ ${t('timeUp')}` : `✋ <b>${esc(playerName(v, r.stoppedBy))}</b> ${t('stoppedBy')}`;
      const tiles = r.participants.map(id => v.players.find(p => p.id === id)).filter(Boolean).map(p => playerTile(p, {
        size: 64, action: !voted && p.id !== v.me ? 'selVote' : '', cls: (voted ? r.myVote === p.id : sel === p.id) ? 'selected' : (p.id === v.me ? 'self' : ''),
        sub: r.voted.includes(p.id) ? '✅' : '…'
      })).join('');
      return `${topbar(t('vote'), 'leave')}
        <main class="screen">
          <div class="banner red">${who}</div>
          <h2 class="center">${t('whoIsImposter')}</h2>
          <div class="pgrid vote-grid">${tiles}</div>
          <div class="sticky-bottom">
            ${voted ? `<div class="waiting">🗳️ ${t('youVoted')} ${r.voted.length}/${r.participants.length}</div>`
              : `<button class="btn big red" data-a="castVote" ${sel ? '' : 'disabled'}>🗳️ ${t('voteFor')}${sel ? ': ' + esc(playerName(v, sel)) : ''}</button>`}
            ${isHost ? `<button class="link-btn" data-a="endVote">⏭ ${t('result')} (${r.voted.length}/${r.participants.length})</button>` : ''}
          </div>
        </main>`;
    }
    if (v.phase === 'result') {
      return `${topbar(t('result'), 'leave')}<main class="screen">${resultHTML(v.players, r.result, r.wordIdx, r.cat, r.result.tally)}
        <div class="sticky-bottom">${isHost ? `<button class="btn big red" data-a="start">🔁 ${t('nextRound')}</button><button class="btn blue" data-a="toLobby">🏠 ${t('toLobby')}</button>`
          : `<div class="waiting"><span class="dots"></span> ${t('waitHost')}</div>`}</div></main>`;
    }
    return '';
  }

  function resultHTML(players, res, wordIdx, cat, tally) {
    const out = res.votedOut ? players.find(p => p.id === res.votedOut) : null;
    const imps = players.filter(p => res.imposters.includes(p.id));
    const head = out
      ? `<div class="reveal-out ${res.caught ? 'good' : 'bad'}">
          ${avatarHTML(out.avatar, 110, 'pop-in')}
          <div class="out-name">${esc(out.name)}</div>
          <div class="out-text">${res.caught ? t('wasImposter') : t('wasNotImposter')}</div></div>`
      : `<div class="reveal-out bad"><div class="big-emoji">🤷</div><div class="out-text">${t('tie')}</div></div>`;
    const sorted = players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    return `<div class="winner-banner ${res.caught ? 'crew' : 'imp'}">${res.caught ? '🎉 ' + t('crewWins') : '😈 ' + t('impostersWin')}</div>
      ${head}
      <section class="panel result-info">
        <div class="row"><span>${t('theWord')}:</span><b class="word-pill">${esc(wordText(wordIdx))}</b></div>
        <div class="row"><span>${t('category')}:</span><span>${esc(catName(cat))}</span></div>
        <div class="row col"><span>🕵️ ${t('theImposters')}:</span><div class="pgrid small">${imps.map(p => playerTile(p, { size: 48, cls: 'imp' })).join('')}</div></div>
      </section>
      <section class="panel">
        <h3>🏆 ${t('score')}</h3>
        <ol class="scores">${sorted.map(p => `<li>${avatarHTML(p.avatar, 36)}<span>${esc(p.name)}${res.imposters.includes(p.id) ? ' 🕵️' : ''}</span>
          ${tally && tally[p.id] ? `<small class="muted">🗳️${tally[p.id]}</small>` : ''}<b>${p.score || 0}</b></li>`).join('')}</ol>
      </section>`;
  }

  // ---------- Local mode ----------
  function localInit() {
    const saved = store.get('localPlayers', null);
    app.L = { phase: 'setup', players: saved || [
      { id: uid(), name: app.profile.name || 'Spieler 1', avatar: app.profile.avatar, score: 0 }
    ], settings: store.get('localSettings', defaultSettings()), used: [], idx: 0, round: null, roundNo: 0 };
    sanitizeSettings(app.L.settings);
    app.L.players.forEach(p => { p.score = 0; });
    app.screen = 'local';
  }
  function localSave() { store.set('localPlayers', app.L.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }))); store.set('localSettings', app.L.settings); }
  function screenLocal() {
    const L = app.L;
    if (L.phase === 'setup') {
      return `${topbar(t('localSetup'), 'home')}
        <main class="screen">
          <section class="panel">
            <h3>👥 ${t('players')} <span class="badge">${L.players.length}</span></h3>
            <div class="pgrid">${L.players.map(p => playerTile(p, { action: 'lEdit', sub: `<button class="tiny" data-a="lRemove" data-v="${p.id}">✕</button>` })).join('')}
              <button class="ptile add" data-a="lAdd"><div class="add-plus">＋</div><div class="pname">${t('addPlayer')}</div></button></div>
          </section>
          ${settingsHTML(L.settings, L.players.length, true)}
          <div class="sticky-bottom"><button class="btn big red" data-a="lStart" ${L.players.length < 3 ? 'disabled' : ''}>▶ ${t('start')}</button>
            ${L.players.length < 3 ? `<div class="muted center">${t('needPlayers')}</div>` : ''}</div>
        </main>`;
    }
    const r = L.round;
    if (L.phase === 'pass') {
      const p = L.players[L.idx];
      return `${topbar(t('round') + ' ' + L.roundNo, 'lQuit')}
        <main class="screen center-screen pass-screen" data-a="lPassed">
          <div class="muted">${L.idx + 1} / ${L.players.length}</div>
          <h2>${t('passTo')}</h2>
          ${avatarHTML(p.avatar, 140, 'bob')}
          <div class="pass-name">${esc(p.name)}</div>
          <button class="btn big blue" data-a="lPassed">👆 ${t('ready')}</button>
          <div class="muted">${t('tapWhenReady')}</div>
        </main>`;
    }
    if (L.phase === 'reveal') {
      const p = L.players[L.idx]; const imp = r.imposters.includes(p.id);
      return `${topbar(esc(p.name), 'lQuit')}
        <main class="screen reveal-screen">
          ${cardHTML(roleInner(imp, r.wordIdx, r.cat, L.settings.hint), esc(p.name))}
          <div class="reveal-actions"><button class="btn big green" data-a="lNext" id="seenBtn" ${app.revealed === 'L' + L.idx ? '' : 'disabled'}>${t('next')} →</button></div>
        </main>`;
    }
    if (L.phase === 'discuss') {
      const st = L.players.find(p => p.id === r.starter);
      return `${topbar(t('discuss'), 'lQuit')}
        <main class="screen discuss-screen">
          <section class="panel starter">${avatarHTML(st.avatar, 84, 'bob')}<div><div class="starter-name">${esc(st.name)}</div><div class="starter-sub">${t('starts')}</div></div></section>
          ${r.localEnds ? `<div class="timer" id="timer" data-ends="${r.localEnds}">--:--</div>` : ''}
          <p class="tip">${t('discussTip')}</p>
          <div class="pgrid">${L.players.map(p => playerTile(p, { size: 52 })).join('')}</div>
          <div class="sticky-bottom"><button class="btn stop-btn" data-a="lStop">✋ ${t('stop')}</button><div class="muted center">${t('stopTip')}</div></div>
        </main>`;
    }
    if (L.phase === 'vote') {
      return `${topbar(t('vote'), 'lQuit')}
        <main class="screen">
          <h2 class="center">${t('whoVotedOut')}</h2>
          <div class="pgrid vote-grid">${L.players.map(p => playerTile(p, { size: 64, action: 'lSel', cls: app.voteSel === p.id ? 'selected' : '' })).join('')}</div>
          <div class="sticky-bottom">
            <button class="btn big red" data-a="lVote" ${app.voteSel ? '' : 'disabled'}>🗳️ ${t('voteFor')}${app.voteSel ? ': ' + esc(L.players.find(p => p.id === app.voteSel).name) : ''}</button>
            <button class="link-btn" data-a="lTie">🤷 ${t('noOne')}</button>
          </div>
        </main>`;
    }
    if (L.phase === 'result') {
      return `${topbar(t('result'), 'lQuit')}<main class="screen">${resultHTML(L.players, Object.assign({ imposters: r.imposters }, r.result), r.wordIdx, r.cat, null)}
        <div class="sticky-bottom"><button class="btn big red" data-a="lStart">🔁 ${t('nextRound')}</button><button class="btn blue" data-a="lSetup">⚙️ ${t('settings')}</button></div></main>`;
    }
    return '';
  }
  function localStartDiscuss() {
    const L = app.L; L.phase = 'discuss';
    L.round.localEnds = L.settings.timer ? Date.now() + L.settings.timer * 60000 : null;
  }

  // ---------- Other screens ----------
  function screenHome() {
    const needName = !app.profile.name;
    return `<header class="topbar home-top"><span class="icon-btn ghost"></span><span></span>
        <div class="lang-pills">${LANGS.map(l => `<button class="lang-pill ${l.id === app.lang ? 'on' : ''}" data-a="lang" data-v="${l.id}">${l.flag}</button>`).join('')}</div></header>
      <main class="screen home">
        <div class="logo-wrap">
          <div class="logo-chars">${['foxi', 'zappy', 'momo', 'grumbo', 'luma'].map((id, i) => `<div class="lc lc${i}">${avatarHTML({ type: 'char', id }, 64)}</div>`).join('')}</div>
          <h1 class="logo"><span>I</span><span>M</span><span>P</span><span>O</span><span>S</span><span>T</span><span>E</span><span>R</span></h1>
          <div class="tagline">${t('tagline')}</div>
        </div>
        <button class="profile-card" data-a="profile">
          ${avatarHTML(app.profile.avatar, 64)}
          <div><div class="pc-name">${needName ? '✏️ ' + t('yourName') : esc(app.profile.name)}</div><div class="muted">${t('profile')} ›</div></div>
        </button>
        <div class="menu">
          <button class="btn big red" data-a="onlineMenu">🌐 ${t('playOnline')}</button>
          <button class="btn big blue" data-a="local">📱 ${t('playLocal')}</button>
          <button class="btn yellow" data-a="howto">❓ ${t('howTo')}</button>
          ${isApp() ? '' : `<a class="btn small dl" href="${APK_URL}" rel="noopener">🤖 ${t('downloadApk')}</a>`}
        </div>
        <div class="footer muted">${WORDS.length} ${t('words')} · ${CATEGORIES.length} ${t('categories')} · ${CHARACTERS.length} 🎭</div>
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
          <input id="codeInput" class="input code-input" maxlength="6" placeholder="${t('codePh')}" value="${esc(app.params.code || '')}" autocomplete="off" autocapitalize="characters">
          <button class="btn big blue" data-a="joinCode">🚪 ${t('join')}</button>
        </section>
      </main>`;
  }
  function screenProfile() {
    return `${topbar(t('profile'), 'home')}<main class="screen">${editorHTML(app.edit.name, app.edit.avatar)}
      <div class="sticky-bottom"><button class="btn big green" data-a="editSave">✔ ${t('save')}</button></div></main>`;
  }
  function screenEditPlayer() {
    return `${topbar(t('playerName'), 'editCancel')}<main class="screen">${editorHTML(app.edit.name, app.edit.avatar)}
      <div class="sticky-bottom"><button class="btn big green" data-a="editSave">✔ ${t('save')}</button></div></main>`;
  }
  function screenHowto() {
    return `${topbar(t('howTo'), 'home')}<main class="screen">
      ${t('howToText').map((s, i) => `<section class="panel howto-step" style="--d:${i * 70}ms"><div class="step-n">${i + 1}</div><p>${esc(s)}</p></section>`).join('')}
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
    const keepFocus = active && active.id === 'nameInput' ? { id: 'nameInput', pos: active.selectionStart } : null;
    let html = '';
    switch (app.screen) {
      case 'home': html = screenHome(); break;
      case 'onlineMenu': html = screenOnlineMenu(); break;
      case 'profile': html = screenProfile(); break;
      case 'editPlayer': html = screenEditPlayer(); break;
      case 'howto': html = screenHowto(); break;
      case 'connecting': html = screenConnecting(); break;
      case 'online': html = screenOnline(); break;
      case 'local': html = screenLocal(); break;
    }
    // keep reveal card untouched when only progress changed
    const key = cardKey();
    if (key && key === render._cardKey && document.getElementById('card')) {
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const oldAct = $app.querySelector('.reveal-actions'), newAct = tmp.querySelector('.reveal-actions');
      if (oldAct && newAct) oldAct.innerHTML = newAct.innerHTML;
      updateToast(); return;
    }
    render._cardKey = key;
    $app.innerHTML = html + toastHTML();
    document.documentElement.lang = app.lang;
    if (document.getElementById('cover')) bindCard(onReveal);
    if (document.getElementById('nameInput')) bindEditor();
    if (keepFocus) { const el = document.getElementById(keepFocus.id); if (el) { el.focus(); try { el.setSelectionRange(keepFocus.pos, keepFocus.pos); } catch (e) { /* ignore */ } } }
    tickTimer();
  }
  function updateToast() {
    const old = $app.querySelector('.toast'); if (old) old.remove();
    if (app.toast) $app.insertAdjacentHTML('beforeend', toastHTML());
  }
  function cardKey() {
    if (app.screen === 'online' && app.V && app.V.phase === 'reveal') return 'o' + app.V.roundNo + app.lang;
    if (app.screen === 'local' && app.L && app.L.phase === 'reveal') return 'l' + app.L.roundNo + ':' + app.L.idx + app.lang;
    return null;
  }
  function onReveal() {
    const btn = document.getElementById('seenBtn');
    if (app.screen === 'online' && app.V) { app.revealed = app.V.roundNo; if (btn && !app.V.round.seen.includes(app.V.me)) btn.disabled = false; }
    if (app.screen === 'local') { app.revealed = 'L' + app.L.idx; if (btn) btn.disabled = false; }
  }
  function tickTimer() {
    const el = document.getElementById('timer');
    clearTimeout(tickTimer._t);
    if (!el) return;
    const left = Math.max(0, Number(el.dataset.ends) - Date.now());
    const s = Math.ceil(left / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', s <= 10);
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

  // ---------- Actions ----------
  const actions = {
    home() { leaveOnline(); app.screen = 'home'; render(); },
    lang(v) { app.lang = v; store.set('lang', v); render(); },
    langCycle() { const i = LANGS.findIndex(l => l.id === app.lang); actions.lang(LANGS[(i + 1) % LANGS.length].id); },
    profile() { app.edit = { name: app.profile.name, avatar: app.profile.avatar, target: 'profile' }; app.screen = 'profile'; render(); },
    pickChar(v) { app.edit.avatar = { type: 'char', id: v }; sfx('click'); render(); },
    removePhoto() { app.edit.avatar = { type: 'char', id: CHARACTERS[0].id }; render(); },
    editSave() {
      const name = (app.edit.name || '').trim().slice(0, 16);
      if (!name) return showToast(t('invalidName'));
      if (app.edit.target === 'profile') {
        app.profile.name = name; app.profile.avatar = app.edit.avatar; store.set('profile', app.profile);
        const after = app.edit.after; app.edit = null; sfx('pop');
        if (after) return after();
        app.screen = 'home'; return render();
      }
      // local player
      const L = app.L; const ex = L.players.find(p => p.id === app.edit.target);
      if (ex) { ex.name = name; ex.avatar = app.edit.avatar; } else L.players.push({ id: app.edit.target, name, avatar: app.edit.avatar, score: 0 });
      localSave(); app.edit = null; app.screen = 'local'; sfx('pop'); render();
    },
    editCancel() { app.edit = null; app.screen = 'local'; render(); },
    howto() { app.screen = 'howto'; render(); },
    onlineMenu() { requireName(() => { app.screen = 'onlineMenu'; render(); }); },
    create() { if (typeof Peer === 'undefined') return showToast(t('connError')); hostCreate(); },
    joinCode() {
      const inp = document.getElementById('codeInput'); const code = inp ? inp.value : '';
      app.params.code = code; if (typeof Peer === 'undefined') return showToast(t('connError'));
      clientJoin(code);
    },
    leave() { leaveOnline(); app.screen = 'onlineMenu'; render(); },
    copyCode() { copyText(app.V.code).then(ok => ok && showToast(t('copied'))); },
    async share() {
      const link = shareLink();
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { try { await navigator.share({ title: 'IMPOSTER', text: `IMPOSTER – ${t('roomCode')}: ${app.V.code}`, url: link }); return; } catch (e) { /* fallthrough */ } }
      if (await copyText(link)) showToast(t('copied'));
    },
    kick(v) { send({ t: 'kick', target: v }); },
    setImp(v, a) { settingAction(a, v); }, setTimer(v, a) { settingAction(a, v); }, setHint(v, a) { settingAction(a, v); },
    setCat(v, a) { settingAction(a, v); }, catsAll(v, a) { settingAction(a, v); }, catsNone(v, a) { settingAction(a, v); },
    start() {
      if (app.screen === 'online') { app.voteSel = null; send({ t: 'start' }); }
    },
    toLobby() { send({ t: 'lobby' }); },
    seen() { send({ t: 'seen' }); sfx('click'); },
    skipReveal() { send({ t: 'skipReveal' }); },
    stop() { send({ t: 'stop' }); },
    selVote(v) { app.voteSel = v; sfx('click'); render(); },
    castVote() { if (app.voteSel) { send({ t: 'vote', target: app.voteSel }); sfx('pop'); } },
    endVote() { send({ t: 'endVote' }); },
    // local
    local() { localInit(); render(); },
    lAdd() { app.edit = { name: '', avatar: { type: 'char', id: CHARACTERS[app.L.players.length % CHARACTERS.length].id }, target: uid() }; app.screen = 'editPlayer'; render(); },
    lEdit(v) { const p = app.L.players.find(p => p.id === v); app.edit = { name: p.name, avatar: p.avatar, target: p.id }; app.screen = 'editPlayer'; render(); },
    lRemove(v) { app.L.players = app.L.players.filter(p => p.id !== v); localSave(); render(); },
    lStart() {
      const L = app.L; if (L.players.length < 3) return showToast(t('needPlayers'));
      localSave(); L.round = pickRound(L.players, L.settings, L.used); L.roundNo++; L.idx = 0; L.phase = 'pass'; app.voteSel = null; sfx('pop'); render();
    },
    lPassed() { app.L.phase = 'reveal'; render(); },
    lNext() {
      const L = app.L;
      if (L.idx < L.players.length - 1) { L.idx++; L.phase = 'pass'; } else localStartDiscuss();
      render();
    },
    lStop() { sfx('stop'); buzz([80, 60, 80]); app.L.phase = 'vote'; app.voteSel = null; render(); },
    lSel(v) { app.voteSel = v; sfx('click'); render(); },
    lVote() { localResolve(app.voteSel); },
    lTie() { localResolve(null); },
    lSetup() { app.L.phase = 'setup'; render(); },
    lQuit() { app.L.phase = 'setup'; render(); }
  };
  function localResolve(votedOut) {
    const L = app.L; L.round.result = resolveVotes(L.round, L.players, votedOut); L.phase = 'result';
    sfx(L.round.result.caught ? 'win' : 'lose'); render();
  }
  function settingAction(a, v) {
    if (app.screen === 'online') return send({ t: 'settings', a, v });
    if (app.screen === 'local' && app.L) { applySetting(app.L.settings, a, v, app.L.players.length); localSave(); sfx('click'); render(); }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    // nested buttons inside tiles: the innermost wins
    const a = el.dataset.a; const fn = actions[a];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el.dataset.v, a); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'codeInput') actions.joinCode();
    if (e.key === 'Enter' && e.target.id === 'nameInput') actions.editSave();
  });
  window.addEventListener('beforeunload', () => leaveOnline());

  // Android back button (Capacitor)
  try {
    const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp) CapApp.addListener('backButton', () => {
      if (app.screen === 'home') CapApp.exitApp();
      else if (app.screen === 'online' || app.screen === 'connecting') actions.leave();
      else if (app.screen === 'local' && app.L && app.L.phase !== 'setup') actions.lQuit();
      else if (app.screen === 'editPlayer') actions.editCancel();
      else actions.home();
    });
  } catch (e) { /* not in app */ }

  // deep link ?room=CODE
  const qRoom = new URLSearchParams(location.search).get('room');
  if (qRoom) {
    app.params.code = qRoom.toUpperCase();
    requireName(() => { app.screen = 'onlineMenu'; render(); });
  }
  render();

  // expose for tests/debugging
  window.__imp = { app, actions };
})();
