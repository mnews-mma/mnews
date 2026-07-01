import { redirect } from "next/navigation";

export default async function FighterCardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ fighter?: string }>;
}) {
  const { fighter } = await searchParams;
  const dest = fighter ? `/admin/og-card?fighter=${fighter}` : "/admin/og-card";
  redirect(dest);
}
