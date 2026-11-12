import mammoth from "mammoth";
import type { Job, ResumeData, UploadedFile } from "./types";

export type Block = Record<string, unknown>;

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function fileBlocks(files: UploadedFile[]): Promise<Block[]> {
  const blocks: Block[] = [];
  try {
    for (const f of files.slice(0, 5)) {
      const name = f.name.toLowerCase();
      if (f.mime === "application/pdf" || name.endsWith(".pdf")) {
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: f.data },
          title: f.name,
        });
        continue;
      }
      const buffer = Buffer.from(f.data, "base64");
      const text = name.endsWith(".docx")
        ? (await mammoth.extractRawText({ buffer })).value
        : buffer.toString("utf8");
      blocks.push({
        type: "text",
        text: `<existing_resume file="${f.name.replace(/"/g, "")}">\n${text.slice(0, 40000)}\n</existing_resume>`,
      });
    }
  } catch {
    throw new UserError("One of the uploaded files couldn't be read. Try a PDF, .docx, .tex or .txt file.");
  }
  return blocks;
}

// Plain text of every uploaded file, for judges that take text only.
export async function fileTexts(files: UploadedFile[]): Promise<string> {
  const parts: string[] = [];
  try {
    for (const f of files.slice(0, 5)) {
      const name = f.name.toLowerCase();
      const buffer = Buffer.from(f.data, "base64");
      let text: string;
      if (f.mime === "application/pdf" || name.endsWith(".pdf")) {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        text = (await extractText(pdf, { mergePages: true })).text;
      } else if (name.endsWith(".docx")) {
        text = (await mammoth.extractRawText({ buffer })).value;
      } else {
        text = buffer.toString("utf8");
      }
      parts.push(`[${f.name}]\n${text.slice(0, 30000)}`);
    }
  } catch {
    throw new UserError("One of the uploaded files couldn't be read. Try a PDF, .docx, .tex or .txt file.");
  }
  return parts.join("\n\n");
}

export function resumeText(r: ResumeData): string {
  const lines: string[] = [
    r.name,
    [r.phone, r.email, r.linkedin, r.github, r.website].filter(Boolean).join(" | "),
  ];
  if (r.experience?.length) lines.push("", "EXPERIENCE");
  for (const e of r.experience || []) {
    lines.push([e.title, e.company, e.location, e.dates].filter(Boolean).join(", "));
    for (const b of e.bullets || []) lines.push(`- ${b}`);
  }
  if (r.education?.length) lines.push("", "EDUCATION");
  for (const e of r.education || []) lines.push([e.degree, e.school, e.location, e.dates].filter(Boolean).join(", "));
  if (r.projects?.length) lines.push("", "PROJECTS");
  for (const p of r.projects || []) {
    lines.push([p.name, p.tech, p.dates].filter(Boolean).join(", "));
    for (const b of p.bullets || []) lines.push(`- ${b}`);
  }
  if (r.skills?.length) lines.push("", "SKILLS");
  for (const k of r.skills || []) lines.push(`${k.category}: ${k.items}`);
  return lines.filter((l) => l !== undefined).join("\n");
}

export function sourceText(job: Job, background: string): string {
  return [
    `<job_posting>`,
    `Title: ${job.title || "(not given)"}`,
    `Company: ${job.company || "(not given)"}`,
    `Location: ${job.location || "(not given)"}`,
    ``,
    job.description.slice(0, 20000),
    `</job_posting>`,
    ``,
    `<candidate_background>`,
    background.slice(0, 40000) || "(none typed; rely on the attached résumés)",
    `</candidate_background>`,
  ].join("\n");
}

type Tool = { name: string; description: string; input_schema: unknown };

// Calls Claude and forces the answer through one tool, so the reply is
// always structured data.
export async function callTool<T>(system: string, content: Block[], tool: Tool, maxTokens: number): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new UserError("The site owner hasn't set ANTHROPIC_API_KEY in the Vercel project settings yet.", 500);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Anthropic API error", res.status, detail);
    let message = `The model service returned ${res.status}. Try again in a moment.`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {}
    throw new UserError(message, 502);
  }
  const data = await res.json();
  const call = (data.content || []).find((b: { type: string }) => b.type === "tool_use");
  if (!call?.input) throw new UserError("The reply came back incomplete. Try again.", 502);
  return call.input as T;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof UserError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong on the server. Try again." }, { status: 500 });
}
