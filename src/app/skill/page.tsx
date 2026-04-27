import { readFile } from "node:fs/promises";
import path from "node:path";

export const metadata = {
  title: "SKILL.MD • Interent",
  description: "Interent skill documentation for agent context.",
};

export default async function SkillPage() {
  const skillPath = path.join(process.cwd(), "skill.md");
  const content = await readFile(skillPath, "utf8");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">SKILL.MD</h1>
      <p className="mt-2 text-sm text-[--color-muted]">
        This page renders <code className="font-mono">skill.md</code> for agent context.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-xl border border-[--color-border] bg-[--color-surface] p-4 text-xs leading-5 text-[--color-text]">
        {content}
      </pre>
    </div>
  );
}
