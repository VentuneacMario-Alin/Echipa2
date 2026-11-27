import Modal, { CloseIcon } from "./Modal.jsx";
import { StatusBadge } from "./ResourceTable.jsx";

export default function DetailDialog({ resource, category, canEdit, onClose, onEdit, onDelete }) {
  const attachments = resource.attachments || [];
  const tags = resource.tags || [];
  const meta = [
    ["Categorie", category?.name || "Fără categorie"],
    ["Tip de resursă", resource.type_name || "Nespecificat"],
    ["Locație", resource.location || "Nespecificată"],
    ["Identificator", resource.identifier || "Nespecificat"],
    ["Data achiziției", resource.acquired_on || "Nespecificată"],
    ["Ultima actualizare", resource.updated_at ? new Date(resource.updated_at).toLocaleDateString("ro-RO") : "—"],
  ];

  return (
    <Modal className="detail-dialog" labelledBy="detail-title" onClose={onClose}>
      <div className="detail-content">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">DETALII RESURSĂ</p>
            <div className="detail-title-row"><div><h2 id="detail-title">{resource.name}</h2><StatusBadge status={resource.status} /></div></div>
          </div>
          <button className="icon-button dialog-close" type="button" aria-label="Închide" onClick={onClose}><CloseIcon /></button>
        </div>
        <p className="detail-description">{resource.description || "Nu a fost adăugată o descriere."}</p>
        <dl className="detail-meta">
          {meta.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {tags.length > 0 && (
          <section className="detail-extra"><h3>Cuvinte-cheie</h3><div className="tag-list">{tags.map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</div></section>
        )}
        {attachments.length > 0 && (
          <section className="detail-extra"><h3>Linkuri și fișiere</h3>
            <div className="attachment-list">
              {attachments.map((attachment) => {
                const title = attachment.title || attachment.file_name || attachment.url || "Atașament";
                return attachment.kind === "link" && /^https?:\/\//i.test(attachment.url || "")
                  ? <a key={attachment.id} className="attachment-link" href={attachment.url} target="_blank" rel="noopener noreferrer">{title} ↗</a>
                  : <span key={attachment.id} className="attachment-link">{title}</span>;
              })}
            </div>
          </section>
        )}
        <div className="detail-actions">
          {canEdit ? <button className="button button-danger" type="button" onClick={onDelete}>Șterge</button> : <span />}
          <div className="detail-actions-group">
            <button className="button button-quiet" type="button" onClick={onClose}>Închide</button>
            {canEdit && <button className="button button-primary" type="button" onClick={onEdit}>Editează</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
