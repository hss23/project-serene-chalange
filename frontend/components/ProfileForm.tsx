"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { formatTz, SLOT_LABELS, type Format, type OwnedMentee, type OwnedMentor, type Skill } from "@/lib/types";
import { ErrorBanner, Spinner } from "./ui";

const FORMATS: { value: Format; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "in_person", label: "In person" },
];
const CAREER_STAGES = ["Student", "Entry-level", "Junior", "Associate", "Mid-level", "Senior", "Career switcher", "New manager", "Founder"];
const INDUSTRIES = ["Software", "Data", "Design", "Product", "Fintech", "Marketing", "Education", "Climate", "Cybersecurity"];
const LANGUAGE_SUGGESTIONS = ["English", "Hindi", "Spanish", "French", "German", "Mandarin", "Arabic", "Portuguese", "Japanese", "Urdu", "Tamil"];
const TIMEZONES = [...Array.from({ length: 53 }, (_, i) => -12 + i * 0.5), 5.75].sort((a, b) => a - b);
const PRIORITY = { 1: "Nice to have", 2: "Important", 3: "Must-have" } as const;

export type StudentValues = {
  name: string;
  industry: string;
  city: string;
  timezone_offset: number;
  languages: string[];
  format: Format;
  availability: string[];
  goal_summary: string;
  career_stage: string;
  desired_min_years: number;
  goals: { name: string; priority: number }[];
};

export type TeacherValues = Omit<StudentValues, "goal_summary" | "career_stage" | "desired_min_years" | "goals"> & {
  headline: string;
  bio: string;
  years_experience: number;
  max_mentees: number;
  skills: { name: string; proficiency: number }[];
};

const guessTimezone = () => {
  const offset = -new Date().getTimezoneOffset() / 60;
  return TIMEZONES.includes(offset) ? offset : 0;
};

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card">
      <legend className="sr-only">{title}</legend>
      <p className="eyebrow mb-4">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function ChipToggle({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded-xl border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line text-muted hover:bg-surface-2"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function LanguagesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase()) && value.length < 8) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input"
          list="language-suggestions"
          placeholder="Type a language and press Enter"
          value={draft}
          maxLength={30}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-secondary px-3" onClick={add} aria-label="Add language">
          <Plus className="h-4 w-4" />
        </button>
        <datalist id="language-suggestions">
          {LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}
        </datalist>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((l) => (
            <span key={l} className="chip-accent">
              {l}
              <button type="button" aria-label={`Remove ${l}`} onClick={() => onChange(value.filter((x) => x !== l))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillPicker({
  skills,
  value,
  onChange,
  levels,
  levelLabel,
  max,
}: {
  skills: Skill[];
  value: { name: string; level: number }[];
  onChange: (v: { name: string; level: number }[]) => void;
  levels: { value: number; label: string }[];
  levelLabel: string;
  max: number;
}) {
  const [pick, setPick] = useState("");
  const byCategory = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of skills) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [skills]);
  const chosen = new Set(value.map((v) => v.name));
  const add = (name: string) => {
    if (name && !chosen.has(name) && value.length < max) onChange([...value, { name, level: levels[levels.length - 1].value }]);
    setPick("");
  };
  return (
    <div className="space-y-3">
      <select className="input" value={pick} onChange={(e) => add(e.target.value)} aria-label="Add a skill" disabled={value.length >= max}>
        <option value="">{value.length >= max ? `Maximum ${max} skills` : "Add a skill…"}</option>
        {byCategory.map(([cat, list]) => (
          <optgroup key={cat} label={cat}>
            {list.map((s) => (
              <option key={s.name} value={s.name} disabled={chosen.has(s.name)}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {value.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {value.map((v) => (
            <li key={v.name} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-28 flex-1 font-medium text-fg">{v.name}</span>
              <label className="flex items-center gap-2 text-xs text-muted">
                {levelLabel}
                <select
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg"
                  value={v.level}
                  onChange={(e) => onChange(value.map((x) => (x.name === v.name ? { ...x, level: Number(e.target.value) } : x)))}
                >
                  {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>
              <button type="button" className="text-subtle hover:text-danger" aria-label={`Remove ${v.name}`} onClick={() => onChange(value.filter((x) => x.name !== v.name))}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommonFields<T extends StudentValues | TeacherValues>({ v, set }: { v: T; set: <K extends keyof T>(k: K, val: T[K]) => void }) {
  return (
    <>
      <Field label="Industry">
        <input className="input" list="industry-suggestions" required maxLength={60} value={v.industry} onChange={(e) => set("industry", e.target.value as T["industry"])} />
        <datalist id="industry-suggestions">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist>
      </Field>
      <Field label="City">
        <input className="input" required maxLength={60} value={v.city} onChange={(e) => set("city", e.target.value as T["city"])} />
      </Field>
      <Field label="Timezone">
        <select className="input" value={v.timezone_offset} onChange={(e) => set("timezone_offset", Number(e.target.value) as T["timezone_offset"])}>
          {TIMEZONES.map((t) => <option key={t} value={t}>{formatTz(t)}</option>)}
        </select>
      </Field>
      <Field label="Session format">
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={v.format === f.value}
              onClick={() => set("format", f.value as T["format"])}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${v.format === f.value ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line text-muted hover:bg-surface-2"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Languages" wide>
        <LanguagesInput value={v.languages} onChange={(l) => set("languages", l as T["languages"])} />
      </Field>
      <Field label="Availability" wide>
        <ChipToggle
          options={Object.entries(SLOT_LABELS).map(([value, label]) => ({ value, label }))}
          value={v.availability}
          onChange={(a) => set("availability", a as T["availability"])}
        />
      </Field>
    </>
  );
}

function FormShell({ children, onSubmit, busy, error, submitLabel }: { children: ReactNode; onSubmit: (e: FormEvent) => void; busy: boolean; error: string | null; submitLabel: string }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {children}
      {error && <ErrorBanner message={error} />}
      <div className="flex justify-end">
        <button className="btn-primary px-6 py-3" disabled={busy}>
          {busy && <Spinner />} {submitLabel}
        </button>
      </div>
    </form>
  );
}

function useFormState<T>(initial: T) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((cur) => ({ ...cur, [k]: val }));
  return { v, set };
}

async function runSubmit(validate: () => string | null, save: () => Promise<void>, setBusy: (b: boolean) => void, setError: (e: string | null) => void) {
  const problem = validate();
  if (problem) return setError(problem);
  setError(null);
  setBusy(true);
  try {
    await save();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setBusy(false);
  }
}

const commonProblem = (v: StudentValues | TeacherValues) =>
  !v.name.trim() ? "Add your name." : v.languages.length === 0 ? "Add at least one language." : v.availability.length === 0 ? "Choose at least one availability slot." : null;

export function StudentProfileForm({
  initial,
  defaultName,
  skills,
  onSave,
  submitLabel = "Save profile",
}: {
  initial: OwnedMentee | null;
  defaultName: string;
  skills: Skill[];
  onSave: (values: StudentValues) => Promise<void>;
  submitLabel?: string;
}) {
  const { v, set } = useFormState<StudentValues>({
    name: initial?.name ?? defaultName,
    industry: initial?.industry ?? "",
    city: initial?.city ?? "",
    timezone_offset: initial?.timezone_offset ?? guessTimezone(),
    languages: initial?.languages ?? ["English"],
    format: initial?.format ?? "remote",
    availability: initial?.availability ?? [],
    goal_summary: initial?.goal_summary ?? "",
    career_stage: initial?.career_stage ?? "Junior",
    desired_min_years: initial?.desired_min_years ?? 5,
    goals: initial?.goals ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormShell
      busy={busy}
      error={error}
      submitLabel={submitLabel}
      onSubmit={(e) => {
        e.preventDefault();
        runSubmit(() => commonProblem(v) ?? (v.goals.length === 0 ? "Add at least one goal skill." : null), () => onSave(v), setBusy, setError);
      }}
    >
      <Section title="About you">
        <Field label="Full name">
          <input className="input" required maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Career stage">
          <select className="input" value={v.career_stage} onChange={(e) => set("career_stage", e.target.value)}>
            {CAREER_STAGES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="What do you want to achieve?" hint="10–400 characters. Mentors see this." wide>
          <textarea className="input min-h-24" required minLength={10} maxLength={400} value={v.goal_summary} onChange={(e) => set("goal_summary", e.target.value)} />
        </Field>
      </Section>
      <Section title="What you want to learn">
        <Field label="Goal skills" hint="Must-haves count three times as much as nice-to-haves." wide>
          <SkillPicker
            skills={skills}
            max={8}
            levelLabel="Priority"
            levels={[1, 2, 3].map((n) => ({ value: n, label: PRIORITY[n as 1 | 2 | 3] }))}
            value={v.goals.map((g) => ({ name: g.name, level: g.priority }))}
            onChange={(list) => set("goals", list.map((g) => ({ name: g.name, priority: g.level })))}
          />
        </Field>
        <Field label="Mentor experience you'd like (years)">
          <input className="input" type="number" min={0} max={40} value={v.desired_min_years} onChange={(e) => set("desired_min_years", Number(e.target.value))} />
        </Field>
      </Section>
      <Section title="Preferences">
        <CommonFields v={v} set={set} />
      </Section>
    </FormShell>
  );
}

export function TeacherProfileForm({
  initial,
  defaultName,
  skills,
  onSave,
  submitLabel = "Save profile",
}: {
  initial: OwnedMentor | null;
  defaultName: string;
  skills: Skill[];
  onSave: (values: TeacherValues) => Promise<void>;
  submitLabel?: string;
}) {
  const { v, set } = useFormState<TeacherValues>({
    name: initial?.name ?? defaultName,
    industry: initial?.industry ?? "",
    city: initial?.city ?? "",
    timezone_offset: initial?.timezone_offset ?? guessTimezone(),
    languages: initial?.languages ?? ["English"],
    format: initial?.format ?? "remote",
    availability: initial?.availability ?? [],
    headline: initial?.headline ?? "",
    bio: initial?.bio ?? "",
    years_experience: initial?.years_experience ?? 5,
    max_mentees: Math.min(initial?.max_mentees ?? 3, 4),
    skills: initial?.skills ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormShell
      busy={busy}
      error={error}
      submitLabel={submitLabel}
      onSubmit={(e) => {
        e.preventDefault();
        runSubmit(() => commonProblem(v) ?? (v.skills.length === 0 ? "Add at least one skill you can mentor." : null), () => onSave(v), setBusy, setError);
      }}
    >
      <Section title="About you">
        <Field label="Full name">
          <input className="input" required maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Headline" hint="e.g. Senior Data Scientist, Atlas Retail">
          <input className="input" required maxLength={120} value={v.headline} onChange={(e) => set("headline", e.target.value)} />
        </Field>
        <Field label="Short bio" hint="10–600 characters. Students see this." wide>
          <textarea className="input min-h-24" required minLength={10} maxLength={600} value={v.bio} onChange={(e) => set("bio", e.target.value)} />
        </Field>
        <Field label="Years of experience">
          <input className="input" type="number" min={0} max={60} value={v.years_experience} onChange={(e) => set("years_experience", Number(e.target.value))} />
        </Field>
        <Field label="Max students at once" hint="Programme limit is 4.">
          <input className="input" type="number" min={1} max={4} value={v.max_mentees} onChange={(e) => set("max_mentees", Number(e.target.value))} />
        </Field>
      </Section>
      <Section title="What you can mentor">
        <Field label="Skills" hint="Proficiency 1–5; higher proficiency scores higher for students who want that skill." wide>
          <SkillPicker
            skills={skills}
            max={12}
            levelLabel="Proficiency"
            levels={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} / 5` }))}
            value={v.skills.map((s) => ({ name: s.name, level: s.proficiency }))}
            onChange={(list) => set("skills", list.map((s) => ({ name: s.name, proficiency: s.level })))}
          />
        </Field>
      </Section>
      <Section title="Availability and format">
        <CommonFields v={v} set={set} />
      </Section>
    </FormShell>
  );
}
