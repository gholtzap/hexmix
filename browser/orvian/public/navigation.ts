(() => {
    const nav = document.querySelector<HTMLElement>("nav.sticky");
    if (!nav)
        return;
    const band = nav.firstElementChild;
    const resources = nav.querySelector<HTMLElement>('[aria-controls="resources-menu"]');
    const dropdown = resources.parentElement;
    const menu = nav.querySelector<HTMLElement>("#resources-menu");
    const toggle = nav.querySelector<HTMLElement>('[aria-label="Toggle menu"]');
    const template = document.createElement("template");
    template.innerHTML = "<div class=\"md:hidden border-b border-onyx pt-2 pb-4 bg-stone-900/95 backdrop-blur-md\"><div class=\"flex flex-col\"><a class=\"text-stone-200 hover:text-stone-50 hover:bg-stone-700/25 transition-colors text-sm tracking-normal px-8 py-4\" href=\"/blog\">Blog</a><a class=\"text-stone-200 hover:text-stone-50 hover:bg-stone-700/25 transition-colors text-sm tracking-normal px-8 py-4\" href=\"/blog/1\">Featured note</a><a class=\"text-stone-200 hover:text-stone-50 hover:bg-stone-700/25 transition-colors text-sm tracking-normal px-8 py-4\" href=\"#demo\" data-local-demo data-open-demo>Contact<span> \u2192</span></a></div></div>";
    const mobile = template.content.firstElementChild;
    mobile.id = "mobile-menu";
    (mobile as HTMLElement).style.overflow = "hidden";
    (mobile as HTMLElement).style.transition = "max-height 200ms ease, opacity 200ms ease";
    nav.append(mobile);
    toggle.setAttribute("aria-controls", mobile.id);
    let mobileOpen = false;
    const setResources = (open) => {
        resources.setAttribute("aria-expanded", String(open));
        menu.classList.toggle("visible", open);
        menu.classList.toggle("opacity-100", open);
        menu.classList.toggle("invisible", !open);
        menu.classList.toggle("opacity-0", !open);
        resources.querySelector<HTMLElement>("svg").classList.toggle("rotate-180", open);
        menu.inert = !open;
    };
    const setMobile = (open) => {
        mobileOpen = open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.querySelector<HTMLElement>("path").setAttribute("d", open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16");
        (mobile as HTMLElement).inert = !open;
        (mobile as HTMLElement).style.maxHeight = open ? "240px" : "0px";
        (mobile as HTMLElement).style.opacity = open ? "1" : "0";
        (mobile as HTMLElement).style.paddingTop = open ? "" : "0px";
        (mobile as HTMLElement).style.paddingBottom = open ? "" : "0px";
        (mobile as HTMLElement).style.borderBottomWidth = open ? "" : "0px";
    };
    resources.addEventListener("click", () => setResources(true));
    dropdown.addEventListener("mouseenter", () => setResources(true));
    dropdown.addEventListener("mouseleave", () => setResources(false));
    dropdown.addEventListener("focusin", () => setResources(true));
    dropdown.addEventListener("focusout", (event) => {
        if (!dropdown.contains((event.relatedTarget as Node)))
            setResources(false);
    });
    toggle.addEventListener("click", () => setMobile(!mobileOpen));
    nav.addEventListener("focusout", (event) => {
        if (!nav.contains((event.relatedTarget as Node)))
            setMobile(false);
    });
    nav.addEventListener("click", (event) => {
        const link = (event.target as Element).closest<HTMLAnchorElement>("a");
        if (!link)
            return;
        setResources(false);
        setMobile(false);
    });
    document.addEventListener("pointerdown", (event) => {
        if (!dropdown.contains((event.target as Node)))
            setResources(false);
        if (!nav.contains((event.target as Node)))
            setMobile(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape")
            return;
        if (mobileOpen) {
            setMobile(false);
            toggle.focus();
        }
        else if (resources.getAttribute("aria-expanded") === "true") {
            setResources(false);
            resources.focus();
        }
    });
    const updateBand = () => {
        const scrolled = window.scrollY > 4;
        band.classList.toggle("bg-stone-900/80", scrolled);
        band.classList.toggle("backdrop-blur-md", scrolled);
    };
    window.addEventListener("scroll", updateBand, { passive: true });
    window.matchMedia("(min-width: 768px)").addEventListener("change", (event) => {
        if (event.matches)
            setMobile(false);
    });
    setResources(false);
    setMobile(false);
    updateBand();
})();
