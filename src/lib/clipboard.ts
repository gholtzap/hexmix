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
