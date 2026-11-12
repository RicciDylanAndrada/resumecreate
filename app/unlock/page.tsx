import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, unlocked } from "@/lib/access";
import UnlockForm from "./form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Enter access code · Résumé maker" };

export default async function UnlockPage() {
  // No code set, or already unlocked: nothing to do here.
  if (await unlocked((await cookies()).get(ACCESS_COOKIE)?.value)) redirect("/");
  return <UnlockForm />;
}
