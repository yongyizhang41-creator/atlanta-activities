"use client";
import { useState } from "react";
import { Shell, useAuth } from "@/components/shell";
import { Modal, Notice } from "@/components/ui";
import { api, send } from "@/lib/api";
function Settings() {
  const { user, reload } = useAuth();
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings">
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h1>The essentials.</h1>
      <p className="muted">Your sign-in methods, email and personal data.</p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <article className="settings-card">
        <h2>Email & reminders</h2>
        <p>
          {user.email}
          <span className={"badge " + (user.verified ? "live" : "warning")}>
            {user.verified ? "Verified" : "Not verified"}
          </span>
        </p>
        <p>Reminders are sent here. Location history is not stored.</p>
        {!user.verified && (
          <button
            disabled={busy}
            onClick={() =>
              action(async () => {
                const r = await api<{ message: string }>(
                  "/auth/resend-verification",
                  send("POST"),
                );
                setMessage(r.message);
              })
            }
          >
            Resend verification email
          </button>
        )}
        <button
          className="text-button"
          disabled={busy}
          onClick={() => action(reload)}
        >
          Refresh verification status
        </button>
      </article>
      <article className="settings-card">
        <h2>Sign-in methods</h2>
        <div className="setting-row">
          <span>Email & password</span>
          {
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const r = await api<{ message: string }>(
                    "/auth/forgot-password",
                    send("POST", { email: user.email }),
                  );
                  setMessage(r.message);
                })
              }
            >
              {user.has_password ? "Reset password" : "Set password by email"}
            </button>
          }
        </div>
        <div className="setting-row">
          <span>Google {user.has_google ? "· Connected" : ""}</span>
          <button
            disabled={busy}
            onClick={() =>
              action(async () => {
                if (user.has_google) {
                  await api("/me/identities/google", send("DELETE"));
                  await reload();
                  setMessage("Google disconnected.");
                } else {
                  const r = await api<{ url: string }>(
                    "/auth/google/link",
                    send("POST"),
                  );
                  location.assign(r.url);
                }
              })
            }
          >
            {user.has_google ? "Disconnect" : "Connect Google"}
          </button>
        </div>
      </article>
      <article className="settings-card danger-zone">
        <h2>Delete account</h2>
        <p>
          Permanently delete your account, plans and conversations. Pending
          reminders will be cancelled.
        </p>
        <button
          className="danger-button"
          disabled={busy}
          onClick={() => setDeleting(true)}
        >
          Delete account
        </button>
      </article>
      {deleting && (
        <Modal
          title="Permanently delete your account?"
          description="Your plans and conversations will be deleted. This cannot be undone."
          onClose={() => {
            if (!busy) setDeleting(false);
          }}
        >
          <p>
            Deleting <strong>{user.email}</strong> also cancels pending
            reminders. Email already submitted cannot be recalled.
          </p>
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setDeleting(false)}>
              Keep account
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api("/me/account", send("DELETE"));
                  location.assign("/login");
                })
              }
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export default function Page() {
  return (
    <Shell>
      <Settings />
    </Shell>
  );
}
