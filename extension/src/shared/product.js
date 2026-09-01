/** Paper Signal reminder: Annotaura uses editorial clarity, explicit provenance, and Signal Saffron as its active mark. */

export const BRAND = {
  name: "Annotaura",
  version: "1.0.0",
  storagePrefix: "annotaura:project:",
  settingsKey: "annotaura:settings",
  palette: ["#18201E", "#FFB000", "#B84C3D", "#315F79", "#315E4B", "#6950A1"],
};

export const DEFAULT_SETTINGS = {
  color: "#FFB000",
  width: 4,
  opacity: 0.72,
  railSide: "right",
  reducedMotion: false,
  showSourceMetadata: true,
  defaultTemplate: "Research",
};

export const LAYER_DEFINITIONS = [
  { id: "marks", name: "Marks" },
  { id: "notes", name: "Notes" },
  { id: "evidence", name: "Evidence" },
];

export const TOOLS = [
  { id: "select", label: "Select", short: "S" },
  { id: "pen", label: "Pen", short: "P" },
  { id: "highlight", label: "Highlight", short: "H" },
  { id: "text", label: "Text note", short: "T" },
  { id: "line", label: "Line", short: "L" },
  { id: "arrow", label: "Arrow", short: "A" },
  { id: "rect", label: "Rectangle", short: "R" },
  { id: "ellipse", label: "Ellipse", short: "O" },
  { id: "stamp", label: "Evidence stamp", short: "E" },
  { id: "browse", label: "Browse page", short: "B" },
];

export function createId(prefix = "ann") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function createProject({ kind = "page", title = "Untitled page", url = "", name } = {}) {
  const canonicalUrl = url ? canonicalizeUrl(url) : "";
  const createdAt = new Date().toISOString();
  return {
    id: createId(kind === "scratch" ? "scratch" : "page"),
    kind,
    source:
      kind === "page"
        ? {
            canonicalUrl,
            originalUrl: url,
            title,
            domain: (() => {
              try {
                return new URL(url).hostname;
              } catch {
                return "Local page";
              }
            })(),
          }
        : null,
    name: name || (kind === "page" ? title : "Untitled scratch sheet"),
    tags: [],
    createdAt,
    updatedAt: createdAt,
    layers: LAYER_DEFINITIONS.map((layer) => ({ ...layer, visible: true, annotations: [] })),
  };
}
