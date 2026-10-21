export async function copyText(text: string, container = document.body): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    container.append(input);
    input.select();
    try { return document.execCommand('copy'); }
    catch { return false; }
    finally { input.remove(); }
  }
}

export function readThemePaste(event: ClipboardEvent): string | null {
  if (event.defaultPrevented || !event.clipboardData?.types.includes('text/plain')) return null;
  const editable = 'input:not([type=button]):not([type=submit]):not([type=reset]),textarea,select,[contenteditable]:not([contenteditable="false"])';
  if (event.composedPath().some(node => typeof (node as Element).closest === 'function' && (node as Element).closest(editable))) return null;
  return event.clipboardData.getData('text/plain');
}
