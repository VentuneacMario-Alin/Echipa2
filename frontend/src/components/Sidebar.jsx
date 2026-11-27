import { useMemo } from "react";
import { useAuth } from "../AuthContext.jsx";

const categoryColors = ["#e7a084", "#8db6a0", "#82a8bd", "#d8b15f", "#a597c5", "#cf8d91", "#81b5a9"];
export const colorForCategory = (index) => categoryColors[index % categoryColors.length];

export default function Sidebar({ categories, selectedId, total, onSelect, onAddCategory, onLogout }) {
  const { user, isEditor } = useAuth();

  // Ordonare ierarhica: categoria parinte urmata de copiii ei.
  const ordered = useMemo(() => {
    const children = new Map();
    for (const category of categories.filter((item) => item.parent_id)) {
      children.set(category.parent_id, [...(children.get(category.parent_id) || []), category]);
    }
    const result = [];
    const visit = (category, depth) => {
      result.push({ category, depth });
      (children.get(category.id) || []).forEach((child) => visit(child, depth + 1));
    };
    categories.filter((item) => !item.parent_id).forEach((root) => visit(root, 0));
    return result;
  }, [categories]);

  return (
    <aside className="sidebar" aria-label="Navigare principală">
      <a className="brand" href="/dashboard" aria-label="Research Resource Manager, pagina principală">
        <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span className="brand-name">fieldnotes<span>RESEARCH RESOURCE MANAGER</span></span>
      </a>

      <div className="side-section">
        <p className="side-label">Spațiul echipei</p>
        <button className={`nav-link${selectedId ? "" : " is-current"}`} type="button" onClick={() => onSelect("")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /><rect x="14" y="15" width="7" height="6" rx="1" /></svg>
          <span>Toate resursele</span><span className="nav-count">{total}</span>
        </button>
      </div>

      <div className="side-section categories-section">
        <div className="side-heading">
          <p className="side-label">Categorii</p>
          {isEditor && (
            <button className="icon-button side-add" type="button" aria-label="Adaugă categorie" title="Adaugă categorie" onClick={onAddCategory}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          )}
        </div>
        <nav className="category-list" aria-label="Filtrează după categorie">
          {ordered.map(({ category, depth }, index) => (
            <button
              key={category.id}
              type="button"
              className={`category-link${depth ? " child-category" : ""}${String(category.id) === String(selectedId) ? " is-selected" : ""}`}
              style={{ "--category-color": colorForCategory(index), "--category-depth": depth }}
              title={`Filtrează: ${category.name}`}
              onClick={() => onSelect(String(category.id))}
            >
              <span className="category-dot"></span><span className="category-name">{category.name}</span>
            </button>
          ))}
        </nav>
        {ordered.length === 0 && <p className="category-empty">Nu există categorii încă.</p>}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-note"><span className="status-pulse"></span><span>Bibliotecă de cercetare</span></div>
        <button className="account-button" type="button" onClick={onLogout} title="Deconectare">
          <span className="account-avatar">{(user?.name || "U").trim().charAt(0).toUpperCase()}</span>
          <span className="account-copy"><strong>{user?.name}</strong><small>{isEditor ? "Editor" : "Doar consultare"} · Deconectare</small></span>
          <svg className="account-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </aside>
  );
}
