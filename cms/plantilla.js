// Los selectores y atributos proceden de la plantilla distribuida con el sitio.
const documents = new WeakMap();
const attrNames = new Set([
  'href', 'src', 'srcset', 'imagesrcset', 'poster', 'data-fallback', 'data-full', 'alt',
  'aria-label', 'title', 'placeholder', 'content', 'data-service', 'data-category',
  'data-filter', 'data-map', 'data-counter', 'data-suffix'
]);
const own = (object, key) => object != null && Object.hasOwn(object, key);

export function safeUrl(input, kind = 'url', base = document.baseURI) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (url.username || url.password) return null;
    if (url.protocol === 'https:' || url.protocol === 'http:') return value;
    if (kind === 'url' && (url.protocol === 'mailto:' || url.protocol === 'tel:')) return value;
  } catch {}
  return null;
}

export function validSrcset(value, base = document.baseURI) {
  if (typeof value !== 'string') return false;
  return !value.trim() || value.split(',').every(entry => {
    const [url, size, ...rest] = entry.trim().split(/\s+/);
    return !rest.length && safeUrl(url, 'image', base) &&
      (size === undefined || /^(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)x)$/.test(size));
  });
}

function templateNodes(root) {
  const nodes = new Map();
  if (root.nodeType === 1 && root.hasAttribute('data-x-node')) {
    nodes.set(root.getAttribute('data-x-node'), root);
  }
  for (const node of root.querySelectorAll('[data-x-node]')) {
    nodes.set(node.getAttribute('data-x-node'), node);
  }
  return nodes;
}

function recordAttribute(session, el, name, value) {
  const initial = el.getAttribute(name);
  if (initial === value) return;
  session.undo.push(() => initial === null ? el.removeAttribute(name) : el.setAttribute(name, initial));
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

function safeCssImage(value, doc) {
  const url = new URL(value, doc.baseURI).href.replace(/["\\]/g, char => encodeURIComponent(char));
  return 'url("' + url + '")';
}

function applyField(session, node, field, value) {
  if (typeof value !== 'string') return;
  const doc = node.ownerDocument;
  if (own(field, 'text')) {
    const part = [...node.childNodes].filter(child => child.nodeType === 3)[field.text];
    if (!part) return;
    const original = part.data;
    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    session.undo.push(() => { part.data = original; });
    part.data = leading + value + trailing;
    return;
  }
  if (field.css) {
    if (['--x-journey-caption', '--x-reminder-caption'].includes(field.css)) {
      recordAttribute(session, node, 'data-x-caption', value);
      return;
    }
    if (!['--brand-logo-image', '--destino-image'].includes(field.css)) return;
    const url = safeUrl(value, 'image', doc.baseURI);
    if (!url) return;
    const target = field.css === '--brand-logo-image' ? doc.documentElement : node;
    const prop = field.css;
    const previous = target.style.getPropertyValue(prop);
    const priority = target.style.getPropertyPriority(prop);
    session.undo.push(() => previous ? target.style.setProperty(prop, previous, priority) : target.style.removeProperty(prop));
    target.style.setProperty(prop, safeCssImage(url, doc));
    if (prop === '--brand-logo-image') recordAttribute(session, target, 'data-x-brand', '');
    return;
  }
  const attr = field.attr;
  if (!attrNames.has(attr)) return;
  if (['image', 'video', 'url'].includes(field.type)) {
    const safe = safeUrl(value, field.type, doc.baseURI);
    if (value.trim() && !safe) return;
    value = safe;
  } else if (field.type === 'srcset') {
    if (!validSrcset(value, doc.baseURI)) return;
    value = value.trim() || null;
  } else if (field.type === 'color' && !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) {
    return;
  } else if (['data-service','data-category','data-filter','data-map'].includes(attr) &&
             !/^[a-z\d_-]+$/i.test(value)) {
    return;
  } else if (attr === 'data-counter' && !/^\d{1,9}$/.test(value)) {
    return;
  }
  if (attr === 'src' && node.tagName === 'IMG' && value !== node.getAttribute('src')) {
    // Un recurso nuevo debe verse también en teléfonos con srcset o fallback.
    recordAttribute(session, node, 'srcset', null);
    recordAttribute(session, node, 'data-fallback', null);
  }
  if (attr === 'href' && node.tagName === 'LINK' && node.getAttribute('rel') === 'preload') {
    recordAttribute(session, node, 'imagesrcset', null);
  }
  if ((attr === 'src' && node.tagName === 'SOURCE') ||
      (attr === 'href' && node.tagName === 'LINK' && ['icon', 'preload'].includes(node.rel))) {
    recordAttribute(session, node, 'type', null);
  }
  recordAttribute(session, node, attr, value);
  if (attr === 'href' && (node.hasAttribute('data-section') || node.closest('#navLinks'))) {
    const link = value && new URL(value, doc.baseURI);
    const samePage = link && link.origin === doc.location.origin && link.pathname === doc.location.pathname;
    recordAttribute(session, node, 'data-section', samePage && link.hash ? link.hash.slice(1) : null);
  }
  if (attr === 'src' && node.tagName === 'SOURCE' && node.parentElement?.tagName === 'VIDEO') {
    session.videos.add(node.parentElement);
  }
}

function applyFields(session, fields, nodes, overrides, local) {
  for (const field of fields) {
    const values = own(local, field.id) ? local : overrides;
    if (!own(values, field.id)) continue;
    const node = nodes.get(field.node);
    if (node) applyField(session, node, field, values[field.id]);
  }
}

function initialSession(doc) {
  const style = doc.createElement('style');
  style.textContent = '[data-x-section][hidden]{display:none!important}' +
    '[data-x-caption].journey::after,[data-x-caption].cabana-reminder::after{content:attr(data-x-caption)!important}' +
    'html[data-x-brand] .legal-header .brand-mark{background-image:var(--brand-logo-image)}';
  doc.head.append(style);
  const collections = new Map();
  for (const holder of doc.querySelectorAll('[data-x-collection]')) {
    const originals = new Map();
    for (const child of holder.children) {
      if (child.hasAttribute('data-x-item')) originals.set(child.getAttribute('data-x-item'), child);
    }
    if (originals.size) {
      collections.set(holder.getAttribute('data-x-collection'), { originals, holder });
    }
  }
  return { baseNodes:templateNodes(doc), collections, undo:[], videos:new Set() };
}

function renderCollection(session, collection, settings, overrides) {
  const { originals, holder } = session.collections.get(collection.id);
  if (!Array.isArray(settings)) {
    for (const item of collection.items) applyFields(session, item.fields, session.baseNodes, overrides);
    return;
  }
  const doc = holder.ownerDocument;
  const marker = doc.createComment('cms');
  const originalNodes = [...originals.values()];
  holder.insertBefore(marker, originalNodes[0]);
  for (const original of originalNodes) original.remove();
  const sources = new Map(collection.items.map(item => [item.id, item]));
  const rendered = [];
  const used = new Set();
  const fragment = doc.createDocumentFragment();
  for (const row of settings) {
    if (!row || typeof row.id !== 'string' || !row.id || used.has(row.id)) continue;
    const source = sources.get(row.source || row.id);
    const original = source && originals.get(source.id);
    if (!original) continue;
    used.add(row.id);
    const el = original.cloneNode(true);
    el.setAttribute('data-x-item', row.id);
    applyFields(session, source.fields, templateNodes(el), overrides, row.values);
    rendered.push(el);
    fragment.appendChild(el);
  }
  marker.after(fragment);
  session.undo.push(() => {
    for (const el of rendered) el.remove();
    marker.replaceWith(...originalNodes);
  });
}

function applyOrder(session, doc, sections, requested, pageId) {
  if (!Array.isArray(requested)) {
    if (pageId !== 'inicio') return;
    requested = [];
  }
  const known = new Map(sections.filter(s => s.sortable).map(s => [s.id, s]));
  const available = new Map([...doc.querySelectorAll('[data-x-section]')].map(el => [el.getAttribute('data-x-section'), el]));
  const ordered = new Map();
  for (const item of requested) {
    if (item && known.has(item.id) && available.has(item.id) && !ordered.has(item.id)) ordered.set(item.id, item.visible !== false);
  }
  for (const id of known.keys()) if (available.has(id) && !ordered.has(id)) ordered.set(id, true);
  if (!ordered.size) return;
  const parent = available.get(ordered.keys().next().value).parentElement;
  const originals = [...parent.children].filter(el => ordered.has(el.getAttribute('data-x-section')));
  const marker = doc.createComment('cms');
  parent.insertBefore(marker, originals[0]);
  const fragment = doc.createDocumentFragment();
  let index = 0;
  for (const [id, visible] of ordered) {
    const el = available.get(id);
    if (el.parentElement !== parent) continue;
    recordAttribute(session, el, 'hidden', visible ? null : '');
    if (pageId === 'inicio') {
      const previous = el.style.order;
      session.undo.push(() => { el.style.order = previous; });
      el.style.order = String(++index);
    }
    fragment.appendChild(el);
  }
  marker.after(fragment);
  session.undo.push(() => marker.replaceWith(...originals));
}

export function applyTemplate(doc, catalog, state = {}, pageId = 'inicio') {
  const page = catalog.pages.find(page => page.id === pageId);
  if (!page) return;
  let session = documents.get(doc);
  if (!session) {
    session = initialSession(doc);
    documents.set(doc, session);
  }
  for (const restore of session.undo.reverse()) restore();
  session.undo.length = 0;
  session.videos.clear();
  for (const section of page.sections) {
    applyFields(session, section.fields, session.baseNodes, state?.values);
    for (const collection of section.collections) {
      if (session.collections.has(collection.id)) {
        renderCollection(session, collection, state?.collections?.[collection.id], state?.values);
      }
    }
  }
  applyOrder(session, doc, page.sections, state?.sections?.[pageId], pageId);
  for (const video of session.videos) if (video.isConnected) video.load();
}
