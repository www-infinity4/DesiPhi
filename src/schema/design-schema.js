export const SCHEMA_ID = 'desiphi.design';
export const SCHEMA_VERSION = 1;

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
    locks: { global: [], components: {} }
  };
}
