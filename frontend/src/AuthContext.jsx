import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "./api.js";

const AuthContext = createContext(null);
const STORAGE_KEY = "rrm-user";

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);
  const [checking, setChecking] = useState(Boolean(readStoredUser()));

  const setUser = useCallback((next) => {
    setUserState(next);
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, [setUser]);

  // Verifica ca sesiunea (cookie-ul) stocata este inca valida.
  useEffect(() => {
    if (!readStoredUser()) return;
    api("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [setUser]);

  const login = useCallback(async (email, password) => {
    const loggedIn = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setUser(loggedIn);
    return loggedIn;
  }, [setUser]);

  const register = useCallback(async (name, email, password) => {
    await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
    // Inregistrarea nu seteaza cookie-ul, deci autentificam imediat utilizatorul.
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Elimina sesiunea locala chiar daca serverul nu raspunde.
    }
    setUser(null);
  }, [setUser]);

  const value = useMemo(
    () => ({ user, checking, login, register, logout, isEditor: ["admin", "editor"].includes(user?.role) }),
    [user, checking, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
