import './style.css';
import { clearHash, loadFromHash, loadLocal, saveLocal } from './core/persistence';
import { settings, settingsEvents } from './core/settings';
import { Store } from './core/store';
import { Editor } from './editor/editor';
import { Simulator } from './logic/simulator';
import { trace, type TraceResult } from './optics/tracer';
import { presets } from './presets';
import { scriptHost } from './scripting/host';
import { Background } from './render/background';
import { BeamRenderer } from './render/beams';
import { FxSystem } from './render/fx';
import { createStage } from './render/stage';
import { createTextures } from './render/textures';
import { ViewManager } from './render/views';
import { WireRenderer } from './render/wires';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { mountToolbar } from './ui/toolbar';
import { ScriptEditor } from './ui/script-editor';
import { mountTopbar } from './ui/topbar';

const $ = (id: string) => document.getElementById(id)!;

async function main() {
  const fromHash = loadFromHash();
  if (fromHash) clearHash();
  const initial = fromHash ?? loadLocal() ?? presets[0].build();
  const store = new Store(initial);
  const sim = new Simulator();

  const stageHost = $('stage');
  const stage = await createStage(stageHost, initial.board);
  const textures = createTextures();
  const fx = new FxSystem(textures.glow);
  const background = new Background(textures);
  const beams = new BeamRenderer(textures.flare);
  const wires = new WireRenderer(textures.glow);
  const views = new ViewManager(stage.layers.elements, { textures, fx });
  stage.layers.background.addChild(background.root, wires.under);
  stage.layers.light.addChild(beams.root, wires.glow, fx.root);
  stage.layers.overlay.addChild(wires.over);

  // Trigger: a button press is a sim event; make sure the next step sees it.
  const editor = new Editor(stage, store, { trigger: (id) => sim.trigger(id) });
  const fit = () => stage.fit(store.scene.board);
  const hud = new Hud($('hud'));
  const stepOnce = () => {
    if (sim.step(store.scene, lastResult?.energy ?? new Map(), 1 / settings.simRate)) dirty = true;
  };
  mountTopbar($('topbar'), store, fit, { step: stepOnce, reset: () => (sim.reset(), (dirty = true)) });
  mountToolbar($('toolbar'), stageHost, editor);
  new Inspector($('sidepanel'), store, editor, fit);
  new ScriptEditor(stageHost, store);

  // Frame loop: run fixed simulation steps, then re-trace light only when something changed.
  let dirty = true;
  let lastResult: TraceResult | null = null;
  let zoomDirty = false;
  let accumulator = 0;
  const markDirty = () => (dirty = true);
  stage.viewport.on('zoomed', () => (zoomDirty = true));
  store.events.on('change', markDirty);
  store.events.on('select', markDirty);
  settingsEvents.on('change', markDirty);
  store.events.on('change', () => {
    if (!store.scene.elements.length) sim.reset();
  });

  stage.app.ticker.add((t) => {
    const dt = Math.min(0.05, t.deltaMS / 1000);

    if (!settings.paused) {
      const step = 1 / settings.simRate;
      accumulator = Math.min(accumulator + dt, step * 4);
      while (accumulator >= step) {
        accumulator -= step;
        // Light reacts to the previous step's outputs before logic reads it again.
        if (dirty) refresh();
        stepOnce();
      }
    }

    if (dirty) refresh();
    else if (zoomDirty && lastResult) {
      beams.draw(lastResult, stage.viewport.scale.x);
      wires.draw(store.scene, sim.signals(store.scene), store.selectedWireId, stage.viewport.scale.x);
    }
    zoomDirty = false;
    views.tick(dt);
    wires.tick(dt);
    fx.update(dt);
  });

  function refresh() {
    dirty = false;
    const signals = sim.signals(store.scene);
    const result = (lastResult = trace(store.scene, settings, signals));
    background.update(store.scene.board, result.fields);
    beams.draw(result, stage.viewport.scale.x);
    wires.draw(store.scene, signals, store.selectedWireId, stage.viewport.scale.x);
    views.sync(store.scene, result.energy, store.selectedId, signals);
    hud.update(store.scene, result.energy, signals);
  }

  let saveTimer = 0;
  store.events.on('commit', () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveLocal(store.scene), 300);
  });

  // Handy for debugging and tests from the console.
  Object.assign(window, { lasersim: { store, stage, sim, presets, scriptHost, settings, trace: () => trace(store.scene, settings, sim.signals(store.scene)) } });
}

main();
