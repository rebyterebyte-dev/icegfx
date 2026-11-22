/* Netzwerk-Schicht: Räume über öffentliche MQTT-Relays (WebSocket).
 * Funktioniert in jedem Netz (WLAN, mobile Daten), weil keine direkte Verbindung
 * zwischen den Handys nötig ist. Alle Nachrichten sind mit einem Schlüssel aus dem
 * Gruppen-Code verschlüsselt (AES-GCM); der Code selbst taucht nie im Klartext auf. */
(function () {
  'use strict';
  const DEFAULT_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://public:public@public.cloud.shiftr.io'
  ];
  const qBroker = new URLSearchParams(location.search).get('broker'); // nur für Tests
  const BROKERS = qBroker ? [qBroker] : DEFAULT_BROKERS;
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
  // Verbindet zu einem Broker; resolved erst nach dem ersten "connect".
  function connectBroker(url, opts, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const client = mqtt.connect(url, Object.assign({
        clientId: 'ci_' + rid() + rid(), keepalive: 20, reconnectPeriod: 2500, connectTimeout: timeoutMs || 7000,
        clean: true, protocolVersion: 4
      }, opts));
      const fail = err => { if (done) return; done = true; try { client.end(true); } catch (e) { /* ignore */ } reject(err || new Error('conn')); };
      const tmr = setTimeout(() => fail(new Error('timeout')), (timeoutMs || 7000) + 500);
      client.once('connect', () => { if (done) return; done = true; clearTimeout(tmr); resolve(client); });
      client.on('error', e => { if (!done) { clearTimeout(tmr); fail(e); } });
    });
  }
  // Nachrichten nacheinander (in Reihenfolge) verarbeiten, obwohl das Entschlüsseln async ist.
  function serial() { let chain = Promise.resolve(); return fn => { chain = chain.then(fn).catch(() => {}); }; }

  // ---------- Host ----------
  async function host(code, h) {
    const { base, key } = await roomKeys(code);
    const willPayload = await seal(key, { alive: false });
    let client = null, lastErr = null;
    for (const url of BROKERS) {
      try {
        client = await connectBroker(url, { will: { topic: base + '/info', payload: willPayload, qos: 1, retain: true } }, 6000);
        break;
      } catch (e) { lastErr = e; }
    }
    if (!client) throw lastErr || new Error('conn');
    const q = serial();
    const announce = async () => client.publish(base + '/info', await seal(key, { alive: true, ts: Date.now() }), { qos: 1, retain: true });
    client.subscribe(base + '/up', { qos: 1 });
    await announce();
    let first = true;
    client.on('connect', () => { if (first) { first = false; return; } announce(); h.onStatus && h.onStatus(true); h.onReconnect && h.onReconnect(); });
    client.on('offline', () => h.onStatus && h.onStatus(false));
    client.on('message', (topic, buf) => {
      if (topic !== base + '/up') return;
      q(async () => { const m = await unseal(key, buf); if (m && m.from) h.onMessage(m); });
    });
    // Ein Ereignis "connect" kann schon vor dem Listener gefeuert haben
    first = false;
    return {
      send: (pid, obj) => q(async () => { client.publish(base + '/d/' + pid, await seal(key, obj), { qos: 1 }); }),
      close: () => new Promise(res => {
        try { client.publish(base + '/info', new Uint8Array(0), { qos: 1, retain: true }, () => { client.end(false, {}, res); }); } catch (e) { res(); }
        setTimeout(res, 1500);
      })
    };
  }

  // ---------- Mitspieler ----------
  async function join(code, pid, h) {
    const { base, key } = await roomKeys(code);
    const willPayload = await seal(key, { t: 'drop', from: pid });
    const opts = { will: { topic: base + '/up', payload: willPayload, qos: 1, retain: false } };
    // Alle Broker parallel nach dem Raum fragen und den nehmen, auf dem er existiert.
    const found = await new Promise(resolve => {
      let pending = BROKERS.length, connected = 0, winner = null;
      const clients = [];
      const finish = res => { if (winner !== null) return; winner = res; clients.forEach(c => { if (!res || c !== res.client) try { c.end(true); } catch (e) { /* ignore */ } }); resolve(res); };
      const giveUp = setTimeout(() => finish({ client: null, connected }), 9000);
      BROKERS.forEach(url => {
        connectBroker(url, opts, 6000).then(client => {
          if (winner !== null) { client.end(true); return; }
          connected++; clients.push(client);
          client.on('message', (topic, buf) => {
            if (topic !== base + '/info' || winner !== null) return;
            unseal(key, buf).then(m => { if (m && m.alive) { clearTimeout(giveUp); finish({ client }); } });
          });
          client.subscribe(base + '/info', { qos: 1 });
          // Retained-Nachricht kommt sofort; ohne sie gibt es den Raum auf diesem Broker nicht
          setTimeout(() => { if (--pending === 0 && winner === null) { clearTimeout(giveUp); finish({ client: null, connected }); } }, 2500);
        }).catch(() => { if (--pending === 0 && winner === null) { clearTimeout(giveUp); finish({ client: null, connected }); } });
      });
    });
    if (!found.client) throw new Error(found.connected ? 'notfound' : 'conn');
    const client = found.client;
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
    return {
      send: obj => q(async () => { client.publish(base + '/up', await seal(key, Object.assign({}, obj, { from: pid })), { qos: 1 }); }),
      close: () => new Promise(res => { try { client.end(false, {}, res); } catch (e) { res(); } setTimeout(res, 1200); })
    };
  }

  window.RoomNet = { host, join, available: () => typeof mqtt !== 'undefined' && !!(window.crypto && crypto.subtle) };
})();
