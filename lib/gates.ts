// Gate scores a résumé must reach before it is offered for download.
//
// Two judges can score a draft:
// - Jev (TypeSafe AI's decision model), used when TYPESAFE_API_KEY is set.
//   It returns calibrated scores and probabilities, never text.
// - Claude as an independent reviewer, used as the fallback scorer. It also
//   always writes the list of unsupported claims and the fixes for the next
//   draft, because Jev cannot produce text.
export const GATES = [
  { key: "match", label: "Job match", min: 80, jevMin: 75 },
  { key: "truth", label: "Truthfulness", min: 100, jevMin: 90 },
  { key: "bullets", label: "XYZ / PAR bullets", min: 80, jevMin: 75 },
  { key: "writing", label: "Clarity and length", min: 75, jevMin: 75 },
] as const;

export type GateKey = (typeof GATES)[number]["key"];
export type Scores = Record<GateKey, number>;
export type Judge = "jev" | "claude";

export type Verdict = {
  judge: Judge;
  note?: string;
  scores: Scores;
  mins: Scores;
  fabrications: string[];
  feedback: string[];
  failed: GateKey[];
  pass: boolean;
};

export const MAX_DRAFTS = 4;

export function minsFor(judge: Judge): Scores {
  return Object.fromEntries(GATES.map((g) => [g.key, judge === "jev" ? g.jevMin : g.min])) as Scores;
}

// A draft passes only when every score reaches its minimum and the reviewer
// found no claim missing from the candidate's own material.
export function grade(scores: Scores, mins: Scores, fabrications: string[]) {
  const failed = GATES.filter((g) => !(Number(scores[g.key]) >= mins[g.key])).map((g) => g.key);
  if (fabrications.length && !failed.includes("truth")) failed.push("truth");
  return { failed, pass: failed.length === 0 };
}
