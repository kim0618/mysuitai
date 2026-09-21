// AiBuilderSidebar: the single Sidebar used by every AI Studio screen. Only the active item changes per route.
(function () {
  const LAST_WORKSPACE = 'aiBuilder:lastWorkspace';
  // Product brand shown to users. Logo slots stay empty until the approved artwork is added under /ai-builder/brand/;
  // the "M" letter mark is the temporary fallback (see docs/133).
  const BRAND = Object.freeze({ product: 'MySuit', name: 'AI Studio', logoMark: null, logoFull: null, favicon: '/ai-builder/brand/favicon.svg' });
  // 편집하기 (developer / template designer) and 사용자 편집 (end user) open the same document; only the screen differs.
  const ITEMS = [
    { route: 'create', icon: '↥', label: '생성하기', href: '/ai-builder/import' },
    { route: 'edit', icon: '✎', label: '편집하기', href: '/ai-builder', workspace: '/ai-builder' },
    { route: 'user', icon: '▤', label: '사용자 편집', href: '/ai-builder/user', workspace: '/ai-builder/user' },
    { route: 'works', icon: '▣', label: '내 작업' },
    { route: 'templates', icon: '◇', label: '템플릿' },
    { route: 'settings', icon: '⚙', label: '설정' },
  ];
  const storage = { get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} } };
  function element(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) key === 'class' ? (node.className = value) : node.setAttribute(key, value);
    node.append(...children);
    return node;
  }
  // The last opened document (query string) is shared by both edit screens, so switching screens keeps the document.
  const lastQuery = () => { const value = storage.get(LAST_WORKSPACE) || ''; const at = value.indexOf('?'); return at >= 0 ? value.slice(at) : ''; };
  function mount({ active }) {
    const params = new URLSearchParams(location.search);
    if (['edit', 'user'].includes(active) && params.get('projectName')) storage.set(LAST_WORKSPACE, location.pathname + location.search);
    const mark = element('span', { class: `ai-brand-mark${BRAND.logoMark ? ' has-image' : ''}`, 'aria-hidden': 'true' }, [BRAND.product.charAt(0)]);
    if (BRAND.logoMark) mark.style.backgroundImage = `url("${BRAND.logoMark}")`;
    const brand = element('div', { class: 'ai-brand', role: 'img', 'aria-label': `${BRAND.product} ${BRAND.name}` }, [mark, element('span', { class: 'ai-brand-name' }, [element('b', {}, [BRAND.product]), ' ', element('em', {}, [BRAND.name])])]);
    const nav = element('nav', { class: 'ai-nav' }, ITEMS.map((item) => {
      const href = item.workspace ? (item.route === active ? location.pathname + location.search : item.workspace + lastQuery()) : item.href || '#';
      const link = element('a', { class: `ai-nav-item${item.route === active ? ' active' : ''}`, href, 'data-route': item.route, title: item.label }, [element('span', { class: 'ai-nav-icon', 'aria-hidden': 'true' }, [item.icon]), element('span', { class: 'ai-nav-label' }, [item.label])]);
      if (item.route === active) link.setAttribute('aria-current', 'page');
      if (!item.href) { link.setAttribute('aria-disabled', 'true'); link.addEventListener('click', (event) => event.preventDefault()); }
      return link;
    }));
    // Icon-only toggle; the label lives in aria-label and the tooltip.
    const collapse = element('button', { class: 'ai-collapse', type: 'button', 'aria-label': '메뉴 접기', title: '메뉴 접기', 'aria-expanded': 'true' }, [element('span', { class: 'ai-collapse-icon', 'aria-hidden': 'true' }, ['‹'])]);
    collapse.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('ai-sidebar-collapsed'), label = collapsed ? '메뉴 펼치기' : '메뉴 접기';
      collapse.setAttribute('aria-expanded', String(!collapsed));
      collapse.setAttribute('aria-label', label);
      collapse.title = label;
    });
    const sidebar = element('aside', { class: 'ai-sidebar', 'aria-label': `${BRAND.name} 메뉴`, 'data-active': active }, [brand, nav, collapse]);
    document.body.prepend(sidebar);
    return sidebar;
  }
  window.AiBuilderSidebar = { mount, ITEMS, BRAND, lastQuery };
})();
