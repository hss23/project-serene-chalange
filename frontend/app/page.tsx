"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, BookOpenCheck, Check, Lock, Scale, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, Bar, ScoreRing } from "@/components/ui";

const FEATURES = [
  {
    icon: Scale,
    title: "Transparent matching",
    body: "Mentors are ranked by a fixed, weighted formula: skills, availability, experience, timezone, industry and format. Every score comes with its reasons.",
  },
  {
    icon: BookOpenCheck,
    title: "Grounded assistant",
    body: "Answers come only from the programme knowledge base, with citations. When the answer isn't there, it says so instead of guessing.",
  },
  {
    icon: Lock,
    title: "Private by default",
    body: "Saved matches, chat history and preferences live in your own Firestore space, protected by security rules.",
  },
];

const STEPS = [
  { n: "01", title: "Pick a mentee profile", body: "Choose from 12 fictional mentees with goals, availability and preferences." },
  { n: "02", title: "See ranked mentors", body: "The top 5 of 30 mentors, each with a score, a breakdown and readable reasons." },
  { n: "03", title: "Save and ask", body: "Save matches you like and ask the assistant how the programme works." },
];

function PreviewCard() {
  const factors = [
    { label: "Skill fit", v: 0.96 },
    { label: "Availability", v: 1 },
    { label: "Experience", v: 1 },
    { label: "Timezone", v: 1 },
  ];
  return (
    <div className="card relative w-full max-w-md p-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <Avatar name="Dr. Priya Raman" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">Dr. Priya Raman</p>
          <p className="truncate text-sm text-muted">Principal Frontend Engineer</p>
        </div>
        <ScoreRing score={98} size={56} />
      </div>
      <div className="mt-5 space-y-2.5">
        {factors.map((f) => (
          <div key={f.label} className="grid grid-cols-[96px_1fr] items-center gap-3 text-xs text-muted">
            <span>{f.label}</span>
            <Bar value={f.v} tone="success" />
          </div>
        ))}
      </div>
      <ul className="mt-5 space-y-1.5 text-sm text-fg">
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />Covers 4 of 4 goal skills</li>
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />Both available weekday evenings</li>
      </ul>
      <span className="chip-accent absolute -top-3 right-5 shadow-sm">
        <Sparkles className="h-3 w-3" /> Top match
      </span>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="space-y-24 py-6 sm:py-10">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-fade-up">
          <span className="chip-accent">
            <Sparkles className="h-3 w-3" /> Fictional demo programme
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-6xl">
            Find the right mentor, <span className="gradient-text">and see why</span> they fit.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Serene Mentors ranks mentors with a scoring method you can read, and answers programme questions from a
            cited knowledge base.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              Sign in
            </Link>
          </div>
          <p className="mt-6 text-sm text-subtle">Free to try · Email or Google sign-in</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PreviewCard />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card transition hover:-translate-y-0.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold text-fg">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section>
        <p className="eyebrow text-center">How it works</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface/60 p-5">
              <span className="gradient-text text-sm font-semibold">{s.n}</span>
              <h3 className="mt-2 font-semibold text-fg">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
