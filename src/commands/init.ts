import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import chalk from "chalk";
import { input, select } from "@inquirer/prompts";
import { TEMPLATES, templateGenerators } from "../templates/index.js";

export async function initCommand(nameArg?: string) {
  console.log(chalk.red("🦞") + chalk.bold(" pinch init") + " — scaffold a new MCP server\n");

  const name = nameArg || await input({ message: "Tool name:", default: "my-pincher" });
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const description = await input({ message: "Description:", default: "A Pinchers MCP tool" });
  const category = await select({
    message: "Category:",
    choices: [
      { value: "Finance" }, { value: "Research" }, { value: "Deployment" },
      { value: "Email" }, { value: "Design" }, { value: "Analytics" },
      { value: "Productivity" }, { value: "Development" },
    ],
  });

  const template = await select({
    message: "Template:",
    choices: TEMPLATES.map((t) => ({
      value: t.value,
      name: `${t.name} — ${t.description}`,
    })),
  });

  const dir = join(process.cwd(), slug);

  if (existsSync(dir)) {
    console.log(chalk.red(`\n  Directory ${slug}/ already exists.\n`));
    process.exit(1);
  }

  // Generate all files from template
  const generator = templateGenerators[template];
  const files = generator(name, slug, description, category);

  // Write files, creating directories as needed
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(dir, filePath);
    const fileDir = dirname(fullPath);
    await mkdir(fileDir, { recursive: true });
    await writeFile(fullPath, content);
  }

  // Pretty-print file tree
  const paths = Object.keys(files).sort();
  console.log(chalk.green(`\n  ✓ Created ${slug}/`) + chalk.dim(` (${template} template)`));
  for (let i = 0; i < paths.length; i++) {
    const isLast = i === paths.length - 1;
    const prefix = isLast ? "└──" : "├──";
    console.log(`  ${chalk.dim(prefix)} ${paths[i]}`);
  }

  console.log(`\n  Next steps:`);
  console.log(`    ${chalk.cyan("cd " + slug)}`);
  console.log(`    ${chalk.cyan("npm install")}`);
  console.log(`    ${chalk.cyan("pinch dev")}\n`);
}
