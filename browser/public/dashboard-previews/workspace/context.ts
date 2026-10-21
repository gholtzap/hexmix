import { linkPreviewData, registerSharedDialog, rememberSharedDialog, restoreSharedDialog } from './shared.js';
import { readViewState, stateScope } from '../../share-state.ts';
import { dialog, esc, toast, navigate } from './ui.js';
let sharedContext: string | null = null;
function personalContext() {
    if (sharedContext !== null) return sharedContext;
    try { return localStorage.getItem('pebble-context') || ''; }
    catch { return ''; }
}
linkPreviewData('context', () => ({ text: personalContext() }), value => { if (readViewState().views[stateScope()]?.['workspace.context'] !== undefined) sharedContext = value.text; });
export function contextDialog() {
    rememberSharedDialog("context");
    const context = personalContext();
    dialog('personal assistant', `<form><label class="field-label" for="dot-context">Personal context</label><textarea class="field" id="dot-context" rows="7" maxlength="10000" placeholder="Goals, preferences, and project notes">${esc(context)}</textarea><div class="actions"><button class="pill primary" style="color:var(--p-on-primary,var(--p-background))">Save context</button><button type="button" class="pill" data-clear>Clear</button></div><p role="status"></p></form>`, d => {
        const field = d.querySelector<HTMLTextAreaElement>('textarea'), status = d.querySelector<HTMLElement>('[role=status]');
        const save = () => { try {
            if (sharedContext !== null) sharedContext = field.value;
            else localStorage.setItem('pebble-context', field.value);
            d.close();
            toast('Personal context saved');
        }
        catch {
            status.textContent = 'Context could not be saved. Allow browser storage and try again.';
        } };
        d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); save(); };
        d.querySelector<HTMLElement>('[data-clear]').onclick = () => { field.value = ''; save(); };
    });
}
export function startTask(topic) {
    rememberSharedDialog("startTask", String(topic));
    dialog(topic, `<form><label class="field-label" for="task-goal">What would you like to work on?</label><textarea class="field" id="task-goal" required rows="4" maxlength="2000">${esc(topic)}: </textarea><div class="actions"><button class="pill primary">Continue in Work</button></div></form>`, d => {
        d.querySelector<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const goal = d.querySelector<HTMLTextAreaElement>('textarea').value.trim(); if (!goal)
            return; d.close(); navigate('work'); requestAnimationFrame(() => { const input = document.querySelector<HTMLTextAreaElement>('.composer textarea'); if (input) {
            input.value = goal;
            input.dispatchEvent(new Event('input'));
            input.focus();
        } }); };
    });
}

registerSharedDialog("context", () => contextDialog(), value => value === null);
registerSharedDialog("startTask", topic => startTask(topic), value => typeof value === "string" && value.length <= 2000);
