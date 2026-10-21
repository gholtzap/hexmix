(() => {
    const dialog = document.querySelector<HTMLDialogElement>('#demo-popup');
    document.querySelectorAll<HTMLDialogElement>('a[href*="/meet/"], a[href="#demo-popup"]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            dialog?.showModal();
        }, true);
    });
    document.querySelectorAll<HTMLFormElement>('form').forEach(form => {
        form.querySelector<HTMLInputElement>('input[type="email"]')?.setAttribute('required', '');
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (form.reportValidity())
                dialog?.showModal();
        });
    });
    document.querySelector<HTMLElement>('[data-demo-close]')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', event => { if (event.target === dialog)
        dialog.close(); });
    document.querySelectorAll<HTMLElement>('.vsf__btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll<HTMLElement>('.vsf__item').forEach(item => {
                const open = item.contains(button);
                item.classList.toggle('is-open', open);
                item.querySelector<HTMLElement>('.vsf__btn')?.setAttribute('aria-expanded', String(open));
            });
        });
    });
})();
