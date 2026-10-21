import { contrast, foregroundForSurface } from './palette-contrast.js';
const root = document.documentElement;
const style = document.createElement('style');
style.textContent = `
  [data-preview-text-opacity] { opacity: 1 !important; }
  html[data-preview-measuring] * { transition-property: none !important; }
  [data-preview-placeholder]::placeholder { color: var(--preview-placeholder) !important; opacity: 1 !important; }
  [data-preview-foreground] { color: var(--preview-foreground) !important; -webkit-text-fill-color: var(--preview-foreground) !important; transition-property: none !important; }
  :is(text,tspan)[data-preview-foreground] { fill: var(--preview-foreground) !important; }
  [data-preview-text-surface] { background-color: var(--preview-text-surface) !important; background-image: none !important; }
`;
document.head.append(style);
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
const context = canvas.getContext('2d', { willReadFrequently: true });
const hex = values => `#${values.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const over = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
let timer;
let pendingSince = 0;
const inlineColors = new WeakMap();
const writtenStyles = new WeakMap();
const colorStyle = node => [...node.style].filter(property => /color|background|opacity|filter|display|visibility|fill|stroke|^--/.test(property)).sort().map(property => `${property}:${node.style.getPropertyValue(property)}`).join(';');
function correctText() {
    root.dataset.previewMeasuring = '';
    for (const node of document.querySelectorAll<HTMLElement>('[data-preview-foreground],[data-preview-text-surface],[data-preview-placeholder],[data-preview-text-opacity]')) {
        const original = inlineColors.get(node);
        if (original && node.style.getPropertyValue('color') === original.applied) {
            if (original.color)
                node.style.setProperty('color', original.color, original.priority);
            else
                node.style.removeProperty('color');
        }
        inlineColors.delete(node);
        node.removeAttribute('data-preview-foreground');
        node.removeAttribute('data-preview-text-surface');
        node.removeAttribute('data-preview-placeholder');
        node.removeAttribute('data-preview-text-opacity');
    }
    const touched = new Set(document.querySelectorAll<HTMLElement>('[style]'));
    const colors = new Map(), styles = new Map(), surfaces = new Map();
    const css = node => {
        if (!styles.has(node))
            styles.set(node, getComputedStyle(node));
        return styles.get(node);
    };
    const rgba = value => {
        if (!colors.has(value)) {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = value;
            context.fillRect(0, 0, 1, 1);
            const values = [...context.getImageData(0, 0, 1, 1).data];
            values[3] /= 255;
            colors.set(value, values);
        }
        return colors.get(value);
    };
    const paletteColors = ['text', 'background', 'primary', 'secondary', 'accent']
        .map(role => root.style.getPropertyValue(`--p-${role}`).trim())
        .filter(value => /^#[\da-f]{6}$/i.test(value));
    const readable = (preferred, background) => {
        const options = paletteColors.filter(value => contrast(value, background) >= 4.5);
        if (!options.length)
            return foregroundForSurface(preferred, background);
        const channels = rgba(preferred);
        return options.sort((a, b) => {
            const distance = value => rgba(value).slice(0, 3).reduce((sum, channel, index) => sum + (channel - channels[index]) ** 2, 0);
            return distance(a) - distance(b);
        })[0];
    };
    const surface = node => {
        if (!node)
            return { color: [255, 255, 255], image: false };
        if (surfaces.has(node))
            return surfaces.get(node);
        const own = css(node), background = rgba(own.backgroundColor);
        const parent = background[3] === 1 ? { color: [255, 255, 255], image: false } : surface(node.parentElement);
        const image = own.backgroundImage !== 'none' && own.backgroundClip !== 'text';
        const result = { color: over(background, parent.color), image: image || parent.image };
        surfaces.set(node, result);
        return result;
    };
    const artwork = [...document.querySelectorAll<HTMLElement>('[data-editor-media-container],img[data-editor-gradient],[data-framer-name="Image Overlay"]')]
        .filter(node => node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && (node.tagName === 'IMG' || css(node).backgroundImage !== 'none'))
        .map(node => ({ node, rectangle: node.getBoundingClientRect() }));
    const corrections = [];
    for (const node of document.querySelectorAll<HTMLElement>('body *')) {
        if (node.closest<HTMLElement>('script,style,noscript,[disabled]') || !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
            continue;
        if (root.dataset.editorSite === 'nuvexa' && node.closest<HTMLElement>('.mh-header [data-framer-name="Distributors Panel"],.mh-header [data-framer-name="Mobile Menu"],.mh-header [data-framer-name="Menu Label"]'))
            continue;
        const wordmark = node.matches('img[data-editor-wordmark]');
        const field = node.matches('input:not([type=checkbox]):not([type=radio]),textarea,select');
        if (!wordmark && !field && ![...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()))
            continue;
        touched.add(node);
        const own = css(node), rectangle = node.getBoundingClientRect();
        const x = rectangle.x + rectangle.width / 2, y = rectangle.y + rectangle.height / 2;
        const underArtwork = artwork.some(item => item.node !== node && !node.contains(item.node) && item.rectangle.left <= x && item.rectangle.right >= x && item.rectangle.top <= y && item.rectangle.bottom >= y);
        const background = { ...surface(node), image: !node.closest<HTMLElement>('[data-preview-readable-artwork]') && (surface(node).image || underArtwork) };
        const backing = node.matches('text,tspan') && node.previousElementSibling?.tagName.toLowerCase() === 'rect' ? node.previousElementSibling : null;
        if (backing) {
            const bounds = backing.getBoundingClientRect();
            if (bounds.left <= x && bounds.right >= x && bounds.top <= y && bounds.bottom >= y)
                background.color = over(rgba(css(backing).fill), background.color);
        }
        let preferred = node.matches('text,tspan') && own.fill !== 'none' ? own.fill : own.color;
        let documentSvg;
        if (wordmark) {
            if (!(node as HTMLImageElement).src.startsWith('data:image/svg+xml,'))
                continue;
            documentSvg = new DOMParser().parseFromString(decodeURIComponent((node as HTMLImageElement).src.split(',')[1]), 'image/svg+xml');
            preferred = documentSvg.querySelector('text')?.getAttribute('fill');
            if (!preferred)
                continue;
        }
        const opacityNodes = [];
        for (let parent = node; parent; parent = parent.parentElement)
            if (Number(css(parent).opacity) < 1)
                opacityNodes.push(parent);
        const opacity = opacityNodes.reduce((value, parent) => value * Number(css(parent).opacity), 1);
        const fill = [...rgba(preferred)];
        fill[3] *= opacity;
        const painted = over(fill, background.color), bg = hex(background.color);
        if (opacity < 1 && contrast(hex(painted), bg) < 4.5)
            corrections.push(() => opacityNodes.forEach(parent => { parent.dataset.previewTextOpacity = ''; }));
        if (field && node.hasAttribute('placeholder')) {
            const placeholderStyle = getComputedStyle(node, '::placeholder');
            const placeholderColor = [...rgba(placeholderStyle.color)];
            placeholderColor[3] *= Number(placeholderStyle.opacity) * opacity;
            const placeholder = over(placeholderColor, background.color);
            if (contrast(hex(placeholder), bg) < 4.5)
                corrections.push(() => {
                    node.style.setProperty('--preview-placeholder', readable(hex(placeholder), bg));
                    node.dataset.previewPlaceholder = '';
                });
        }
        if (own.backgroundClip === 'text' && own.backgroundImage !== 'none') {
            const stops = own.backgroundImage.match(/(?:rgba?|color|oklch|oklab)\([^()]+\)/g) || [];
            const samples = stops.map(value => rgba(value));
            const readableGradient = samples.length > 0 && samples.every((color, index) => {
                const next = samples[index + 1] || color;
                return Array.from({ length: 11 }, (_, step) => color.map((value, channel) => value + (next[channel] - value) * step / 10))
                    .every(sample => contrast(hex(over(sample, background.color)), bg) >= 4.5);
            });
            if (readableGradient)
                continue;
        }
        const textGradient = rgba(own.webkitTextFillColor)[3] === 0;
        if (!background.image && !textGradient && contrast(hex(painted), bg) >= 4.5)
            continue;
        const foreground = readable(hex(painted), bg);
        if (opacity < 1 && contrast(hex(over([...rgba(foreground).slice(0, 3), opacity], background.color)), bg) < 4.5)
            corrections.push(() => opacityNodes.forEach(parent => { parent.dataset.previewTextOpacity = ''; }));
        if (documentSvg) {
            documentSvg.querySelector('text').setAttribute('fill', foreground);
            corrections.push(() => {
                (node as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(documentSvg))}`;
                if (background.image) {
                    node.style.setProperty('--preview-text-surface', bg);
                    node.dataset.previewTextSurface = '';
                }
            });
        }
        else {
            corrections.push(() => {
                inlineColors.set(node, { color: node.style.getPropertyValue('color'), priority: node.style.getPropertyPriority('color'), applied: foreground });
                node.style.setProperty('color', foreground, 'important');
                // CSS normalizes inline colors, so retain that value for the next restore.
                inlineColors.get(node).applied = node.style.getPropertyValue('color');
                node.style.setProperty('--preview-foreground', foreground);
                node.dataset.previewForeground = '';
                // Images have no single background color. Give overlaid text a solid surface.
                if (background.image) {
                    node.style.setProperty('--preview-text-surface', bg);
                    node.dataset.previewTextSurface = '';
                }
            });
        }
    }
    for (const apply of corrections)
        apply();
    for (const node of touched)
        writtenStyles.set(node, colorStyle(node));
    root.removeAttribute('data-preview-measuring');
    root.dataset.contrastReady = 'true';
    root.dataset.contrastPalette = ['text', 'background', 'primary', 'secondary', 'accent'].map(role => root.style.getPropertyValue(`--p-${role}`)).join('|');
    document.fonts.ready.then(() => {
        if (getComputedStyle(document.body).visibility === 'hidden' || root.dataset.contrastReady !== 'true' || (root.dataset.editorSite && root.dataset.copyReady !== 'true'))
            return;
        window.parent.postMessage({ type: 'color-editor-painted', url: location.href, palette: root.dataset.contrastPalette }, new URL(document.referrer || location.href).origin);
    });
}
function queueCorrection(delay, resetReady = false) {
    if (resetReady)
        root.dataset.contrastReady = 'false';
    const now = performance.now();
    if (!pendingSince)
        pendingSince = now;
    clearTimeout(timer);
    timer = setTimeout(() => {
        timer = undefined;
        pendingSince = 0;
        correctText();
    }, Math.min(delay, Math.max(0, 800 - (now - pendingSince))));
}
function schedule() { queueCorrection(180); }
function scheduleNow() { queueCorrection(0, true); }
new MutationObserver(records => {
    if (records.some(record => record.type !== 'attributes' || record.attributeName !== 'style' || writtenStyles.get(record.target) !== colorStyle(record.target))) {
        queueCorrection(180, !root.dataset.editorSite && records.some(record => record.type !== 'attributes' || record.attributeName !== 'style'));
    }
}).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'open', 'hidden', 'aria-expanded', 'aria-hidden', 'data-state', 'data-open', 'data-framer-name'] });
new MutationObserver(schedule).observe(document.head, { childList: true });
new MutationObserver(scheduleNow).observe(root, { attributes: true, attributeFilter: ['style', 'data-copy-ready', 'data-home-ready'] });
window.addEventListener('resize', schedule);
document.addEventListener('scroll', schedule, true);
document.addEventListener('pointerover', schedule);
document.addEventListener('focusin', scheduleNow);
document.addEventListener('click', scheduleNow);
document.addEventListener('transitionend', schedule, true);
document.addEventListener('animationend', schedule, true);
document.fonts.ready.then(scheduleNow);
scheduleNow();
