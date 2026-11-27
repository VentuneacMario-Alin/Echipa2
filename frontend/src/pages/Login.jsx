import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard", { replace: true });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCES SECURIZAT"
      title="Conectare"
      intro="Introdu datele contului pentru a accesa biblioteca de resurse."
      footer={<>Nu ai cont? <Link to="/register">Creează un cont</Link></>}
    >
      <form onSubmit={submit}>
        <label className="form-field"><span>E-mail</span>
          <input type="email" required autoComplete="username" value={form.email} onChange={update("email")} />
        </label>
        <label className="form-field"><span>Parolă</span>
          <input type="password" required autoComplete="current-password" value={form.password} onChange={update("password")} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy ? "Se conectează…" : "Conectare"}
        </button>
      </form>
    </AuthLayout>
  );
}
