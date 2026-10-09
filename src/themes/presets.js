// Demonstrative, token-based presets. Not final Phi branding.
// Tokens only describe look/feel; themes never carry content.

const base = {
  spacing: { padding: '16px', gap: '16px', margin: '0' },
  motion: { enabled: true, transition: 'all 200ms ease', duration: 200, entrance: 'fade', hover: 'none', reducedMotion: 'disable' },
  effects: { shadow: 'none', glass: false, depth: 0 }
};

const make = (name, label, tokens) => ({ name, label, tokens });

export const PRESETS = {
  oracle: make('oracle', 'Oracle · Phi Daylight', {
    colors: { foreground:'#28183d', background:'#fbf9ff', surface:'#ffffff', accent:'#6b2db7', border:'#c9acdf' },
    typography: { fontFamily:'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize:'16px', fontWeight:500, lineHeight:1.6, letterSpacing:'0', align:'left', textWidth:'70ch' },
    spacing: { padding:'20px', gap:'16px', margin:'0' },
    shape: { radius:'24px', border:{ width:'1px', style:'solid', color:'#c9acdf' } },
    effects: { shadow:'0 12px 26px rgba(107,45,183,0.18)', glass:false, depth:2, glow:'0 0 18px rgba(132,65,223,0.25)' },
    motion: { ...base.motion, hover:'lift', reducedMotion:'disable', duration:160, transition:'all 160ms ease' }
  }),
  educational: make('educational', 'Educational', {
    colors: { foreground: '#1f2937', background: '#fffdf7', surface: '#ffffff', accent: '#2563eb', border: '#d6dbe4' },
    typography: { fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif', fontSize: '18px', fontWeight: 400, lineHeight: 1.6, letterSpacing: '0', align: 'left', textWidth: '70ch' },
    spacing: { padding: '20px', gap: '20px', margin: '0' },
    shape: { radius: '12px', border: { width: '1px', style: 'solid', color: '#d6dbe4' } },
    effects: { shadow: '0 2px 8px rgba(0,0,0,0.08)', glass: false, depth: 1 },
    motion: { ...base.motion, hover: 'lift' }
  }),
  editorial: make('editorial', 'Editorial', {
    colors: { foreground: '#111111', background: '#faf8f5', surface: '#ffffff', accent: '#b91c1c', border: '#111111' },
    typography: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '19px', fontWeight: 400, lineHeight: 1.7, letterSpacing: '0', align: 'left', textWidth: '65ch' },
    spacing: { padding: '24px', gap: '28px', margin: '0' },
    shape: { radius: '0', border: { width: '1px', style: 'solid', color: '#111111' } },
    effects: base.effects,
    motion: { ...base.motion, entrance: 'none', transition: 'none', duration: 0 }
  }),
  minimal: make('minimal', 'Minimal', {
    colors: { foreground: '#222222', background: '#ffffff', surface: '#f7f7f7', accent: '#444444', border: '#e5e5e5' },
    typography: { fontFamily: 'system-ui, sans-serif', fontSize: '17px', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0', align: 'left', textWidth: '68ch' },
    spacing: { padding: '16px', gap: '16px', margin: '0' },
    shape: { radius: '4px', border: { width: '1px', style: 'solid', color: '#e5e5e5' } },
    effects: base.effects,
    motion: { ...base.motion, entrance: 'none' }
  }),
  playful: make('playful', 'Playful', {
    colors: { foreground: '#2d1b4e', background: '#fff6e5', surface: '#ffffff', accent: '#e11d74', border: '#2d1b4e' },
    typography: { fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif', fontSize: '19px', fontWeight: 600, lineHeight: 1.6, letterSpacing: '0.2px', align: 'left', textWidth: '60ch' },
    spacing: { padding: '24px', gap: '24px', margin: '0' },
    shape: { radius: '28px', border: { width: '3px', style: 'solid', color: '#2d1b4e' } },
    effects: { shadow: '4px 4px 0 #2d1b4e', glass: false, depth: 2 },
    motion: { ...base.motion, entrance: 'scale', hover: 'scale', transition: 'all 300ms ease', duration: 300 }
  }),
  technical: make('technical', 'Technical', {
    colors: { foreground: '#e6edf3', background: '#0d1117', surface: '#161b22', accent: '#58a6ff', border: '#30363d' },
    typography: { fontFamily: '"SFMono-Regular", Consolas, monospace', fontSize: '16px', fontWeight: 400, lineHeight: 1.6, letterSpacing: '0', align: 'left', textWidth: '80ch' },
    spacing: { padding: '16px', gap: '16px', margin: '0' },
    shape: { radius: '6px', border: { width: '1px', style: 'solid', color: '#30363d' } },
    effects: { shadow: 'none', glass: false, depth: 0 },
    motion: { ...base.motion, entrance: 'none' }
  })
};
