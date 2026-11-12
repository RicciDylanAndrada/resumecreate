"use client";

import { useState } from "react";

export default function UnlockForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the access code you were given.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "That code isn't right. Check it and try again.");
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <main className="lock">
      <form className="sheet lock-card" onSubmit={submit}>
        <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
          <rect x="26" y="52" width="68" height="52" rx="14" fill="#5b5bf0" />
          <path d="M42 52V40a18 18 0 0 1 36 0v12" fill="none" stroke="#5b5bf0" strokeWidth="9" strokeLinecap="round" />
          <circle cx="60" cy="74" r="8" fill="#ffc94d" />
          <path d="M60 78v10" stroke="#ffc94d" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <span className="brand">Résumé Maker</span>
        <h1>Enter your access code</h1>
        <p>This site is invite-only. Use the code you were given to get in.</p>
        <label htmlFor="code">Access code</label>
        <input
          id="code"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
        />
        {error && (
          <p className="problem" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Open the résumé maker"}
        </button>
      </form>
    </main>
  );
}
