# Annotaura Product Specification

**Product:** Annotaura

**Version target:** 1.0.0

**Positioning:** A local-first, cross-browser visual annotation extension for turning live webpages into organized, exportable evidence.

## Product intent

Annotaura will be an independently designed browser extension for Chrome, Firefox, Edge, Brave, Opera, and other modern WebExtensions-compatible Chromium browsers. It will provide the established web-markup fundamentals users expect, but its primary differentiation will be an original **Margin Rail** experience, page-aware local projects, structured annotations, better keyboard and touch behavior, clear privacy controls, and export options that serve research, education, feedback, and review workflows.

The product is intentionally **local-first**. Its first release will not require accounts, remote servers, or data collection. Each annotation project is stored in the user’s browser unless the user explicitly exports it. This makes the initial codebase suitable for GitHub distribution and manual installation without needing application hosting or cloud credentials.

## Feature baseline reviewed

PageMarker’s public site, browser-store listings, developer portfolio, and public repository indicate a category baseline of pen, highlighter, eraser, text, line, selection/move, color and thickness settings, undo/redo, toolbar movement, local persistence, screenshot capture, a whiteboard page, keyboard shortcuts, touch support, and basic options. Those common concepts can be included in an original product, but Annotaura will be independently named, designed, and engineered. The complete reviewed inventory and sources are recorded in [`pagemarker_research_notes.md`](../pagemarker_research_notes.md).

## Release 1 scope

| Capability | Description | Release behavior |
| --- | --- | --- |
| **Margin Rail** | Original edge-mounted annotation rail that expands into a contextual tool shelf. | Available on every ordinary web page after the user activates Annotaura. |
| **Pen and highlighter** | Freehand mark tools with palette, opacity, and thickness controls. | Pointer Events support mouse, touch, and pen input. |
| **Text notes** | Place text notes on a page and edit them later. | Double-click a text annotation to edit it; use a small default type scale. |
| **Shapes and arrows** | Draw lines, arrows, rectangles, ellipses, and numbered stamps. | Works through drag gestures and creates editable vector records. |
| **Select and edit** | Reposition, resize, recolor, duplicate, and delete an annotation. | A select tool exposes a compact contextual action bar. |
| **Browse mode** | Temporarily makes the annotation layer transparent to interaction. | Lets the user interact with the underlying page without closing Annotaura. |
| **History** | Undo and redo in the active session. | Keyboard shortcuts and rail buttons; snapshots stored at logical actions. |
| **Page-aware projects** | Saved annotations tied to a canonical URL and page title. | Restore the project when revisiting the same canonical page. |
| **Layer model** | Keep marks, notes, and stamps separately visible. | Per-layer visibility and selective clear actions. |
| **Searchable archive** | A local Workspace lists saved projects and their notes. | Search title, domain, tags, and note content. |
| **Scratch Sheet** | An original blank workspace for free-form diagrams and notes. | Uses the same tools without a live webpage underneath. |
| **Exports** | Export annotations as JSON, an accessible text summary, and a printable page capture. | PNG capture is limited to the visible viewport in 1.0; limits are labeled honestly. |
| **Privacy center** | Explain what stays in browser storage and provide delete/export controls. | No remote analytics or cloud sync in Release 1. |
| **Accessibility** | Keyboard reachability, visible focus treatment, semantic labels, and reduced-motion behavior. | Tool rail and workspace implement an accessible interaction baseline. |
| **Cross-browser packaging** | One source package, with small platform manifest overrides. | Chromium Manifest V3; Firefox Manifest V3 with Gecko-specific ID. |

## Distinctive Annotaura features

The following features extend beyond the reviewed baseline and define the product’s original value proposition. **Annotation projects** preserve the page source, canonical URL, last saved time, tags, note text, and vector annotations as structured data rather than only a bitmap. **Page anchors** associate text-related notes with a selected text snippet and an approximate DOM context, allowing users to understand where a note belongs when a page moves. **Evidence stamps** provide original numbered callouts and status markers such as “question,” “verify,” and “decision.” **Templates** let a user apply an annotation palette and tool configuration for research, design review, teaching, or accessibility audits. **Session recovery** retains the current project whenever the rail is closed or the tab reloads. **Import/export** makes the project portable in an open JSON schema so that an archive can be backed up without an account.

## Interaction model

The extension action activates Annotaura for the current page. The first activation injects the Margin Rail and a document-bound SVG annotation surface. Repeat activation toggles the rail. The active tool determines the cursor and gesture behavior. When the user draws, Annotaura appends a structured annotation object to the active layer, takes a history snapshot, and schedules a local save. The annotation surface sits above the page but never changes the page’s DOM content; Browse Mode disables the surface’s pointer handling so the underlying page behaves normally.

The Workspace page opens from the extension action menu and provides project search, tags, archive actions, the Scratch Sheet, global defaults, and privacy controls. The initial release will supply local capability only. Cloud collaboration, automatic synchronization, external AI analysis, and real-time shared cursors are explicitly deferred so that the extension remains installable, auditable, and private by default.

## Data model

```ts
type AnnotauraProject = {
  id: string;
  kind: "page" | "scratch";
  source: {
    canonicalUrl: string;
    originalUrl: string;
    title: string;
    domain: string;
  } | null;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  layers: Array<{
    id: string;
    name: "Marks" | "Notes" | "Evidence";
    visible: boolean;
    annotations: Annotation[];
  }>;
};

type Annotation = {
  id: string;
  type: "path" | "highlight" | "text" | "line" | "arrow" | "rect" | "ellipse" | "stamp";
  style: { color: string; width: number; opacity: number; fill?: string };
  geometry: Record<string, unknown>;
  text?: string;
  anchor?: { quote: string; selectorHint: string };
  createdAt: string;
};
```

Annotation records are serialized with only the geometry and text required to restore the user’s own marks. Original webpage content is not copied into the archive except for user-selected text attached to an explicit note. Browser storage is used for lightweight settings and project metadata; larger active drafts may use IndexedDB through a thin storage adapter. The implementation will handle browser storage quota failures by displaying a local warning and offering JSON export or project cleanup rather than silently dropping data.

## Browser architecture

| Layer | Responsibility | Portability approach |
| --- | --- | --- |
| **Manifest** | Declares extension action, storage, active tab, commands, content access, and workspace page. | Separate small `manifest.chromium.json` and `manifest.firefox.json` files generated from shared metadata. |
| **Service worker** | Adds context menus, opens workspace, injects/removes the page surface, receives capture/export requests, and tracks tab activation. | Uses a `browser`-first promise API with a compact compatibility adapter. |
| **Content surface** | Owns the Margin Rail, SVG overlay, keyboard handling, canvas/SVG export, and page project binding. | Injected only when the user invokes Annotaura, avoiding permanent page overhead. |
| **Workspace** | Manages saved projects, Scratch Sheet, preferences, help, and privacy controls. | Local extension page; no server dependency. |
| **Storage adapter** | Defines project CRUD, settings, export/import, and quota error boundaries. | Uses `storage.local` for initial release; interface leaves room for IndexedDB later. |
| **Build and packaging** | Produces ZIP packages for Chromium and Firefox plus source distribution. | Node build script copies only audited local source; no remotely hosted code. |

## Permissions rationale

| Permission | Why it is needed | Use rule |
| --- | --- | --- |
| `activeTab` | Allows Annotaura to operate only in the page the user explicitly activates. | Preferred for one-click activation. |
| `scripting` / Firefox equivalent | Injects the Margin Rail and annotation surface after activation. | Never injects before user action. |
| `storage` | Saves the user’s local projects and preferences. | Stores only extension settings and user-created annotations. |
| `downloads` | Saves JSON, SVG, and PNG exports when the user asks. | Invoked only by an explicit export action. |
| `tabs` (optional) | Supplies title and URL metadata for a project. | Request only if required by the final implementation; avoid broad host access. |

The build must not request unrelated data such as browsing history, cookies, web requests, identity, microphone, camera, clipboard read, or arbitrary remote hosts. Protected browser pages, extension stores, and other browser-restricted origins cannot accept injected content; Annotaura will explain this rather than attempting to bypass the browser’s boundaries.

## Quality and acceptance criteria

The Release 1 extension is accepted when the same codebase can build separate installable packages for Chrome/Chromium and Firefox, active-tab annotation works on ordinary HTTPS pages, all core tools create and persist vector annotations, undo/redo is reliable, saved projects restore correctly on a matching page, local exports are valid, settings survive browser restarts, keyboard controls are documented and reachable, and the UI follows the **Paper Signal** design documented in [`ideas.md`](ideas.md). The repository must include a plain-language README, installation steps, privacy statement, contribution guidance, license, package scripts, and release-ready ZIP artifacts.

## Phased implementation plan

The first implementation milestone delivers a functional Manifest V3 extension shell, Margin Rail, pen/highlighter/text/shape/stamp tools, selection, history, local project storage, and an initial workspace. The second milestone adds templates, tagged archive search, accessible text summaries, Scratch Sheet, advanced export formatting, keyboard customization, browser packaging, and robust error states. Future releases can consider opt-in encrypted sync, collaboration invitations, browser-sync conflict handling, and external integration connectors only after a separate security and privacy design review.

## References

[1]: https://pagemarker.org/ "Page Marker official site"
[2]: https://chromewebstore.google.com/detail/page-marker-draw-on-web/jfiihjeimjpkpoaekpdpllpaeichkiod?hl=en "Page Marker — Chrome Web Store"
[3]: https://addons.mozilla.org/en-US/firefox/addon/draw-and-mark-a-webpage/ "Page Marker — Firefox Add-ons"
[4]: https://github.com/JiruGutema/Firefox-Marker-Extension "Firefox Marker Extension public repository"
[5]: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3 "Manifest V3 — Chrome for Developers"
[6]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension "Build a cross-browser extension — MDN"
[7]: https://developer.chrome.com/docs/extensions/reference/api/storage "chrome.storage — Chrome for Developers"
