"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MapPin, ArrowLeft } from "lucide-react";
import { api, send } from "@/lib/api";
import { Field, Notice } from "@/components/ui";
type Mode = "login" | "register" | "forgot-password" | "verify" | "reset";
const titles: Record<Mode, string> = {
  login: "Your city is calling.",
  register: "Make room for a little more out.",
  "forgot-password": "Let’s get you back out.",
  verify: "One step closer to out.",
  reset: "A fresh start.",
};
export default function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    setToken(params.get("token") || "");
    if (params.has("token")) history.replaceState(null, "", location.pathname);
    const code = new URLSearchParams(location.search).get("error");
    if (code)
      setError(
        code === "link_existing_account"
          ? "This email already has an account. Sign in with your password, then connect Google in Settings."
          : "Google sign-in could not finish. Try email sign-in or reconnect Google.",
      );
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (
      ["login", "register", "forgot-password"].includes(mode) &&
      !/^\S+@\S+\.\S+$/.test(email)
    ) {
      setError("Enter a valid email address.");
      return;
    }
    if (["register", "reset"].includes(mode) && password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    if ((mode === "verify" || mode === "reset") && !token) {
      setError(
        "Open the link from your email. If it expired, request a new one.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "login" || mode === "register") {
        await api("/auth/" + mode, send("POST", { email, password }));
        router.push("/explore");
      } else {
        const route = mode === "reset" ? "reset-password" : mode;
        const d = await api<{ message: string }>(
          "/auth/" + route,
          send(
            "POST",
            mode === "forgot-password"
              ? { email }
              : mode === "reset"
                ? { token, password }
                : { token },
          ),
        );
        setMessage(d.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const action = {
    login: "Sign in",
    register: "Create account",
    "forgot-password": "Send reset link",
    verify: "Verify email",
    reset: "Reset password",
  }[mode];
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-symbol">
            <MapPin size={22} />
          </span>
          ATL<span className="brand-slash">/</span>Out
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">DOWNTOWN · MIDTOWN · GEORGIA TECH</span>
          <h1>
            A good week
            <br />
            starts with
            <br />
            <em>getting out.</em>
          </h1>
          <p>
            The game. The parade. The plans you actually make.
            <br />
            Find your next Atlanta moment.
          </p>
          <div className="city-route" aria-hidden="true">
            <span>Downtown</span>
            <i />
            <span>Georgia Tech</span>
            <i />
            <span>Midtown</span>
          </div>
        </div>
        <span className="auth-foot">
          Your neighborhood. Your kind of plans.
        </span>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">
            {mode === "register" ? "JOIN THE CITY" : "WELCOME TO ATL / OUT"}
          </span>
          <h2>{titles[mode]}</h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to find what’s happening and make it yours."
              : mode === "register"
                ? "One account for your activities, plans and reminders."
                : "Use your account email to continue."}
          </p>
          {["login", "register"].includes(mode) && (
            <>
              <a className="button google" href="/api/auth/google/start">
                <b>G</b> Continue with Google <ArrowUpRight size={16} />
              </a>
              <div className="or">
                <span>or use your email</span>
              </div>
            </>
          )}
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <form noValidate onSubmit={submit}>
            {["login", "register", "forgot-password"].includes(mode) && (
              <Field id="email" label="Email address">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>
            )}
            {["login", "register", "reset"].includes(mode) && (
              <Field
                id="password"
                label="Password"
                hint={
                  mode !== "login"
                    ? "At least 12 characters. Password managers and paste are welcome."
                    : undefined
                }
              >
                <input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-describedby={
                    mode !== "login" ? "password-hint" : undefined
                  }
                />
              </Field>
            )}
            {mode === "login" && (
              <Link className="forgot" href="/forgot-password">
                Forgot password?
              </Link>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Working…" : action}
              <ArrowUpRight size={16} />
            </button>
          </form>
          <p className="auth-links">
            {mode === "login" ? (
              <>
                New here? <Link href="/register">Create an account</Link>
              </>
            ) : mode === "register" ? (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            ) : (
              <Link href="/login">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            )}
          </p>
          <p className="legal">
            Your location is only used when you ask.
            <br />
            <Link href="/privacy">Privacy & data</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
