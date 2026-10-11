import { assertGameState, score, type GameState } from '../game/game.js';

export const STORAGE_KEY = 'gruselino.game.v1';
export interface StorageAccess { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function browserStorage(): StorageAccess {
  return { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
}
export function loadGame(storage: StorageAccess): { state: GameState | null; error: string | null } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: null, error: null };
    const state: unknown = JSON.parse(raw);
    assertGameState(state);
    return { state, error: null };
  } catch { return { state: null, error: 'Der Spielstand konnte nicht geladen werden. Du kannst eine neue Partie starten.' }; }
}
export function saveGame(storage: StorageAccess, state: GameState): string | null {
  try { assertGameState(state); storage.setItem(STORAGE_KEY, JSON.stringify(state)); return null; }
  catch { return 'Speichern hat nicht geklappt. Die Partie läuft nur in diesem Fenster weiter.'; }
}
export function getSavedSummary(storage: StorageAccess = browserStorage()): { card: number; score: number; finished: boolean } | null {
  const { state } = loadGame(storage);
  return state ? { card: Math.min(state.index + 1, 33), score: score(state, 'human'), finished: state.status === 'finished' } : null;
}
