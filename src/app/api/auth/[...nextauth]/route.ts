import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/hash";
import { headers } from "next/headers";

const authOptions: NextAuthOptions = {
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

        return {
          id: userDoc.id,
          email: userData.email,
          role: userData.role || "user",
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
        token.preferredLocations = (user as any).preferredLocations;
        token.assignedApps = (user as any).assignedApps;
        token.assignedSite = (user as any).assignedSite;
        token.defaultLandingPage = (user as any).defaultLandingPage || "";
        token.allowedTabs = (user as any).allowedTabs || [];
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
      // 1. If it's already an absolute URL (http:// or https://), validate and return it
      try {
        const parsed = new URL(url);
        return parsed.toString();
      } catch {
        // url is relative
      }

      // 2. Derive dynamic host from request headers if available (handles mobile LAN & reverse proxy)
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

      // 3. Prepend resolved base so client-side new URL(data.url) never throws TypeError
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
