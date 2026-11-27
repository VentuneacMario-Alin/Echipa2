import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (form.password !== form.confirm) return setError("Parolele nu coincid.");
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/dashboard", { replace: true });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="CONT NOU"
      title="Înregistrare"
      intro="Creează un cont pentru a consulta resursele echipei."
      footer={<>Ai deja cont? <Link to="/login">Conectează-te</Link></>}
    >
      <form onSubmit={submit}>
        <label className="form-field"><span>Nume</span>
          <input required maxLength={120} autoComplete="name" value={form.name} onChange={update("name")} />
        </label>
        <label className="form-field"><span>E-mail</span>
          <input type="email" required autoComplete="username" value={form.email} onChange={update("email")} />
        </label>
        <label className="form-field"><span>Parolă <small>minim 8 caractere</small></span>
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={update("password")} />
        </label>
        <label className="form-field"><span>Confirmă parola</span>
          <input type="password" required autoComplete="new-password" value={form.confirm} onChange={update("confirm")} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy ? "Se creează contul…" : "Creează cont"}
        </button>
      </form>
    </AuthLayout>
  );
}
