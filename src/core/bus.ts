import mitt from 'mitt';

/** App-wide UI events that element definitions can trigger without knowing about the UI. */
export type AppEvents = {
  /** Open the script editor for an element id. */
  'edit-script': string;
  /** Remove every particle from a chamber. */
  'clear-chamber': string;
};

export const bus = mitt<AppEvents>();
