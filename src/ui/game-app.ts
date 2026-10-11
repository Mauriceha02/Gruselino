import { mountSoloGruselino, type GameOptions } from './solo-game.js';
import { mountLocalGruselino } from './local-game.js';
export { getSavedSummary } from '../storage/local-game.js';

function invited(): string | undefined {
  const hash = location.hash;
  return hash.startsWith('#gruselino?') ? new URLSearchParams(hash.slice(11)).get('invite') ?? undefined : undefined;
}
export function mountGruselino(root: HTMLElement, options: GameOptions = {}): { dispose(): void } {
  let current: { dispose(): void; invitation?(code: string): void } | null = null;
  let disposed = false;
  let generation = 0;
  let local = false;
  let loading = new AbortController();
  function solo(): void {
    generation++; loading.abort(); loading = new AbortController(); local = false; current?.dispose();
    current = mountSoloGruselino(root, { ...options, onMultiplayer: () => { void multiplayer(); } });
  }
  async function multiplayer(invite?: string): Promise<void> {
    if (local && current?.invitation) { if (invite) current.invitation(invite); return; }
    const token = ++generation; loading.abort(); loading = new AbortController(); local = true; current?.dispose(); current = null;
    root.textContent = 'Mehrspielermodus wird geladen.';
    try {
      const instance = await mountLocalGruselino(root, { onBack: solo, signal: loading.signal, ...(options.assetBase ? { assetBase: options.assetBase } : {}), ...(invite ? { invite } : {}) });
      if (disposed || token !== generation) { instance.dispose(); return; }
      current = instance;
    } catch { if (!disposed && token === generation) { local = false; solo(); const notice = root.querySelector('.g-storage'); if (notice) notice.textContent = 'Mehrspielermodus konnte nicht geladen werden. Bitte öffne die App erneut.'; } }
  }
  function receive(): void {
    const invite = invited(); if (!invite) return;
    history.replaceState(null, '', location.pathname + location.search + '#gruselino');
    void multiplayer(invite);
  }
  window.addEventListener('hashchange', receive);
  if (invited()) receive(); else solo();
  return { dispose(): void { disposed = true; generation++; loading.abort(); window.removeEventListener('hashchange', receive); current?.dispose(); } };
}
