# LaserSim

A 2D light sandbox / puzzle: place lasers, mirrors, lenses, prisms and black holes, bend the light, and ignite every orb.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

## Controls

| Action | How |
| --- | --- |
| Add a piece | Click it in the left palette (or drag it onto the board) |
| Move | Drag the piece. Snaps to the grid; hold **Shift** for free placement |
| Rotate | Drag the round knob, or **Q / E** (Shift = 1° steps) |
| Reshape | Drag the ◆ handles (lens faces, mirror length, curve depth, size…) |
| Toggle a light source | Double-click it or press **Space** |
| Undo / redo | **Ctrl+Z** / **Ctrl+Shift+Z** |
| Duplicate / delete | **Ctrl+D** / **Del** |
| Pan / zoom | Drag empty space / mouse wheel or pinch |

Scenes autosave to the browser. **Share** copies a link with the whole scene encoded in it.

## Libraries

| Library | Used for |
| --- | --- |
| [PixiJS](https://pixijs.com) v8 | WebGL rendering |
| [pixi-filters](https://github.com/pixijs/filters) | Bloom glow on light |
| [pixi-viewport](https://github.com/pixi-viewport/pixi-viewport) | Pan, zoom, pinch, inertia |
| [Tweakpane](https://tweakpane.github.io/docs/) | Inspector and settings panels |
| [GSAP](https://gsap.com) | Ignite and UI animations |
| [Lucide](https://lucide.dev) | Icons |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | Win celebration |
| [lz-string](https://github.com/pieroxy/lz-string) | Compressing scenes into share links |
| [mitt](https://github.com/developit/mitt) | Event emitter for store and settings |

## Project layout

```
src/
  core/        scene data, registry, store (undo/redo), settings, persistence
  optics/      ray tracer, intersections, surface shapes, materials, spectrum, gravity
  render/      Pixi stage, background grid, beams, particles, textures, view manager
  editor/      pointer/keyboard editing and the selection overlay
  ui/          toolbar, inspector, top bar, HUD, toasts
  elements/    one file per piece (auto-registered)
  presets/     one file per preset board (auto-registered)
```

How a frame works: the **store** holds the scene as plain JSON. When the scene changes, the **tracer** rebuilds every beam from the light sources. Each element's own module supplies its surfaces, emitters and gravity fields. Each surface has a **material** (mirror, glass, absorber, sensor, splitter, filter) that decides which rays leave a hit point. The result is drawn by the **beam renderer**, and each element's **view** draws the element itself.

## Adding a new piece

Create one file in `src/elements/` that default-exports an `ElementDef` (see `src/core/types.ts`). The file is picked up automatically. The toolbar entry, the inspector controls, hit-testing, handles, save/load and undo all come from the definition.

```ts
// src/elements/my-thing.ts
import { Square } from 'lucide';
import type { ElementDef } from '../core/types';
import { mirror } from '../optics/materials';
import { rectSurfaces } from '../optics/shapes';
import { graphicsView } from '../render/viewkit';

interface Props { size: number }

const myThing: ElementDef<Props> = {
  type: 'my-thing',
  label: 'Mirror box',
  icon: Square,
  category: 'optic',
  defaults: () => ({ size: 60 }),
  params: [{ kind: 'number', key: 'size', label: 'Size', min: 10, max: 300 }],
  boundsRadius: (p) => p.size * 0.71,
  hitTest: (p, l) => Math.abs(l.x) <= p.size / 2 && Math.abs(l.y) <= p.size / 2,
  surfaces: (p) => rectSurfaces(p.size, p.size, mirror()),
  createView: () => graphicsView<Props>((g, p) => g.rect(-p.size / 2, -p.size / 2, p.size, p.size).fill(0x8899aa)),
};

export default myThing;
```

Optional hooks:

- `emit`: makes the piece a light source.
- `field`: makes it bend light, like the black hole does.
- `handles`: adds draggable reshape handles.
- `goalMet`: makes the piece count toward winning.
- `info`: shows read-only values in the inspector.
- `activate`: sets what double-click or Space does.
- `variants`: adds extra toolbar entries with different starting props.

New light behaviours (portals, polarisers, gratings…) are new **materials** in `src/optics/materials.ts`. A preset board is one file in `src/presets/`.
