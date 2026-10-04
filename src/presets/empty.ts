import type { Preset } from './index';
import { scene } from './helpers';

const preset: Preset = {
  id: 'empty',
  name: 'Empty board',
  order: 99,
  build: () => scene([]),
};

export default preset;
