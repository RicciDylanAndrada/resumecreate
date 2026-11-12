# Résumé maker

Paste LinkedIn job links, add your work history and old résumés, and get one
tailored résumé per job in [Jake's Resume](https://github.com/jakegut/resume)
LaTeX template, downloadable as `.tex` or PDF.

## How it works

1. `/api/job` reads the public LinkedIn posting for each link (title, company,
   description). If LinkedIn blocks the request, the site asks you to paste the
   description instead.
2. `/api/generate` sends the posting, your work history and uploaded résumés
   (PDF, .docx, .tex, .txt) to Claude. It identifies the profession, picks what
   to emphasize, and returns structured résumé data. It is told to use only
   facts you supplied and to list missing requirements as gaps.
3. `/api/judge` scores each draft against four gates set in `lib/gates.ts`:
   job match, truthfulness, XYZ/PAR bullets, clarity and length.
   - With `TYPESAFE_API_KEY` set, [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
     scores the gates (`lib/jev.ts`): three 5-level score questions and three
     true/false truth checks, the weakest of which decides the truth gate.
     Minimums: 75, 90, 75, 75.
   - Claude also reviews every draft, lists any claim it can't find in your
     material, and writes the fixes for the next draft (Jev returns no text).
     Any unsupported claim fails the truth gate. Without a TypeSafe key, or
     if Jev can't be reached, Claude's own scores are used (minimums 80, 100,
     80, 75).
   - A failed draft is rewritten with the findings, up to 4 drafts. If none
     passes, the closest draft is shown with its failed gates.
4. `lib/jake.ts` turns that data into LaTeX with Jake's template, escaping
   special characters so the file always compiles.
5. `/api/pdf` compiles the `.tex` to PDF through a LaTeX-on-HTTP service
   (Vercel functions can't run TeX themselves).

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. On vercel.com choose **Add New → Project** and import the repository. The
   Next.js defaults need no changes.
3. Under **Environment Variables** add:
   - `ANTHROPIC_API_KEY` (required), from console.anthropic.com
   - `TYPESAFE_API_KEY` (optional): turns on Jev as the gate scorer
   - `ACCESS_CODE` (recommended): visitors get a lock screen and must enter
     it before any page or API loads, so strangers can't spend your credits
   - `ANTHROPIC_MODEL` (optional, default `claude-sonnet-5-5`)
   - `LATEX_COMPILE_URL` (optional, default `https://latex.ytotech.com/builds/sync`)
4. Deploy.

Or from this folder: `npx vercel` then `npx vercel --prod`.

## Run locally

```
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

## Notes

- The writer and judge routes ask for up to 300 seconds (`maxDuration`). That
  needs Fluid Compute, which is on by default for new Vercel projects.
- Uploads are capped at 3 MB together (Vercel limits request bodies to 4.5 MB).
- Nothing is stored on the server. Work history is remembered in the browser only.
- The default PDF compiler is a free public service; for heavy use, host your
  own [latex-on-http](https://github.com/YtoTech/latex-on-http) and set
  `LATEX_COMPILE_URL`.
