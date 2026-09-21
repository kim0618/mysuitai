// AiBuilderSidebar: the single Sidebar used by every AI Builder screen. Only the active item changes per route.
(function () {
  const LAST_WORKSPACE = 'aiBuilder:lastWorkspace';
  const ITEMS = [
    { route: 'create', icon: '↥', label: '생성하기', href: '/ai-builder/import' },
    { route: 'edit', icon: '✎', label: '편집하기', href: '/ai-builder' },
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
  function mount({ active }) {
    if (active === 'edit' && /^\/ai-builder$/.test(location.pathname) && new URLSearchParams(location.search).get('projectName')) storage.set(LAST_WORKSPACE, location.pathname + location.search);
    const brand = element('div', { class: 'ai-brand' }, [element('span', { class: 'ai-brand-mark' }, ['M']), element('span', { class: 'ai-brand-name' }, [element('b', {}, ['MySuit']), ' AI Builder'])]);
    const nav = element('nav', { class: 'ai-nav' }, ITEMS.map((item) => {
      const href = item.route === 'edit' ? (active === 'edit' ? location.pathname + location.search : storage.get(LAST_WORKSPACE) || item.href) : item.href || '#';
      const link = element('a', { class: `ai-nav-item${item.route === active ? ' active' : ''}`, href, 'data-route': item.route }, [element('span', { class: 'ai-nav-icon', 'aria-hidden': 'true' }, [item.icon]), element('span', { class: 'ai-nav-label' }, [item.label])]);
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
    const sidebar = element('aside', { class: 'ai-sidebar', 'aria-label': 'AI Builder 메뉴', 'data-active': active }, [brand, nav, collapse]);
    document.body.prepend(sidebar);
    return sidebar;
  }
  window.AiBuilderSidebar = { mount, ITEMS };
})();
