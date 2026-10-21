import { linkPreviewData, registerSharedDialog, rememberSharedDialog, restoreSharedDialog } from './shared.js';
import { matchesShape, stringRecord } from '../../share-state.ts';
import { icon, esc, dialog, menu, toast, navigate } from './ui.js';
const templates = [['Your guide to pages', 'Start here', 'Page'], ['Product Strategy', 'Slides', 'Slides'], ['Project tracker', 'Page', 'Page'], ['Weekly update', 'Page', 'Page'], ['Growth Strategy', 'Slides', 'Slides'], ['To-do list', 'Page', 'Page'], ['Feedback tracker', 'Page', 'Page'], ['Release notes', 'Page', 'Page']];
interface SpaceItem {id:number;name:string;type:string;body:string;favorite?:boolean;source?:string;trash?:boolean;group?:string}
const items: SpaceItem[] = [
    { id: 1, name: 'Team notes.md', type: 'Page', body: 'Team notes\n\nAdd topics for the next team meeting.', favorite: true },
    { id: 2, name: 'Project plan.md', type: 'Page', body: 'Project plan\n\nDefine the next steps and owners.' },
    { id: 3, name: 'Weekly report.md', type: 'Page', body: 'Weekly report\n\nProgress\nNext steps' },
    { id: 4, name: 'Product overview', type: 'Slides', body: 'Product overview\n\nOur goals\nOur plan' },
    { id: 5, name: 'Team illustration', type: 'Image', body: 'Describe your image here.' },
    { id: 6, name: 'Shared project brief', type: 'Page', source: 'Team resources', body: 'Sample project brief' },
    { id: 7, name: 'Studio portfolio', type: 'Site', body: 'Studio portfolio\n\nSelected projects', favorite: true },
    { id: 8, name: 'Team handbook', type: 'Site', body: 'Team handbook\n\nOur shared approach' },
    { id: 9, name: 'Project tracker', type: 'Site', body: 'Project tracker\n\nCurrent projects' },
];
const spaces = [];
let nextId = 10;
const state = { type: 'All', tab: 'Suggested', layout: 'list', search: '', group: null };
const siteState = { layout: 'list', search: '' };
linkPreviewData('spaceData', () => ({ items, spaces, nextId }), value => { items.splice(0, items.length, ...value.items); spaces.splice(0, spaces.length, ...value.spaces); nextId = value.nextId; }, {
 validate: value => !!value && typeof value === 'object' && 'items' in value && 'spaces' in value && 'nextId' in value && Number.isSafeInteger(value.nextId) && Array.isArray(value.items) && value.items.every(item => matchesShape(item, { id: 1, name: '', type: '', body: '' })) && Array.isArray(value.spaces) && value.spaces.every(item => typeof item === 'string' || stringRecord(item)),
});
linkPreviewData('spaceView', () => ({ ...state, group: state.group ?? '' }), value => { Object.assign(state, value); }, { private: false });
linkPreviewData('siteView', () => siteState, value => { Object.assign(siteState, value); }, { private: false });
const typeIcons = { Page: 'page', Slides: 'slide', Site: 'sites', Image: 'image' };
const sideTypes = [['All', 'space'], ['Pages', 'page'], ['Slides', 'slide'], ['Sites', 'sites'], ['Images', 'image'], ['Team resources', 'drive']];
function preview(index) {
    return `<img src="assets/template-preview-${index}.png" alt="" loading="lazy">`;
}
export function openImages() {
    state.type = 'Images';
    state.tab = 'Your items';
    state.search = '';
    state.group = null;
    navigate('space');
}
export function spacePage(view = 'space') {
    const sites = view === 'sites';
    const current = sites ? siteState : state;
    const selected = new Set<number>();
    linkPreviewData('spaceSelection', () => ({ selected: [...selected] }), value => { selected.clear(); value.selected.forEach(id => selected.add(id)); }, { private: false, validate: value => !!value && typeof value === 'object' && 'selected' in value && Array.isArray(value.selected) && value.selected.every(id => typeof id === 'number' && items.some(item => item.id === id)) });
    const visible = () => items.filter(item => {
        if (sites)
            return item.type === 'Site' && !item.trash && item.name.toLowerCase().includes(current.search.toLowerCase());
        if (Boolean(item.trash) !== (state.type === 'Trash'))
            return false;
        if (item.type === 'Site' && state.type !== 'Trash')
            return false;
        if (state.group && item.group !== state.group)
            return false;
        if (state.tab === 'Shared with you')
            return false;
        if (state.tab === 'Favorites' && !item.favorite)
            return false;
        if (state.type === 'Team resources' && item.source !== 'Team resources')
            return false;
        const type = { Pages: 'Page', Slides: 'Slides', Images: 'Image' }[state.type];
        return (!type || item.type === type) && item.name.toLowerCase().includes(current.search.toLowerCase());
    });
    const heading = () => sites ? 'Sites' : state.group || state.type;
    function sidebar() {
        return `<div class="side-body"><button class="row" data-space-create>${icon('plus')}<span>Create</span></button><div class="space-side-types">${sideTypes.map(([label, glyph]) => `<button class="row ${(sites ? label === 'Sites' : !state.group && state.type === label) ? 'active' : ''}" data-space-type="${esc(label)}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div><div class="side-section">Recents</div>${items.filter(item => !item.trash && item.type === 'Page').slice(0, 3).map(item => `<button class="row side-recent" data-space-open="${item.id}">${icon('page')}<span>${esc(item.name)}</span></button>`).join('')}<div class="side-section">Spaces</div><button class="row" data-space-new-group>${icon('plus')}<span>New space</span></button>${spaces.map(name => `<button class="row ${state.group === name ? 'active' : ''}" data-space-group="${esc(name)}">${icon('folder')}<span>${esc(name)}</span></button>`).join('')}</div><div class="side-bottom"><button class="row ${state.type === 'Trash' && !sites ? 'active' : ''}" data-space-type="Trash">${icon('trash')}<span>Trash</span></button></div>`;
    }
    function rows() {
        const list = visible();
        if (!list.length)
            return '<div class="empty-state">Folder is empty</div>';
        if (current.layout === 'grid')
            return `<div class="space-file-grid">${list.map(item => `<article class="space-file-card"><button class="space-file-open" data-space-open="${item.id}" data-tooltip-label="Open ${esc(item.name)}"><div class="space-file-art">${icon(typeIcons[item.type])}</div><span>${esc(item.name)}</span><small class="muted">${sites ? 'Only you' : item.source || 'Space'}</small></button><button class="icon-button space-card-more" data-space-actions="${item.id}" aria-label="Actions for ${esc(item.name)}">${icon('more')}</button></article>`).join('')}</div>`;
        return `<div class="space-table-wrap"><table class="space-table ${sites ? 'space-sites-table' : ''}"><thead><tr><th class="space-checkbox"><input type="checkbox" aria-label="Select all items" data-space-select-all></th><th>${sites ? 'Site' : 'Name'}</th>${sites ? '' : '<th class="space-source">Source</th>'}<th>${sites ? 'Shared with' : 'Last activity'}</th><th aria-label="Actions"></th></tr></thead><tbody>${list.map((item, index) => `<tr><td><input type="checkbox" aria-label="Select ${esc(item.name)}" data-space-select="${item.id}" ${selected.has(item.id) ? 'checked' : ''}></td><td><button class="space-item-name" data-space-open="${item.id}">${sites ? `<span class="space-site-thumb space-site-thumb-${index % 3}">${icon('sites')}</span>` : icon(typeIcons[item.type])}<span>${esc(item.name)}</span>${item.favorite ? `<span class="space-favorite" aria-label="Favorite">${icon('star')}</span>` : ''}</button></td>${sites ? '' : `<td class="space-source muted">${esc(item.source || 'Space')}</td>`}<td class="space-activity muted">${sites ? `${icon('lock')} Only you` : 'Just now'}</td><td><button class="icon-button" data-space-actions="${item.id}" aria-label="Actions for ${esc(item.name)}">${icon('more')}</button></td></tr>`).join('')}</tbody></table></div>`;
    }
    function content() {
        return `<header class="page-header"><h1>${esc(heading())}</h1><div class="page-tools"><label class="search-field">${icon('search')}<input id="space-search" type="search" aria-label="Search ${sites ? 'sites' : 'Space'}" placeholder="Search" value="${esc(current.search)}"></label><button class="pill primary" data-space-create>Create ${icon('chevron')}</button></div></header><div class="space-toolbar">${sites ? '<span></span>' : `<div class="tabs" role="tablist" aria-label="Space items">${['Suggested', 'Favorites', 'Your items', 'Shared with you'].map(tab => `<button class="tab" role="tab" aria-selected="${state.tab === tab}" data-space-tab="${tab}">${tab}</button>`).join('')}</div>`}<div class="space-controls"><button class="icon-button" data-space-filter aria-label="Filters" title="Filters">${icon('filter')}</button><button class="icon-button ${current.layout === 'grid' ? 'space-selected' : ''}" data-space-layout="grid" aria-label="Grid view" aria-pressed="${current.layout === 'grid'}">${icon('grid')}</button><button class="icon-button ${current.layout === 'list' ? 'space-selected' : ''}" data-space-layout="list" aria-label="List view" aria-pressed="${current.layout === 'list'}">${icon('list')}</button></div></div>${!sites && state.tab === 'Suggested' && state.type === 'All' && !state.group && !current.search ? `<section class="space-templates" aria-labelledby="space-template-title"><h2 id="space-template-title">Create together in Space</h2><p class="muted">Choose a template to start working with Pebble and your team</p><div class="space-template-track">${templates.map(([title, label], index) => `<button class="space-template" data-tooltip-label="${esc(title)}" data-space-template="${index}"><div class="space-template-art">${preview(index)}</div><span>${esc(title)}</span><small class="muted">${label}</small></button>`).join('')}</div></section>` : ''}<div id="space-results">${rows()}</div>`;
    }
    function redraw() {
        document.querySelector<HTMLElement>('#space-page').innerHTML = content();
        document.querySelector<HTMLElement>('#space-sidebar').innerHTML = sidebar();
        bindSearch();
    }
    function edit(item) {
        rememberSharedDialog("spaceItem", item.id);
        dialog(item.name, `<form><label class="field-label" for="space-document">${item.type === 'Site' ? 'Site content' : 'Content'}</label><textarea id="space-document" class="field" rows="12" maxlength="20000">${esc(item.body)}</textarea><div class="actions"><button class="pill primary">Save</button></div></form>`, d => {
            d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); item.body = d.querySelector<HTMLTextAreaElement>('textarea').value; d.close(); redraw(); toast('Saved'); };
        });
    }
    function nameForm(title, value, save, intent) {
        rememberSharedDialog("spaceName", intent);
        dialog(title, `<form><label class="field-label" for="space-name">Name</label><input class="field" id="space-name" maxlength="160" required value="${esc(value)}"><div class="actions"><button class="pill primary">Save</button></div></form>`, d => {
            const input = d.querySelector<HTMLInputElement>('input');
            input.oninput = () => input.setCustomValidity('');
            d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const name = input.value.trim(); input.setCustomValidity(name ? '' : 'Enter a name.'); if (!input.reportValidity())
                return; const nextView = save(name); d.close(); if (nextView)
                navigate(nextView);
            else
                redraw(); };
        });
    }
    function create(type) {
        nameForm(`Create ${type.toLowerCase()}`, '', name => { items.push({ id: nextId++, name, type, body: '', group: state.group }); if (type === 'Site' && !sites) {
            siteState.search = ''; return 'sites'; } if (!sites) {
            state.type = 'All';
            state.tab = 'Your items';
        } current.search = ''; toast(`${type} created`); }, {kind:"create",type});
    }
    function syncSelection() {
        const all = document.querySelector<HTMLInputElement>('[data-space-select-all]');
        if (!all) return;
        const list = visible();
        all.checked = list.length > 0 && list.every(item => selected.has(item.id));
        all.indeterminate = !all.checked && list.some(item => selected.has(item.id));
    }
    function bindSearch() {
        syncSelection();
        document.querySelector<HTMLElement>('#space-search').oninput = e => { current.search = (e.target as HTMLInputElement).value; document.querySelector<HTMLElement>('#space-results').innerHTML = rows(); syncSelection(); const templates = document.querySelector<HTMLElement>('.space-templates'); if (templates)
            templates.hidden = Boolean(current.search); };
    }
    function newSpace() { nameForm('New space', '', name => { if (!spaces.includes(name))
                spaces.push(name); state.group = name; state.type = 'All'; if (sites)
                return 'space'; }, {kind:"group"}); }
    function click(e) {
        const button = e.target.closest('button');
        if (!button)
            return;
        const data = button.dataset;
        if ('spaceCreate' in data) {
            if (sites)
                create('Site');
            else
                menu(button, ['Page', 'Slides', 'Site', 'Image'].map(type => ({ label: type, action: () => create(type) })));
        }
        if ('spaceType' in data) {
            if (data.spaceType === 'Sites') {
                navigate('sites');
                return;
            }
            state.type = data.spaceType;
            state.group = null;
            if (sites)
                navigate('space');
            else
                redraw();
        }
        if ('spaceTab' in data) {
            state.tab = data.spaceTab;
            redraw();
        }
        if ('spaceLayout' in data) {
            current.layout = data.spaceLayout;
            redraw();
        }
        if ('spaceFilter' in data)
            menu(button, (sites ? ['All sites'] : ['All', 'Pages', 'Slides', 'Images', 'Team resources']).map(label => ({ label, action: () => { if (!sites) {
                    state.type = label;
                    state.group = null;
                    redraw();
                } } })));
        if ('spaceOpen' in data) {
            const item = items.find(item => item.id === Number(data.spaceOpen));
            if (item)
                edit(item);
        }
        if ('spaceTemplate' in data) {
            const [name, , type] = templates[Number(data.spaceTemplate)];
            const item = { id: nextId++, name, type, body: `${name}\n\nStart writing here.` };
            items.push(item);
            edit(item);
        }
        if ('spaceActions' in data) {
            const item = items.find(item => item.id === Number(data.spaceActions));
            if (item)
                menu(button, [{ label: 'Rename', action: () => nameForm('Rename', item.name, name => { item.name = name; }, {kind:"rename",id:item.id}) }, { label: item.favorite ? 'Remove from favorites' : 'Add to favorites', action: () => { item.favorite = !item.favorite; redraw(); } }, { label: item.trash ? 'Restore' : 'Move to trash', action: () => { item.trash = !item.trash; selected.delete(item.id); redraw(); toast(item.trash ? 'Moved to trash' : 'Restored'); } }]);
        }
        if ('spaceNewGroup' in data)
            newSpace();
        if ('spaceGroup' in data) {
            state.group = data.spaceGroup;
            state.type = 'All';
            if (sites)
                navigate('space');
            else
                redraw();
        }
    }
    registerSharedDialog('spaceName', intent => {
        const value = intent as {kind:string;type?:string;id?:number};
        if (value.kind === 'create') create(value.type);
        else if (value.kind === 'group') newSpace();
        else { const item = items.find(item => item.id === value.id); if (item) nameForm('Rename', item.name, name => { item.name = name; }, value); }
    }, intent => !!intent && typeof intent === 'object' && !Array.isArray(intent) && ('kind' in intent) && (intent.kind === 'group' || intent.kind === 'create' && 'type' in intent && ['Page','Slides','Site','Image'].includes(String(intent.type)) || intent.kind === 'rename' && 'id' in intent && items.some(item => item.id === intent.id)));
    registerSharedDialog('spaceItem' , id => edit(items.find(item => item.id === id)), id => typeof id === 'number' && items.some(item => item.id === id));
    return { title: 'Space', sidebar: `<div id="space-sidebar" class="space-sidebar">${sidebar()}</div>`, main: `<section class="page-content space-page" id="space-page">${content()}</section>`, mount() {
            document.querySelector<HTMLElement>('#space-page').onclick = click;
            document.querySelector<HTMLElement>('#space-sidebar').onclick = click;
            document.querySelector<HTMLElement>('#space-page').onchange = e => {
                if ('spaceSelectAll' in (e.target as HTMLElement).dataset) {
                    visible().forEach(item => (e.target as HTMLInputElement).checked ? selected.add(item.id) : selected.delete(item.id));
                    document.querySelector<HTMLElement>('#space-results').innerHTML = rows();
                }
                if ('spaceSelect' in (e.target as HTMLElement).dataset) {
                    const id = Number((e.target as HTMLElement).dataset.spaceSelect);
                    if ((e.target as HTMLInputElement).checked)
                        selected.add(id);
                    else
                        selected.delete(id);
                }
                syncSelection();
            };
            bindSearch();
        } };
}
