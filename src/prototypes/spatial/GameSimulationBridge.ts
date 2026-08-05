import type { CanonicalGameState, HollowAgentApi } from '../../core/AutomationBridge';

export interface GameSimulationBridge {
  readonly frame: HTMLIFrameElement;
  readonly api: HollowAgentApi;
  state(): CanonicalGameState;
  dispose(): void;
}

function waitForAgent(frame: HTMLIFrameElement): Promise<HollowAgentApi> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Die Spielsimulation hat nicht rechtzeitig geantwortet.')), 15_000);
    const finish = (): void => {
      const api = frame.contentWindow?.hollowAgent;
      if (!api) return;
      window.clearTimeout(timeout);
      resolve(api);
    };

    frame.addEventListener('load', () => {
      finish();
      frame.contentWindow?.addEventListener('hollow:agent-ready', finish, { once: true });
    }, { once: true });
    frame.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('Die eingebettete Spielsimulation konnte nicht geladen werden.'));
    }, { once: true });
  });
}

function exposeHud(frame: HTMLIFrameElement): void {
  const document = frame.contentDocument;
  if (!document) return;
  const style = document.createElement('style');
  style.dataset.spatialIntegration = 'true';
  style.textContent = `
    html, body, #app { background: transparent !important; }
    #game { display: none !important; }
    #hud { display: block !important; }
    .time-controls { display: none !important; }
    #rotate-overlay, .modal-shell { display: none !important; }
  `;
  document.head.append(style);
}

export async function connectGameSimulation(host: HTMLElement): Promise<GameSimulationBridge> {
  const frame = document.createElement('iframe');
  frame.className = 'simulation-frame';
  frame.title = 'Echte Hollow-Covenant-Simulation';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.src = new URL('./index.html?automation=1&seed=1337&theme=style-b', window.location.href).href;
  host.append(frame);

  let api: HollowAgentApi;
  try {
    api = await waitForAgent(frame);
    if (api.version !== 1) throw new Error(`Nicht unterstützte Spiel-API: Version ${String(api.version)}.`);
    const renderResult = api.setFrameLoop(false);
    if (!renderResult.ok || renderResult.state.frameLoopRunning) {
      throw new Error(renderResult.reason ?? 'Der verborgene Spielrenderer konnte nicht angehalten werden.');
    }
    exposeHud(frame);
  } catch (error) {
    frame.remove();
    throw error;
  }

  return {
    frame,
    api,
    state: () => api.getState(),
    dispose: () => frame.remove(),
  };
}
