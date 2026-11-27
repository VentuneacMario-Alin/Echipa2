export default function AuthLayout({ eyebrow, title, intro, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span className="brand-name">fieldnotes<span>RESEARCH RESOURCE MANAGER</span></span>
        </div>
        <p className="auth-tagline">Un inventar comun,<br />mereu la îndemână.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="dialog-intro auth-intro">{intro}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}
