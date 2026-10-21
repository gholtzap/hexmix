(() => {
    const ready = () => {
        const dialog = document.createElement('dialog');
        dialog.className = 'tervix-dialog';
        dialog.innerHTML = '<h2>Take the next step</h2><p>Leave a note for your team.</p><form method="dialog" data-local-demo><label for="tervix-email">Email</label><input id="tervix-email" name="email" type="email" autocomplete="email" required><label for="tervix-note">Note</label><textarea id="tervix-note" name="note" placeholder="What would you like to explore?"></textarea><div role="status" aria-live="polite"></div><div class="actions"><button value="cancel" formnovalidate>Close</button><button class="primary" value="submit">Continue</button></div></form>';
        document.body.append(dialog);
        const form = dialog.querySelector<HTMLFormElement>('form');
        form.addEventListener('submit', event => {
            if ((event.submitter as HTMLInputElement)?.value !== 'submit')
                return;
            event.preventDefault();
            if (!form.reportValidity())
                return;
            dialog.querySelector<HTMLElement>('[role="status"]').textContent = 'Your note is ready to share.';
        });
        const showDialog = title => {
            dialog.querySelector<HTMLElement>('h2').textContent = title;
            dialog.querySelector<HTMLElement>('[role="status"]').textContent = '';
            dialog.showModal();
        };
        const linkTarget = label => {
            if (/log\s?in/i.test(label))
                return '/login';
            if (/sign\s?up|start free trial|get started/i.test(label))
                return '/register';
            if (/status|systems operational/i.test(label))
                return '/status';
            if (/book a scoping call|contact|conversation/i.test(label))
                return '/contact';
            if (/live demo|watch demo/i.test(label))
                return '/demo';
            if (/blog/i.test(label))
                return '/blog';
            if (/changelog/i.test(label))
                return '/changelog';
            if (/CLI/i.test(label))
                return '/workflows/cli';
            if (/clear next step/i.test(label))
                return '/quickstart/workflows';
            if (/home page/i.test(label))
                return '/';
            if (/powered by/i.test(label))
                return '/developers';
            return '/templates';
        };
        for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href="#"]')) {
            if (link.matches('body > a.fixed.top-0')) {
                link.removeAttribute('href');
                link.setAttribute('aria-hidden', 'true');
                link.tabIndex = -1;
                continue;
            }
            if (link.closest<HTMLElement>('footer') && (!link.textContent.trim() || /^(YouTube|X|x|professional-network)$/.test(link.textContent.trim()))) {
                link.href = '/about';
                link.setAttribute('aria-label', 'About Tervix');
                link.replaceChildren(Object.assign(document.createElement('span'), { className: 'tervix-social-mark' }));
            }
            else {
                link.href = linkTarget((link.getAttribute('aria-label') || '') + ' ' + link.textContent);
            }
            link.removeAttribute('target');
        }
        if (location.pathname === '/contact') {
            document.title = 'Start a conversation | Tervix';
            const heading = document.querySelector<HTMLElement>('h1');
            if (heading)
                heading.textContent = 'Start a conversation';
            showDialog('Schedule a conversation');
        }
        else if (location.pathname === '/about') {
            document.title = 'How we work | Tervix';
            const heading = document.querySelector<HTMLElement>('h1');
            if (heading)
                heading.textContent = 'How we work';
        }
        else if (location.pathname === '/developers') {
            document.title = 'Ways to connect | Tervix';
        }
        for (const button of document.querySelectorAll<HTMLElement>('nav button')) {
            button.addEventListener('click', () => {
                const menu = button.parentElement?.querySelector<HTMLElement>(':scope > .hidden');
                if (!menu)
                    return;
                menu.classList.toggle('hidden');
                button.setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
            });
        }
        if (location.pathname === '/templates') {
            const grid = document.querySelector<HTMLElement>('main .grid.md\\:grid-cols-2');
            const cards = [...(grid?.querySelectorAll<HTMLElement>(':scope > a') || [])];
            const groups = [...document.querySelectorAll<HTMLElement>('main button[type="button"]')].filter(button => button.closest<HTMLElement>('.flex.flex-wrap.items-center.gap-2'));
            for (const [index, button] of groups.entries()) {
                button.addEventListener('click', () => {
                    const active = button.dataset.filterActive !== 'true';
                    for (const peer of groups) {
                        peer.dataset.filterActive = 'false';
                        peer.setAttribute('aria-pressed', 'false');
                    }
                    button.dataset.filterActive = String(active);
                    button.setAttribute('aria-pressed', String(active));
                    cards.forEach((card, cardIndex) => { card.dataset.filterHidden = String(active && cardIndex % groups.length !== index % groups.length); });
                });
            }
        }
        document.addEventListener('click', event => {
            const target = (event.target as Element).closest<HTMLElement>('button, a');
            if (!target)
                return;
            const label = target.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
            if (/subscribe|submit request|connect on/.test(label)) {
                event.preventDefault();
                showDialog(/subscribe/.test(label) ? 'Get updates' : /request/.test(label) ? 'Share an idea' : 'Explore the next step');
            }
        });
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ready, { once: true });
    else
        ready();
})();
