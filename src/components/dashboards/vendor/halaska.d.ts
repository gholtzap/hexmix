import type { ComponentType, CSSProperties, ReactNode } from 'react';
type Theme = 'light' | 'dark';
export const tokens: { font: { sans: string; mono: string }; light: Record<string,string>; dark: Record<string,string> };
export const CardDialog: ComponentType<{ open: boolean; onClose: () => void; title: string; children?: ReactNode; theme?: Theme }>;
export const SegmentedControl: ComponentType<{ options: string[]; value: string; onChange: (value: string) => void; theme?: Theme }>;
export const Slider: ComponentType<{ value: number; onChange: (value: number) => void; min?: number; max?: number; label?: string; theme?: Theme; 'aria-label'?: string }>;
export const DropdownMenu: ComponentType<{ trigger?: ReactNode; items: { label: string; onClick: () => void }[]; theme?: Theme; externalAnchor?: HTMLElement; onClose?: () => void }>;
export const Toast: ComponentType<{ message: string; theme?: Theme }>;
export const IconButton: ComponentType<{ icon: ReactNode; label: string; size?: number; onClick?: () => void; theme?: Theme; style?: CSSProperties }>;
