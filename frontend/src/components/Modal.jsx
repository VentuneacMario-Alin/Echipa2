import { useEffect, useRef } from "react";

export function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

// Dialog nativ <dialog>, montat doar cat timp este deschis.
export default function Modal({ onClose, className = "", labelledBy, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      {children}
    </dialog>
  );
}
