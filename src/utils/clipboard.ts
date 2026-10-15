/** Clipboard permission can be denied; never announce a copy that did not succeed. */
export async function copyChatText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}
