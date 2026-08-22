import { vanityHostname } from "@/lib/hosts";
import { HTTP_STATUS } from "@/lib/http";

const VERCEL_DOMAIN_ERROR = {
  ALREADY_IN_USE: "domain_already_in_use",
  ALREADY_EXISTS: "domain_already_exists",
} as const;

function vercelConfig() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_ID_SAAR;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return null;
  }

  return { token, projectId, teamId };
}

function teamQuery(teamId: string | undefined) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

/**
 * Attach `{label}.saar.to` to the Vercel project so Hobby can serve it.
 * No-ops when VERCEL_TOKEN / VERCEL_PROJECT_ID are unset (local/dev).
 */
export async function ensureVanityDomain(
  label: string,
): Promise<{ ok: true; provisioned: boolean } | { ok: false; error: string }> {
  const config = vercelConfig();
  if (!config) {
    console.warn("[vercel-domains] VERCEL_TOKEN or VERCEL_PROJECT_ID unset; skip domain add");
    return { ok: true, provisioned: false };
  }

  const domain = vanityHostname(label);
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(config.projectId)}/domains${teamQuery(config.teamId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );

  if (response.ok) {
    return { ok: true, provisioned: true };
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  const code = body.error?.code;
  // Already attached is fine
  if (
    response.status === HTTP_STATUS.CONFLICT ||
    code === VERCEL_DOMAIN_ERROR.ALREADY_IN_USE ||
    code === VERCEL_DOMAIN_ERROR.ALREADY_EXISTS
  ) {
    return { ok: true, provisioned: true };
  }

  const message = body.error?.message ?? `Vercel domain add failed (${response.status})`;
  console.error(`[vercel-domains] add ${domain}:`, message);
  return { ok: false, error: message };
}

export async function removeVanityDomain(label: string): Promise<void> {
  const config = vercelConfig();
  if (!config) {
    return;
  }

  const domain = vanityHostname(label);
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(config.teamId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    },
  );

  if (response.ok || response.status === HTTP_STATUS.NOT_FOUND) {
    return;
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  console.error(`[vercel-domains] remove ${domain}:`, body.error?.message ?? response.status);
}
