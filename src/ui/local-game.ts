import { FIGURES, figureLabel, isFigure, type FigureId } from '../game/figures.js';
import { LocalMatch, readLocalSnapshot, missingFigure, type LocalSnapshot, type Role } from '../game/local-match.js';
import type { CardCount } from '../game/game.js';

interface Peer {
  state: string; role: Role | null;
  createInvitation(game: string, internet: boolean): Promise<string>;
  joinInvitation(raw: string): Promise<string>; acceptAnswer(raw: string): Promise<void>;
  send(data: unknown): void; close(): void;
}
interface Transport { LocalPeer: new (options: { onState(state: string, message: string): void; onMessage(message: unknown): void }) => Peer }
interface Signals { readSignal(raw: string): { game: string; type: string } }
export interface LocalGameOptions { onBack(): void; assetBase?: URL; invite?: string; signal?: AbortSignal }
const escape = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const newId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export async function mountLocalGruselino(root: HTMLElement, options: LocalGameOptions): Promise<{ dispose(): void; invitation(code: string): void }> {
  const [transport, signals] = await Promise.all([
    import(new URL('../../network/peer.js', import.meta.url).href) as Promise<Transport>,
    import(new URL('../../network/signals.js', import.meta.url).href) as Promise<Signals>,
  ]);
  if (options.signal?.aborted) throw new Error('Mehrspielermodus abgebrochen.');
  const assetBase = options.assetBase ?? new URL('../../assets/', import.meta.url);
  if (assetBase.origin !== location.origin) throw new Error('Figuren müssen zur lokalen App gehören.');
  let disposed = false;
  let role: Role | null = null;
  let total: CardCount = 10;
  let internet = false;
  let incoming = options.invite ?? '';
  let reply = '';
  let outgoing = '';
  let busy = false;
  let status = 'Einladen oder beitreten';
  let notice = '';
  let snapshot: LocalSnapshot | null = null;
  let match: LocalMatch | null = null;
  let countdown = 3;
  let lockUntil = 0;
  let generation = 0;
  const timers = new Set<number>();
  const events = new AbortController();
  let imagesReady: Promise<void> | null = null;
  root.classList.add('gruselino', 'g-local');

  function cancel(): void { generation++; timers.forEach(timer => clearTimeout(timer)); timers.clear(); }
  function after(delay: number, callback: () => void): void {
    const token = generation;
    const timer = window.setTimeout(() => { timers.delete(timer); if (!disposed && token === generation) callback(); }, delay);
    timers.add(timer);
  }
  function image(id: FigureId): string { return `<img src="${escape(new URL(id + '.svg', assetBase).href)}" width="128" height="128" alt="${figureLabel(id)}" draggable="false">`; }
  function preload(): Promise<void> {
    if (!imagesReady) imagesReady = Promise.all(FIGURES.map(figure => { const img = new Image(); img.src = new URL(figure.id + '.svg', assetBase).href; return img.decode(); })).then(() => undefined).catch(error => { imagesReady = null; throw error; });
    return imagesReady;
  }
  function send(message: unknown): void { if (peer.state === 'connected') peer.send(message); }
  function publish(): void { if (!match) return; const value = match.snapshot(); send({ type: 'gruselino.snapshot', data: value }); apply(value); }
  function pause(): void {
    if (!snapshot || snapshot.stage === 'finished' || snapshot.stage === 'paused') return;
    if (role === 'host') { if (match?.pause()) publish(); }
    else send({ type: 'gruselino.pause', round: snapshot.round });
  }
  function ready(round: string): void {
    if (role === 'host') { if (match?.ready('host', round)) publish(); }
    else send({ type: 'gruselino.ready', round });
  }
  function apply(value: unknown): void {
    const next = readLocalSnapshot(value);
    const sameMatch = snapshot?.round.split(':')[0] === next.round.split(':')[0];
    if (sameMatch && snapshot && next.revision <= snapshot.revision) return;
    const freshRound = snapshot?.round !== next.round;
    cancel(); snapshot = next;
    if (freshRound || next.stage !== 'searching') { notice = ''; lockUntil = 0; }
    countdown = next.index === 0 ? 3 : 1;
    render();
    const token = generation;
    if (next.stage === 'loading') void preload().then(() => {
      if (disposed || token !== generation) return;
      if (document.hidden) { pause(); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!disposed && token === generation && !document.hidden) ready(next.round); }));
    }).catch(() => { if (!disposed && token === generation) { notice = 'Die Figuren konnten nicht geladen werden. Bitte öffne die App erneut.'; pause(); render(); } });
    if (next.stage === 'countdown') {
      for (let left = countdown - 1; left > 0; left--) after((countdown - left) * 600, () => { countdown = left; render(); });
      if (role === 'host') after(countdown * 600, () => { if (document.hidden) pause(); else if (match?.reveal(next.round)) publish(); });
    }
    if (next.stage === 'result' && role === 'host') after(1500, () => { if (document.hidden) pause(); else if (match?.advance(next.round)) publish(); });
  }
  function locked(): void {
    lockUntil = performance.now() + 1500; notice = 'Diese Figur ist auf der Karte. Such weiter.'; render();
    after(1500, () => { lockUntil = 0; notice = ''; render(); });
  }
  function answer(player: Role, value: unknown): void {
    const result = match?.answer(player, value, performance.now());
    if (result === 'won') publish();
    else if (result === 'wrong' || result === 'blocked') {
      if (player === 'host') locked();
      else send({ type: 'gruselino.lock', round: snapshot!.round });
    }
  }
  const peer = new transport.LocalPeer({
    onState: (state, message) => {
      if (disposed) return;
      const labels: Record<string, string> = { preparing: 'Verbindung vorbereiten …', waiting: 'Warte auf deinen Mitspieler', connecting: 'Geräte verbinden …', connected: 'Verbunden', interrupted: 'Verbindung unterbrochen', failed: 'Verbindung beendet', closed: 'Verbindung beendet' };
      status = message || labels[state] || 'Einladen oder beitreten';
      if (state === 'connected' && role === 'host') {
        if (!match) match = new LocalMatch(newId(), total);
        publish();
      } else if (snapshot && state !== 'connected') {
        cancel(); match?.pause(); render();
      } else render();
    },
    onMessage: value => {
      if (!record(value) || typeof value.type !== 'string') throw new Error('Ungültige Spiele-Nachricht.');
      if (role === 'guest') {
        if (value.type === 'gruselino.snapshot') apply(value.data);
        else if (value.type === 'gruselino.lock' && snapshot && value.round === snapshot.round && snapshot.stage === 'searching') locked();
        else throw new Error('Ungültige Nachricht des Gastgebers.');
      } else {
        if (!snapshot || value.round !== snapshot.round) return;
        if (value.type === 'gruselino.ready') { if (match?.ready('guest', snapshot.round)) publish(); }
        else if (value.type === 'gruselino.answer') answer('guest', value);
        else if (value.type === 'gruselino.pause') pause();
        else if (value.type === 'gruselino.resume') { if (!document.hidden && match?.resume()) publish(); }
        else throw new Error('Ungültige Nachricht des Mitspielers.');
      }
    },
  });
  function render(): void {
    if (disposed) return;
    root.classList.toggle('g-lobby', snapshot === null);
    root.style.setProperty('--g-players', '2');
    const header = `<header class="g-header"><button type="button" class="g-home" data-local="back">← Zurück</button><div class="g-title">Gruselino<small>Mitspieler · ${escape(status)}</small></div>${snapshot && peer.state === 'connected' && !['paused', 'finished'].includes(snapshot.stage) ? '<button class="g-net-pause" type="button" data-local="pause">Pause</button>' : ''}</header>`;
    if (!snapshot) {
      root.innerHTML = `${header}<section class="g-setup g-net-setup"><h1>Zusammen spielen</h1><p>Öffnet Gruselino auf beiden Geräten im selben WLAN. Einer lädt ein, der andere tritt bei.</p>${outgoing ? `<h2>${role === 'host' ? 'Einladung teilen' : 'Antwort zurückgeben'}</h2><p>${role === 'host' ? 'Dein Mitspieler tritt mit deiner Einladung bei und gibt dir seinen Antwortcode zurück.' : 'Gib diesen Code an den Gastgeber zurück. Er fügt ihn in seinem ursprünglichen Fenster ein. Lass dieses Fenster geöffnet.'}</p><label>Dein ${role === 'host' ? 'Einladungscode' : 'Antwortcode'}<textarea readonly rows="3" data-output>${escape(outgoing)}</textarea></label><div class="g-net-share"><button class="g-primary" type="button" data-local="share">Teilen …</button><button class="g-primary" type="button" data-local="copy">Code kopieren</button></div>${role === 'host' ? `<form data-form="answer"><label>Antwortcode<textarea name="answer" rows="3" maxlength="34816" required spellcheck="false" autocapitalize="off">${escape(reply)}</textarea></label><button class="g-primary" type="submit"${busy ? ' disabled' : ''}>Verbinden</button></form>` : ''}` : `<form data-form="create"><label>Partielänge<select name="total"><option value="10"${total === 10 ? ' selected' : ''}>Schnelle Partie · 10 Karten</option><option value="33"${total === 33 ? ' selected' : ''}>Normale Partie · 33 Karten</option></select></label><label class="g-net-check"><input type="checkbox" name="internet"${internet ? ' checked' : ''}>Internet-Hilfe für die Verbindung nutzen</label><button class="g-primary" type="submit"${busy ? ' disabled' : ''}>Einladung erstellen</button></form><form data-form="join"><h2>Einladung annehmen</h2><label>Einladungscode oder Link<textarea name="invite" rows="3" maxlength="34816" required spellcheck="false" autocapitalize="off">${escape(incoming)}</textarea></label><button class="g-primary" type="submit"${busy ? ' disabled' : ''}>Beitreten</button></form>`}<p class="g-rule-note">Einladung und Antwort gelten 15 Minuten. Die Internet-Hilfe nutzt Googles STUN-Dienst. Spielnachrichten werden direkt übertragen.</p><p class="g-rule-note">Der Gastgeber vergibt die Karte an die erste richtige Antwort, die bei ihm ankommt. Eine falsche Antwort sperrt die Auswahl 1,5 Sekunden.</p><p class="g-net-notice" role="status">${escape(notice)}</p><button class="g-net-link" type="button" data-local="reset">Neu verbinden</button></section>`;
      return;
    }
    const connected = peer.state === 'connected';
    const card = snapshot.card;
    const you = role ?? 'guest'; const other: Role = you === 'host' ? 'guest' : 'host';
    const enabled = connected && snapshot.stage === 'searching' && performance.now() >= lockUntil;
    let content: string;
    if (!connected) content = `<div class="g-card-cover"><h1>Verbindung unterbrochen</h1><p>${escape(status)}</p><button type="button" class="g-primary" data-local="reset">Neu verbinden</button></div>`;
    else if (snapshot.stage === 'finished') {
      const title = snapshot.scores.host === snapshot.scores.guest ? 'Gleichstand!' : snapshot.scores[you] > snapshot.scores[other] ? 'Du gewinnst!' : 'Dein Mitspieler gewinnt!';
      content = `<div class="g-finish"><span class="g-finish-mark" aria-hidden="true">✦</span><h1>${title}</h1><p>Alle ${snapshot.total} Karten sind vergeben.</p><ol><li><span>Du</span><strong>${snapshot.scores[you]} Punkte</strong></li><li><span>Mitspieler</span><strong>${snapshot.scores[other]} Punkte</strong></li></ol>${you === 'host' ? '<button type="button" class="g-primary" data-local="restart">Neue Partie</button>' : '<p>Der Gastgeber kann eine neue Partie starten.</p>'}</div>`;
    } else if (snapshot.stage === 'paused') content = '<div class="g-card-cover"><span aria-hidden="true">Ⅱ</span><h1>Pause</h1><p>Die Karte und eure Punkte bleiben erhalten.</p><button type="button" class="g-primary" data-local="resume">Weiter</button></div>';
    else if (snapshot.stage === 'loading') content = '<div class="g-card-cover"><h1>Gleich geht’s los</h1><p>Warte, bis beide Geräte bereit sind.</p></div>';
    else if (snapshot.stage === 'countdown') content = `<div class="g-card-cover"><p>Bereit?</p><strong class="g-countdown">${countdown}</strong></div>`;
    else content = card!.figures.map(placement => `<div class="g-card-figure g-slot-${placement.slot}" data-position="${placement.figure}">${image(placement.figure)}</div>`).join('');
    const solution = missingFigure(snapshot);
    const feedback = !connected ? 'Die Partie ist unterbrochen.' : snapshot.stage === 'result' ? `${snapshot.winner === you ? 'Du bekommst' : 'Dein Mitspieler bekommt'} die Karte. ${figureLabel(solution!)} fehlt.` : notice || (snapshot.stage === 'searching' ? 'Welche Figur fehlt?' : snapshot.stage === 'paused' ? 'Die Partie ist pausiert.' : snapshot.stage === 'finished' ? 'Partie beendet.' : 'Gemeinsam aufdecken.');
    root.innerHTML = `${header}<div class="g-shell"><div class="g-scores" aria-label="Punktstände"><div class="g-score g-you"><span>Du</span><strong>${snapshot.scores[you]}</strong></div><div class="g-score"><span>Mitspieler</span><strong>${snapshot.scores[other]}</strong></div></div><section class="g-arena"><div class="g-round"><span>Karte ${Math.min(snapshot.index + 1, snapshot.total)} / ${snapshot.total}</span><span>2 Mitspieler</span></div><div class="g-card${snapshot.stage === 'result' ? ' g-won' : ''}" data-round="${snapshot.round}">${content}</div><p class="g-feedback" role="status">${escape(feedback)}</p></section>${snapshot.stage === 'finished' ? '' : `<section class="g-answers"><div class="g-answer-heading"><h2>Deine Übersicht</h2><span>Fehlende Figur antippen</span></div><div class="g-answer-grid">${FIGURES.map(figure => `<button class="g-figure-button${snapshot!.stage === 'result' && figure.id === solution ? ' g-correct' : ''}" type="button" data-answer="${figure.id}" aria-label="${figure.label} auswählen"${enabled ? '' : ' disabled'}>${image(figure.id)}<span>${figure.label}</span></button>`).join('')}</div></section>`}</div><p class="g-storage">Gemeinsame Partie · beide Geräte geöffnet lassen</p>`;
    if (card && ['searching', 'result'].includes(snapshot.stage)) card.figures.forEach(placement => {
      const figure = root.querySelector<HTMLElement>(`[data-position="${placement.figure}"]`);
      figure?.style.setProperty('--g-turn', `${placement.rotation}deg`); figure?.style.setProperty('--g-scale', String(placement.scale / 100));
    });
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true; notice = ''; render();
    try { await action(); } catch (error) { notice = error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.'; }
    finally { busy = false; render(); }
  }
  function reset(): void { cancel(); match = null; snapshot = null; role = null; outgoing = ''; incoming = ''; reply = ''; notice = ''; lockUntil = 0; peer.close(); render(); }
  root.addEventListener('input', event => {
    const input = event.target;
    if (input instanceof HTMLTextAreaElement && input.name === 'invite') incoming = input.value;
    if (input instanceof HTMLTextAreaElement && input.name === 'answer') reply = input.value;
  }, { signal: events.signal });
  root.addEventListener('submit', event => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault(); const data = new FormData(event.target); const form = event.target.dataset.form;
    void run(async () => {
      if (form === 'create') { total = Number(data.get('total')) as CardCount; if (total !== 10 && total !== 33) throw new Error('Bitte wähle 10 oder 33 Karten.'); internet = data.has('internet'); role = 'host'; outgoing = await peer.createInvitation('gruselino', internet); }
      else if (form === 'join') { incoming = String(data.get('invite')); const invitation = signals.readSignal(incoming); if (invitation.game !== 'gruselino' || invitation.type !== 'offer') throw new Error('Du brauchst eine Gruselino-Einladung.'); role = 'guest'; outgoing = await peer.joinInvitation(incoming); }
      else if (form === 'answer') { reply = String(data.get('answer')); await peer.acceptAnswer(reply); }
    });
  }, { signal: events.signal });
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.local;
    if (action === 'back') { options.onBack(); return; }
    if (action === 'reset') { reset(); return; }
    if (action === 'pause') { pause(); return; }
    if (action === 'resume') { if (role === 'host') { if (match?.resume()) publish(); } else send({ type: 'gruselino.resume', round: snapshot!.round }); return; }
    if (action === 'restart' && role === 'host' && peer.state === 'connected') { match = new LocalMatch(newId(), total); publish(); return; }
    if (action === 'copy' || action === 'share') {
      void (async () => {
        try {
          if (action === 'share' && navigator.share) {
            const url = new URL('./', document.baseURI); url.hash = `gruselino?${new URLSearchParams({ invite: outgoing })}`;
            await navigator.share(role === 'host' ? { title: 'Gruselino zusammen spielen', url: url.href } : { title: 'Gruselino-Antwortcode', text: outgoing });
          } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(outgoing); notice = 'Code kopiert.'; render(); }
          else { const field = root.querySelector<HTMLTextAreaElement>('[data-output]'); field?.focus(); field?.select(); notice = 'Halte den markierten Code gedrückt und wähle „Kopieren“.'; }
        } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) { notice = 'Teilen oder Kopieren hat nicht geklappt. Du kannst den Code markieren und kopieren.'; render(); } }
      })();
      return;
    }
    if (isFigure(button.dataset.answer) && snapshot?.stage === 'searching' && peer.state === 'connected' && performance.now() >= lockUntil) {
      const value = { type: 'gruselino.answer', round: snapshot.round, figure: button.dataset.answer };
      if (role === 'host') answer('host', value);
      else { send(value); if (button.dataset.answer !== missingFigure(snapshot)) locked(); }
    }
  }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal: events.signal });
  window.addEventListener('pagehide', pause, { signal: events.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') pause(); }, { signal: events.signal });
  render();
  return {
    invitation(code: string): void { if (peer.state === 'connected' || snapshot) { notice = 'Beende zuerst die aktuelle Partie.'; render(); return; } incoming = code; render(); },
    dispose(): void { disposed = true; cancel(); events.abort(); peer.close(); root.classList.remove('g-local', 'g-lobby', 'gruselino'); root.style.removeProperty('--g-players'); root.replaceChildren(); },
  };
}
