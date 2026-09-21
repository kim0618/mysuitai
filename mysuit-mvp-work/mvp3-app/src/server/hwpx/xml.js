const { hwpxError } = require('./hwpx-errors');

function decode(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function localName(name) { return name.includes(':') ? name.slice(name.indexOf(':') + 1) : name; }

function parseXml(source, part = '<xml>') {
  try {
    const root = { name: '#document', local: '#document', attrs: {}, children: [], text: '' };
    const stack = [root];
    const tokens = String(source).replace(/^\uFEFF/, '').match(/<!--[\s\S]*?-->|<\?[^>]*\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<[^>]+>|[^<]+/g) || [];
    for (const token of tokens) {
      if (token.startsWith('<!--') || token.startsWith('<?') || (token.startsWith('<!') && !token.startsWith('<![CDATA['))) continue;
      if (token.startsWith('<![CDATA[')) { stack.at(-1).text += token.slice(9, -3); continue; }
      if (!token.startsWith('<')) { stack.at(-1).text += decode(token); continue; }
      if (token.startsWith('</')) {
        const name = token.slice(2, -1).trim();
        if (stack.length === 1 || stack.at(-1).name !== name) throw new Error(`mismatched closing tag ${name}`);
        stack.pop(); continue;
      }
      const selfClosing = /\/\s*>$/.test(token), body = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trim();
      const match = body.match(/^([^\s]+)([\s\S]*)$/); if (!match) throw new Error('empty tag');
      const node = { name: match[1], local: localName(match[1]), attrs: {}, children: [], text: '' };
      const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let attr;
      while ((attr = attrRe.exec(match[2]))) node.attrs[localName(attr[1])] = decode(attr[3] ?? attr[4]);
      stack.at(-1).children.push(node); if (!selfClosing) stack.push(node);
    }
    if (stack.length !== 1 || root.children.length !== 1) throw new Error('unclosed or missing document element');
    return root.children[0];
  } catch (error) { throw hwpxError('HWPX_XML_PARSE_FAILED', `HWPX XML을 파싱할 수 없습니다: ${part}`, { part, cause: error.message }); }
}

function children(node, name) { return (node?.children || []).filter((x) => x.local === name); }
function descendants(node, name) { const out = []; for (const child of node?.children || []) { if (!name || child.local === name) out.push(child); out.push(...descendants(child, name)); } return out; }
function first(node, name) { return descendants(node, name)[0] || null; }
function textContent(node) { return `${node?.text || ''}${(node?.children || []).map(textContent).join('')}`; }
function attr(node, name, fallback = undefined) { return node?.attrs?.[name] ?? fallback; }

module.exports = { parseXml, localName, children, descendants, first, textContent, attr };
