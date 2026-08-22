import { User, type UserRole } from "@/lib/models/user";

export function isOwnerRole(role: string | null | undefined): role is "owner" {
  return role === "owner";
}

/** Backfill missing roles: oldest user becomes owner, everyone else member. */
export async function ensureUserRoles() {
  const missing = await User.countDocuments({
    $or: [{ role: { $exists: false } }, { role: null }],
  });

  if (missing === 0) {
    return;
  }

  const oldest = await User.findOne().sort({ createdAt: 1 }).select("_id");
  if (!oldest) {
    return;
  }

  await User.updateMany(
    {
      _id: { $ne: oldest._id },
      $or: [{ role: { $exists: false } }, { role: null }],
    },
    { $set: { role: "member" satisfies UserRole } },
  );
  await User.updateOne({ _id: oldest._id }, { $set: { role: "owner" satisfies UserRole } });
}
