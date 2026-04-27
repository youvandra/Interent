import { redirect } from "next/navigation";

export default async function MarketplacePage() {
  // Backward-compat: old route name
  redirect("/provider");
}
