(async () => {
    const editorOrigin = new URL(document.referrer || location.href).origin;
    const site = /^\/render\/(avenlo|tervix|orvian|nuvexa)(?:\/|$)/.exec(location.pathname)?.[1] || ({ "3001": "avenlo", "3012": "tervix", "3002": "orvian", "3014": "nuvexa" })[location.port];
    if (!site)
        return;
    const brand = { avenlo: "Avenlo", tervix: "Tervix", orvian: "Orvian", nuvexa: "Nuvexa" }[site];
    let mediaPalette;
    const rename = (value: string, _prose?: boolean) => value;
    const updateWordmarks = () => {
        const selector = { avenlo: ".nav__logo img, .footer__brand img", orvian: "img[alt='Orvian'], img[alt='Logo'], img[data-editor-wordmark]", tervix: "img[alt='Tervix']", nuvexa: "img[alt='Nuvexa']" }[site];
        if (!selector)
            return;
        for (const image of document.querySelectorAll<HTMLImageElement>(selector)) {
            const compact = image.getBoundingClientRect().width < 50;
            // Use the surface token so an image does not freeze a color transition mid-frame.
            const parentStyle = getComputedStyle(image.parentElement);
            const color = parentStyle.getPropertyValue("--p-surface-text").trim() || mediaPalette?.text || (site === "nuvexa" ? "#1d1d1b" : parentStyle.color);
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${compact ? 32 : 140} 34"><text x="0" y="28" fill="${color}" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="-1">${compact ? brand[0] : brand}</text></svg>`;
            const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
            image.dataset.editorWordmark = "true";
            if (image.alt !== brand)
                image.alt = brand;
            image.removeAttribute("srcset");
            image.removeAttribute("sizes");
            const signature = `${brand}|${compact}|${color}`;
            if (image.dataset.editorWordmarkSignature !== signature) {
                image.dataset.editorWordmarkSignature = signature;
                image.src = src;
            }
        }
    };
    const updateBrand = () => {
        const pageUrl = `${editorOrigin}/${site}${location.pathname.replace(new RegExp(`^/render/${site}`), "")}`;
        for (const element of document.querySelectorAll<HTMLElement>('link[rel="canonical"], meta[property="og:url"], meta[name="twitter:url"]')) {
            const attribute = element.tagName === "LINK" ? "href" : "content";
            if (element.getAttribute(attribute) !== pageUrl)
                element.setAttribute(attribute, pageUrl);
        }
        const title = rename(document.title);
        if (title !== document.title)
            document.title = title;
        for (const meta of document.querySelectorAll<HTMLElement>("meta[content]")) {
            const value = meta.getAttribute("content");
            if (value && !/^https?:/i.test(value)) {
                const next = rename(value);
                if (next !== value)
                    meta.setAttribute("content", next);
            }
        }
        for (const element of document.querySelectorAll<HTMLElement>("[alt], [aria-label], [title], [placeholder]")) {
            for (const attribute of ["alt", "aria-label", "title", "placeholder"]) {
                const value = element.getAttribute(attribute);
                if (value) {
                    const next = rename(value);
                    if (next !== value)
                        element.setAttribute(attribute, next);
                }
            }
        }
        if (site === 'nuvexa') {
            // The source animation splits the headline into words after page load.
            for (const heading of document.querySelectorAll<HTMLElement>('h1')) {
                const words = { new: 'clearer', sales: 'path', standard: 'forward', technical: 'your', 'suppliers.': 'business.' };
                const headline = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
                let word;
                while ((word = headline.nextNode())) {
                    const key = word.nodeValue.trim();
                    if (Object.hasOwn(words, key))
                        word.nodeValue = word.nodeValue.replace(key, words[key]);
                }
            }
        }
        for (const input of document.querySelectorAll<HTMLTextAreaElement>('textarea')) {
            const next = rename(input.value);
            if (next !== input.value && document.activeElement !== input) {
                Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, next);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (node.parentElement?.closest("script, style, noscript, template"))
                continue;
            const next = rename(node.nodeValue, !node.parentElement?.closest("pre, code"));
            if (next !== node.nodeValue) {
                node.nodeValue = next;
                node.parentElement.dataset.businessCopy = 'true';
                if (site === 'nuvexa')
                    node.parentElement.dataset.nuvexaCopy = 'true';
            }
        }
        updateWordmarks();
        document.documentElement.dataset.editorBrand = brand;
        document.documentElement.dataset.editorSite = site;
    };
    const startBrand = () => {
        const touchStyle = document.createElement('link');
        touchStyle.rel = 'stylesheet';
        touchStyle.href = `${editorOrigin}/mobile-preview.css`;
        touchStyle.dataset.mobilePreview = 'true';
        document.head.append(touchStyle);
        const copyStyle = document.createElement('style');
        copyStyle.textContent = '[data-business-copy]{text-transform:none!important}' + (site === 'avenlo' ? '.hero__typed{background-size:100% 100%!important}' : '') + (site === 'tervix' ? 'html,body{overflow-x:clip}' : '');
        document.head.append(copyStyle);
        document.documentElement.dataset.copyReady = 'true';
        const navigation = document.createElement("script");
        navigation.src = `${editorOrigin}/preview-navigation.js`;
        document.head.append(navigation);
        let queued = false;
        new MutationObserver(() => {
            if (queued)
                return;
            queued = true;
            queueMicrotask(() => { queued = false; updateBrand(); });
        }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["alt", "aria-label", "title", "placeholder", "content", "href"] });
        updateBrand();
    };
    const startAfterLoad = () => {
        if (site !== "tervix" || document.documentElement.dataset.staticSourcePage === "true")
            return startBrand();
        // shortcut: this copied React page uses a fiber marker; revisit this wait if its runtime changes.
        const deadline = Date.now() + 5000;
        const waitForReact = () => {
            if (Object.keys(document.documentElement).some((key) => key.startsWith("__reactFiber$")) || Date.now() > deadline) {
                requestAnimationFrame(() => requestAnimationFrame(startBrand));
            }
            else
                setTimeout(waitForReact, 50);
        };
        waitForReact();
    };
    if (document.readyState === "complete")
        startAfterLoad();
    else
        window.addEventListener("load", startAfterLoad, { once: true });
    if (window.parent === window)
        return;
    const contrastScript = document.createElement("script");
    contrastScript.type = "module";
    contrastScript.src = `${editorOrigin}/preview-contrast.js`;
    document.head.append(contrastScript);
    const { fonts } = await import(`${editorOrigin}/font-catalog.js`);
    const fontStyles = document.createElement("link");
    fontStyles.rel = "stylesheet";
    fontStyles.href = `${editorOrigin}/fonts/fonts.css`;
    fontStyles.dataset.previewFonts = "true";
    document.head.append(fontStyles);
    const roles = ["text", "background", "primary", "secondary", "accent"];
    const root = document.documentElement;
    const style = document.createElement("style");
    style.textContent = `
    html[data-editor-site] { height: 100%; overflow-y: auto; }
    html[data-editor-site] body { height: auto; min-height: 100%; overflow: visible; }
    html[data-editor-palette="true"], html[data-editor-palette="true"] body { background-color: var(--p-background) !important; color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-site="tervix"] { --background: var(--p-background); --background-deep: color-mix(in srgb,var(--p-background) 85%,black); --foreground: var(--p-on-background); --foreground-muted: color-mix(in srgb,var(--p-on-background) 65%,var(--p-background)); --accent-sage: var(--p-primary); --accent-cyan: var(--p-secondary); --accent-warm: var(--p-accent); }
    html[data-editor-palette="true"][data-editor-site="avenlo"] { --text-primary: var(--p-text); --text-secondary: color-mix(in srgb,var(--p-text) 60%,var(--p-background)); --text-highlight: var(--p-accent); --bg-white: var(--p-background); --bg-beige: var(--p-secondary); --accent-coral: var(--p-primary); --bg-gradient-warm-start: var(--p-primary); --bg-gradient-warm-end: var(--p-accent); }
    html[data-editor-site="avenlo"] { --gradient-text: linear-gradient(90deg, color-mix(in srgb, var(--p-primary) 55%, var(--p-text)), color-mix(in srgb, var(--p-accent) 55%, var(--p-text))); }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="avenlo"] header.nav { background: var(--p-background) !important; color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="avenlo"] header.nav :is(.nav__link,.nav__links>a) { color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="avenlo"] header.nav .nav__logo img { filter: none; }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="avenlo"] header.nav .nav__cta { background: var(--p-text) !important; color: var(--p-background) !important; }
    html[data-editor-palette="true"][data-editor-site="avenlo"] .shader-btn { background: var(--p-primary) !important; color: var(--p-on-primary) !important; }
    html[data-editor-palette="true"][data-editor-site="avenlo"] .shader-btn__label { color: inherit !important; }
    html[data-editor-palette="true"][data-editor-site="avenlo"] .shader-btn::after { background: none !important; }
    html[data-editor-palette="true"][data-editor-site="avenlo"] :is(.shader-btn__fallback,.shader-btn__canvas) { visibility: hidden !important; }
    html[data-editor-site="avenlo"] [data-editor-proof] { background-size: cover !important; background-position: center !important; border: 0 !important; }
    html[data-editor-site="avenlo"] .hero__yc[data-editor-proof] { width: 193px; height: 32px; border-radius: 999px; }
    html[data-editor-site="avenlo"] .g2[data-editor-proof] { display: block; width: 140px; height: 18px; border-radius: 999px; }
    html[data-editor-site="avenlo"] .footer__yc[data-editor-proof] { display: block; width: 180px; height: 17px; border-radius: 999px; }
    html[data-editor-site="avenlo"] .shader-mark[data-editor-proof] { width: 44px; height: 44px; border-radius: 14px; }
    html[data-editor-site="avenlo"] .quote__cell[data-editor-proof] { min-height: 280px; border-radius: 20px; }
    html[data-editor-site="avenlo"] .stat[data-editor-proof] { min-height: 120px; border-radius: 18px; }
    html[data-editor-site="avenlo"] .job__check { background: color-mix(in srgb, var(--p-primary) 28%, var(--p-background)) !important; color: var(--p-text) !important; }
    html[data-editor-site="avenlo"] .link-arrow { color: var(--p-primary) !important; }
    html[data-editor-site="avenlo"][data-editor-light="false"] .link-arrow { color: color-mix(in srgb, var(--p-primary) 55%, var(--p-text)) !important; }
    html[data-editor-site="avenlo"] .editor-proof-gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: 100%; max-width: 1198px; box-sizing: border-box; margin: auto; padding: 32px 40px; }
    html[data-editor-site="avenlo"] .editor-proof-gallery [data-editor-proof] { height: 430px; border-radius: 18px; }
    @media (max-width: 700px) { html[data-editor-site="avenlo"] .editor-proof-gallery { grid-template-columns: 1fr; padding: 24px; } html[data-editor-site="avenlo"] .editor-proof-gallery [data-editor-proof] { height: 220px; } html[data-editor-site="avenlo"] .quote__cell[data-editor-proof] { min-height: 180px; } }
    html[data-editor-palette="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 > .absolute.inset-0 > .bg-gradient-to-b { background: var(--p-background) !important; }
    html[data-editor-site="tervix"] .bg-white.min-h-0.overflow-hidden { background: var(--p-background) !important; }
    html[data-editor-site="tervix"] .bg-white.min-h-0.overflow-hidden :is([class~="text-gray-900"],[class~="text-gray-700"],[class~="text-gray-400"]) { color: var(--p-on-background) !important; }
    html[data-editor-site="tervix"] .bg-white.min-h-0.overflow-hidden .bg-red-50 { background: var(--p-primary) !important; color: var(--p-on-primary) !important; }
    html[data-editor-site="tervix"] .whitespace-pre .text-gray-100 { color: var(--p-on-background) !important; }
    html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 h1, html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 h1 *, html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 h1 ~ p, html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 h1 + p + div > :last-child { color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 .text-center.max-w-4xl > div:first-child { color: var(--p-text) !important; background: color-mix(in srgb,var(--p-text) 10%,var(--p-background)) !important; }
    html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 .text-center.max-w-4xl > div:first-child *, html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 .flex.justify-center.mb-4 button { color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-light="true"][data-editor-site="tervix"] main > section:first-child .rounded-2xl.mt-4 .flex.justify-center.mb-4 button .bg-white { background-color: var(--p-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] { --p-surface-text: var(--p-on-background,var(--p-text)); --background: var(--p-background); --foreground: var(--p-surface-text); --color-coral: var(--p-primary); --color-amber-500: var(--p-accent); }
    html[data-editor-palette="true"][data-editor-site="orvian"] body { color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] .bg-stone-900 { --p-surface-text: var(--p-on-background,var(--p-text)); background-color: var(--p-background) !important; background-image: none !important; color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] :is(.bg-stone-800,.bg-stone-700,[class~="bg-stone-600/25"],[class~="bg-stone-700/50"]) { --p-surface-text: var(--p-on-secondary,var(--p-text)); background-color: var(--p-secondary) !important; color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] :is(.text-stone-100,.text-stone-50,.text-stone-200,.text-stone-300,.text-stone-400,.text-coral,.text-peach) { color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] :is([class*="grid1.svg"],[class*="grid2.svg"]) { --p-surface-text: var(--p-on-background,var(--p-text)); background: var(--p-background) !important; color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] nav { --p-surface-text: var(--p-on-secondary,var(--p-text)); background-color: var(--p-secondary) !important; color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] nav :is(a,button) { color: var(--p-surface-text) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] [data-open-demo] { --p-surface-text: var(--p-on-primary,var(--p-text)); color: var(--p-surface-text) !important; background-image: none !important; background-color: var(--p-primary) !important; }
    html[data-editor-palette="true"][data-editor-site="orvian"] [data-scene] { background: var(--p-background) !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] :is(.mh-header,#hero-dark) { background: var(--p-background) !important; }
    html[data-editor-site="nuvexa"] .mh-header a:has(img[data-editor-wordmark]) { filter: none !important; }
    html[data-editor-site="nuvexa"] [data-framer-name="Eyebrow"] { display: none !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] :is([data-framer-name="Hero Background Video"],#hero-dark > [data-framer-name="Image Overlay"]) { background: none !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] { --token-191a909c-39a6-4338-a0c0-e8ded1c807a1: var(--p-background); --token-342d9927-e734-41b4-ab8a-084d58f25db1: var(--p-secondary); --token-40cb148b-bccc-4fdf-9c63-df9e44ae9fdc: var(--p-text); --token-578e4386-7d5c-4bb3-8976-d6f23303e340: var(--p-primary); --token-85e5e52d-e014-4a75-a577-73d2c96330ac: var(--p-accent); }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] #hero-dark video { filter: brightness(.48) saturate(.8); }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] [data-framer-name="Site Navigation"] { background: var(--p-background) !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] body:has(#hero-dark) .mh-header .framer-text { color: var(--p-on-background) !important; --framer-text-color: var(--p-on-background) !important; transition-property: none !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] body:has(#hero-dark) .mh-header:not(.mh-solid) [data-framer-name="Book a Demo"] .framer-text { color: var(--p-on-primary) !important; --framer-text-color: var(--p-on-primary) !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] .mh-header [data-framer-name="Distributors Panel"] *, html[data-editor-palette="true"][data-editor-site="nuvexa"] .mh-header [data-framer-name="Mobile Menu"] * { color: var(--p-on-background) !important; transition-property: none !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] body:has(#hero-dark) .mh-header [data-framer-name="Mobile Menu"] [data-framer-name="Book a Demo"] * { color: var(--p-on-primary) !important; }
    html[data-editor-palette="true"][data-editor-site="nuvexa"] .mh-header [data-framer-name="Menu Label"] p { color: var(--p-on-background) !important; transition-property: none !important; }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] [data-framer-root] > :is(div,section):not(:first-child), html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] footer { background: var(--p-background) !important; }
    html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] [data-framer-root] > :is(div,section):not(:first-child) :is(h1,h2,h3,p,span,a), html[data-editor-palette="true"][data-editor-light="false"][data-editor-site="nuvexa"] footer :is(h1,h2,h3,p,span,a) { color: var(--p-text) !important; }
  `;
    document.head.append(style);
    root.dataset.editorSite = site;
    const sourceColors = {
        avenlo: { text: "#0c0a09", background: "#ffffff", primary: "#ff6467", secondary: "#fbf9f5", accent: "#db4f51" },
        tervix: { text: "#ededec", background: "#0a0a0a", primary: "#7a9e7e", secondary: "#6bb0c0", accent: "#d4a574" },
        orvian: { text: "#d6d6d6", background: "#161010", primary: "#e95863", secondary: "#262323", accent: "#f6a767" },
        nuvexa: { text: "#1d1d1b", background: "#ffffff", primary: "#ff4f21", secondary: "#eeede6", accent: "#66c2ea" },
    }[site];
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
    const colorPattern = /rgba?\([^()]*\/\s*var\([^()]*\)\s*\)|#[\da-f]{3,8}\b|(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\([^()]*\)|\b(?:white|black)\b/gi;
    const rgb = (value) => {
        colorContext.clearRect(0, 0, 1, 1);
        colorContext.fillStyle = "#010203";
        colorContext.fillStyle = value;
        if (colorContext.fillStyle === "#010203" && value !== "#010203")
            return null;
        colorContext.fillRect(0, 0, 1, 1);
        return [...colorContext.getImageData(0, 0, 1, 1).data];
    };
    const bases = Object.fromEntries(Object.entries(sourceColors).map(([role, value]) => [role, rgb(value)]));
    const lightness = ([red, green, blue]: number[]) => .2126 * red + .7152 * green + .0722 * blue;
    const colorToken = (value) => {
        const opacity = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*(var\([^()]*\))\s*\)$/i);
        if (opacity)
            return `color-mix(in srgb, ${colorToken(`rgb(${opacity[1]}, ${opacity[2]}, ${opacity[3]})`)} calc(${opacity[4]} * 100%), transparent)`;
        const channels = rgb(value);
        if (!channels)
            return value;
        const distance = (other) => Math.hypot(...channels.slice(0, 3).map((channel, index) => channel - other[index]));
        const nearest = Object.keys(bases).sort((a, b) => distance(bases[a]) - distance(bases[b]))[0];
        const neutral = Math.max(...channels.slice(0, 3)) - Math.min(...channels.slice(0, 3)) <= 2;
        let token;
        // Gray dividers must not become a nearby colored surface.
        if (distance(bases[nearest]) < 28 && (!neutral || nearest === "text" || nearest === "background"))
            token = `var(--p-${nearest})`;
        else if (Math.max(...channels.slice(0, 3)) - Math.min(...channels.slice(0, 3)) > 32) {
            const role = ["primary", "secondary", "accent"].sort((a, b) => distance(bases[a]) - distance(bases[b]))[0];
            token = `var(--p-${role})`;
        }
        else {
            const amount = Math.max(0, Math.min(100, Math.round(100 * (lightness(channels) - lightness(bases.background)) / (lightness(bases.text) - lightness(bases.background)))));
            token = `color-mix(in srgb, var(--p-text) ${amount}%, var(--p-background))`;
        }
        return channels[3] === 255 ? token : `color-mix(in srgb, ${token} ${Math.round(channels[3] / 255 * 100)}%, transparent)`;
    };
    const recolorDeclarations = (declarations, preserveForeground = false) => {
        for (const property of new Set([...declarations, "border-color", "border", "border-top", "border-right", "border-bottom", "border-left"])) {
            // Palette inputs and resolved foregrounds must not be mapped back to themselves.
            if (/^--(?:p-|preview-)/.test(property) || (preserveForeground && property === "color"))
                continue;
            if (!/color|background|border|fill|stroke|shadow|^--/.test(property))
                continue;
            const value = declarations.getPropertyValue(property);
            if (!value || value.includes("url(") || !colorPattern.test(value)) {
                colorPattern.lastIndex = 0;
                continue;
            }
            colorPattern.lastIndex = 0;
            const next = value.replace(colorPattern, colorToken);
            if (next !== value)
                declarations.setProperty(property, next, declarations.getPropertyPriority(property));
        }
    };
    const processedSheets = new WeakMap();
    const recolorSheets = () => {
        const visit = (rules) => {
            for (const rule of rules) {
                try {
                    if (rule.style)
                        recolorDeclarations(rule.style);
                }
                catch { /* Keep the remaining rules available. */ }
                try {
                    if (rule.cssRules)
                        visit(rule.cssRules);
                }
                catch { /* A nested sheet can be read-only. */ }
            }
        };
        for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
            if (sheet === style.sheet)
                continue;
            try {
                const rules = sheet.cssRules;
                if (processedSheets.get(sheet) === rules.length)
                    continue;
                visit(rules);
                processedSheets.set(sheet, rules.length);
            }
            catch { /* A remote stylesheet is read-only. */ }
        }
    };
    const recolorElements = (element) => {
        if (element.nodeType !== 1)
            return;
        for (const node of [element, ...element.querySelectorAll("[style], [fill], [stroke], [stop-color], [flood-color], a, button, svg")]) {
            if (node.hasAttribute("style"))
                recolorDeclarations(node.style, node.hasAttribute("data-preview-foreground"));
            if (site === "nuvexa" && node.tagName === "A" && getComputedStyle(node).color === "rgb(0, 0, 238)")
                node.style.color = "var(--p-primary)";
            if (site === "nuvexa" && node.tagName === "BUTTON" && getComputedStyle(node).color === "rgb(0, 0, 0)")
                node.style.color = "var(--p-text)";
            if (site === "nuvexa" && node.matches('.mh-header [data-framer-name="Menu Label"] p') && node.style.getPropertyValue("color") !== "var(--p-on-background)")
                node.style.setProperty("color", "var(--p-on-background)", "important");
            if (node.tagName.toLowerCase() === "svg" && !node.hasAttribute("fill") && getComputedStyle(node).fill === "rgb(0, 0, 0)")
                node.style.fill = "var(--p-text)";
            for (const property of ["fill", "stroke", "stop-color", "flood-color"]) {
                if (node.hasAttribute("data-preview-foreground"))
                    continue;
                const value = node.getAttribute(property);
                if (value && value !== "none" && value !== "currentColor" && !value.startsWith("url(")) {
                    const next = value.startsWith("var(") ? value.replace(colorPattern, colorToken) : colorToken(value);
                    colorPattern.lastIndex = 0;
                    if (next !== value && node.style.getPropertyValue(property) !== next)
                        node.style.setProperty(property, next);
                }
            }
        }
    };
    let recolorQueued = false;
    const recolorPage = () => {
        recolorSheets();
        recolorElements(document.body);
    };
    new MutationObserver((records) => {
        if (!mediaPalette || recolorQueued)
            return;
        recolorQueued = true;
        requestAnimationFrame(() => {
            recolorQueued = false;
            recolorSheets();
            for (const record of records) {
                if (record.type === "attributes")
                    recolorElements(record.target);
                else
                    for (const node of record.addedNodes)
                        recolorElements(node);
            }
        });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "fill", "stroke", "stop-color", "flood-color"] });
    document.addEventListener("load", (event) => {
        if (event.target instanceof HTMLLinkElement && event.target.rel === "stylesheet")
            recolorSheets();
    }, true);
    // Feral UI's Flow export embeds pixels. Draw the same soft-gradient idea as SVG so palette edits can recolor it.
    let nextMediaId = 0;
    let mediaQueued = false;
    const gradient = (id) => {
        const { background, primary, secondary, accent } = mediaPalette;
        const positions = [[18, 24, 77, 77], [78, 18, 24, 76], [43, 82, 82, 27], [72, 72, 18, 20]][id % 4];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none"><defs><linearGradient id="base" x2="1" y2="1"><stop stop-color="${secondary}"/><stop offset="1" stop-color="${background}"/></linearGradient><radialGradient id="a"><stop stop-color="${primary}" stop-opacity=".92"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></radialGradient><radialGradient id="b"><stop stop-color="${accent}" stop-opacity=".83"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient><radialGradient id="c"><stop stop-color="${secondary}" stop-opacity=".9"/><stop offset="1" stop-color="${secondary}" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="800" fill="url(#base)"/><ellipse cx="${positions[0] * 12}" cy="${positions[1] * 8}" rx="700" ry="490" fill="url(#a)"/><ellipse cx="${positions[2] * 12}" cy="${positions[3] * 8}" rx="690" ry="530" fill="url(#b)"/><ellipse cx="630" cy="430" rx="660" ry="450" fill="url(#c)" opacity=".68"/></svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };
    const mediaId = (element) => {
        if (!element.dataset.editorGradient)
            element.dataset.editorGradient = String(++nextMediaId);
        return Number(element.dataset.editorGradient);
    };
    const updateAvenloProof = () => {
        if (site !== "avenlo")
            return;
        for (const element of document.querySelectorAll<HTMLElement>(".hero__yc, .g2, .footer__yc, .shader-mark, .quote__cell, .stats .stat, .job__art, .vcall .step__art")) {
            if (!element.dataset.editorProof) {
                element.replaceChildren();
                element.removeAttribute("href");
                element.removeAttribute("target");
                element.removeAttribute("data-shader-mark");
                element.setAttribute("aria-hidden", "true");
                element.dataset.editorProof = "true";
            }
            element.style.backgroundImage = `url("${gradient(mediaId(element))}")`;
        }
        for (const image of document.querySelectorAll<HTMLImageElement>(".job__check img, .link-arrow img")) {
            const check = image.parentElement.classList.contains("job__check");
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            svg.setAttribute("viewBox", "0 0 14 14");
            svg.setAttribute("width", "14");
            svg.setAttribute("height", "14");
            svg.setAttribute("fill", "none");
            svg.setAttribute("aria-hidden", "true");
            path.setAttribute("d", check ? "M11.67 3.5 5.25 9.92 2.33 7" : "M2.92 7h8.16M7 11.08 11.08 7 7 2.92");
            path.setAttribute("stroke", "currentColor");
            path.setAttribute("stroke-width", check ? "1.5" : "1.2");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            svg.append(path);
            image.replaceWith(svg);
        }
        const testimonials = document.querySelector<HTMLElement>(".htes");
        if (testimonials && !testimonials.dataset.editorProofGallery) {
            const gallery = document.createElement("div");
            gallery.className = "editor-proof-gallery";
            gallery.setAttribute("aria-hidden", "true");
            for (let index = 0; index < 3; index++) {
                const tile = document.createElement("div");
                tile.dataset.editorProof = "true";
                gallery.append(tile);
            }
            testimonials.replaceChildren(gallery);
            testimonials.removeAttribute("aria-labelledby");
            testimonials.setAttribute("aria-hidden", "true");
            testimonials.dataset.editorProofGallery = "true";
        }
        for (const tile of document.querySelectorAll<HTMLElement>(".editor-proof-gallery [data-editor-proof]")) {
            tile.style.backgroundImage = `url("${gradient(mediaId(tile))}")`;
        }
        for (const image of document.querySelectorAll<HTMLImageElement>(".logos img, .quote__logo img, .hcrm__logo, .hsec__badges img, .footer__badges img")) {
            image.alt = "";
            if (image.closest<HTMLElement>(".hsec__badges, .footer__badges")) {
                const url = gradient(mediaId(image));
                if (image.getAttribute("src") !== url)
                    image.src = url;
            }
        }
        for (const link of document.querySelectorAll<HTMLElement>(".logos a")) {
            const placeholder = document.createElement("span");
            placeholder.className = link.className;
            placeholder.append(...link.childNodes);
            link.replaceWith(placeholder);
        }
        for (const tag of document.querySelectorAll<HTMLElement>(".logos__tag"))
            tag.remove();
        document.querySelector<HTMLElement>(".trusted__by")?.remove();
        document.querySelector<HTMLElement>(".trusted")?.setAttribute("aria-hidden", "true");
    };
    const updateMedia = () => {
        if (!mediaPalette)
            return;
        updateAvenloProof();
        for (const image of document.images) {
            if (image.dataset.editorWordmark)
                continue;
            if (image.dataset.editorIcon) {
                if (image.dataset.editorIcon === "tile")
                    image.style.backgroundImage = `url("${gradient(mediaId(image))}")`;
                continue;
            }
            const box = image.getBoundingClientRect();
            const width = box.width || image.width || image.naturalWidth;
            const height = box.height || image.height || image.naturalHeight;
            if (!image.dataset.editorGradient && (width < 60 || height < 20)) {
                const source = image.currentSrc || image.src;
                if (!source || source.startsWith("data:"))
                    continue;
                const svg = /\.svg(?:\?|$)/i.test(source);
                const naturalWidth = image.naturalWidth || Math.max(1, Math.round(width));
                const naturalHeight = image.naturalHeight || Math.max(1, Math.round(height));
                const blank = `<svg xmlns="http://www.w3.org/2000/svg" width="${naturalWidth}" height="${naturalHeight}"/>`;
                image.dataset.editorIcon = svg ? "mask" : "tile";
                image.removeAttribute("srcset");
                if (image.parentElement?.tagName === "PICTURE")
                    for (const option of image.parentElement.querySelectorAll<HTMLElement>("source"))
                        option.removeAttribute("srcset");
                if (svg) {
                    image.style.mask = `url("${source}") center / contain no-repeat`;
                    image.style.backgroundColor = "var(--p-primary)";
                }
                else {
                    image.style.backgroundImage = `url("${gradient(mediaId(image))}")`;
                    image.style.backgroundSize = "cover";
                }
                image.src = `data:image/svg+xml,${encodeURIComponent(blank)}`;
                for (let filtered: HTMLElement = image, depth = 0; filtered && depth < 3; filtered = filtered.parentElement, depth++) {
                    if (/grayscale|invert|brightness\(0/.test(getComputedStyle(filtered).filter))
                        filtered.style.setProperty("filter", "none", "important");
                }
                continue;
            }
            const url = gradient(mediaId(image));
            if (image.parentElement?.tagName === "PICTURE") {
                for (const source of image.parentElement.querySelectorAll<HTMLElement>("source"))
                    source.removeAttribute("srcset");
            }
            image.removeAttribute("srcset");
            if (image.getAttribute("src") !== url)
                image.src = url;
            let filtered: HTMLElement = image;
            for (let depth = 0; filtered && depth < 3; depth++, filtered = filtered.parentElement) {
                if (/grayscale|invert|brightness\(0/.test(getComputedStyle(filtered).filter))
                    filtered.style.filter = "none";
            }
        }
        for (const element of document.querySelectorAll<HTMLVideoElement>("video, canvas")) {
            const box = element.getBoundingClientRect();
            if (!element.dataset.editorGradient && (box.width < 100 || box.height < 80))
                continue;
            let parent = element.parentElement;
            while (parent && getComputedStyle(parent).display === "contents")
                parent = parent.parentElement;
            if (!parent)
                continue;
            parent.dataset.editorMediaContainer = "true";
            const background = `url("${gradient(mediaId(element))}")`;
            if (parent.style.backgroundImage !== background)
                parent.style.backgroundImage = background;
            parent.style.backgroundSize = "cover";
            parent.style.backgroundPosition = "center";
            element.style.opacity = "0";
            if (element.tagName === "VIDEO" && !element.dataset.editorMediaStopped) {
                element.pause();
                element.removeAttribute("autoplay");
                element.removeAttribute("poster");
                element.removeAttribute("src");
                for (const source of element.querySelectorAll<HTMLElement>("source"))
                    source.removeAttribute("src");
                element.load();
                element.dataset.editorMediaStopped = "true";
            }
        }
        for (const element of document.querySelectorAll<HTMLElement>("body *")) {
            if (element.matches("img, video, canvas") || element.dataset.editorMediaContainer)
                continue;
            const background = getComputedStyle(element).backgroundImage;
            if (!element.dataset.editorGradient && (!background.includes("url(") || background.includes("noise")))
                continue;
            const box = element.getBoundingClientRect();
            if (box.width < 250 || box.height < 150)
                continue;
            const url = `url("${gradient(mediaId(element))}")`;
            if (element.style.backgroundImage !== url)
                element.style.backgroundImage = url;
            element.style.backgroundSize = "cover";
        }
    };
    new MutationObserver(() => {
        if (!mediaPalette || mediaQueued)
            return;
        mediaQueued = true;
        requestAnimationFrame(() => {
            mediaQueued = false;
            updateMedia();
        });
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("message", (event) => {
        if (event.source !== window.parent || event.origin !== editorOrigin || event.data?.type !== "color-editor-theme")
            return;
        const { palette, foregrounds, heading, body, paletteActive, dark } = event.data;
        if (!palette || !roles.every((role) => /^#[\da-f]{6}$/i.test(palette[role])) || !Object.hasOwn(fonts, heading) || !Object.hasOwn(fonts, body) || typeof paletteActive !== "boolean" || typeof dark !== "boolean")
            return;
        root.dataset.editorPalette = String(paletteActive);
        root.dataset.editorLight = String(!dark);
        root.dataset.editorHeading = String(heading !== "System");
        root.dataset.editorBody = String(body !== "System");
        for (const role of roles)
            root.style.setProperty(`--p-${role}`, palette[role]);
        for (const surface of ["background", "secondary", "primary", "dark"]) {
            const value = foregrounds?.[surface];
            if (/^#[\da-f]{6}$/i.test(value))
                root.style.setProperty(`--p-on-${surface}`, value);
            else
                root.style.removeProperty(`--p-on-${surface}`);
        }
        mediaPalette = palette;
        recolorPage();
        updateMedia();
        updateWordmarks();
        root.style.setProperty("--p-heading-font", fonts[heading]);
        root.style.setProperty("--p-body-font", fonts[body]);
        if (site === "nuvexa") {
            const main = document.querySelector<HTMLElement>("#main");
            if (main)
                for (const role of roles)
                    main.style.setProperty(`--p-${role}`, palette[role]);
        }
    });
    window.parent.postMessage({ type: "color-editor-ready" }, editorOrigin);
})();
