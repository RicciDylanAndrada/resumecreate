// Renders résumé data into "Jake's Resume" LaTeX template.
// Template by Jake Gutierrez, MIT License: https://github.com/jakegut/resume
import type { ResumeData } from "./types";

const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function tex(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/\u2192/g, "to")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u201C/g, "``")
    .replace(/\u201D/g, "''")
    .replace(/\u2013/g, "--")
    .replace(/\u2014/g, "---")
    .replace(/\u00A0/g, " ")
    // pdflatex cannot typeset emoji or symbols outside Latin scripts
    .replace(/[^\x09\x0A\x20-\x7E\u00A1-\u024F]/g, "")
    .replace(/[\\&%$#_{}~^]/g, (c) => ESCAPES[c])
    .replace(/\s+/g, " ")
    .trim();
}

function link(raw: string | undefined, prefix = ""): string {
  if (!raw) return "";
  const shown = raw.trim().replace(/^https?:\/\//i, "").replace(/^mailto:/i, "").replace(/\/$/, "");
  if (!shown) return "";
  const href = (prefix || "https://") + shown;
  const safeHref = href.replace(/[\\{}\s]/g, "").replace(/([%#])/g, "\\$1");
  return `\\href{${safeHref}}{\\underline{${tex(shown)}}}`;
}

const PREAMBLE = String.raw`%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generated pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%
`;

function bullets(items: string[]): string {
  const clean = (items || []).map(tex).filter(Boolean);
  if (!clean.length) return "";
  return [
    "      \\resumeItemListStart",
    ...clean.map((b) => `        \\resumeItem{${b}}`),
    "      \\resumeItemListEnd",
  ].join("\n");
}

function heading(r: ResumeData): string {
  const contact = [
    tex(r.phone),
    r.email ? link(r.email, "mailto:") : "",
    link(r.linkedin),
    link(r.github),
    link(r.website),
  ].filter(Boolean);
  return [
    "\\begin{center}",
    `    \\textbf{\\Huge \\scshape ${tex(r.name) || "Your Name"}} \\\\ \\vspace{1pt}`,
    contact.length ? `    \\small ${contact.join(" $|$ ")}` : "",
    "\\end{center}",
  ]
    .filter(Boolean)
    .join("\n");
}

function education(r: ResumeData): string {
  if (!r.education?.length) return "";
  return [
    "\\section{Education}",
    "  \\resumeSubHeadingListStart",
    ...r.education.map(
      (e) =>
        `    \\resumeSubheading\n      {${tex(e.school)}}{${tex(e.location)}}\n      {${tex(e.degree)}}{${tex(e.dates)}}`
    ),
    "  \\resumeSubHeadingListEnd",
  ].join("\n");
}

function experience(r: ResumeData): string {
  if (!r.experience?.length) return "";
  return [
    "\\section{Experience}",
    "  \\resumeSubHeadingListStart",
    ...r.experience.map((e) =>
      [
        `    \\resumeSubheading\n      {${tex(e.title)}}{${tex(e.dates)}}\n      {${tex(e.company)}}{${tex(e.location)}}`,
        bullets(e.bullets),
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "  \\resumeSubHeadingListEnd",
  ].join("\n");
}

function projects(r: ResumeData): string {
  if (!r.projects?.length) return "";
  return [
    `\\section{${tex(r.projectsHeading) || "Projects"}}`,
    "  \\resumeSubHeadingListStart",
    ...r.projects.map((p) => {
      const title = `\\textbf{${tex(p.name)}}` + (p.tech ? ` $|$ \\emph{${tex(p.tech)}}` : "");
      return [`    \\resumeProjectHeading\n      {${title}}{${tex(p.dates)}}`, bullets(p.bullets)]
        .filter(Boolean)
        .join("\n");
    }),
    "  \\resumeSubHeadingListEnd",
  ].join("\n");
}

function skills(r: ResumeData): string {
  const rows = (r.skills || [])
    .filter((s) => s.category && s.items)
    .map((s) => `     \\textbf{${tex(s.category)}}{: ${tex(s.items)}}`);
  if (!rows.length) return "";
  return [
    `\\section{${tex(r.skillsHeading) || "Technical Skills"}}`,
    " \\begin{itemize}[leftmargin=0.15in, label={}]",
    "    \\small{\\item{",
    rows.join(" \\\\\n"),
    "    }}",
    " \\end{itemize}",
  ].join("\n");
}

export function renderJake(r: ResumeData): string {
  const edu = education(r);
  const exp = experience(r);
  const body = r.educationFirst ? [edu, exp] : [exp, edu];
  return (
    PREAMBLE +
    "\n\\begin{document}\n\n" +
    [heading(r), ...body, projects(r), skills(r)].filter(Boolean).join("\n\n") +
    "\n\n\\end{document}\n"
  );
}
