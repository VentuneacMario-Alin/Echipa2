import { useState } from "react";
import { api } from "../api.js";
import Modal, { CloseIcon } from "./Modal.jsx";

function initialValues(resource) {
  return {
    name: resource?.name || "",
    category_id: resource?.category_id || "",
    type_id: resource?.type_id || "",
    status: resource?.status || "disponibil",
    location: resource?.location || "",
    identifier: resource?.identifier || "",
    acquired_on: resource?.acquired_on || "",
    description: resource?.description || "",
    tags: (resource?.tags || []).join(", "),
  };
}

export default function ResourceFormDialog({ resource, categories, types, onClose, onSaved }) {
  const [values, setValues] = useState(() => initialValues(resource));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(resource ? `/resources/${resource.id}` : "/resources", {
        method: resource ? "PATCH" : "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim() || null,
          type_id: Number(values.type_id),
          category_id: Number(values.category_id) || null,
          status: values.status,
          location: values.location.trim() || null,
          identifier: values.identifier.trim() || null,
          acquired_on: values.acquired_on || null,
          tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      onSaved(resource ? "Resursa a fost actualizată." : "Resursa a fost adăugată.");
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy="resource-dialog-title" onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="eyebrow">{resource ? "EDITEAZĂ RESURSA" : "RESURSĂ NOUĂ"}</p><h2 id="resource-dialog-title">{resource ? "Actualizează resursa" : "Adaugă o resursă"}</h2></div>
          <button className="icon-button dialog-close" type="button" aria-label="Închide" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="form-grid">
          <label className="form-field field-wide"><span>Denumire <b>*</b></span><input required maxLength={200} placeholder="Ex. Microscop digital Leica" value={values.name} onChange={set("name")} /></label>
          <label className="form-field"><span>Categorie</span>
            <select value={values.category_id} onChange={set("category_id")}><option value="">Fără categorie</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="form-field"><span>Tip de resursă <b>*</b></span>
            <select required value={values.type_id} onChange={set("type_id")}><option value="">Selectează tipul</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label className="form-field"><span>Status</span>
            <select value={values.status} onChange={set("status")}><option value="disponibil">Disponibil</option><option value="in_utilizare">În utilizare</option><option value="mentenanta">În mentenanță</option><option value="retras">Retras</option></select>
          </label>
          <label className="form-field"><span>Locație</span><input maxLength={200} placeholder="Laborator, sală, URL…" value={values.location} onChange={set("location")} /></label>
          <label className="form-field"><span>Identificator</span><input maxLength={100} placeholder="Nr. inventar, DOI, ISBN…" value={values.identifier} onChange={set("identifier")} /></label>
          <label className="form-field"><span>Data achiziției</span><input type="date" value={values.acquired_on} onChange={set("acquired_on")} /></label>
          <label className="form-field field-wide"><span>Descriere</span><textarea rows={3} placeholder="Detalii care ajută echipa să identifice și să folosească resursa." value={values.description} onChange={set("description")} /></label>
          <label className="form-field field-wide"><span>Cuvinte-cheie <small>separate prin virgulă</small></span><input placeholder="microscopie, imagistică, celule" value={values.tags} onChange={set("tags")} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Anulează</button>
          <button className="button button-primary" type="submit" disabled={busy}>{resource ? "Salvează modificările" : "Salvează resursa"}</button>
        </div>
      </form>
    </Modal>
  );
}
