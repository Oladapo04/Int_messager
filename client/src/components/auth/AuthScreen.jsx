import { useMemo, useState } from "react";
import {
  forgotPassword,
  login,
  register,
  resetPassword,
} from "../../services/authService";

function getResetParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("resetToken") || "",
    email: params.get("email") || "",
  };
}

export default function AuthScreen({ onAuthenticated, legacyInstallId }) {
  const resetParams = useMemo(getResetParams, []);
  const [mode, setMode] = useState(resetParams.token ? "reset" : "login");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState(resetParams.email);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");

  function keepAuthFieldVisible(event) {
    const field = event.currentTarget;
    window.setTimeout(() => {
      field.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 280);
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setAuthError("");
    setAuthMessage("");
    setPassword("");
    setConfirmPassword("");
    setDevelopmentResetUrl("");
  }

  async function submit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setDevelopmentResetUrl("");

    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      if (mode === "forgot") {
        const payload = await forgotPassword(identifier);
        setAuthMessage(payload.message || "Check your email for password reset instructions.");
        setDevelopmentResetUrl(payload.developmentResetUrl || "");
        return;
      }

      if (mode === "reset") {
        const payload = await resetPassword(resetParams.token, password);
        window.history.replaceState({}, "", window.location.pathname);
        setIdentifier(resetParams.email);
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        setAuthMessage(payload.message || "Password reset successful. You can now sign in.");
        return;
      }

      const payload = mode === "register"
        ? await register({ displayName, email: identifier, phone, password, legacyInstallId })
        : await login({ identifier, password });

      onAuthenticated(payload.data);
    } catch (error) {
      setAuthError(error.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "forgot"
    ? "Recover your account"
    : mode === "reset"
      ? "Choose a new password"
      : "";

  return (
    <div className="v4-auth-shell">
      <div className="v4-auth-brand">
        <img src="/icons/icon-512.png" alt="" />
        <h1>Int-Messager</h1>
        <p>Connecting with love, on every device.</p>
      </div>

      <form className="v4-auth-card" onSubmit={submit}>
        {mode === "login" || mode === "register" ? (
          <div className="v4-auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create account</button>
          </div>
        ) : (
          <div className="v41-auth-heading">
            <button type="button" className="v41-back-link" onClick={() => changeMode("login")} aria-label="Back to sign in">←</button>
            <div>
              <h2>{title}</h2>
              <p>{mode === "forgot" ? "Enter the email address or phone number connected to your account." : "Your new password must contain at least eight characters."}</p>
            </div>
          </div>
        )}

        {mode === "register" ? (
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={30} autoComplete="name" onFocus={keepAuthFieldVisible} /></label>
        ) : null}

        {mode !== "reset" ? (
          <label>{mode === "login" || mode === "forgot" ? "Email or phone number" : "Email address"}<input type={mode === "register" ? "email" : "text"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete={mode === "login" ? "username" : "email"} inputMode={mode === "register" ? "email" : "text"} onFocus={keepAuthFieldVisible} /></label>
        ) : resetParams.email ? <div className="v41-reset-account">Resetting password for <strong>{resetParams.email}</strong></div> : null}

        {mode === "register" ? <label>Phone number <span>(optional)</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" onFocus={keepAuthFieldVisible} /></label> : null}

        {mode === "login" || mode === "register" || mode === "reset" ? (
          <label>{mode === "reset" ? "New password" : "Password"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} onFocus={keepAuthFieldVisible} /></label>
        ) : null}

        {mode === "register" || mode === "reset" ? <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" onFocus={keepAuthFieldVisible} /></label> : null}

        {mode === "login" ? <button type="button" className="v41-forgot-link" onClick={() => changeMode("forgot")}>Forgot password?</button> : null}
        {mode === "register" && legacyInstallId ? <div className="v4-claim-note">Your current device profile and chat history will be linked to this account.</div> : null}
        {authError ? <div className="v4-auth-error" role="alert">{authError}</div> : null}
        {authMessage ? <div className="v41-auth-success" role="status">{authMessage}</div> : null}
        {developmentResetUrl ? <a className="v41-dev-reset-link" href={developmentResetUrl}>Open development reset link</a> : null}

        <button className="v4-auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset instructions" : "Reset password"}
        </button>

        {mode === "forgot" ? <button type="button" className="v41-secondary-auth-btn" onClick={() => changeMode("login")}>Return to sign in</button> : null}
      </form>
    </div>
  );
}
