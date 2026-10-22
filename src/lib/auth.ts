import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/hash";
import { headers } from "next/headers";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const email = credentials.email.toLowerCase().trim();
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("Invalid credentials");
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Hash the incoming password to compare with the stored hash
        const inputHash = hashPassword(credentials.password);

        if (userData.password !== inputHash) {
          throw new Error("Invalid credentials");
        }

        // Security check: block suspended users from logging in
        if (userData.status === 'suspended') {
          throw new Error("Account is suspended. Please contact administrator.");
        }

        // Security check: block expired guest / temporary users
        if (userData.expiresAt && new Date(userData.expiresAt).getTime() <= Date.now()) {
          throw new Error("Guest access has expired. Please contact administrator to renew access.");
        }

        const tokenVersion = typeof userData.tokenVersion === 'number' ? userData.tokenVersion : 1;

        return {
          id: userDoc.id,
          email: userData.email,
          role: userData.role || "user",
          status: userData.status || "active",
          tokenVersion: tokenVersion,
          expiresAt: userData.expiresAt || null,
          canDelete: userData.canDelete ?? (userData.allowedTabs?.includes('can_delete') || false),
          preferredLocations: userData.preferredLocations || [],
          assignedApps: userData.assignedApps || [],
          assignedSite: userData.assignedSite || (userData.role === "admin" ? undefined : "newrelic"),
          defaultLandingPage: userData.defaultLandingPage || "",
          allowedTabs: userData.allowedTabs || [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as any).role;
        token.status = (user as any).status || "active";
        token.tokenVersion = (user as any).tokenVersion || 1;
        token.expiresAt = (user as any).expiresAt || null;
        token.canDelete = (user as any).canDelete || false;
        token.preferredLocations = (user as any).preferredLocations;
        token.assignedApps = (user as any).assignedApps;
        token.assignedSite = (user as any).assignedSite;
        token.defaultLandingPage = (user as any).defaultLandingPage || "";
        token.allowedTabs = (user as any).allowedTabs || [];
      } else if (token?.email) {
        try {
          const email = (token.email as string).toLowerCase().trim();
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const currentTokenVersion = typeof userData.tokenVersion === 'number' ? userData.tokenVersion : 1;
            const sessionTokenVersion = typeof token.tokenVersion === 'number' ? token.tokenVersion : 1;

            token.id = userDoc.id;
            token.role = userData.role || token.role || "user";
            token.status = userData.status || "active";
            token.expiresAt = userData.expiresAt || null;
            token.canDelete = userData.canDelete ?? (userData.allowedTabs?.includes('can_delete') || false);
            token.preferredLocations = userData.preferredLocations || [];
            token.assignedApps = userData.assignedApps || [];
            token.assignedSite = userData.assignedSite || (userData.role === "admin" ? undefined : "newrelic");
            token.defaultLandingPage = userData.defaultLandingPage || "";
            token.allowedTabs = userData.allowedTabs || [];

            // Invalidate if account is suspended, sessions were revoked by admin, or access has expired
            const isExpired = userData.expiresAt && new Date(userData.expiresAt).getTime() <= Date.now();
            if (userData.status === 'suspended' || currentTokenVersion > sessionTokenVersion || isExpired) {
              token.isRevoked = true;
              if (isExpired) {
                token.isExpired = true;
              }
            }
          }
        } catch (err) {
          console.warn("Failed to refresh user token from Firestore:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          email: token.email as string,
          role: token.role as string,
          status: (token.status as string) || "active",
          isRevoked: (token.isRevoked as boolean) || false,
          isExpired: (token.isExpired as boolean) || false,
          tokenVersion: (token.tokenVersion as number) || 1,
          expiresAt: (token.expiresAt as string | null) || null,
          canDelete: (token.canDelete as boolean) || false,
          preferredLocations: token.preferredLocations as string[],
          assignedApps: token.assignedApps as string[],
          assignedSite: token.assignedSite as string | undefined,
          defaultLandingPage: (token.defaultLandingPage as string) || "",
          allowedTabs: (token.allowedTabs as string[]) || [],
        } as any;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url);
        return parsed.toString();
      } catch {
        // url is relative
      }

      let resolvedBase = baseUrl;
      try {
        const reqHeaders = await headers();
        const host = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
        const proto = reqHeaders.get("x-forwarded-proto") || "http";
        if (host) {
          resolvedBase = `${proto}://${host}`;
        }
      } catch {
        // fallback to baseUrl
      }

      if (url && url.startsWith("/")) {
        return `${resolvedBase}${url}`;
      }
      return resolvedBase;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
};
