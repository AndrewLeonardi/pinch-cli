import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";
import chalk from "chalk";
import { input, select } from "@inquirer/prompts";
import { TEMPLATES, templateGenerators } from "../templates/index.js";

export async function initCommand(nameArg?: string) {
  console.log(
    chalk.bold("\n  ⚡ pinch init") + chalk.dim(" — create a new MCP server\n")
  );

  // Brief MCP explainer for newcomers
  console.log(
    chalk.dim(
      "  MCP (Model Context Protocol) lets AI assistants use your tools.\n" +
        "  You build the tool logic, AI agents call it. Think of it as\n" +
        "  building an API that any AI can discover and use automatically.\n"
    )
  );

  const name =
    nameArg ||
    (await input({ message: "Tool name:", default: "my-mcp-server" }));
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const description = await input({
    message: "What does your tool do?",
    default: "An MCP tool that helps with...",
  });
  const category = await select({
    message: "Category:",
    choices: [
      { value: "Productivity" },
      { value: "Finance" },
      { value: "Marketing" },
      { value: "Design" },
      { value: "Development" },
      { value: "Communication" },
      { value: "Data & Analytics" },
      { value: "Content" },
      { value: "Education" },
      { value: "Health & Fitness" },
      { value: "Events & Planning" },
      { value: "Legal" },
      { value: "Sales" },
      { value: "HR & Recruiting" },
      { value: "Other" },
    ],
  });

  const template = await select({
    message: "Start from:",
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
  console.log(
    chalk.green(`\n  ✓ Created ${slug}/`) + chalk.dim(` (${template} template)`)
  );
  for (let i = 0; i < paths.length; i++) {
    const isLast = i === paths.length - 1;
    const prefix = isLast ? "└──" : "├──";
    console.log(`  ${chalk.dim(prefix)} ${paths[i]}`);
  }

  // Auto npm install
  console.log(chalk.dim(`\n  Installing dependencies...`));

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npm", ["install"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `npm install exited with code ${code}`));
        }
      });

      child.on("error", reject);
    });

    console.log(chalk.green("  ✓ Dependencies installed"));
  } catch (err) {
    console.log(chalk.yellow("  ⚠ npm install failed — run it manually:"));
    console.log(chalk.dim(`    cd ${slug} && npm install\n`));
  }

  // Next steps
  console.log(`\n  ${chalk.bold("Get started:")}`);
  console.log(`    ${chalk.cyan("cd " + slug)}`);
  console.log(`    ${chalk.cyan("pinch dev")}          ${chalk.dim("# start dev server + playground")}`);
  console.log();
  console.log(`  ${chalk.bold("When you're ready to ship:")}`);
  console.log(`    ${chalk.cyan("pinch test")}         ${chalk.dim("# validate everything works")}`);
  console.log(`    ${chalk.cyan("pinch deploy")}       ${chalk.dim("# deploy to Cloudflare Workers (pre-configured!)")}`);
  console.log();
}
