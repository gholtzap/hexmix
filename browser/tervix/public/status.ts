(() => {
    const history = document.getElementById('history');
    history.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - index);
        return `<div class="history-day"><h3>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h3><p>No sample updates for this day.</p></div>`;
    }).join('');
    const dialog = document.getElementById('updates');
    document.getElementById('subscribe').addEventListener('click', () => (dialog as HTMLDialogElement).showModal());
    document.getElementById('close-updates').addEventListener('click', () => (dialog as HTMLDialogElement).close());
    document.getElementById('updates-form').addEventListener('submit', event => {
        event.preventDefault();
        dialog.querySelector<HTMLElement>('[role="status"]').textContent = 'Updates are not sent from this local preview.';
        (event.currentTarget as HTMLFormElement).reset();
    });
})();
