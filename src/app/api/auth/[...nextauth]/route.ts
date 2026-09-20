import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/hash";

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

        return {
          id: userDoc.id,
          email: userData.email,
          role: userData.role || "user",
          preferredLocations: userData.preferredLocations || [],
          assignedApps: userData.assignedApps || [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.preferredLocations = (user as any).preferredLocations;
        token.assignedApps = (user as any).assignedApps;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          preferredLocations: token.preferredLocations as string[],
          assignedApps: token.assignedApps as string[],
        } as any;
      }
      return session;
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
