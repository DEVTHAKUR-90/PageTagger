<div align="center">
<pre>
  
# ANNOTAURA
```text
█████╗ ███╗   ██╗███╗   ██╗ ██████╗ ████████╗ █████╗ ██╗   ██╗██████╗  █████╗
██╔══██╗████╗  ██║████╗  ██║██╔═══██╗╚══██╔══╝██╔══██╗██║   ██║██╔══██╗██╔══██╗
███████║██╔██╗ ██║██╔██╗ ██║██║   ██║   ██║   ███████║██║   ██║██████╔╝███████║
██╔══██║██║╚██╗██║██║╚██╗██║██║   ██║   ██║   ██╔══██║██║   ██║██╔══██╗██╔══██║
██║  ██║██║ ╚████║██║ ╚████║╚██████╔╝   ██║   ██║  ██║╚██████╔╝██║  ██║██║  ██║
╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝

                         MARK THE EVIDENCE. KEEP THE CONTEXT.
```
</pre>

</div>

> **A local-first visual annotation workspace for the open web.**

**Repository:** [github.com/DEVTHAKUR-90/PageTagger](https://github.com/DEVTHAKUR-90/PageTagger)

Annotaura adds an edge-mounted **Margin Rail** to ordinary web pages. Mark passages, draw evidence, add notes, build page-aware projects, and return to reading without covering the page with a conventional dashboard.

This is an original project with its own name, visual language, implementation, and product direction. It is inspired by the general web-annotation category, not copied from another extension.

## What it includes

| Area | Capability |
| --- | --- |
| **Annotation** | Select, pen, highlighter, text note, line, arrow, rectangle, ellipse, and numbered evidence stamp. |
| **Editing** | Move, duplicate, delete, undo, redo with disabled states, Browse mode, custom color picker, palette swatches, stroke width, opacity, and layers. |
| **Projects** | Page-aware local projects with title, domain, tags, annotation counts, and automatic saving. |
| **Workspace** | Archive search, Scratch Sheets, JSON import/export, backup, and local data erasure. |
| **Shortcuts** | Plain letters, `Alt` + letter, and `Ctrl`/`⌘` + `Alt` + letter bindings. |
| **Shortcut editor** | Duplicate detection, real-time conflict warnings, one-click **Swap with…**, reset defaults, and local persistence. |
| **Themes** | Paper and Night modes with accessible state labels and reduced-motion support. |
| **Compatibility** | Shared WebExtensions source for Chrome, Edge, Brave, Opera, and Firefox. |

## Privacy by design

Annotaura is local-first. The extension does not send annotation content, page URLs, project metadata, or user-created notes to a remote service. Browser storage retains projects and preferences until the user exports or erases them.

The package requests only the permissions needed for its stated actions: `activeTab`, `scripting`, `storage`, `downloads`, and `contextMenus`. It cannot operate on browser-controlled pages such as `chrome://`, `edge://`, `about:`, extension stores, New Tab pages, or some internal PDF viewers.

Read the full policy in [`PRIVACY.md`](PRIVACY.md).

## Quick start

Use **Node.js 20+** and **pnpm 10+**.

```bash
pnpm install
pnpm extension:build
pnpm extension:package
```

The build creates these installable folders and release archives. The source packages use the clean-session lifecycle described above; explicit saved projects remain available in browser storage and Workspace, while ordinary exit does not write the current unsaved canvas.

```text
extension/dist/chromium/              # Chrome, Edge, Brave, Opera
extension/dist/firefox/               # Firefox
extension/dist/annotaura-chromium.zip
extension/dist/annotaura-firefox.zip
```

## Install for testing

### Chrome, Edge, Brave, or Opera

1. Clone or download this repository.
2. Run `pnpm install` and `pnpm extension:build`.
3. Open the browser’s extensions page: `chrome://extensions`, `edge://extensions`, or the equivalent page.
4. Enable **Developer mode**.
5. Choose **Load unpacked**.
6. Select `extension/dist/chromium`.
7. Open a normal `https://` webpage and activate Annotaura from the toolbar.

### Firefox

1. Run `pnpm install` and `pnpm extension:build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…**.
4. Select `extension/dist/firefox/manifest.json`.
5. Open a normal webpage and activate Annotaura.

A temporary Firefox add-on is removed after a browser restart. A public Firefox release must be signed through Firefox Add-ons.

## User workflow

Activate Annotaura on a normal web page, choose a tool from the Margin Rail, and draw directly over the page. Open **Menu → Margin controls** to choose any color with the native color picker or use a palette swatch, then adjust **Weight** from 1–24 px; highlighter strokes automatically use a broader visual weight while preserving the selected base setting. Annotations are stored in document coordinates, so they remain anchored while the page scrolls; the surface refreshes its document size on scroll, resize, visual-viewport changes, and document resizes. Choose **Browse** when you want page interaction to pass through. Open **Menu** for templates, layers, exports, capture, Workspace, themes, and keyboard tools.

Use **Undo** and **Redo** in the Margin Rail, or press `Ctrl`/`⌘` + `Z` and `Ctrl`/`⌘` + `Shift` + `Z` (or `Y`) to correct drawing and highlighting mistakes. The controls disable themselves when no history is available, and a new drawing after undo starts a fresh branch. Open **Keyboard shortcuts**, then select **Customize tool keys** to edit a tool binding. Press a plain letter, `Alt` + letter, or `Ctrl`/`⌘` + `Alt` + letter. If the combination already belongs to another tool, the editor immediately identifies the conflict and offers **Swap with…**. `Z`, `Y`, deletion, Escape, and browser activation retain their protected roles.

Press `?` while Annotaura is active to open the shortcut reference. Press `Esc` to exit: the active unsaved canvas is cleared immediately and the surface is removed. Re-activating Annotaura starts a blank session. Use **Save local**, **Export JSON**, or Workspace tools when you explicitly want to preserve a project.

## Key commands

| Shortcut | Action |
| --- | --- |
| `?` | Open the shortcut reference |
| `S` | Select and reposition a mark |
| `P` / `H` | Pen / highlighter |
| `T` | Text note |
| `L` / `A` | Line / arrow |
| `R` / `O` | Rectangle / ellipse |
| `E` / `B` | Evidence stamp / Browse mode |
| `Ctrl` or `⌘` + `Z` | Undo |
| `Ctrl` or `⌘` + `Shift` + `Z` or `Y` | Redo |
| `Delete` / `Backspace` | Delete selected annotation |
| `Esc` | Cancel, close, or deselect |

## Repository structure

```text
extension/
├── src/
│   ├── background/          # MV3 service worker and browser coordination
│   ├── content/             # Shadow-DOM Margin Rail and SVG annotation surface
│   ├── workspace/           # Local archive and Scratch Sheet pages
│   ├── shared/              # Defaults and project helpers
│   ├── assets/              # Original Annotaura icons
│   └── manifest.*.json      # Shared, Chromium, and Firefox metadata
└── dist/                    # Generated browser packages (built, not committed)

scripts/build-extension.mjs  # Cross-browser build
scripts/verify-extension.mjs # Package verification
```

This repository contains only the browser extension — there is no companion server, database, or hosted landing page. The extension has zero runtime dependencies; the only dev dependency is Prettier for formatting.

## GitHub workflow

Create a repository on GitHub, then push the source from your local machine:

```bash
git init
git add .
git commit -m "Initial Annotaura release"
git branch -M main
git remote add origin https://github.com/DEVTHAKUR-90/PageTagger.git
git push -u origin main
```

For a release, build the packages, create a GitHub Release, and attach `extension/dist/annotaura-chromium.zip` and `extension/dist/annotaura-firefox.zip`. Keep the repository source available so contributors can audit and build it themselves. The generated `extension/dist/` folders are installable artifacts; `extension/src/` is the source of truth.

For a cleaner release, use a tag:

```bash
git tag -a v1.0.0 -m "Annotaura 1.0.0"
git push origin v1.0.0
```

## About Vercel and one-click installation

Vercel hosts web apps — it cannot install a browser extension into a visitor's browser, and it does not replace the Chrome Web Store, Edge Add-ons, or Firefox Add-ons. Do not point an "Install" button at a ZIP hosted anywhere, including Vercel; loading a ZIP still requires Developer mode and manual "Load unpacked" steps. For genuine one-click installation, submit the package to the relevant browser store and link to the official listing once it's approved.

If you later want a marketing or documentation site for Annotaura, you can build a separate static site and deploy it to Vercel independently — it isn't required to publish or use the extension itself.

## Public distribution

| Channel | Use |
| --- | --- |
| **GitHub** | Source code, documentation, issues, releases, checksums, and manual-install ZIPs. |
| **Chrome Web Store** | Public Chrome installation after developer registration, privacy disclosures, listing assets, and review. |
| **Microsoft Edge Add-ons** | Public Edge installation using the Chromium package and Microsoft's review process. |
| **Firefox Add-ons** | Signed Firefox distribution through AMO. |

## Development and contribution

Run `pnpm extension:check` for JavaScript syntax validation, `pnpm extension:build` to create both browser packages, and `pnpm extension:verify` to verify their manifests and required files. Contributions should preserve the local-first privacy model, avoid unnecessary permissions, and validate both Chromium and Firefox outputs.

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md), and [`ideas.md`](ideas.md) for project context.

## License

Annotaura is licensed under the [MIT License](LICENSE).

## Official publishing references

- [Chrome Web Store publishing](https://developer.chrome.com/docs/webstore/publish)
- [Microsoft Edge Add-ons publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension)
- [Firefox Add-ons publishing](https://extensionworkshop.com/documentation/publish/)


## Release prerequisites and future updates

Before publishing, create the required developer accounts: a Chrome Web Store developer account for Chrome, Edge Add-ons Partner Center access for Edge, and a Firefox Add-ons/AMO account for Firefox. Store review may also require a verified email, developer identity or payment verification, privacy disclosures, screenshots, an icon set, a support URL, and a public privacy-policy URL. Annotaura itself does not require an API key because annotation data is local-first.

For each future release, update the extension version in both generated manifest targets through `extension/src/manifest.chromium.json` and `extension/src/manifest.firefox.json`, update the release notes, run `pnpm check`, `pnpm build`, and `pnpm extension:package`, then inspect the generated ZIPs. Commit the source and tag the release, for example:

```bash
git add .
git commit -m "Release v1.1.0"
git tag -a v1.1.0 -m "Annotaura 1.1.0"
git push origin main --follow-tags
```

Upload `extension/dist/annotaura-chromium.zip` to the Chrome Web Store and Edge Add-ons portals, and upload `extension/dist/annotaura-firefox.zip` to Firefox Add-ons. Complete each portal's listing, privacy, permission, support, and review forms. After approval, link to the official store listings from this README and your GitHub Release notes. Existing users receive store-managed updates when the store accepts a higher version; GitHub/manual users must download the new ZIP and reload or reinstall it.

## Clean-session and alignment contract

Annotaura deliberately separates temporary work from explicit saves. Pressing `Esc` exits and removes the active surface without persisting the current canvas. Re-activation starts blank. **Save local**, JSON export, and Workspace actions are explicit persistence paths. Annotation geometry is recorded in page document coordinates, and the SVG surface refreshes its dimensions on scroll, browser resize, visual-viewport resize, and document resize so marks stay attached to the corresponding page content during ordinary browsing.
