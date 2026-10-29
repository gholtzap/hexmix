import {isEditingText} from './input-events.ts';

export async function copyText(text: string, container = document.activeElement?.closest<HTMLElement>('dialog,[role="dialog"]') ?? document.body): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const focused = document.activeElement;
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    container.append(input);
    input.select();
    try { return document.execCommand('copy'); }
    catch { return false; }
    finally {
      input.remove();
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
    }
  }
}

export function readThemePaste(event: ClipboardEvent): string | null {
  if (event.defaultPrevented || !event.clipboardData?.types.includes('text/plain')) return null;
  if (isEditingText(event)) return null;
  return event.clipboardData.getData('text/plain');
}
