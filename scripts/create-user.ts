import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../lib/models/user";
import { ensureUserRoles } from "../lib/roles";

function usage() {
  console.error(
    `Usage:
  npm run create-user -- --name "Owner" --email you@example.com --password '…' [--target local|production]

Creates an owner account. Members must register via an invite link.

--target local        load .env.local (default)
--target production   load .env.prod (pull with: npm run env:pull-prod)`,
  );
}

type Target = "local" | "production";

function parseTarget(value: string | undefined): Target {
  if (!value || value === "local") {
    return "local";
  }
  if (value === "production" || value === "prod") {
    return "production";
  }
  console.error(`Unknown --target ${value}. Use local or production.`);
  process.exit(1);
}

function envFileFor(target: Target): string {
  switch (target) {
    case "local":
      return ".env.local";
    case "production":
      return ".env.prod";
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

function loadEnv(target: Target): void {
  const file = envFileFor(target);
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    if (target === "production") {
      console.error("Missing .env.prod. Pull production env from Vercel:\n  npm run env:pull-prod");
    } else {
      console.error("Missing .env.local. Copy .env.example to .env.local.");
    }
    process.exit(1);
  }
  process.loadEnvFile(path);
}

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in the selected env file.");
    process.exit(1);
  }
  if (uri.includes("[SENSITIVE]") || uri.includes("[HIDDEN]")) {
    console.error(
      "MONGODB_URI in .env.prod is a Vercel placeholder. Re-run in your own terminal:\n  npm run env:pull-prod",
    );
    process.exit(1);
  }
  return uri;
}

function describeMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable URI)";
  }
}

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const name = getArg("--name");
  const email = getArg("--email")?.trim().toLowerCase();
  const password = getArg("--password");
  const target = parseTarget(getArg("--target"));

  if (!name || !email || !password) {
    usage();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  loadEnv(target);
  const uri = mongoUri();
  console.log(`Creating owner in ${target} (${describeMongoUri(uri)})`);

  await mongoose.connect(uri, { dbName: "url-shortener" });
  await ensureUserRoles();

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await hash(password, 12),
    role: "owner",
  });

  console.log(`Created owner ${user.email} (${user._id.toString()})`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
