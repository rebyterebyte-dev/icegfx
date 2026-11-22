/* Netzwerk-Schicht: Räume über öffentliche MQTT-Relays (WebSocket).
 * - Funktioniert in jedem Netz (WLAN, mobile Daten): keine Direktverbindung nötig.
 * - Der Host meldet den Raum auf ALLEN erreichbaren Servern an; Mitspieler nehmen
 *   den Server, der bei ihnen funktioniert.
 * - Verschlüsselt (AES-GCM) mit einem Schlüssel aus dem Gruppen-Code.
 * - Überlebt App-Wechsel / Bildschirm aus: automatische Wiederverbindung. */
(function () {
  'use strict';
  const DEFAULT_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://public:public@public.cloud.shiftr.io'
  ];
  const qBroker = new URLSearchParams(location.search).get('broker'); // nur für Tests (kommagetrennt)
  const BROKERS = qBroker ? qBroker.split(',') : DEFAULT_BROKERS;
  const te = new TextEncoder(), td = new TextDecoder();
  const rid = () => Math.random().toString(36).slice(2, 10);

  async function sha(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s))); }
  const hex = b => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  async function roomKeys(code) {
    const base = 'classicimposter/v1/' + hex(await sha('ci-topic:' + code)).slice(0, 24);
    const key = await crypto.subtle.importKey('raw', await sha('ci-key:' + code), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { base, key };
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return out;
  }
  async function unseal(key, buf) {
    if (!buf || buf.length < 13) return null;
    try {
      const u8 = new Uint8Array(buf);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12));
      return JSON.parse(td.decode(pt));
    } catch (e) { return null; }
  }
  function makeClient(url, opts) {
    return mqtt.connect(url, Object.assign({
      clientId: 'ci_' + rid() + rid(), keepalive: 25, reconnectPeriod: 2000, connectTimeout: 10000,
      clean: true, protocolVersion: 4, resubscribe: true
    }, opts));
  }
  // Wartet auf die erste Verbindung (oder gibt nach timeoutMs auf, Client verbindet dann ggf. später weiter).
  function firstConnect(client, timeoutMs) {
    return new Promise(resolve => {
      if (client.connected) return resolve(true);
      const tm = setTimeout(() => resolve(false), timeoutMs);
      client.once('connect', () => { clearTimeout(tm); resolve(true); });
    });
  }
  function serial() { let chain = Promise.resolve(); return fn => { chain = chain.then(fn).catch(() => {}); }; }
  function wakeClient(c) { try { if (!c.connected && !c.reconnecting && !c.disconnecting) c.reconnect(); } catch (e) { /* ignore */ } }

  // ---------- Host: auf allen Servern gleichzeitig ----------
  async function host(code, h) {
    const { base, key } = await roomKeys(code);
    const willPayload = await seal(key, { alive: false });
    const q = serial();
    const lastBroker = {}; // pid -> Index des Servers, über den der Spieler zuletzt kam
    let closed = false;
    const announce = async c => { if (!closed && c.connected) c.publish(base + '/info', await seal(key, { alive: true, ts: Date.now() }), { qos: 1, retain: true }); };
    const clients = BROKERS.map((url, i) => {
      const c = makeClient(url, { will: { topic: base + '/info', payload: willPayload, qos: 1, retain: true } });
      c.on('connect', () => { c.subscribe(base + '/up', { qos: 1 }); announce(c); if (c._ciSeen) h.onReconnect && h.onReconnect(); c._ciSeen = true; status(); });
      c.on('offline', status); c.on('close', status);
      c.on('error', () => {});
      c.on('message', (topic, buf) => {
        if (topic !== base + '/up') return;
        q(async () => {
          const m = await unseal(key, buf); if (!m || !m.from) return;
          // "drop" nur glauben, wenn er vom Server kommt, über den der Spieler gerade verbunden ist
          if (m.t === 'drop') { if (lastBroker[m.from] !== i) return; }
          else lastBroker[m.from] = i;
          h.onMessage(m);
        });
      });
      return c;
    });
    let lastUp = null;
    function status() { const up = clients.some(c => c.connected); if (up !== lastUp) { lastUp = up; h.onStatus && h.onStatus(up); } }
    // mindestens ein Server muss gehen
    const ok = await Promise.race([
      Promise.any ? Promise.any(clients.map(c => firstConnect(c, 12000).then(v => v || Promise.reject()))).catch(() => false) : firstConnect(clients[0], 12000)
    ]);
    if (!ok) { clients.forEach(c => c.end(true)); throw new Error('conn'); }
    // kurz warten, damit möglichst viele Server den Raum kennen, bevor der Code geteilt wird
    await Promise.all(clients.map(c => firstConnect(c, 2500)));
    const pick = pid => {
      const i = lastBroker[pid];
      if (i != null && clients[i].connected) return [clients[i]];
      return clients.filter(c => c.connected); // unbekannt: über alle senden
    };
    return {
      send: (pid, obj) => q(async () => { const payload = await seal(key, obj); pick(pid).forEach(c => c.publish(base + '/d/' + pid, payload, { qos: 1 })); }),
      wake: () => { clients.forEach(c => { wakeClient(c); announce(c); }); },
      brokers: () => clients.map(c => c.connected),
      _debugDrop: () => clients.forEach(c => { try { c.stream && c.stream.destroy(); } catch (e) { /* ignore */ } }),
      close: () => new Promise(res => {
        closed = true;
        let n = clients.length;
        const one = () => { if (--n <= 0) res(); };
        clients.forEach(c => {
          try {
            if (c.connected) c.publish(base + '/info', new Uint8Array(0), { qos: 1, retain: true }, () => c.end(false, {}, one));
            else { c.end(true); one(); }
          } catch (e) { one(); }
        });
        setTimeout(res, 2000);
      })
    };
  }

  // ---------- Mitspieler ----------
  async function join(code, pid, h) {
    const { base, key } = await roomKeys(code);
    const willPayload = await seal(key, { t: 'drop', from: pid });
    const opts = { will: { topic: base + '/up', payload: willPayload, qos: 1, retain: false } };
    // Alle Server parallel nach dem Raum fragen; den ersten nehmen, auf dem er existiert.
    const result = await new Promise(resolve => {
      let decided = false, connectedAny = false;
      const clients = BROKERS.map(url => makeClient(url, opts));
      const finish = (winner, info) => {
        if (decided) return; decided = true; clearTimeout(giveUp);
        // sauber trennen (DISCONNECT), sonst schickt der Server dem Host fälschlich "Spieler weg"
        clients.forEach(c => { if (c !== winner) try { c.end(!c.connected); } catch (e) { /* ignore */ } });
        resolve({ client: winner, info, connectedAny });
      };
      // Retained-Nachricht kommt normalerweise sofort nach dem Abo; großzügig warten (Handynetze sind langsam)
      const giveUp = setTimeout(() => finish(null), 14000);
      let silentDone = 0;
      clients.forEach(c => {
        c.on('error', () => {});
        c.once('connect', () => {
          connectedAny = true;
          c.subscribe(base + '/info', { qos: 1 });
          // auf diesem Server nach 6 s nichts gefunden -> zählt als "nicht da"
          setTimeout(() => { if (++silentDone === clients.length && !decided) finish(null); }, 6000);
        });
        c.on('message', (topic, buf) => {
          if (decided || topic !== base + '/info' || !buf || !buf.length) return;
          unseal(key, buf).then(m => { if (m) finish(c, m); }); // auch "Host kurz weg" zählt als gefunden
        });
      });
      // Server, die gar nicht verbinden, zählen nach 10 s auch als "nicht da"
      setTimeout(() => { clients.forEach(c => { if (!c.connected && !c._counted) { c._counted = true; if (++silentDone === clients.length && !decided) finish(null); } }); }, 10000);
    });
    if (!result.client) throw new Error(result.connectedAny ? 'notfound' : 'conn');
    const client = result.client;
    const q = serial();
    client.removeAllListeners('message');
    client.subscribe(base + '/d/' + pid, { qos: 1 });
    client.on('message', (topic, buf) => {
      q(async () => {
        if (topic === base + '/info') {
          if (!buf || buf.length === 0) return h.onHost('closed');
          const m = await unseal(key, buf); if (m) h.onHost(!!m.alive);
          return;
        }
        if (topic === base + '/d/' + pid) { const m = await unseal(key, buf); if (m) h.onMessage(m); }
      });
    });
    client.on('connect', () => { h.onStatus && h.onStatus(true); h.onReconnect && h.onReconnect(); });
    client.on('offline', () => h.onStatus && h.onStatus(false));
    if (result.info && result.info.alive === false) setTimeout(() => h.onHost(false), 0);
    return {
      send: obj => q(async () => { client.publish(base + '/up', await seal(key, Object.assign({}, obj, { from: pid })), { qos: 1 }); }),
      wake: () => wakeClient(client),
      _debugDrop: () => { try { client.stream && client.stream.destroy(); } catch (e) { /* ignore */ } },
      close: () => new Promise(res => { try { client.end(false, {}, res); } catch (e) { res(); } setTimeout(res, 1200); })
    };
  }

  window.RoomNet = { host, join, available: () => typeof mqtt !== 'undefined' && !!(window.crypto && crypto.subtle) };
})();
