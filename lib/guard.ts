// Optional shared access code so a public deployment can't be used to
// spend the owner's API credits.
export function denied(req: Request): Response | null {
  const code = process.env.ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get("x-access-code") === code) return null;
  return Response.json(
    { error: "Enter the access code under Settings to use this site.", needsCode: true },
    { status: 401 }
  );
}
