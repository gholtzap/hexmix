import { startTask, contextDialog } from './context.js';
import { icon, esc, dialog, menu, toast, navigate } from './ui.js';
import { chatPage, searchChats } from './chat.js';
import { spacePage } from './space.js';
import { scheduledPage, searchTasks } from './scheduled.js';
import { pluginsPage } from './plugins.js';
const views = ['chat', 'work', 'space', 'scheduled', 'plugins', 'sites', 'skills'];
const labels = { chat: 'Home', space: 'Space', scheduled: 'Scheduled', plugins: 'Plugins', sites: 'Sites' };
const icons = { chat: 'home', space: 'space', scheduled: 'clock', plugins: 'plugin', sites: 'sites' };
let current = new URLSearchParams(location.search).get('view') || 'chat';
let closed = false, renderId = 0;
function pathFor(view) { return '/dashboards/ai-chatbot' + (view === 'chat' ? '' : '/' + view); }
function updatePath(view) { if (window.parent === window) {
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    history.pushState({}, '', url);
}
else {
    const url = new URL(window.parent.location.href);
    url.pathname = pathFor(view);
    window.parent.history.pushState({}, '', url);
} }
function profileName() {
    try { return localStorage.getItem('pebble-profile')?.trim() || 'Jamie Davis'; }
    catch { return 'Jamie Davis'; }
}
function updateProfile() {
    const name = profileName();
    const avatar = document.querySelector<HTMLElement>('.avatar');
    const initials = name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
    avatar.setAttribute('aria-label', `${initials} · ${name} · Open profile menu`);
    avatar.querySelector('span').textContent = initials;
}
async function render(view, push = false) {
    if (!views.includes(view))
        view = 'chat';
    current = view;
    const id = ++renderId;
    const page = view === 'chat' || view === 'work' ? chatPage(view) : view === 'space' || view === 'sites' ? spacePage(view) : view === 'scheduled' ? scheduledPage() : await pluginsPage(view);
    if (id !== renderId)
        return;
    if (push)
        updatePath(view);
    window.dashboardComponents.disposeView();
    document.querySelectorAll<HTMLElement>('.model-power').forEach(e => e.remove());
    document.body.classList.remove('drawer-open');
    document.body.classList.toggle('sidebar-closed', closed);
    document.querySelector<HTMLElement>('#app').innerHTML = `<div class="scrim" aria-hidden="true"></div><nav class="rail" aria-label="App navigation">${['chat', 'space', 'scheduled', 'plugins', 'explore', 'sites'].map(v => v === 'explore' ? `<button class="icon-button" title="Explore" aria-label="Explore" data-explore>${icon('more')}</button><div class="divider"></div>` : `<button class="icon-button ${v === view || (v === 'chat' && view === 'work') || (v === 'plugins' && view === 'skills') ? 'active' : ''}" title="${labels[v]}" aria-label="${labels[v]}" data-nav="${v}">${icon(icons[v])}</button>`).join('')}<button class="icon-button avatar" aria-label="JD · Open profile menu"><span aria-hidden="true">JD</span></button></nav><aside class="sidebar" aria-label="${esc(page.title)} navigation"><header class="side-head"><span class="side-title">${esc(page.title)}</span><button class="icon-button" aria-label="Search" title="Search" data-search>${icon('search')}</button><button class="icon-button" aria-label="Toggle sidebar" title="Toggle sidebar" data-toggle>${icon('sidebar')}</button></header><div class="side-body">${page.sidebar}</div></aside><button class="icon-button mobile-toggle" aria-label="Open sidebar" title="Open sidebar">${icon('sidebar')}</button><main class="main" id="main-content">${page.main}</main>`;
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav));
    document.querySelectorAll<HTMLElement>('[data-toggle],.mobile-toggle,.scrim').forEach(b => b.onclick = () => { if (innerWidth <= 700) {
        document.body.classList.toggle('drawer-open');
        document.querySelector<HTMLElement>('main').inert = document.body.classList.contains('drawer-open');
    }
    else {
        closed = !closed;
        document.body.classList.toggle('sidebar-closed', closed);
    } });
    document.querySelector<HTMLElement>('[data-search]').onclick = () => { if (['chat', 'work'].includes(current))
        searchChats();
    else if (current === 'scheduled')
        searchTasks();
    else {
        document.body.classList.remove('drawer-open');
        document.querySelector<HTMLElement>('main').inert = false;
        const search = document.querySelector<HTMLInputElement>('main input[type=search],main input[placeholder*=Search]');
        if (search)
            search.focus();
        else
            navigate('space');
    } };
    document.querySelector<HTMLElement>('[data-explore]').onclick = e => menu((e.currentTarget as HTMLElement), ['Projects', 'Images', 'Health', 'Finances', 'Sites', 'Maps', 'GPTs', 'Codex'].map(label => ({ label, action: () => label === 'Sites' ? navigate('sites') : label === 'Projects' ? dialog('Projects', '<button class="row" data-project-demo>Design studio</button><button class="row" data-project-demo>Learning journal</button>', d => d.querySelectorAll<HTMLElement>('button[data-project-demo]').forEach(b => b.onclick = () => { d.close(); navigate('work'); })) : label === 'Images' ? navigate('space') : startTask(label) })));
    updateProfile();
    document.querySelector<HTMLElement>('.avatar').onclick = e => menu((e.currentTarget as HTMLElement), [{ label: `${profileName()} · Personal account`, action: settings }, { label: 'Settings', action: settings }, { label: 'Help', action: () => dialog('Help', '<p>Choose a task to get started.</p><div class="actions"><button class="pill" data-help="work">Start a task</button><button class="pill" data-help="space">Create a document</button><button class="pill" data-help="scheduled">Schedule a task</button></div>', d => d.querySelectorAll<HTMLElement>('[data-help]').forEach(b => b.onclick = () => { d.close(); navigate(b.dataset.help); })) }]);
    page.mount?.();
    document.documentElement.dataset.appReady = 'true';
    document.title = (view === 'chat' ? 'Pebble' : view[0].toUpperCase() + view.slice(1)) + ' · Local preview';
}
function settings() {
    const name = profileName();
    dialog('Settings', `<form><label class="field-label" for="profile-name">Display name</label><input id="profile-name" class="field" required maxlength="80" value="${esc(name)}"><div class="actions"><button class="pill primary">Save settings</button><button type="button" class="pill" data-context>Personal context</button><button type="button" class="pill" data-theme>Change theme</button></div><p role="status"></p></form>`, d => {
        d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const value = d.querySelector<HTMLInputElement>('input').value.trim(); if (!value)
            return; try {
            localStorage.setItem('pebble-profile', value);
            updateProfile();
            d.close();
            toast('Settings saved');
        }
        catch {
            d.querySelector<HTMLElement>('[role=status]').textContent = 'Settings could not be saved. Allow browser storage and try again.';
        } };
        d.querySelector<HTMLElement>('[data-context]').onclick = () => { d.close(); contextDialog(); };
        d.querySelector<HTMLElement>('[data-theme]').onclick = () => { window.parent.postMessage({ type: 'preview-toggle-theme' }, location.origin); d.close(); };
    });
}
window.addEventListener('dashboard:navigate', e => render((e as CustomEvent).detail, true));
window.addEventListener('keydown', e => { if (e.key === 'Escape') {
    document.body.classList.remove('drawer-open');
    const main = document.querySelector<HTMLElement>('main');
    if (main)
        main.inert = false;
} });
window.addEventListener('popstate', () => render(new URLSearchParams(location.search).get('view') || 'chat'));
if (window.parent !== window) {
    const onBack = () => { const view = window.parent.location.pathname.split('/')[3] || 'chat'; render(view); };
    window.parent.addEventListener('popstate', onBack);
    window.addEventListener('pagehide', () => window.parent.removeEventListener('popstate', onBack));
}
render(current).catch(() => { document.querySelector<HTMLElement>('#app').innerHTML = '<main class="empty-state"><h1>The page could not load</h1><button class="pill" id="retry-page">Try again</button></main>'; document.querySelector<HTMLElement>('#retry-page').onclick = () => location.reload(); });
