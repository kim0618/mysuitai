// AiBuilderSidebar: the single Sidebar used by every AI Studio screen. Only the active item changes per route.
(function () {
  const LAST_WORKSPACE = 'aiBuilder:lastWorkspace';
  // Product brand shown to users. Logo slots stay empty until the approved artwork is added under /ai-builder/brand/;
  // the "M" letter mark is the temporary fallback (see docs/133).
  const BRAND = Object.freeze({ product: 'MySuit', name: 'AI Studio', tagline: ['AI가 만드는', '더 스마트한 업무의 시작'], logoMark: null, logoFull: null, favicon: '/ai-builder/brand/favicon.svg' });
  // Line icons (24px grid, stroke = currentColor) so the active item can turn green without a second asset.
  const ICONS = {
    create: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    works: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8"/>',
    templates: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    arrow: '<path d="M9 6l6 6-6 6"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  // 편집하기 (developer / template designer) and 사용자 편집 (end user) open the same document; only the screen differs.
  const ITEMS = [
    { route: 'create', icon: 'create', label: '생성하기', href: '/ai-builder/import' },
    { route: 'edit', icon: 'edit', label: '편집하기', href: '/ai-builder', workspace: '/ai-builder' },
    { route: 'user', icon: 'user', label: '사용자 편집', href: '/ai-builder/user', workspace: '/ai-builder/user' },
    { route: 'works', icon: 'works', label: '내 작업' },
    { route: 'templates', icon: 'templates', label: '템플릿' },
    { route: 'settings', icon: 'settings', label: '설정' },
  ];
  const storage = { get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} } };
  function element(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) key === 'class' ? (node.className = value) : node.setAttribute(key, value);
    node.append(...children);
    return node;
  }
  const icon = (name, cls) => { const node = element('span', { class: cls, 'aria-hidden': 'true' }); node.innerHTML = svg(name); return node; };
  // The last opened document (query string) is shared by both edit screens, so switching screens keeps the document.
  const lastQuery = () => { const value = storage.get(LAST_WORKSPACE) || ''; const at = value.indexOf('?'); return at >= 0 ? value.slice(at) : ''; };
  function mount({ active }) {
    const params = new URLSearchParams(location.search);
    if (['edit', 'user'].includes(active) && params.get('projectName')) storage.set(LAST_WORKSPACE, location.pathname + location.search);
    const mark = element('span', { class: `ai-brand-mark${BRAND.logoMark ? ' has-image' : ''}`, 'aria-hidden': 'true' }, [BRAND.product.charAt(0)]);
    if (BRAND.logoMark) mark.style.backgroundImage = `url("${BRAND.logoMark}")`;
    const brand = element('div', { class: 'ai-brand', role: 'img', 'aria-label': `${BRAND.product} ${BRAND.name}` }, [mark, element('span', { class: 'ai-brand-name' }, [element('b', {}, [BRAND.product]), ' ', element('em', {}, [BRAND.name])])]);
    const tagline = element('p', { class: 'ai-brand-tagline' }, [BRAND.tagline[0], element('br'), BRAND.tagline[1]]);
    const nav = element('nav', { class: 'ai-nav' }, ITEMS.map((item) => {
      const href = item.workspace ? (item.route === active ? location.pathname + location.search : item.workspace + lastQuery()) : item.href || '#';
      const link = element('a', { class: `ai-nav-item${item.route === active ? ' active' : ''}`, href, 'data-route': item.route, title: item.label }, [icon(item.icon, 'ai-nav-icon'), element('span', { class: 'ai-nav-label' }, [item.label])]);
      if (item.route === active) link.setAttribute('aria-current', 'page');
      if (!item.href) { link.setAttribute('aria-disabled', 'true'); link.addEventListener('click', (event) => event.preventDefault()); }
      return link;
    }));
    // Studio card: a quiet entry back to 생성하기 at the foot of the menu (hidden when collapsed or short).
    const promo = element('a', { class: 'ai-promo', href: '/ai-builder/import', 'aria-label': 'AI와 함께 새 문서 만들기' }, [
      element('strong', {}, ['AI와 함께', element('br'), '문서를 더 스마트하게']),
      element('span', { class: 'ai-promo-foot' }, [element('small', {}, [`${BRAND.product} ${BRAND.name}`]), icon('arrow', 'ai-promo-go')]),
    ]);
    // Icon-only toggle; the label lives in aria-label and the tooltip.
    const collapse = element('button', { class: 'ai-collapse', type: 'button', 'aria-label': '메뉴 접기', title: '메뉴 접기', 'aria-expanded': 'true' }, [element('span', { class: 'ai-collapse-icon', 'aria-hidden': 'true' }, ['‹'])]);
    collapse.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('ai-sidebar-collapsed'), label = collapsed ? '메뉴 펼치기' : '메뉴 접기';
      collapse.setAttribute('aria-expanded', String(!collapsed));
      collapse.setAttribute('aria-label', label);
      collapse.title = label;
    });
    const sidebar = element('aside', { class: 'ai-sidebar', 'aria-label': `${BRAND.name} 메뉴`, 'data-active': active }, [brand, tagline, nav, element('div', { class: 'ai-sidebar-foot' }, [promo, collapse])]);
    document.body.prepend(sidebar);
    return sidebar;
  }
  window.AiBuilderSidebar = { mount, ITEMS, BRAND, lastQuery, icon: svg };
})();
