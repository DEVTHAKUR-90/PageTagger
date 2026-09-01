/** Paper Signal reminder: the Workspace exposes clear local provenance and avoids cloud or hidden data flows. */
const api = globalThis.browser ?? globalThis.chrome;
const prefix = "annotaura:project:";
const state = { projects: [], view: "archive", search: "" };
const $ = (selector) => document.querySelector(selector);
const template = $("#project-template");

function count(project, layerId) { return project.layers?.find((layer) => layer.id === layerId)?.annotations?.length ?? 0; }
function annotationCount(project) { return project.layers?.reduce((sum, layer) => sum + layer.annotations.length, 0) ?? 0; }
function dateLabel(value) { try { return new Intl.DateTimeFormat(undefined,{ month:"short",day:"numeric",year:"numeric" }).format(new Date(value)); } catch { return "Unknown date"; } }
function safeName(value) { return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "project"; }

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("is-visible"), 2800);
}

async function readProjects() {
  const all = await api.storage.local.get(null);
  state.projects = Object.entries(all)
    .filter(([key, value]) => key.startsWith(prefix) && value?.kind)
    .map(([, value]) => value)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  render();
}

function matchingProjects(kind) {
  const query = state.search.trim().toLowerCase();
  return state.projects.filter((project) => {
    if (project.kind !== kind) return false;
    if (!query) return true;
    const notes = project.layers?.flatMap((layer) => layer.annotations).map((annotation) => annotation.text || "").join(" ") || "";
    return [project.name, project.source?.domain, project.source?.title, ...(project.tags || []), notes].join(" ").toLowerCase().includes(query);
  });
}

function emptyMessage(kind) {
  if (kind === "scratch") return "<div class=\"empty-card\"><strong>No scratch sheets yet.</strong><br>Create one when the idea is bigger than a single webpage.</div>";
  return "<div class=\"empty-card\"><strong>Your page archive is waiting.</strong><br>Open an ordinary webpage, activate Annotaura, place a mark, and it will appear here.</div>";
}

function makeCard(project) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.projectId = project.id;
  node.querySelector(".project-domain").textContent = project.kind === "scratch" ? "SCRATCH SHEET" : project.source?.domain || "LOCAL PAGE";
  node.querySelector("h3").textContent = project.name || project.source?.title || "Untitled project";
  node.querySelector(".project-meta").textContent = `Updated ${dateLabel(project.updatedAt)} · ${annotationCount(project)} annotations`;
  const tags = node.querySelector(".project-tags");
  (project.tags?.length ? project.tags : project.kind === "scratch" ? ["Freeform"] : ["Page-aware"]).slice(0, 3).forEach((tag) => { const chip = document.createElement("span"); chip.className = "tag"; chip.textContent = tag; tags.append(chip); });
  const stats = node.querySelector(".project-stats");
  [["Marks", count(project,"marks")], ["Notes", count(project,"notes")], ["Evidence", count(project,"evidence")]].forEach(([label, value]) => { const chip = document.createElement("span"); chip.className = "stat"; chip.textContent = `${label} ${value}`; stats.append(chip); });
  node.querySelector("[data-project-action=open]").textContent = project.kind === "scratch" ? "Open sheet" : "Open source";
  node.querySelector("[data-project-action=open]").addEventListener("click", () => openProject(project));
  node.querySelector("[data-project-action=export]").addEventListener("click", () => exportProject(project));
  node.querySelector("[data-project-action=delete]").addEventListener("click", () => deleteProject(project));
  return node;
}

function renderProjects(selector, kind) {
  const root = $(selector);
  const projects = matchingProjects(kind);
  root.innerHTML = "";
  if (!projects.length) { root.innerHTML = emptyMessage(kind); return; }
  projects.forEach((project) => root.append(makeCard(project)));
}

function render() {
  const pages = state.projects.filter((project) => project.kind === "page");
  const totalAnnotations = pages.reduce((sum, project) => sum + annotationCount(project), 0);
  $("#archive-summary").textContent = `${pages.length} page project${pages.length === 1 ? "" : "s"} · ${totalAnnotations} retained annotation${totalAnnotations === 1 ? "" : "s"}`;
  renderProjects("#project-grid", "page");
  renderProjects("#scratch-grid", "scratch");
}

async function openProject(project) {
  if (project.kind === "scratch") {
    await api.tabs.create({ url: api.runtime.getURL(`workspace/scratch.html?id=${encodeURIComponent(project.id)}`) });
    return;
  }
  if (!project.source?.canonicalUrl) { toast("This project has no page source to open."); return; }
  await api.tabs.create({ url: project.source.canonicalUrl });
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportProject(project) {
  download(`annotaura-${safeName(project.name)}.json`, JSON.stringify({ format:"annotaura-project", version:"1.0", exportedAt:new Date().toISOString(), project }, null, 2));
  toast("Project exported as JSON.");
}

async function deleteProject(project) {
  if (!confirm(`Delete “${project.name}” from this browser’s local Annotaura archive?`)) return;
  const key = project.kind === "scratch" ? `${prefix}scratch:${project.id}` : `${prefix}${project.source?.canonicalUrl}`;
  await api.storage.local.remove(key);
  await readProjects();
  toast("Local project deleted.");
}

async function newScratch() {
  const now = new Date().toISOString();
  const id = `scratch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const project = { id, kind:"scratch", name:"Untitled scratch sheet", tags:["Freeform"], createdAt:now, updatedAt:now, source:null, layers:["marks","notes","evidence"].map((id) => ({ id, name:id === "marks" ? "Marks" : id === "notes" ? "Notes" : "Evidence", visible:true, annotations:[] })) };
  await api.storage.local.set({ [`${prefix}scratch:${id}`]: project });
  await readProjects();
  await openProject(project);
}

async function importProject(file) {
  try {
    const content = JSON.parse(await file.text());
    const project = content?.project;
    if (content?.format !== "annotaura-project" || !project?.id || !project?.kind || !Array.isArray(project.layers)) throw new Error("This is not an Annotaura project file.");
    project.id = `${project.kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
    project.updatedAt = new Date().toISOString();
    const key = project.kind === "scratch" ? `${prefix}scratch:${project.id}` : `${prefix}${project.source?.canonicalUrl || project.id}`;
    await api.storage.local.set({ [key]: project });
    await readProjects();
    toast("Project imported into this browser.");
  } catch (error) { toast(error.message || "Import failed. Choose a valid Annotaura JSON export."); }
}

async function exportAll() {
  download(`annotaura-archive-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ format:"annotaura-archive", version:"1.0", exportedAt:new Date().toISOString(), projects:state.projects }, null, 2));
  toast("Full local archive exported.");
}

async function eraseAll() {
  if (!confirm("Erase every Annotaura project and all extension settings from this browser? This cannot be undone.")) return;
  const all = await api.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith("annotaura:"));
  await api.storage.local.remove(keys);
  await readProjects();
  toast("Annotaura’s local archive was erased.");
}

function selectView(view) {
  state.view = view;
  const meta = { archive:["Page archive","Project catalog"], scratch:["Scratch sheets","Freeform workspace"], privacy:["Privacy & data","Local control"] }[view];
  $("#view-title").textContent = meta[0];
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("is-active", node.id === `${view}-view`));
  document.querySelectorAll(".nav-item").forEach((node) => node.classList.toggle("is-active", node.dataset.view === view));
}

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
$("#project-search").addEventListener("input", (event) => { state.search = event.target.value; render(); });
$("#export-all").addEventListener("click", exportAll);
$("#new-scratch").addEventListener("click", newScratch);
$("#erase-all").addEventListener("click", eraseAll);
$("#import-project").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) await importProject(file); event.target.value = ""; });

readProjects().catch(() => toast("Workspace could not read local projects."));
