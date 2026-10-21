(() => {
    if (window.previewNavigationReady)
        return;
    window.previewNavigationReady = true;
    const sites = { '3001': 'avenlo', '3002': 'orvian', '3012': 'tervix', '3014': 'nuvexa' };
    const site = /^\/render\/(avenlo|tervix|orvian|nuvexa)(?:\/|$)/.exec(location.pathname)?.[1] || sites[location.port];
    const slug = { avenlo: 'avenlo', tervix: 'tervix', orvian: 'orvian', nuvexa: 'nuvexa' }[site];
    if (!site)
        return;
    const editor = new URL(document.referrer || location.href).origin;
    function destination(link) {
        const raw = link.getAttribute('href');
        if (!raw || link.hasAttribute('download') || link.hasAttribute('data-local-demo') || raw.startsWith('data:'))
            return null;
        const currentPath = location.pathname.replace(new RegExp(`^/render/${slug}(?=/|$)`), '') || '/';
        const url = new URL(raw, new URL(currentPath, location.origin));
        const prefix = `/${slug}`;
        let pathname = url.pathname.replace(new RegExp(`^/(?:render|render-assets)/${slug}(?=/|$)`), '') || '/';
        while (pathname === prefix || pathname.startsWith(`${prefix}/`))
            pathname = pathname.slice(prefix.length) || '/';
        if (url.hash && (url.pathname === currentPath || url.pathname === location.pathname) && document.getElementById(decodeURIComponent(url.hash.slice(1)))) {
            link.setAttribute('href', url.hash);
            return null;
        }
        const label = (link.innerText || link.getAttribute('aria-label') || '').trim().toLowerCase();
        if (/register|login/.test(pathname))
            return pathname.includes('register') ? '/register' : '/login';
        if (/\/meet\//.test(pathname))
            return '/demo';
        if (/calendly|contact/.test(url.href))
            return '/contact';
        if (/workspace|claude|google.com/.test(url.hostname))
            return '/summary';
        if (/linkedin|x.com|ycombinator|cncf/.test(url.hostname))
            return '/about';
        if (/github/.test(url.hostname))
            return '/developers';
        if (/trust\.|g2.com/.test(url.hostname))
            return /g2/.test(url.hostname) ? '/customers' : '/security';
        if (/status\./.test(url.hostname))
            return '/status';
        if (/docs\./.test(url.hostname))
            return '/documentation' + (pathname === '/' ? '' : pathname);
        if (pathname === '/' && /hvac|electrical|building materials|building services|industrial supplies/.test(label))
            return '/industries/' + label.split(/\s{2,}|\n/)[0].replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
        return pathname === '/' ? '/' : '/' + pathname.split('/').filter(Boolean).map(part => encodeURIComponent(decodeURIComponent(part))).join('/');
    }
    function update() {
        // The local previews contain English content only.
        for (const picker of document.querySelectorAll<HTMLElement>('.lang, [data-framer-name="Language Switcher"]'))
            picker.remove();
        for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
            const original = destination(link);
            if (original === null)
                continue;
            const path = original.replaceAll(site, slug);
            link.dataset.previewPath = path;
            const href = `${editor}/${slug}${path === '/' ? '' : path}`;
            if (link.href !== href)
                link.href = href;
            link.target = '_top';
            link.removeAttribute('rel');
        }
    }
    function navigate(path) {
        if (window.parent === window)
            location.assign(`${editor}/${slug}${path === '/' ? '' : path}`);
        else
            window.parent.postMessage({ type: 'preview-navigate', path }, editor);
    }
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const link = target?.closest<HTMLAnchorElement>('a[data-preview-path]');
        if (link) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            navigate(link.dataset.previewPath);
            return;
        }
        const button = target?.closest<HTMLElement>('button');
        if (!button || button.closest<HTMLDialogElement>('dialog,[role="dialog"],[data-open-demo]'))
            return;
        const text = (button.innerText || button.getAttribute('aria-label') || '').trim();
        if (/^(watch|play the customer|introducing .*workflows|book a demo|new workflow|suggest workflows)/i.test(text)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            navigate(/book/i.test(text) ? '/contact' : '/demo');
        }
    }, true);
    document.addEventListener('submit', event => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.closest<HTMLElement>('[data-playground]') || form.hasAttribute('data-local-demo'))
            return;
        // Keep the workflow playground's existing local generation action.
        if (form.querySelector<HTMLTextAreaElement>('textarea') && site === 'tervix')
            return;
        if (!form.reportValidity())
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate('/contact');
    }, true);
    let queued = false;
    new MutationObserver(() => {
        if (queued)
            return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    update();
})();
