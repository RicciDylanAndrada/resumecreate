"use client";

import type { ResumeData } from "@/lib/types";

type Props = { resume: ResumeData; onChange: (next: ResumeData) => void };

// Edits one entry in a list, or removes it when `next` is null.
function replace<T>(list: T[], index: number, next: T | null): T[] {
  const copy = [...list];
  if (next === null) copy.splice(index, 1);
  else copy[index] = next;
  return copy;
}

function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Bullets({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="field">
      <span>Bullet points, one per line</span>
      <textarea
        className="bullets"
        value={(value || []).join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        rows={Math.max(3, (value || []).reduce((n, b) => n + Math.ceil((b.length || 1) / 46), 1))}
      />
    </label>
  );
}

function EntryTools({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="entry-tools">
      <button className="quiet" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button
        className="quiet"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
      >
        ↓
      </button>
      <button className="quiet" onClick={onRemove} aria-label={`Remove ${label}`}>
        Remove
      </button>
    </div>
  );
}

export default function ResumeEditor({ resume, onChange }: Props) {
  const set = (change: Partial<ResumeData>) => onChange({ ...resume, ...change });
  const experience = resume.experience || [];
  const education = resume.education || [];
  const projects = resume.projects || [];
  const skills = resume.skills || [];

  return (
    <div className="editor">
      <p className="editor-note">
        Change anything here and the résumé is rebuilt. Keep it to one page, and keep every line true to
        what you actually did.
      </p>

      <h3>Your details</h3>
      <div className="grid">
        <Field label="Name" value={resume.name} onChange={(name) => set({ name })} />
        <Field label="Phone" value={resume.phone} onChange={(phone) => set({ phone })} />
        <Field label="Email" value={resume.email} onChange={(email) => set({ email })} />
        <Field
          label="LinkedIn"
          value={resume.linkedin}
          onChange={(linkedin) => set({ linkedin })}
          placeholder="linkedin.com/in/you"
        />
        <Field label="GitHub" value={resume.github} onChange={(github) => set({ github })} placeholder="github.com/you" />
        <Field label="Website" value={resume.website} onChange={(website) => set({ website })} />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={!!resume.educationFirst}
          onChange={(e) => set({ educationFirst: e.target.checked })}
        />
        Put education above experience
      </label>

      <h3>Experience</h3>
      {experience.map((role, i) => (
        <div className="entry" key={i}>
          <EntryTools
            label={role.title || "role"}
            index={i}
            count={experience.length}
            onMove={(by) => set({ experience: move(experience, i, by) })}
            onRemove={() => set({ experience: replace(experience, i, null) })}
          />
          <div className="grid">
            <Field label="Job title" value={role.title} onChange={(title) => set({ experience: replace(experience, i, { ...role, title }) })} />
            <Field label="Dates" value={role.dates} onChange={(dates) => set({ experience: replace(experience, i, { ...role, dates }) })} placeholder="Jan. 2022 -- Present" />
            <Field label="Employer" value={role.company} onChange={(company) => set({ experience: replace(experience, i, { ...role, company }) })} />
            <Field label="Location" value={role.location} onChange={(location) => set({ experience: replace(experience, i, { ...role, location }) })} />
          </div>
          <Bullets value={role.bullets} onChange={(bullets) => set({ experience: replace(experience, i, { ...role, bullets }) })} />
        </div>
      ))}
      <button
        className="add"
        onClick={() => set({ experience: [...experience, { title: "", company: "", location: "", dates: "", bullets: [""] }] })}
      >
        Add a role
      </button>

      <h3>Education</h3>
      {education.map((e, i) => (
        <div className="entry" key={i}>
          <EntryTools
            label={e.school || "school"}
            index={i}
            count={education.length}
            onMove={(by) => set({ education: move(education, i, by) })}
            onRemove={() => set({ education: replace(education, i, null) })}
          />
          <div className="grid">
            <Field label="School" value={e.school} onChange={(school) => set({ education: replace(education, i, { ...e, school }) })} />
            <Field label="Location" value={e.location} onChange={(location) => set({ education: replace(education, i, { ...e, location }) })} />
            <Field label="Degree" value={e.degree} onChange={(degree) => set({ education: replace(education, i, { ...e, degree }) })} />
            <Field label="Dates" value={e.dates} onChange={(dates) => set({ education: replace(education, i, { ...e, dates }) })} />
          </div>
        </div>
      ))}
      <button className="add" onClick={() => set({ education: [...education, { school: "", location: "", degree: "", dates: "" }] })}>
        Add a school
      </button>

      <h3>
        <input
          className="heading-input"
          type="text"
          value={resume.projectsHeading || "Projects"}
          onChange={(e) => set({ projectsHeading: e.target.value })}
          aria-label="Heading for this section"
        />
      </h3>
      {projects.map((p, i) => (
        <div className="entry" key={i}>
          <EntryTools
            label={p.name || "project"}
            index={i}
            count={projects.length}
            onMove={(by) => set({ projects: move(projects, i, by) })}
            onRemove={() => set({ projects: replace(projects, i, null) })}
          />
          <div className="grid">
            <Field label="Name" value={p.name} onChange={(name) => set({ projects: replace(projects, i, { ...p, name }) })} />
            <Field label="Dates" value={p.dates} onChange={(dates) => set({ projects: replace(projects, i, { ...p, dates }) })} />
            <Field label="Tools or setting" value={p.tech} onChange={(tech) => set({ projects: replace(projects, i, { ...p, tech }) })} />
          </div>
          <Bullets value={p.bullets} onChange={(bullets) => set({ projects: replace(projects, i, { ...p, bullets }) })} />
        </div>
      ))}
      <button className="add" onClick={() => set({ projects: [...projects, { name: "", tech: "", dates: "", bullets: [""] }] })}>
        Add an entry
      </button>

      <h3>
        <input
          className="heading-input"
          type="text"
          value={resume.skillsHeading || "Technical Skills"}
          onChange={(e) => set({ skillsHeading: e.target.value })}
          aria-label="Heading for this section"
        />
      </h3>
      {skills.map((row, i) => (
        <div className="entry row" key={i}>
          <Field label="Group" value={row.category} onChange={(category) => set({ skills: replace(skills, i, { ...row, category }) })} />
          <Field
            label="Items, separated by commas"
            value={row.items}
            onChange={(items) => set({ skills: replace(skills, i, { ...row, items }) })}
          />
          <EntryTools
            label={row.category || "row"}
            index={i}
            count={skills.length}
            onMove={(by) => set({ skills: move(skills, i, by) })}
            onRemove={() => set({ skills: replace(skills, i, null) })}
          />
        </div>
      ))}
      <button className="add" onClick={() => set({ skills: [...skills, { category: "", items: "" }] })}>
        Add a group
      </button>
    </div>
  );
}
