import type { DashboardDialog, MenuItem } from "../../../types/workspace";
export const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
    home: 'M3 9.5 10 3l7 6.5V17h-5v-5H8v5H3Z', space: 'M5 7 3 8l2 10 9-2-1-5M8 3l8-1 2 10-5 1-1-6Z', clock: 'M10 5v5l-3 2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', plugin: 'M5 11a5 5 0 1 1 5 5H5a3 3 0 1 1 0-6m3 0a2 2 0 1 0 2-2', more: 'M3 10h.01M10 10h.01M17 10h.01', sites: 'M3 3h5v5H3Zm9 0h5v5h-5ZM3 12h5v5H3Zm9 0h5v5h-5Z', search: 'M14 14l4 4M16 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z', sidebar: 'M7 3v14M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', plus: 'M10 3v14M3 10h14', edit: 'm12 3 5 5M5 14l-1 4 4-1L18 7l-5-5ZM10 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6', folder: 'M2 7V5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Zm0 1h16', chevron: 'm6 8 4 4 4-4', close: 'm5 5 10 10M5 15 15 5', mic: 'M7 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Zm-3 5v1a6 6 0 0 0 12 0V9M10 16v3', voice: 'M3 8v4M6 5v10M10 2v16M14 6v8M17 8v4', arrow: 'M10 17V3m-6 6 6-6 6 6', temporary: 'M4 4a8 8 0 0 1 12 1M17 8a8 8 0 0 1-9 10M4 15l-2 3 4-1M2 8v4', page: 'M4 2h12v16H4ZM7 6h6M7 10h6M7 14h3', grid: 'M3 3h5v5H3Zm9 0h5v5h-5ZM3 12h5v5H3Zm9 0h5v5h-5Z', list: 'M7 4h11M7 10h11M7 16h11M2 4h1M2 10h1M2 16h1', filter: 'M2 4h16M5 10h10M8 16h4', lock: 'M6 8V5a4 4 0 0 1 8 0v3M4 8h12v10H4Z', star: 'm10 2 2.5 5 5.5.8-4 4 1 5.5-5-2.5-5 2.5 1-5.5-4-4L7.5 7Z', check: 'm3 10 5 5 9-10', trash: 'M2 5h16M7 5V2h6v3M4 5l1 13h10l1-13M8 8v7M12 8v7', bell: 'M3 14h14l-2-3V7a5 5 0 0 0-10 0v4Zm5 3h4', image: 'M2 2h16v16H2Zm0 12 5-5 6 6 3-3 2 2M14 6h.01', slide: 'M2 3h16v12H2ZM10 15v4M6 19h8', drive: 'm8 2 5 0 6 11-3 5H4l-3-5Zm0 0L1 13h12L7 2m6 0-6 11-3 5', pause: 'M7 5v10M13 5v10', copy: 'M7 7h11v11H7ZM3 13H2V2h11v1'
};
const symbols = { home: 'home', clock: 'clock', plugin: 'plugin', more: 'ellipsis-horizontal', sites: 'sites', search: 'magnifying-glass-lg', sidebar: 'sidebar', plus: 'plus-lg', edit: 'square-and-pencil', folder: 'folder', chevron: 'chevron-down-md', mic: 'microphone', page: 'document', grid: 'square-grid-2x2', list: 'list-bullet', filter: 'filter', lock: 'lock', check: 'checkmark-md', trash: 'trash', bell: 'bell', image: 'photo', slide: 'slides', pause: 'pause-circle', copy: 'square-on-square' };
export function icon(name) { if (name === 'space')
    return "<svg aria-hidden=\"true\" focusable=\"false\" data-no-autosize=\"true\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M7.01826 3.38781C7.47069 1.69958 9.20694 0.697366 10.8952 1.14953L16.9479 2.7716C18.6362 3.22397 19.6383 4.9593 19.1862 6.64757L17.2106 14.0216C16.8715 15.2866 15.8124 16.1623 14.5935 16.3341C14.3503 17.5978 13.2984 18.601 11.9528 18.7189L5.1081 19.3175C3.48242 19.4595 2.04916 18.2567 1.90693 16.631L1.17549 8.26672C1.03327 6.64107 2.23548 5.20804 3.86103 5.06554L6.63349 4.82238L7.01826 3.38781ZM3.97724 6.39074C3.08335 6.46908 2.42258 7.25658 2.50068 8.1505L3.23213 16.5148C3.31035 17.4088 4.0988 18.0705 4.99287 17.9923L11.8366 17.3937C12.7306 17.3154 13.3914 16.527 13.3132 15.6329L12.8444 10.2706L10.78 10.4523C9.49733 10.5643 8.3659 9.6148 8.25361 8.33214L8.05244 6.03332L3.97724 6.39074ZM10.5505 2.43468C9.57185 2.17269 8.56586 2.75305 8.30342 3.73156L8.04365 4.69836L8.9997 4.61535C9.78022 4.54706 10.5566 4.79156 11.1569 5.29504L13.0124 6.85168C13.6126 7.35543 13.988 8.07788 14.0563 8.85851L14.5915 14.9825C15.2198 14.8273 15.7464 14.3452 15.9255 13.6769L17.9011 6.30382C18.1633 5.32505 17.5829 4.31818 16.6042 4.05578L10.5505 2.43468ZM9.57881 8.21593C9.62702 8.76703 10.1136 9.17528 10.6647 9.12707L12.7272 8.9464C12.6834 8.52775 12.4799 8.14127 12.1569 7.87023L10.3024 6.31457C10.0402 6.09451 9.71672 5.96583 9.37959 5.94054L9.57881 8.21593Z\" fill=\"currentColor\"></path></svg>"; if (symbols[name])
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><use href="assets/icons.svg#${symbols[name]}-light-20" fill="currentColor"/></svg>`; return `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.page}"/></svg>`; }
export function toast(text: string) { window.dashboardComponents.toast(text); }
export function dialog(title: string, body: string, onOpen?: (panel: DashboardDialog) => void) { return window.dashboardComponents.dialog(title, body, onOpen); }
export function menu(anchor: HTMLElement, items: MenuItem[]) { window.dashboardComponents.menu(anchor, items); }
export function navigate(view: string) { window.dispatchEvent(new CustomEvent('dashboard:navigate', { detail: view })); }
let tooltipId = 0;
function addTooltips() {
    document.querySelectorAll<HTMLElement>('button[aria-label],button[data-tooltip-label]').forEach(button => {
        if (button.dataset.tooltipReady || button.textContent.trim() && !button.classList.contains('avatar') && !button.hasAttribute('data-tooltip-label'))
            return;
        button.dataset.tooltipReady = 'true';
        button.removeAttribute('title');
        const tip = document.createElement('span');
        tip.id = 'ui-tip-' + (++tooltipId);
        tip.className = 'ui-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.hidden = true;
        tip.textContent = button.getAttribute('data-tooltip-label') || button.getAttribute('aria-label');
        document.body.append(tip);
        button.setAttribute('aria-describedby', tip.id);
        const show = () => { if (!button.isConnected)
            return; tip.textContent = button.getAttribute('data-tooltip-label') || button.getAttribute('aria-label'); tip.hidden = false; const r = button.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(r.left, innerWidth - tip.offsetWidth - 8)) + 'px'; tip.style.top = (r.bottom + tip.offsetHeight + 8 > innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px'; };
        const hide = () => { tip.hidden = true; };
        button.addEventListener('mouseenter', show);
        button.addEventListener('mouseleave', hide);
        button.addEventListener('focus', show);
        button.addEventListener('blur', hide);
        button.addEventListener('click', hide);
    });
    document.querySelectorAll<HTMLElement>('.ui-tooltip').forEach(t => { if (!document.querySelector<HTMLElement>('[aria-describedby="' + t.id + '"]'))
        t.remove(); });
}
new MutationObserver(addTooltips).observe(document.body, { childList: true, subtree: true });
addTooltips();
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll<HTMLElement>('.ui-tooltip').forEach(tip => { tip.hidden = true; }); });
