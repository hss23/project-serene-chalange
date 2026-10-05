"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";
import { useAuth } from "./AuthProvider";
import { ArrowRight, Check, KeyRound, Mail, Sparkles, User } from "lucide-react";
import { ErrorBanner, InfoBanner, Spinner } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  // Surface errors from a redirect-based Google sign-in (used when popups are blocked).
  useEffect(() => {
    if (!configured) return;
    getRedirectResult(clientAuth()).catch((err) => setError(authErrorMessage(err)));
  }, [configured]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < 8) {
      setError("Please use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(clientAuth(), email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(clientAuth(), email.trim(), password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(clientAuth(), provider);
      router.replace("/dashboard");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-blocked") {
        await signInWithRedirect(clientAuth(), provider); // fall back when the browser blocks popups
        return;
      }
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <InfoBanner>
        Firebase isn&apos;t configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill in the{" "}
        <code>NEXT_PUBLIC_FIREBASE_*</code> values.
      </InfoBanner>
    );
  }

  const isSignup = mode === "signup";
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden brand-gradient p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <span className="relative flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20">
            <Sparkles className="h-4 w-4" />
          </span>
          Serene Mentors
        </span>
        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">Mentorship matching you can actually explain.</h2>
          <ul className="mt-6 space-y-3 text-sm text-white/90">
            {[
              "Ranked matches with a score and readable reasons",
              "An assistant that cites its sources",
              "Your saved matches and chats stay private",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">A demo with fictional people and organisations.</p>
      </div>

      {/* Form */}
      <div className="p-8 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {isSignup ? "Sign up to find mentors and ask the programme assistant." : "Sign in to continue to your dashboard."}
        </p>

        <button onClick={onGoogle} className="btn-secondary mt-7 w-full py-3" disabled={busy}>
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-subtle">
          <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input id="name" className="input pl-10" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="Your name" />
              </div>
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input id="email" type="email" required className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                id="password"
                type="password"
                required
                minLength={isSignup ? 8 : undefined}
                className="input pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
              />
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner /> : null} {isSignup ? "Create account" : "Sign in"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-muted">
          {isSignup ? (
            <>Already have an account? <Link href="/login" className="font-medium text-accent-ink hover:underline">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="font-medium text-accent-ink hover:underline">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
