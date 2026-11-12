"use client";

import { useEffect, useRef, useState } from "react";
import { GATES, MAX_DRAFTS, matchLabel, type Verdict } from "@/lib/gates";
import type { Job, ResumeData, UploadedFile } from "@/lib/types";

type Item = {
  id: string;
  url?: string;
  job?: Job;
  status: "reading" | "needs-paste" | "writing" | "checking" | "done" | "error";
  draft?: number;
  verdict?: Verdict;
  error?: string;
  paste: string;
  profession?: string;
  overview?: string;
  keywords?: string[];
  gaps?: string[];
  name?: string;
  tex?: string;
  pdf?: Blob;
  pdfStale?: boolean;
  pdfBusy?: boolean;
  pdfError?: string;
};

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function load(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readFile(file: File): Promise<UploadedFile & { size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const url = String(reader.result);
      resolve({
        name: file.name,
        mime: file.type,
        data: url.slice(url.indexOf(",") + 1),
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

function slug(...parts: (string | undefined)[]) {
  return (
    parts
      .filter(Boolean)
      .join("_")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "resume"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Draws each page of the PDF onto a canvas, so the résumé shows inline on
// phones as well as desktops (mobile browsers don't embed PDFs reliably).
function PdfPreview({ pdf }: { pdf: Blob }) {
  const host = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const doc = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
        const el = host.current;
        if (!el || cancelled) return;
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(3, Math.max(1.5, (el.clientWidth / base.width) * (window.devicePixelRatio || 1)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
          canvases.push(canvas);
        }
        if (cancelled) return;
        el.replaceChildren(...canvases);
        setPages(doc.numPages);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  if (failed) {
    return <p className="problem">The preview couldn&apos;t be drawn here. Download the PDF to view it.</p>;
  }
  return (
    <>
      <div className="preview" ref={host} role="img" aria-label="Preview of your résumé" />
      {pages > 1 && (
        <p className="problem">
          This runs to {pages} pages. Trim a role or a few bullets in the LaTeX to bring it back to one.
        </p>
      )}
      <button
        className="quiet"
        onClick={() => window.open(URL.createObjectURL(pdf), "_blank")}
      >
        Open full size
      </button>
    </>
  );
}

export default function Page() {
  const [links, setLinks] = useState("");
  const [pasted, setPasted] = useState("");
  const [background, setBackground] = useState("");
  const [files, setFiles] = useState<(UploadedFile & { size: number })[]>([]);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    setBackground(load("rm.background"));
  }, []);

  const patch = (id: string, change: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...change } : it)));

  const headers = () => ({ "content-type": "application/json" });

  // The lock screen cookie expired or was cleared: send them back to it.
  const relock = (res: Response) => {
    if (res.status === 401) window.location.href = "/unlock";
  };

  async function addFiles(picked: FileList | null) {
    if (!picked) return;
    setFormError("");
    try {
      const read = await Promise.all(Array.from(picked).map(readFile));
      const next = [...files, ...read].slice(0, 5);
      if (next.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES) {
        setFormError("Those files are over 3 MB together. Remove one, or paste the text instead.");
        return;
      }
      setFiles(next);
    } catch {
      setFormError("That file couldn't be read. Try a PDF, .docx, .tex or .txt file.");
    }
  }

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    relock(res);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  // Write a draft, have the judge score it, and rewrite with the judge's
  // findings until every gate passes or the draft limit is reached.
  async function write(id: string, job: Job) {
    const source = { job, background, files: files.map(({ name, mime, data }) => ({ name, mime, data })) };
    type Draft = { tex: string; resume: ResumeData; [k: string]: unknown };
    let best: { draft: Draft; verdict: Verdict; n: number } | null = null;
    let revision: { resume: ResumeData; feedback: string[]; fabrications: string[] } | undefined;

    const rank = (v: Verdict) =>
      (v.fabrications.length ? 0 : 1000) - v.failed.length * 100 + Object.values(v.scores).reduce((a, b) => a + b, 0) / 4;

    try {
      for (let n = 1; n <= MAX_DRAFTS; n++) {
        patch(id, { status: "writing", draft: n, job, error: undefined });
        const draft: Draft = await post("/api/generate", { ...source, revision });
        patch(id, { status: "checking" });
        const verdict: Verdict = await post("/api/judge", { ...source, resume: draft.resume });
        if (!best || rank(verdict) > rank(best.verdict)) best = { draft, verdict, n };
        if (verdict.pass) break;
        revision = { resume: draft.resume, feedback: verdict.feedback, fabrications: verdict.fabrications };
      }
      if (!best) throw new Error("The résumé couldn't be written. Try again.");
      const { resume: _unused, ...shown } = best.draft;
      patch(id, { status: "done", ...shown, verdict: best.verdict, draft: best.n });
      void makePdf(id, best.draft.tex);
    } catch (e) {
      patch(id, {
        status: "error",
        error: e instanceof Error ? e.message : "The résumé couldn't be written. Try again.",
      });
    }
  }

  async function run(item: Item) {
    if (item.job) return write(item.id, item.job);
    patch(item.id, { status: "reading", error: undefined });
    try {
      const res = await fetch("/api/job", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ url: item.url }),
      });
      relock(res);
      const data = await res.json();
      if (!res.ok) {
        patch(item.id, {
          status: "needs-paste",
          error: data.error || "This link couldn't be read.",
        });
        return;
      }
      await write(item.id, data.job);
    } catch {
      patch(item.id, {
        status: "needs-paste",
        error: "This link couldn't be read. Paste the job description instead.",
      });
    }
  }

  async function build() {
    setFormError("");
    const urls = Array.from(new Set(links.split(/\s+/).filter(Boolean)));
    if (!urls.length && !pasted.trim()) {
      setFormError("Add at least one LinkedIn job link or paste a job description.");
      return;
    }
    if (!background.trim() && !files.length) {
      setFormError("Add your work history or upload a résumé so there's something to build from.");
      return;
    }
    save("rm.background", background);

    const fresh: Item[] = urls.map((url) => ({
      id: `j${++counter.current}`,
      url,
      status: "reading",
      paste: "",
    }));
    if (pasted.trim()) {
      fresh.push({
        id: `j${++counter.current}`,
        status: "writing",
        paste: "",
        job: { title: "", company: "", location: "", description: pasted.trim() },
      });
    }
    setItems((list) => [...fresh, ...list]);
    setBusy(true);
    for (const item of fresh) await run(item);
    setBusy(false);
  }

  // Compile the LaTeX to a PDF for the on-screen preview and the download.
  async function makePdf(id: string, source: string): Promise<Blob | null> {
    patch(id, { pdfBusy: true, pdfError: undefined });
    try {
      const res = await fetch("/api/pdf", { method: "POST", headers: headers(), body: JSON.stringify({ tex: source }) });
      relock(res);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The PDF couldn't be made.");
      }
      const pdf = await res.blob();
      patch(id, { pdf, pdfStale: false, pdfBusy: false });
      return pdf;
    } catch (e) {
      patch(id, { pdfBusy: false, pdfError: e instanceof Error ? e.message : "The PDF couldn't be made." });
      return null;
    }
  }

  async function downloadPdf(item: Item) {
    if (!item.tex) return;
    const pdf = item.pdf && !item.pdfStale ? item.pdf : await makePdf(item.id, item.tex);
    if (pdf) downloadBlob(pdf, slug(item.name, item.job?.company) + ".pdf");
  }

  function openInOverleaf(source: string) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "_blank";
    const field = document.createElement("textarea");
    field.name = "snip";
    field.value = source;
    form.appendChild(field);
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  return (
    <main className="page">
      <header className="masthead">
        <span className="brand">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" rx="3" fill="currentColor" />
            <path d="M9 8h6M9 12h6M9 16h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Résumé Maker
        </span>
        <h1>A fresh résumé for every job you apply to</h1>
        <p>
          Drop in a LinkedIn job link and tell us about your work. You get a one-page résumé written
          for that job, checked for accuracy, and ready as a PDF.
        </p>
      </header>

      <div className="columns">
        <section className="sheet" aria-label="Your details">
          <h2>
            <span className="step">1</span>Which jobs are you going for?
          </h2>
          <label htmlFor="links">LinkedIn job links, one per line</label>
          <textarea
            id="links"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/1234567890"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <details>
            <summary>Paste a job description instead</summary>
            <textarea
              aria-label="Job description"
              className="tall"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste the full posting here, including the job title and company."
            />
          </details>

          <h2>
            <span className="step">2</span>Tell us about your work
          </h2>
          <label htmlFor="background">
            Roles, dates, what you did, results, education, skills and contact details. Rough notes are
            fine. Only what you write here or upload goes on the résumé.
          </label>
          <textarea
            id="background"
            className="tall"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder={
              "Jane Doe, jane@example.com, 555-123-4567\n\nAcme Corp, Senior Analyst, Jan 2022 to now, Newark NJ\n- Built the weekly revenue forecast used by 40 store managers\n- Cut report turnaround from 3 days to 4 hours"
            }
          />
          <label className="filepick">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.tex,.txt,.md,application/pdf"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Add résumés you already have
          </label>
          <span className="hint center">
            PDF, Word (.docx), .tex or .txt. Up to 5 files, 3 MB together.
          </span>
          {files.length > 0 && (
            <ul className="files">
              {files.map((f, i) => (
                <li key={f.name + i}>
                  <span>{f.name}</span>
                  <button
                    className="quiet"
                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                    aria-label={`Remove ${f.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {formError && (
            <p className="problem" role="alert">
              {formError}
            </p>
          )}
          <button className="primary" onClick={build} disabled={busy}>
            {busy ? "Building your résumés…" : "Build my résumés"}
          </button>
        </section>

        <section aria-label="Résumés" aria-live="polite">
          {items.length === 0 && (
            <div className="sheet empty">
              <svg viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
                <rect x="34" y="20" width="62" height="82" rx="10" fill="#dcd9ff" transform="rotate(7 65 61)" />
                <rect x="26" y="16" width="62" height="82" rx="10" fill="#fff" stroke="#5b5bf0" strokeWidth="3" />
                <circle cx="42" cy="34" r="7" fill="#ffc94d" />
                <path d="M54 31h24M54 38h16" stroke="#5b5bf0" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M36 54h42M36 64h42M36 74h30" stroke="#c9c6f5" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="88" cy="88" r="15" fill="#2fb67c" />
                <path d="m81 88 5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2>Your résumés will show up here</h2>
              <p>
                One for each job, with the role it was written for, what we played up, and anything the
                posting asks for that your history doesn&apos;t show yet.
              </p>
            </div>
          )}

          {items.map((item) => {
            const heading =
              [item.job?.title, item.job?.company].filter(Boolean).join(" at ") ||
              (item.url ? "LinkedIn job" : "Pasted job description");
            return (
              <article className="sheet result" key={item.id}>
                <h2>{heading}</h2>
                {item.url && <p className="where">{item.url}</p>}

                {item.status === "reading" && <p className="working">Reading the job posting</p>}
                {item.status === "writing" && (
                  <p className="working">
                    Writing draft {item.draft} of up to {MAX_DRAFTS}
                  </p>
                )}
                {item.status === "checking" && (
                  <p className="working">Checking draft {item.draft} against the job</p>
                )}

                {item.status === "needs-paste" && (
                  <>
                    <p className="problem" role="alert">
                      {item.error}
                    </p>
                    <textarea
                      aria-label="Job description"
                      className="tall"
                      style={{ marginTop: 10 }}
                      value={item.paste}
                      onChange={(e) => patch(item.id, { paste: e.target.value })}
                      placeholder="Paste the full posting here."
                    />
                    <div className="actions">
                      <button
                        className="main"
                        disabled={!item.paste.trim()}
                        onClick={() =>
                          write(item.id, {
                            title: "",
                            company: "",
                            location: "",
                            description: item.paste.trim(),
                            url: item.url,
                          })
                        }
                      >
                        Build from pasted description
                      </button>
                    </div>
                  </>
                )}

                {item.status === "error" && (
                  <>
                    <p className="problem" role="alert">
                      {item.error}
                    </p>
                    <div className="actions">
                      <button onClick={() => run(item)}>Try again</button>
                    </div>
                  </>
                )}

                {item.status === "done" && item.tex !== undefined && (
                  <>
                    <span className="profession">Written for: {item.profession}</span>
                    <p>{item.overview}</p>

                    {item.verdict && (
                      <>
                        <div className="match">
                          <div className="match-top">
                            <span>Match with this job</span>
                            <strong>
                              {item.verdict.scores.match}% <em>{matchLabel(item.verdict.scores.match)}</em>
                            </strong>
                          </div>
                          <div className="bar" aria-hidden="true">
                            <i style={{ width: `${item.verdict.scores.match}%` }} />
                          </div>
                          <p>
                            {item.verdict.scores.match >= 75
                              ? "Your history lines up well with what this posting asks for."
                              : "You don't need to tick every box to apply. This shows how much of the posting your real history covers; nothing was added to raise it."}
                          </p>
                        </div>

                        <p className={item.verdict.pass ? "banner good" : "banner bad"}>
                          {item.verdict.pass
                            ? `Passed all three quality checks on draft ${item.draft}`
                            : `Didn't pass every quality check after ${MAX_DRAFTS} drafts. This is the closest one, so review it before you use it.`}
                        </p>
                        <ul className="gates">
                          {GATES.map((g) => {
                            const ok = !item.verdict!.failed.includes(g.key);
                            const score = item.verdict!.scores[g.key];
                            return (
                              <li key={g.key} className={ok ? "ok" : "fail"}>
                                <div className="gate-top">
                                  <span>{g.label}</span>
                                  <span className="gate-score">
                                    {score}
                                    <small> / needs {item.verdict!.mins[g.key]}</small>
                                    <b>{ok ? "Pass" : "Fail"}</b>
                                  </span>
                                </div>
                                <div className="bar" aria-hidden="true">
                                  <i style={{ width: `${score}%` }} />
                                  <u style={{ left: `${item.verdict!.mins[g.key]}%` }} />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="judged">
                          {item.verdict.note ||
                            (item.verdict.judge === "jev"
                              ? "Scored by Jev. Claims checked against your history by Claude."
                              : "Scored by Claude as an independent reviewer.")}
                        </p>
                        {item.verdict.fabrications.length > 0 && (
                          <>
                            <p className="sub">Not found in your history. Remove or correct before sending.</p>
                            <ul className="gaps">
                              {item.verdict.fabrications.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}

                    {!!item.keywords?.length && (
                      <>
                        <p className="sub">Covered from the posting</p>
                        <ul className="tags">
                          {item.keywords.map((k) => (
                            <li key={k}>{k}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!!item.gaps?.length && (
                      <>
                        <p className="sub">Asked for, but not in your history</p>
                        <ul className="gaps">
                          {item.gaps.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    <p className="sub">Your résumé</p>
                    {item.pdf ? (
                      <PdfPreview pdf={item.pdf} />
                    ) : item.pdfBusy ? (
                      <p className="working">Turning the LaTeX into a PDF</p>
                    ) : null}
                    {item.pdfStale && !item.pdfBusy && (
                      <div className="actions">
                        <button onClick={() => makePdf(item.id, item.tex || "")}>
                          Update the preview with your edits
                        </button>
                      </div>
                    )}

                    <div className="actions">
                      <button className="main" onClick={() => downloadPdf(item)} disabled={item.pdfBusy}>
                        {item.pdfBusy ? "Making PDF…" : "Download PDF"}
                      </button>
                      <button
                        onClick={() =>
                          downloadBlob(
                            new Blob([item.tex || ""], { type: "application/x-tex" }),
                            slug(item.name, item.job?.company) + ".tex"
                          )
                        }
                      >
                        Download .tex
                      </button>
                      <button onClick={() => openInOverleaf(item.tex || "")}>Open in Overleaf</button>
                    </div>
                    {item.pdfError && (
                      <p className="problem" role="alert">
                        {item.pdfError}
                      </p>
                    )}

                    <details>
                      <summary>Edit the LaTeX</summary>
                      <textarea
                        aria-label="LaTeX source"
                        className="code"
                        value={item.tex}
                        onChange={(e) => patch(item.id, { tex: e.target.value, pdfStale: true })}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    </details>
                  </>
                )}
              </article>
            );
          })}
        </section>
      </div>

      <footer>
        Résumé layout: <a href="https://github.com/jakegut/resume">Jake&apos;s Resume</a> by Jake
        Gutierrez, MIT License. Check every line before you send it.
      </footer>
    </main>
  );
}
