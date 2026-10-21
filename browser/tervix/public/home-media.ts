const comparisonPaths = new Map();
function localLink(value) {
    if (!value || value.startsWith('#'))
        return value;
    let url;
    try {
        url = new URL(value, location.origin);
    }
    catch {
        return value;
    }
    let path = url.pathname;
    const editorLink = url.port === '3000' && path.startsWith('/tervix');
    if (editorLink)
        path = path.slice('/tervix'.length) || '/';
    if (url.origin !== location.origin) {
        const host = url.hostname.toLowerCase();
        if (host.startsWith('docs.'))
            return path;
        if (host.startsWith('status.'))
            return '/status';
        if (host.startsWith('platform.'))
            return path === '/login' ? '/login' : '/register';
        if (host.startsWith('demo.'))
            return path;
        if (host.includes('calendly'))
            return '/contact';
        if (host.includes('github'))
            return '/developers';
        if (host.startsWith('www.') || host.includes('linkedin') || host.includes('youtube') || host.includes('x.com'))
            return '/about';
    }
    if (path.startsWith('/@'))
        path = '/about';
    if (path.startsWith('/compare/'))
        path = '/compare/' + (comparisonPaths.get(path.slice(9)) || path.slice(9));
    path = path.replace(/tervix/g, 'tervix');
    return (editorLink ? 'http://127.0.0.1:3000/tervix' : '') + path + url.search + url.hash;
}
function sanitizeElement(element) {
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
        const old = element.getAttribute(attribute);
        if (!old)
            continue;
        const next = old;
        if (next !== old)
            element.setAttribute(attribute, next);
    }
    if (element.matches('img:not([data-editor-gradient]):not([data-editor-icon]):not([data-editor-wordmark])')) {
        if (element.getAttribute('src') !== '/media-893f0f560686fc.png')
            element.setAttribute('src', '/media-893f0f560686fc.png');
        if (element.hasAttribute('srcset'))
            element.removeAttribute('srcset');
        if (element.hasAttribute('sizes'))
            element.removeAttribute('sizes');
        if (element.getAttribute('alt'))
            element.setAttribute('alt', '');
    }
    if (element.matches('a[href]')) {
        const old = element.getAttribute('href');
        const next = localLink(old);
        if (next !== old)
            element.setAttribute('href', next);
        if (element.getAttribute('target') === '_blank')
            element.removeAttribute('target');
    }
    if (element.matches('span.text-emerald-400') && element.textContent.trim() === '❯') {
        if (!element.classList.contains('tervix-readable-arrow'))
            element.classList.add('tervix-readable-arrow');
    }
    if (element.classList.contains('bg-zinc-900/60') && !element.hasAttribute('data-preview-readable-artwork')) {
        element.setAttribute('data-preview-readable-artwork', '');
    }
    if (element.matches('main > section:first-of-type .text-center.max-w-4xl') && !element.hasAttribute('data-preview-readable-artwork')) {
        element.setAttribute('data-preview-readable-artwork', '');
    }
    if (element.matches('main > section:first-of-type .flex.justify-center.mb-4') && !element.hasAttribute('data-preview-readable-artwork')) {
        element.setAttribute('data-preview-readable-artwork', '');
    }
    if (element.matches('main span.uppercase.tracking-widest'))
        element.setAttribute('data-home-hide', '');
    if (element.matches('span') && element.textContent.trim().startsWith('Backed by ')) {
        element.parentElement?.setAttribute('data-home-hide', '');
    }
    if (element.matches('p') && element.textContent.trim() === 'No credit card required · Onboard in seconds') {
        element.setAttribute('data-home-hide', '');
    }
}
function sanitizeMetadata() {
    const title = 'Tervix | A clearer way to run your work';
    document.title = title;
    for (const meta of document.head.querySelectorAll<HTMLElement>('meta[content]')) {
        const key = meta.getAttribute('property') || meta.getAttribute('name') || '';
        const content = meta.getAttribute('content') || '';
        if (key === 'og:title' || key === 'twitter:title')
            meta.setAttribute('content', title);
        else if (key === 'og:description' || key === 'twitter:description' || key === 'description')
            meta.setAttribute('content', 'Bring requests, decisions, and follow-up work into one shared view.');
        else if (key === 'og:url')
            meta.setAttribute('content', location.origin);
        else if (key === 'og:image' || key === 'twitter:image')
            meta.setAttribute('content', location.origin + '/media-893f0f560686fc.png');
        else if (key === 'og:image:alt')
            meta.setAttribute('content', 'A palette color gradient');
        else if (key === 'keywords')
            meta.setAttribute('content', 'team planning, shared work, decisions');
    }
    for (const link of document.head.querySelectorAll<HTMLElement>('link[rel="icon"],link[rel="canonical"]')) {
        if (link.getAttribute('rel') === 'canonical')
            link.setAttribute('href', location.origin);
        else
            link.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#88a995"/><circle cx="23" cy="10" r="12" fill="#6bb0c0" opacity=".8"/><circle cx="10" cy="25" r="11" fill="#d4a574" opacity=".7"/></svg>'));
    }
}
function sanitizeText(node) {
    if (!node.nodeValue)
        return;
    if (node.parentElement?.matches('h3.uppercase, h4.uppercase')) {
        const value = node.nodeValue.trim();
        if (value && value === value.toUpperCase()) {
            const next = value.charAt(0) + value.slice(1).toLowerCase();
            if (next !== node.nodeValue)
                node.nodeValue = next;
            return;
        }
    }
}
function sanitizeTree(root) {
    if (root.nodeType === Node.TEXT_NODE)
        return sanitizeText(root);
    if (root.nodeType !== Node.ELEMENT_NODE)
        return;
    sanitizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        if (walker.currentNode.nodeType === Node.TEXT_NODE)
            sanitizeText(walker.currentNode);
        else
            sanitizeElement(walker.currentNode);
    }
}
function start() {
    sanitizeTree(document.body);
    sanitizeMetadata();
    new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes')
                sanitizeElement(record.target);
            else if (record.type === 'characterData')
                sanitizeText(record.target);
            else
                for (const node of record.addedNodes)
                    sanitizeTree(node);
        }
    }).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'sizes', 'alt', 'href', 'target'],
    });
    document.documentElement.setAttribute('data-home-ready', 'true');
}
function afterLoad() { setTimeout(start, 500); }
if (document.readyState === 'complete')
    afterLoad();
else
    window.addEventListener('load', afterLoad, { once: true });
