(() => {
    const path = location.pathname;
    const titles = {
        '/products/quotes-and-tenders': 'Turn every request into a clear next step.',
        '/products/order-processing': 'Move work forward without retyping.',
        '/integrations': 'Fits into the tools you already use.',
        '/solutions/distributors': 'Keep every team moving together.',
        '/solutions/manufacturers': 'Bring each process into one clear view.',
        '/success-stories': 'Chosen when the next step matters.',
        '/success-stories/story-a': '“We can see the next step more clearly.”',
        '/success-stories/story-b': '“Our work now moves with more confidence.”',
        '/success-stories/story-c': '“We have a clearer view of every request.”',
        '/about': 'A team focused on simpler work.',
        '/careers': 'Build useful work together.',
        '/contact': 'Let’s talk about how your team works.',
        '/privacy': 'Privacy',
        '/imprint': 'Business details',
        '/terms': 'Terms',
    };
    const terms = [
        [/\bquotes\b/gi, 'plans'],
        [/\bquote\b/gi, 'plan'],
        [/\bquoting\b/gi, 'planning'],
        [/\btenders\b/gi, 'requests'],
        [/\btender\b/gi, 'request'],
        [/\border processing\b/gi, 'team coordination'],
        [/\borders\b/gi, 'tasks'],
        [/\border\b/gi, 'task'],
        [/\bERP\b/g, 'workspace'],
        [/\bcatalog(?:ue)?s?\b/gi, 'shared work'],
        [/\bdistributors?\b/gi, 'teams'],
        [/\bmanufacturers?\b/gi, 'groups'],
        [/\bindustrial\b/gi, 'business'],
        [/\btechnical\b/gi, 'everyday'],
        [/\bconstruction\b/gi, 'business'],
        [/\bAI\b/g, 'guided'],
        [/\bGAEB\b/g, 'document'],
        [/\bSAP\b/g, 'existing tools'],
        [/\b80\+\b/g, 'Many'],
        [/\bISO\/IEC 27001 certified\b/gi, 'Built with care'],
    ];
    const sentences = [
        'Bring people, information, and next steps into one clear view. Give each team the context it needs to make progress with confidence.',
        'Make everyday work easier to follow. Keep decisions, updates, and follow-up tasks together so everyone can move in the same direction.',
        'See what matters, choose the next step, and keep work moving. Your team can spend more time on the work that needs its attention.',
        'Connect the work already in motion. Give each person a simple way to understand what has changed and what to do next.',
        'A shared view helps the team stay aligned as plans change. Bring the right details forward at the right time.',
    ];
    function generic(text, index, parent) {
        let result = text;
        for (const [pattern, replacement] of terms)
            result = result.replace(pattern, replacement);
        const sourceClaims = [
            [/80\+ (?:teams|customers|groups|companies)[^.]*\.?/gi, 'Teams can follow work in one clear place.'],
            [/When request processing is business-critical[^.]*\.?/gi, 'Clearer work starts with a shared view.'],
            [/Go live in under four weeks\.?/gi, 'Move ahead at your own pace.'],
            [/Every customer who has gone live[^.]*\.?/gi, 'Keep a clear view as work moves forward.'],
            [/ISO\s*\/?\s*IEC\s*27001(?: certified)?/gi, 'Clear practices'],
            [/100\s*%/g, 'A shared view'],
            [/\bHVAC\s*\/\s*SHK\b/gi, 'Field teams'],
            [/\bHVAC\b/gi, 'Field'],
            [/\bTiefbauhandel\b/gi, 'Team'],
            [/\bMRO\b/g, 'services'],
            [/\bYC\b/g, 'Independent studio'],
            [/\bBoQ\b/gi, 'request'],
            [/\bDN\s*\d+\b/gi, 'item'],
            [/\bPN\s*\d+\b/gi, 'detail'],
            [/\bKG pipe\b|\bHT pipe\b|\bsocket\b|\bgate valve\b|\btee\b|\belbow\b/gi, 'sample item'],
            [/\bSAP(?:-like)?\b/gi, 'existing tool'],
            [/\binside-sales\b/gi, 'team'],
            [/\bbills of quantities\b/gi, 'requests'],
            [/\barticle number\b|\barticle\b/gi, 'item'],
            [/\bmargin-aware\b|\bmargin\b/gi, 'priority'],
            [/\bSpec-compliance\b|\bspec mismatches\b|\bspec\b/gi, 'detail'],
        ];
        for (const [pattern, replacement] of sourceClaims)
            result = result.replace(pattern, replacement);
        if (/\b\d+\s*(?:\+|%)/.test(result)) {
            result = parent.closest('[data-framer-name="Metric"],[data-framer-name="Metric Value"]')
                ? 'More'
                : /^[\d\s+%]+$/.test(result.trim()) ? 'Progress' : sentences[index % sentences.length];
        }
        if (/^How accurately does the guided match our products\??$/i.test(result.trim()))
            result = 'How does the platform help our team find what it needs?';
        if (/^(?:guided|smart tools) plan\s*&\s*request$/i.test(result.trim()))
            result = 'Plans and requests';
        if (/^(?:guided|smart tools) shared work matching$/i.test(result.trim()))
            result = 'Connect the details';
        if (/^(?:self-learning|trained on your business)/i.test(result.trim()))
            result = 'Built around your team';
        if (/^\d+\s*(?:pallet|pcs)|\?\?|photo attached|same as last time|plan by Friday/i.test(result.trim()))
            result = 'Sample request detail';
        if (/^[^a-z]*[A-Z][A-Z\s/&+0-9.,-]{3,}$/.test(result.trim()))
            result = result.trim().toLowerCase().replace(/^./, c => c.toUpperCase());
        result = result.replace(/\bnuvexa\b/gi, 'Nuvexa');
        if (/^“/.test(text.trim()))
            result = '“We can see what comes next with confidence.”';
        const bodyCopy = parent.closest('p') && !parent.closest('a,button,h1,h2,h3');
        if (text.length > 75 && bodyCopy) {
            result = /^\/(privacy|imprint|terms)$/.test(path)
                ? 'This is sample text for the design preview. Add the approved policy details before you publish this page.'
                : sentences[index % sentences.length];
            if (text.length > 240 && !/^\/(privacy|imprint|terms)$/.test(path))
                result += ' ' + sentences[(index + 2) % sentences.length];
        }
        return result;
    }
    function rewrite() {
        document.title = `${titles[path] || 'Nuvexa'} — Nuvexa`;
        const firstHeading = document.querySelector<HTMLElement>('h1');
        if (firstHeading && titles[path])
            firstHeading.textContent = titles[path];
        for (const heading of document.querySelectorAll<HTMLElement>('h2')) {
            if (/Go live in under four weeks/i.test(heading.textContent))
                heading.textContent = 'Move ahead at your own pace.';
        }
        let paragraph = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.closest('script,style,noscript,svg,form,pre,code') || parent.closest('h1') === firstHeading)
                continue;
            const text = node.nodeValue;
            if (!text.trim())
                continue;
            const next = generic(text, paragraph++, parent);
            if (next !== text)
                node.nodeValue = next;
        }
        for (const image of document.querySelectorAll<HTMLImageElement>('img')) {
            if (image.alt && image.alt !== 'Nuvexa')
                image.alt = 'Abstract gradient';
            if (image.alt !== 'Nuvexa')
                continue;
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="44" viewBox="0 0 180 44"><text x="0" y="32" fill="%232d1f2a" font-family="Arial,sans-serif" font-size="30" font-weight="700">Nuvexa</text></svg>';
            image.src = `data:image/svg+xml,${svg}`;
            image.removeAttribute('data-nuvexa-media');
        }
        // Static gradient panels replace the large decorative source artwork.
        for (const artwork of document.querySelectorAll<HTMLElement>('svg[width="800"][height="480"]'))
            artwork.remove();
        // The media card itself opens the preview. These source-only 1 px buttons
        // would otherwise remain inaccessible controls inside the static card.
        for (const button of document.querySelectorAll<HTMLElement>('button[style*="width:1px"][style*="height:1px"]'))
            button.remove();
        let tooltipIndex = 0;
        for (const button of document.querySelectorAll<HTMLElement>('button[aria-label="Previous"],button[aria-label="Next"]')) {
            const label = button.getAttribute('aria-label');
            const tooltip = document.createElement('span');
            tooltip.id = `nuvexa-control-tip-${tooltipIndex++}`;
            tooltip.className = 'nuvexa-control-tip';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.textContent = label;
            button.setAttribute('aria-describedby', tooltip.id);
            button.after(tooltip);
        }
        for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
            const href = link.getAttribute('href');
            if (href?.startsWith('/industries/')) {
                link.href = '/solutions/distributors';
                continue;
            }
            if (href === '/' && /^(HVAC|SHK|Electrical|Building materials|Building services|TGA)$/i.test(link.textContent.trim())) {
                link.href = '/solutions/distributors';
                continue;
            }
            if (href?.startsWith('mailto:')) {
                link.href = '#contact-form';
                link.textContent = 'Use the form below';
                continue;
            }
            if (/linkedin|jobs\.ashbyhq|ycombinator|framer\.com/i.test(href))
                link.href = '/about';
        }
        for (const input of document.querySelectorAll<HTMLInputElement>('input[placeholder],textarea[placeholder]')) {
            if (input.type === 'email')
                input.placeholder = 'hello@nuvexa.example';
            else if (input.name?.toLowerCase().includes('name'))
                input.placeholder = 'Your name';
            else if (input.name?.toLowerCase().includes('company'))
                input.placeholder = 'Your team';
            else
                input.placeholder = 'Tell us what you have in mind';
        }
        for (const form of document.querySelectorAll<HTMLFormElement>('form')) {
            form.dataset.localDemo = 'true';
            form.id ||= 'contact-form';
            for (const input of form.querySelectorAll<HTMLInputElement>('input')) {
                if (input.name === 'Company') {
                    input.name = 'Team';
                    const caption = input.closest<HTMLElement>('label')?.querySelector<HTMLElement>('p');
                    if (caption)
                        caption.textContent = 'Team';
                }
            }
            const select = form.querySelector<HTMLElement>('select');
            if (select) {
                const caption = select.closest<HTMLElement>('label')?.querySelector<HTMLElement>('p');
                if (caption)
                    caption.textContent = 'Your team is a';
                for (const [index, label] of ['Working team', 'Business group', 'Other'].entries()) {
                    if ((select as HTMLSelectElement).options[index])
                        (select as HTMLSelectElement).options[index].text = label;
                }
            }
            for (const note of form.querySelectorAll<HTMLElement>('p')) {
                if (/By sending this form/.test(note.textContent))
                    note.textContent = 'This preview does not send data.';
            }
            form.addEventListener('submit', event => {
                event.preventDefault();
                if (!form.reportValidity())
                    return;
                let result = form.querySelector<HTMLElement>('.nuvexa-form-result');
                if (!result) {
                    result = document.createElement('p');
                    result.className = 'nuvexa-form-result';
                    form.append(result);
                }
                result.textContent = 'This is a design preview. Your request was not sent.';
            });
        }
        const menuButton = document.querySelector<HTMLElement>('nav [data-framer-name="Menu Button"] button, nav button');
        const nav = menuButton?.closest<HTMLElement>('nav');
        if (menuButton && nav && nav.querySelector<HTMLElement>('[data-framer-name="Mobile Menu"]')) {
            menuButton.setAttribute('aria-expanded', 'false');
            menuButton.addEventListener('click', () => {
                const open = nav.toggleAttribute('data-nuvexa-menu-open');
                menuButton.setAttribute('aria-expanded', String(open));
                const label = menuButton.querySelector<HTMLElement>('p');
                if (label)
                    label.textContent = open ? 'Close' : 'Menu';
            });
        }
        for (const button of document.querySelectorAll<HTMLElement>('[data-framer-name="Question Row"]')) {
            const wrap = button.parentElement?.querySelector<HTMLElement>('[data-framer-name="Answer Wrap"]');
            if (!wrap)
                continue;
            button.setAttribute('aria-expanded', 'false');
            button.addEventListener('click', () => {
                const open = button.getAttribute('aria-expanded') !== 'true';
                button.setAttribute('aria-expanded', String(open));
                wrap.style.height = open ? 'auto' : '0px';
                wrap.style.overflow = 'hidden';
                const inner = wrap.querySelector<HTMLElement>('[data-framer-name="Answer Inner"]');
                if (inner)
                    inner.style.opacity = open ? '1' : '0';
                const bar = button.querySelector<HTMLElement>('[data-framer-name="Bar V"]');
                if (bar)
                    bar.style.transform = open ? 'rotate(90deg)' : 'none';
            });
        }
        const carousel = document.getElementById('stories-carousel');
        const carouselControls = document.querySelector<HTMLElement>('[data-framer-name="Carousel Arrows"]');
        if (carousel && carouselControls) {
            for (const button of carouselControls.querySelectorAll<HTMLElement>('button[aria-label]')) {
                button.addEventListener('click', () => {
                    carousel.scrollBy({ left: (button.ariaLabel === 'Next' ? 1 : -1) * carousel.clientWidth * 0.8, behavior: 'smooth' });
                });
            }
        }
        const mediaDialog = document.createElement('dialog');
        mediaDialog.className = 'nuvexa-media-dialog';
        mediaDialog.innerHTML = '<button type="button" aria-label="Close media">×</button><div role="img" aria-label="Abstract gradient"></div>';
        mediaDialog.querySelector<HTMLElement>('button').addEventListener('click', () => mediaDialog.close());
        document.body.append(mediaDialog);
        document.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest<HTMLElement>('button');
            const player = target?.closest<HTMLElement>('[data-framer-name="Story Player"]');
            if (!player && !/^(Watch|Play the customer)/i.test(button?.getAttribute('aria-label') || button?.innerText.trim() || ''))
                return;
            if (target?.closest<HTMLAnchorElement>('a'))
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            mediaDialog.showModal();
        }, true);
        if (/^\/(privacy|imprint|terms)$/.test(path) && firstHeading) {
            const note = document.createElement('p');
            note.className = 'nuvexa-preview-note';
            note.textContent = 'Design preview. The text on this page is sample content and has no legal effect.';
            firstHeading.after(note);
        }
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', rewrite, { once: true });
    else
        rewrite();
})();
