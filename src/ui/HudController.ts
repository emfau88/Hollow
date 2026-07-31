import type { ToolKind, UnitKind } from '../data/definitions';
import type { RoutineWorkerTask, WorkPriorities } from '../core/WorkerPriorities';

export type HudMenu = 'worker' | 'build' | 'work' | 'command' | 'recruit';

export interface HudWorldTarget {
  id: string;
  label: string;
  status: string;
}

export interface HudCallbacks {
  setTool(tool: ToolKind): void;
  recruit(kind: UnitKind): void;
  summonWorker(): void;
  setSpeed(speed: 0 | 1 | 2): void;
  cycleWorkPriority(task: RoutineWorkerTask): void;
  fitCamera(): void;
  pulse(): void;
  toggleAudio(): boolean;
  focusTarget(id: string): void;
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
  workers: number;
  maxWorkers: number;
  hungryUnits: number;
  pulseReady: boolean;
  canSummonWorker: boolean;
  workerSummonReason?: string;
  canRecruit: Record<'guard' | 'archer' | 'hexbinder', boolean>;
  recruitReasons: Record<'guard' | 'archer' | 'hexbinder', string | undefined>;
  toolLocks: Partial<Record<ToolKind, string>>;
  menuLocks: Partial<Record<HudMenu, string>>;
  tutorialFocus?: 'dig' | 'worker';
  worldTargets: HudWorldTarget[];
  objectiveChecklist: Array<{ label: string; done: boolean }>;
  workerJobs: Record<RoutineWorkerTask, number>;
  workPriorities: WorkPriorities;
  context?: { title: string; body: string };
}

type HudIconName =
  | 'heart' | 'ore' | 'biomass' | 'metal' | 'rations' | 'essence' | 'armour'
  | 'beds' | 'workers' | 'threat' | 'pan' | 'dig' | 'chamber' | 'build'
  | 'work' | 'command' | 'recruit';

const HUD_ICON_PATHS: Record<HudIconName, string> = {
  heart: '<path d="M12 20.2 4.4 13A5 5 0 0 1 11.5 6l.5.6.5-.6a5 5 0 0 1 7.1 7Z" fill="currentColor" stroke="none"/>',
  ore: '<path d="m12 3 7 6-3 9H8L5 9Z"/><path d="m5 9 7 3 7-3M12 3v9m-4 6 4-6 4 6"/>',
  biomass: '<path d="M5 11c.5-4 3.2-6 7-6s6.5 2 7 6Z"/><path d="M10 11c.3 3-.4 5.4-2 7h8c-1.6-1.6-2.3-4-2-7"/><circle cx="9" cy="8.5" r=".8" fill="currentColor" stroke="none"/><circle cx="14.8" cy="8" r=".8" fill="currentColor" stroke="none"/>',
  metal: '<path d="m6 8 12-2 3 9-13 3-5-6Z"/><path d="m6 8 2 10m10-12 3 9"/>',
  rations: '<path d="M8 9c-3 1-3 8 1 10 2 1 2-1 3-1s1 2 3 1c4-2 4-9 1-10-2-1-3 0-4 1-1-1-2-2-4-1Z"/><path d="M12 9c0-3 2-4 4-4M12 6c-1-2-3-2-4-2"/>',
  essence: '<path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2Z"/><circle cx="12" cy="11" r="2"/>',
  armour: '<path d="M12 3 19 6v5c0 4.5-2.8 7.6-7 10-4.2-2.4-7-5.5-7-10V6Z"/><path d="M9 8h6v7H9z"/>',
  beds: '<path d="M4 17V7m0 7h16v3H4Zm3-4V8h5a3 3 0 0 1 3 3v3M4 19v-2m16 2v-2"/>',
  workers: '<path d="m5 19 9-9m-1-4 2-2 5 5-2 2-2-2-2 2M8 8 5 5m-2 2 4-4"/><path d="m13 14 6 6"/>',
  threat: '<path d="m5 4 14 15m0-15L5 19M4 3l4 1-3 3m15-4-4 1 3 3M4 20l4-1-3-3m15 4-4-1 3-3"/>',
  pan: '<path d="M12 3v18M3 12h18m-9-9-3 3m3-3 3 3M3 12l3-3m-3 3 3 3m6 6-3-3m3 3 3-3m6-6-3-3m3 3-3 3"/>',
  dig: '<path d="M4 18c4-7 7-2 10-8 1.5-3 3-4 6-4"/><path d="m17 3 3 3-3 3"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
  chamber: '<path d="M4 5h16v14H4z"/><path d="M8 9h8v6H8z"/>',
  build: '<path d="M5 20V9h14v11M8 9V5h8v4M9 20v-5h6v5"/><path d="M4 20h16M10 5V3h4v2"/>',
  work: '<path d="M8 5h8v3H8zM6 7h12v14H6z"/><path d="M9 12h6m-6 4h6"/>',
  command: '<path d="M6 21V3m1 2h11l-3 4 3 4H7"/>',
  recruit: '<path d="M6 12a6 6 0 0 1 12 0v2H6Z"/><path d="M8 14v4m8-4v4M5 18h14M12 6V3"/>',
};

const hudIcon = (name: HudIconName) => `
  <svg class="hud-icon hud-icon-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${HUD_ICON_PATHS[name]}</svg>`;

const resource = (key: string, icon: HudIconName, label: string) => `
  <div class="resource" data-testid="resource-${key}">
    <span class="resource-icon">${hudIcon(icon)}</span>
    <span><strong data-value="${key}">0</strong><small>${label}</small></span>
  </div>`;

export class HudController {
  private root: HTMLElement;
  private callbacks: HudCallbacks;
  private toasts: HTMLElement;
  private modal: HTMLElement;
  private selectionHint: HTMLElement;
  private started = false;
  private valueNodes = new Map<string, HTMLElement>();
  private phaseNodes: HTMLElement[] = [];
  private toolNodes: HTMLElement[] = [];
  private speedNodes: HTMLElement[] = [];
  private recruitButtons = new Map<UnitKind, HTMLButtonElement>();
  private workButtons = new Map<RoutineWorkerTask, HTMLElement>();
  private workStatusNodes = new Map<RoutineWorkerTask, HTMLElement>();
  private heartBar?: HTMLElement;
  private buildMenu?: HTMLElement;
  private commandMenu?: HTMLElement;
  private pulseButton?: HTMLButtonElement;
  private summonWorkerButton?: HTMLButtonElement;
  private objectiveChecklist?: HTMLElement;
  private contextPanel?: HTMLElement;
  private worldTargets?: HTMLElement;
  private automationMode: boolean;

  constructor(callbacks: HudCallbacks, options: { automationMode?: boolean } = {}) {
    this.callbacks = callbacks;
    this.automationMode = Boolean(options.automationMode);
    const root = document.querySelector<HTMLElement>('#hud');
    if (!root) throw new Error('HUD root missing');
    this.root = root;
    root.innerHTML = `
      <div class="topbar">
        <div class="heart-chip">
          <span class="heart-icon">${hudIcon('heart')}</span>
          <div class="heart-copy">
            <div class="eyebrow">Covenant-Herz</div>
            <div class="heart-value"><span data-value="hp">300</span><small>/ 300</small></div>
          </div>
          <div class="heart-bar"><i></i></div>
        </div>
        <div class="resource-strip">
          ${resource('ore', 'ore', 'Roherz')}
          ${resource('biomass', 'biomass', 'Biomasse')}
          ${resource('metal', 'metal', 'Metall')}
          ${resource('rations', 'rations', 'Rationen')}
          ${resource('essence', 'essence', 'Essenz')}
          ${resource('armour', 'armour', 'Rüstung')}
          <div class="resource"><span class="resource-icon">${hudIcon('beds')}</span><span><strong data-value="beds">0/0</strong><small>Betten</small></span></div>
          <button class="resource resource-action" data-action="open-workers" data-menu="worker" data-testid="worker-count" aria-expanded="false" title="Arbeiter beschwören"><span class="resource-icon">${hudIcon('workers')}</span><span><strong data-value="workers">3/5</strong><small>Arbeiter</small></span></button>
          <div class="resource need-resource"><span class="resource-icon">!</span><span><strong data-value="hungry">0</strong><small>Hungrig</small></span></div>
          <div class="resource"><span class="resource-icon">${hudIcon('threat')}</span><span><strong data-value="wave">Ruhe</strong><small>Bedrohung</small></span></div>
        </div>
        <div class="time-controls">
          <button class="icon-btn" data-speed="0" data-testid="speed-pause" title="Pause">Ⅱ</button>
          <button class="icon-btn active" data-speed="1" data-testid="speed-normal" title="Normale Geschwindigkeit">▶</button>
          <button class="icon-btn" data-speed="2" data-testid="speed-fast" title="Doppelte Geschwindigkeit">▶▶</button>
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
          <ul class="objective-checklist" data-objective-checklist></ul>
          <div class="objective-progress">${[1, 2, 3, 4, 5].map((n) => `<i data-phase="${n}"></i>`).join('')}</div>
        </section>
        <section class="panel context-panel">
          <div class="context-title" data-value="context-title"></div>
          <p data-value="context-body"></p>
        </section>
      </div>
      <div class="toast-stack"></div>
      <div class="selection-hint"></div>
      <section class="semantic-world-targets" data-testid="world-targets" aria-label="Sichtbare Weltziele"></section>
      <div class="bottom-area">
        <div class="tool-popovers">
          <section class="tool-popover" data-popover="worker" hidden>
            <div class="popover-heading"><strong>Arbeiter</strong><span>Mehr Hände für Graben, Bauen und Transport</span></div>
            <div class="popover-grid compact">
              <button class="recruit-btn worker-summon-btn" data-action="summon-worker" data-testid="summon-worker"><b>⚒</b>Arbeiter rufen<small>2 Essenz · max. 5 · benötigt Pilzküche</small></button>
            </div>
          </section>
          <section class="tool-popover" data-popover="build" hidden>
            <div class="popover-heading"><strong>Raum bauen</strong><span>Auf beanspruchtem Boden aufziehen</span></div>
            <div class="popover-grid">
              <button class="room-btn" data-tool="room-storage"><b>▦</b>Lager<small>0 Metall</small></button>
              <button class="room-btn" data-tool="room-bedroom"><b>⌂</b>Schlafen<small>Phase 2 · ab 2 Metall</small></button>
              <button class="room-btn" data-tool="room-kitchen"><b>♨</b>Küche<small>4 Metall</small></button>
              <button class="room-btn" data-tool="room-smelter"><b>♨</b>Schmelze<small>Phase 2 · ab 5 Metall</small></button>
              <button class="room-btn" data-tool="room-workshop"><b>⚒</b>Werkstatt<small>Phase 3 · ab 5 Metall</small></button>
              <button class="room-btn" data-tool="room-prison"><b>▥</b>Gefängnis<small>Phase 5 · ab 6 Metall</small></button>
            </div>
          </section>
          <section class="tool-popover" data-popover="command" hidden>
            <div class="popover-heading"><strong>Befehle</strong><span>Kampfgebiet und Verteidigung steuern</span></div>
            <div class="popover-grid compact">
              <button class="tool-btn" data-tool="banner-attack"><b>⚑</b>Angriff<small>Phase 4 · Banner</small></button>
              <button class="tool-btn" data-tool="banner-defend"><b>⚐</b>Halten<small>Banner setzen</small></button>
              <button class="tool-btn" data-tool="trap"><b>⌄</b>Falle<small>Phase 3 · 2 Metall</small></button>
            </div>
          </section>
          <section class="tool-popover work-popover" data-popover="work" hidden>
            <div class="popover-heading"><strong>Arbeitsprioritäten</strong><span>Antippen: Normal → Hoch → Niedrig</span></div>
            <div class="popover-grid work-grid">
              <button class="tool-btn priority-btn" data-work="haul"><b>▣</b>Transport<small data-work-status="haul">Normal · 0</small></button>
              <button class="tool-btn priority-btn" data-work="dig"><b>⌁</b>Graben<small data-work-status="dig">Normal · 0</small></button>
              <button class="tool-btn priority-btn" data-work="build"><b>▦</b>Bauen<small data-work-status="build">Normal · 0</small></button>
              <button class="tool-btn priority-btn" data-work="claim"><b>◇</b>Claimen<small data-work-status="claim">Normal · 0</small></button>
              <button class="tool-btn priority-btn" data-work="mine"><b>◆</b>Abbau<small data-work-status="mine">Normal · 0</small></button>
            </div>
          </section>
          <section class="tool-popover" data-popover="recruit" hidden>
            <div class="popover-heading"><strong>Kämpfer rufen</strong><span>Das Herz beschwört ausgerüstetes Gefolge</span></div>
            <div class="popover-grid compact">
              <button class="recruit-btn" data-recruit="guard" title="Benötigt Küche, Werkstatt, 1 Ration und 1 Rüstung"><b>⬟</b>Guard<small>Phase 3 · 1R · 1⚙</small></button>
              <button class="recruit-btn" data-recruit="archer" title="Benötigt Küche, Werkstatt, 1 Ration und 1 Rüstung"><b>➶</b>Archer<small>Phase 3 · 1R · 1⚙</small></button>
              <button class="recruit-btn" data-recruit="hexbinder" title="Benötigt Küche, Essenzschrein, 1 Ration und 3 Essenz"><b>✦</b>Hexbinder<small>Phase 5 · 1R · 3E</small></button>
            </div>
          </section>
        </div>
        <nav class="toolbar" aria-label="Werkzeugleiste">
          <button class="tool-btn active" data-tool="pan" data-testid="tool-pan"><b>${hudIcon('pan')}</b>Ansicht<small>Verschieben</small></button>
          <button class="tool-btn" data-tool="dig" data-testid="tool-dig"><b>${hudIcon('dig')}</b>Gang<small>Route ziehen</small></button>
          <button class="tool-btn" data-tool="chamber" data-testid="tool-chamber"><b>${hudIcon('chamber')}</b>Kammer<small>Fläche ziehen</small></button>
          <button class="tool-btn menu-btn" data-menu="build" data-testid="menu-build" aria-expanded="false"><b>${hudIcon('build')}</b>Bauen<small>6 Räume</small></button>
          <button class="tool-btn menu-btn" data-menu="work" data-testid="menu-work" aria-expanded="false"><b>${hudIcon('work')}</b>Arbeit<small>Prioritäten</small></button>
          <button class="tool-btn menu-btn" data-menu="command" data-testid="menu-command" aria-expanded="false"><b>${hudIcon('command')}</b>Befehle<small>Kampf & Falle</small></button>
          <button class="tool-btn menu-btn" data-menu="recruit" data-testid="menu-recruit" aria-expanded="false"><b>${hudIcon('recruit')}</b>Gefolge<small>Rufen</small></button>
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
          <button class="primary-btn" data-action="begin" data-testid="begin-game">Das Herz erwecken</button>
          <div class="controls-note">Maus: Ziehen &amp; Mausrad · Touch: Ziehen &amp; Pinch · WASD: Kamera · F: Karte · P: Pause</div>
        </section>
      </div>`;

    this.toasts = root.querySelector('.toast-stack') as HTMLElement;
    this.modal = root.querySelector('.modal-shell') as HTMLElement;
    this.selectionHint = root.querySelector('.selection-hint') as HTMLElement;
    root.querySelectorAll<HTMLElement>('[data-value]').forEach((node) => {
      const key = node.dataset.value;
      if (key) this.valueNodes.set(key, node);
    });
    this.phaseNodes = [...root.querySelectorAll<HTMLElement>('[data-phase]')];
    this.toolNodes = [...root.querySelectorAll<HTMLElement>('[data-tool]')];
    this.speedNodes = [...root.querySelectorAll<HTMLElement>('[data-speed]')];
    root.querySelectorAll<HTMLButtonElement>('[data-recruit]').forEach((button) => {
      this.recruitButtons.set(button.dataset.recruit as UnitKind, button);
    });
    root.querySelectorAll<HTMLElement>('[data-work]').forEach((button) => {
      this.workButtons.set(button.dataset.work as RoutineWorkerTask, button);
    });
    root.querySelectorAll<HTMLElement>('[data-work-status]').forEach((node) => {
      this.workStatusNodes.set(node.dataset.workStatus as RoutineWorkerTask, node);
    });
    this.heartBar = root.querySelector<HTMLElement>('.heart-bar i') ?? undefined;
    this.buildMenu = root.querySelector<HTMLElement>('[data-menu="build"]') ?? undefined;
    this.commandMenu = root.querySelector<HTMLElement>('[data-menu="command"]') ?? undefined;
    this.pulseButton = root.querySelector<HTMLButtonElement>('[data-action="pulse"]') ?? undefined;
    this.summonWorkerButton = root.querySelector<HTMLButtonElement>('[data-action="summon-worker"]') ?? undefined;
    this.objectiveChecklist = root.querySelector<HTMLElement>('[data-objective-checklist]') ?? undefined;
    this.contextPanel = root.querySelector<HTMLElement>('.context-panel') ?? undefined;
    this.worldTargets = root.querySelector<HTMLElement>('[data-testid="world-targets"]') ?? undefined;
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
    this.root.querySelector('[data-action="summon-worker"]')?.addEventListener('click', () => {
      this.closeToolMenus();
      this.callbacks.summonWorker();
    });
    this.root.querySelectorAll<HTMLElement>('[data-work]').forEach((button) => {
      button.addEventListener('click', () => {
        this.callbacks.cycleWorkPriority(button.dataset.work as RoutineWorkerTask);
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
      this.start();
    });
  }

  start(): void {
    if (this.started) return;
    this.modal.classList.add('hidden');
    this.started = true;
    if (!this.automationMode && window.matchMedia('(max-width: 900px)').matches) this.enterFullscreen();
    this.callbacks.begin();
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
      workers: `${state.workers}/${state.maxWorkers}`,
      hungry: state.hungryUnits,
      wave: state.wave,
      phase: `Phase ${state.phase} · ${formatTime(state.elapsed)}`,
      'objective-title': state.objectiveTitle,
      'objective-body': state.objectiveBody,
    };
    for (const [name, value] of Object.entries(values)) {
      const node = this.valueNodes.get(name);
      const text = String(value);
      if (node && node.textContent !== text) node.textContent = text;
    }
    if (this.heartBar) this.heartBar.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
    this.phaseNodes.forEach((node) => {
      node.classList.toggle('done', Number(node.dataset.phase) <= state.phase);
    });
    this.toolNodes.forEach((node) => {
      node.classList.toggle('active', node.dataset.tool === state.tool);
      const tool = node.dataset.tool as ToolKind;
      const reason = state.toolLocks[tool];
      if (node instanceof HTMLButtonElement) node.disabled = Boolean(reason);
      node.classList.toggle('locked', Boolean(reason));
      if (reason) node.setAttribute('title', reason);
      else if (node.hasAttribute('data-tool')) node.removeAttribute('title');
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((button) => {
      const menu = button.dataset.menu as HudMenu;
      const reason = state.menuLocks[menu];
      button.disabled = Boolean(reason);
      button.classList.toggle('locked', Boolean(reason));
      button.classList.toggle('tutorial-focus', state.tutorialFocus === 'worker' && menu === 'worker');
      if (reason) button.title = reason;
      else if (menu === 'worker') button.title = 'Arbeiter beschwören';
      else button.removeAttribute('title');
    });
    this.root.querySelector<HTMLElement>('[data-tool="dig"]')?.classList.toggle('tutorial-focus', state.tutorialFocus === 'dig');
    this.buildMenu?.classList.toggle('active', state.tool.startsWith('room-'));
    this.commandMenu?.classList.toggle(
      'active',
      state.tool === 'banner-attack' || state.tool === 'banner-defend' || state.tool === 'trap',
    );
    this.speedNodes.forEach((node) => {
      node.classList.toggle('active', Number(node.dataset.speed) === state.speed);
    });
    for (const kind of ['guard', 'archer', 'hexbinder'] as const) {
      const button = this.recruitButtons.get(kind);
      if (button) {
        button.disabled = !state.canRecruit[kind];
        button.title = state.recruitReasons[kind] ?? 'Bereit zur Rekrutierung';
      }
    }
    if (this.summonWorkerButton) {
      this.summonWorkerButton.disabled = !state.canSummonWorker;
      this.summonWorkerButton.title = state.workerSummonReason ?? 'Zusätzlichen Arbeiter am Herz beschwören';
    }
    if (this.worldTargets) {
      this.worldTargets.replaceChildren(...state.worldTargets.map((target) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.worldTarget = target.id;
        button.dataset.testid = `world-target-${target.id}`;
        button.textContent = `${target.label}: ${target.status}`;
        button.addEventListener('click', () => this.callbacks.focusTarget(target.id));
        return button;
      }));
    }
    if (this.objectiveChecklist) {
      this.objectiveChecklist.replaceChildren(...state.objectiveChecklist.map((item) => {
        const entry = document.createElement('li');
        entry.className = item.done ? 'done' : '';
        entry.textContent = `${item.done ? '✓' : '○'} ${item.label}`;
        return entry;
      }));
    }
    const priorityLabel = ['Niedrig', 'Normal', 'Hoch'] as const;
    for (const task of ['haul', 'dig', 'build', 'claim', 'mine'] as const) {
      const button = this.workButtons.get(task);
      const status = this.workStatusNodes.get(task);
      const level = state.workPriorities[task];
      button?.classList.toggle('priority-high', level === 2);
      button?.classList.toggle('priority-low', level === 0);
      button?.setAttribute('aria-label', `${task}: ${priorityLabel[level]}, ${state.workerJobs[task]} Arbeiter`);
      if (status) status.textContent = `${priorityLabel[level]} · ${state.workerJobs[task]}`;
    }
    if (this.pulseButton) this.pulseButton.disabled = !state.pulseReady;
    this.contextPanel?.classList.toggle('visible', Boolean(state.context));
    if (state.context) {
      const title = this.valueNodes.get('context-title');
      const body = this.valueNodes.get('context-body');
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
