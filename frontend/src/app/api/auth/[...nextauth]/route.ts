import NextAuth, { type NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { JWT } from "next-auth/jwt";

// Extend the built-in types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    roles?: string[];
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    roles?: string[];
    error?: string;
  }
}

// Helper to extract roles from Keycloak token
function extractRolesFromToken(token: JWT): string[] {
  const roles: string[] = [];

  try {
    // Decode the access token to get roles
    if (token.accessToken) {
      const payload = JSON.parse(
        Buffer.from(token.accessToken.split(".")[1], "base64").toString()
      );

      // Extract realm roles
      if (payload.realm_access?.roles) {
        roles.push(...payload.realm_access.roles);
      }

      // Extract client roles for iabconnect-frontend
      if (payload.resource_access?.["iabconnect-frontend"]?.roles) {
        roles.push(...payload.resource_access["iabconnect-frontend"].roles);
      }
    }
  } catch (error) {
    console.error("Failed to extract roles from token:", error);
  }

  return roles;
}

// Helper to refresh the access token
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.KEYCLOAK_CLIENT_ID!,
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken!,
        }),
      }
    );

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      idToken: refreshedTokens.id_token,
      expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
      roles: extractRolesFromToken({ ...token, accessToken: refreshedTokens.access_token }),
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign in
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at,
          roles: extractRolesFromToken({ ...token, accessToken: account.access_token }),
        };
      }

      // Return previous token if not expired
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token;
      }

      // Token expired, try to refresh
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.roles = token.roles;
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
