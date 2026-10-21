"use client";
/*! Halaska UI v1.0, MIT. Source: https://raw.githubusercontent.com/Halaska-Studio/ui/f11ab6958de3fb186a4d431e8425bbe43a6dc87b/halaska-kit/halaska-kit-v1.0.jsx
 * Selected upstream components; external menu trigger adapter and CSS palette added. See HALASKA-LICENSE. */
import { useState, useRef, useEffect, useCallback, createContext, useContext, Fragment, cloneElement, isValidElement } from "react";

const tokens = {
  space: { xs: 4, sm: 8, md: 16, lg: 32, xl: 40, xxl: 80, xxxl: 160, xxxxl: 240 },
  radius: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, pill: 999 },
  type: {
    xxs: { fontSize: 9, lineHeight: 1.3 },
    xs: { fontSize: 10, lineHeight: 1.45 },
    sm: { fontSize: 12, lineHeight: 1.55, letterSpacing: "0.01em" },
    base: { fontSize: 13, lineHeight: 1.6, letterSpacing: "0.01em" },
    md: { fontSize: 14, lineHeight: 1.6, letterSpacing: "0.005em" },
    lg: { fontSize: 16, lineHeight: 1.5 },
    xl: { fontSize: 20, lineHeight: 1.35 },
    xxl: { fontSize: 24, lineHeight: 1.3 },
    xxxl: { fontSize: 32, lineHeight: 1.2 },
    display: { fontSize: 40, lineHeight: 1.15 },
  },
  font: {
    // CSS variables so the whole kit can switch typeface at runtime (setKitFont)
    sans: "var(--p-body-font, system-ui, sans-serif)",
    mono: "var(--halaska-mono, 'Geist Mono'), 'SF Mono', 'Fira Code', monospace",
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  light: {
    bg: "#fafafa",
    bgElevated: "#ffffff",
    bgSubtle: "#f3f3f3",
    bgMuted: "#eeeeee",
    bgHover: "#e8e8e8",
    bgInput: "#f0f0f0",
    border: "#e5e5e5",
    borderSubtle: "#eeeeee",
    borderInput: "rgba(0,0,0,0.06)",
    borderFocus: "#444444",
    text: "#3d3d3d",
    textSecondary: "#888888",
    textTertiary: "#aaaaaa",
    textMuted: "#cccccc",
    textInverse: "#ffffff",
    shadow: "rgba(0,0,0,0.04)",
    shadowMd: "rgba(0,0,0,0.06)",
    shadowLg: "rgba(0,0,0,0.1)",
    accent: "#8b5cf6",
    accentHover: "#7c3aed",
    accentBg: "#f5f3ff",
    accentText: "#8b5cf6",
    success: "#22c55e",
    successHover: "#16a34a",
    successBg: "#f0fdf4",
    warning: "#f59e0b",
    warningHover: "#d97706",
    warningBg: "#fffbeb",
    danger: "#ef4444",
    dangerHover: "#dc2626",
    dangerBg: "#fef2f2",
  },
  dark: {
    bg: "#1a1a1a",
    bgElevated: "#2a2a2a",
    bgSubtle: "#222222",
    bgMuted: "#333333",
    bgHover: "#3d3d3d",
    bgInput: "#252525",
    border: "#3a3a3a",
    borderSubtle: "#2f2f2f",
    borderInput: "rgba(255,255,255,0.06)",
    borderFocus: "#cccccc",
    text: "#d8d8d8",
    textSecondary: "#999999",
    textTertiary: "#6a6a6a",
    textMuted: "#4a4a4a",
    textInverse: "#1a1a1a",
    shadow: "rgba(0,0,0,0.2)",
    shadowMd: "rgba(0,0,0,0.3)",
    shadowLg: "rgba(0,0,0,0.4)",
    accent: "#a78bfa",
    accentHover: "#8b5cf6",
    accentBg: "rgba(167,139,250,0.12)",
    accentText: "#a78bfa",
    success: "#4ade80",
    successHover: "#22c55e",
    successBg: "rgba(74,222,128,0.1)",
    warning: "#fbbf24",
    warningHover: "#f59e0b",
    warningBg: "rgba(251,191,36,0.1)",
    danger: "#f87171",
    dangerHover: "#ef4444",
    dangerBg: "rgba(248,113,113,0.1)",
  },
};

const motion = {
  fast: "var(--halaska-t-fast, 0.15s)",      // micro-interactions, state changes
  normal: "var(--halaska-t-normal, 0.25s)",  // most UI transitions
  smooth: "var(--halaska-t-smooth, 0.35s)",  // expanding panels, color transitions
  spring: "var(--halaska-t-spring, 0.4s)",   // bouncy elements (radio, segmented)
  slow: "var(--halaska-t-slow, 0.5s)",       // page-level transitions

  easeInOut: "var(--halaska-e-inout, cubic-bezier(0.4, 0, 0.2, 1))",   // standard, on-screen movement
  easeOut: "var(--halaska-e-out, cubic-bezier(0.0, 0, 0.2, 1))",       // deceleration, entering elements
  easeIn: "var(--halaska-e-in, cubic-bezier(0.4, 0, 1, 1))",           // acceleration, exiting elements
  emphasized: "var(--halaska-e-emph, cubic-bezier(0.2, 0, 0, 1))",     // dramatic deceleration
  springCurve: "var(--halaska-e-spring, cubic-bezier(0.34, 1.56, 0.64, 1))", // Apple-style overshoot
};

const ThemeContext = createContext("light");

function useThemeContext() { return useContext(ThemeContext); }

const AccentContext = createContext(null);

function useAccent() { return useContext(AccentContext); }

function p(theme) {
  const base = theme === "dark" ? tokens.dark : tokens.light;
  return {
    ...base,
    bg: "var(--halaska-bg, var(--p-background))",
    bgElevated: "var(--halaska-bg-elevated, var(--p-secondary))",
    bgSubtle: "var(--halaska-bg-subtle, var(--hover))",
    bgMuted: "var(--p-secondary)",
    text: "var(--p-text)",
    textSecondary: "var(--p-accent)",
    textTertiary: "var(--p-accent)",
    borderSubtle: "var(--halaska-border-subtle, var(--line))",
    accent: "var(--halaska-accent, var(--p-accent))",
  };
}

function usePal(themeProp) {
  const ctxTheme = useThemeContext();
  const theme = themeProp || ctxTheme;
  const accent = useAccent();
  const base = p(theme);
  if (!accent || accent === base.accent) return base;
  // Generate variants from the accent hex
  const hex = accent;
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  const hR = Math.max(0, r - 30), hG = Math.max(0, g - 30), hB = Math.max(0, b - 30);
  const hoverHex = `#${hR.toString(16).padStart(2,'0')}${hG.toString(16).padStart(2,'0')}${hB.toString(16).padStart(2,'0')}`;
  const bgAlpha = theme === "dark" ? 0.12 : 0.08;
  return {
    ...base,
    accent: hex,
    accentText: hex,
    accentHover: hoverHex,
    accentBg: `rgba(${r},${g},${b},${bgAlpha})`,
  };
}

const interactiveBase = {
  fontFamily: tokens.font.sans,
  cursor: "pointer",
  border: "none",
  outline: "none",
  transition: `all ${motion.normal} ${motion.easeInOut}`,
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModalFocus(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const opener = document.activeElement;
    const items = () => ref.current ? [...ref.current.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length) : [];
    const t = setTimeout(() => {
      const node = ref.current;
      if (node && !node.contains(document.activeElement)) (items()[0] || node).focus({ preventScroll: true });
    }, 0);
    const onKey = (e) => {
      const node = ref.current;
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current?.(); return; }
      if (e.key !== "Tab" || !node) return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1], active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

function arrowNav(e, { selector = "button:not([disabled])", horizontal = true, vertical = true, onEscape } = {}) {
  if (e.key === "Escape" && onEscape) { e.stopPropagation(); onEscape(); return null; }
  const prev = (horizontal && e.key === "ArrowLeft") || (vertical && e.key === "ArrowUp");
  const next = (horizontal && e.key === "ArrowRight") || (vertical && e.key === "ArrowDown");
  if (!prev && !next && e.key !== "Home" && e.key !== "End") return null;
  const items = [...e.currentTarget.querySelectorAll(selector)];
  if (!items.length) return null;
  const i = items.indexOf(document.activeElement);
  const target = e.key === "Home" ? items[0] : e.key === "End" ? items[items.length - 1]
    : items[(i + (next ? 1 : -1) + items.length) % items.length];
  e.preventDefault();
  target.focus();
  return target;
}

const focusFirstItem = (el) => { if (el) { const b = el.querySelector("button:not([disabled])"); if (b) b.focus({ preventScroll: true }); } };

const withPopupState = (trigger, open, popup) =>
  (isValidElement(trigger) ? cloneElement(trigger, { "aria-expanded": open, "aria-haspopup": popup }) : trigger);

const labelText = (label) => (typeof label === "string" ? label : undefined);

function Text({
  children, size = "base", weight = "regular", color, mono, muted, secondary,
  align, truncate, theme: tp, style: sp, as: C = "span",
}) {
  const ctx = useThemeContext();
  const theme = tp || ctx;
  const pal = usePal(theme);
  let c = pal.text;
  if (color) c = color;
  else if (muted) c = pal.textMuted;
  else if (secondary) c = pal.textSecondary;

  return (
    <C style={{
      ...tokens.type[size], fontWeight: tokens.weight[weight],
      fontFamily: mono ? tokens.font.mono : tokens.font.sans,
      color: c, textAlign: align, transition: `color ${motion.smooth} ${motion.easeInOut}`,
      ...(truncate && { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
      ...sp,
    }}>{children}</C>
  );
}

function Label({ children, required, htmlFor, theme: tp, style: sp }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  return (
    <label htmlFor={htmlFor} style={{
      ...tokens.type.sm, fontWeight: tokens.weight.medium, fontFamily: tokens.font.sans,
      color: pal.textSecondary, display: "flex", alignItems: "center",
      gap: 4, transition: `color ${motion.smooth} ${motion.easeInOut}`, ...sp,
    }}>{children}{required && <span aria-hidden="true" style={{ color: pal.danger }}>*</span>}</label>
  );
}

function IconButton({ icon, size = 36, variant = "ghost", onClick, theme: tp, label: ariaLabel, style: sp, "aria-expanded": ariaExpanded, "aria-haspopup": ariaHaspopup, "aria-describedby": ariaDescribedby }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  const [hover, setHover] = useState(false);
  const bgMap = {
    ghost: hover ? pal.bgSubtle : "transparent",
    secondary: hover ? pal.bgHover : pal.bgMuted,
    outline: hover ? pal.bgSubtle : "transparent",
  };
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={ariaLabel} aria-expanded={ariaExpanded} aria-haspopup={ariaHaspopup} aria-describedby={ariaDescribedby} style={{
        ...interactiveBase, width: size, height: size, borderRadius: tokens.radius.md,
        background: bgMap[variant] || bgMap.ghost, color: pal.textSecondary,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45,
        transform: hover ? "scale(1.12)" : "scale(1)",
        ...sp,
      }}>{icon}</button>
  );
}

function SegmentedControl({ options, value, onChange, theme: tp }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);

  return (
    <div role="radiogroup"
      onKeyDown={(e) => { const el = arrowNav(e); if (el) el.click(); }}
      style={{
      display: "flex", alignItems: "center",
      background: theme === "dark" ? "rgba(51,51,51,0.5)" : "rgba(238,238,238,0.6)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      borderRadius: tokens.radius.md, padding: 3, position: "relative", transition: `all ${motion.smooth} ${motion.easeInOut}`,
    }}>
      {options.map((opt) => (
        <button key={opt} type="button" role="radio" aria-checked={value === opt} tabIndex={value === opt ? 0 : -1}
          onClick={() => onChange(opt)} style={{
          ...interactiveBase, position: "relative", zIndex: 1, padding: "6px 14px",
          background: value === opt ? "var(--p-secondary)" : "transparent", ...tokens.type.sm, flex: "1 0 auto",
          fontWeight: value === opt ? tokens.weight.medium : tokens.weight.regular,
          color: value === opt ? "var(--p-on-secondary, var(--p-text))" : pal.textTertiary, borderRadius: tokens.radius.sm + 2, whiteSpace: "nowrap",
          textAlign: "center",
        }}>{opt}</button>
      ))}
    </div>
  );
}

function Toast({ message, variant = "default", icon, theme: tp }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  const bgMap = { default: pal.bgElevated, success: pal.successBg, warning: pal.warningBg, danger: pal.dangerBg };
  const colorMap = { default: pal.text, success: pal.success, warning: pal.warning, danger: pal.danger };
  return (
    <div role={variant === "danger" ? "alert" : "status"} style={{
      display: "inline-flex", alignItems: "center", gap: 12,
      padding: `${12}px ${16}px`, background: bgMap[variant],
      borderRadius: tokens.radius.lg, boxShadow: `0 2px 8px ${pal.shadow}`,
      fontFamily: tokens.font.sans, transition: `all ${motion.smooth} ${motion.easeInOut}`,
    }}>
      {icon && <span style={{ fontSize: 16, color: colorMap[variant] }}>{icon}</span>}
      <Text size="base" theme={theme} style={{ color: colorMap[variant] }}>{message}</Text>
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 100, label, theme: tp, "aria-label": ariaLabel }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && <Label theme={theme}>{label}</Label>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="range" min={min} max={max} value={value} aria-label={ariaLabel || labelText(label) || "Value"} onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, height: 4, appearance: "none", background: `linear-gradient(to right, ${pal.accent} ${pct}%, ${pal.bgMuted} ${pct}%)`, borderRadius: 2, outline: "none", cursor: "pointer" }} />
        <span style={{ ...tokens.type.sm, color: pal.textTertiary, fontFamily: tokens.font.mono, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{value}</span>
      </div>
    </div>
  );
}

function CardDialog({ open, onClose, cover, title, description, children, actions, theme: tp }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  const panelRef = useModalFocus(open, onClose);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
      animation: `halaska-fade-in ${motion.fast} ${motion.easeOut} both`,
    }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={labelText(title)} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{
        background: theme === "dark" ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderRadius: tokens.radius.lg, overflow: "hidden", minWidth: 360, maxWidth: 480,
        border: `1px solid ${pal.borderSubtle}`, boxShadow: `0 16px 48px ${pal.shadowLg}`,
        animation: `halaska-scale-in ${motion.normal} ${motion.emphasized} both`, fontFamily: tokens.font.sans,
      }}>
        {cover && (
          <div style={{ height: 140, background: `linear-gradient(135deg, ${pal.accent}, ${pal.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, transition: `background ${motion.smooth} ${motion.easeInOut}` }}>{cover}</div>
        )}
        <div style={{ padding: 24 }}>
          {title && <div style={{ ...tokens.type.lg, fontWeight: tokens.weight.semibold, color: pal.text, marginBottom: 4 }}>{title}</div>}
          {description && <div style={{ ...tokens.type.sm, color: pal.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>{description}</div>}
          {children && <div style={{ marginBottom: 16 }}>{children}</div>}
          {actions && <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function DropdownMenu({ trigger, items, theme: tp, externalAnchor, onClose }) {
  const ctx = useThemeContext(); const theme = tp || ctx; const pal = usePal(theme);
  const [open, setOpen] = useState(Boolean(externalAnchor));
  const [hoverIdx, setHoverIdx] = useState(-1);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const close = (refocus) => {
    setOpen(false);
    onClose?.();
    if (refocus && externalAnchor?.isConnected) externalAnchor.focus();
    if (refocus && !externalAnchor) rootRef.current?.querySelector("[data-menu-trigger] button, [data-menu-trigger] [tabindex]")?.focus();
  };
  // Opening from the keyboard lands on the first item.
  const openMenu = (viaKeyboard) => {
    setOpen(true);
    if (viaKeyboard) setTimeout(() => focusFirstItem(menuRef.current), 0);
  };
  return (
    <div ref={rootRef} onKeyDown={(e) => { if (e.key === "Escape" && open && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); close(true); } }} style={{ position: "relative", display: "inline-flex" }}>
      <div hidden={Boolean(externalAnchor)} data-menu-trigger
        onClick={(e) => (open ? close() : openMenu(e.detail === 0))}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); openMenu(true); } }}>{withPopupState(trigger, open, "menu")}</div>
      {open && <div onClick={() => close()} style={{ position: "fixed", inset: 0, zIndex: 9999 }} />}
      <div ref={menuRef} role="menu" aria-hidden={!open}
        onKeyDown={(e) => { if (e.key === "Tab") { close(); return; } arrowNav(e, { horizontal: false, onEscape: () => close(true) }); }}
        style={{
        position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 10000,
        background: theme === "dark" ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${pal.borderSubtle}`, borderRadius: tokens.radius.md,
        padding: 4, minWidth: 180, boxShadow: `0 8px 24px ${pal.shadowLg}`,
        opacity: open ? 1 : 0, transform: open ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.97)",
        pointerEvents: open ? "auto" : "none", visibility: open ? "visible" : "hidden",
        transition: `opacity ${motion.fast} ${motion.easeOut}, transform ${motion.normal} ${motion.emphasized}, visibility 0s linear ${open ? "0s" : motion.normal}`,
      }}>
        {items.map((item, i) => item.separator ? (
          <div key={i} role="separator" style={{ height: 1, background: pal.borderSubtle, margin: "4px 0" }} />
        ) : (
          <button key={i} type="button" role="menuitem" onClick={() => { item.onClick?.(); close(true); }}
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(-1)}
            style={{
              ...interactiveBase, width: "100%", textAlign: "left", ...tokens.type.sm,
              padding: "8px 12px", borderRadius: tokens.radius.sm,
              color: item.danger ? pal.danger : pal.text,
              background: hoverIdx === i ? pal.bgSubtle : "transparent",
              display: "flex", alignItems: "center", gap: 8,
              transition: `background ${motion.normal} ${motion.easeInOut}, color ${motion.normal} ${motion.easeInOut}`,
            }}>
            {item.icon && <span aria-hidden="true" style={{ fontSize: 13, color: item.danger ? pal.danger : pal.textTertiary }}>{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
export { CardDialog, SegmentedControl, Slider, DropdownMenu, Toast, IconButton, tokens };
