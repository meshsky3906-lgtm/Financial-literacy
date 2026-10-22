/* ==========================================================================
   FinFlow 智富記帳 — SVG 圖示層(取代 emoji)
   --------------------------------------------------------------------------
   做法:資料與程式裡仍可保留 emoji 字元(例如 localStorage 裡的分類圖示),
   本檔在畫面上把「已知的 emoji」自動換成線條 SVG,舊資料不需遷移。
   - 只替換下方對照表有的 emoji;使用者自訂的其他 emoji 維持原樣
   - 不處理 input / textarea / option / script / style 內的文字
   - 純原生、無外部相依,file:/// 可用
   ========================================================================== */
(function () {
  'use strict';

  // 圖示名稱 → SVG 內容(24×24 線條圖示)
  var P = {
    card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5C14 8.7 13 8 12 8c-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.6-2.5-1.5M12 6v2M12 16v2"/>',
    bars: '<path d="M4 20h16M7 20v-7M12 20V5M17 20v-10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    warn: '<path d="M12 3L2 21h20zM12 10v5M12 18h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M5 3h11l4 4v14H5zM8 3v5h7V3M8 21v-7h8v7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
    rocket: '<path d="M14 4c3 0 6 1 6 1s1 3 1 6l-6 6-6-6zM8 16l-4 4M9 12l-4 1 3 3M12 15l-1 4-3-3"/>',
    trophy: '<path d="M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 15v4M8 21h8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h6"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v4h16v-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    dumbbell: '<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8zM7.5 7.5h.01"/>',
    bowl: '<path d="M3 11h18c0 5-4 9-9 9s-9-4-9-9zM8 7c0-1.5 1.5-1.5 1.5-3M13 7c0-1.5 1.5-1.5 1.5-3"/>',
    utensils: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 3c-2 2-3 5-3 8h3v10"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4M9 14h.01M15 14h.01"/>',
    basket: '<path d="M4 10h16l-2 10H6zM8 10l3-6M16 10l-3-6"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M16 11h.01M18.5 14h.01"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
    plane: '<path d="M21 3L3 11l7 3 3 7zM10 14l11-11"/>',
    pill: '<rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M2 6h20v3H2zM12 6v15M12 6C10 2 6 3 7 5s5 1 5 1zM12 6c2-4 6-3 5-1s-5 1-5 1z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
    envelope: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 9c4 4 10 4 14 0M12 11v3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
    scale: '<path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    car: '<path d="M4 14l2-6h12l2 6v4H4zM4 14h16M7 17h.01M17 17h.01"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 15c3 0 5 2 5 5"/>'
  };

  // emoji → 圖示名稱(變體選擇符 U+FE0F 會先被移除再比對)
  var MAP = {
    '💳': 'card', '📈': 'trend', '✅': 'check', '🔄': 'refresh', '🏠': 'home', '💸': 'cash',
    '🛡': 'shield', '🛍': 'bag', '💰': 'coin', '🪙': 'coin', '📊': 'bars', '📅': 'calendar', '📆': 'calendar',
    '💡': 'bulb', '🏦': 'bank', '🎉': 'sparkle', '✨': 'sparkle', '🌟': 'sparkle', '🗑': 'trash',
    '⚠': 'warn', '🚨': 'warn', '➕': 'plus', '✚': 'plus', '💾': 'save', '🎯': 'target', '➔': 'arrow',
    '✏': 'pencil', '📝': 'pencil', '📦': 'box', '🚀': 'rocket', '🏆': 'trophy', '🔗': 'link',
    '📋': 'clipboard', '📄': 'clipboard', '📜': 'clipboard', '⚡': 'zap', '📤': 'upload', '📥': 'download',
    '⚙': 'gear', '🔥': 'flame', '💪': 'dumbbell', '🏷': 'tag', '🍚': 'bowl', '🥩': 'utensils',
    '☕': 'coffee', '🚇': 'train', '🧻': 'basket', '🎮': 'game', '📱': 'phone', '✈': 'plane',
    '💊': 'pill', '📚': 'book', '🎁': 'gift', '💼': 'briefcase', '💻': 'laptop', '🧧': 'envelope',
    '🔍': 'search', '⚖': 'scale', '🕒': 'clock', '⏰': 'clock', '⏳': 'clock', '🧮': 'calc', '🚗': 'car', '🎓': 'cap', '🤝': 'users'
  };

  var EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]️?/gu;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, INPUT: 1, TITLE: 1, SVG: 1, svg: 1 };

  function svgFor(name) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + P[name] + '</svg>';
  }

  // 把一個文字節點裡的已知 emoji 換成 SVG(未知 emoji 保留原字)
  function convertTextNode(node) {
    var text = node.nodeValue;
    if (!text) return;
    EMOJI_RE.lastIndex = 0;
    if (!EMOJI_RE.test(text)) return;
    EMOJI_RE.lastIndex = 0;
    var changed = false;
    var html = '';
    var last = 0;
    var m;
    while ((m = EMOJI_RE.exec(text)) !== null) {
      var key = m[0].replace('️', '');
      var name = MAP[key];
      html += escapeHtml(text.slice(last, m.index));
      if (name) { html += svgFor(name); changed = true; }
      else { html += escapeHtml(m[0]); }
      last = m.index + m[0].length;
    }
    if (!changed) return;
    html += escapeHtml(text.slice(last));
    var holder = document.createElement('span');
    holder.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (holder.firstChild) frag.appendChild(holder.firstChild);
    node.parentNode.replaceChild(frag, node);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function convertTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (root.parentNode && !SKIP[root.parentNode.nodeName]) convertTextNode(root);
      return;
    }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return SKIP[n.parentNode.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convertTextNode);
  }

  function start() {
    convertTree(document.body);
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === 'characterData') convertTree(r.target);
        else r.addedNodes.forEach(convertTree);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.FinFlowIcons = { convertTree: convertTree, names: Object.keys(P) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
