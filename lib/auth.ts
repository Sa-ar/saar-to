import { compare } from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import "@/lib/env";
import { connectDB } from "@/lib/db";
import { User, type UserRole } from "@/lib/models/user";
import { isOwnerRole } from "@/lib/roles";
import { loginSchema } from "@/lib/validations/auth";
import { USER_ROLE } from "@/lib/user-role";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        await connectDB();
        const user = await User.findOne({ email: parsed.data.email });
        if (!user) {
          return null;
        }

        const passwordMatches = await compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        const role: UserRole = user.role === USER_ROLE.OWNER ? USER_ROLE.OWNER : USER_ROLE.MEMBER;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role ?? USER_ROLE.MEMBER;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role === USER_ROLE.OWNER ? USER_ROLE.OWNER : USER_ROLE.MEMBER;
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireUserId() {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

export async function requireOwner() {
  const session = await getSession();
  if (!session?.user?.id || !isOwnerRole(session.user.role)) {
    return null;
  }
  return session.user.id;
}
