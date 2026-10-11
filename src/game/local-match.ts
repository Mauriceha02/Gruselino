import { createGame, type Card, type CardCount, type Placement } from './game.js';
import { FIGURES, isFigure, type FigureId } from './figures.js';

export type Role = 'host' | 'guest';
export type Stage = 'loading' | 'countdown' | 'searching' | 'result' | 'paused' | 'finished';
export interface LocalSnapshot {
  version: 2; revision: number; round: string; index: number; total: CardCount; stage: Stage;
  card: { id: string; figures: Placement[] } | null;
  scores: Record<Role, number>; winner: Role | null;
}
export interface LocalAnswer { round: string; figure: FigureId }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export class LocalMatch {
  private deck: Card[];
  private index = 0;
  private revision = 0;
  private attempt = 0;
  private stage: Stage = 'loading';
  private beforePause: Stage = 'loading';
  private awarded: Role[] = [];
  private readyPlayers = new Set<Role>();
  private cooldown: Record<Role, number> = { host: 0, guest: 0 };
  constructor(private id: string, total: CardCount) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Ungültige Partie.');
    this.deck = createGame(1, 'easy', Math.random, total).deck;
  }
  snapshot(): LocalSnapshot {
    const card = this.deck[this.index];
    return {
      version: 2, revision: this.revision, round: `${this.id}:${this.index}:${this.attempt}`, index: this.index,
      total: this.deck.length as CardCount, stage: this.stage,
      card: card && ['searching', 'result'].includes(this.stage) ? { id: card.id, figures: card.figures.map(figure => ({ ...figure })) } : null,
      scores: { host: this.awarded.filter(role => role === 'host').length, guest: this.awarded.filter(role => role === 'guest').length },
      winner: this.awarded[this.index] ?? null,
    };
  }
  ready(role: Role, round: string): boolean {
    if ((role !== 'host' && role !== 'guest') || this.stage !== 'loading' || round !== this.snapshot().round) return false;
    this.readyPlayers.add(role);
    if (this.readyPlayers.size !== 2) return false;
    this.stage = 'countdown'; this.revision++;
    return true;
  }
  reveal(round: string): boolean {
    if (this.stage !== 'countdown' || round !== this.snapshot().round) return false;
    this.stage = 'searching'; this.revision++;
    return true;
  }
  answer(role: Role, value: unknown, now: number): 'ignored' | 'wrong' | 'blocked' | 'won' {
    if ((role !== 'host' && role !== 'guest') || this.stage !== 'searching' || !record(value) || value.round !== this.snapshot().round || !isFigure(value.figure) || !Number.isFinite(now) || now < 0) return 'ignored';
    if (now < this.cooldown[role]) return 'blocked';
    if (value.figure !== this.deck[this.index]!.missing) { this.cooldown[role] = now + 1500; return 'wrong'; }
    this.awarded.push(role); this.stage = 'result'; this.revision++;
    return 'won';
  }
  advance(round: string): boolean {
    if (this.stage !== 'result' || round !== this.snapshot().round) return false;
    this.index++; this.attempt = 0; this.revision++; this.readyPlayers.clear(); this.cooldown = { host: 0, guest: 0 };
    this.stage = this.index === this.deck.length ? 'finished' : 'loading';
    return true;
  }
  pause(): boolean {
    if (this.stage === 'paused' || this.stage === 'finished') return false;
    this.beforePause = this.stage; this.stage = 'paused'; this.revision++;
    return true;
  }
  resume(): boolean {
    if (this.stage !== 'paused') return false;
    this.stage = this.beforePause === 'result' ? 'result' : 'loading';
    if (this.stage === 'loading') this.attempt++;
    this.readyPlayers.clear(); this.cooldown = { host: 0, guest: 0 }; this.revision++;
    return true;
  }
}

export function readLocalSnapshot(value: unknown): LocalSnapshot {
  const invalid = (): never => { throw new Error('Ungültige Mehrspieler-Partie.'); };
  if (!record(value) || value.version !== 2 || !integer(value.revision, 0, 1000000) || typeof value.round !== 'string' || !/^[a-f0-9]{32}:(?:[0-9]|[12][0-9]|3[0-3]):\d{1,7}$/.test(value.round) || ![10, 33].includes(value.total as number) || !integer(value.index, 0, value.total as number) || Number(value.round.split(':')[1]) !== value.index || !['loading', 'countdown', 'searching', 'result', 'paused', 'finished'].includes(String(value.stage)) || !record(value.scores) || !integer(value.scores.host, 0, value.total as number) || !integer(value.scores.guest, 0, value.total as number) || (value.winner !== null && value.winner !== 'host' && value.winner !== 'guest')) invalid();
  const state = value as unknown as LocalSnapshot;
  if ((state.stage === 'finished') !== (state.index === state.total) || state.scores.host + state.scores.guest !== state.index + (state.winner === null ? 0 : 1) || (state.stage === 'result' && state.winner === null) || (state.winner !== null && !['result', 'paused'].includes(state.stage))) invalid();
  if (!['searching', 'result'].includes(state.stage)) { if (state.card !== null) invalid(); }
  else {
    const card = state.card;
    if (!record(card) || card.id !== `card-${String(state.index + 1).padStart(2, '0')}` || !Array.isArray(card.figures) || card.figures.length !== 7) invalid();
    const ids = new Set<FigureId>(); const slots = new Set<number>();
    card!.figures.forEach(figure => {
      if (!record(figure) || !isFigure(figure.figure) || ids.has(figure.figure) || !integer(figure.slot, 0, 8) || slots.has(figure.slot) || !integer(figure.rotation, -12, 12) || !integer(figure.scale, 90, 108)) invalid();
      ids.add(figure.figure); slots.add(figure.slot);
    });
  }
  return state;
}
export function missingFigure(state: LocalSnapshot): FigureId | null {
  return state.card ? FIGURES.find(figure => !state.card!.figures.some(placement => placement.figure === figure.id))!.id : null;
}
