(() => {
    var e = document.querySelector<HTMLElement>(`.nav`), t = document.querySelector<HTMLElement>(`.nav__toggle`), n = document.querySelector<HTMLElement>(`.nav__mobile`), r = document.documentElement, i = window.matchMedia(`(prefers-reduced-motion: reduce)`), a = 0, o = [], s = s => { if (t && e && n && e.dataset.open === `true` !== s) {
        if (t.setAttribute(`aria-expanded`, String(s)), t.setAttribute(`aria-label`, (s ? t.dataset.labelClose : t.dataset.labelOpen) ?? ``), window.clearTimeout(a), s) {
            let t = e.offsetHeight, i = window.innerWidth - r.clientWidth;
            e.style.setProperty(`--nav-h`, `${t}px`), i > 0 && (r.style.paddingRight = `${i}px`, e.style.setProperty(`--nav-sbw`, `${i}px`)), n.hidden = !1, n.scrollTop = 0, n.querySelector<HTMLElement>(`.nm__scroll`)?.scrollTo(0, 0), n.offsetHeight, e.dataset.open = `true`, r.classList.add(`nav-locked`), o = [];
            for (let t = e; t && t !== document.body; t = t.parentElement)
                for (let e of t.parentElement?.children ?? [])
                    e !== t && !e.hasAttribute(`inert`) && ![`SCRIPT`, `STYLE`].includes(e.tagName) && o.push(e);
            o.forEach(e => e.setAttribute(`inert`, ``));
        }
        else {
            e.dataset.open = `false`, o.forEach(e => e.removeAttribute(`inert`)), o = [];
            let t = () => { n.hidden = !0, r.classList.remove(`nav-locked`), r.style.paddingRight = ``, e.style.removeProperty(`--nav-sbw`); };
            i.matches ? t() : a = window.setTimeout(t, 220);
        }
    } };
    t?.addEventListener(`click`, () => s(t.getAttribute(`aria-expanded`) !== `true`)), n?.addEventListener(`click`, e => { (e.target as Element).closest<HTMLAnchorElement>(`a`) && s(!1); }), document.addEventListener(`keydown`, n => { n.key === `Escape` && e?.dataset.open === `true` && (s(!1), t?.focus()); }), window.matchMedia(`(min-width: 1200px)`).addEventListener(`change`, e => { e.matches && s(!1); }), window.addEventListener(`pageshow`, e => { e.persisted && s(!1); }), document.querySelectorAll<HTMLElement>(`.nav__dropdown`).forEach(e => { let t = e.querySelector<HTMLElement>(`.nav__link--menu`); if (!t)
        return; let n = () => e.dataset.state !== `dismissed` && (e.dataset.state === `open` || e.matches(`:hover`) || e.matches(`:focus-within`)), r = () => t.setAttribute(`aria-expanded`, String(n())), i = (t?: string) => { t ? e.dataset.state = t : delete e.dataset.state, r(); }; t.addEventListener(`click`, () => i(e.dataset.state === `open` ? `dismissed` : `open`)), e.addEventListener(`mouseenter`, () => e.dataset.state === `dismissed` ? i() : r()), e.addEventListener(`mouseleave`, () => e.dataset.state === `open` && !e.matches(`:focus-within`) ? i() : r()), e.addEventListener(`focusin`, r), e.addEventListener(`focusout`, t => { e.contains((t.relatedTarget as Node)) || i(); }), e.addEventListener(`keydown`, e => { e.key === `Escape` && n() && (e.preventDefault(), i(`dismissed`), t.focus()); }), document.addEventListener(`keydown`, t => { t.key === `Escape` && e.dataset.state === `open` && i(`dismissed`); }), document.addEventListener(`pointerdown`, t => { !e.contains((t.target as Node)) && e.dataset.state && i(); }); });
})();
