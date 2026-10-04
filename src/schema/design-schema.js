export const SCHEMA_ID = 'desiphi.design';
export const SCHEMA_VERSION = 2;

// Token groups a theme may provide.
export const TOKEN_GROUPS = ['colors', 'typography', 'spacing', 'shape', 'effects', 'motion'];

// Keys on a component that belong to LayaPhi (structure/content); DesiPhi never edits them.
export const STRUCTURAL_KEYS = ['id', 'type', 'layout'];

export function emptyDesign() {
  return {
    schema: SCHEMA_ID,
    version: SCHEMA_VERSION,
    theme: null,
    pageType: null,
    tokens: {},
    source: { components: [] },
    order: [],
    components: {},
    locks: { global: [], components: {} },
    designIntensity: {
      value: 50,
      categories: { motion: 50, decoration: 50, depth: 50, color: 50, typography: 50, imagery: 50 }
    },
    constraints: {
      maxAnimationsPerViewport: null,
      maximumTextWidth: null,
      minimumTouchTarget: null,
      minimumContrast: null,
      maximumDecorativeLayers: null,
      avoidHorizontalOverflow: false,
      reducedMotion: false,
      preserveContentVisibility: true,
      preserveLayaPhiStructure: true
    }
  };
}
