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
    if (element.matches('main [class~="transition-[flex]"] > .absolute.flex') && !element.hasAttribute('data-preview-readable-artwork')) {
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
function startGallery() {
    const cards = [...document.querySelectorAll<HTMLElement>('main [class~="transition-[flex]"]')];
    if (!cards.length) return;
    const row = cards[0].parentElement;
    const dots = [...row.nextElementSibling.querySelectorAll<HTMLButtonElement>('button')];
    if (dots.length !== cards.length) return;
    row.dataset.tervixGallery = '';
    row.dataset.previewAnimatedArtwork = '';
    row.nextElementSibling.setAttribute('role', 'tablist');
    row.nextElementSibling.setAttribute('aria-label', 'Work priorities');
    const dialog = document.createElement('dialog');
    dialog.className = 'tervix-gallery-dialog';
    dialog.dataset.previewAnimatedArtwork = '';
    dialog.setAttribute('aria-labelledby', 'tervix-gallery-heading');
    // Use the existing workspace close icon.
    dialog.innerHTML = '<button type="button" aria-label="Close gallery preview" title="Close gallery preview"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1"><path d="m5 5 10 10M5 15 15 5"/></svg></button><div class="tervix-gallery-image"></div><h2 id="tervix-gallery-heading"></h2><p></p>';
    document.body.append(dialog);
    const tooltip = (button: HTMLButtonElement, id: string) => {
        const tip = document.createElement('span');
        tip.id = id;
        tip.className = 'tervix-gallery-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.textContent = button.getAttribute('aria-label');
        button.setAttribute('aria-describedby', id);
        button.append(tip);
    };
    tooltip(dialog.querySelector('button'), 'tervix-gallery-close-tip');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let closing = false;
    const closePreview = async () => {
        if (closing || !dialog.open) return;
        closing = true;
        if (!reducedMotion.matches) {
            dialog.classList.add('is-closing');
            const style = getComputedStyle(dialog);
            await dialog.animate([{opacity:style.opacity,transform:style.transform},{opacity:0,transform:'translateY(8px) scale(.985)'}], {duration:160,easing:'ease-out'}).finished.catch(() => {});
        }
        dialog.close();
        dialog.classList.remove('is-closing');
        closing = false;
    };
    dialog.querySelector('button').addEventListener('click', closePreview);
    dialog.addEventListener('cancel', event => { event.preventDefault(); void closePreview(); });
    let selected = 0;
    const select = (index: number, reveal = true) => {
        selected = index;
        cards.forEach((card, position) => {
            const active = position === index;
            card.classList.toggle('flex-[3]', active);
            card.dataset.active = String(active);
            card.style.flex = active ? '3' : String(Math.max(.12, .52 - (Math.abs(index-position)-1)*.18));
            for (const overlay of card.querySelectorAll<HTMLElement>(':scope > .items-end,:scope > .items-center')) {
                const shown = overlay.classList.contains('items-center') ? !active : active;
                overlay.hidden = false;
                overlay.setAttribute('aria-hidden', String(!shown));
                overlay.inert = !shown;
            }
            for (const overlay of card.querySelectorAll<HTMLElement>(':scope > .items-end,:scope > .items-center,:scope > .top-3')) {
                const shown = overlay.classList.contains('items-center') ? !active : active;
                overlay.classList.toggle('opacity-100', shown);
                overlay.classList.toggle('opacity-0', !shown);
                overlay.classList.toggle('pointer-events-none', !shown);
            }
            const expand = card.querySelector<HTMLButtonElement>('button');
            expand.disabled = !active;
            dots[position].setAttribute('aria-selected', String(active));
            dots[position].tabIndex = active ? 0 : -1;
            dots[position].classList.toggle('bg-white', active);
            dots[position].classList.toggle('bg-white/30', !active);
            dots[position].classList.toggle('w-5', active);
            dots[position].classList.toggle('w-2', !active);
        });
        const card = cards[index], source = card.querySelector('img');
        const image = source.cloneNode(true) as HTMLImageElement;
        image.className = '';
        image.removeAttribute('style');
        image.style.backgroundImage = getComputedStyle(source).backgroundImage;
        dialog.querySelector('.tervix-gallery-image').replaceChildren(image);
        dialog.querySelector('h2').textContent = card.querySelector('h4').textContent;
        dialog.querySelector('p').textContent = card.querySelector('.items-end p').textContent;
        if (reveal && row.scrollWidth > row.clientWidth) {
            const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
            const left = cards.slice(0, index).reduce((sum, item) => sum + (parseFloat(getComputedStyle(item).minWidth) || item.offsetWidth) + gap, 0);
            row.scrollTo({left,behavior:reducedMotion.matches?'instant':'smooth'});
        }
    };
    cards.forEach((card, index) => {
        const label = card.querySelector('.items-center span').textContent.trim();
        card.id = `tervix-gallery-panel-${index}`;
        card.setAttribute('role', 'tabpanel');
        card.setAttribute('aria-labelledby', `tervix-gallery-tab-${index}`);
        dots[index].id = `tervix-gallery-tab-${index}`;
        dots[index].setAttribute('role', 'tab');
        dots[index].setAttribute('aria-controls', card.id);
        dots[index].setAttribute('aria-label', `Show ${label}`);
        dots[index].title = `Show ${label}`;
        tooltip(dots[index], `tervix-gallery-tab-tip-${index}`);
        dots[index].addEventListener('click', () => select(index));
        dots[index].addEventListener('keydown', event => {
            const next = {ArrowRight:(selected+1)%cards.length, ArrowLeft:(selected+cards.length-1)%cards.length, Home:0, End:cards.length-1}[event.key];
            if (next === undefined) return;
            event.preventDefault();
            select(next);
            dots[next].focus();
        });
        card.addEventListener('click', () => select(index));
        const expand = card.querySelector<HTMLButtonElement>('button');
        expand.setAttribute('aria-label', `Expand ${label}`);
        expand.title = `Expand ${label}`;
        tooltip(expand, `tervix-gallery-expand-tip-${index}`);
        expand.addEventListener('click', event => {
            event.stopPropagation();
            select(index, false);
            dialog.showModal();
        });
    });
    select(0, false);
}
function start() {
    sanitizeTree(document.body);
    sanitizeMetadata();
    startGallery();
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
