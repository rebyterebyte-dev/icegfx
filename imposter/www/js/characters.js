// Eigene 2D-Charaktere, prozedural als SVG gezeichnet.
(function () {
  const INK = '#2a2540';

  const CHARACTERS = [
    { id: 'blobbo', name: 'Blobbo',  body: 'blob',  color: '#4fd1a5', belly: '#b8f5df', ears: 'sprout', eyes: 'dot',    mouth: 'smile', extra: ['blush'] },
    { id: 'foxi',   name: 'Foxi',    body: 'round', color: '#ff8a3d', belly: '#ffe2c4', ears: 'cat',    eyes: 'happy',  mouth: 'cat',   extra: ['blush'] },
    { id: 'momo',   name: 'Momo',    body: 'round', color: '#ff8fc7', belly: '#ffe0f0', ears: 'bunny',  eyes: 'big',    mouth: 'o',     extra: ['blush', 'bow'] },
    { id: 'zappy',  name: 'Zappy',   body: 'robot', color: '#ffd23f', belly: '#fff3b8', ears: 'antenna',eyes: 'visor',  mouth: 'grid',  extra: [] },
    { id: 'nubo',   name: 'Nubo',    body: 'cloud', color: '#e9f3ff', belly: '#ffffff', ears: 'none',   eyes: 'sleepy', mouth: 'smile', extra: ['blush'] },
    { id: 'kiki',   name: 'Kiki',    body: 'round', color: '#9b6bff', belly: '#e3d6ff', ears: 'cat',    eyes: 'big',    mouth: 'cat',   extra: ['whiskers'] },
    { id: 'grumbo', name: 'Grumbo',  body: 'tall',  color: '#6cc04a', belly: '#d6f5b8', ears: 'spikes', eyes: 'dot',    mouth: 'grin',  extra: ['spots'] },
    { id: 'luma',   name: 'Luma',    body: 'ghost', color: '#7ec8ff', belly: '#d9f0ff', ears: 'none',   eyes: 'big',    mouth: 'o',     extra: ['blush', 'sparkle'] },
    { id: 'tako',   name: 'Tako',    body: 'octo',  color: '#ff5a5f', belly: '#ffc9cb', ears: 'none',   eyes: 'dot',    mouth: 'smile', extra: ['spots', 'headband'] },
    { id: 'bruno',  name: 'Bruno',   body: 'round', color: '#b5774b', belly: '#f0d2b4', ears: 'bear',   eyes: 'dot',    mouth: 'grin',  extra: ['scarf'] },
    { id: 'fizzy',  name: 'Fizzy',   body: 'blob',  color: '#3dd6f5', belly: '#c4f5ff', ears: 'bubbles',eyes: 'happy',  mouth: 'open',  extra: ['blush'] },
    { id: 'stella', name: 'Stella',  body: 'star',  color: '#ffc93c', belly: '#fff0b3', ears: 'none',   eyes: 'big',    mouth: 'smile', extra: ['blush', 'crown'] },
    { id: 'pingo',  name: 'Pingo',   body: 'tall',  color: '#3b4a7a', belly: '#ffffff', ears: 'none',   eyes: 'dot',    mouth: 'beak',  extra: ['blush', 'scarf'] },
    { id: 'rocky',  name: 'Rocky',   body: 'rock',  color: '#a3a7b8', belly: '#d6d9e3', ears: 'none',   eyes: 'sleepy', mouth: 'flat',  extra: ['glasses', 'moss'] },
    { id: 'shado',  name: 'Shado',   body: 'round', color: '#4a3f6b', belly: '#7b6fa3', ears: 'cat',    eyes: 'mask',   mouth: 'none',  extra: ['headband'] },
    { id: 'pepper', name: 'Pepper',  body: 'tall',  color: '#e8434b', belly: '#ff9aa0', ears: 'horns',  eyes: 'happy',  mouth: 'grin',  extra: ['tail'] },
    { id: 'mochi',  name: 'Mochi',   body: 'blob',  color: '#fff4ea', belly: '#ffffff', ears: 'bear',   eyes: 'happy',  mouth: 'cat',   extra: ['blush', 'leaf'] },
    { id: 'volto',  name: 'Volto',   body: 'robot', color: '#59e0c5', belly: '#c9fff3', ears: 'bolts',  eyes: 'big',    mouth: 'grid',  extra: ['glasses'] }
  ];

  const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function bodyPath(type) {
    switch (type) {
      case 'blob':  return 'M60 18 C92 18 104 48 104 74 C104 98 86 108 60 108 C34 108 16 98 16 74 C16 48 28 18 60 18 Z';
      case 'round': return 'M60 22 C88 22 102 44 102 68 C102 94 84 108 60 108 C36 108 18 94 18 68 C18 44 32 22 60 22 Z';
      case 'tall':  return 'M60 16 C84 16 96 34 96 58 L96 92 C96 104 86 108 60 108 C34 108 24 104 24 92 L24 58 C24 34 36 16 60 16 Z';
      case 'robot': return 'M30 28 L90 28 C98 28 102 32 102 40 L102 96 C102 104 98 108 90 108 L30 108 C22 108 18 104 18 96 L18 40 C18 32 22 28 30 28 Z';
      case 'ghost': return 'M60 16 C88 16 100 40 100 64 L100 104 L88 96 L76 106 L64 96 L52 106 L40 96 L28 106 L20 100 L20 64 C20 40 32 16 60 16 Z';
      case 'cloud': return 'M30 104 C14 104 10 86 20 78 C12 66 22 50 36 54 C36 36 54 26 66 34 C76 22 98 30 96 50 C110 52 112 72 102 80 C110 92 100 106 88 104 Z';
      case 'octo':  return 'M60 16 C88 16 100 38 100 60 C100 74 96 82 94 86 L100 104 L84 96 L74 108 L64 98 L54 108 L44 98 L34 108 L26 96 L20 104 L26 86 C22 80 20 72 20 60 C20 38 32 16 60 16 Z';
      case 'star':  return 'M60 10 L74 40 L106 42 L82 64 L92 100 L60 82 L28 100 L38 64 L14 42 L46 40 Z';
      case 'rock':  return 'M28 40 L50 22 L80 24 L100 46 L104 82 L88 106 L34 108 L16 86 L18 58 Z';
    }
  }

  function ears(c) {
    const col = c.color, dark = shade(col, -30);
    switch (c.ears) {
      case 'cat': return `<path d="M26 46 L24 10 L52 28 Z" fill="${col}" ${S}/><path d="M94 46 L96 10 L68 28 Z" fill="${col}" ${S}/>
        <path d="M30 36 L30 20 L44 29 Z" fill="${c.belly}"/><path d="M90 36 L90 20 L76 29 Z" fill="${c.belly}"/>`;
      case 'bunny': return `<ellipse cx="42" cy="18" rx="10" ry="24" fill="${col}" ${S} transform="rotate(-12 42 18)"/>
        <ellipse cx="78" cy="18" rx="10" ry="24" fill="${col}" ${S} transform="rotate(12 78 18)"/>
        <ellipse cx="42" cy="18" rx="4.5" ry="15" fill="${c.belly}" transform="rotate(-12 42 18)"/>
        <ellipse cx="78" cy="18" rx="4.5" ry="15" fill="${c.belly}" transform="rotate(12 78 18)"/>`;
      case 'bear': return `<circle cx="30" cy="32" r="13" fill="${col}" ${S}/><circle cx="90" cy="32" r="13" fill="${col}" ${S}/>
        <circle cx="30" cy="32" r="6" fill="${dark}"/><circle cx="90" cy="32" r="6" fill="${dark}"/>`;
      case 'antenna': return `<line x1="60" y1="28" x2="60" y2="8" ${S}/><circle cx="60" cy="8" r="7" fill="#ff5a5f" ${S}/>`;
      case 'bolts': return `<rect x="8" y="56" width="12" height="18" rx="4" fill="${dark}" ${S}/><rect x="100" y="56" width="12" height="18" rx="4" fill="${dark}" ${S}/>
        <line x1="60" y1="28" x2="60" y2="14" ${S}/><path d="M52 14 L68 14 L60 4 Z" fill="#ffd23f" ${S}/>`;
      case 'sprout': return `<path d="M60 20 C60 12 60 8 60 4" ${S} fill="none"/><path d="M60 8 C50 -2 36 4 40 12 C46 16 56 14 60 8 Z" fill="#7ed957" ${S}/>
        <path d="M60 10 C70 0 84 6 80 14 C74 18 64 16 60 10 Z" fill="#7ed957" ${S}/>`;
      case 'spikes': return `<path d="M36 22 L42 6 L50 18 L58 2 L66 18 L76 6 L84 22" fill="${shade(col, 25)}" ${S}/>`;
      case 'horns': return `<path d="M34 26 C28 14 30 6 38 2 C36 12 42 18 46 20 Z" fill="#fff3d6" ${S}/><path d="M86 26 C92 14 90 6 82 2 C84 12 78 18 74 20 Z" fill="#fff3d6" ${S}/>`;
      case 'bubbles': return `<circle cx="40" cy="12" r="7" fill="${c.belly}" ${S}/><circle cx="56" cy="6" r="4" fill="${c.belly}" ${S}/><circle cx="82" cy="12" r="6" fill="${c.belly}" ${S}/>`;
      default: return '';
    }
  }

  function eyes(c) {
    const y = c.body === 'star' ? 56 : 60;
    const L = 46, R = 74;
    switch (c.eyes) {
      case 'dot': return `<ellipse cx="${L}" cy="${y}" rx="6" ry="8" fill="${INK}"/><ellipse cx="${R}" cy="${y}" rx="6" ry="8" fill="${INK}"/>
        <circle cx="${L + 2}" cy="${y - 3}" r="2.4" fill="#fff"/><circle cx="${R + 2}" cy="${y - 3}" r="2.4" fill="#fff"/>`;
      case 'big': return `<ellipse cx="${L - 1}" cy="${y}" rx="10" ry="12" fill="#fff" ${S}/><ellipse cx="${R + 1}" cy="${y}" rx="10" ry="12" fill="#fff" ${S}/>
        <ellipse cx="${L + 1}" cy="${y + 2}" rx="5.5" ry="7" fill="${INK}"/><ellipse cx="${R + 3}" cy="${y + 2}" rx="5.5" ry="7" fill="${INK}"/>
        <circle cx="${L + 3}" cy="${y - 1}" r="2.2" fill="#fff"/><circle cx="${R + 5}" cy="${y - 1}" r="2.2" fill="#fff"/>`;
      case 'happy': return `<path d="M${L - 7} ${y + 2} Q${L} ${y - 9} ${L + 7} ${y + 2}" fill="none" ${S}/><path d="M${R - 7} ${y + 2} Q${R} ${y - 9} ${R + 7} ${y + 2}" fill="none" ${S}/>`;
      case 'sleepy': return `<path d="M${L - 7} ${y} Q${L} ${y + 6} ${L + 7} ${y}" fill="none" ${S}/><path d="M${R - 7} ${y} Q${R} ${y + 6} ${R + 7} ${y}" fill="none" ${S}/>`;
      case 'visor': return `<rect x="30" y="${y - 12}" width="60" height="22" rx="11" fill="${INK}"/>
        <ellipse cx="${L}" cy="${y - 1}" rx="6" ry="6" fill="#59ffe0"/><ellipse cx="${R}" cy="${y - 1}" rx="6" ry="6" fill="#59ffe0"/>
        <rect x="36" y="${y - 9}" width="14" height="3" rx="1.5" fill="#ffffff55"/>`;
      case 'mask': return `<path d="M20 50 L100 50 L100 68 L20 68 Z" fill="${INK}"/>
        <path d="M38 60 L54 56 L52 63 Z" fill="#fff"/><path d="M82 60 L66 56 L68 63 Z" fill="#fff"/>`;
    }
    return '';
  }

  function mouth(c) {
    const y = c.body === 'star' ? 72 : 80;
    switch (c.mouth) {
      case 'smile': return `<path d="M52 ${y - 2} Q60 ${y + 6} 68 ${y - 2}" fill="none" ${S}/>`;
      case 'cat':   return `<path d="M50 ${y - 3} Q55 ${y + 3} 60 ${y - 2} Q65 ${y + 3} 70 ${y - 3}" fill="none" ${S}/>`;
      case 'o':     return `<ellipse cx="60" cy="${y}" rx="5" ry="6" fill="#ff6b8b" ${S}/>`;
      case 'open':  return `<path d="M50 ${y - 4} Q60 ${y - 4} 70 ${y - 4} Q68 ${y + 10} 60 ${y + 10} Q52 ${y + 10} 50 ${y - 4} Z" fill="#ff6b8b" ${S}/>`;
      case 'grin':  return `<path d="M46 ${y - 4} Q60 ${y + 12} 74 ${y - 4} Z" fill="${INK}" ${S}/><path d="M54 ${y - 2} L57 ${y + 3} L60 ${y - 2} Z" fill="#fff"/><path d="M62 ${y - 2} L65 ${y + 3} L68 ${y - 2} Z" fill="#fff"/>`;
      case 'flat':  return `<line x1="52" y1="${y}" x2="68" y2="${y}" ${S}/>`;
      case 'grid':  return `<rect x="46" y="${y - 6}" width="28" height="12" rx="4" fill="#fff" ${S}/><line x1="55" y1="${y - 6}" x2="55" y2="${y + 6}" stroke="${INK}" stroke-width="2.5"/><line x1="65" y1="${y - 6}" x2="65" y2="${y + 6}" stroke="${INK}" stroke-width="2.5"/>`;
      case 'beak':  return `<path d="M50 ${y - 6} L70 ${y - 6} L60 ${y + 6} Z" fill="#ffb22e" ${S}/>`;
    }
    return '';
  }

  function extrasBack(c) {
    let s = '';
    if (c.extra.includes('tail')) s += `<path d="M96 92 C112 92 114 76 108 70 L116 66 L104 62 L106 72 C108 80 104 86 94 86" fill="${c.color}" ${S}/>`;
    return s;
  }

  function extrasFront(c) {
    let s = '';
    const ex = c.extra;
    if (ex.includes('blush')) s += `<ellipse cx="34" cy="74" rx="7" ry="4.5" fill="#ff7aa8" opacity=".55"/><ellipse cx="86" cy="74" rx="7" ry="4.5" fill="#ff7aa8" opacity=".55"/>`;
    if (ex.includes('whiskers')) s += `<path d="M22 74 L36 76 M22 82 L36 80 M98 74 L84 76 M98 82 L84 80" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
    if (ex.includes('spots')) s += `<circle cx="34" cy="94" r="5" fill="${shade(c.color, -28)}"/><circle cx="88" cy="40" r="4" fill="${shade(c.color, -28)}"/><circle cx="84" cy="96" r="3.5" fill="${shade(c.color, -28)}"/>`;
    if (ex.includes('bow')) s += `<path d="M60 30 L44 20 L44 40 Z" fill="#ff3d7f" ${S}/><path d="M60 30 L76 20 L76 40 Z" fill="#ff3d7f" ${S}/><circle cx="60" cy="30" r="5" fill="#ff3d7f" ${S}/>`;
    if (ex.includes('crown')) s += `<path d="M42 30 L42 14 L51 22 L60 10 L69 22 L78 14 L78 30 Z" fill="#ffe14d" ${S}/><circle cx="60" cy="22" r="3" fill="#ff5a5f"/>`;
    if (ex.includes('scarf')) s += `<path d="M26 90 Q60 104 94 90 L94 100 Q60 114 26 100 Z" fill="#ff5a5f" ${S}/><path d="M76 100 L82 116 L92 112 L86 98 Z" fill="#ff5a5f" ${S}/>`;
    if (ex.includes('glasses')) s += `<circle cx="46" cy="${c.body === 'rock' ? 60 : 60}" r="11" fill="#ffffff33" ${S}/><circle cx="74" cy="60" r="11" fill="#ffffff33" ${S}/><line x1="57" y1="60" x2="63" y2="60" ${S}/>`;
    if (ex.includes('headband')) s += `<path d="M22 40 Q60 28 98 40 L98 48 Q60 36 22 48 Z" fill="#ff3d3d" ${S}/><path d="M98 44 L114 36 L112 50 Z" fill="#ff3d3d" ${S}/>`;
    if (ex.includes('sparkle')) s += `<path d="M100 20 L103 28 L111 31 L103 34 L100 42 L97 34 L89 31 L97 28 Z" fill="#fff" ${S}/>`;
    if (ex.includes('moss')) s += `<path d="M40 30 C44 22 54 24 56 28 C60 20 72 22 72 30 Z" fill="#7ed957" ${S}/>`;
    if (ex.includes('leaf')) s += `<path d="M60 24 C56 12 66 6 74 10 C72 18 66 24 60 24 Z" fill="#7ed957" ${S}/>`;
    return s;
  }

  function characterSVG(c) {
    const path = bodyPath(c.body);
    const hi = shade(c.color, 40);
    const lo = shade(c.color, -35);
    const uid = c.id;
    const belly = ['star', 'cloud', 'rock'].includes(c.body) ? '' :
      `<ellipse cx="60" cy="92" rx="24" ry="14" fill="${c.belly}" clip-path="url(#cl-${uid})"/>`;
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="char-svg">
      <defs><clipPath id="cl-${uid}"><path d="${path}"/></clipPath></defs>
      <ellipse cx="60" cy="112" rx="34" ry="6" fill="#00000022"/>
      ${extrasBack(c)}
      ${ears(c)}
      <path d="${path}" fill="${c.color}"/>
      <g clip-path="url(#cl-${uid})">
        <path d="${path}" fill="${lo}" transform="translate(10 8)" opacity=".35"/>
        <ellipse cx="40" cy="36" rx="16" ry="9" fill="${hi}" opacity=".7" transform="rotate(-25 40 36)"/>
      </g>
      ${belly}
      <path d="${path}" fill="none" ${S}/>
      ${eyes(c)}${mouth(c)}${extrasFront(c)}
    </svg>`;
  }

  const cache = {};
  function getCharSVG(id) {
    if (!cache[id]) {
      const c = CHARACTERS.find(x => x.id === id) || CHARACTERS[0];
      cache[id] = characterSVG(c);
    }
    return cache[id];
  }

  window.CHARACTERS = CHARACTERS;
  window.getCharSVG = getCharSVG;
})();
