import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const { user, member } = await getSession();
  if (!user) redirect("/login");
  if (!member) redirect("/onboarding");
  redirect(member.role === "parent" ? "/parent" : "/nanny");
}
