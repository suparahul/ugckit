import { notFound } from "next/navigation";

import { getApp } from "@/lib/apps";

export const dynamic = "force-dynamic";

export default async function HomeBase({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app && slug !== "new") notFound();
  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">{app?.name ?? "Your app"}</h1>
          <p className="prod__counts">The home base is built in the next phase.</p>
        </div>
      </header>
    </div>
  );
}
