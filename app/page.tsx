import { readdirSync } from "node:fs";
import path from "node:path";
import { TeamProjector } from "@/components/team-projector";
import { TeamStatic } from "@/components/team-static";
import { teamInfo } from "@/data/team";

/**
 * Les silhouettes réellement produites par `pnpm scene:build`. On les lit au
 * build (et à chaque requête en dev) pour ne jamais demander au navigateur une
 * image absente : une personne non découpée reste simplement floue au focus.
 */
function availableCutouts() {
  try {
    return readdirSync(path.join(process.cwd(), "public/scene/people"))
      .filter((file) => file.endsWith(".webp"))
      .map((file) => path.basename(file, ".webp"));
  } catch {
    return [];
  }
}

export default function Home() {
  const available = availableCutouts();

  return (
    <main>
      <TeamProjector available={available} />
      <TeamStatic />

      <footer className="footer">
        <p>
          {teamInfo.name} · {teamInfo.tagline}
        </p>
        <a href={teamInfo.cta.href}>softvodooz.com</a>
      </footer>
    </main>
  );
}
