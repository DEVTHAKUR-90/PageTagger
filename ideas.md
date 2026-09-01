# Annotaura Design Direction

## Three possible directions

| Theme Name | Very Brief Intro | Probability |
| --- | --- | --- |
| **Paper Signal** | An editorial annotation environment inspired by architectural margin notes, tracing paper, and drafting marks. It feels deliberate, tactile, and exceptionally readable. | 0.07 |
| **Field Kit** | A rugged field-research toolkit with utilitarian controls, geological colors, and durable visual hierarchy. It would make browser research feel like a documented expedition. | 0.03 |
| **Clear Glass Studio** | A quiet, translucent studio with generous negative space and lightweight spatial layers. It would foreground the web page while keeping the annotation interface almost weightless. | 0.09 |

## Chosen approach: Paper Signal

### Design Movement

**Contemporary editorial design with architectural marginalia.** The product should feel like a precise desk tool for people who think visually: clear enough for daily browsing and expressive enough for critique, teaching, and research.

### Core Principles

1. **The page is the canvas, not the chrome.** The tools remain compact, legible, and peripheral so the browsing context remains visible.
2. **Precision with warmth.** Control surfaces use crisp alignment and meaningful labels, balanced with a restrained paper-like warmth and expressive mark colors.
3. **Visible provenance.** Saved annotations are projects with a page source, timestamps, layers, and export-ready context, rather than disposable pixels.
4. **Fast handoff.** High-frequency acts such as selecting a tool, making a mark, undoing, and saving should be immediate and keyboard-friendly.

### Color Philosophy

The neutral foundation is **ink black**, **paper ivory**, and cool **graphite**, giving the extension a calm visual authority across light and dark websites. Annotation colors act as intentional publishing marks rather than decoration: **Signal Saffron** is the unmistakable ownable brand color for active selections and recording state; brick, leaf, ocean, and ultraviolet are restrained secondary mark colors. Tool surfaces use solid opacity to protect contrast over arbitrary web pages.

### Layout Paradigm

The extension is organized like a document margin, not a centered app dashboard. On a webpage, a slim vertical **tool rail** nests beside the viewport edge and can expand into a horizontal context shelf. In the workspace page, a thin catalog spine holds projects while a broad working sheet carries previews, annotation lists, and export controls in an asymmetric editorial spread.

### Signature Elements

1. **The Margin Rail:** a vertical tool strip with a saffron active-index tab and explicit tool names on expansion.
2. **Registration Marks:** subtle corner ticks, measurement labels, and page-source metadata that make saved projects feel archival.
3. **Layer Chips:** tactile, rectangular paper-label controls for drawing, text, comments, and captures; never generic floating pills.

### Interaction Philosophy

Interaction should feel like placing marks in a notebook. Pressing the shortcut exposes the rail at the page margin, selecting a tool changes the cursor and mark color instantly, and all destructive actions state what will be removed before they proceed. The toolbar stays intentionally small; less common operations live in a calm overflow panel or the workspace page.

### Animation

The Margin Rail eases in from the viewport edge over 180ms using `cubic-bezier(0.23, 1, 0.32, 1)`. Active tool changes use a 120ms saffron index-slide, not a glow. Context panels fade and translate by 4px over 160ms. Buttons compress to 97% on press. Canvas drawing, undo, redo, and keyboard commands never animate. Motion is disabled when the user requests reduced motion.

### Typography System

**Space Grotesk** supplies compact, modern UI labels and confident headings; **IBM Plex Mono** carries measurements, shortcut hints, dates, source domains, and engineering-like metadata. Workspace section labels use uppercase mono at a small scale with tracking; content titles use Space Grotesk 600–700; regular controls remain compact and plain.

### Brand Essence

**Annotaura is a privacy-first visual margin for researchers, reviewers, educators, and teams who need to turn live webpages into clear, shareable evidence.** Its personality is **precise, observant, and approachable**.

### Brand Voice

Headlines are concise and evidence-oriented. Calls to action name the actual outcome, while microcopy quietly explains where an annotation is saved or why a permission is needed.

> “Mark the evidence, not just the page.”

> “Save this layer to the project archive.”

### Wordmark & Logo

The mark is an original **open annotation frame crossed by a single diagonal trace**: a bold, simple symbol that suggests both a margin bracket and a drawn gesture. The wordmark pairs custom-spaced Space Grotesk capitals with a saffron trace cutting through the first “A”; it must not use PageMarker’s pencil imagery or name.

### Signature Brand Color

**Signal Saffron — `#FFB000`**

## Originality boundary

Annotaura will be independently branded and engineered. It may include category-standard actions such as drawing, highlighting, typing, shapes, selection, undo/redo, saving, and export, but it will not copy PageMarker’s name, pencil icon, UI artwork, screenshots, code, visual layout, or store copy. The additional functionality will follow the product specification written after research.
