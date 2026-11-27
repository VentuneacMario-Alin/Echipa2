import { colorForCategory } from "./Sidebar.jsx";

export const statusLabels = {
  disponibil: "Disponibil",
  in_utilizare: "În utilizare",
  mentenanta: "În mentenanță",
  retras: "Retras",
};
export const statusClasses = { disponibil: "available", in_utilizare: "in_use", mentenanta: "maintenance", retras: "retired" };

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${statusClasses[status] || "retired"}`}>{statusLabels[status] || status}</span>;
}

export default function ResourceTable({ resources, categories, filtered, canEdit, onOpen, onAdd }) {
  const categoryIndex = (id) => Math.max(0, categories.findIndex((item) => item.id === id));
  const onKeyDown = (event, resource) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(resource);
    }
  };

  return (
    <div className={`table-wrap${resources.length ? "" : " is-empty"}`}>
      <table className="resource-table">
        <thead>
          <tr><th scope="col">RESURSĂ</th><th scope="col">CATEGORIE</th><th scope="col">TIP</th><th scope="col">STATUS</th><th scope="col">LOCAȚIE</th><th scope="col"><span className="visually-hidden">Detalii</span></th></tr>
        </thead>
        <tbody>
          {resources.map((resource, index) => {
            const category = categories.find((item) => item.id === resource.category_id);
            return (
              <tr key={resource.id} className="resource-row" tabIndex={0} role="button" aria-label={`Detalii pentru ${resource.name}`}
                onClick={() => onOpen(resource)} onKeyDown={(event) => onKeyDown(event, resource)}>
                <td data-label="Resursă"><div className="resource-primary"><span className="resource-symbol" style={{ color: colorForCategory(index) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h9l5 5v10H5z" /><path d="M14 4.5v5h5M8 14h8M8 17h5" /></svg></span><span className="resource-copy"><strong>{resource.name}</strong><span>{resource.description || resource.identifier || "Fără descriere"}</span></span></div></td>
                <td data-label="Categorie"><span className="category-cell"><i className="category-dot" style={{ "--category-color": colorForCategory(categoryIndex(resource.category_id)) }}></i>{category?.name || "Fără categorie"}</span></td>
                <td data-label="Tip"><span className="type-cell">{resource.type_name || "Nespecificat"}</span></td>
                <td data-label="Status"><StatusBadge status={resource.status} /></td>
                <td data-label="Locație"><span className="location-cell">{resource.location || "—"}</span></td>
                <td aria-hidden="true"><svg className="row-arrow" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {resources.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5z" /><path d="m4 6.5 8 3.7 8-3.7M12 10.2V21" /></svg></span>
          <h3>{filtered ? "Nicio resursă găsită" : "Biblioteca începe aici"}</h3>
          <p>{filtered ? "Încearcă alți termeni de căutare sau elimină unul dintre filtre." : "Adaugă prima resursă pentru a începe inventarul comun al echipei."}</p>
          {!filtered && canEdit && <button className="button button-secondary" type="button" onClick={onAdd}>Adaugă o resursă</button>}
        </div>
      )}
    </div>
  );
}
