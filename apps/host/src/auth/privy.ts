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
  /** Privy wallet id for Wallet API sendTransaction (embedded wallets). */
  walletId: string | null;
};

let client: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
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

/** Privy access token from Authorization header or SSE query. */
export function extractAccessToken(req: Request): string | null {
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

/**
 * Privy identity token for Wallet API user signing (`user_jwts`).
 * Access tokens are invalid for this slot — use `privy-id-token` header.
 */
export function extractIdentityToken(req: Request): string | null {
  const header = req.header("privy-id-token")?.trim();
  if (header) return header;
  const cookie = req.header("cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)privy-id-token=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export type PickedWallet = {
  address: string;
  walletId: string | null;
};

function pickEthereumWallet(user: User): PickedWallet | null {
  const accounts = user.linked_accounts ?? [];

  for (const account of accounts) {
    if (
      isEmbeddedWalletLinkedAccount(account) &&
      account.chain_type === "ethereum" &&
      account.address.startsWith("0x")
    ) {
      const walletId =
        typeof account.id === "string" && account.id.trim()
          ? account.id.trim()
          : null;
      return { address: account.address, walletId };
    }
  }

  for (const account of accounts) {
    if (
      "address" in account &&
      typeof account.address === "string" &&
      account.address.startsWith("0x")
    ) {
      const id =
        "id" in account && typeof account.id === "string" && account.id.trim()
          ? account.id.trim()
          : null;
      return { address: account.address, walletId: id };
    }
  }
  return null;
}

export class UserStore {
  constructor(private readonly db: Database.Database) {}

  upsert(
    id: string,
    walletAddress: string | null,
    walletId: string | null = null,
  ): AuthUser {
    const now = Date.now();
    const existing = this.db
      .prepare(`SELECT id, wallet_address, wallet_id FROM users WHERE id = ?`)
      .get(id) as
      | { id: string; wallet_address: string | null; wallet_id: string | null }
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO users (id, wallet_address, wallet_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, walletAddress, walletId, now, now);
      return { id, walletAddress, walletId };
    }

    const nextWallet = walletAddress ?? existing.wallet_address;
    const nextWalletId = walletId ?? existing.wallet_id;
    this.db
      .prepare(
        `UPDATE users SET wallet_address = ?, wallet_id = ?, updated_at = ? WHERE id = ?`,
      )
      .run(nextWallet, nextWalletId, now, id);
    return { id, walletAddress: nextWallet, walletId: nextWalletId };
  }

  get(id: string): AuthUser | null {
    const row = this.db
      .prepare(`SELECT id, wallet_address, wallet_id FROM users WHERE id = ?`)
      .get(id) as
      | { id: string; wallet_address: string | null; wallet_id: string | null }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      walletId: row.wallet_id ?? null,
    };
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
  let walletId: string | null = null;
  try {
    const privyUser = await privy.users()._get(userId);
    const picked = pickEthereumWallet(privyUser);
    walletAddress = picked?.address ?? null;
    walletId = picked?.walletId ?? null;
  } catch (error) {
    console.warn("[auth] failed to load Privy user wallets", error);
  }

  return users.upsert(userId, walletAddress, walletId);
}
