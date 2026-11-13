const state = {
  resources: [],
  categories: [],
  types: [],
  categoryId: "",
  status: "",
  typeId: "",
  query: "",
  user: readStoredUser(),
  selectedResource: null,
  editingResource: null,
};

const categoryColors = ["#e7a084", "#8db6a0", "#82a8bd", "#d8b15f", "#a597c5", "#cf8d91", "#81b5a9"];
const statusLabels = {
  disponibil: "Disponibil",
  in_utilizare: "În utilizare",
  mentenanta: "În mentenanță",
  retras: "Retras",
};
const elements = {
  rows: document.querySelector("#resource-rows"),
  empty: document.querySelector("#empty-state"),
  notice: document.querySelector("#notice"),
  search: document.querySelector("#search-input"),
  categoryFilter: document.querySelector("#category-filter"),
  typeFilter: document.querySelector("#type-filter"),
  statusFilter: document.querySelector("#status-filter"),
  resourceDialog: document.querySelector("#resource-dialog"),
  resourceForm: document.querySelector("#resource-form"),
  detailDialog: document.querySelector("#detail-dialog"),
  authDialog: document.querySelector("#auth-dialog"),
  authForm: document.querySelector("#auth-form"),
  categoryDialog: document.querySelector("#category-dialog"),
  categoryForm: document.querySelector("#category-form"),
  toast: document.querySelector("#toast"),
};

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("rrm-user")) || null;
  } catch {
    return null;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) setUser(null);
    }
    const detail = payload?.detail;
    throw new Error(typeof detail === "string" ? detail : "Cererea nu a putut fi finalizată.");
  }
  return payload;
}

function setUser(user) {
  state.user = user;
  if (user) sessionStorage.setItem("rrm-user", JSON.stringify(user));
  else sessionStorage.removeItem("rrm-user");
  renderAccount();
}

function isEditor() {
  return ["admin", "editor"].includes(state.user?.role);
}

function renderAccount() {
  const name = document.querySelector("#account-name");
  const role = document.querySelector("#account-role");
  const avatar = document.querySelector("#account-avatar");
  if (!state.user) {
    name.textContent = "Conectare";
    role.textContent = "Acces la administrare";
    avatar.textContent = "?";
    return;
  }
  name.textContent = state.user.name;
  role.textContent = isEditor() ? "Editor" : "Doar consultare";
  avatar.textContent = (state.user.name || "U").trim().charAt(0).toUpperCase();
}

function setNotice(message = "", isError = false) {
  elements.notice.hidden = !message;
  elements.notice.textContent = message;
  elements.notice.classList.toggle("is-error", isError);
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}

function colorForCategory(index) {
  return categoryColors[index % categoryColors.length];
}

function categoryColor(categoryId) {
  const index = state.categories.findIndex((category) => category.id === categoryId);
  return colorForCategory(Math.max(0, index));
}

function categoryResourceCount(categoryId) {
  return state.resources.filter((resource) => resource.category_id === categoryId).length;
}

function renderCategories() {
  const nav = document.querySelector("#category-list");
  const empty = document.querySelector("#category-empty");
  const selected = state.categoryId;
  const roots = state.categories.filter((category) => !category.parent_id);
  const children = new Map();
  for (const category of state.categories.filter((item) => item.parent_id)) {
    const siblings = children.get(category.parent_id) || [];
    siblings.push(category);
    children.set(category.parent_id, siblings);
  }
  nav.innerHTML = "";
  let colorIndex = 0;
  const appendCategory = (category, depth) => {
    nav.insertAdjacentHTML("beforeend", categoryButton(category, depth, colorForCategory(colorIndex++)));
    for (const child of children.get(category.id) || []) {
      appendCategory(child, depth + 1);
    }
  };
  roots.forEach((root) => appendCategory(root, 0));
  document.querySelector("#all-resources").classList.toggle("is-current", !selected);
  empty.hidden = roots.length > 0;
  document.querySelectorAll(".category-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.categoryId = button.dataset.categoryId || "";
      elements.categoryFilter.value = state.categoryId;
      renderCategories();
      loadResources();
    });
  });
}

function categoryButton(category, depth, color) {
  const active = String(category.id) === state.categoryId;
  return `<button class="category-link${depth ? " child-category" : ""}${active ? " is-selected" : ""}" style="--category-color:${color};--category-depth:${depth}" type="button" data-category-id="${category.id}" title="Filtrează: ${escapeHtml(category.name)}">
    <span class="category-dot"></span><span class="category-name">${escapeHtml(category.name)}</span>
  </button>`;
}

function fillSelect(select, items, firstLabel, selectedValue = "") {
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + items.map((item) =>
    `<option value="${item.id}"${String(item.id) === String(selectedValue) ? " selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");
}

function renderCatalogOptions() {
  fillSelect(elements.categoryFilter, state.categories, "Toate categoriile", state.categoryId);
  fillSelect(elements.typeFilter, state.types, "Toate tipurile", state.typeId);
  fillSelect(elements.resourceForm.elements.category_id, state.categories, "Fără categorie");
  fillSelect(elements.resourceForm.elements.type_id, state.types, "Selectează tipul");
  fillSelect(elements.categoryForm.elements.parent_id, state.categories, "Categorie principală");
}

async function loadCatalogs() {
  const [categories, types] = await Promise.all([
    api("/resources/catalog/categories"),
    api("/resources/catalog/types"),
  ]);
  state.categories = categories;
  state.types = types;
  renderCatalogOptions();
  renderCategories();
}

async function loadResources() {
  const query = new URLSearchParams({ limit: "100" });
  if (state.query.trim()) query.set("q", state.query.trim());
  if (state.categoryId) query.set("category_id", state.categoryId);
  if (state.typeId) query.set("type_id", state.typeId);
  if (state.status) query.set("status", state.status);
  try {
    const resources = await api(`/resources?${query}`);
    state.resources = resources;
    document.querySelector("#connection-label").textContent = "Biblioteca este sincronizată";
    document.querySelector(".topbar-meta .live-dot").style.background = "#8bc09e";
    setNotice("");
    renderResources();
  } catch (error) {
    document.querySelector("#connection-label").textContent = "Conexiune indisponibilă";
    document.querySelector(".topbar-meta .live-dot").style.background = "#d96f51";
    setNotice(`Nu am putut încărca resursele. ${error.message}`, true);
    state.resources = [];
    renderResources();
  }
}

function renderResources() {
  const resources = state.resources;
  const tbody = elements.rows;
  tbody.innerHTML = resources.map((resource, index) => {
    const category = state.categories.find((item) => item.id === resource.category_id);
    const statusClass = ({ disponibil: "available", in_utilizare: "in_use", mentenanta: "maintenance", retras: "retired" })[resource.status] || "retired";
    return `<tr class="resource-row" tabindex="0" role="button" data-resource-id="${resource.id}" aria-label="Detalii pentru ${escapeHtml(resource.name)}">
      <td data-label="Resursă"><div class="resource-primary"><span class="resource-symbol" style="color:${colorForCategory(index)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h9l5 5v10H5z"/><path d="M14 4.5v5h5M8 14h8M8 17h5"/></svg></span><span class="resource-copy"><strong>${escapeHtml(resource.name)}</strong><span>${escapeHtml(resource.description || resource.identifier || "Fără descriere")}</span></span></div></td>
      <td data-label="Categorie"><span class="category-cell"><i class="category-dot" style="--category-color:${categoryColor(resource.category_id)}"></i>${escapeHtml(category?.name || "Fără categorie")}</span></td>
      <td data-label="Tip"><span class="type-cell">${escapeHtml(resource.type_name || "Nespecificat")}</span></td>
      <td data-label="Status"><span class="status-badge status-${statusClass}">${escapeHtml(statusLabels[resource.status] || resource.status)}</span></td>
      <td data-label="Locație"><span class="location-cell">${escapeHtml(resource.location || "—")}</span></td>
      <td aria-hidden="true"><svg class="row-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></td>
    </tr>`;
  }).join("");
  const hasRows = resources.length > 0;
  elements.empty.hidden = hasRows;
  document.querySelector("#table-wrap").classList.toggle("is-empty", !hasRows);
  document.querySelector("#stat-total").textContent = resources.length;
  document.querySelector("#stat-categories").textContent = state.categories.length;
  document.querySelector("#stat-available").textContent = resources.filter((resource) => resource.status === "disponibil").length;
  document.querySelector("#sidebar-total").textContent = resources.length;
  document.querySelector("#footer-count").textContent = `${resources.length} ${resources.length === 1 ? "rezultat" : "rezultate"}`;
  const filtered = state.query || state.categoryId || state.typeId || state.status;
  document.querySelector("#result-caption").textContent = filtered ? "Rezultate pentru filtrele selectate" : "Toate resursele înregistrate";
  document.querySelector("#empty-title").textContent = filtered ? "Nicio resursă găsită" : "Biblioteca începe aici";
  document.querySelector("#empty-description").textContent = filtered
    ? "Încearcă alți termeni de căutare sau elimină unul dintre filtre."
    : "Adaugă prima resursă pentru a începe inventarul comun al echipei.";
  document.querySelector("#empty-add").hidden = Boolean(filtered);
  renderCategories();
}

function requireEditor() {
  if (isEditor()) return true;
  if (state.user) {
    showToast("Contul are acces doar la consultare. Este necesar rolul editor sau administrator.");
  } else {
    document.querySelector("#auth-error").hidden = true;
    elements.authDialog.showModal();
  }
  return false;
}

function openResourceForm(resource = null) {
  if (!requireEditor()) return;
  state.editingResource = resource;
  elements.resourceForm.reset();
  document.querySelector("#resource-error").hidden = true;
  document.querySelector("#resource-dialog-kicker").textContent = resource ? "EDITEAZĂ RESURSA" : "RESURSĂ NOUĂ";
  document.querySelector("#resource-dialog-title").textContent = resource ? "Actualizează resursa" : "Adaugă o resursă";
  document.querySelector("#resource-submit").textContent = resource ? "Salvează modificările" : "Salvează resursa";
  if (resource) {
    for (const field of ["name", "description", "status", "location", "identifier", "acquired_on"]) {
      elements.resourceForm.elements[field].value = resource[field] || "";
    }
    elements.resourceForm.elements.category_id.value = resource.category_id || "";
    elements.resourceForm.elements.type_id.value = resource.type_id || "";
    elements.resourceForm.elements.tags.value = (resource.tags || []).join(", ");
  }
  elements.resourceDialog.showModal();
}

function openDetail(resourceId) {
  const resource = state.resources.find((item) => item.id === Number(resourceId));
  if (!resource) return;
  state.selectedResource = resource;
  const category = state.categories.find((item) => item.id === resource.category_id);
  const statusClass = ({ disponibil: "available", in_utilizare: "in_use", mentenanta: "maintenance", retras: "retired" })[resource.status] || "retired";
  const attachments = (resource.attachments || []).map((attachment) => {
    const title = escapeHtml(attachment.title || attachment.file_name || attachment.url || "Atașament");
    if (attachment.kind === "link" && /^https?:\/\//i.test(attachment.url || "")) {
      return `<a class="attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`;
    }
    return `<span class="attachment-link">${title}</span>`;
  }).join("");
  const tags = (resource.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("");
  document.querySelector("#detail-content").innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">DETALII RESURSĂ</p><div class="detail-title-row"><div><h2 id="detail-title">${escapeHtml(resource.name)}</h2><span class="status-badge status-${statusClass}">${escapeHtml(statusLabels[resource.status] || resource.status)}</span></div></div></div><button class="icon-button dialog-close" type="button" data-close="detail-dialog" aria-label="Închide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    <p class="detail-description">${escapeHtml(resource.description || "Nu a fost adăugată o descriere.")}</p>
    <dl class="detail-meta"><div><dt>Categorie</dt><dd>${escapeHtml(category?.name || "Fără categorie")}</dd></div><div><dt>Tip de resursă</dt><dd>${escapeHtml(resource.type_name || "Nespecificat")}</dd></div><div><dt>Locație</dt><dd>${escapeHtml(resource.location || "Nespecificată")}</dd></div><div><dt>Identificator</dt><dd>${escapeHtml(resource.identifier || "Nespecificat")}</dd></div><div><dt>Data achiziției</dt><dd>${escapeHtml(resource.acquired_on || "Nespecificată")}</dd></div><div><dt>Ultima actualizare</dt><dd>${escapeHtml(resource.updated_at ? new Date(resource.updated_at).toLocaleDateString("ro-RO") : "—")}</dd></div></dl>
    ${tags ? `<section class="detail-extra"><h3>Cuvinte-cheie</h3><div class="tag-list">${tags}</div></section>` : ""}
    ${attachments ? `<section class="detail-extra"><h3>Linkuri și fișiere</h3><div class="attachment-list">${attachments}</div></section>` : ""}
    <div class="detail-actions"><button class="button button-danger" type="button" id="delete-resource" ${isEditor() ? "" : "hidden"}>Șterge</button><div class="detail-actions-group"><button class="button button-quiet" type="button" data-close="detail-dialog">Închide</button><button class="button button-primary" type="button" id="edit-resource" ${isEditor() ? "" : "hidden"}>Editează</button></div></div>`;
  elements.detailDialog.showModal();
}

function populateResourcePayload() {
  const form = elements.resourceForm.elements;
  return {
    name: form.name.value.trim(),
    description: form.description.value.trim() || null,
    type_id: Number(form.type_id.value),
    category_id: Number(form.category_id.value) || null,
    status: form.status.value,
    location: form.location.value.trim() || null,
    identifier: form.identifier.value.trim() || null,
    acquired_on: form.acquired_on.value || null,
    tags: form.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

async function saveResource(event) {
  event.preventDefault();
  if (!requireEditor()) return;
  const error = document.querySelector("#resource-error");
  error.hidden = true;
  const resource = state.editingResource;
  const path = resource ? `/resources/${resource.id}` : "/resources";
  try {
    await api(path, { method: resource ? "PATCH" : "POST", body: JSON.stringify(populateResourcePayload()) });
    elements.resourceDialog.close();
    elements.detailDialog.close();
    showToast(resource ? "Resursa a fost actualizată." : "Resursa a fost adăugată.");
    await loadResources();
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
}

async function saveCategory(event) {
  event.preventDefault();
  if (!requireEditor()) return;
  const form = elements.categoryForm.elements;
  const error = document.querySelector("#category-error");
  error.hidden = true;
  try {
    await api("/resources/catalog/categories", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.value.trim(),
        parent_id: Number(form.parent_id.value) || null,
        description: form.description.value.trim() || null,
      }),
    });
    elements.categoryDialog.close();
    elements.categoryForm.reset();
    await loadCatalogs();
    showToast("Categoria a fost adăugată.");
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
}

async function login(event) {
  event.preventDefault();
  const error = document.querySelector("#auth-error");
  error.hidden = true;
  const form = elements.authForm.elements;
  try {
    const user = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value }),
    });
    setUser(user);
    elements.authDialog.close();
    elements.authForm.reset();
    showToast(isEditor() ? "Conectare reușită. Poți administra resursele." : "Conectare reușită. Contul are acces doar la consultare.");
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Elimină datele locale de sesiune chiar dacă serverul nu răspunde.
  }
  setUser(null);
  showToast("Ai ieșit din cont.");
}

async function deleteResource() {
  const resource = state.selectedResource;
  if (!resource || !requireEditor()) return;
  if (!window.confirm(`Ștergi resursa „${resource.name}”? Acțiunea nu poate fi anulată.`)) return;
  try {
    await api(`/resources/${resource.id}`, { method: "DELETE" });
    elements.detailDialog.close();
    showToast("Resursa a fost eliminată.");
    await loadResources();
  } catch (error) {
    showToast(error.message);
  }
}

let searchTimer;
elements.search.addEventListener("input", () => {
  state.query = elements.search.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadResources, 260);
});
elements.categoryFilter.addEventListener("change", () => {
  state.categoryId = elements.categoryFilter.value;
  renderCategories();
  loadResources();
});
elements.typeFilter.addEventListener("change", () => { state.typeId = elements.typeFilter.value; loadResources(); });
elements.statusFilter.addEventListener("change", () => { state.status = elements.statusFilter.value; loadResources(); });
document.querySelector("#all-resources").addEventListener("click", () => {
  state.categoryId = "";
  elements.categoryFilter.value = "";
  renderCategories();
  loadResources();
});
document.querySelector("#add-resource").addEventListener("click", () => openResourceForm());
document.querySelector("#empty-add").addEventListener("click", () => openResourceForm());
document.querySelector("#add-category").addEventListener("click", () => {
  if (!requireEditor()) return;
  elements.categoryForm.reset();
  document.querySelector("#category-error").hidden = true;
  elements.categoryDialog.showModal();
});
document.querySelector("#refresh-resources").addEventListener("click", loadResources);
document.querySelector("#resource-rows").addEventListener("click", (event) => {
  const row = event.target.closest("[data-resource-id]");
  if (row) openDetail(row.dataset.resourceId);
});
document.querySelector("#resource-rows").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-resource-id]")) {
    event.preventDefault();
    openDetail(event.target.dataset.resourceId);
  }
});
document.querySelector("#detail-content").addEventListener("click", (event) => {
  if (event.target.closest("#edit-resource")) openResourceForm(state.selectedResource);
  if (event.target.closest("#delete-resource")) deleteResource();
});
document.querySelector("#auth-button").addEventListener("click", () => {
  if (!state.user) {
    document.querySelector("#auth-error").hidden = true;
    elements.authDialog.showModal();
  } else if (window.confirm("Vrei să te deconectezi?")) {
    logout();
  }
});
elements.resourceForm.addEventListener("submit", saveResource);
elements.categoryForm.addEventListener("submit", saveCategory);
elements.authForm.addEventListener("submit", login);
document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) document.getElementById(closeButton.dataset.close).close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === "Escape") {
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  }
});

renderAccount();
loadCatalogs().then(loadResources).catch((error) => {
  setNotice(`Nu am putut încărca nomenclatoarele. ${error.message}`, true);
  document.querySelector("#connection-label").textContent = "Conexiune indisponibilă";
  elements.empty.hidden = false;
  document.querySelector("#empty-title").textContent = "Backend indisponibil";
  document.querySelector("#empty-description").textContent = "Pornește API-ul Research Resource Manager și reîncarcă pagina.";
  document.querySelector("#empty-add").hidden = true;
});