import {
  PrivyClient,
  isEmbeddedWalletLinkedAccount,
  type User,
} from "@privy-io/node";
import type Database from "better-sqlite3";
import type { Request } from "express";

export type AuthUser = {
  id: string;
  walletAddress: string | null;
};

let client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (client) return client;
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error(
      "PRIVY_APP_ID and PRIVY_APP_SECRET must be set in apps/host/.env",
    );
  }
  client = new PrivyClient({ appId, appSecret });
  return client;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function extractAccessToken(req: Request): string | null {
  const header = req.header("authorization")?.trim();
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  // EventSource cannot set Authorization — SSE passes token as query.
  const query = req.query.access_token;
  if (typeof query === "string" && query.trim()) return query.trim();
  return null;
}

function pickEthereumWallet(user: User): string | null {
  const accounts = user.linked_accounts ?? [];

  for (const account of accounts) {
    if (
      isEmbeddedWalletLinkedAccount(account) &&
      account.chain_type === "ethereum" &&
      account.address.startsWith("0x")
    ) {
      return account.address;
    }
  }

  for (const account of accounts) {
    if (
      "address" in account &&
      typeof account.address === "string" &&
      account.address.startsWith("0x")
    ) {
      return account.address;
    }
  }
  return null;
}

export class UserStore {
  constructor(private readonly db: Database.Database) {}

  upsert(id: string, walletAddress: string | null): AuthUser {
    const now = Date.now();
    const existing = this.db
      .prepare(`SELECT id, wallet_address FROM users WHERE id = ?`)
      .get(id) as { id: string; wallet_address: string | null } | undefined;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO users (id, wallet_address, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(id, walletAddress, now, now);
      return { id, walletAddress };
    }

    const nextWallet = walletAddress ?? existing.wallet_address;
    this.db
      .prepare(
        `UPDATE users SET wallet_address = ?, updated_at = ? WHERE id = ?`,
      )
      .run(nextWallet, now, id);
    return { id, walletAddress: nextWallet };
  }

  get(id: string): AuthUser | null {
    const row = this.db
      .prepare(`SELECT id, wallet_address FROM users WHERE id = ?`)
      .get(id) as { id: string; wallet_address: string | null } | undefined;
    if (!row) return null;
    return { id: row.id, walletAddress: row.wallet_address };
  }
}

/**
 * Verify Privy access token, upsert user + wallet, return auth context.
 */
export async function requireUser(
  req: Request,
  users: UserStore,
): Promise<AuthUser> {
  const accessToken = extractAccessToken(req);
  if (!accessToken) {
    throw new AuthError("missing access token");
  }

  const privy = getPrivyClient();
  let userId: string;
  try {
    const claims = await privy.utils().auth().verifyAccessToken(accessToken);
    userId = claims.user_id;
    if (!userId) throw new Error("token missing user id");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "invalid access token";
    throw new AuthError(message);
  }

  let walletAddress: string | null = null;
  try {
    const privyUser = await privy.users()._get(userId);
    walletAddress = pickEthereumWallet(privyUser);
  } catch (error) {
    console.warn("[auth] failed to load Privy user wallets", error);
  }

  return users.upsert(userId, walletAddress);
}
