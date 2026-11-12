import * as cheerio from "cheerio";
import { denied } from "@/lib/guard";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function linkedInJobId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  const fromQuery = url.searchParams.get("currentJobId");
  if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
  // /jobs/view/1234567890 or /jobs/view/some-title-at-company-1234567890
  const m = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})\/?$/);
  return m ? m[1] : null;
}

export async function POST(req: Request) {
  const no = denied(req);
  if (no) return no;

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const id = url ? linkedInJobId(url) : null;
  if (!id) {
    return Response.json(
      {
        error:
          "That doesn't look like a LinkedIn job link. Use a link like linkedin.com/jobs/view/1234567890, or paste the job description instead.",
      },
      { status: 400 }
    );
  }

  let html: string;
  try {
    const res = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    html = await res.text();
  } catch {
    return Response.json(
      {
        error:
          "LinkedIn didn't return this posting (it may be closed, or LinkedIn is blocking the request). Paste the job description instead.",
      },
      { status: 502 }
    );
  }

  const $ = cheerio.load(html);
  const desc = $(".show-more-less-html__markup").first();
  desc.find("br").replaceWith("\n");
  desc.find("li").each((_, el) => {
    $(el).prepend("- ").append("\n");
  });
  desc.find("p, ul, ol, h1, h2, h3, h4").append("\n");

  const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  const job: Job = {
    title: clean($(".top-card-layout__title, .topcard__title").first().text()),
    company: clean($(".topcard__org-name-link, .topcard__flavor").first().text()),
    location: clean($(".topcard__flavor--bullet").first().text()),
    description: clean(desc.text()).slice(0, 20000),
    url: `https://www.linkedin.com/jobs/view/${id}`,
  };

  if (!job.description) {
    return Response.json(
      { error: "Couldn't read the description from this posting. Paste the job description instead." },
      { status: 502 }
    );
  }
  return Response.json({ job });
}
