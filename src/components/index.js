import { baseDefaults } from './base.js';
import * as cards from './cards.js';
import * as buttons from './buttons.js';
import * as navigation from './navigation.js';
import * as heroes from './heroes.js';
import * as media from './media.js';
import * as characters from './characters.js';
import * as decorative from './decorative.js';
import { isPlain } from '../controls/common.js';

const MODULES = [cards, buttons, navigation, heroes, media, characters, decorative];

export function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (isPlain(v)) {
      if (!isPlain(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else target[k] = v;
  }
  return target;
}

/** Token-derived default style for a component type. Unknown types get base defaults only. */
export function defaultsFor(type, tokens) {
  const out = baseDefaults(tokens);
  const mod = MODULES.find((m) => m.types.includes(type));
  return mod ? deepMerge(out, mod.defaults(tokens)) : out;
}
