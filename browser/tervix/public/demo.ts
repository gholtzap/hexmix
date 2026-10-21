(() => {
    const plans = [
        ['PjJi2uwE8C', 'Shared workspace setup', 'Bring a new team space into a clear plan. Review the details together before work begins.'],
        ['9VKXIVLodv', 'Review a stalled plan', 'Bring a blocked item into view, agree on the next step, and keep the team informed.'],
        ['eBZ79EhNc4', 'Plan a launch', 'Bring the steps of a launch together and share progress with the people who need it.'],
        ['nc9BX6RTbw', 'Review a key decision', 'Give the team a clear way to review a decision before it moves forward.'],
        ['jYlUdEKvT7', 'Check project health', 'See the state of a shared project and decide where to focus next.'],
        ['ACRc5OXCPq', 'Review a resource request', 'Bring a request and its context together before the team makes a change.'],
        ['3YHSAVUHf1', 'Business planning idea 1', 'Keep a shared plan clear when new information changes the next step.'],
        ['OFS0uu1avy', 'Business planning idea 2', 'See important signals together and choose a practical way forward.'],
        ['vaFspyxyvB', 'Business planning idea 3', 'Review a change with the right people and keep the work moving.'],
        ['rrZAL03VqY', 'Business planning idea 4', 'Bring a new concern into view and agree on a shared response.'],
        ['2L3ETRCSDi', 'Business planning idea 5', 'Understand a change in progress and decide what the team needs next.'],
        ['LV9vzHEHaI', 'Business planning idea 6', 'Keep the right people informed when a plan needs attention.'],
        ['G3szpohD2Z', 'A shared health check', 'Review the state of a project with useful context close at hand.'],
        ['0a0PS2rxOh', 'A clear project review', 'Bring new findings into one view and choose the next useful action.'],
        ['w93aEhDAxK', 'A focused team decision', 'Give the team time and context to choose a clear direction.'],
    ];
    const categories = ['Team planning', 'Business overview', 'Shared priorities', 'Project review', 'New opportunities', 'People', 'Projects', 'Resources', 'Decisions', 'Progress', 'Customer needs', 'Ideas', 'Delivery', 'Support', 'Operations', 'Growth', 'Insights', 'Follow-up'];
    const activeId = location.pathname.split('/').pop();
    let active = plans.find(([id]) => id === activeId) || plans[0];
    const $ = selector => document.querySelector<HTMLElement>(selector);
    const render = () => {
        const [, title, description] = active;
        document.title = `${title} | Tervix`;
        $('#demo-title').textContent = title;
        $('#demo-description').textContent = description;
        const labels = ['A new signal', 'Review the context', 'Set a clear goal', 'Share with the team', 'Confirm the direction', 'Take the next step', 'Keep the record'];
        $('#flow-nodes').innerHTML = labels.map((label, index) => `<div class="flow-node"><span>${index === 0 ? 'Start' : index === 4 ? 'Decision' : 'Action'}</span><strong>${label}</strong></div>`).join('');
        $('#workflow-tabs').innerHTML = plans.slice(0, 6).map(([id, label]) => `<button type="button" data-plan="${id}" aria-current="${id === active[0]}">${label}</button>`).join('');
    };
    render();
    $('#demo-categories').innerHTML = categories.map((label, index) => `<button type="button" aria-expanded="false"><span aria-hidden="true">${['◇', '◈', '◌', '✧'][index % 4]}</span>${label}</button>`).join('');
    $('#demo-categories').addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('button');
        if (!button)
            return;
        button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
    });
    $('#search').addEventListener('input', event => {
        const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
        for (const button of $('#demo-categories').querySelectorAll<HTMLElement>('button'))
            button.hidden = !button.textContent.toLowerCase().includes(query);
    });
    $('#workflow-tabs').addEventListener('click', event => {
        const id = (event.target as Element).closest<HTMLElement>('[data-plan]')?.dataset.plan;
        if (!id)
            return;
        active = plans.find(plan => plan[0] === id);
        history.replaceState(null, '', `/b/${id}`);
        render();
    });
    const dialog = $('#demo-dialog');
    const show = (title, copy) => { $('#dialog-title').textContent = title; $('#dialog-copy').textContent = copy; (dialog as HTMLDialogElement).showModal(); };
    $('#dialog-close').addEventListener('click', () => (dialog as HTMLDialogElement).close());
    $('#test-action').addEventListener('click', () => show('Review this plan', 'This local preview shows how the steps fit together.'));
    $('#share-action').addEventListener('click', () => show('Share this plan', 'The plan is ready for your team to review.'));
    $('#save-action').addEventListener('click', () => show('Plan saved', 'Your changes are saved in this local preview.'));
    $('#custom-action').addEventListener('click', () => show('Create a custom step', 'Add a new action that fits the way your team works.'));
    $('#display-action').addEventListener('click', () => document.body.classList.toggle('compact-view'));
    $('#interval').addEventListener('click', event => {
        const values = ['Every day', 'Every week', 'Every month'];
        const current = values.findIndex(value => (event.currentTarget as Element).textContent.includes(value));
        (event.currentTarget as Element).innerHTML = `${values[(current + 1) % values.length]} <span aria-hidden="true">⌄</span>`;
    });
    $('#close-agent').addEventListener('click', () => { $('.agent-card').hidden = true; $('#open-agent').hidden = false; });
    $('#open-agent').addEventListener('click', () => { $('.agent-card').hidden = false; $('#open-agent').hidden = true; });
    const generate = () => {
        const prompt = ($('#agent-prompt') as HTMLInputElement).value.trim();
        ($('#agent-prompt') as HTMLInputElement).setCustomValidity(prompt ? '' : 'Describe a plan first.');
        if (!($('#agent-prompt') as HTMLInputElement).reportValidity())
            return;
        ($('#agent-prompt') as HTMLInputElement).setCustomValidity('');
        $('.agent-status').textContent = 'A draft plan is ready for review.';
        $('#demo-description').textContent = prompt.slice(0, 140);
    };
    $('#generate-action').addEventListener('click', generate);
    $('#agent-prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
        generate(); });
})();
