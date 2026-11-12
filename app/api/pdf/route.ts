import { denied } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel functions can't run a TeX install, so the .tex is compiled by a
// LaTeX-on-HTTP service (YtoTech API shape). Point LATEX_COMPILE_URL at
// your own instance if you prefer: https://github.com/YtoTech/latex-on-http
const COMPILE_URL = process.env.LATEX_COMPILE_URL || "https://latex.ytotech.com/builds/sync";

export async function POST(req: Request) {
  const no = denied(req);
  if (no) return no;

  const { tex } = (await req.json().catch(() => ({}))) as { tex?: string };
  if (!tex || tex.length > 200_000 || !tex.includes("\\begin{document}")) {
    return Response.json({ error: "There's no LaTeX to compile yet." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(COMPILE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ compiler: "pdflatex", resources: [{ main: true, content: tex }] }),
    });
  } catch {
    return Response.json(
      { error: "The PDF compiler couldn't be reached. Download the .tex or open it in Overleaf instead." },
      { status: 502 }
    );
  }

  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("application/pdf")) {
    const detail = await res.text().catch(() => "");
    let log = "";
    try {
      const parsed = JSON.parse(detail);
      log = String(parsed?.log_files?.["__main_document__.log"] || parsed?.logs || parsed?.error || "");
    } catch {
      log = detail;
    }
    const firstError = log.split("\n").find((l) => l.startsWith("!")) || "";
    return Response.json(
      {
        error:
          "LaTeX couldn't compile this file" +
          (firstError ? `: ${firstError.slice(0, 200)}` : ".") +
          " Fix the LaTeX below, or open it in Overleaf to see the full log.",
      },
      { status: 422 }
    );
  }

  return new Response(await res.arrayBuffer(), {
    headers: { "content-type": "application/pdf", "cache-control": "no-store" },
  });
}
