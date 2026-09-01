# Annotaura Privacy Statement

**Effective date:** August 28, 2026

Annotaura is a local-first browser extension. The Release 1 extension does not require an account, does not include remote synchronization, and does not send annotation content or browsing data to an Annotaura-operated server.

## Information stored locally

Annotaura stores user-created project data using browser extension storage. A page project can contain the page title, page URL after removal of common tracking parameters and fragments, a domain label, save timestamps, tags chosen by the user, vector mark geometry, note text entered by the user, evidence-stamp values, and the extension’s own settings. A Scratch Sheet contains the same user-created annotation data but does not include a page URL.

The extension does not copy the complete text, forms, account information, credentials, cookies, or browsing history from the webpages it annotates. When a user creates a text note while they have deliberately selected text on a page, the selected quote can be recorded as context for that note. The user controls this by deciding what text to select and annotate.

## Data transmission

Release 1 does not transmit project data, settings, URLs, note content, or telemetry to an Annotaura server. It does not use analytics, advertising SDKs, remote code, or remote font loading. Standard browser-store pages and the GitHub project page may have their own privacy practices, which are outside the installed extension’s local operation.

## User control

Users can export individual projects or the full archive as JSON from the Workspace. Users can delete a single project or erase all Annotaura data from the Privacy & data view. Browser-level removal of the extension may also remove locally stored extension data; users who need retention should export an archive before uninstalling.

## Permissions

Annotaura uses `activeTab` and scripting only after the user asks to annotate the active page. It uses storage for local projects and settings, downloads when the user explicitly exports a file, and context menus to provide user-initiated actions. It does not request access to cookies, browsing history, microphone, camera, clipboard reading, account identity, or broad remote hosts.

## Future changes

Any future cloud synchronization, collaboration, analytics, or third-party integration must be opt-in, separately documented, and released with an updated privacy statement. Release 1 does not include those capabilities.

## Contact

Before public release, replace this paragraph with your project’s support email address or GitHub issue tracker URL. Do not publish a support address you do not actively monitor.
