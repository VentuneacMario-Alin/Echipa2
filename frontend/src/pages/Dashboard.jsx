import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ResourceTable from "../components/ResourceTable.jsx";
import DetailDialog from "../components/DetailDialog.jsx";
import ResourceFormDialog from "../components/ResourceFormDialog.jsx";
import CategoryDialog from "../components/CategoryDialog.jsx";

export default function Dashboard() {
  const { isEditor, logout } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [resources, setResources] = useState([]);
  const [filters, setFilters] = useState({ query: "", categoryId: "", typeId: "", status: "" });
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(null);
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null); // { resource: obiect | null }
  const [categoryOpen, setCategoryOpen] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const loadCatalogs = useCallback(async () => {
    const [cats, tps] = await Promise.all([api("/resources/catalog/categories"), api("/resources/catalog/types")]);
    setCategories(cats || []);
    setTypes(tps || []);
  }, []);

  const loadResources = useCallback(async () => {
    const query = new URLSearchParams({ limit: "100" });
    if (debouncedQuery.trim()) query.set("q", debouncedQuery.trim());
    if (filters.categoryId) query.set("category_id", filters.categoryId);
    if (filters.typeId) query.set("type_id", filters.typeId);
    if (filters.status) query.set("status", filters.status);
    try {
      setResources(await api(`/resources?${query}`));
      setConnected(true);
      setError("");
    } catch (failure) {
      setConnected(false);
      setResources([]);
      setError(`Nu am putut încărca resursele. ${failure.message}`);
    }
  }, [debouncedQuery, filters.categoryId, filters.typeId, filters.status]);

  useEffect(() => {
    loadCatalogs().catch((failure) => { setConnected(false); setError(`Nu am putut încărca nomenclatoarele. ${failure.message}`); });
  }, [loadCatalogs]);

  useEffect(() => { loadResources(); }, [loadResources]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.query), 260);
    return () => clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const filtered = Boolean(filters.query || filters.categoryId || filters.typeId || filters.status);
  const selectedCategory = categories.find((item) => item.id === selected?.category_id);

  async function handleLogout() {
    if (!window.confirm("Vrei să te deconectezi?")) return;
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleDelete() {
    if (!window.confirm(`Ștergi resursa „${selected.name}”? Acțiunea nu poate fi anulată.`)) return;
    try {
      await api(`/resources/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      showToast("Resursa a fost eliminată.");
      loadResources();
    } catch (failure) {
      showToast(failure.message);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        categories={categories}
        selectedId={filters.categoryId}
        total={resources.length}
        onSelect={(id) => setFilters((current) => ({ ...current, categoryId: id }))}
        onAddCategory={() => setCategoryOpen(true)}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Bibliotecă</span><span className="breadcrumb-separator">/</span><strong>Resurse</strong></div>
          <div className="topbar-meta">
            <span className="live-dot" style={{ background: connected === false ? "#d96f51" : "#8bc09e" }}></span>
            <span>{connected === null ? "Se conectează la bibliotecă" : connected ? "Biblioteca este sincronizată" : "Conexiune indisponibilă"}</span>
          </div>
        </header>

        <section className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">RESURSELE ECHIPEI</p>
              <h1>Biblioteca de resurse</h1>
              <p className="page-description">Găsește rapid echipamente, materiale și cunoștințe pentru cercetare.</p>
            </div>
            {isEditor && (
              <button className="button button-primary" id="add-resource" type="button" onClick={() => setForm({ resource: null })}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                <span>Adaugă resursă</span>
              </button>
            )}
          </div>

          {error && <div className="notice is-error" role="status">{error}</div>}

          <section className="overview" aria-label="Sumar resurse">
            <div className="overview-item overview-total"><span className="overview-label">RESURSE AFIȘATE</span><strong>{resources.length}</strong><span className="overview-caption">în rezultatul curent</span></div>
            <div className="overview-item"><span className="overview-label">CATEGORII</span><strong>{categories.length}</strong><span className="overview-caption">domenii organizate</span></div>
            <div className="overview-item"><span className="overview-label">DISPONIBILE</span><strong>{resources.filter((item) => item.status === "disponibil").length}</strong><span className="overview-caption">gata de utilizare</span></div>
            <div className="overview-aside"><span className="overview-aside-mark">R</span><span>Un inventar comun,<br />mereu la îndemână.</span></div>
          </section>

          <section className="catalog" aria-label="Catalog de resurse">
            <div className="catalog-header">
              <div><h2>Catalog</h2><p>{filtered ? "Rezultate pentru filtrele selectate" : "Toate resursele înregistrate"}</p></div>
              <button className="button button-quiet" type="button" title="Reîncarcă lista" onClick={loadResources}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></svg>
                <span>Reîncarcă</span>
              </button>
            </div>

            <div className="filters">
              <label className="search-field">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <span className="visually-hidden">Caută resurse</span>
                <input ref={searchRef} type="search" placeholder="Caută după denumire sau cuvinte-cheie…" autoComplete="off" value={filters.query} onChange={setFilter("query")} />
                <kbd>/</kbd>
              </label>
              <label className="filter-select"><span className="visually-hidden">Filtrează după categorie</span>
                <select value={filters.categoryId} onChange={setFilter("categoryId")}><option value="">Toate categoriile</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </label>
              <label className="filter-select"><span className="visually-hidden">Filtrează după tip</span>
                <select value={filters.typeId} onChange={setFilter("typeId")}><option value="">Toate tipurile</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </label>
              <label className="filter-select"><span className="visually-hidden">Filtrează după status</span>
                <select value={filters.status} onChange={setFilter("status")}><option value="">Orice status</option><option value="disponibil">Disponibil</option><option value="in_utilizare">În utilizare</option><option value="mentenanta">În mentenanță</option><option value="retras">Retras</option></select>
              </label>
            </div>

            <ResourceTable resources={resources} categories={categories} filtered={filtered} canEdit={isEditor} onOpen={setSelected} onAdd={() => setForm({ resource: null })} />
            <div className="catalog-footer"><span>{resources.length} {resources.length === 1 ? "rezultat" : "rezultate"}</span><span className="footer-hint">Selectează o resursă pentru detalii</span></div>
          </section>

          <footer className="page-footer"><span>FIELDNOTES <span className="footer-dot">·</span> RESEARCH RESOURCE MANAGER</span><span>Informații centralizate pentru cercetare</span></footer>
        </section>
      </main>

      {selected && !form && (
        <DetailDialog
          resource={selected}
          category={selectedCategory}
          canEdit={isEditor}
          onClose={() => setSelected(null)}
          onEdit={() => setForm({ resource: selected })}
          onDelete={handleDelete}
        />
      )}
      {form && (
        <ResourceFormDialog
          resource={form.resource}
          categories={categories}
          types={types}
          onClose={() => setForm(null)}
          onSaved={(message) => { setForm(null); setSelected(null); showToast(message); loadResources(); }}
        />
      )}
      {categoryOpen && (
        <CategoryDialog
          categories={categories}
          onClose={() => setCategoryOpen(false)}
          onSaved={(message) => { setCategoryOpen(false); showToast(message); loadCatalogs(); }}
        />
      )}

      <div className={`toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
