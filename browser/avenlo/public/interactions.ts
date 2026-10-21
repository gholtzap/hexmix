(() => {
    for (const [container, item, toggle] of [['.jobs', '.job', '.job__toggle'], ['.ifaces', '.iface', '.iface__toggle']]) {
        document.querySelector<HTMLElement>(container)?.addEventListener('click', event => {
            const button = (event.target as Element).closest<HTMLElement>(toggle);
            if (!button)
                return;
            document.querySelectorAll<HTMLElement>(`${container} ${item}`).forEach(card => {
                const open = card.contains(button);
                card.classList.toggle('is-open', open);
                card.querySelector<HTMLElement>(toggle)?.setAttribute('aria-expanded', String(open));
            });
        });
    }
    const dialog = document.querySelector<HTMLDialogElement>('#demo-popup');
    function openDemo() {
        dialog.showModal();
        dialog.classList.add('is-open');
    }
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/meet/"]').forEach(link => link.addEventListener('click', event => {
        if (link.closest<HTMLElement>('.local-demo'))
            return;
        event.preventDefault();
        openDemo();
    }));
    document.querySelectorAll<HTMLFormElement>('form').forEach(form => {
        form.querySelector<HTMLInputElement>('input[type="email"]')?.setAttribute('required', '');
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (form.reportValidity())
                openDemo();
        });
    });
    document.querySelectorAll<HTMLElement>('[data-demo-close]').forEach(button => button.addEventListener('click', () => {
        dialog.classList.remove('is-open');
        dialog.close();
    }));
    const cookieBanner = document.querySelector<HTMLElement>('[data-cookie-banner]');
    document.querySelector<HTMLElement>('[data-cookie-settings]')?.addEventListener('click', () => {
        cookieBanner.hidden = false;
        cookieBanner.removeAttribute('inert');
        cookieBanner.classList.add('is-visible');
        cookieBanner.querySelector<HTMLInputElement>('input')?.focus();
    });
    cookieBanner?.querySelectorAll<HTMLInputElement>('input[type="button"]').forEach(button => button.addEventListener('click', () => {
        cookieBanner.hidden = true;
        cookieBanner.setAttribute('inert', '');
        document.querySelector<HTMLElement>('[data-cookie-settings]')?.focus();
    }));
    const language = document.querySelector<HTMLElement>('.lang__btn');
    language?.addEventListener('click', () => {
        const open = language.getAttribute('aria-expanded') !== 'true';
        language.setAttribute('aria-expanded', String(open));
        language.closest<HTMLElement>('.lang')?.classList.toggle('is-open', open);
    });
})();
