/** Paper Signal reminder: background behavior is quiet, local-first, and only acts on explicit user intent. */

const api = globalThis.browser ?? globalThis.chrome;
const MENU_TOGGLE = "annotaura-toggle";
const MENU_WORKSPACE = "annotaura-workspace";

async function activeTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function injectInto(tab) {
  if (!tab?.id) return;
  await api.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/annotaura-content.js"],
  });
}

async function openWorkspace() {
  await api.tabs.create({ url: api.runtime.getURL("workspace/index.html") });
}

api.action.onClicked.addListener(async (tab) => {
  try {
    await injectInto(tab);
  } catch (error) {
    console.warn("Annotaura cannot run on this page.", error);
  }
});

api.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-annotaura") return;
  try {
    await injectInto(await activeTab());
  } catch (error) {
    console.warn("Annotaura shortcut failed on this page.", error);
  }
});

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({ id: MENU_TOGGLE, title: "Annotate this page with Annotaura" });
    api.contextMenus.create({ id: MENU_WORKSPACE, title: "Open Annotaura Workspace" });
  });
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_WORKSPACE) {
    await openWorkspace();
    return;
  }
  if (info.menuItemId === MENU_TOGGLE) {
    try {
      await injectInto(tab);
    } catch (error) {
      console.warn("Annotaura cannot run on this page.", error);
    }
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "annotaura:open-workspace") {
    openWorkspace().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "annotaura:capture-visible") {
    const windowId = sender.tab?.windowId;
    api.tabs
      .captureVisibleTab(windowId, { format: "png" })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});
