import { linkPreviewData, registerSharedDialog, rememberSharedDialog, restoreSharedDialog } from './shared.js';
import { matchesShape } from '../../share-state.ts';
import { icon, esc, dialog, menu, toast, navigate } from './ui.js';
const installed = new Set(['Team tool 01', 'Team tool 03', 'Team tool 35']);
const custom = [];
const skills = [{ name: 'Writing style', description: 'Write clear, direct answers.', content: 'Use short sentences. Give the main answer first.' }, { name: 'Code review', description: 'Review changes for errors and risks.', content: 'Check behavior, validation, and error handling. Explain each finding.' }];
linkPreviewData('plugins', () => ({ installed: [...installed], custom, skills }), value => {
 installed.clear(); value.installed.forEach(name => installed.add(name)); custom.splice(0, custom.length, ...value.custom); skills.splice(0, skills.length, ...value.skills);
}, { validate: value => matchesShape(value, { installed: [''], custom: [{ name: '', description: '' }], skills: [{ name: '', description: '', content: '' }] }) });
const asset = image => new URL(image, import.meta.url).href;
const picture = item => item.image ? `<img class="plug-logo" src="${esc(asset(item.image))}" alt="" width="36" height="36">` : `<span class="plug-logo plug-placeholder">${icon('plugin')}</span>`;
export async function pluginsPage(view = 'plugins') {
    let groups;
    try {
        const response = await fetch(new URL('./catalog.json', import.meta.url));
        if (!response.ok)
            throw new Error('Catalogue could not load.');
        groups = await response.json();
        if (!Array.isArray(groups) || groups.some(group => typeof group.category !== 'string' || !Array.isArray(group.items) || group.items.some(item => typeof item.name !== 'string' || typeof item.description !== 'string' || typeof item.image !== 'string')))
            throw new Error('Invalid catalogue.');
    }
    catch {
        return { title: 'Customize', sidebar: '', main: '<div class="empty-state">The plugin catalogue could not load.<button class="pill" id="retry-catalog">Try again</button></div>', mount() { document.querySelector<HTMLElement>('#retry-catalog').onclick = () => navigate(view); } };
    }
    const items = [...new Map(groups.flatMap(group => group.items).map(item => [item.name, item])).values()];
    const allItems = () => [...items, ...custom];
    let tab = 'Public';
    let search = '';
    linkPreviewData(`pluginView.${view}`, () => ({ tab, search }), value => { tab = value.tab; search = value.search; }, { private: false });
    const skillView = view === 'skills';
    const sideRows = () => allItems().filter(item => installed.has(item.name)).map(item => `<button class="row" data-plug-detail="${esc(item.name)}">${picture(item)}<span>${esc(item.name)}</span></button>`).join('');
    const card = item => `<article class="plug-card"><button class="plug-detail" data-plug-detail="${esc(item.name)}">${picture(item)}<span class="plug-copy"><span class="plug-name">${esc(item.name)}</span><span class="plug-description">${esc(item.description)}</span></span></button><button class="icon-button plug-install" data-plug-install="${esc(item.name)}" aria-label="${installed.has(item.name) ? 'Remove' : 'Install'} ${esc(item.name)}">${icon(installed.has(item.name) ? 'check' : 'plus')}</button></article>`;
    const listMarkup = () => {
        const query = search.trim().toLocaleLowerCase();
        const source = tab === 'Personal' ? [{ category: 'Installed', items: allItems().filter(item => installed.has(item.name)) }] : [...groups, ...(custom.length ? [{ category: 'Your plugins', items: custom }] : [])];
        const visible = source.map(group => ({ ...group, items: group.items.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query)) })).filter(group => group.items.length);
        return visible.length ? visible.map(group => `<section class="plug-group"><h2>${esc(group.category)}</h2><div class="plug-grid">${group.items.map(card).join('')}</div></section>`).join('') : `<div class="empty-state"><p>${query ? 'No plugins found' : 'No installed plugins'}</p>${query ? '<button class="pill" id="plug-clear">Clear search</button>' : ''}</div>`;
    };
    const skillMarkup = () => {
        const matches = skills.filter(skill => `${skill.name} ${skill.description} ${skill.content}`.toLowerCase().includes(search.trim().toLowerCase()));
        return matches.length ? `<div class="plug-skills">${matches.map(skill => `<button class="row plug-skill" data-plug-skill="${skills.indexOf(skill)}">${icon('page')}<span><strong>${esc(skill.name)}</strong><small class="muted">${esc(skill.description)}</small></span>${icon('edit')}</button>`).join('')}</div>` : '<div class="empty-state"><p>No skills found</p><button class="pill" id="plug-clear">Clear search</button></div>';
    };
    function refresh() {
        const list = document.querySelector<HTMLElement>('#plug-list');
        if (list)
            list.innerHTML = skillView ? skillMarkup() : listMarkup();
        const side = document.querySelector<HTMLElement>('#plug-installed');
        if (side)
            side.innerHTML = sideRows();
        bindRows();
    }
    function toggleInstall(item) {
        const remove = installed.has(item.name);
        remove ? installed.delete(item.name) : installed.add(item.name);
        refresh();
        toast(remove ? 'Sample plugin removed' : 'Sample plugin installed');
    }
    function details(item) {
        rememberSharedDialog("plugin", item.name);
        dialog(item.name, `<div class="plug-dialog-icon">${picture(item)}</div><p>${esc(item.description)}</p><p class="muted">Sample plugin. Changes apply to this preview.</p><div class="actions"><button class="pill primary" id="plug-confirm">${installed.has(item.name) ? 'Remove' : 'Install'}</button></div>`, d => {
            d.querySelector<HTMLElement>('#plug-confirm').onclick = () => { toggleInstall(item); d.close(); };
        });
    }
    function editSkill(skill = undefined) {
        rememberSharedDialog("skill", skill ? skills.indexOf(skill) : null);
        dialog(skill ? 'Edit skill' : 'New skill', `<form id="plug-skill-form"><label class="field-label" for="plug-skill-name">Name</label><input class="field" id="plug-skill-name" name="name" required maxlength="100" value="${esc(skill?.name || '')}"><label class="field-label" for="plug-skill-content">Instructions</label><textarea class="field" id="plug-skill-content" name="content" required maxlength="10000" rows="7">${esc(skill?.content || '')}</textarea><p class="muted">Sample skill. Changes apply to this preview.</p><div class="actions"><button class="pill primary" style="color:var(--p-on-primary,var(--p-background))">Save</button></div></form>`, d => {
            d.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea').forEach(field => { field.oninput = () => field.setCustomValidity(''); });
            d.querySelector<HTMLFormElement>('form').onsubmit = event => {
                event.preventDefault();
                const form = event.currentTarget;
                const name = ((form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement).value.trim(), content = ((form as HTMLFormElement).elements.namedItem('content') as HTMLInputElement).value.trim();
                const nameField = (form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement;
                const contentField = (form as HTMLFormElement).elements.namedItem('content') as HTMLTextAreaElement;
                nameField.setCustomValidity(name ? '' : 'Enter a name.');
                contentField.setCustomValidity(content ? '' : 'Enter instructions.');
                if (!(form as HTMLFormElement).reportValidity()) return;
                const values = { name, content, description: content.slice(0, 90) };
                if (skill)
                    Object.assign(skill, values);
                else
                    skills.push(values);
                refresh();
                d.close();
                toast('Sample skill saved');
            };
        });
    }
    function addPlugin(create) {
        rememberSharedDialog("addPlugin", Boolean(create));
        dialog(create ? 'Create plugin' : 'Add plugin', `<form><label class="field-label" for="plug-new-name">Name</label><input class="field" id="plug-new-name" name="name" required maxlength="100"><label class="field-label" for="plug-new-description">Description</label><textarea class="field" id="plug-new-description" name="description" required rows="3" maxlength="500"></textarea><p class="muted">This adds a sample plugin to this preview.</p><div class="actions"><button class="pill primary">${create ? 'Create' : 'Add'} plugin</button></div></form>`, d => {
            d.querySelector<HTMLFormElement>('form').onsubmit = event => {
                event.preventDefault();
                const form = event.currentTarget, name = ((form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement).value.trim(), description = ((form as HTMLFormElement).elements.namedItem('description') as HTMLInputElement).value.trim();
                if (!name || !description)
                    return;
                if (allItems().some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
                    ((form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement).setCustomValidity('A plugin with this name already exists.');
                    ((form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement).oninput = () => ((form as HTMLFormElement).elements.namedItem('name') as HTMLInputElement).setCustomValidity('');
                    (form as HTMLFormElement).reportValidity();
                    return;
                }
                custom.push({ name, description });
                installed.add(name);
                search = name;
                document.querySelector<HTMLInputElement>('#plug-search').value = name;
                refresh();
                d.close();
                toast('Sample plugin added');
            };
        });
    }
    function manage() {
        rememberSharedDialog("managePlugins");
        const saved = allItems().filter(item => installed.has(item.name));
        dialog('Manage plugins', saved.length ? saved.map(item => `<div class="row plug-managed">${picture(item)}<span>${esc(item.name)}</span><button class="pill" data-plug-remove="${esc(item.name)}">Remove</button></div>`).join('') : '<p class="muted">No installed plugins</p>', d => {
            d.querySelectorAll<HTMLElement>('[data-plug-remove]').forEach(button => { button.onclick = () => { installed.delete(button.dataset.plugRemove); refresh(); d.close(); manage(); }; });
        });
    }
    function bindRows() {
        document.querySelectorAll<HTMLElement>('[data-plug-detail]').forEach(button => button.onclick = () => { const item = allItems().find(item => item.name === button.dataset.plugDetail); if (item)
            details(item); });
        document.querySelectorAll<HTMLElement>('[data-plug-install]').forEach(button => button.onclick = () => { const item = allItems().find(item => item.name === button.dataset.plugInstall); if (item)
            toggleInstall(item); });
        document.querySelectorAll<HTMLElement>('[data-plug-skill]').forEach(button => button.onclick = () => editSkill(skills[Number(button.dataset.plugSkill)]));
        const clear = document.querySelector<HTMLElement>('#plug-clear');
        if (clear)
            clear.onclick = () => { search = ''; (document.querySelector<HTMLElement>('#plug-search') as HTMLInputElement).value = ''; refresh(); document.querySelector<HTMLElement>('#plug-search').focus(); };
    }
    registerSharedDialog('plugin', name => details(allItems().find(item => item.name === name)), name => typeof name === 'string' && allItems().some(item => item.name === name));
    registerSharedDialog('skill', index => editSkill(index === null ? undefined : skills[Number(index)]), index => index === null || typeof index === 'number' && !!skills[index]);
    registerSharedDialog('addPlugin', value => addPlugin(value), value => typeof value === 'boolean');
    registerSharedDialog('managePlugins', () => manage(), value => value === null);
    return {
        title: 'Customize',
        sidebar: `<div class="side-body"><button class="row ${skillView ? '' : 'active'}" id="plug-nav-plugins">${icon('plugin')}<span>Plugins</span></button><button class="row ${skillView ? 'active' : ''}" id="plug-nav-skills">${icon('page')}<span>Skills</span></button><div class="side-section">Installed</div><div id="plug-installed">${sideRows()}</div></div>`,
        main: `<section class="page-content plug-page" aria-labelledby="plug-heading"><header class="page-header plug-header"><h1 id="plug-heading">${skillView ? 'Skills' : 'Plugins'}</h1><div class="page-tools">${`<label class="search-field">${icon('search')}<input id="plug-search" type="search" placeholder="Search" aria-label="Search ${skillView ? 'skills' : 'plugins'}"></label>${skillView ? '' : `<button class="icon-button" id="plug-manage" aria-label="Manage plugins" title="Manage plugins">${icon('filter')}</button>`}`}<button class="icon-button" id="plug-add" aria-label="${skillView ? 'New skill' : 'Add plugin'}" title="${skillView ? 'New skill' : 'Add plugin'}">${icon('plus')}</button></div></header><p class="plug-subtitle muted">${skillView ? 'Set a shared approach with sample instructions' : 'Bring your team tools and resources together'}</p>${skillView ? '' : '<div class="tabs plug-tabs" role="tablist" aria-label="Plugin source"><button class="tab" data-plug-tab="Public" role="tab" aria-selected="true">Public</button><button class="tab" data-plug-tab="Personal" role="tab" aria-selected="false">Personal</button></div>'}<div id="plug-list">${skillView ? skillMarkup() : listMarkup()}</div></section>`,
        mount() {
            document.querySelector<HTMLElement>('#plug-nav-plugins').onclick = () => navigate('plugins');
            document.querySelector<HTMLElement>('#plug-nav-skills').onclick = () => navigate('skills');
            document.querySelector<HTMLElement>('#plug-add').onclick = event => skillView ? editSkill() : menu((event.currentTarget as HTMLElement), [{ label: 'Add plugin', action: () => addPlugin(false) }, { label: 'Create plugin', action: () => addPlugin(true) }]);
            document.querySelector<HTMLElement>('#plug-search').oninput = event => { search = (event.target as HTMLInputElement).value; refresh(); };
            if (!skillView) {
                document.querySelector<HTMLElement>('#plug-manage').onclick = manage;
                document.querySelectorAll<HTMLElement>('[data-plug-tab]').forEach(button => { button.onclick = () => { tab = button.dataset.plugTab; document.querySelectorAll<HTMLElement>('[data-plug-tab]').forEach(el => el.setAttribute('aria-selected', String(el === button))); refresh(); }; });
            }
            (document.querySelector('#plug-search') as HTMLInputElement).value = search;
            document.querySelectorAll<HTMLElement>('[data-plug-tab]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.plugTab === tab)));
            bindRows();
        }
    };
}
