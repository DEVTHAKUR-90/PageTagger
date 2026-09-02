/**
 * Paper Signal reminder: the page stays primary; this script adds a restrained editorial Margin Rail
 * with local-first, structured annotations. It is an original implementation, not a PageMarker derivative.
 */
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT_ID = "__annotaura-root__";
  const CONTROLLER_KEY = "__annotauraController__";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEFAULTS = { color: "#FFB000", width: 4, opacity: 0.72, railSide: "right", reducedMotion: false, theme: "paper" };
  const PALETTE = ["#18201E", "#FFB000", "#B84C3D", "#315F79", "#315E4B", "#6950A1"];
  const LAYERS = [
    { id: "marks", name: "Marks" },
    { id: "notes", name: "Notes" },
    { id: "evidence", name: "Evidence" },
  ];
  const TOOL_META = [
    ["select", "Select", "S"], ["pen", "Pen", "P"], ["highlight", "Highlight", "H"], ["text", "Text note", "T"],
    ["line", "Line", "L"], ["arrow", "Arrow", "A"], ["rect", "Rectangle", "R"], ["ellipse", "Ellipse", "O"],
    ["stamp", "Evidence stamp", "E"], ["browse", "Browse page", "B"],
  ];
  const DEFAULT_KEYBINDINGS = Object.fromEntries(TOOL_META.map(([id, , shortcut]) => [id, shortcut.toLowerCase()]));
  const RESERVED_KEYBINDINGS = new Set(["z", "y"]);
  const SAFE_BINDING_PATTERN = /^(?:(?:ctrl|meta)\+alt\+|alt\+)?[a-z]$/;

  if (document.getElementById(ROOT_ID)) {
    globalThis[CONTROLLER_KEY]?.close();
    return;
  }

  function uid(prefix = "ann") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function canonicalize(raw) {
    try {
      const url = new URL(raw);
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
      return url.toString();
    } catch {
      return raw;
    }
  }

  function projectKey() {
    return `annotaura:project:${canonicalize(location.href)}`;
  }

  function blankProject() {
    const now = new Date().toISOString();
    return {
      id: uid("page"), kind: "page", name: document.title || location.hostname || "Untitled page", tags: [], createdAt: now, updatedAt: now,
      source: { canonicalUrl: canonicalize(location.href), originalUrl: location.href, title: document.title || "Untitled page", domain: location.hostname || "Local page" },
      layers: LAYERS.map((layer) => ({ ...layer, visible: true, annotations: [] })),
    };
  }

  async function storeGet(key, fallback) {
    try {
      const result = await api.storage.local.get(key);
      return result[key] ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function storeSet(key, value) {
    return api.storage.local.set({ [key]: value });
  }

  async function storeRemove(key) {
    try { await api.storage.local.remove(key); } catch { /* best effort */ }
  }

  function escapeXml(value) {
    return String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[char]);
  }

  function point(event) {
    return { x: Math.round(event.clientX + window.scrollX), y: Math.round(event.clientY + window.scrollY) };
  }

  function documentSize() {
    const body = document.body;
    const doc = document.documentElement;
    return { width: Math.max(body?.scrollWidth || 0, doc.scrollWidth, doc.clientWidth), height: Math.max(body?.scrollHeight || 0, doc.scrollHeight, doc.clientHeight) };
  }

  function toolGlyph(id) {
    const icons = {
      select: "↗", pen: "✎", highlight: "━", text: "T", line: "╱", arrow: "➜", rect: "□", ellipse: "○", stamp: "#", browse: "⊙",
    };
    return icons[id] ?? "•";
  }

  function physicalLetter(event) {
    const physicalMatch = /^Key([A-Z])$/.exec(event.code || "");
    if (physicalMatch) return physicalMatch[1].toLowerCase();
    const key = event.key.toLowerCase();
    return /^[a-z]$/.test(key) ? key : null;
  }

  function bindingFromEvent(event) {
    const key = physicalLetter(event);
    if (!key || event.shiftKey || (event.ctrlKey && event.metaKey)) return null;
    if (event.ctrlKey || event.metaKey) return event.altKey ? `${event.metaKey ? "meta" : "ctrl"}+alt+${key}` : null;
    return event.altKey ? `alt+${key}` : key;
  }

  function bindingLabel(binding) {
    return String(binding).split("+").map((part) => ({ ctrl: "Ctrl", meta: "⌘", alt: "Alt" }[part] || part.toUpperCase())).join("+");
  }

  class AnnotauraSurface {
    constructor(settings, project) {
      this.settings = { ...DEFAULTS, ...settings };
      this.project = project;
      this.activeTool = "select";
      this.activeLayerId = "marks";
      this.selectedId = null;
      this.undoStack = [];
      this.redoStack = [];
      this.drawing = null;
      this.dragging = null;
      this.recordingTool = null;
      this.keybindingConflict = null;
      this.saveTimer = null;
      this.explicitlySaved = false;
      this.refreshFrame = 0;
      this.root = document.createElement("div");
      this.root.id = ROOT_ID;
      this.root.setAttribute("aria-live", "polite");
      this.root.dataset.theme = this.settings.theme === "night" ? "night" : "paper";
      this.shadow = this.root.attachShadow({ mode: "open" });
      document.body.appendChild(this.root);
      this.renderShell();
      this.bind();
      this.refresh();
      this.renderAll();
      this.snapshot(false);
      this.toast("Annotaura is ready — local annotations only.");
    }

    renderShell() {
      const side = this.settings.railSide === "left" ? "left" : "right";
      const tools = TOOL_META.map(([id, label]) => `<button class="tool" data-tool="${id}" title="${label} (${bindingLabel(this.shortcutFor(id))})" aria-label="${label}"><span class="tool-glyph">${toolGlyph(id)}</span><span class="tool-label">${label}</span><kbd>${bindingLabel(this.shortcutFor(id))}</kbd></button>`).join("");
      this.shadow.innerHTML = `
        <style>
          /* Paper Signal: editorial margins, ink-black controls, warm paper surfaces, Signal Saffron active state. */
          :host { all: initial; --aa-ink:#18201E; --aa-paper:#F6F0E4; --aa-paper-muted:#E9E2D4; --aa-muted:#5D625B; --aa-line:rgba(24,32,30,.2); --aa-shadow:rgba(10,18,16,.22); }
          :host([data-theme="night"]) { --aa-ink:#F6F0E4; --aa-paper:#18201E; --aa-paper-muted:#252D2B; --aa-muted:#B9C0B9; --aa-line:rgba(246,240,228,.22); --aa-shadow:rgba(0,0,0,.46); }
          *, *::before, *::after { box-sizing: border-box; }
          .surface { position: absolute; inset: 0 auto auto 0; z-index: 2147483646; pointer-events: none; width: 0; height: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--aa-ink); transition: color 180ms ease; }
          .overlay { position: absolute; inset: 0 auto auto 0; overflow: visible; pointer-events: auto; touch-action: none; }
          .overlay.browse { pointer-events: none; }
          .annotation { vector-effect: non-scaling-stroke; cursor: pointer; }
          .annotation[data-selected="true"] { filter: drop-shadow(0 0 2px #FFB000) drop-shadow(0 0 6px #FFB000); }
          .rail { position: fixed; z-index: 2147483647; top: 50%; ${side}: 16px; transform: translateY(-50%); width: 52px; background: color-mix(in srgb, var(--aa-paper) 98%, transparent); border: 1px solid var(--aa-line); box-shadow: 0 18px 44px var(--aa-shadow); pointer-events: auto; transition: width 180ms cubic-bezier(.23,1,.32,1), box-shadow 180ms cubic-bezier(.23,1,.32,1), background 180ms ease, border-color 180ms ease; overflow: hidden; }
          .rail:hover, .rail.is-expanded { width: 188px; box-shadow: 0 22px 55px var(--aa-shadow); }
          .rail::before { content: ""; display: block; height: 5px; background: #FFB000; }
          .rail-head { display: flex; align-items: center; min-width: 188px; height: 48px; border-bottom: 1px solid var(--aa-line); padding: 0 10px; gap: 9px; }
          .mark { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border: 2px solid var(--aa-ink); position: relative; font-size: 0; transition: border-color 180ms ease; }
          .mark::before { content: ""; position: absolute; width: 19px; height: 4px; transform: rotate(-40deg); background: #FFB000; }
          .brand { color: var(--aa-ink); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; transition: color 180ms ease; }
          .source { color: var(--aa-muted); display: block; font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 180ms ease; }
          .tool-list { display: grid; padding: 7px 0; min-width: 188px; }
          .tool { appearance: none; width: 100%; min-height: 34px; border: 0; background: transparent; color: var(--aa-ink); display: grid; grid-template-columns: 44px 1fr 24px; align-items: center; text-align: left; padding: 0 9px 0 0; cursor: pointer; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; transition: background 120ms ease, color 120ms ease; }
          .tool:hover { background: var(--aa-paper-muted); }
          .tool.is-active { background: var(--aa-ink); color: var(--aa-paper); }
          .tool.is-active .tool-glyph { color: #FFB000; }
          .tool-glyph { display: grid; place-items: center; font: 700 18px/1 ui-sans-serif, system-ui; }
          .tool-label { opacity: 0; transform: translateX(-4px); transition: opacity 130ms ease, transform 130ms ease; }
          .rail:hover .tool-label, .rail.is-expanded .tool-label { opacity: 1; transform: translateX(0); }
          kbd { opacity: 0; justify-self: end; font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: inherit; border: 1px solid currentColor; padding: 2px 4px; }
          .rail:hover kbd, .rail.is-expanded kbd { opacity: .72; }
          .rail-footer { min-width: 188px; padding: 7px; border-top: 1px solid var(--aa-line); display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
          .rail-footer button, .actions button { appearance: none; border: 1px solid var(--aa-line); background: var(--aa-paper); min-height: 28px; color: var(--aa-ink); cursor: pointer; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; transition: background 120ms ease, transform 120ms ease, color 180ms ease, border-color 180ms ease; }
          .rail-footer button:hover, .actions button:hover { background: #FFB000; }
          .rail-footer button:active, .actions button:active { transform: scale(.97); }.rail-footer button:disabled { cursor:not-allowed; opacity:.35; }.rail-footer button:disabled:hover { background:var(--aa-paper); }
          .context { position: fixed; z-index: 2147483647; ${side}: 68px; top: 16px; width: 238px; min-width:200px; min-height:160px; max-width:min(92vw,480px); max-height:calc(100vh - 32px); overflow:auto; padding: 14px; background: color-mix(in srgb, var(--aa-paper) 98%, transparent); border: 1px solid var(--aa-line); box-shadow: 0 16px 34px var(--aa-shadow); pointer-events: none; opacity: 0; transform:translateX(${side === "right" ? "10px" : "-10px"}) translateY(-2px) scale(.98); transform-origin:top ${side}; visibility: hidden; transition: opacity 180ms cubic-bezier(.23,1,.32,1), transform 220ms cubic-bezier(.23,1,.32,1), visibility 0s linear 220ms, background 180ms ease, border-color 180ms ease; }
          .context.is-open { pointer-events:auto; opacity: 1; transform:translateX(0) translateY(0) scale(1); visibility: visible; transition-delay:0s; }
          .context.is-dragging, .context.is-resizing { transition: none; user-select: none; }
          .context-drag { display:flex; align-items:center; gap:8px; margin:-14px -14px 10px; padding:9px 14px; cursor:grab; border-bottom:1px solid var(--aa-line); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--aa-muted); touch-action:none; }
          .context-drag:active { cursor:grabbing; }
          .context-drag span:first-child { letter-spacing:.18em; }
          .context-resize { position:absolute; right:2px; bottom:2px; width:16px; height:16px; cursor:nwse-resize; touch-action:none; opacity:.5; }
          .context-resize::after { content:""; position:absolute; right:3px; bottom:3px; width:8px; height:8px; border-right:2px solid var(--aa-muted); border-bottom:2px solid var(--aa-muted); }
          .context-resize:hover { opacity:1; }
          .context h2 { margin: 0 0 10px; color: var(--aa-ink); font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; transition: color 180ms ease; }
          .context-row { display: flex; align-items: center; gap: 7px; margin: 8px 0; }
          .context label { color: var(--aa-muted); font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; transition: color 180ms ease; }
          .context input[type="range"] { width: 100%; accent-color: #FFB000; }.color-picker-row { display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; margin:8px 0; }.color-picker-row label { color:var(--aa-muted); font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; }.color-picker { width:34px; height:26px; padding:2px; border:1px solid var(--aa-line); background:var(--aa-paper); cursor:pointer; }.range-value { min-width:34px; color:var(--aa-ink); text-align:right; font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
          .context button { appearance:none; min-height:28px; border:1px solid var(--aa-line); padding:5px 7px; color:var(--aa-ink); background:var(--aa-paper); cursor:pointer; font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace; transition:transform 120ms ease,background 120ms ease,color 180ms ease,border-color 180ms ease; }
          .context button:hover { background:#FFB000; color:#18201E; }
          .context button:active { transform:scale(.97); }
          .shortcut-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; margin-top:8px; }.shortcut-toggle b { font-size:12px; line-height:1; transition:transform 180ms cubic-bezier(.23,1,.32,1); }.shortcut-toggle[aria-expanded="true"] b { transform:rotate(45deg); }
          .shortcut-panel { display:none; grid-template-columns:1fr 1fr; gap:6px 10px; margin-top:7px; padding:8px; border:1px dashed var(--aa-line); background:color-mix(in srgb,var(--aa-paper-muted) 60%,transparent); opacity:0; transform:translateY(-4px) scale(.99); }.shortcut-panel.is-open { display:grid; animation:shortcut-panel-in 180ms cubic-bezier(.23,1,.32,1) forwards; }.shortcut-group { min-width:0; }.shortcut-group h3 { grid-column:1 / -1; margin:0 0 5px; color:var(--aa-muted); font:700 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.09em; text-transform:uppercase; }.shortcut-row { display:flex; align-items:center; justify-content:space-between; gap:5px; min-height:20px; color:var(--aa-muted); font:9px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace; }.shortcut-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.shortcut-panel kbd { opacity:1; flex:0 0 auto; padding:2px 3px; color:var(--aa-ink); background:var(--aa-paper); border-color:var(--aa-line); font-size:8px; }.shortcut-row kbd + kbd { margin-left:-4px; }
          .keybinding-editor-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; margin-top:6px; }.keybinding-editor-toggle b { font-size:12px; line-height:1; transition:transform 180ms cubic-bezier(.23,1,.32,1); }.keybinding-editor-toggle[aria-expanded="true"] b { transform:rotate(45deg); }.keybinding-editor { display:none; gap:5px; margin-top:7px; padding:8px; border:1px dashed var(--aa-line); background:color-mix(in srgb,var(--aa-paper-muted) 60%,transparent); }.keybinding-editor.is-open { display:grid; animation:shortcut-panel-in 180ms cubic-bezier(.23,1,.32,1) forwards; }.keybinding-help { margin:0 0 3px; color:var(--aa-muted); font:8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; }.keybinding-conflict { display:grid; gap:6px; margin:0; padding:6px; color:#FEF7EF; background:#8C382E; border-left:3px solid #FFB000; font:700 8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; animation:shortcut-panel-in 120ms cubic-bezier(.23,1,.32,1) both; }.keybinding-swap { width:100%; color:#18201E !important; background:#FFB000 !important; }.keybinding-fields { display:grid; grid-template-columns:1fr; gap:4px; }.keybinding-field { display:flex; align-items:center; justify-content:space-between; min-width:0; gap:8px; color:var(--aa-muted); font:9px/1.1 ui-sans-serif,system-ui,sans-serif; }.keybinding-field span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.keybind-input { min-width:74px; padding:5px 6px !important; color:var(--aa-ink) !important; background:var(--aa-paper) !important; text-align:center; }.keybind-input.is-recording { color:#18201E !important; background:#FFB000 !important; }.keybind-input.has-conflict { outline:2px solid #B84C3D; outline-offset:1px; }.keybinding-reset { width:100%; margin-top:3px; }.keybinding-error { color:#B84C3D; }
          @keyframes shortcut-panel-in { from { opacity:0; transform:translateY(-4px) scale(.99); } to { opacity:1; transform:translateY(0) scale(1); } }
          .menu-section { opacity:0; transform:translateY(-4px); transition:opacity 160ms cubic-bezier(.23,1,.32,1),transform 180ms cubic-bezier(.23,1,.32,1); }
          .context.is-open .menu-section { opacity:1; transform:translateY(0); }
          .context.is-open .menu-section:nth-of-type(1) { transition-delay:35ms; }.context.is-open .menu-section:nth-of-type(2) { transition-delay:65ms; }.context.is-open .menu-section:nth-of-type(3) { transition-delay:95ms; }.context.is-open .menu-section:nth-of-type(4) { transition-delay:125ms; }
          .swatches { display: flex; gap: 7px; flex-wrap: wrap; }
          .swatch { appearance: none; width: 22px; height: 22px; border: 2px solid var(--aa-paper); outline: 1px solid var(--aa-line); cursor: pointer; }
          .swatch.is-active { outline: 2px solid var(--aa-ink); outline-offset: 2px; }
          .layers { display: grid; gap: 5px; }
          .layer { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-top: 1px dashed var(--aa-line); }.layer.is-active button:first-child { color:#B84C3D; }
          .layer button { appearance: none; border: 0; background: none; padding: 0; color: var(--aa-ink); cursor: pointer; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; }
          .layer .layer-toggle { color: var(--aa-muted); font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
          .actions { position: fixed; bottom: 18px; left: 50%; z-index: 2147483647; display: flex; gap: 5px; padding: 6px; transform:translateX(-50%) translateY(8px) scale(.98); background: var(--aa-ink); box-shadow: 0 12px 30px var(--aa-shadow); pointer-events: none; opacity:0; visibility:hidden; transition:opacity 160ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 0s linear 180ms; }
          .actions.is-visible { pointer-events:auto; opacity:1; visibility:visible; transform:translateX(-50%) translateY(0) scale(1); transition-delay:0s; }
          .actions button { background: transparent; border-color: color-mix(in srgb, var(--aa-paper) 40%, transparent); color: var(--aa-paper); padding: 0 8px; }.actions button:hover { color: #18201E; }
          .text-editor { position: fixed; z-index: 2147483647; width: 230px; display: none; background: var(--aa-paper); border: 1px solid var(--aa-ink); box-shadow: 0 16px 34px var(--aa-shadow); pointer-events: auto; }.text-editor.is-open { display: block; }
          .text-editor textarea { display: block; width: 100%; min-height: 72px; resize: vertical; border: 0; outline: none; background: transparent; color: var(--aa-ink); padding: 10px; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; }.text-editor textarea::placeholder { color:var(--aa-muted); }
          .text-editor footer { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-top: 1px solid var(--aa-line); color: var(--aa-muted); font: 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }.text-editor button { appearance: none; border: 0; background: #FFB000; color: #18201E; padding: 5px 8px; cursor: pointer; font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
          .toast { position: fixed; z-index: 2147483647; bottom: 20px; ${side}: 18px; max-width: 285px; padding: 10px 12px; color: var(--aa-paper); background: var(--aa-ink); box-shadow: 0 16px 34px var(--aa-shadow); pointer-events: none; font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; opacity: 0; transform: translateY(6px); transition: opacity 160ms ease, transform 160ms ease, background 180ms ease, color 180ms ease; }
          .toast.is-visible { opacity: 1; transform: translateY(0); }
          button:focus-visible, textarea:focus-visible { outline: 2px solid #FFB000; outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation:none !important; } .context { transform:none; } }
        </style>
        <div class="surface" data-theme="${this.settings.theme === "night" ? "night" : "paper"}"><svg class="overlay" aria-label="Annotaura annotation layer" role="application"><defs><marker id="annotaura-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--aa-ink)"></path></marker></defs><g class="annotation-layer"></g></svg></div>
        <aside class="rail" aria-label="Annotaura tools"><div class="rail-head"><span class="mark" aria-hidden="true"></span><span><strong class="brand">Annotaura</strong><span class="source">${escapeXml(location.hostname || "Local page")}</span></span></div><div class="tool-list">${tools}</div><div class="rail-footer"><button data-action="undo" aria-label="Undo last annotation change" disabled>Undo</button><button data-action="redo" aria-label="Redo annotation change" disabled>Redo</button><button data-action="menu" aria-label="Open settings and layers" aria-expanded="false">Menu</button></div></aside>
        <section class="context" aria-label="Annotaura settings"><div class="context-drag" data-drag-handle><span aria-hidden="true">⠿⠿</span><span>Drag to move</span></div><div class="menu-section"><h2>Appearance</h2><button class="theme-toggle" data-action="theme" aria-pressed="${this.settings.theme === "night"}"><span data-theme-label>${this.settings.theme === "night" ? "Night mode on" : "Paper mode on"}</span> <span aria-hidden="true">◐</span></button></div><div class="menu-section"><h2 style="margin-top:16px">Margin controls</h2><div class="context-row"><label for="aa-width">Weight</label><input id="aa-width" type="range" min="1" max="24" value="${this.settings.width}"><output class="range-value" data-width-value>${this.settings.width}px</output></div><div class="context-row"><label for="aa-opacity">Opacity</label><input id="aa-opacity" type="range" min="10" max="100" value="${Math.round(this.settings.opacity * 100)}"><output class="range-value" data-opacity-value>${Math.round(this.settings.opacity * 100)}%</output></div><div class="color-picker-row"><label for="aa-color">Custom color</label><input id="aa-color" class="color-picker" type="color" value="${this.settings.color}" aria-label="Choose annotation color"></div><div class="swatches">${PALETTE.map((color) => `<button class="swatch${color === this.settings.color ? " is-active" : ""}" data-color="${color}" style="background:${color}" aria-label="Use ${color}"></button>`).join("")}</div><button class="shortcut-toggle" data-action="shortcuts" aria-expanded="false" aria-controls="annotaura-shortcuts"><span>Keyboard shortcuts</span><b aria-hidden="true">+</b></button><div id="annotaura-shortcuts" class="shortcut-panel" aria-hidden="true"><div class="shortcut-group"><h3>Tools</h3><div class="shortcut-row"><span>Select · Pen</span><kbd>S</kbd><kbd>P</kbd></div><div class="shortcut-row"><span>Highlight · Note</span><kbd>H</kbd><kbd>T</kbd></div><div class="shortcut-row"><span>Line · Arrow</span><kbd>L</kbd><kbd>A</kbd></div><div class="shortcut-row"><span>Rect · Ellipse</span><kbd>R</kbd><kbd>O</kbd></div><div class="shortcut-row"><span>Stamp · Browse</span><kbd>E</kbd><kbd>B</kbd></div></div><div class="shortcut-group"><h3>Actions</h3><div class="shortcut-row"><span>Undo</span><kbd>⌘/Ctrl Z</kbd></div><div class="shortcut-row"><span>Redo</span><kbd>⌘/Ctrl ⇧Z</kbd></div><div class="shortcut-row"><span>Delete mark</span><kbd>Del</kbd></div><div class="shortcut-row"><span>Cancel / done</span><kbd>Esc</kbd></div><div class="shortcut-row"><span>Toggle Annotaura</span><kbd>Alt ⇧A</kbd></div></div></div></div><div class="menu-section"><h2 style="margin-top:16px">Working template</h2><div class="context-row"><button data-template="Research" style="flex:1">Research</button><button data-template="Review" style="flex:1">Review</button><button data-template="Teaching" style="flex:1">Teaching</button></div><h2 style="margin-top:16px">Layers</h2><div class="layers"></div></div><div class="menu-section"><h2 style="margin-top:16px">Archive</h2><div class="context-row"><button data-action="save" style="flex:1">Save local</button><button data-action="workspace" style="flex:1">Workspace</button></div><div class="context-row"><button data-action="export-json" style="flex:1">Export JSON</button><button data-action="capture" style="flex:1">Capture view</button></div><div class="context-row"><button data-action="clear-layer" style="flex:1">Clear layer</button><button data-action="close" style="flex:1">Close</button></div></div><div class="context-resize" data-resize-handle aria-hidden="true"></div></section>
        <div class="actions" aria-label="Selection actions"><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button><button data-action="deselect">Done</button></div>
        <form class="text-editor" aria-label="Add text note"><textarea placeholder="Write a note…" aria-label="Annotation text"></textarea><footer><span>Ctrl/⌘ + Enter saves</span><button type="submit">Place note</button></footer></form>
        <div class="toast" role="status"></div>`;
      this.el = {
        surface: this.shadow.querySelector(".surface"), svg: this.shadow.querySelector(".overlay"), layer: this.shadow.querySelector(".annotation-layer"), rail: this.shadow.querySelector(".rail"),
        context: this.shadow.querySelector(".context"), dragHandle: this.shadow.querySelector("[data-drag-handle]"), resizeHandle: this.shadow.querySelector("[data-resize-handle]"), menuButton: this.shadow.querySelector("[data-action=menu]"), undoButton: this.shadow.querySelector("[data-action=undo]"), redoButton: this.shadow.querySelector("[data-action=redo]"), themeButton: this.shadow.querySelector("[data-action=theme]"), themeLabel: this.shadow.querySelector("[data-theme-label]"), shortcutsButton: this.shadow.querySelector("[data-action=shortcuts]"), shortcutsPanel: this.shadow.querySelector("#annotaura-shortcuts"), layers: this.shadow.querySelector(".layers"), actions: this.shadow.querySelector(".actions"), editor: this.shadow.querySelector(".text-editor"), textarea: this.shadow.querySelector("textarea"), toast: this.shadow.querySelector(".toast"),
      };
      this.el.shortcutsPanel.insertAdjacentHTML("afterend", `<button class="keybinding-editor-toggle" data-action="keybinding-editor" aria-expanded="false" aria-controls="annotaura-keybinding-editor"><span>Customize tool keys</span><b aria-hidden="true">+</b></button><div id="annotaura-keybinding-editor" class="keybinding-editor" aria-hidden="true"></div>`);
      this.el.keybindingEditorButton = this.shadow.querySelector("[data-action=keybinding-editor]");
      this.el.keybindingEditor = this.shadow.querySelector("#annotaura-keybinding-editor");
      this.applyPanelRect();
    }

    applyPanelRect() {
      const rect = this.settings.panelRect;
      if (!rect) return;
      Object.assign(this.el.context.style, { left: `${rect.left}px`, top: `${rect.top}px`, right: "auto", width: `${rect.width}px`, height: `${rect.height}px` });
    }

    clampPanelRect(left, top, width, height) {
      const minWidth = 200, minHeight = 160, margin = 8;
      const clampedWidth = Math.min(Math.max(width, minWidth), window.innerWidth - margin * 2);
      const clampedHeight = Math.min(Math.max(height, minHeight), window.innerHeight - margin * 2);
      const clampedLeft = Math.min(Math.max(left, margin), window.innerWidth - clampedWidth - margin);
      const clampedTop = Math.min(Math.max(top, margin), window.innerHeight - clampedHeight - margin);
      return { left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight };
    }

    bindPanelDragAndResize() {
      this.el.dragHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startRect = this.el.context.getBoundingClientRect();
        const origin = { x: event.clientX, y: event.clientY, left: startRect.left, top: startRect.top, width: startRect.width, height: startRect.height };
        this.el.context.classList.add("is-dragging");
        this.el.dragHandle.setPointerCapture?.(event.pointerId);
        const onMove = (moveEvent) => {
          const next = this.clampPanelRect(origin.left + (moveEvent.clientX - origin.x), origin.top + (moveEvent.clientY - origin.y), origin.width, origin.height);
          Object.assign(this.el.context.style, { left: `${next.left}px`, top: `${next.top}px`, right: "auto", width: `${next.width}px` });
        };
        const onUp = () => {
          this.el.context.classList.remove("is-dragging");
          this.el.dragHandle.removeEventListener("pointermove", onMove);
          this.el.dragHandle.removeEventListener("pointerup", onUp);
          const finalRect = this.el.context.getBoundingClientRect();
          this.settings.panelRect = { left: finalRect.left, top: finalRect.top, width: finalRect.width, height: finalRect.height };
          this.persistSettings();
        };
        this.el.dragHandle.addEventListener("pointermove", onMove);
        this.el.dragHandle.addEventListener("pointerup", onUp, { once: true });
      });

      this.el.resizeHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startRect = this.el.context.getBoundingClientRect();
        const origin = { x: event.clientX, y: event.clientY, left: startRect.left, top: startRect.top, width: startRect.width, height: startRect.height };
        this.el.context.classList.add("is-resizing");
        this.el.resizeHandle.setPointerCapture?.(event.pointerId);
        const onMove = (moveEvent) => {
          const next = this.clampPanelRect(origin.left, origin.top, origin.width + (moveEvent.clientX - origin.x), origin.height + (moveEvent.clientY - origin.y));
          Object.assign(this.el.context.style, { left: `${next.left}px`, top: `${next.top}px`, right: "auto", width: `${next.width}px`, height: `${next.height}px` });
        };
        const onUp = () => {
          this.el.context.classList.remove("is-resizing");
          this.el.resizeHandle.removeEventListener("pointermove", onMove);
          this.el.resizeHandle.removeEventListener("pointerup", onUp);
          const finalRect = this.el.context.getBoundingClientRect();
          this.settings.panelRect = { left: finalRect.left, top: finalRect.top, width: finalRect.width, height: finalRect.height };
          this.persistSettings();
        };
        this.el.resizeHandle.addEventListener("pointermove", onMove);
        this.el.resizeHandle.addEventListener("pointerup", onUp, { once: true });
      });
    }

    bind() {
      this.bindPanelDragAndResize();
      this.el.rail.addEventListener("mouseenter", () => this.el.rail.classList.add("is-expanded"));
      this.el.rail.addEventListener("mouseleave", () => this.el.rail.classList.remove("is-expanded"));
      this.shadow.addEventListener("click", (event) => this.handleControlClick(event));
      this.el.svg.addEventListener("pointerdown", (event) => this.pointerDown(event));
      this.el.svg.addEventListener("pointermove", (event) => this.pointerMove(event));
      this.el.svg.addEventListener("pointerup", (event) => this.pointerUp(event));
      this.el.svg.addEventListener("pointercancel", () => this.endGesture());
      this.el.editor.addEventListener("submit", (event) => { event.preventDefault(); this.commitText(); });
      this.el.textarea.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); this.commitText(); } if (event.key === "Escape") this.cancelText(); });
      this.shadow.querySelector("#aa-width").addEventListener("input", (event) => { this.settings.width = Number(event.target.value); this.shadow.querySelector("[data-width-value]").textContent = `${this.settings.width}px`; this.persistSettings(); });
      this.shadow.querySelector("#aa-opacity").addEventListener("input", (event) => { this.settings.opacity = Number(event.target.value) / 100; this.shadow.querySelector("[data-opacity-value]").textContent = `${Math.round(this.settings.opacity * 100)}%`; this.persistSettings(); });
      this.shadow.querySelector("#aa-color").addEventListener("input", (event) => { this.settings.color = String(event.target.value).toUpperCase(); this.persistSettings(); this.renderControls(); });
      document.addEventListener("keydown", this.onKeydown, true);
      window.addEventListener("resize", this.refresh);
      window.addEventListener("scroll", this.refresh, { passive: true });
      window.visualViewport?.addEventListener("resize", this.refresh, { passive: true });
      this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(this.refresh) : null;
      this.resizeObserver?.observe(document.documentElement);
    }

    onKeydown = (event) => {
      if (this.el.textarea === this.shadow.activeElement || this.el.textarea.matches(":focus")) return;
      const pageFocus = document.activeElement;
      if (pageFocus && pageFocus !== this.root) {
        const tag = pageFocus.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || pageFocus.isContentEditable) return;
      }
      if (this.recordingTool) { this.captureKeybinding(event); return; }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && physicalLetter(event) === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && physicalLetter(event) === "y") { event.preventDefault(); this.redo(); return; }
      if (event.key === "?") { event.preventDefault(); this.toggleMenu(true); this.toggleShortcuts(true); return; }
      if (event.key === "Escape") { event.preventDefault(); this.close(); return; }
      if ((event.key === "Backspace" || event.key === "Delete") && this.selectedId) { event.preventDefault(); this.deleteSelected(); return; }
      const binding = bindingFromEvent(event);
      const tool = binding ? TOOL_META.find(([toolId]) => this.shortcutFor(toolId) === binding)?.[0] : null;
      if (tool) { event.preventDefault(); this.selectTool(tool); }
    };

    refresh = () => {
      if (this.refreshFrame) return;
      this.refreshFrame = requestAnimationFrame(() => {
        this.refreshFrame = 0;
        const { width, height } = documentSize();
        this.el.surface.style.width = `${width}px`;
        this.el.surface.style.height = `${height}px`;
        this.el.svg.setAttribute("width", String(width));
        this.el.svg.setAttribute("height", String(height));
        this.el.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      });
    };

    activeLayer() { return this.project.layers.find((layer) => layer.id === this.activeLayerId) ?? this.project.layers[0]; }
    allAnnotations() { return this.project.layers.flatMap((layer) => layer.annotations.map((annotation) => ({ ...annotation, layerId: layer.id }))); }
    findAnnotation(id) { return this.allAnnotations().find((annotation) => annotation.id === id); }

    handleControlClick(event) {
      const toolButton = event.target.closest("[data-tool]");
      if (toolButton) { this.selectTool(toolButton.dataset.tool); return; }
      const colorButton = event.target.closest("[data-color]");
      if (colorButton) { this.settings.color = colorButton.dataset.color; this.persistSettings(); this.renderControls(); return; }
      const keybindingButton = event.target.closest("[data-keybinding]");
      if (keybindingButton) { this.beginKeybindingCapture(keybindingButton.dataset.keybinding); return; }
      const templateButton = event.target.closest("[data-template]");
      if (templateButton) { this.applyTemplate(templateButton.dataset.template); return; }
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) this.perform(actionButton.dataset.action);
      const layerButton = event.target.closest("[data-layer]");
      if (layerButton) { this.activeLayerId = layerButton.dataset.layer; this.renderControls(); }
      const layerToggle = event.target.closest("[data-layer-toggle]");
      if (layerToggle) { const layer = this.project.layers.find((item) => item.id === layerToggle.dataset.layerToggle); if (layer) { layer.visible = !layer.visible; this.persistSoon(); this.renderAll(); } }
    }

    perform(action) {
      const actions = {
        undo: () => this.undo(), redo: () => this.redo(), menu: () => this.toggleMenu(), theme: () => this.toggleTheme(), shortcuts: () => this.toggleShortcuts(), "keybinding-editor": () => this.toggleKeybindingEditor(), "reset-keybindings": () => this.resetKeybindings(), "swap-keybinding": () => this.swapKeybinding(), save: () => this.persist(true), workspace: () => api.runtime.sendMessage({ type: "annotaura:open-workspace" }),
        "export-json": () => this.exportJson(), capture: () => this.captureVisible(), "clear-layer": () => this.clearLayer(), close: () => this.close(), duplicate: () => this.duplicateSelected(), delete: () => this.deleteSelected(), deselect: () => this.deselect(),
      };
      actions[action]?.();
    }

    toggleMenu(force) {
      const shouldOpen = typeof force === "boolean" ? force : !this.el.context.classList.contains("is-open");
      this.el.context.classList.toggle("is-open", shouldOpen);
      this.el.rail.classList.toggle("is-expanded", shouldOpen);
      this.el.menuButton.setAttribute("aria-expanded", String(shouldOpen));
      if (!shouldOpen) { this.toggleShortcuts(false); this.toggleKeybindingEditor(false); }
    }

    toggleShortcuts(force) {
      const shouldOpen = typeof force === "boolean" ? force : !this.el.shortcutsPanel.classList.contains("is-open");
      this.el.shortcutsPanel.classList.toggle("is-open", shouldOpen);
      this.el.shortcutsPanel.setAttribute("aria-hidden", String(!shouldOpen));
      this.el.shortcutsButton.setAttribute("aria-expanded", String(shouldOpen));
    }

    shortcutFor(tool) {
      const candidate = this.settings.keybindings?.[tool];
      return SAFE_BINDING_PATTERN.test(candidate || "") && !RESERVED_KEYBINDINGS.has(candidate) ? candidate : DEFAULT_KEYBINDINGS[tool];
    }

    keybindingRowsMarkup() {
      return TOOL_META.map(([id, label]) => `<div class="shortcut-row"><span>${label}</span><kbd data-shortcut="${id}">${bindingLabel(this.shortcutFor(id))}</kbd></div>`).join("");
    }

    keybindingEditorMarkup() {
      const conflictForRecording = this.keybindingConflict && this.recordingTool ? this.keybindingConflict : null;
      const fields = TOOL_META.map(([id, label]) => `<div class="keybinding-field"><span>${label}</span><button class="keybind-input${this.recordingTool === id ? " is-recording" : ""}${this.recordingTool === id && conflictForRecording ? " has-conflict" : ""}" data-keybinding="${id}" aria-label="Set keyboard shortcut for ${label}">${this.recordingTool === id ? bindingLabel(conflictForRecording?.binding || "Press keys") : bindingLabel(this.shortcutFor(id))}</button></div>`).join("");
      const message = this.recordingTool ? `Press a letter, Alt+letter, or Ctrl/⌘+Alt+letter for ${TOOL_META.find(([id]) => id === this.recordingTool)?.[1]}. Esc cancels.` : "Choose a tool key, then press a letter, Alt+letter, or Ctrl/⌘+Alt+letter. Z and Y stay reserved.";
      const warning = conflictForRecording ? `<div class="keybinding-conflict" role="alert"><span>${bindingLabel(conflictForRecording.binding)} is already assigned to ${TOOL_META.find(([id]) => id === conflictForRecording.tool)?.[1]}. Choose a different shortcut or exchange the two keys.</span><button class="keybinding-swap" data-action="swap-keybinding">Swap with ${TOOL_META.find(([id]) => id === conflictForRecording.tool)?.[1]}</button></div>` : "";
      return `<p class="keybinding-help${this.recordingTool ? " keybinding-error" : ""}">${message}</p>${warning}<div class="keybinding-fields">${fields}</div><button class="keybinding-reset" data-action="reset-keybindings">Restore defaults</button>`;
    }

    renderKeybindingPanels() {
      this.el.shortcutsPanel.innerHTML = `<div class="shortcut-group"><h3>Tools</h3>${this.keybindingRowsMarkup()}</div><div class="shortcut-group"><h3>Actions</h3><div class="shortcut-row"><span>Undo</span><kbd>⌘/Ctrl Z</kbd></div><div class="shortcut-row"><span>Redo</span><kbd>⌘/Ctrl ⇧Z</kbd></div><div class="shortcut-row"><span>Delete mark</span><kbd>Del</kbd></div><div class="shortcut-row"><span>Cancel / done</span><kbd>Esc</kbd></div><div class="shortcut-row"><span>Toggle Annotaura</span><kbd>Alt ⇧A</kbd></div></div>`;
      this.el.keybindingEditor.innerHTML = this.keybindingEditorMarkup();
    }

    toggleKeybindingEditor(force) {
      const shouldOpen = typeof force === "boolean" ? force : !this.el.keybindingEditor.classList.contains("is-open");
      if (!shouldOpen) { this.recordingTool = null; this.keybindingConflict = null; }
      this.el.keybindingEditor.classList.toggle("is-open", shouldOpen);
      this.el.keybindingEditor.setAttribute("aria-hidden", String(!shouldOpen));
      this.el.keybindingEditorButton.setAttribute("aria-expanded", String(shouldOpen));
      this.renderKeybindingPanels();
    }

    beginKeybindingCapture(tool) {
      this.recordingTool = tool;
      this.keybindingConflict = null;
      this.renderKeybindingPanels();
      this.toast(`Press a shortcut for ${TOOL_META.find(([id]) => id === tool)?.[1]}; Escape cancels.`);
    }

    captureKeybinding(event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") { this.recordingTool = null; this.keybindingConflict = null; this.renderKeybindingPanels(); this.toast("Shortcut change cancelled."); return; }
      const binding = bindingFromEvent(event);
      if (!binding) { this.toast("Use a letter, Alt+letter, or Ctrl/⌘+Alt+letter."); return; }
      if (RESERVED_KEYBINDINGS.has(binding)) { this.keybindingConflict = null; this.renderKeybindingPanels(); this.toast(`${bindingLabel(binding)} is reserved for undo or redo.`); return; }
      const conflictingTool = TOOL_META.find(([tool]) => tool !== this.recordingTool && this.shortcutFor(tool) === binding)?.[0];
      if (conflictingTool) { this.keybindingConflict = { binding, tool: conflictingTool }; this.renderKeybindingPanels(); this.toast(`${bindingLabel(binding)} is already used by ${TOOL_META.find(([tool]) => tool === conflictingTool)?.[1]}.`); return; }
      const tool = this.recordingTool;
      this.settings.keybindings = { ...(this.settings.keybindings || {}), [tool]: binding };
      this.recordingTool = null;
      this.keybindingConflict = null;
      this.persistSettings();
      this.renderControls();
      this.toast(`${TOOL_META.find(([id]) => id === tool)?.[1]} now uses ${bindingLabel(binding)}.`);
    }

    swapKeybinding() {
      const conflict = this.keybindingConflict;
      const currentTool = this.recordingTool;
      if (!conflict || !currentTool || conflict.tool === currentTool) return;
      const currentBinding = this.shortcutFor(currentTool);
      this.settings.keybindings = { ...(this.settings.keybindings || {}), [currentTool]: conflict.binding, [conflict.tool]: currentBinding };
      this.recordingTool = null;
      this.keybindingConflict = null;
      this.persistSettings();
      this.renderControls();
      this.toast(`${TOOL_META.find(([id]) => id === currentTool)?.[1]} and ${TOOL_META.find(([id]) => id === conflict.tool)?.[1]} shortcuts swapped.`);
    }

    resetKeybindings() {
      this.recordingTool = null;
      this.keybindingConflict = null;
      delete this.settings.keybindings;
      this.persistSettings();
      this.renderControls();
      this.toast("Tool shortcuts restored to defaults.");
    }

    toggleTheme() {
      this.settings.theme = this.settings.theme === "night" ? "paper" : "night";
      this.el.surface.dataset.theme = this.settings.theme;
      this.root.dataset.theme = this.settings.theme;
      this.persistSettings();
      this.renderControls();
      this.toast(this.settings.theme === "night" ? "Night mode is on." : "Paper mode is on.");
    }

    selectTool(tool) {
      this.activeTool = tool;
      this.deselect();
      this.el.svg.classList.toggle("browse", tool === "browse");
      this.el.svg.style.cursor = tool === "browse" ? "default" : tool === "text" ? "text" : tool === "select" ? "default" : "crosshair";
      this.renderControls();
      this.toast(`${TOOL_META.find((item) => item[0] === tool)?.[1] ?? tool} selected`);
    }

    applyTemplate(template) {
      const templates = {
        Research: { color: "#FFB000", width: 4, opacity: .72, tool: "highlight" },
        Review: { color: "#B84C3D", width: 3, opacity: .92, tool: "arrow" },
        Teaching: { color: "#315F79", width: 5, opacity: .78, tool: "pen" },
      };
      const chosen = templates[template];
      if (!chosen) return;
      this.settings = { ...this.settings, color: chosen.color, width: chosen.width, opacity: chosen.opacity, defaultTemplate: template };
      this.persistSettings();
      this.selectTool(chosen.tool);
      this.renderControls();
      this.toast(`${template} template applied.`);
    }

    renderControls() {
      const canUndo = this.undoStack.length > 1;
      const canRedo = this.redoStack.length > 0;
      this.el.undoButton.disabled = !canUndo;
      this.el.redoButton.disabled = !canRedo;
      this.el.undoButton.setAttribute("aria-label", canUndo ? "Undo last annotation change" : "Nothing to undo");
      this.el.redoButton.setAttribute("aria-label", canRedo ? "Redo annotation change" : "Nothing to redo");
      this.shadow.querySelectorAll("[data-tool]").forEach((button) => {
        const [ , label] = TOOL_META.find(([id]) => id === button.dataset.tool) || [];
        const shortcut = bindingLabel(this.shortcutFor(button.dataset.tool));
        button.classList.toggle("is-active", button.dataset.tool === this.activeTool);
        button.title = `${label} (${shortcut})`;
        button.querySelector("kbd").textContent = shortcut;
      });
      this.shadow.querySelectorAll("[data-color]").forEach((button) => button.classList.toggle("is-active", button.dataset.color === this.settings.color));
      this.shadow.querySelector("#aa-width").value = this.settings.width;
      this.shadow.querySelector("#aa-opacity").value = Math.round(this.settings.opacity * 100);
      this.shadow.querySelector("#aa-color").value = this.settings.color;
      this.shadow.querySelector("[data-width-value]").textContent = `${this.settings.width}px`;
      this.shadow.querySelector("[data-opacity-value]").textContent = `${Math.round(this.settings.opacity * 100)}%`;
      this.el.surface.dataset.theme = this.settings.theme === "night" ? "night" : "paper";
      this.root.dataset.theme = this.settings.theme === "night" ? "night" : "paper";
      this.el.themeButton.setAttribute("aria-pressed", String(this.settings.theme === "night"));
      this.el.themeLabel.textContent = this.settings.theme === "night" ? "Night mode on" : "Paper mode on";
      this.el.layers.innerHTML = this.project.layers.map((layer) => `<div class="layer${layer.id === this.activeLayerId ? " is-active" : ""}"><button data-layer="${layer.id}">${layer.name} <span>${layer.annotations.length}</span></button><button class="layer-toggle" data-layer-toggle="${layer.id}">${layer.visible ? "Visible" : "Hidden"}</button></div>`).join("");
      this.renderKeybindingPanels();
      this.el.actions.classList.toggle("is-visible", Boolean(this.selectedId));
    }

    pointerDown(event) {
      if (event.button !== 0 || this.activeTool === "browse") return;
      event.preventDefault();
      const target = event.target.closest?.("[data-ann-id]");
      if (this.activeTool === "select") {
        if (target) {
          this.selectAnnotation(target.dataset.annId);
          const start = point(event);
          this.dragging = { id: target.dataset.annId, start, snapshot: this.serializeLayers(), originGeometry: JSON.parse(JSON.stringify(target && this.findAnnotation(target.dataset.annId)?.geometry)) };
          this.el.svg.setPointerCapture?.(event.pointerId);
        } else this.deselect();
        return;
      }
      const start = point(event);
      if (this.activeTool === "text") { this.openTextEditor(start, event); return; }
      if (this.activeTool === "stamp") { this.createStamp(start); return; }
      this.beginDrawing(start, event.pointerId);
    }

    beginDrawing(start, pointerId) {
      this.snapshot(true);
      const type = this.activeTool === "highlight" ? "path" : this.activeTool;
      const annotation = {
        id: uid("ann"), type, createdAt: new Date().toISOString(), layerId: this.activeLayerId,
        style: { color: this.settings.color, width: this.activeTool === "highlight" ? Math.max(14, this.settings.width * 5) : this.settings.width, opacity: this.activeTool === "highlight" ? Math.min(.36, this.settings.opacity) : this.settings.opacity },
        geometry: this.activeTool === "pen" || this.activeTool === "highlight" ? { points: [start] } : { x1: start.x, y1: start.y, x2: start.x, y2: start.y },
      };
      if (this.activeTool === "highlight") annotation.type = "highlight";
      this.activeLayer().annotations.push(annotation);
      this.drawing = { annotation, start, pointerId };
      this.el.svg.setPointerCapture?.(pointerId);
      this.renderAll();
    }

    pointerMove(event) {
      if (this.dragging) { this.moveSelected(point(event)); return; }
      if (!this.drawing) return;
      event.preventDefault();
      const current = point(event);
      const annotation = this.drawing.annotation;
      if (annotation.type === "path" || annotation.type === "highlight") annotation.geometry.points.push(current);
      else { annotation.geometry.x2 = current.x; annotation.geometry.y2 = current.y; }
      this.patchElement(annotation);
    }

    pointerUp(event) {
      if (this.dragging) { this.endDrag(); return; }
      if (!this.drawing) return;
      this.endGesture();
    }

    endGesture() {
      if (!this.drawing) return;
      const annotation = this.drawing.annotation;
      if ((annotation.type === "path" || annotation.type === "highlight") && annotation.geometry.points.length < 2) {
        this.activeLayer().annotations = this.activeLayer().annotations.filter((item) => item.id !== annotation.id);
      }
      this.drawing = null;
      this.persistSoon();
      this.renderAll();
    }

    openTextEditor(position) {
      this.pendingTextPosition = position;
      this.el.editor.style.left = `${Math.min(window.innerWidth - 246, Math.max(10, position.x - window.scrollX))}px`;
      this.el.editor.style.top = `${Math.min(window.innerHeight - 130, Math.max(10, position.y - window.scrollY))}px`;
      this.el.editor.classList.add("is-open");
      this.el.textarea.value = "";
      this.el.textarea.focus();
    }

    cancelText() { this.el.editor.classList.remove("is-open"); this.pendingTextPosition = null; }

    commitText() {
      const text = this.el.textarea.value.trim();
      if (!text || !this.pendingTextPosition) { this.cancelText(); return; }
      this.snapshot(true);
      const selection = window.getSelection()?.toString().trim() || "";
      this.project.layers.find((layer) => layer.id === "notes").annotations.push({ id: uid("note"), type: "text", createdAt: new Date().toISOString(), layerId: "notes", text, style: { color: this.settings.color, width: this.settings.width, opacity: 1 }, geometry: this.pendingTextPosition, anchor: selection ? { quote: selection.slice(0, 500), selectorHint: location.hostname } : undefined });
      this.cancelText();
      this.persistSoon();
      this.renderAll();
      this.toast("Text note added to Notes layer.");
    }

    createStamp(position) {
      this.snapshot(true);
      const evidence = this.project.layers.find((layer) => layer.id === "evidence");
      const number = evidence.annotations.filter((annotation) => annotation.type === "stamp").length + 1;
      evidence.annotations.push({ id: uid("stamp"), type: "stamp", createdAt: new Date().toISOString(), layerId: "evidence", text: String(number), style: { color: this.settings.color, width: this.settings.width, opacity: 1 }, geometry: position });
      this.persistSoon();
      this.renderAll();
      this.toast(`Evidence stamp ${number} added.`);
    }

    selectAnnotation(id) { this.selectedId = id; this.renderAll(); this.renderControls(); }
    deselect() { this.selectedId = null; this.dragging = null; this.renderAll(); this.renderControls(); }

    moveSelected(current) {
      const { id, start, originGeometry } = this.dragging;
      const annotation = this.findAnnotation(id);
      if (!annotation || !originGeometry) return;
      annotation.geometry = JSON.parse(JSON.stringify(originGeometry));
      this.translate(annotation, current.x - start.x, current.y - start.y);
      this.patchElement(annotation);
    }

    translate(annotation, dx, dy) {
      const g = annotation.geometry;
      if (annotation.type === "path" || annotation.type === "highlight") g.points = g.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      else if (annotation.type === "text" || annotation.type === "stamp") { g.x += dx; g.y += dy; }
      else { g.x1 += dx; g.y1 += dy; g.x2 += dx; g.y2 += dy; }
    }

    endDrag() {
      if (!this.dragging) return;
      this.undoStack.push(this.dragging.snapshot);
      this.undoStack = this.undoStack.slice(-60);
      this.redoStack = [];
      this.dragging = null;
      this.persistSoon();
      this.renderAll();
    }

    snapshot(clearRedo) {
      if (clearRedo) this.redoStack = [];
      this.undoStack.push(this.serializeLayers());
      this.undoStack = this.undoStack.slice(-60);
    }

    serializeLayers() { return JSON.stringify(this.project.layers); }
    restoreLayers(serialized, shouldRender = true) { this.project.layers = JSON.parse(serialized); if (shouldRender) this.renderAll(); }

    undo() {
      if (this.undoStack.length <= 1) { this.toast("Nothing to undo."); return; }
      const previous = this.undoStack.pop();
      this.redoStack.push(this.serializeLayers());
      this.restoreLayers(previous);
      this.persistSoon();
    }

    redo() {
      const next = this.redoStack.pop();
      if (!next) { this.toast("Nothing to redo."); return; }
      this.undoStack.push(this.serializeLayers());
      this.restoreLayers(next);
      this.persistSoon();
    }

    deleteSelected() {
      if (!this.selectedId) return;
      this.snapshot(true);
      for (const layer of this.project.layers) layer.annotations = layer.annotations.filter((annotation) => annotation.id !== this.selectedId);
      this.selectedId = null;
      this.persistSoon();
      this.renderAll();
      this.renderControls();
      this.toast("Annotation removed.");
    }

    duplicateSelected() {
      const selected = this.findAnnotation(this.selectedId);
      if (!selected) return;
      this.snapshot(true);
      const clone = JSON.parse(JSON.stringify(selected));
      clone.id = uid("copy");
      clone.createdAt = new Date().toISOString();
      this.translate(clone, 18, 18);
      this.project.layers.find((layer) => layer.id === clone.layerId).annotations.push(clone);
      this.selectedId = clone.id;
      this.persistSoon();
      this.renderAll();
      this.toast("Annotation duplicated.");
    }

    clearLayer() {
      const layer = this.activeLayer();
      if (!layer.annotations.length) { this.toast(`${layer.name} layer is already clear.`); return; }
      if (!confirm(`Clear all ${layer.name.toLowerCase()} annotations on this page?`)) return;
      this.snapshot(true);
      layer.annotations = [];
      this.selectedId = null;
      this.persistSoon();
      this.renderAll();
      this.renderControls();
      this.toast(`${layer.name} layer cleared.`);
    }

    renderAll() {
      this.renderLayer();
      this.renderControls();
    }

    renderLayer() {
      this.el.layer.innerHTML = this.project.layers.filter((layer) => layer.visible).flatMap((layer) => layer.annotations.map((annotation) => this.svgFor(annotation))).join("");
    }

    patchElement(annotation) {
      const node = this.el.layer.querySelector(`[data-ann-id="${annotation.id}"]`);
      if (!node) { this.renderLayer(); return; }
      const { type, geometry } = annotation;
      if (type === "path" || type === "highlight") {
        node.setAttribute("d", geometry.points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "));
        return;
      }
      if (type === "text" || type === "stamp") { node.setAttribute("transform", `translate(${geometry.x} ${geometry.y})`); return; }
      const x = Math.min(geometry.x1, geometry.x2), y = Math.min(geometry.y1, geometry.y2), w = Math.abs(geometry.x2 - geometry.x1), h = Math.abs(geometry.y2 - geometry.y1);
      if (type === "rect") { node.setAttribute("x", x); node.setAttribute("y", y); node.setAttribute("width", w); node.setAttribute("height", h); return; }
      if (type === "ellipse") { node.setAttribute("cx", x + w / 2); node.setAttribute("cy", y + h / 2); node.setAttribute("rx", w / 2); node.setAttribute("ry", h / 2); return; }
      node.setAttribute("x1", geometry.x1); node.setAttribute("y1", geometry.y1); node.setAttribute("x2", geometry.x2); node.setAttribute("y2", geometry.y2);
    }

    svgFor(annotation) {
      const { id, type, style, geometry, text } = annotation;
      const selected = id === this.selectedId ? "true" : "false";
      const common = `class="annotation" data-ann-id="${id}" data-selected="${selected}" opacity="${style.opacity}"`;
      if (type === "path" || type === "highlight") {
        const d = geometry.points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
        return `<path ${common} d="${d}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke" />`;
      }
      if (type === "text") {
        const lines = String(text || "").split("\n");
        return `<g ${common} transform="translate(${geometry.x} ${geometry.y})" pointer-events="all"><rect x="-8" y="-23" width="${Math.max(80, Math.min(300, Math.max(...lines.map((line) => line.length * 8)) + 18))}" height="${Math.max(34, lines.length * 20 + 12)}" fill="var(--aa-paper)" stroke="${style.color}" stroke-width="1.5"/><text x="0" y="0" fill="var(--aa-ink)" font-family="system-ui, sans-serif" font-size="14">${lines.map((line, index) => `<tspan x="0" dy="${index ? 18 : 0}">${escapeXml(line)}</tspan>`).join("")}</text></g>`;
      }
      if (type === "stamp") return `<g ${common} transform="translate(${geometry.x} ${geometry.y})" pointer-events="all"><circle r="16" fill="var(--aa-paper)" stroke="${style.color}" stroke-width="3"/><text text-anchor="middle" dominant-baseline="central" fill="var(--aa-ink)" font-family="ui-monospace, monospace" font-size="14" font-weight="700">${escapeXml(text)}</text></g>`;
      const x = Math.min(geometry.x1, geometry.x2), y = Math.min(geometry.y1, geometry.y2), w = Math.abs(geometry.x2 - geometry.x1), h = Math.abs(geometry.y2 - geometry.y1);
      if (type === "rect") return `<rect ${common} x="${x}" y="${y}" width="${w}" height="${h}" fill="${style.color}" fill-opacity=".12" stroke="${style.color}" stroke-width="${style.width}" pointer-events="all" />`;
      if (type === "ellipse") return `<ellipse ${common} cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${style.color}" fill-opacity=".12" stroke="${style.color}" stroke-width="${style.width}" pointer-events="all" />`;
      return `<line ${common} x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" ${type === "arrow" ? `marker-end="url(#annotaura-arrow)"` : ""} pointer-events="stroke" />`;
    }

    async persistSettings() {
      try { await storeSet("annotaura:settings", this.settings); } catch { this.toast("Settings could not be saved locally."); }
    }

    persistSoon() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persist(false), 360);
    }

    async persist(manual) {
      this.project.updatedAt = new Date().toISOString();
      this.project.source.title = document.title || this.project.source.title;
      try {
        await storeSet(projectKey(), this.project);
        if (manual) { this.explicitlySaved = true; this.toast("Saved locally to this page project."); }
      } catch (error) {
        this.toast("Local storage is full. Export this project or remove old projects.");
        console.warn("Annotaura storage error", error);
      }
    }

    exportJson() {
      this.explicitlySaved = true;
      this.persist(false);
      const payload = JSON.stringify({ format: "annotaura-project", version: "1.0", exportedAt: new Date().toISOString(), project: this.project }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `annotaura-${(this.project.source.domain || "scratch").replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toast("Project JSON exported.");
    }

    async captureVisible() {
      this.el.rail.style.visibility = "hidden";
      this.el.context.classList.remove("is-open");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try {
        const result = await api.runtime.sendMessage({ type: "annotaura:capture-visible" });
        if (!result?.ok) throw new Error(result?.error || "Capture unavailable");
        const link = document.createElement("a");
        link.href = result.dataUrl;
        link.download = `annotaura-capture-${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
        this.toast("Visible annotated view exported as PNG.");
      } catch (error) {
        this.toast("Capture is unavailable on this browser page.");
        console.warn("Annotaura capture error", error);
      } finally {
        this.el.rail.style.visibility = "";
      }
    }

    toast(message) {
      this.el.toast.textContent = message;
      this.el.toast.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.el.toast.classList.remove("is-visible"), 2600);
    }

    clearSession() {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      if (this.refreshFrame) { cancelAnimationFrame(this.refreshFrame); this.refreshFrame = 0; }
      if (!this.explicitlySaved) storeRemove(projectKey());
      this.project = blankProject();
      this.selectedId = null;
      this.undoStack = [];
      this.redoStack = [];
      this.drawing = null;
      this.dragging = null;
      this.pendingTextPosition = null;
      this.el.layer.innerHTML = "";
      this.el.editor.classList.remove("is-open");
    }

    async close() {
      // Exit is intentionally non-persistent: explicit Save/Export are the only ways to keep this session.
      this.clearSession();
      document.removeEventListener("keydown", this.onKeydown, true);
      window.removeEventListener("resize", this.refresh);
      window.removeEventListener("scroll", this.refresh);
      window.visualViewport?.removeEventListener("resize", this.refresh);
      this.resizeObserver?.disconnect();
      this.root.remove();
      delete globalThis[CONTROLLER_KEY];
    }
  }

  (async () => {
    const settings = await storeGet("annotaura:settings", DEFAULTS);
    // Every activation starts with a clean in-memory canvas. Explicitly saved page projects remain available in Workspace.
    const project = blankProject();
    globalThis[CONTROLLER_KEY] = new AnnotauraSurface(settings, project);
  })();
})();
