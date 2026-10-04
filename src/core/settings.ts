import mitt from 'mitt';

export interface Settings {
  /** Snap positions to the grid and rotations to 15° (hold Shift to bypass). */
  snap: boolean;
  /** Spawn faint partial reflections off glass surfaces. */
  fresnel: boolean;
  /** Bloom strength, 0 disables it. */
  bloom: number;
  grid: boolean;
  /** Spark particles and ambient effects. */
  particles: boolean;
}

const KEY = 'lasersim.settings';

const DEFAULTS: Settings = {
  snap: true,
  fresnel: true,
  bloom: 1.1,
  grid: true,
  particles: true,
};

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();
export const settingsEvents = mitt<{ change: keyof Settings }>();

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
  settingsEvents.emit('change', key);
}
