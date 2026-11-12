// Jev: TypeSafe AI's decision model. One request carries the state (posting,
// candidate's source material, résumé draft) and typed questions; it answers
// with scores and probabilities instead of text.
// Docs: https://docs.typesafe.ai/introduction/quickstart
import type { Scores } from "./gates";

const URL = process.env.JEV_URL || "https://api.typesafe.ai/v1/systemone";

const QUESTIONS = {
  match: {
    type: "score",
    instructions:
      "How well resume_draft presents this candidate for job_posting, counting only requirements that candidate_source supports. Requirements the candidate's history does not show should not lower the level.",
    criteria: [
      "The résumé is generic and ignores what the posting asks for",
      "A few relevant points appear, but the posting's main requirements that the candidate meets are buried or missing",
      "Most supported requirements appear, but not prominently or not in the posting's vocabulary",
      "Supported requirements are shown clearly in the posting's vocabulary, with small ordering or emphasis problems",
      "Every supported requirement is shown prominently, most relevant experience first, irrelevant material trimmed",
    ],
  },
  bullets: {
    type: "score",
    instructions:
      "How well the bullet points in resume_draft follow Google's XYZ formula (accomplished X, as measured by Y, by doing Z) or PAR (problem, action, result). A bullet without a number is acceptable when candidate_source gives no number for it.",
    criteria: [
      "Bullets list duties or tools with no outcome",
      "A few bullets state an outcome; most describe duties or open with weak phrases such as 'responsible for' or 'worked on'",
      "About half the bullets state an action and its result",
      "Most bullets open with a strong verb and give the action, the result and the measure where one exists",
      "Every bullet gives the outcome, the measure where the source has one, and how it was achieved",
    ],
  },
  writing: {
    type: "score",
    instructions: "How clear and concise resume_draft is, and whether it fits one page.",
    criteria: [
      "Hard to read: long paragraphs, first person, inconsistent tense, or far too long for one page",
      "Readable but padded with filler or buzzwords, or clearly over one page",
      "Mostly clear, with some wordy bullets or uneven tense",
      "Clear and consistent, bullets of one to two lines, close to one page",
      "Tight throughout: consistent tense, no filler, skills grouped sensibly, fits one page",
    ],
  },
  truth_numbers: {
    type: "noul",
    instructions:
      "Every number, percentage, amount and metric in resume_draft also appears in candidate_source.",
  },
  truth_roles: {
    type: "noul",
    instructions:
      "Every employer, job title, date, school and degree in resume_draft also appears in candidate_source.",
  },
  truth_claims: {
    type: "noul",
    instructions:
      "Every skill, tool and achievement in resume_draft is stated in or directly supported by candidate_source.",
  },
} as const;

type Answer = { score?: number; noul?: number };

export async function jevScores(state: {
  job_posting: string;
  candidate_source: string;
  resume_draft: string;
}): Promise<Scores> {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: process.env.JEV_MODEL || "jev-latest", state, questions: QUESTIONS }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const answers = ((await res.json()).answers || {}) as Record<string, Answer>;

  const level = (key: "match" | "bullets" | "writing") => {
    const top = QUESTIONS[key].criteria.length - 1;
    const score = answers[key]?.score;
    if (typeof score !== "number") throw new Error(`Jev gave no score for ${key}`);
    return Math.round((Math.max(0, Math.min(top, score)) / top) * 100);
  };
  const truths = (["truth_numbers", "truth_roles", "truth_claims"] as const).map((k) => {
    const p = answers[k]?.noul;
    if (typeof p !== "number") throw new Error(`Jev gave no answer for ${k}`);
    return p;
  });

  return {
    match: level("match"),
    bullets: level("bullets"),
    writing: level("writing"),
    // The weakest of the three truth checks decides the gate.
    truth: Math.round(Math.min(...truths) * 100),
  };
}
