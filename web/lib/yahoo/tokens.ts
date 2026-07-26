import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { yahooTokens } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";
import type { TokenResponse } from "./oauth";

const ROW_ID = "default";

export type StoredToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  guid: string | null;
};

export async function saveToken(tr: TokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + tr.expires_in * 1000);
  const values = {
    id: ROW_ID,
    accessTokenEnc: encrypt(tr.access_token),
    refreshTokenEnc: encrypt(tr.refresh_token),
    expiresAt,
    guid: tr.xoauth_yahoo_guid ?? null,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(yahooTokens)
    .values(values)
    .onConflictDoUpdate({
      target: yahooTokens.id,
      set: {
        accessTokenEnc: values.accessTokenEnc,
        refreshTokenEnc: values.refreshTokenEnc,
        expiresAt,
        guid: values.guid,
        updatedAt: values.updatedAt,
      },
    });
}

export async function loadToken(): Promise<StoredToken | null> {
  const rows = await getDb()
    .select()
    .from(yahooTokens)
    .where(eq(yahooTokens.id, ROW_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    accessToken: decrypt(row.accessTokenEnc),
    refreshToken: decrypt(row.refreshTokenEnc),
    expiresAt: row.expiresAt,
    guid: row.guid,
  };
}

export async function getStatus() {
  const rows = await getDb()
    .select({ expiresAt: yahooTokens.expiresAt, guid: yahooTokens.guid })
    .from(yahooTokens)
    .where(eq(yahooTokens.id, ROW_ID))
    .limit(1);
  const row = rows[0];
  if (!row) return { connected: false as const };
  return {
    connected: true as const,
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt.getTime() < Date.now(),
    guid: row.guid,
  };
}
