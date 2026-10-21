{
    if (!CSS.supports(`container-type`, `size`) || !CSS.supports(`scale`, `calc(1px / 1px)`))
        document.querySelectorAll<HTMLElement>(`[data-hero-ill]`).forEach(n => { let r = n.querySelector<HTMLElement>(`[data-v]`); if (!r)
            return; new ResizeObserver(([e]) => { let t = Math.round(e.contentRect.width), n = Math.round(e.contentRect.height); if (!t || !n)
            return; let i = t < 600 ? t / 762.5 : t < 1003 ? t / 810 : 1; r.style.setProperty(`--s`, String(i)), r.style.width = `${t / i}px`, r.style.height = `${n / i}px`; }).observe(n); });
}
{
    let e = window.matchMedia(`(prefers-reduced-motion: reduce)`), n = 50, r = 22, i = 1800, a = 320, o = e => new Promise(t => window.setTimeout(t, e));
    document.querySelectorAll<HTMLElement>(`.hero__rotator`).forEach(s => { if (e.matches || location.search.includes(`static`))
        return; let c = s.querySelector<HTMLElement>(`.hero__typed`), l = Array.from(s.querySelectorAll<HTMLElement>(`.hero__sizer`)); if (!c || l.length < 2)
        return; let u = l.map(e => e.textContent ?? ``), d = 0, f = e => { let n = l.map(e => e.getBoundingClientRect().width), r = n[e]; c.style.backgroundSize = `${r + parseFloat(getComputedStyle(c).paddingRight)}px 100%`, s.style.transform = ``; }; (async () => { for (await (document.fonts?.ready ?? Promise.resolve()), f(d);;) {
        await o(i);
        let e = u[d];
        for (let t = e.length - 1; t >= 0; t--)
            c.textContent = e.slice(0, t), await o(r);
        d = (d + 1) % u.length, f(d), await o(a);
        let t = u[d];
        for (let e = 1; e <= t.length; e++)
            c.textContent = t.slice(0, e), await o(n + (Math.random() - .5) * 30);
    } })(); let p = 0; window.addEventListener(`resize`, () => { window.clearTimeout(p), p = window.setTimeout(() => f(d), 150); }); });
}
{
    document.querySelectorAll<HTMLElement>(`[data-logo-wall]`).forEach(e => { if (window.matchMedia(`(prefers-reduced-motion: reduce)`).matches)
        return; let t = JSON.parse(e.dataset.logos ?? `[]`), n = Array.from(e.querySelectorAll<HTMLElement>(`.logos__cell`)), r = n.filter(e => !e.hasAttribute(`data-pinned`)); if (t.length <= n.length || r.length === 0)
        return; let i = () => new Set(n.map(e => e.querySelector<HTMLImageElement>(`img`)?.alt)), a = t => { let n = document.createDocumentFragment(), r = document.createElement(`img`); if (r.src = t.src, r.alt = t.alt, r.width = t.w, r.height = t.h, r.loading = `lazy`, r.decoding = `async`, t.href) {
        let e = document.createElement(`a`);
        e.href = t.href, e.className = `logos__link`, t.caseStudy && t.caseStudyId && (e.dataset.caseStudy = t.caseStudyId), e.append(r), n.append(e);
    }
    else
        n.append(r); if (t.caseStudy) {
        let t = document.createElement(`span`);
        t.className = `logos__tag`, t.textContent = e.dataset.caseStudyLabel || `Case Study`, n.append(t);
    } return n; }, o = [], s = null, c = new Set, l = () => { if (o.length === 0) {
        o = [...r];
        for (let e = o.length - 1; e > 0; --e) {
            let t = Math.floor(Math.random() * (e + 1));
            [o[e], o[t]] = [o[t], o[e]];
        }
        o.length > 1 && o[0] === s && ([o[0], o[1]] = [o[1], o[0]]);
    } let e = o.findIndex(e => !c.has(e)); return e === -1 ? null : o.splice(e, 1)[0]; }, u = 0, d = () => { let e = i(); for (let n = 0; n < t.length; n += 1) {
        let r = t[(u + n) % t.length];
        if (!r.pinned && !r.caseStudy && !e.has(r.alt))
            return u = (u + n + 1) % t.length, r;
    } return null; }, f = !1, p = !1, m = 0, h = () => { if (f || !p)
        return; let e = l(), t = e && d(); e && t && (s = e, c.add(e), e.setAttribute(`data-fading`, ``), window.setTimeout(() => { c.delete(e), e.querySelector(`.logos__item`)?.replaceChildren(a(t)), e.removeAttribute(`data-fading`); }, 550)); }, g = () => { h(), m = window.setTimeout(g, 2e3 + Math.random() * 1600); }, _ = () => { m || g(); }, v = () => { window.clearTimeout(m), m = 0; }; e.addEventListener(`mouseenter`, () => f = !0), e.addEventListener(`mouseleave`, () => f = !1), e.addEventListener(`focusin`, () => f = !0), e.addEventListener(`focusout`, t => { e.contains((t.relatedTarget as Node)) || (f = !1); }); let y = !1, b = () => { y || (y = !0, t.forEach(e => { let t = new Image; t.src = e.src; })); }; if (!(`IntersectionObserver` in window)) {
        p = !0, b(), _();
        return;
    } new IntersectionObserver(e => { p = e.some(e => e.isIntersecting), p ? (b(), _()) : v(); }, { rootMargin: `100px 0px` }).observe(e); });
}
{
    let e = document.querySelectorAll<HTMLElement>(`.vcall .step`);
    if (!window.matchMedia(`(prefers-reduced-motion: reduce)`).matches && `IntersectionObserver` in window) {
        let t = new Map;
        e.forEach(e => { let n = e.querySelector<HTMLElement>(`.win__time`); if (!n)
            return; let r = 2, i = 0; t.set(e, e => { e && !i ? (n.classList.contains(`is-ticking`) || (n.style.width = getComputedStyle(n).width, n.classList.add(`is-ticking`)), i = window.setInterval(() => { r = r >= 599 ? 2 : r + 1, n.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, `0`)}`; }, 1e3)) : !e && i && (window.clearInterval(i), i = 0); }); });
        let n = new IntersectionObserver(e => { for (let n of e) {
            let e = n.isIntersecting;
            n.target.classList.toggle(`is-live`, e), e && n.target.classList.add(`is-revealed`), t.get(n.target)?.(e);
        } }, { threshold: .35 });
        e.forEach(e => { e.classList.add(`anim-ready`), n.observe(e); });
    }
}
{
    document.querySelectorAll<HTMLElement>(`.vcall__row`).forEach(e => { e.addEventListener(`click`, t => { let n = (t.target as Element).closest<HTMLElement>(`.step__toggle`); n && e.querySelectorAll<HTMLElement>(`.step`).forEach(e => { let t = e.contains(n) ? !e.classList.contains(`is-open`) || !0 : !1; e.classList.toggle(`is-open`, t), e.querySelector<HTMLElement>(`.step__toggle`)?.setAttribute(`aria-expanded`, String(t)); }); }); });
}
{
    let e = document.querySelector<HTMLVideoElement>(`[data-hpk-video]`);
    e && !window.matchMedia(`(prefers-reduced-motion: reduce)`).matches && !location.search.includes(`static`) && new IntersectionObserver(t => { for (let n of t)
        n.isIntersecting ? (e.preload = `auto`, e.play().then(() => e.classList.add(`is-playing`)).catch(() => { })) : e.pause(); }).observe(e);
}
