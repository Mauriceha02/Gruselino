import { FIGURES, figureLabel, isFigure, type FigureId } from '../game/figures.js';
import { createGame, currentCard, nextCard, reveal, resolveAnswers, score, winners, type Difficulty, type CardCount, type GameState, type Answer } from '../game/game.js';
import { botReactions, type Reaction } from '../ai/reaction.js';
import { browserStorage, loadGame, saveGame, type StorageAccess } from '../storage/local-game.js';
export { getSavedSummary } from '../storage/local-game.js';

export interface GameOptions { onHome?: () => void; storage?: StorageAccess; assetBase?: URL; version?: string }
const escape = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const points = (count: number): string => `${count} ${count === 1 ? 'Punkt' : 'Punkte'}`;

export function mountGruselino(root: HTMLElement, options: GameOptions = {}): { dispose(): void } {
  const storage = options.storage ?? browserStorage();
  const loaded = loadGame(storage);
  const assetBase = options.assetBase ?? new URL('../../assets/', import.meta.url);
  if (assetBase.origin !== window.location.origin) throw new Error('Figuren müssen zur lokalen App gehören.');
  let state = loaded.state;
  let screen: 'setup' | 'countdown' | 'search' | 'result' | 'paused' | 'finished' = 'setup';
  let notice = loaded.error ?? '';
  let saveError = '';
  let countdown = 3;
  let generation = 0;
  let disposed = false;
  let cooldownUntil = 0;
  let revealedAt = 0;
  let reactions: Reaction[] = [];
  let imagesReady: Promise<void> | null = null;
  const timers = new Set<number>();
  const frames = new Set<number>();
  const events = new AbortController();
  root.classList.add('gruselino');

  function after(delay: number, callback: () => void): void {
    const token = generation;
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!disposed && token === generation) {
        if (document.hidden) pause(); else callback();
      }
    }, delay);
    timers.add(timer);
  }
  function cancel(): void {
    generation++;
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
    frames.forEach(frame => window.cancelAnimationFrame(frame));
    frames.clear();
    reactions = [];
  }
  function persist(): void { if (state) saveError = saveGame(storage, state) ?? ''; }
  function asset(id: FigureId): string { return escape(new URL(`${id}.svg`, assetBase).href); }
  function image(id: FigureId, className = ''): string { return `<img class="${className}" src="${asset(id)}" width="128" height="128" alt="${figureLabel(id)}" draggable="false">`; }
  function form(): string {
    const current = state?.players[1]?.difficulty ?? 'easy';
    return `<form class="g-start-form"><label class="g-length">Partielänge<select name="cardCount"><option value="10"${state?.deck.length === 10 ? ' selected' : ''}>Schnelle Partie · 10 Karten</option><option value="33"${state?.deck.length !== 10 ? ' selected' : ''}>Normale Partie · 33 Karten</option></select></label><label>Computergegner<select name="computers">${[1, 2, 3].map(count => `<option value="${count}"${count === (state ? state.players.length - 1 : 1) ? ' selected' : ''}>${count}</option>`).join('')}</select></label><label>Spielstärke<select name="difficulty"><option value="easy"${current === 'easy' ? ' selected' : ''}>Einfach</option><option value="strong"${current === 'strong' ? ' selected' : ''}>Stark</option></select></label><button class="g-primary" type="submit">${state ? 'Neue Partie starten' : 'Partie starten'}</button>${state ? '<p class="g-replace-note">Ersetzt deine bisherige Gruselino-Partie.</p>' : ''}</form>`;
  }

  function render(): void {
    if (disposed) return;
    root.style.setProperty('--g-players', String(state?.players.length ?? 2));
    const focus = root.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement.dataset.action ?? document.activeElement.dataset.figure : undefined;
    const menuOpen = root.querySelector<HTMLDetailsElement>('.g-menu')?.open ?? false;
    const card = state ? currentCard(state) : null;
    const award = screen === 'result' ? state!.awards[state!.awards.length - 1] : null;
    const winningPlayer = state?.players.find(player => player.id === award?.playerId);
    const locked = screen !== 'search' || !reactions.length || performance.now() < cooldownUntil;
    const menu = `<details class="g-menu"${menuOpen ? ' open' : ''}><summary>Spielmenü</summary><div class="g-menu-content"><h2>Neue Partie</h2>${form()}<p>Eine falsche Antwort sperrt deine Auswahl für 1,5 Sekunden.</p><p>Einfach: 4–8 Sekunden · Stark: 2–5 Sekunden.</p></div></details>`;
    const header = `<header class="g-header"><button type="button" class="g-home" data-action="home" aria-label="Zur Spieleauswahl">← Spiele</button><div class="g-title">Gruselino${options.version ? `<small>Version ${escape(options.version)}</small>` : ''}</div>${screen === 'setup' ? '' : menu}</header>`;
    if (screen === 'setup') {
      root.innerHTML = `${header}<section class="g-setup"><div class="g-setup-art" aria-hidden="true">${image('ghost')}${image('bat')}${image('pumpkin')}</div><h1>Welche Figur fehlt?</h1><p>Sieben Figuren auf der Karte, acht auf deiner Übersicht. Tippe die fehlende Figur an, bevor ein Computer sie findet.</p>${state ? `<button class="g-primary g-resume" data-action="resume" type="button">${state.status === 'finished' ? 'Ergebnis ansehen' : 'Partie fortsetzen'}</button><p class="g-saved">Karte ${Math.min(state.index + 1, state.deck.length)} von ${state.deck.length} · ${points(score(state, 'human'))}</p>` : ''}${form()}<p class="g-rule-note">Ein Punkt pro gewonnener Karte</p></section>${messages()}`;
      return;
    }
    let cardContent = '';
    if (screen === 'finished') {
      const names = winners(state!).map(player => player.name).join(' und ');
      const title = winners(state!).length > 1 ? 'Gleichstand!' : names === 'Du' ? 'Du gewinnst!' : `${names} gewinnt!`;
      cardContent = `<div class="g-finish"><span class="g-finish-mark" aria-hidden="true">✦</span><h1>${escape(title)}</h1><p>Alle ${state!.deck.length} Karten sind vergeben.</p><ol>${[...state!.players].sort((a, b) => score(state!, b.id) - score(state!, a.id)).map(player => `<li><span>${escape(player.name)}</span><strong>${points(score(state!, player.id))}</strong></li>`).join('')}</ol><button class="g-primary" type="button" data-action="setup">Neue Partie</button></div>`;
    } else if (screen === 'paused') {
      cardContent = `<div class="g-card-cover"><span aria-hidden="true">Ⅱ</span><h1>Pause</h1><p>Deine Karte bleibt erhalten.</p><button class="g-primary" type="button" data-action="resume">Weiter</button></div>`;
    } else if (screen === 'countdown') {
      cardContent = `<div class="g-card-cover"><p>Bereit?</p><strong class="g-countdown" aria-live="off">${countdown}</strong></div>`;
    } else if (card) {
      cardContent = card.figures.map(placement => `<div class="g-card-figure g-slot-${placement.slot}" data-position="${placement.figure}">${image(placement.figure)}</div>`).join('');
    }
    const feedback = screen === 'result' ? `${winningPlayer?.name === 'Du' ? 'Du bekommst' : `${winningPlayer?.name} bekommt`} die Karte. ${figureLabel(card!.missing)} fehlt.` : screen === 'paused' ? 'Die Partie ist pausiert.' : screen === 'finished' ? 'Partie beendet.' : screen === 'countdown' ? 'Gleich geht’s los.' : notice || 'Welche Figur fehlt?';
    const scores = `<div class="g-scores" aria-label="Punktstände">${state!.players.map(player => `<div class="g-score${player.id === 'human' ? ' g-you' : ''}${player.id === winningPlayer?.id ? ' g-scored' : ''}"><span>${escape(player.name)}</span><strong>${score(state!, player.id)}</strong></div>`).join('')}</div>`;
    const answers = `<section class="g-answers" aria-label="Deine Figurenübersicht"><div class="g-answer-heading"><h2>Deine Übersicht</h2><span>${screen === 'search' && locked ? 'Kurz gesperrt' : 'Fehlende Figur antippen'}</span></div><div class="g-answer-grid">${FIGURES.map(figure => `<button type="button" class="g-figure-button${screen === 'result' && figure.id === card!.missing ? ' g-correct' : ''}" data-figure="${figure.id}" aria-label="${figure.label} auswählen"${locked ? ' disabled' : ''}>${image(figure.id)}<span>${figure.label}</span></button>`).join('')}</div></section>`;
    root.innerHTML = `${header}<div class="g-shell">${scores}<section class="g-arena" aria-label="Suchkarte"><div class="g-round"><span>Karte ${Math.min(state!.index + 1, state!.deck.length)} / ${state!.deck.length}</span>${screen === 'search' || screen === 'countdown' || screen === 'result' ? '<button type="button" data-action="pause">Pause</button>' : ''}</div><div class="g-card${screen === 'result' ? ' g-won' : ''}" data-card-id="${card?.id ?? ''}">${cardContent}</div><p class="g-feedback" role="status">${escape(feedback)}</p></section>${screen === 'finished' ? '' : answers}</div>${messages()}`;
    if (card && (screen === 'search' || screen === 'result')) card.figures.forEach(placement => {
      root.querySelector<HTMLElement>(`[data-position="${placement.figure}"]`)?.style.setProperty('--g-turn', `${placement.rotation}deg`);
      root.querySelector<HTMLElement>(`[data-position="${placement.figure}"]`)?.style.setProperty('--g-scale', String(placement.scale / 100));
    });
    if (focus) root.querySelector<HTMLElement>(`[data-action="${focus}"], [data-figure="${focus}"]`)?.focus({ preventScroll: true });
  }
  function messages(): string {
    return `<p class="g-storage${saveError ? ' g-error' : ''}" role="status">${escape(saveError || (screen === 'setup' ? notice : '') || 'Spielstand auf diesem Gerät.')}</p>`;
  }

  function preload(): Promise<void> {
    if (!imagesReady) imagesReady = Promise.all(FIGURES.map(figure => {
      const img = new Image(); img.src = new URL(`${figure.id}.svg`, assetBase).href;
      return img.decode();
    })).then(() => undefined).catch(error => { imagesReady = null; throw error; });
    return imagesReady;
  }
  function pause(): void {
    if (screen === 'setup' || screen === 'finished' || screen === 'paused') return;
    cancel(); screen = 'paused'; notice = ''; render();
  }
  async function prepare(delay = 1800): Promise<void> {
    if (!state || disposed) return;
    cancel(); cooldownUntil = 0; notice = '';
    screen = 'countdown'; countdown = Math.ceil(delay / 600); render();
    const token = generation;
    try { await preload(); } catch {
      if (!disposed && token === generation) { screen = 'paused'; notice = 'Die Figuren konnten nicht geladen werden. Bitte öffne die App erneut.'; saveError = notice; render(); }
      return;
    }
    if (disposed || token !== generation || document.hidden) return;
    for (let left = countdown - 1; left > 0; left--) after(delay - left * 600, () => { countdown = left; render(); });
    after(delay, () => {
      // Paint the exposed card before the search clock and computer reactions start.
      state = reveal(state!); screen = 'search'; persist(); render();
      const firstFrame = window.requestAnimationFrame(() => {
        frames.delete(firstFrame);
        const secondFrame = window.requestAnimationFrame(() => {
          frames.delete(secondFrame);
          if (disposed || token !== generation || document.hidden || screen !== 'search') return;
          revealedAt = performance.now(); reactions = botReactions(state!); render(); scheduleComputer();
        });
        frames.add(secondFrame);
      });
      frames.add(firstFrame);
    });
  }
  function elapsed(): number { return Math.max(0, Math.round(performance.now() - revealedAt)); }
  function dueAnswers(timeMs: number): Answer[] {
    const card = currentCard(state!);
    return card ? reactions.filter(reaction => reaction.timeMs <= timeMs).map(reaction => ({ ...reaction, figure: card.missing })) : [];
  }
  function scheduleComputer(): void {
    if (!reactions.length || screen !== 'search') return;
    const next = Math.min(...reactions.map(reaction => reaction.timeMs));
    after(Math.max(1, next - elapsed()), () => {
      const time = elapsed();
      const answers = dueAnswers(time);
      if (answers.length) settle(answers); else scheduleComputer();
    });
  }
  function settle(answers: Answer[]): void {
    if (!state || screen !== 'search') return;
    const next = resolveAnswers(state, currentCard(state)!.id, answers);
    if (next === state) return;
    cancel(); state = next; screen = 'result'; notice = ''; persist(); render();
    after(1500, advance);
  }
  function advance(): void {
    if (!state) return;
    state = nextCard(state); persist();
    if (state.status === 'finished') { cancel(); screen = 'finished'; render(); }
    else void prepare(600);
  }
  function resume(): void {
    if (!state) return;
    if (state.status === 'finished') { cancel(); screen = 'finished'; render(); }
    else if (state.status === 'result') { cancel(); screen = 'result'; render(); after(1500, advance); }
    else void prepare();
  }

  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null;
    if (!button || !root.contains(button)) return;
    const action = button.dataset.action;
    if (action === 'home') { pause(); if (options.onHome) options.onHome(); else { cancel(); screen = 'setup'; render(); } return; }
    if (action === 'pause') { pause(); return; }
    if (action === 'resume') { resume(); return; }
    if (action === 'setup') { cancel(); screen = 'setup'; render(); return; }
    if (!isFigure(button.dataset.figure) || screen !== 'search' || !reactions.length || performance.now() < cooldownUntil || !state) return;
    const timeMs = elapsed();
    const candidates = dueAnswers(timeMs);
    const answer: Answer = { playerId: 'human', figure: button.dataset.figure, timeMs };
    if (answer.figure === currentCard(state)!.missing) { settle([...candidates, answer]); return; }
    if (candidates.length) { settle(candidates); return; }
    cooldownUntil = performance.now() + 1500;
    notice = 'Diese Figur ist auf der Karte. Such weiter.'; render();
    after(1500, () => { cooldownUntil = 0; notice = ''; render(); });
  }, { signal: events.signal });

  root.addEventListener('submit', event => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('.g-start-form')) return;
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      const next = createGame(Number(data.get('computers')), String(data.get('difficulty')) as Difficulty, Math.random, Number(data.get('cardCount')) as CardCount);
      cancel(); state = next; persist(); void prepare();
    } catch { notice = 'Die Partie konnte nicht gestartet werden.'; render(); }
  }, { signal: events.signal });
  root.addEventListener('toggle', event => {
    if (event.target instanceof HTMLDetailsElement && root.contains(event.target) && event.target.matches('.g-menu') && event.target.open && ['search', 'countdown', 'result'].includes(screen)) pause();
  }, { capture: true, signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal: events.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { pause(); root.querySelector<HTMLDetailsElement>('.g-menu')?.removeAttribute('open'); } }, { signal: events.signal });
  window.addEventListener('pagehide', pause, { signal: events.signal });
  document.addEventListener('click', event => {
    const menu = root.querySelector<HTMLDetailsElement>('.g-menu');
    if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  }, { signal: events.signal });
  render();
  return { dispose(): void { if (disposed) return; cancel(); disposed = true; events.abort(); root.replaceChildren(); root.classList.remove('gruselino'); root.style.removeProperty('--g-players'); } };
}
