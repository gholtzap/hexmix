export function isEditingText(event: Event): boolean {
  const editable = 'input:not([type=button]):not([type=submit]):not([type=reset]),textarea,select,[contenteditable]:not([contenteditable="false"])';
  return event.composedPath().some(node => typeof (node as Element).closest === 'function' && Boolean((node as Element).closest(editable)));
}

export function paletteHistoryShortcut(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (event.defaultPrevented || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || isEditingText(event)) return null;
  return event.shiftKey ? 'redo' : 'undo';
}
