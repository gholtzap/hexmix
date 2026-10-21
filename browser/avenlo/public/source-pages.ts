(() => {
    const more = document.querySelector<HTMLButtonElement>('[data-bl-more]');
    more?.addEventListener('click', () => {
        const hidden = [...document.querySelectorAll<HTMLElement>('.bl-list > li[hidden]')];
        hidden.slice(0, 20).forEach(item => { item.hidden = false; });
        more.hidden = hidden.length <= 20;
    });
    const dialog = document.querySelector<HTMLDialogElement>('#demo-popup');
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const demo = target?.closest<HTMLDialogElement>('a[data-local-demo],a[href="#demo-popup"]');
        if (demo) {
            event.preventDefault();
            dialog?.showModal();
            return;
        }
        if (target?.closest<HTMLElement>('[data-demo-close]')) {
            dialog?.close();
            return;
        }
        const button = target?.closest<HTMLElement>('main button[aria-controls]');
        const panel = button && document.getElementById(button.getAttribute('aria-controls'));
        if (panel) {
            const open = button.getAttribute('aria-expanded') !== 'true';
            button.setAttribute('aria-expanded', String(open));
            panel.hidden = !open;
            button.closest<HTMLElement>('[class*="__item"]')?.classList.toggle('is-open', open);
        }
    });
    dialog?.addEventListener('click', event => { if (event.target === dialog)
        dialog.close(); });
    document.querySelectorAll<HTMLFormElement>('form').forEach(form => {
        form.dataset.localDemo = 'true';
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (form.reportValidity())
                dialog?.showModal();
        });
    });
})();
