const treatments = ['clean', 'soft', 'bold', 'compact', 'editorial', 'immersive'];
const roles = {
  hero: { sizing: { minHeight: '360px' }, spacing: { padding: '40px' }, effects: { decorativeLayers: 0 } },
  article: { typography: { textWidth: '68ch' }, spacing: { gap: '20px' } },
  card: { shape: { radius: '12px' }, spacing: { padding: '18px' }, effects: { shadow: '0 2px 8px rgba(0,0,0,0.08)' } },
  'card-grid': { spacing: { gap: '20px' } },
  timeline: { spacing: { gap: '16px' }, shape: { radius: '8px' } },
  quiz: { spacing: { gap: '16px' }, accessibility: { minTouchTarget: '44px' } },
  sources: { typography: { textWidth: '72ch' }, spacing: { gap: '12px' } },
  navigation: { sizing: { minHeight: '48px' }, spacing: { gap: '16px' } },
  media: { imagery: { fit: 'cover', crop: 'cover' }, shape: { radius: '12px' } }
};

const modifiers = {
  clean: {},
  soft: { shape: { radius: '20px' }, effects: { shadow: '0 8px 24px rgba(0,0,0,0.10)' } },
  bold: { shape: { border: { width: '3px', style: 'solid' } }, effects: { depth: 3 } },
  compact: { spacing: { padding: '10px', gap: '8px' }, sizing: { minHeight: 'auto' } },
  editorial: { typography: { fontFamily: 'Georgia, serif', lineHeight: 1.75 }, shape: { radius: '0' } },
  immersive: { effects: { decorativeLayers: 2, depth: 4 }, motion: { entrance: 'fade' } }
};

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge({ ...(target[key] || {}) }, value) : value;
  }
  return target;
}

export const VISUAL_PRESETS = Object.fromEntries(Object.entries(roles).map(([role, base]) => [
  role,
  Object.fromEntries(treatments.map((treatment) => [treatment, merge(structuredClone(base), modifiers[treatment])]))
]));

export function resolveVisualPreset(role, preset) {
  let treatment = preset;
  let requestedRole = role;
  if (preset.includes('.')) [requestedRole, treatment] = preset.split('.');
  const value = VISUAL_PRESETS[requestedRole]?.[treatment];
  return value ? { ok: true, role: requestedRole, treatment, changes: structuredClone(value) } : {
    ok: false,
    errors: [{ code: 'UNKNOWN_PRESET', message: `Unknown visual preset "${preset}"` }]
  };
}
