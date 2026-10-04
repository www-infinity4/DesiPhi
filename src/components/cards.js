import { surface } from './base.js';

export const types = ['card', 'card-grid'];
export const defaults = (tokens) => ({
  ...surface(tokens),
  spacing: { gap: tokens.spacing?.gap, padding: tokens.spacing?.padding },
  effects: { shadow: tokens.effects?.shadow, depth: tokens.effects?.depth }
});
