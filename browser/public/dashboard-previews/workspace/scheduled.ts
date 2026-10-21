import { contextDialog, startTask } from './context.js';
import { icon, esc, dialog, menu, toast } from './ui.js';
const suggestions = [
    ['☀️', 'Business updates', 'Send me a daily overview of team priorities.', 'Every day at 9:00 AM'],
    ['✉️', 'Email monitor', 'Scan my emails and let me know anything that needs my attention.', 'Every day at 9:00 AM'],
    ['📖', 'Review team plans', 'Send me a weekly overview of our next steps.', 'Every Saturday at 9:00 AM'],
    ['🎫', 'Progress updates', 'Review our shared goals and send a daily update.', 'Every day at 9:00 AM'],
    ['🎵', 'Explore opportunities', 'Review new business ideas each week.', 'Every Monday at 9:00 AM'],
    ['🎉', 'Plan the next week', 'Send me next steps for the week ahead.', 'Every Thursday at 9:00 AM']
];
// shortcut: tasks stay in memory, add storage when the preview needs saved tasks after reload.
const tasks = [];
let filter = 'All';
let nextId = 1;
function taskRows() {
    const visible = tasks.filter(task => filter === 'All' || (filter === 'Paused' ? task.paused : !task.paused));
    return visible.length ? visible.map(task => `<button class="row sched-task" data-sched-task="${task.id}">${icon(task.paused ? 'pause' : 'clock')}<span>${esc(task.title)}</span>${task.paused ? '<small class="muted">Paused</small>' : ''}</button>`).join('') : `<p class="side-note sched-empty">${tasks.length ? 'No matching tasks' : 'No scheduled tasks'}</p>`;
}
function renderTasks() {
    const list = document.querySelector<HTMLElement>('#sched-tasks');
    if (list) {
        list.innerHTML = taskRows();
        bindTaskRows();
    }
}
function taskForm(task = undefined) {
    const saved = task && 'id' in task;
    dialog(saved ? 'Task details' : 'New task', `<form id="sched-form">
    <label class="field-label" for="sched-title">Title</label><input class="field" id="sched-title" name="title" required maxlength="160" value="${esc(task?.title || '')}">
    <label class="field-label" for="sched-prompt">Prompt</label><textarea class="field" id="sched-prompt" name="prompt" required rows="4" maxlength="4000">${esc(task?.prompt || '')}</textarea>
    <label class="field-label" for="sched-schedule">Schedule</label><input class="field" id="sched-schedule" name="schedule" required maxlength="200" placeholder="Every day at 9:00 AM" value="${esc(task?.schedule || '')}">
    <p class="muted sched-local-note">Saved tasks stay in this browser session.</p>
    <div class="actions">${saved ? `<button type="button" class="pill" id="sched-delete">Delete</button><button type="button" class="pill" id="sched-work">Open in Work</button><button type="button" class="pill" id="sched-pause">${task.paused ? 'Resume' : 'Pause'}</button>` : ''}<button class="pill primary" type="submit">Save</button></div>
  </form>`, d => {
        d.querySelector<HTMLElement>('#sched-work')?.addEventListener('click', () => { d.close(); startTask(task.prompt); });
        d.querySelector<HTMLFormElement>('form').onsubmit = event => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = Object.fromEntries(['title', 'prompt', 'schedule'].map(name => [name, ((form as HTMLFormElement).elements.namedItem(name) as HTMLInputElement).value.trim()]));
            for (const name of ['title', 'prompt', 'schedule']) {
                const field = ((form as HTMLFormElement).elements.namedItem(name) as HTMLInputElement);
                field.setCustomValidity(values[name] ? '' : 'Enter a value.');
                field.oninput = () => field.setCustomValidity('');
            }
            if (!(form as HTMLFormElement).reportValidity())
                return;
            if (saved)
                Object.assign(task, values);
            else
                tasks.push({ ...values, id: nextId++, paused: false });
            renderTasks();
            d.close();
            toast(saved ? 'Task updated' : 'Task saved');
        };
        if (saved) {
            d.querySelector<HTMLElement>('#sched-pause').onclick = () => { task.paused = !task.paused; renderTasks(); d.close(); toast(task.paused ? 'Task paused' : 'Task resumed'); };
            d.querySelector<HTMLElement>('#sched-delete').onclick = () => { tasks.splice(tasks.indexOf(task), 1); renderTasks(); d.close(); toast('Task deleted'); };
        }
    });
}
function bindTaskRows() {
    document.querySelectorAll<HTMLElement>('[data-sched-task]').forEach(button => {
        button.onclick = () => { const task = tasks.find(task => task.id === Number(button.dataset.schedTask)); if (task)
            taskForm(task); };
    });
}
export function scheduledPage() {
    return {
        title: 'Scheduled',
        sidebar: `<div class="side-body"><button class="row sched-new" id="sched-new">${icon('plus')}<span>New task</span></button><div class="side-section"><span>Upcoming</span><button class="icon-button" id="sched-filter" aria-label="Filter tasks" title="Filter tasks">${icon('filter')}</button></div><div id="sched-tasks">${taskRows()}</div></div><div class="side-bottom"><button class="row" id="sched-your-dot"><i class="dot" aria-hidden="true"></i><span>personal assistant</span></button></div>`,
        main: `<section class="sched-page" aria-labelledby="sched-heading"><div class="sched-clock" aria-hidden="true">🕒</div><h1 id="sched-heading">Schedule a task</h1><p class="sched-subtitle">Pebble can take care of ongoing tasks so you don’t have to.</p><div class="sched-grid">${suggestions.map(([emoji, title, description], index) => `<button class="sched-card" data-sched-suggestion="${index}"><span class="sched-emoji" aria-hidden="true">${emoji}</span><span><span class="sched-card-title">${title}</span><span class="sched-card-description">${description}</span></span></button>`).join('')}</div></section>`,
        mount() {
            document.querySelector<HTMLElement>('#sched-new').onclick = () => taskForm();
            document.querySelector<HTMLElement>('#sched-filter').onclick = event => menu((event.currentTarget as HTMLElement), ['All', 'Active', 'Paused'].map(label => ({ label, action: () => { filter = label; renderTasks(); } })));
            document.querySelectorAll<HTMLElement>('[data-sched-suggestion]').forEach(button => { button.onclick = () => { const [, title, prompt, schedule] = suggestions[Number(button.dataset.schedSuggestion)]; taskForm({ title, prompt, schedule }); }; });
            document.querySelector<HTMLElement>('#sched-your-dot').onclick = contextDialog;
            bindTaskRows();
        }
    };
}
export function searchTasks() {
    dialog('Search tasks', '<label class="field-label" for="task-search">Search tasks</label><input id="task-search" class="field" type="search"><div data-task-results></div><div class="actions"><button class="pill primary" data-create-task>New task</button></div>', d => {
        const input = d.querySelector<HTMLInputElement>('input'), results = d.querySelector<HTMLElement>('[data-task-results]');
        function render() { const matches = tasks.filter(task => `${task.title} ${task.prompt}`.toLowerCase().includes(input.value.trim().toLowerCase())); results.innerHTML = matches.length ? matches.map(task => `<button class="row" data-task-result="${task.id}">${esc(task.title)}</button>`).join('') : '<p class="empty-state">No tasks found</p>'; results.querySelectorAll<HTMLElement>('[data-task-result]').forEach(button => button.onclick = () => { const task = tasks.find(task => task.id === Number(button.dataset.taskResult)); d.close(); if (task)
            taskForm(task); }); }
        input.oninput = render;
        d.querySelector<HTMLElement>('[data-create-task]').onclick = () => { d.close(); taskForm(); };
        render();
    });
}
