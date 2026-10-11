import { FIGURES, isFigure, type FigureId } from './figures.js';

export type Random = () => number;
export type Difficulty = 'easy' | 'strong';
export interface Placement { figure: FigureId; slot: number; rotation: number; scale: number }
export interface Card { id: string; missing: FigureId; figures: Placement[] }
export interface Player { id: string; name: string; difficulty: Difficulty | null }
export interface Award { cardId: string; playerId: string; timeMs: number }
export interface GameState {
  version: 1;
  status: 'ready' | 'searching' | 'result' | 'finished';
  players: Player[];
  deck: Card[];
  index: number;
  awards: Award[];
}
export interface Answer { playerId: string; figure: FigureId; timeMs: number }

export function randomIndex(length: number, random: Random): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1 || length < 1) throw new Error('Ungültiger Zufallswert.');
  return Math.floor(value * length);
}

export function shuffle<T>(values: readonly T[], random: Random = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1, random);
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled;
}

export function createGame(computers: number, difficulty: Difficulty, random: Random = Math.random): GameState {
  if (!Number.isInteger(computers) || computers < 1 || computers > 3 || !['easy', 'strong'].includes(difficulty)) throw new Error('Bitte wähle ein bis drei Computer und eine Spielstärke.');
  const figures = FIGURES.map(figure => figure.id);
  const solutions = shuffle([...figures, ...figures, ...figures, ...figures, figures[randomIndex(8, random)]!], random);
  const deck = solutions.map((missing, index): Card => {
    const slots = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], random);
    return { id: `card-${String(index + 1).padStart(2, '0')}`, missing,
      figures: shuffle(figures.filter(id => id !== missing), random).map((figure, position) => ({
        figure, slot: slots[position]!, rotation: randomIndex(25, random) - 12, scale: 90 + randomIndex(19, random),
      })) };
  });
  const state: GameState = { version: 1, status: 'ready', players: [
    { id: 'human', name: 'Du', difficulty: null },
    ...Array.from({ length: computers }, (_, index) => ({ id: `bot-${index + 1}`, name: `Computer ${index + 1}`, difficulty })),
  ], deck, index: 0, awards: [] };
  assertGameState(state);
  return state;
}

export const currentCard = (state: GameState): Card | null => state.deck[state.index] ?? null;
export const score = (state: GameState, playerId: string): number => state.awards.filter(award => award.playerId === playerId).length;
export function winners(state: GameState): Player[] {
  const best = Math.max(...state.players.map(player => score(state, player.id)));
  return state.players.filter(player => score(state, player.id) === best);
}

export function reveal(state: GameState): GameState {
  return state.status === 'ready' ? { ...state, status: 'searching' } : state;
}

export function resolveAnswers(state: GameState, cardId: string, answers: readonly Answer[], random: Random = Math.random): GameState {
  const card = currentCard(state);
  if (!card || state.status !== 'searching' || card.id !== cardId) return state;
  const correct = answers.filter(answer => answer.figure === card.missing && Number.isSafeInteger(answer.timeMs) && answer.timeMs >= 0 && state.players.some(player => player.id === answer.playerId));
  if (!correct.length) return state;
  const first = Math.min(...correct.map(answer => answer.timeMs));
  const tied = correct.filter(answer => answer.timeMs === first).filter((answer, index, all) => all.findIndex(other => other.playerId === answer.playerId) === index);
  const winner = tied.length === 1 ? tied[0]! : tied[randomIndex(tied.length, random)]!;
  return { ...state, status: 'result', awards: [...state.awards, { cardId, playerId: winner.playerId, timeMs: winner.timeMs }] };
}

export function nextCard(state: GameState): GameState {
  if (state.status !== 'result') return state;
  const index = state.index + 1;
  return { ...state, index, status: index === state.deck.length ? 'finished' : 'ready' };
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function integer(value: unknown, min: number, max: number): value is number { return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max; }

export function assertGameState(value: unknown): asserts value is GameState {
  const invalid = (): never => { throw new Error('Ungültiger Gruselino-Spielstand.'); };
  if (!record(value) || value.version !== 1 || !['ready', 'searching', 'result', 'finished'].includes(String(value.status)) || !integer(value.index, 0, 33) || !Array.isArray(value.players) || value.players.length < 2 || value.players.length > 4 || !Array.isArray(value.deck) || value.deck.length !== 33 || !Array.isArray(value.awards)) invalid();
  const state = value as unknown as GameState;
  state.players.forEach((player, index) => {
    if (!record(player) || player.id !== (index ? `bot-${index}` : 'human') || player.name !== (index ? `Computer ${index}` : 'Du') || (index ? !['easy', 'strong'].includes(String(player.difficulty)) : player.difficulty !== null)) invalid();
  });
  const counts = new Map<FigureId, number>();
  const cardIds = new Set<string>();
  state.deck.forEach(card => {
    if (!record(card) || typeof card.id !== 'string' || !/^card-(?:0[1-9]|[12][0-9]|3[0-3])$/.test(card.id) || cardIds.has(card.id) || !isFigure(card.missing) || !Array.isArray(card.figures) || card.figures.length !== 7) invalid();
    cardIds.add(card.id);
    counts.set(card.missing, (counts.get(card.missing) ?? 0) + 1);
    const seen = new Set<FigureId>();
    const slots = new Set<number>();
    card.figures.forEach(placement => {
      if (!record(placement) || !isFigure(placement.figure) || placement.figure === card.missing || seen.has(placement.figure) || !integer(placement.slot, 0, 8) || slots.has(placement.slot) || !integer(placement.rotation, -12, 12) || !integer(placement.scale, 90, 108)) invalid();
      seen.add(placement.figure); slots.add(placement.slot);
    });
  });
  if (FIGURES.some(figure => ![4, 5].includes(counts.get(figure.id) ?? 0))) invalid();
  const expected = state.index + (state.status === 'result' ? 1 : 0);
  if ((state.status === 'finished') !== (state.index === 33) || state.awards.length !== expected) invalid();
  state.awards.forEach((award, index) => {
    if (!record(award) || award.cardId !== state.deck[index]!.id || !state.players.some(player => player.id === award.playerId) || !integer(award.timeMs, 0, Number.MAX_SAFE_INTEGER)) invalid();
  });
}
