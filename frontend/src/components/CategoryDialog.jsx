import { useState } from "react";
import { api } from "../api.js";
import Modal, { CloseIcon } from "./Modal.jsx";

export default function CategoryDialog({ categories, onClose, onSaved }) {
  const [values, setValues] = useState({ name: "", parent_id: "", description: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/resources/catalog/categories", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          parent_id: Number(values.parent_id) || null,
          description: values.description.trim() || null,
        }),
      });
      onSaved("Categoria a fost adăugată.");
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <Modal className="compact-dialog" labelledBy="category-title" onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="eyebrow">ORGANIZARE</p><h2 id="category-title">Categorie nouă</h2></div>
          <button className="icon-button dialog-close" type="button" aria-label="Închide" onClick={onClose}><CloseIcon /></button>
        </div>
        <label className="form-field"><span>Denumire <b>*</b></span><input required maxLength={100} placeholder="Ex. Genetică" value={values.name} onChange={set("name")} /></label>
        <label className="form-field"><span>Categorie părinte</span>
          <select value={values.parent_id} onChange={set("parent_id")}><option value="">Categorie principală</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </label>
        <label className="form-field"><span>Descriere</span><textarea rows={3} placeholder="Scurtă descriere a categoriei." value={values.description} onChange={set("description")} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Anulează</button>
          <button className="button button-primary" type="submit" disabled={busy}>Salvează categoria</button>
        </div>
      </form>
    </Modal>
  );
}
