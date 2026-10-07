"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { ErrorBanner, InfoBanner, Spinner } from "@/components/ui";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendPasswordResetEmail(clientAuth(), email.trim());
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Don't reveal whether an account exists: treat "no such user" exactly like success.
      if (code === "auth/user-not-found") setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseConfigured) return <InfoBanner>Firebase isn&apos;t configured yet.</InfoBanner>;

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl brand-gradient text-white">
          {sent ? <MailCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
        </span>
        {sent ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              If an account exists for <b className="text-fg">{email.trim()}</b>, we&apos;ve sent a link to reset your
              password. It can take a minute to arrive, so check your spam folder too.
            </p>
            <button className="btn-secondary mt-6 w-full" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Reset your password</h1>
            <p className="mt-1.5 text-sm text-muted">Enter your account email and we&apos;ll send you a reset link.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input id="email" type="email" required autoComplete="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              {error && <ErrorBanner message={error} />}
              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy && <Spinner />} Send reset link
              </button>
            </form>
          </>
        )}
        <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
