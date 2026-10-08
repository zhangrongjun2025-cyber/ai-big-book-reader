const app = document.querySelector('#app');
const progressBar = document.querySelector('#scroll-progress');
let books = [];
let activeBook = null;
let saveTimer = null;

const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
};

function escapeHtml(value = '') {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function slugify(text) {
  return text.trim().toLowerCase().replace(/[`*_《》“”‘’。，、：；！？（）—]/g, '').replace(/\s+/g, '-').replace(/[^\w\-\u3400-\u9fff]/g, '').slice(0, 72) || `section-${Math.random().toString(36).slice(2, 8)}`;
}

function inline(text) {
  let value = escapeHtml(text);
  value = value.replace(/`([^`]+)`/g, '<code>$1</code>');
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  value = value.replace(/&lt;(https?:\/\/[^&]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
  value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return value;
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  const headings = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flushParagraph(); closeList(); continue; }
    if (/^---+$/.test(line)) { flushParagraph(); closeList(); html.push('<hr>'); continue; }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      const title = heading[2].replace(/^\d+\.\s*/, '');
      const id = `${slugify(title)}-${headings.length + 1}`;
      headings.push({ level, title: heading[2], id });
      html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith('>')) {
      flushParagraph(); closeList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
      flushParagraph(); closeList();
      const rows = [];
      const splitRow = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const headers = splitRow(raw);
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      i -= 1;
      const labels = headers.map((header) => header.replace(/\*\*/g, ''));
      html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${escapeHtml(labels[index] || '')}">${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) { closeList(); listType = nextType; html.push(`<${listType}>`); }
      html.push(`<li>${inline((unordered || ordered)[1])}</li>`);
      continue;
    }

    paragraph.push(line.replace(/\s{2}$/g, ''));
  }
  flushParagraph(); closeList();
  return { html: html.join('\n'), headings };
}

function splitLayers(markdown) {
  const matches = [...markdown.matchAll(/^#\s+(第一层|第二层|第三层)[^\n]*$/gm)];
  if (matches.length < 3) throw new Error('没有识别到完整的三层阅读结构');
  const intro = markdown.slice(0, matches[0].index).replace(/^#\s+.+$/m, '').trim();
  return matches.map((match, index) => ({
    key: match[1],
    heading: match[0].replace(/^#\s+/, ''),
    markdown: markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length).trim(),
    intro: index === 0 ? intro : ''
  }));
}

function enhanceContent(container, book) {
  container.querySelectorAll('table').forEach((table) => {
    const header = [...table.querySelectorAll('th')].map((item) => item.textContent).join(' ');
    if (/年份|时间/.test(header)) table.classList.add('timeline-table');
    if (/人物|身份|关系/.test(header)) table.classList.add('person-table');
    if (/概念|解释|误读/.test(header)) table.classList.add('concept-table');
  });

  const tests = book.id.includes('hongloumeng') ? [/^阶段/] : book.id.includes('deng') ? [/^\d+\.\s*/, /三起三落/] : book.id.includes('zarathustra') ? [/^\d+\.\s+(上帝|超人|末人|自我|权力|永恒|主人|创造|对)/] : [];
  container.querySelectorAll('h3').forEach((heading) => {
    if (!tests.some((test) => test.test(heading.textContent.trim()))) return;
    const wrapper = document.createElement('section');
    wrapper.className = `content-card ${book.id.includes('hongloumeng') ? 'story' : book.id.includes('deng') ? 'event' : 'concept'}`;
    heading.before(wrapper);
    wrapper.append(heading);
    while (wrapper.nextSibling && !(wrapper.nextSibling.nodeType === 1 && /^(H2|H3)$/.test(wrapper.nextSibling.tagName))) wrapper.append(wrapper.nextSibling);
  });
}

function renderShelf() {
  activeBook = null;
  window.scrollTo(0, 0);
  const types = ['全部', ...new Set(books.map((book) => book.type))];
  app.innerHTML = `
    <header class="library-header"><div class="shell">
      <p class="eyebrow">个人数字书房 · 移动阅读版</p>
      <h1 class="library-title">AI帮我读大部头</h1>
      <p class="library-intro">用AI先读大部头，再用几分钟建立一本书的完整认知地图。</p>
      <div class="stats" aria-label="项目统计">
        <div class="stat"><strong>400+</strong><span>已整理书籍</span></div>
        <div class="stat"><strong>${books.length}</strong><span>当前移动版</span></div>
        <div class="stat"><strong>3000</strong><span>长期目标</span></div>
      </div>
    </div></header>
    <div class="library-tools"><div class="shell">
      <div class="search-wrap">${icons.search}<input id="search" class="search" type="search" placeholder="搜索书名、作者或关键词" aria-label="搜索书籍"></div>
      <div class="filters" aria-label="按类型筛选">${types.map((type, index) => `<button class="chip ${index === 0 ? 'active' : ''}" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`).join('')}</div>
    </div></div>
    <section class="library-main shell">
      <div class="results-head"><h2>移动阅读书架</h2><span id="results-count" class="results-count"></span></div>
      <div id="book-grid" class="book-grid"></div>
    </section>`;

  const search = document.querySelector('#search');
  const grid = document.querySelector('#book-grid');
  const count = document.querySelector('#results-count');
  let currentType = '全部';

  const draw = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = books.filter((book) => {
      const haystack = [book.title, book.author, book.type, book.summary, ...book.keywords].join(' ').toLowerCase();
      return (currentType === '全部' || book.type === currentType) && (!query || haystack.includes(query));
    });
    count.textContent = `${filtered.length} 本`;
    grid.innerHTML = filtered.length ? filtered.map((book) => `
      <article class="book-card">
        <div class="book-top"><span class="book-code">${escapeHtml(book.code)}</span><span class="book-status">${escapeHtml(book.status)}</span></div>
        <h3>${escapeHtml(book.title)}</h3>
        <div class="book-byline">${escapeHtml(book.author)} · ${escapeHtml(book.type)}</div>
        <p class="book-summary">${escapeHtml(book.summary)}</p>
        <div class="book-meta"><span>${escapeHtml(book.version)}</span><span>${escapeHtml(book.readTime)}</span></div>
        <div class="book-actions">
          <a class="button" href="#/book/${book.id}?layer=1">3分钟速览</a>
          <a class="button primary" href="#/book/${book.id}?layer=2">完整阅读</a>
        </div>
      </article>`).join('') : '<div class="empty">没有找到符合条件的书。</div>';
  };
  search.addEventListener('input', draw);
  document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    currentType = chip.dataset.type;
    document.querySelectorAll('.chip').forEach((item) => item.classList.toggle('active', item === chip));
    draw();
  }));
  draw();
}

async function renderBook(id, requestedLayer = 1) {
  app.innerHTML = '<div class="loading">正在打开这本书…</div>';
  const indexedBook = books.find((item) => item.id === id);
  if (!indexedBook) throw new Error('没有找到这本书');
  const response = await fetch(indexedBook.path);
  if (!response.ok) throw new Error('正文读取失败');
  const book = { ...indexedBook, markdown: await response.text() };
  activeBook = book;
  const layers = splitLayers(book.markdown);
  const names = ['3分钟速览', '完整导读', '深入阅读'];
  const times = ['约3—5分钟', '约15—30分钟', '按需阅读'];
  const parsed = layers.map((layer) => parseMarkdown(layer.markdown));
  const initialOpen = Math.max(1, Math.min(3, Number(requestedLayer) || 1));

  app.innerHTML = `<div class="reader-shell">
    <header class="reader-topbar">
      <button class="back-link" id="back-shelf">返回书架</button>
      <span class="reader-top-title">${escapeHtml(book.title)}</span>
      <span class="reader-progress-label" id="progress-label">速览</span>
    </header>
    <section class="book-hero">
      <p class="eyebrow">${escapeHtml(book.code)} · ${escapeHtml(book.type)}</p>
      <h1>${escapeHtml(book.title)}</h1>
      <div class="meta-row"><span class="meta-pill">${escapeHtml(book.author)}</span><span class="meta-pill">${escapeHtml(book.version)}</span><span class="meta-pill">${escapeHtml(book.readTime)}</span></div>
      <p class="hero-summary">${escapeHtml(book.summary)}</p>
    </section>
    <nav class="layer-nav" aria-label="阅读层级">${names.map((name, index) => `<button class="layer-step ${index === 0 ? 'active' : ''}" data-layer="${index + 1}">${index + 1}. ${name}</button>`).join('')}</nav>
    <article class="reader-body">
      ${layers.map((layer, index) => `
        <section class="layer" id="layer-${index + 1}" data-layer="${index + 1}" ${index + 1 > initialOpen ? 'hidden' : ''}>
          <div class="layer-head"><div><span class="layer-kicker">第${['一','二','三'][index]}层</span><h2 class="layer-title">${names[index]}</h2></div><span class="layer-time">${times[index]}</span></div>
          ${index > 0 ? `<details class="toc"><summary>本层目录</summary><nav class="toc-links">${parsed[index].headings.filter((h) => h.level === 2).map((h) => `<a href="#${h.id}">${inline(h.title)}</a>`).join('')}</nav></details>` : ''}
          <div class="layer-content" data-content="${index + 1}">${index === 0 && layer.intro ? parseMarkdown(layer.intro).html : ''}${parsed[index].html}</div>
          <div class="layer-cta">
            ${index > 0 ? `<button class="button previous-layer" data-target="${index}">上一层</button>` : '<a class="button" href="#/">返回书架</a>'}
            ${index < 2 ? `<button class="button primary next-layer" data-target="${index + 2}">${index === 0 ? '继续读完整导读' : '继续深入阅读'}</button>` : '<a class="button primary" href="#/">读完了，返回书架</a>'}
          </div>
        </section>`).join('')}
    </article>
    <footer class="reader-footer"><a class="button" href="#/">返回书架</a></footer>
  </div>`;

  layers.forEach((_, index) => enhanceContent(document.querySelector(`[data-content="${index + 1}"]`), book));
  document.querySelector('#back-shelf').addEventListener('click', () => { location.hash = '#/'; });

  const revealAndGo = (number) => {
    for (let i = 1; i <= number; i += 1) document.querySelector(`#layer-${i}`).hidden = false;
    const target = document.querySelector(`#layer-${number}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.querySelectorAll('.next-layer, .previous-layer').forEach((button) => button.addEventListener('click', () => revealAndGo(Number(button.dataset.target))));
  document.querySelectorAll('.layer-step').forEach((button) => button.addEventListener('click', () => revealAndGo(Number(button.dataset.layer))));

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const number = Number(visible.target.dataset.layer);
    document.querySelectorAll('.layer-step').forEach((step) => step.classList.toggle('active', Number(step.dataset.layer) === number));
    document.querySelector('#progress-label').textContent = ['速览', '完整', '深入'][number - 1];
  }, { rootMargin: '-120px 0px -60% 0px', threshold: [0, .1, .5] });
  document.querySelectorAll('.layer').forEach((layer) => observer.observe(layer));

  requestAnimationFrame(() => {
    if (initialOpen > 1) revealAndGo(initialOpen);
    else {
      const saved = Number(localStorage.getItem(`reader-position:${book.id}`));
      if (saved > 120) window.scrollTo(0, saved);
    }
  });
}

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  if (activeBook) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => localStorage.setItem(`reader-position:${activeBook.id}`, String(Math.round(window.scrollY))), 180);
  }
}

async function route() {
  const hash = location.hash || '#/';
  const match = hash.match(/^#\/book\/([^?]+)(?:\?layer=(\d))?/);
  try {
    if (match) await renderBook(match[1], match[2]);
    else renderShelf();
  } catch (error) {
    app.innerHTML = `<div class="empty"><h2>暂时打不开</h2><p>${escapeHtml(error.message)}</p><a class="button" href="#/">返回书架</a></div>`;
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('hashchange', route);

fetch('./books.json')
  .then((response) => response.json())
  .then((data) => { books = data; route(); })
  .catch(() => { app.innerHTML = '<div class="empty">书架读取失败，请重新启动本地服务。</div>'; });
