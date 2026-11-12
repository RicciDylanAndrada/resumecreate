# Résumé Maker

A private web app that turns a job posting into a résumé written for that job.

You paste a LinkedIn job link, tell it about your work once, and it gives you a
one-page résumé set in [Jake's Resume](https://github.com/jakegut/resume) LaTeX
template — shown on screen as a PDF to review, and downloadable as PDF or
`.tex`. Paste several links and you get one résumé per job, each aimed at that
posting.

It will not invent anything. Every claim has to trace back to the work history
you typed or the résumés you uploaded, and a separate reviewer checks each
draft before you ever see it.

## What you get for each job

- **The profession it read from the posting** — "Senior backend engineer",
  "ICU registered nurse", whatever the posting is actually hiring for.
- **A match score**, honestly reported and never acted on. You don't have to
  tick every box to apply, so a low score is information, not a problem, and
  nothing is added to the résumé to raise it.
- **Three quality checks** the résumé must pass: truthful to your history,
  bullets in XYZ/PAR form, and clarity and length. A draft that fails any of
  them is rewritten with the reviewer's notes, up to four drafts.
- **What the posting asks for that your history doesn't show**, listed plainly
  so you know where you're stretching.
- **The résumé itself**, previewed on the page, with PDF, `.tex` and
  "Open in Overleaf" buttons.

## Using it

1. Paste one or more LinkedIn job links, one per line. No link handy, or
   LinkedIn blocks it? Paste the job description instead.
2. Type your work history — roles, dates, what you did, results, education,
   skills, contact details. Rough notes are fine. You can also upload résumés
   you already have (PDF, Word, `.tex`, `.txt`).
3. Press **Build my résumés** and wait. Each job becomes its own card.
4. Read the preview. To change anything, open **Edit your résumé** and work in
   plain fields: contact details, roles, bullet points, education, skills. You
   can reorder or remove any entry, add new ones, and rename the Projects and
   Skills headings. Press **Update the preview with your edits** to rebuild the
   PDF, then download it.

LaTeX users can edit the file itself under **Edit the LaTeX directly**. Editing
a field rebuilds that file, so hand-written LaTeX is replaced.

Your work history is kept in your browser, so it's there next time. Résumé
cards are not: a refresh clears them.

## How it works

1. `/api/job` reads the public LinkedIn posting for each link (title, company,
   description). If LinkedIn blocks the request, the site asks you to paste the
   description instead.
2. `/api/generate` sends the posting, your work history and your uploaded
   résumés to Claude, which works out the profession, picks what to emphasise
   and returns structured résumé data. It is told to use only facts you
   supplied, to write bullets as XYZ ("accomplished X, as measured by Y, by
   doing Z") where you gave a number and PAR (problem, action, result) where
   you didn't, and to list anything missing as a gap rather than filling it in.
3. `/api/judge` scores the draft (`lib/gates.ts`):
   - With `TYPESAFE_API_KEY` set, [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
     gives the scores (`lib/jev.ts`): three five-level score questions and
     three true/false truth checks, the weakest of which decides the truth
     gate. Minimums 90, 75, 75.
   - Claude reviews every draft either way, lists any claim it can't find in
     your material and writes the fixes for the next draft, since Jev returns
     no text. Any unsupported claim fails the truth gate.
   - Without a TypeSafe key, or if Jev can't be reached, Claude's own scores
     are used (minimums 100, 80, 75) and the card says so.
   - If no draft passes in four tries, the closest one is shown with its failed
     checks and any flagged claims.
4. `lib/jake.ts` renders the data as LaTeX in Jake's template, escaping special
   characters so the file always compiles. The Projects and Skills headings
   follow the profession, so a nurse gets "Clinical Experience" and "Licenses
   and Skills" where an engineer gets "Projects" and "Technical Skills".
5. `/api/pdf` compiles the `.tex` to a PDF, which is drawn on the page with
   pdf.js and offered for download.
6. Edits in the form (`app/editor.tsx`) change the résumé data and re-run
   `renderJake` in the browser, so only the PDF compile goes back to the
   server.

Everything is per-request. Nothing you type, upload or generate is stored on
the server.

## Project layout

```
app/
  page.tsx            the whole interface
  unlock/             access-code lock screen
  api/job/            reads a LinkedIn posting
  api/generate/       writes a draft résumé
  api/judge/          scores it, lists unsupported claims
  api/pdf/            compiles LaTeX to PDF
  api/unlock/         checks the access code
lib/
  jake.ts             résumé data → Jake's LaTeX template
  jev.ts              Jev scoring questions and call
  gates.ts            the gates, their minimums, the draft limit
  claude.ts           Claude calls, file reading, shared prompts
  access.ts           access-code hashing
middleware.ts         keeps the whole site behind the access code
```

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Writes and reviews the résumés. From console.anthropic.com. |
| `ACCESS_CODE` | recommended | Puts a lock screen in front of the site. No page or API loads without it, so strangers can't spend your credits. |
| `TYPESAFE_API_KEY` | no | Turns on Jev as the scorer. Without it, Claude scores. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-5-5`. |
| `JEV_MODEL` | no | Defaults to `jev-latest`. |
| `LATEX_COMPILE_URL` | no | Defaults to the public `latex.ytotech.com` service. |

## Deploy on Vercel

1. Push this repository to GitHub.
2. On vercel.com choose **Add New → Project** and import it. `vercel.json`
   pins the framework to Next.js, so the defaults need no changes.
3. Add the environment variables above under **Settings → Environment
   Variables**.
4. Deploy. Variables only apply to new deployments, so redeploy after changing
   one.

Or from this folder: `npx vercel`, then `npx vercel --prod`.

## Run locally

```
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

## Limits worth knowing

- The writer and judge routes can take up to 300 seconds (`maxDuration`), which
  needs Vercel's Fluid Compute. It's on by default for new projects.
- Uploads are capped at 3 MB together, since Vercel limits request bodies to
  4.5 MB.
- LinkedIn blocks automated requests at times. Pasting the description always
  works.
- The default PDF compiler is a free public service and is documented as
  experimental. For heavy use, host your own
  [latex-on-http](https://github.com/YtoTech/latex-on-http) and set
  `LATEX_COMPILE_URL`.
- The résumé is always one page. Fields that expect a long-form CV aren't
  served by this.
- Read what it writes before you send it. The checks catch a lot, but it's your
  name on the résumé.

## Credits

Résumé layout: [Jake's Resume](https://github.com/jakegut/resume) by Jake
Gutierrez, MIT License, itself based on
[sb2nov/resume](https://github.com/sb2nov/resume).
