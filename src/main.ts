import './style.css';
import { clearHash, loadFromHash, loadLocal, saveLocal } from './core/persistence';
import { settings, settingsEvents } from './core/settings';
import { Store } from './core/store';
import { Editor } from './editor/editor';
import { trace } from './optics/tracer';
import { presets } from './presets';
import { Background } from './render/background';
import { BeamRenderer } from './render/beams';
import { FxSystem } from './render/fx';
import { createStage } from './render/stage';
import { createTextures } from './render/textures';
import { ViewManager } from './render/views';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { mountToolbar } from './ui/toolbar';
import { mountTopbar } from './ui/topbar';

const $ = (id: string) => document.getElementById(id)!;

async function main() {
  const fromHash = loadFromHash();
  if (fromHash) clearHash();
  const initial = fromHash ?? loadLocal() ?? presets[0].build();
  const store = new Store(initial);

  const stageHost = $('stage');
  const stage = await createStage(stageHost, initial.board);
  const textures = createTextures();
  const fx = new FxSystem(textures.glow);
  const background = new Background(textures);
  const beams = new BeamRenderer(textures.flare);
  const views = new ViewManager(stage.layers.elements, { textures, fx });
  stage.layers.background.addChild(background.root);
  stage.layers.light.addChild(beams.root, fx.root);

  const editor = new Editor(stage, store);
  const fit = () => stage.fit(store.scene.board);
  const hud = new Hud($('hud'));
  mountTopbar($('topbar'), store, fit);
  mountToolbar($('toolbar'), stageHost, editor);
  new Inspector($('sidepanel'), store, editor, fit);

  // Re-trace lazily: at most once per frame, only when something changed.
  let dirty = true;
  const markDirty = () => (dirty = true);
  store.events.on('change', markDirty);
  store.events.on('select', markDirty);
  settingsEvents.on('change', markDirty);

  stage.app.ticker.add((t) => {
    if (dirty) {
      dirty = false;
      const result = trace(store.scene, settings);
      background.update(store.scene.board, result.fields);
      beams.draw(result);
      views.sync(store.scene, result.energy, store.selectedId);
      hud.update(store.scene, result.energy);
    }
    const dt = Math.min(0.05, t.deltaMS / 1000);
    views.tick(dt);
    fx.update(dt);
  });

  let saveTimer = 0;
  store.events.on('commit', () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveLocal(store.scene), 300);
  });

  // Handy for debugging from the console.
  Object.assign(window, { lasersim: { store, stage, trace: () => trace(store.scene, settings) } });
}

main();
