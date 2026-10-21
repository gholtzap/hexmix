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
  let roleMap = false;
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
  const mapLayer = document.createElement("div");
  mapLayer.dataset.hexmixRoleMap = "true";
  mapLayer.setAttribute("aria-hidden", "true");
  mapLayer.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;display:none";
  document.body.append(mapLayer);
  let mapProperties = new WeakMap<Element, Property>();
  let mapTimer = 0;

  function mappedTarget(source: EventTarget | null) {
    if (!(source instanceof Element)) return null;
    for (let element: Element | null = source; element && element !== document.body; element = element.parentElement) {
      if (mapProperties.has(element)) return element;
    }
    return null;
  }

  function drawRoleMap() {
    if (!roleMap) return;
    const roleNames = ["text", "background", "primary", "secondary", "accent"];
    const rootStyle = getComputedStyle(document.documentElement);
    const colors = new Map<string, string>();
    const values = new Map<string, string>();
    const rgbByRole = new Map<string, string>();
    for (const role of roleNames) {
      const hex = rootStyle.getPropertyValue(`--p-${role}`).trim();
      if (!/^#[0-9a-f]{6}$/i.test(hex)) continue;
      const rgb = `rgb(${[1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16)).join(",")})`;
      colors.set(role, hex);
      values.set(rgb, role);
      rgbByRole.set(role, rgb);
    }
    const match = (value: string) => values.get(value.toLowerCase().replace(/\s+/g, ""));
    const markers: HTMLElement[] = [];
    const seen = new Set<string>();
    mapProperties = new WeakMap();
    for (const element of document.body.querySelectorAll("*")) {
      if (mapLayer.contains(element) || element === outline) continue;
      const box = element.getBoundingClientRect();
      if (box.width < 24 || box.height < 18 || box.right < 0 || box.bottom < 0 || box.left > innerWidth || box.top > innerHeight) continue;
      if (box.width > innerWidth * .95 && box.height > innerHeight * .8) continue;
      const style = getComputedStyle(element);
      let role: string | undefined, property: Property = "background";
      if (element instanceof HTMLImageElement && element.dataset.editorGradientRole) {
        role = element.dataset.editorGradientRole;
        property = "image";
      } else if (element instanceof SVGElement) {
        if (element.localName !== "svg") continue;
        role = match(style.fill);
        property = "fill";
        if (!role) { role = match(style.stroke); property = "stroke"; }
      } else {
        role = match(style.backgroundColor);
        if (!role && style.backgroundImage !== "none") {
          const image = style.backgroundImage.toLowerCase().replace(/\s+/g, "");
          role = ["primary", "secondary", "accent", "text", "background"].find(name => image.includes(rgbByRole.get(name) ?? "\0"));
        }
        if (!role && (element.matches("h1,h2,h3,h4,h5,h6,p,a,button,label") || element.matches("span,strong,em,b,i") && isText(element) && style.color !== getComputedStyle(element.parentElement!).color)) {
          role = match(style.color); property = "color";
        }
        if (!role && style.borderTopWidth !== "0px") { role = match(style.borderTopColor); property = "border"; }
      }
      if (!role || !colors.has(role)) continue;
      const key = `${role}:${Math.round(box.left)}:${Math.round(box.top)}:${Math.round(box.width)}:${Math.round(box.height)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mapProperties.set(element, property);
      const marker = document.createElement("div");
      marker.dataset.hexmixRole = role;
      marker.style.cssText = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;box-sizing:border-box;border:1px solid color-mix(in srgb,${colors.get(role)} 45%,transparent);border-radius:${style.borderRadius};background:color-mix(in srgb,${colors.get(role)} 4%,transparent)`;
      markers.push(marker);
      // shortcut: Limit overlays to 120; use viewport batching if a dense page needs more.
      if (markers.length >= 120) break;
    }
    mapLayer.replaceChildren(...markers);
  }

  function scheduleRoleMap() {
    if (!roleMap) return;
    clearTimeout(mapTimer);
    mapTimer = window.setTimeout(drawRoleMap, 100);
  }

  function selectorFor(element: Element) {
    if (element === document.body || element === document.documentElement) return element.localName;
    const parts: string[] = [];
    for (let current = element; current && current !== document.body; current = current.parentElement) {
      const parent = current.parentElement;
      if (!parent || parts.length === 24) return null;
      const peers = [...parent.children].filter(child => child.localName === current.localName);
      parts.unshift(`${current.localName}:nth-of-type(${peers.indexOf(current) + 1})`);
    }
    return parts.length ? `body > ${parts.join(" > ")}` : null;
  }

  function hasBackground(element: Element) {
    const style = getComputedStyle(element);
    const transparent = style.backgroundColor === "transparent" || /^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?%?\)$/.test(style.backgroundColor);
    return style.backgroundImage !== "none" || !transparent;
  }

  function targetFor(element: Element) {
    if (element === outline || element.closest("script,style,noscript")) return null;
    const image = element.closest("img");
    if (image) return image;
    if (element.closest("video,canvas,iframe")) return null;
    const control = element.closest("button,a,[role=button],input,textarea,select,[contenteditable=true]");
    return control || element;
  }

  function isText(element: Element) {
    return element.matches("h1,h2,h3,h4,h5,h6,p,label") || [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  }

  function propertyFor(element: Element): Property {
    if (element instanceof HTMLImageElement) return "image";
    if (element instanceof SVGElement) return getComputedStyle(element).fill === "none" ? "stroke" : "fill";
    if (element.matches("body,html,button,a,[role=button]") || hasBackground(element) || !isText(element)) return "background";
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
    const visibleColor = () => getComputedStyle(element).getPropertyValue(name).trim();
    if (!original) return visibleColor();
    const appliedValue = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };
    if (original.value) style.setProperty(name, original.value, original.priority);
    else style.removeProperty(name);
    const color = visibleColor();
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
    scheduleRoleMap();
  }

  let queued = false;
  new MutationObserver(records => {
    if (queued || !assignments.length || !records.some(record => record.target !== mapLayer && !mapLayer.contains(record.target) && (record.type === "childList" || applied.has(record.target as Element)))) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; applyAssignments(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });

  new MutationObserver(records => {
    if (records.some(record => record.target !== mapLayer && !mapLayer.contains(record.target))) scheduleRoleMap();
  }).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(scheduleRoleMap).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

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
  document.addEventListener("scroll", () => { setOutline(hovered); scheduleRoleMap(); }, true);
  window.addEventListener("resize", () => { setOutline(hovered); scheduleRoleMap(); });
  function selectElement(source: EventTarget | null, x?: number, y?: number, fromMap = false) {
    const target = fromMap ? mappedTarget(source) : source instanceof Element ? targetFor(source) : null;
    if (!target) return;
    const selector = selectorFor(target);
    if (!selector) return;
    const name = (target.getAttribute("aria-label") || target.textContent || "").trim().replace(/\s+/g, " ");
    const kind = /^h[1-6]$/.test(target.localName) ? "Heading" : target.localName === "button" ? "Button" : target.localName === "a" ? "Link" : target instanceof HTMLImageElement ? "Image" : target instanceof SVGElement ? "Graphic" : "Element";
    const label = name && name.length <= 40 ? `${kind}: ${name}` : kind;
    const property = assignments.find(item => item.path === page && item.selector === selector)?.property ?? (fromMap ? mapProperties.get(target) : undefined) ?? propertyFor(target);
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
  window.addEventListener("click", event => {
    const fromMap = roleMap && !event.altKey && !inspecting && Boolean(mappedTarget(event.target));
    if (!inspecting && !event.altKey && !fromMap) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectElement(event.target, event.clientX, event.clientY, fromMap);
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
    roleMap = event.data.roleMap === true;
    mapLayer.style.display = roleMap ? "block" : "none";
    if (!roleMap) { clearTimeout(mapTimer); mapLayer.replaceChildren(); mapProperties = new WeakMap(); }
    selectedSelector = typeof event.data.selectedSelector === "string" ? event.data.selectedSelector : "";
    document.documentElement.style.cursor = inspecting ? "crosshair" : "";
    setOutline(inspecting ? hovered : null);
    applyAssignments();
    scheduleRoleMap();
  });
  window.parent.postMessage({ type: "hexmix-inspector-ready" }, editorOrigin);
})();
