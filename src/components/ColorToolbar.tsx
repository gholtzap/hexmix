"use client";

import { useEffect, useId, type Dispatch, type SetStateAction } from "react";
import { LockKeyhole, UnlockKeyhole, X } from "lucide-react";
import IconButton from "./IconButton";
import { PopoverAnchor } from "./ui/popover";
import { contrast, isPalette, quickPickPresets, roles, type Palette, type Role } from "@/lib/palette";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerCopy,
  ColorPickerEyeDropper,
  ColorPickerFields,
  ColorPickerPanel,
  ColorPickerSlider,
  ColorPickerSwatches,
  ColorPickerTrigger,
} from "./reui/color-picker";

type Props = {
  palette: Palette; committedPalette: Palette; locked: Role[]; activeColor: Role | null;
  toolbarElement: HTMLElement | null; panel: "fonts" | "saved" | null;
  setActiveColor: Dispatch<SetStateAction<Role | null>>;
  setPreviewPalette: Dispatch<SetStateAction<Palette | null>>;
  setPanel: Dispatch<SetStateAction<"fonts" | "saved" | null>>;
  setLocked: Dispatch<SetStateAction<Role[]>>;
  apply: (palette: Palette) => void;
  onReady: () => void;
};

export default function ColorToolbar({ palette, committedPalette, locked, activeColor, toolbarElement, panel, setActiveColor, setPreviewPalette, setPanel, setLocked, apply, onReady }: Props) {
  const swatchTooltip = useId();
  useEffect(onReady, [onReady]);
  return (<div className="toolbar-colors">
              {roles.map((role) => (
                <div className="toolbar-color" key={role}>
                  <ColorPicker
                    value={palette[role]}
                    format="hex"
                    open={activeColor === role}
                    onOpenChange={(open) => {
                      setActiveColor((current) => open ? role : current === role ? null : current);
                      setPreviewPalette(null);
                      if (open) setPanel(null);
                    }}
                    onValueChange={(value) => {
                      const next = { ...committedPalette, [role]: value };
                      if (isPalette(next)) setPreviewPalette(next);
                    }}
                    onValueCommit={(value) => {
                      const next = { ...committedPalette, [role]: value };
                      if (isPalette(next)) apply(next);
                    }}
                    aria-label={`${role[0].toUpperCase() + role.slice(1)} color`}
                  >
                    <PopoverAnchor virtualRef={{ current: toolbarElement }} />
                    <ColorPickerTrigger
                      className="color-trigger"
                      aria-describedby={`${swatchTooltip}-${role}`}
                      style={{
                        background: palette[role],
                        color:
                          contrast(palette[role], "#ffffff") >=
                          contrast(palette[role], "#000000")
                            ? "#ffffff"
                            : "#000000",
                      }}
                    >
                      <span className="color-trigger-name">{role === "background" ? <><span className="background-name-wide">Background</span><span className="background-name-narrow" aria-hidden="true" /></> : role === "secondary" ? <>Secon<wbr />dary</> : role === "primary" ? <>Pri<wbr />mary</> : role === "accent" ? <>Acc<wbr />ent</> : role[0].toUpperCase() + role.slice(1)}</span>
                      {locked.includes(role) && <LockKeyhole size={12} aria-hidden="true" />}<span className="control-tooltip swatch-tooltip" role="tooltip" id={`${swatchTooltip}-${role}`}>{role[0].toUpperCase() + role.slice(1)} color</span>
                    </ColorPickerTrigger>
                    <ColorPickerContent
                      className="color-picker-content"
                      side="top"
                      sideOffset={16}
                      align="center"
                      onCloseAutoFocus={(event) => {
                        if (panel || (activeColor && activeColor !== role)) event.preventDefault();
                      }}
                    >
                      <div className="color-picker-heading">
                        <h2>{role[0].toUpperCase() + role.slice(1)}</h2>
                        <IconButton
                          className="icon-button"
                          aria-pressed={locked.includes(role)}
                          title={`${locked.includes(role) ? "Unlock" : "Lock"} ${role}`}
                          aria-label={`${locked.includes(role) ? "Unlock" : "Lock"} ${role}`}
                          onClick={() =>
                            setLocked(
                              locked.includes(role)
                                ? locked.filter((item) => item !== role)
                                : [...locked, role],
                            )
                          }
                        >
                          {locked.includes(role) ? (
                            <LockKeyhole size={11} />
                          ) : (
                            <UnlockKeyhole size={11} />
                          )}
                        </IconButton>
                        <IconButton
                          className="icon-button"
                          aria-label="Close color picker"
                          onClick={() => {
                            setActiveColor(null);
                            setPreviewPalette(null);
                          }}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                      <ColorPickerPanel>
                        <ColorPickerArea />
                        <div className="flex items-center gap-3">
                          <ColorPickerEyeDropper className="icon-button" />
                          <ColorPickerSlider channel="hue" className="flex-1" />
                          <ColorPickerCopy className="icon-button" />
                        </div>
                        <ColorPickerFields formats={["hex", "rgb", "hsl"]} />
                        <ColorPickerSwatches
                          colors={quickPickPresets.map((preset) => ({
                            value: preset.colors[role],
                            label: preset.name,
                          }))}
                        />
                      </ColorPickerPanel>
                    </ColorPickerContent>
                  </ColorPicker>
                </div>
              ))}
            </div>);
}
