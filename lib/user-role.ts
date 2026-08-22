export const USER_ROLE = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const USER_ROLE_VALUES = [USER_ROLE.OWNER, USER_ROLE.MEMBER] as const;
