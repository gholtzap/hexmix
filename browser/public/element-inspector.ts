(() => {
  if (window.parent === window || document.documentElement.dataset.hexmixInspector) return;
  document.documentElement.dataset.hexmixInspector = "true";
  const editorOrigin = new URL(document.referrer || location.href).origin;
  type Property = "background" | "color" | "border" | "fill" | "stroke" | "image";
  type Assignment = { path: string; selector: string; property: Property; role: string };
  const cssProperty: Record<Exclude<Property, "image">, string> = {
    background: "background-color", color: "color", border: "border-color", fill: "fill", stroke: "stroke",
  };
  let page = "";
  let inspecting = false;
  let assignments: Assignment[] = [];
  let hovered: Element | null = null;
  let selectedSelector = "";
  let markedSelection: Element | null = null;
  const applied = new Map<Element, Map<string, { value: string; priority: string }>>();
  const appliedImages = new Set<HTMLImageElement>();
  const outline = document.createElement("div");
  outline.setAttribute("aria-hidden", "true");
  outline.dataset.hexmixInspectorOutline = "true";
  outline.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid var(--p-accent,#3578e5);border-radius:4px;background:color-mix(in srgb,var(--p-accent,#3578e5) 12%,transparent);display:none;box-sizing:border-box";
  document.body.append(outline);

  function selectorFor(element: Element) {
    const parts: string[] = [];
    for (let current = element; current && current !== document.body; current = current.parentElement) {
      const parent = current.parentElement;
      if (!parent || parts.length === 24) return null;
      const peers = [...parent.children].filter(child => child.localName === current.localName);
      parts.unshift(`${current.localName}:nth-of-type(${peers.indexOf(current) + 1})`);
    }
    return parts.length ? `body > ${parts.join(" > ")}` : null;
  }

  function targetFor(element: Element) {
    if (element === outline || element.closest("script,style,noscript")) return null;
    const image = element.closest("img");
    if (image) return image;
    if (element.closest("video,canvas,iframe")) return null;
    const control = element.closest("button,a,[role=button]");
    return control || element;
  }

  function propertyFor(element: Element): Property {
    if (element instanceof HTMLImageElement) return "image";
    if (element instanceof SVGElement) return getComputedStyle(element).fill === "none" ? "stroke" : "fill";
    const style = getComputedStyle(element);
    if (element.matches("button,a,[role=button]") || style.backgroundImage !== "none" || style.backgroundColor !== "rgba(0, 0, 0, 0)") return "background";
    return "color";
  }

  function originalColor(element: Element, property: Property) {
    if (property === "image") {
      if (element instanceof HTMLImageElement && element.dataset.editorWordmark) return getComputedStyle(element.parentElement!).color;
      return getComputedStyle(document.documentElement).getPropertyValue("--p-primary").trim();
    }
    const name = cssProperty[property];
    const style = (element as HTMLElement | SVGElement).style;
    const original = applied.get(element)?.get(name);
    if (!original) return getComputedStyle(element).getPropertyValue(name).trim();
    const appliedValue = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };
    if (original.value) style.setProperty(name, original.value, original.priority);
    else style.removeProperty(name);
    const color = getComputedStyle(element).getPropertyValue(name).trim();
    style.setProperty(name, appliedValue.value, appliedValue.priority);
    return color;
  }

  function setOutline(element: Element | null) {
    hovered = element;
    let selected: Element | null = null;
    try { if (selectedSelector) selected = document.querySelector(selectedSelector); } catch { selectedSelector = ""; }
    if (selected !== markedSelection) {
      markedSelection?.removeAttribute("data-hexmix-selected");
      selected?.setAttribute("data-hexmix-selected", "");
      markedSelection = selected;
    }
    const target = selected || (inspecting ? hovered : null);
    if (!target) { outline.style.display = "none"; return; }
    const box = target.getBoundingClientRect();
    Object.assign(outline.style, {
      display: "block", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
      borderRadius: getComputedStyle(target).borderRadius,
      background: selected ? "transparent" : "color-mix(in srgb,var(--p-accent,#3578e5) 12%,transparent)",
      boxShadow: selected ? "0 0 0 1px var(--p-background,#fff),0 0 0 2px var(--p-text,#111)" : "none",
    });
  }

  function setStyle(element: Element, property: string, value: string) {
    const style = (element as HTMLElement | SVGElement).style;
    let original = applied.get(element);
    if (!original) { original = new Map(); applied.set(element, original); }
    if (!original.has(property)) original.set(property, { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) });
    if (style.getPropertyValue(property) !== value || style.getPropertyPriority(property) !== "important") style.setProperty(property, value, "important");
  }

  function applyAssignments() {
    const desired = new Map<Element, Map<string, string>>();
    const desiredImages = new Map<HTMLImageElement, string>();
    const want = (element: Element, property: string, value: string) => {
      if (!desired.has(element)) desired.set(element, new Map());
      desired.get(element)!.set(property, value);
    };
    for (const item of assignments) {
      if (item.path !== page || !["text", "background", "primary", "secondary", "accent"].includes(item.role)) continue;
      let element: Element | null = null;
      try { element = document.querySelector(item.selector); } catch { continue; }
      if (!element) continue;
      if (item.property === "image") {
        if (element instanceof HTMLImageElement) desiredImages.set(element, item.role);
        continue;
      }
      if (!(item.property in cssProperty)) continue;
      want(element, cssProperty[item.property], `var(--p-${item.role})`);
      if (item.property === "background") {
        if (getComputedStyle(element).backgroundImage !== "none") want(element, "background-blend-mode", "luminosity");
        else want(element, "background-image", "none");
        if (!assignments.some(other => other.path === page && other.selector === item.selector && other.property === "color")) {
          want(element, "color", getComputedStyle(element).backgroundClip === "text" ? "transparent" : `var(--p-on-${item.role})`);
        }
      }
    }
    for (const [element, properties] of applied) {
      const style = (element as HTMLElement | SVGElement).style;
      for (const [property, original] of properties) {
        if (desired.get(element)?.has(property)) continue;
        if (original.value) style.setProperty(property, original.value, original.priority);
        else style.removeProperty(property);
        properties.delete(property);
      }
      if (!properties.size) applied.delete(element);
    }
    for (const [element, properties] of desired) for (const [property, value] of properties) setStyle(element, property, value);
    for (const image of appliedImages) {
      if (desiredImages.has(image)) continue;
      image.removeAttribute("data-editor-gradient-role");
      appliedImages.delete(image);
    }
    for (const [image, role] of desiredImages) {
      if (image.dataset.editorGradientRole !== role) image.dataset.editorGradientRole = role;
      appliedImages.add(image);
    }
  }

  let queued = false;
  new MutationObserver(records => {
    if (queued || !assignments.length || !records.some(record => record.type === "childList" || applied.has(record.target as Element))) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; applyAssignments(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });

  document.addEventListener("pointermove", event => {
    if (!inspecting) return;
    const target = event.target instanceof Element ? targetFor(event.target) : null;
    if (target !== hovered) setOutline(target);
  }, true);
  document.addEventListener("pointerdown", event => {
    if (!event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("scroll", () => setOutline(hovered), true);
  window.addEventListener("resize", () => setOutline(hovered));
  function selectElement(source: EventTarget | null, x?: number, y?: number) {
    const target = source instanceof Element ? targetFor(source) : null;
    if (!target) return;
    const selector = selectorFor(target);
    if (!selector) return;
    const name = (target.getAttribute("aria-label") || target.textContent || "").trim().replace(/\s+/g, " ");
    const kind = /^h[1-6]$/.test(target.localName) ? "Heading" : target.localName === "button" ? "Button" : target.localName === "a" ? "Link" : target instanceof HTMLImageElement ? "Image" : target instanceof SVGElement ? "Graphic" : "Element";
    const label = name && name.length <= 40 ? `${kind}: ${name}` : kind;
    const property = assignments.find(item => item.path === page && item.selector === selector)?.property ?? propertyFor(target);
    const oldImage = property === "background" ? getComputedStyle(target).backgroundImage : "none";
    const box = target.getBoundingClientRect();
    const anchor = property === "image" && x !== undefined && y !== undefined && (box.width > 240 || box.height > 240)
      ? { left: x, right: x, top: y, bottom: y }
      : { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    selectedSelector = selector;
    setOutline(hovered);
    window.parent.postMessage({ type: "hexmix-element-selected", selection: {
      path: page, selector, label, property, oldColor: originalColor(target, property),
      oldImage: oldImage !== "none" && oldImage.length <= 16000 ? oldImage : undefined,
      bounds: anchor,
    } }, editorOrigin);
  }
  document.addEventListener("click", event => {
    if (!inspecting && !event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectElement(event.target, event.clientX, event.clientY);
  }, true);
  document.addEventListener("focusin", event => {
    if (inspecting) setOutline(event.target instanceof Element ? targetFor(event.target) : null);
  }, true);
  document.addEventListener("keydown", event => {
    if (inspecting && (event.key === "Enter" || event.key === " ") && document.activeElement !== document.body) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectElement(document.activeElement);
    }
    if (inspecting && event.key === "Escape") {
      window.parent.postMessage({ type: "hexmix-inspect-exit" }, editorOrigin);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.origin !== editorOrigin || event.data?.type !== "hexmix-inspector-state") return;
    page = typeof event.data.page === "string" ? event.data.page : "";
    assignments = Array.isArray(event.data.assignments) ? event.data.assignments : [];
    inspecting = event.data.inspecting === true;
    selectedSelector = typeof event.data.selectedSelector === "string" ? event.data.selectedSelector : "";
    document.documentElement.style.cursor = inspecting ? "crosshair" : "";
    setOutline(inspecting ? hovered : null);
    applyAssignments();
  });
  window.parent.postMessage({ type: "hexmix-inspector-ready" }, editorOrigin);
})();
