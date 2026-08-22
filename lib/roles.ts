import { User, type UserRole } from "@/lib/models/user";
import { USER_ROLE } from "@/lib/user-role";

export function isOwnerRole(role: string | null | undefined): role is typeof USER_ROLE.OWNER {
  return role === USER_ROLE.OWNER;
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
    { $set: { role: USER_ROLE.MEMBER satisfies UserRole } },
  );
  await User.updateOne({ _id: oldest._id }, { $set: { role: USER_ROLE.OWNER satisfies UserRole } });
}
