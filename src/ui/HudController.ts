import type { ToolKind, UnitKind } from '../data/definitions';

export interface HudCallbacks {
  setTool(tool: ToolKind): void;
  recruit(kind: UnitKind): void;
  setSpeed(speed: 0 | 1 | 2): void;
  fitCamera(): void;
  pulse(): void;
  toggleAudio(): boolean;
  begin(): void;
  decide(choice: 'release' | 'recruit' | 'sacrifice'): void;
  restart(): void;
}

export interface HudState {
  hp: number;
  maxHp: number;
  ore: number;
  biomass: number;
  metal: number;
  rations: number;
  essence: number;
  armour: number;
  beds: number;
  bedsUsed: number;
  wave: string;
  speed: number;
  tool: ToolKind;
  phase: number;
  objectiveTitle: string;
  objectiveBody: string;
  elapsed: number;
  trust: number;
  fear: number;
  pulseReady: boolean;
  canRecruit: Record<'guard' | 'archer' | 'hexbinder', boolean>;
  context?: { title: string; body: string };
}

const resource = (key: string, icon: string, label: string) => `
  <div class="resource">
    <span class="resource-icon">${icon}</span>
    <span><strong data-value="${key}">0</strong><small>${label}</small></span>
  </div>`;

export class HudController {
  private root: HTMLElement;
  private callbacks: HudCallbacks;
  private toasts: HTMLElement;
  private modal: HTMLElement;
  private selectionHint: HTMLElement;
  private started = false;

  constructor(callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    const root = document.querySelector<HTMLElement>('#hud');
    if (!root) throw new Error('HUD root missing');
    this.root = root;
    root.innerHTML = `
      <div class="topbar">
        <div class="heart-chip">
          <span class="heart-icon">♥</span>
          <div class="heart-copy">
            <div class="eyebrow">Covenant-Herz</div>
            <div class="heart-value"><span data-value="hp">300</span><small>/ 300</small></div>
          </div>
          <div class="heart-bar"><i></i></div>
        </div>
        <div class="resource-strip">
          ${resource('ore', '◆', 'Roherz')}
          ${resource('biomass', '♣', 'Biomasse')}
          ${resource('metal', '▰', 'Metall')}
          ${resource('rations', '●', 'Rationen')}
          ${resource('essence', '✦', 'Essenz')}
          ${resource('armour', '⬟', 'Rüstung')}
          <div class="resource"><span class="resource-icon">⌂</span><span><strong data-value="beds">0/0</strong><small>Betten</small></span></div>
        </div>
        <div class="time-controls">
          <button class="icon-btn" data-speed="0" title="Pause">Ⅱ</button>
          <button class="icon-btn active" data-speed="1" title="Normale Geschwindigkeit">▶</button>
          <button class="icon-btn" data-speed="2" title="Doppelte Geschwindigkeit">▶▶</button>
          <button class="icon-btn pulse-btn" data-action="pulse" title="Covenant-Puls · 5 Essenz">◉</button>
          <button class="icon-btn" data-action="fit" title="Karte einpassen">⌖</button>
          <button class="icon-btn" data-action="audio" title="Audio umschalten">♪</button>
          <button class="icon-btn" data-action="fullscreen" title="Vollbild umschalten">⛶</button>
        </div>
      </div>
      <div class="left-column">
        <section class="panel objective-panel">
          <div class="phase" data-value="phase">Phase 1 · 00:00</div>
          <h2 data-value="objective-title">Etwas Essbares</h2>
          <p data-value="objective-body">Öffne einen Weg zur Pilzgrotte.</p>
          <div class="objective-progress">${[1, 2, 3, 4, 5].map((n) => `<i data-phase="${n}"></i>`).join('')}</div>
        </section>
        <section class="panel context-panel">
          <div class="context-title" data-value="context-title"></div>
          <p data-value="context-body"></p>
        </section>
      </div>
      <div class="toast-stack"></div>
      <div class="selection-hint"></div>
      <div class="bottom-area">
        <div class="tool-popovers">
          <section class="tool-popover" data-popover="build" hidden>
            <div class="popover-heading"><strong>Raum bauen</strong><span>Auf beanspruchtem Boden aufziehen</span></div>
            <div class="popover-grid">
              <button class="room-btn" data-tool="room-storage"><b>▦</b>Lager<small>0 Metall</small></button>
              <button class="room-btn" data-tool="room-bedroom"><b>⌂</b>Schlafen<small>ab 2 Metall</small></button>
              <button class="room-btn" data-tool="room-kitchen"><b>♨</b>Küche<small>4 Metall</small></button>
              <button class="room-btn" data-tool="room-smelter"><b>♨</b>Schmelze<small>5 Metall</small></button>
              <button class="room-btn" data-tool="room-workshop"><b>⚒</b>Werkstatt<small>5 Metall</small></button>
              <button class="room-btn" data-tool="room-prison"><b>▥</b>Gefängnis<small>6 Metall</small></button>
            </div>
          </section>
          <section class="tool-popover" data-popover="command" hidden>
            <div class="popover-heading"><strong>Befehle</strong><span>Kampfgebiet und Verteidigung steuern</span></div>
            <div class="popover-grid compact">
              <button class="tool-btn" data-tool="banner-attack"><b>⚑</b>Angriff<small>Banner setzen</small></button>
              <button class="tool-btn" data-tool="banner-defend"><b>⚐</b>Halten<small>Banner setzen</small></button>
              <button class="tool-btn" data-tool="trap"><b>⌄</b>Falle<small>2 Rüstung</small></button>
            </div>
          </section>
          <section class="tool-popover" data-popover="recruit" hidden>
            <div class="popover-heading"><strong>Rekrutieren</strong><span>Benötigt Bett, Ration und Ausrüstung</span></div>
            <div class="popover-grid compact">
              <button class="recruit-btn" data-recruit="guard" title="Benötigt Küche, Werkstatt, 1 Ration und 1 Rüstung"><b>⬟</b>Guard<small>1R · 1⚙</small></button>
              <button class="recruit-btn" data-recruit="archer" title="Benötigt Küche, Werkstatt, 1 Ration und 1 Rüstung"><b>➶</b>Archer<small>1R · 1⚙</small></button>
              <button class="recruit-btn" data-recruit="hexbinder" title="Benötigt Küche, Essenzschrein, 1 Ration und 3 Essenz"><b>✦</b>Hexbinder<small>1R · 3E</small></button>
            </div>
          </section>
        </div>
        <nav class="toolbar" aria-label="Werkzeugleiste">
          <button class="tool-btn active" data-tool="pan"><b>✥</b>Ansicht<small>Verschieben</small></button>
          <button class="tool-btn" data-tool="dig"><b>⌁</b>Gang<small>Route ziehen</small></button>
          <button class="tool-btn" data-tool="chamber"><b>▧</b>Kammer<small>Fläche ziehen</small></button>
          <button class="tool-btn menu-btn" data-menu="build" aria-expanded="false"><b>▦</b>Bauen<small>6 Räume</small></button>
          <button class="tool-btn menu-btn" data-menu="command" aria-expanded="false"><b>⚑</b>Befehle<small>Kampf & Falle</small></button>
          <button class="tool-btn menu-btn" data-menu="recruit" aria-expanded="false"><b>⬟</b>Einheiten<small>Rekrutieren</small></button>
        </nav>
      </div>
      <div class="modal-shell">
        <section class="modal-card">
          <div class="brand-mark">◇</div>
          <div class="subtitle">Ein Bund unter der heiligen Stadt</div>
          <h1>Hollow<br />Covenant</h1>
          <p class="modal-copy">
            Unter einer Stadt voller Licht erwacht etwas, das seine Buchhaltung ernster nimmt als seine Moral.
            Grabe zu Rohstoffen, errichte sichtbare Produktionsketten, führe eine kleine Armee und entscheide
            über das Schicksal eines besiegten Inquisitors.
          </p>
          <button class="primary-btn" data-action="begin">Das Herz erwecken</button>
          <div class="controls-note">Maus: Ziehen &amp; Mausrad · Touch: Ziehen &amp; Pinch · WASD: Kamera · F: Karte · P: Pause</div>
        </section>
      </div>`;

    this.toasts = root.querySelector('.toast-stack') as HTMLElement;
    this.modal = root.querySelector('.modal-shell') as HTMLElement;
    this.selectionHint = root.querySelector('.selection-hint') as HTMLElement;
    this.bind();
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach((button) => {
      button.addEventListener('click', () => {
        this.closeToolMenus();
        this.callbacks.setTool(button.dataset.tool as ToolKind);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-recruit]').forEach((button) => {
      button.addEventListener('click', () => {
        this.closeToolMenus();
        this.callbacks.recruit(button.dataset.recruit as UnitKind);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-menu]').forEach((button) => {
      button.addEventListener('click', () => this.toggleToolMenu(button.dataset.menu ?? ''));
    });
    this.root.querySelectorAll<HTMLElement>('[data-speed]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.setSpeed(Number(button.dataset.speed) as 0 | 1 | 2));
    });
    this.root.querySelector('[data-action="fit"]')?.addEventListener('click', () => this.callbacks.fitCamera());
    this.root.querySelector('[data-action="pulse"]')?.addEventListener('click', () => this.callbacks.pulse());
    this.root.querySelector('[data-action="audio"]')?.addEventListener('click', (event) => {
      const muted = this.callbacks.toggleAudio();
      (event.currentTarget as HTMLElement).textContent = muted ? '×' : '♪';
    });
    this.root.querySelector('[data-action="fullscreen"]')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    this.root.querySelector('[data-action="begin"]')?.addEventListener('click', () => {
      this.modal.classList.add('hidden');
      this.started = true;
      if (window.matchMedia('(max-width: 900px)').matches) this.enterFullscreen();
      this.callbacks.begin();
    });
  }

  private toggleToolMenu(name: string): void {
    const target = this.root.querySelector<HTMLElement>(`[data-popover="${name}"]`);
    const opening = Boolean(target?.hidden);
    this.closeToolMenus();
    if (!target || !opening) return;
    target.hidden = false;
    const button = this.root.querySelector<HTMLElement>(`[data-menu="${name}"]`);
    button?.classList.add('menu-open');
    button?.setAttribute('aria-expanded', 'true');
  }

  private closeToolMenus(): void {
    this.root.querySelectorAll<HTMLElement>('[data-popover]').forEach((popover) => {
      popover.hidden = true;
    });
    this.root.querySelectorAll<HTMLElement>('[data-menu]').forEach((button) => {
      button.classList.remove('menu-open');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  private enterFullscreen(): void {
    const target = document.documentElement;
    if (document.fullscreenElement || !target.requestFullscreen) return;
    void target.requestFullscreen().catch(() => undefined);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else this.enterFullscreen();
  }

  update(state: HudState): void {
    const values: Record<string, string | number> = {
      hp: Math.max(0, Math.ceil(state.hp)),
      ore: state.ore,
      biomass: state.biomass,
      metal: state.metal,
      rations: state.rations,
      essence: state.essence,
      armour: state.armour,
      beds: `${state.bedsUsed}/${state.beds}`,
      phase: `Phase ${state.phase} · ${formatTime(state.elapsed)}`,
      'objective-title': state.objectiveTitle,
      'objective-body': state.objectiveBody,
    };
    for (const [name, value] of Object.entries(values)) {
      const node = this.root.querySelector(`[data-value="${name}"]`);
      if (node) node.textContent = String(value);
    }
    const heartBar = this.root.querySelector<HTMLElement>('.heart-bar i');
    if (heartBar) heartBar.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
    this.root.querySelectorAll('[data-phase]').forEach((node) => {
      node.classList.toggle('done', Number((node as HTMLElement).dataset.phase) <= state.phase);
    });
    this.root.querySelectorAll('[data-tool]').forEach((node) => {
      node.classList.toggle('active', (node as HTMLElement).dataset.tool === state.tool);
    });
    this.root.querySelector('[data-menu="build"]')?.classList.toggle('active', state.tool.startsWith('room-'));
    this.root.querySelector('[data-menu="command"]')?.classList.toggle(
      'active',
      state.tool === 'banner-attack' || state.tool === 'banner-defend' || state.tool === 'trap',
    );
    this.root.querySelectorAll('[data-speed]').forEach((node) => {
      node.classList.toggle('active', Number((node as HTMLElement).dataset.speed) === state.speed);
    });
    for (const kind of ['guard', 'archer', 'hexbinder'] as const) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-recruit="${kind}"]`);
      if (button) button.disabled = !state.canRecruit[kind];
    }
    const pulse = this.root.querySelector<HTMLButtonElement>('[data-action="pulse"]');
    if (pulse) pulse.disabled = !state.pulseReady;
    const context = this.root.querySelector('.context-panel');
    context?.classList.toggle('visible', Boolean(state.context));
    if (state.context) {
      const title = this.root.querySelector('[data-value="context-title"]');
      const body = this.root.querySelector('[data-value="context-body"]');
      if (title) title.textContent = state.context.title;
      if (body) body.textContent = state.context.body;
    }
  }

  setHint(text?: string): void {
    this.selectionHint.textContent = text ?? '';
    this.selectionHint.classList.toggle('visible', Boolean(text));
  }

  toast(title: string, body: string, danger = false, duration = 5200): void {
    const toast = document.createElement('div');
    toast.className = `toast${danger ? ' danger' : ''}`;
    toast.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
    this.toasts.prepend(toast);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild?.remove();
    window.setTimeout(() => toast.remove(), duration);
  }

  showPrisoner(): void {
    this.modal.classList.remove('hidden');
    this.modal.innerHTML = `
      <section class="modal-card">
        <div class="brand-mark">†</div>
        <div class="subtitle">Der Captain erwartet ein Urteil</div>
        <h2>Ein Gegner.<br />Drei Verwendungen.</h2>
        <p class="modal-copy">„Wenn ihr Gnade besitzt, zeigt sie. Wenn nicht, überrascht mich wenigstens.“</p>
        <div class="choice-grid">
          <button class="choice-btn" data-choice="release"><strong>Freilassen</strong><span>+15 Vertrauen<br />Die Finalwelle verliert einen Scout.</span></button>
          <button class="choice-btn" data-choice="recruit"><strong>Rekrutieren</strong><span>Kostet 2 Rationen und ein Bett.<br />+5 Vertrauen · Heldeneinheit.</span></button>
          <button class="choice-btn" data-choice="sacrifice"><strong>Opfern</strong><span>+6 Essenz · +20 Furcht<br />Die Finalwelle erhält einen Elitegegner.</span></button>
        </div>
      </section>`;
    this.modal.querySelectorAll<HTMLElement>('[data-choice]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.decide(button.dataset.choice as 'release' | 'recruit' | 'sacrifice'));
    });
  }

  hideModal(): void {
    this.modal.classList.add('hidden');
  }

  showEnd(victory: boolean, stats: { time: number; recruited: number; hauled: number; trust: number; fear: number; choice: string }): void {
    this.modal.classList.remove('hidden');
    const path = stats.trust >= stats.fear ? 'Zuflucht' : 'Herrschaft';
    this.modal.innerHTML = `
      <section class="modal-card">
        <div class="brand-mark">${victory ? '◇' : '†'}</div>
        <div class="subtitle">${victory ? `Der Pfad der ${path}` : 'Der Bund ist gebrochen'}</div>
        <h2>${victory ? 'Die Tiefe hält.' : 'Das Herz schweigt.'}</h2>
        <p class="modal-copy">${victory
          ? 'Die Inquisition zieht sich zurück. Für den Moment. Unter der Stadt beginnt eine Gesellschaft, sich an deine Entscheidungen zu erinnern.'
          : 'Die Oberfläche hat gewonnen. Sie wird dies zweifellos in einem unangemessen langen Bericht festhalten.'}</p>
        <div class="stat-grid">
          <div class="end-stat"><strong>${formatTime(stats.time)}</strong><span>Spielzeit</span></div>
          <div class="end-stat"><strong>${stats.recruited}</strong><span>Rekrutiert</span></div>
          <div class="end-stat"><strong>${stats.hauled}</strong><span>Transportiert</span></div>
          <div class="end-stat"><strong>${stats.choice || '—'}</strong><span>Urteil</span></div>
        </div>
        <button class="primary-btn" data-action="restart">Erneut erwachen</button>
      </section>`;
    this.modal.querySelector('[data-action="restart"]')?.addEventListener('click', () => this.callbacks.restart());
  }

  get isStarted(): boolean {
    return this.started;
  }
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
