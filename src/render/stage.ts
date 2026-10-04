import { Application, Container } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { Viewport } from 'pixi-viewport';
import { settings, settingsEvents } from '../core/settings';

export interface Stage {
  app: Application;
  viewport: Viewport;
  layers: {
    background: Container;
    elements: Container;
    /** Additive + bloomed: beams, glows, particles. */
    light: Container;
    overlay: Container;
  };
  fit(board: { width: number; height: number }): void;
}

export async function createStage(host: HTMLElement, board: { width: number; height: number }): Promise<Stage> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    antialias: true,
    background: 0x05070a,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

  const viewport = new Viewport({
    screenWidth: host.clientWidth,
    screenHeight: host.clientHeight,
    worldWidth: board.width,
    worldHeight: board.height,
    events: app.renderer.events,
    passiveWheel: false,
  });
  viewport.drag().pinch().wheel({ smooth: 5 }).decelerate({ friction: 0.92 }).clampZoom({ minScale: 0.15, maxScale: 6 });
  app.stage.addChild(viewport);

  const background = new Container();
  const elements = new Container();
  const light = new Container();
  const overlay = new Container();
  viewport.addChild(background, elements, light, overlay);

  const bloom = new AdvancedBloomFilter({ threshold: 0.18, bloomScale: 1, brightness: 1, blur: 7, quality: 7 });
  const applyBloom = () => {
    bloom.bloomScale = settings.bloom;
    light.filters = settings.bloom > 0 ? [bloom] : [];
  };
  applyBloom();
  settingsEvents.on('change', (k) => k === 'bloom' && applyBloom());

  app.renderer.on('resize', (w: number, h: number) => viewport.resize(w, h));

  const fit = (b: { width: number; height: number }) => {
    viewport.worldWidth = b.width;
    viewport.worldHeight = b.height;
    viewport.fit(true, b.width * 1.06, b.height * 1.06);
    viewport.moveCenter(b.width / 2, b.height / 2);
  };
  fit(board);

  return { app, viewport, layers: { background, elements, light, overlay }, fit };
}
