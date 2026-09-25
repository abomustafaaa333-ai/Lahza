import { eq, sql } from "drizzle-orm";
import { drizzle, type AnyMySql2Connection } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool({
        host: new URL(process.env.DATABASE_URL).hostname,
        port: Number(new URL(process.env.DATABASE_URL).port || 3306),
        user: decodeURIComponent(new URL(process.env.DATABASE_URL).username),
        password: decodeURIComponent(new URL(process.env.DATABASE_URL).password),
        database: new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""),
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
      });
      _db = drizzle(_pool as unknown as AnyMySql2Connection);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Ensure older manually imported schemas remain compatible with the app. */
export async function ensureDatabaseCompatibility() {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(sql`ALTER TABLE order_assignments ADD COLUMN driverName VARCHAR(80) NULL`);
  } catch (error) {
    const code = (error as { cause?: { code?: string }; code?: string }).cause?.code ?? (error as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME" && code !== "ER_DUP_COLUMN") {
      console.warn("[Database] Could not ensure order_assignments.driverName:", error);
    }
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
