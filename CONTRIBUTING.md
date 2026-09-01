# Contributing to Annotaura

Thank you for helping improve Annotaura. This repository values explicit user control, local-first operation, browser compatibility, and an original Paper Signal visual language.

## Before proposing a change

Describe the user problem and expected behavior in an issue before starting broad feature work. Do not submit copied source, screenshots, branding, or store copy from other annotation products. Category-standard ideas are welcome when implemented independently and documented clearly.

## Development standards

Run the commands below before opening a pull request.

```bash
pnpm extension:check
pnpm extension:build
```

Test `extension/dist/chromium` in at least one Chromium browser and `extension/dist/firefox` in Firefox. Verify the active-tab activation behavior on a normal HTTPS page, confirm the extension fails gracefully on restricted pages, check keyboard access, and validate local export/import after any change to the project schema.

## Privacy and security requirements

Do not add a browser permission without documenting its user-facing purpose in `README.md`, `PRODUCT_SPEC.md`, and `PRIVACY.md`. Do not add remotely hosted executable code. Do not silently upload user projects, URLs, screenshots, or annotation text. Any external service, synchronization feature, or AI integration requires a separate privacy, security, consent, and compatibility proposal before implementation.

## Visual standards

Follow the chosen **Paper Signal** design contract in [`ideas.md`](ideas.md). The page remains the canvas; controls are margin-like, clear, and compact. Use warm paper, graphite, and Signal Saffron intentionally. Avoid copying the visual treatment of PageMarker or other third-party extensions.

## Commit and pull-request expectations

Write an imperative summary, explain the behavioral change, list the browsers tested, and call out storage or manifest changes clearly. Keep pull requests focused. Include a short screen recording or screenshots only when they help reviewers understand an interface change, and never include captured private browsing content.
