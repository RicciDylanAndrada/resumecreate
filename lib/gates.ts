// Scores for each résumé draft.
//
// "match" is how much of what the posting asks for the résumé shows. It is
// reported honestly and never blocks: people can apply to jobs they only
// partly match.
//
// The three quality gates below do block. A draft is rewritten until all of
// them pass (or MAX_DRAFTS is reached).
//
// Two judges can score a draft:
// - Jev (TypeSafe AI's decision model), used when TYPESAFE_API_KEY is set.
//   It returns calibrated scores and probabilities, never text.
// - Claude as an independent reviewer, the fallback scorer. It also always
//   writes the list of unsupported claims and the fixes for the next draft,
//   because Jev cannot produce text.
export const GATES = [
  { key: "truth", label: "Truthful to your history", min: 100, jevMin: 90 },
  { key: "bullets", label: "XYZ / PAR bullets", min: 80, jevMin: 75 },
  { key: "writing", label: "Clarity and length", min: 75, jevMin: 75 },
] as const;

export type GateKey = (typeof GATES)[number]["key"];
export type Scores = Record<GateKey | "match", number>;
export type Judge = "jev" | "claude";

export type Verdict = {
  judge: Judge;
  note?: string;
  scores: Scores;
  mins: Record<GateKey, number>;
  fabrications: string[];
  feedback: string[];
  failed: GateKey[];
  pass: boolean;
};

export const MAX_DRAFTS = 4;

export function minsFor(judge: Judge): Record<GateKey, number> {
  return Object.fromEntries(GATES.map((g) => [g.key, judge === "jev" ? g.jevMin : g.min])) as Record<GateKey, number>;
}

// A draft passes when every quality gate reaches its minimum and the
// reviewer found no claim missing from the candidate's own material.
// The match score plays no part.
export function grade(scores: Scores, mins: Record<GateKey, number>, fabrications: string[]) {
  const failed: GateKey[] = GATES.filter((g) => !(Number(scores[g.key]) >= mins[g.key])).map((g) => g.key);
  if (fabrications.length && !failed.includes("truth")) failed.push("truth");
  return { failed, pass: failed.length === 0 };
}

export function matchLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Good match";
  if (score >= 30) return "Partial match";
  return "A stretch";
}
