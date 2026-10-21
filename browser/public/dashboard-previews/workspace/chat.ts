import { linkPreviewData, registerSharedDialog, rememberSharedDialog, restoreSharedDialog } from './shared.js';
import { matchesShape } from '../../share-state.ts';
import { contextDialog } from './context.js';
import { icon, esc, dialog, menu, toast, navigate } from './ui.js';
const chats = ['Plan the next quarter', 'Ideas for the next project', 'Write a weekly update', 'Explore a business idea', 'Organize meeting notes', 'A shared business plan', 'Build a resource list', 'Compare design options', 'A guide to team planning', 'Explore new opportunities', 'Prepare for a presentation', 'Create a project checklist'];
const projects = ['Design studio', 'Team planning', 'Business priorities'];
type Message = { role: 'user' | 'assistant'; text: string; attachments?: string[] };
const conversations = new Map<string, Message[]>();
let messages: Message[] = [], power = 1, project = '', temporary = false, draft = '';
let attachments: string[] = [];
let activeChat: string | null = null;
linkPreviewData('chat', () => ({ conversations: [...conversations], messages, power, project, temporary, draft, projects, attachments, activeChat }), value => {
 conversations.clear(); for (const [name, thread] of value.conversations) conversations.set(name, thread);
 projects.splice(0, projects.length, ...value.projects); attachments = value.attachments;
 activeChat = typeof value.activeChat === 'string' && conversations.has(value.activeChat) ? value.activeChat : null;
 // Older shared views did not include the active conversation name.
 activeChat ??= [...conversations].find(([, thread]) => JSON.stringify(thread) === JSON.stringify(value.messages))?.[0] ?? null;
 power = value.power; project = value.project; temporary = value.temporary; draft = value.draft;
 messages = !temporary && activeChat !== null ? conversations.get(activeChat)! : value.messages;
}, { validate: value => matchesShape(value, { conversations: [['', [{ role: '', text: '' }]]], messages: [{ role: '', text: '' }], power: 1, project: '', temporary: false, draft: '', projects: [''], attachments: [''] }) });
function openChat(title: string, view = 'chat') {
    if (!conversations.has(title)) conversations.set(title, [
        { role: 'user', text: title },
        { role: 'assistant', text: 'This sample chat is ready for your ideas. Add a message to try the local conversation view.' },
    ]);
    activeChat = title;
    messages = conversations.get(title);
    draft = '';
    attachments = [];
    navigate(view);
}
function newChat(view: string) { activeChat = null; messages = []; project = ''; draft = ''; attachments = []; navigate(view); }
function chatTitles() { return [...new Set([...conversations.keys()].reverse().concat(chats))]; }
function recentRows() { return chatTitles().map(title => `<button class="row side-recent" data-tooltip-label="${esc(title)}" data-sample-chat="${esc(title)}"><span>${esc(title)}</span></button>`).join(''); }
function saveChat() {
    if (temporary) return;
    if (activeChat === null) {
        const base = messages.find(message => message.role === 'user')!.text.slice(0, 80);
        const names = new Set(chatTitles());
        activeChat = base;
        for (let suffix = 2; names.has(activeChat); suffix++) activeChat = `${base} (${suffix})`;
    }
    conversations.delete(activeChat);
    conversations.set(activeChat, messages);
}
function attachmentMarkup(names: unknown) {
    return Array.isArray(names) ? names.filter(name => typeof name === 'string').map(name => `<span class="attachment">${esc(name)}</span>`).join('') : '';
}
const powers = ['Light', 'Medium', 'High', 'Extra high', 'Maximum'];
export function chatPage(view = 'chat') {
    const work = view === 'work';
    return { title: 'Pebble', sidebar: `<button class="row" data-new-chat>${icon('edit')}<span>New chat</span></button><button class="row" data-dot><i class="dot"></i><span>personal assistant</span></button><div class="side-section">Pinned</div><button class="row" data-sample-chat="A guide to team planning">${icon('star')}<span>Team planning</span></button><div class="side-section"><span>Projects</span><button class="icon-button" aria-label="Add new project" data-new-project>${icon('plus')}</button></div>${projects.map(p => `<button class="row" data-project="${esc(p)}">${icon('folder')}<span>${esc(p)}</span></button>`).join('')}<div class="side-section"><span>Recents</span><button class="icon-button" aria-label="Chat sidebar options" data-chat-options>${icon('more')}</button></div><div data-chat-recents>${recentRows()}</div>`,
        main: `<section class="chat-main ${work ? 'chat-work' : ''} ${messages.length ? 'has-messages' : ''}"><div class="mode-switch" data-mode-control></div><button class="icon-button temporary" aria-label="Temporary chat" aria-pressed="${temporary}" title="Temporary chat">${icon('temporary')}</button><h1 class="chat-welcome">${temporary ? 'Temporary chat' : work ? 'What should we work on?' : 'What’s on your mind today?'}</h1><div class="chat-conversation" aria-live="polite"></div><div class="chat-input-area"><div class="project-badge">${esc(project)}</div><div class="attachments"></div><form class="composer">${work ? '<textarea aria-label="Work with Pebble" placeholder="Work with Pebble" rows="1"></textarea>' : ''}<div class="chat-tools"><button type="button" class="icon-button add-button" aria-label="Add files and more">${icon('plus')}</button>${work ? '' : '<textarea aria-label="Ask Pebble" placeholder="Ask Pebble" rows="1"></textarea>'}<button type="button" class="model-button" aria-label="Select Pebble model · ${work ? 'Business assistant ' : ''}${powers[power]}">${work ? 'Business assistant ' : ''}<span class="power-label">${powers[power]}</span>${icon('chevron')}</button><button type="button" class="icon-button dictate" aria-label="Dictate">${icon('mic')}</button><button class="icon-button voice" type="button" aria-label="Start Voice">${icon('voice')}</button></div></form>${work ? `<div class="work-strip"><button data-choose-project>${icon('folder')}Choose project</button><button data-files>${icon('page')}Files</button><button data-plugins>${icon('plugin')}Plugins</button><button data-desktop>Open work view</button></div>` : ''}<div class="suggestions"><button class="suggestion"><span class="notion">N</span><span>Help me organize my notes so I can find what I need</span></button>${work ? '<button class="suggestion"><span class="notion">#</span><span>Catch me up on messages I missed</span></button>' : ''}</div></div><p class="disclaimer">Pebble is AI and can make mistakes. Check important info.</p><input type="file" id="chat-files" hidden multiple></section>`,
        mount() {
            const main = document.querySelector<HTMLElement>('.chat-main'), input = main.querySelector<HTMLTextAreaElement>('textarea'), form = main.querySelector<HTMLFormElement>('form'), voice = main.querySelector<HTMLElement>('.voice');
            function renderRecents() {
                document.querySelector<HTMLElement>('[data-chat-recents]').innerHTML = recentRows();
                document.querySelectorAll<HTMLElement>('[data-sample-chat]').forEach(button => button.onclick = () => openChat(button.dataset.sampleChat, view));
            }
            function renderMessages() { main.classList.toggle('has-messages', !!messages.length); window.dashboardComponents.unmountWithin(main.querySelector<HTMLElement>('.chat-conversation')); main.querySelector<HTMLElement>('.chat-conversation').innerHTML = messages.map(m => `<div class="chat-message ${m.role}">${m.role === 'assistant' ? '<div data-ai-response></div>' : esc(m.text) + (m.attachments ? `<div class="attachments">${attachmentMarkup(m.attachments)}</div>` : '')}${m.role === 'assistant' ? `<div class="message-actions"><button class="icon-button" data-copy aria-label="Copy response">${icon('copy')}</button></div>` : ''}</div>`).join(''); main.querySelectorAll<HTMLElement>('[data-ai-response]').forEach((host, i) => window.dashboardComponents.response(host, messages.filter(m => m.role === 'assistant')[i].text)); main.querySelectorAll<HTMLElement>('[data-copy]').forEach(b => b.onclick = async () => { try {
                await navigator.clipboard.writeText((b.parentElement.parentElement.firstChild as HTMLElement).innerText);
                toast('Copied');
            }
            catch {
                toast('Copy is not available in this browser.');
            } }); }
            function submit() { const value = input.value.trim(); if (!value)
                return; messages.push({ role: 'user', text: value, ...(attachments.length ? { attachments: [...attachments] } : {}) }, { role: 'assistant', text: `Task: ${value}\n\n1. Define the result you need.\n2. Collect the required details.\n3. Review the next action with your team.\n\nAdd your notes below to develop this plan.` }); saveChat(); renderRecents(); input.value = ''; attachments = []; fileInput.value = ''; renderAttachments(); updateSend(); renderMessages(); main.querySelector<HTMLElement>('.chat-conversation').scrollTop = 1e9; }
            function updateSend() { draft = input.value; const sending = !!input.value.trim(); (voice as HTMLInputElement).type = sending ? 'submit' : 'button'; voice.setAttribute('aria-label', sending ? 'Send message' : 'Start Voice'); voice.innerHTML = icon(sending ? 'arrow' : 'voice'); }
            input.value = draft;
            updateSend();
            input.oninput = updateSend;
            input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
            } };
            form.onsubmit = e => { e.preventDefault(); submit(); };
            voice.onclick = () => { if (input.value.trim())
                return; dictate(true); };
            function dictate(voiceMode = false) {
                rememberSharedDialog("dictate", voiceMode);
                let recognition;
                dialog(voiceMode ? 'Voice' : 'Dictate', `${voiceMode ? '<div class="voice-orb" data-voice-orb></div>' : ''}<form><label class="field-label" for="voice-transcript">Message</label><textarea id="voice-transcript" class="field" required rows="4" maxlength="4000" placeholder="Speak or type your message"></textarea><p role="status"></p><div class="actions"><button type="button" class="pill" data-record>Start recording</button><button class="pill primary">Use message</button></div></form>`, d => {
                    const transcript = d.querySelector<HTMLTextAreaElement>('textarea'), record = d.querySelector<HTMLElement>('[data-record]'), status = d.querySelector<HTMLElement>('[role=status]');
                    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
                    if (!Speech) {
                        record.remove();
                        status.textContent = 'Type your message, then select Use message.';
                    }
                    else
                        record.onclick = () => { if (recognition) {
                            recognition.stop();
                            recognition = null;
                            record.textContent = 'Start recording';
                            return;
                        } recognition = new Speech(); recognition.onresult = e => { transcript.value = Array.from(e.results).map(result => result[0].transcript).join(' '); }; recognition.onerror = () => { status.textContent = 'Recording stopped. You can type or edit your message.'; }; recognition.onend = () => { record.textContent = 'Start recording'; recognition = null; }; recognition.start(); record.textContent = 'Stop recording'; };
                    d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); recognition?.stop(); input.value = transcript.value; updateSend(); d.close(); input.focus(); };
                    new MutationObserver((_, observer) => { if (!d.isConnected) {
                        recognition?.stop();
                        observer.disconnect();
                    } }).observe(document.body, { childList: true });
                });
            }
            main.querySelector<HTMLElement>('.dictate').onclick = () => dictate();
            window.dashboardComponents.mode(main.querySelector<HTMLElement>('[data-mode-control]'), work, navigate);
            main.querySelector<HTMLElement>('.temporary').onclick = () => { temporary = !temporary; newChat(view); };
            main.querySelector<HTMLElement>('.model-button').onclick = e => {
                const anchor = e.currentTarget;
                document.querySelectorAll<HTMLElement>('.menu').forEach(m => m.remove());
                const panel = document.createElement('div');
                panel.className = 'menu model-power';
                panel.setAttribute('role', 'dialog');
                panel.setAttribute('aria-label', 'Select model');
                panel.innerHTML = `<span class="model-power-label">${powers[power]} ›</span><div data-effort-control></div>`;
                document.body.append(panel);
                const r = (anchor as Element).getBoundingClientRect();
                panel.style.left = Math.min(innerWidth - 264, Math.max(8, r.right - 254)) + 'px';
                panel.style.top = (r.bottom + 90 > innerHeight ? r.top - 90 : r.bottom + 6) + 'px';
                window.dashboardComponents.effort(panel.querySelector<HTMLElement>('[data-effort-control]'), power, value => { power = value; panel.querySelector<HTMLElement>('.model-power-label').textContent = powers[power] + ' ›'; (anchor as Element).querySelector<HTMLElement>('.power-label').textContent = powers[power]; (anchor as Element).setAttribute('aria-label', 'Select Pebble model · ' + (work ? 'Business assistant ' : '') + powers[power]); });
                panel.querySelector<HTMLInputElement>('input').focus();
                const close = () => { window.dashboardComponents.unmountWithin(panel); panel.remove(); document.removeEventListener('pointerdown', outside); };
                const outside = event => { if (!panel.contains(event.target) && !(anchor as Element).contains(event.target))
                    close(); };
                document.addEventListener('pointerdown', outside);
                panel.onkeydown = event => { if (event.key === 'Escape') {
                    close();
                    (anchor as HTMLElement).focus();
                } };
            };
            const fileInput = main.querySelector<HTMLInputElement>('#chat-files');
            const renderAttachments = () => { main.querySelector<HTMLElement>('.chat-input-area > .attachments').innerHTML = attachmentMarkup(attachments); };
            fileInput.onchange = () => { attachments.push(...[...fileInput.files].map(file => file.name)); renderAttachments(); };
            renderAttachments();
            function chooseProject() { rememberSharedDialog('chooseProject'); dialog('Choose project', projects.map(p => `<button class="row" data-select="${esc(p)}">${icon('folder')}${esc(p)}</button>`).join(''), d => d.querySelectorAll<HTMLElement>('[data-select]').forEach(b => b.onclick = () => { project = b.dataset.select; main.querySelector<HTMLElement>('.project-badge').textContent = project; d.close(); })); }
            registerSharedDialog('dictate', value => dictate(Boolean(value)), value => typeof value === 'boolean');
            registerSharedDialog('chooseProject', () => chooseProject(), value => value === null);
            const openAddPage = () => { rememberSharedDialog('addPage'); return dialog('Add a page', '<form><label class="field-label" for="page-url">Page URL</label><input id="page-url" class="field" type="url" required placeholder="https://example.com"><div class="actions"><button class="pill primary">Add page</button></div></form>', d => d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const url = d.querySelector<HTMLInputElement>('input').value; input.value = `Review this page: ${url}`; updateSend(); d.close(); input.focus(); }); };
            registerSharedDialog('addPage', () => openAddPage(), value => value === null);
            const openSketch = () => { rememberSharedDialog('sketch'); return dialog('Sketch', '<canvas class="sketch-canvas" width="480" height="280" aria-label="Drawing canvas"></canvas><div class="actions"><button class="pill" data-clear>Clear</button><button class="pill primary" data-attach>Attach sketch</button></div>', d => {
                        const canvas = d.querySelector<HTMLCanvasElement>('canvas'), ctx = canvas.getContext('2d'), strokes = [];
                        let drawing = false, current;
                        linkPreviewData('sketch', () => ({ strokes }), value => { strokes.splice(0, strokes.length, ...value.strokes); }, { validate: value => matchesShape(value, { strokes: [[[0, 0]]] }) });
                        const paint = () => { const colors = getComputedStyle(document.documentElement); ctx.fillStyle = colors.getPropertyValue('--p-background').trim() || '#ffffff'; ctx.fillRect(0, 0, 480, 280); ctx.strokeStyle = colors.getPropertyValue('--p-text').trim() || '#171717'; ctx.lineWidth = 3; for (const stroke of strokes) {
                            ctx.beginPath();
                            ctx.moveTo(stroke[0][0], stroke[0][1]);
                            for (const point of stroke.slice(1))
                                ctx.lineTo(point[0], point[1]);
                            ctx.stroke();
                        } };
                        const observer = new MutationObserver(() => { if (!canvas.isConnected) {
                            observer.disconnect();
                            return;
                        } paint(); });
                        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
                        paint();
                        const point = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * 480 / r.width, (e.clientY - r.top) * 280 / r.height]; };
                        canvas.onpointerdown = e => { drawing = true; canvas.setPointerCapture(e.pointerId); current = [point(e)]; strokes.push(current); };
                        canvas.onpointermove = e => { if (drawing) {
                            current.push(point(e));
                            paint();
                        } };
                        canvas.onpointerup = () => drawing = false;
                        canvas.onpointercancel = () => drawing = false;
                        d.querySelector<HTMLElement>('[data-clear]').onclick = () => { strokes.length = 0; paint(); };
                        d.querySelector<HTMLElement>('[data-attach]').onclick = () => canvas.toBlob(blob => { const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'sketch.png', { type: 'image/png' })); fileInput.files = transfer.files; fileInput.dispatchEvent(new Event('change')); d.close(); });
                    }); };
            registerSharedDialog('sketch', () => openSketch(), value => value === null);
            main.querySelector<HTMLElement>('.add-button').onclick = e => menu((e.currentTarget as HTMLElement), [{ label: 'Add photos & files', action: () => { if (!document.documentElement.hasAttribute('data-comparison-replay')) fileInput.click(); } }, { label: 'Add from library', action: () => navigate('space') }, { label: 'Create image', action: () => { input.value = 'Create an image of '; input.focus(); updateSend(); } }, { label: 'Add browser tabs', action: openAddPage }, { label: 'Web search', action: () => { input.value = 'Search the web for '; input.focus(); updateSend(); } }, { label: 'Work in a project', action: chooseProject }, { label: 'Deep research', action: () => { input.value = 'Research '; input.focus(); updateSend(); } }, { label: 'Sketch', action: openSketch }, { label: 'Plugins', action: () => navigate('plugins') }]);
            main.querySelectorAll<HTMLElement>('.suggestion').forEach(b => b.onclick = () => { input.value = b.querySelector<HTMLElement>('span:last-child').textContent; input.focus(); updateSend(); });
            main.querySelector<HTMLElement>('[data-choose-project]')?.addEventListener('click', chooseProject);
            main.querySelector<HTMLElement>('[data-files]')?.addEventListener('click', () => fileInput.click());
            main.querySelector<HTMLElement>('[data-plugins]')?.addEventListener('click', () => navigate('plugins'));
            main.querySelector<HTMLElement>('[data-desktop]')?.addEventListener('click', () => navigate('work'));
            document.querySelector<HTMLElement>('[data-new-chat]').onclick = () => newChat(view);
            document.querySelector<HTMLElement>('[data-dot]').onclick = () => contextDialog();
            renderRecents();
            document.querySelectorAll<HTMLElement>('[data-project]').forEach(b => b.onclick = () => { project = b.dataset.project; main.querySelector<HTMLElement>('.project-badge').textContent = project; input.focus(); });
            const openNewProject = () => { rememberSharedDialog('newProject'); return dialog('New project', '<form><label class="field-label" for="project-name">Project name</label><input id="project-name" class="field" required maxlength="80"><div class="actions"><button class="pill primary">Create project</button></div></form>', d => d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const name = d.querySelector<HTMLInputElement>('input').value.trim(); if (!name)
                return; projects.push(name); project = name; d.close(); navigate(view); }); };
            registerSharedDialog('newProject', () => openNewProject(), value => value === null);
            document.querySelector<HTMLElement>('[data-new-project]').onclick = openNewProject;
            document.querySelector<HTMLElement>('[data-chat-options]').onclick = e => menu((e.currentTarget as HTMLElement), [{ label: 'Search chats', action: searchChats }, { label: 'New chat', action: () => newChat(view) }]);
            renderMessages();
        } };
}
export function searchChats() { rememberSharedDialog('chatSearch'); dialog('Search chats', `<input class="field" type="search" placeholder="Search chats" aria-label="Search chats"><div class="chat-search-results"></div>`, d => { const input = d.querySelector<HTMLInputElement>('input'), results = d.querySelector<HTMLElement>('.chat-search-results'); const render = () => { const list = chatTitles().filter(title => [title, ...(conversations.get(title) ?? []).map(message => message.text)].join(' ').toLowerCase().includes(input.value.toLowerCase())); results.innerHTML = list.length ? list.map(c => `<button class="row">${icon('edit')}${esc(c)}</button>`).join('') : '<p class="empty-state">No chats found</p>'; [...results.querySelectorAll<HTMLElement>('button')].forEach((b, i) => b.onclick = () => { d.close(); openChat(list[i]); }); }; input.oninput = render; render(); }); }

registerSharedDialog("chatSearch", () => searchChats(), value => value === null);
