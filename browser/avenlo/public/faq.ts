document.querySelectorAll<HTMLElement>(".hfaq__q").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    button.closest<HTMLElement>(".hfaq__item")?.classList.remove("is-open");
});
document.querySelectorAll<HTMLElement>(`.hfaq__q`).forEach((e, t, n) => e.addEventListener(`click`, () => { let t = e.getAttribute(`aria-expanded`) !== `true`; n.forEach(t => { t !== e && (t.setAttribute(`aria-expanded`, `false`), t.closest<HTMLElement>(`.hfaq__item`)?.classList.remove(`is-open`)); }), e.setAttribute(`aria-expanded`, String(t)), e.closest<HTMLElement>(`.hfaq__item`)?.classList.toggle(`is-open`, t); }));
