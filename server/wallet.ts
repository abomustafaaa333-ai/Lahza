import { sql } from "drizzle-orm";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type WalletKind = "topup" | "order_payment" | "refund" | "adjustment" | "reward";

let walletSchemaPromise: Promise<void> | null = null;

/** The wallet keeps one balance row per customer (the source of truth) and a ledger of every movement. */
export function ensureWalletSchema(db: Db) {
  walletSchemaPromise ??= (async () => {
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `customer_wallets` (`phone` VARCHAR(24) NOT NULL PRIMARY KEY, `balance` INT NOT NULL DEFAULT 0, `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `wallet_transactions` (`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY, `customerPhone` VARCHAR(24) NOT NULL, `amount` INT NOT NULL, `kind` ENUM('topup','order_payment','refund','adjustment','reward') NOT NULL, `orderId` INT NULL, `topupId` INT NULL, `note` VARCHAR(300) NULL, `createdBy` VARCHAR(80) NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY `wallet_transactions_phone` (`customerPhone`), KEY `wallet_transactions_order` (`orderId`)) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("ALTER TABLE `wallet_transactions` MODIFY `kind` ENUM('topup','order_payment','refund','adjustment','reward') NOT NULL"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `wallet_topups` (`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY, `customerPhone` VARCHAR(24) NOT NULL, `amount` INT NOT NULL, `method` ENUM('sham_cash','office_cash') NOT NULL, `reference` VARCHAR(120) NULL, `proofImageUrl` VARCHAR(500) NULL, `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', `reviewNote` VARCHAR(300) NULL, `reviewedBy` VARCHAR(80) NULL, `reviewedAt` TIMESTAMP NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY `wallet_topups_phone` (`customerPhone`), KEY `wallet_topups_status` (`status`)) DEFAULT CHARSET=utf8mb4"));
  })().catch(error => { walletSchemaPromise = null; throw error; });
  return walletSchemaPromise;
}

function firstRow<T>(result: unknown): T | undefined {
  const rows = Array.isArray(result) ? result[0] : undefined;
  return Array.isArray(rows) ? rows[0] as T | undefined : undefined;
}

function affected(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export async function walletBalance(db: Db, phone: string) {
  await ensureWalletSchema(db);
  const row = firstRow<{ balance: number }>(await db.execute(sql`SELECT \`balance\` FROM \`customer_wallets\` WHERE \`phone\` = ${phone} LIMIT 1`));
  return Number(row?.balance ?? 0);
}

/** Adds (or, with a negative amount, removes) money and records why. A removal never takes the balance below zero. */
export async function moveWallet(db: Db, phone: string, amount: number, kind: WalletKind, details: { orderId?: number; topupId?: number; note?: string; createdBy?: string } = {}) {
  await ensureWalletSchema(db);
  if (!Number.isInteger(amount) || amount === 0) throw new Error("مبلغ غير صالح");
  if (amount > 0) {
    await db.execute(sql`INSERT INTO \`customer_wallets\` (\`phone\`, \`balance\`) VALUES (${phone}, ${amount}) ON DUPLICATE KEY UPDATE \`balance\` = \`balance\` + ${amount}`);
  } else {
    const done = await db.execute(sql`UPDATE \`customer_wallets\` SET \`balance\` = \`balance\` + ${amount} WHERE \`phone\` = ${phone} AND \`balance\` >= ${-amount}`);
    if (!affected(done)) throw new Error("الرصيد غير كافٍ");
  }
  await db.execute(sql`INSERT INTO \`wallet_transactions\` (\`customerPhone\`, \`amount\`, \`kind\`, \`orderId\`, \`topupId\`, \`note\`, \`createdBy\`) VALUES (${phone}, ${amount}, ${kind}, ${details.orderId ?? null}, ${details.topupId ?? null}, ${details.note ?? null}, ${details.createdBy ?? null})`);
}

/** Takes as much of `wanted` as the balance covers (all of it, or part) and returns what was taken. */
export async function payFromWallet(db: Db, phone: string, wanted: number, orderId: number) {
  if (wanted <= 0) return 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const take = Math.min(await walletBalance(db, phone), wanted);
    if (take <= 0) return 0;
    try {
      await moveWallet(db, phone, -take, "order_payment", { orderId, note: `دفع الطلب #${orderId}` });
      return take;
    } catch {
      // Another order spent part of the balance between the read and the update; read it again.
    }
  }
  return 0;
}

/** What an order currently holds from the wallet: payments minus refunds. */
async function heldForOrder(db: Db, orderId: number) {
  const row = firstRow<{ held: number | null }>(await db.execute(sql`SELECT -SUM(\`amount\`) AS \`held\` FROM \`wallet_transactions\` WHERE \`orderId\` = ${orderId} AND \`kind\` IN ('order_payment','refund')`));
  return Number(row?.held ?? 0);
}

/** Gives back what a cancelled or rejected order took from the wallet. Safe to call more than once. */
export async function refundOrderWallet(db: Db, order: { id: number; customerPhone: string }) {
  await ensureWalletSchema(db);
  const held = await heldForOrder(db, order.id);
  if (held > 0) await moveWallet(db, order.customerPhone, held, "refund", { orderId: order.id, note: `استرجاع الطلب #${order.id}` });
  return held;
}

/** When a cancelled order is reopened, charge the wallet again; whatever the balance cannot cover is collected on delivery. */
export async function rechargeReopenedOrder(db: Db, order: { id: number; customerPhone: string; walletAmount: number }) {
  await ensureWalletSchema(db);
  if (order.walletAmount <= 0) return order.walletAmount;
  const held = await heldForOrder(db, order.id);
  if (held >= order.walletAmount) return order.walletAmount;
  const taken = await payFromWallet(db, order.customerPhone, order.walletAmount - held, order.id);
  return held + taken;
}

export type WalletTopupRow = { id: number; customerPhone: string; amount: number; method: "sham_cash" | "office_cash"; reference: string | null; proofImageUrl: string | null; status: "pending" | "approved" | "rejected"; reviewNote: string | null; reviewedBy: string | null; reviewedAt: Date | string | null; createdAt: Date | string };

export async function listTopups(db: Db, filter: { phone?: string; status?: "pending" | "approved" | "rejected"; limit?: number }) {
  await ensureWalletSchema(db);
  const where = [filter.phone ? sql`\`customerPhone\` = ${filter.phone}` : null, filter.status ? sql`\`status\` = ${filter.status}` : null].filter(Boolean);
  const condition = where.length ? sql`WHERE ${sql.join(where as ReturnType<typeof sql>[], sql` AND `)}` : sql``;
  const [rows] = await db.execute(sql`SELECT * FROM \`wallet_topups\` ${condition} ORDER BY \`id\` DESC LIMIT ${filter.limit ?? 100}`);
  return (Array.isArray(rows) ? rows : []) as WalletTopupRow[];
}

export async function listTransactions(db: Db, phone: string, limit = 50) {
  await ensureWalletSchema(db);
  const [rows] = await db.execute(sql`SELECT \`id\`, \`amount\`, \`kind\`, \`orderId\`, \`note\`, \`createdAt\` FROM \`wallet_transactions\` WHERE \`customerPhone\` = ${phone} ORDER BY \`id\` DESC LIMIT ${limit}`);
  return (Array.isArray(rows) ? rows : []) as { id: number; amount: number; kind: WalletKind; orderId: number | null; note: string | null; createdAt: Date | string }[];
}

export async function createTopup(db: Db, input: { phone: string; amount: number; method: "sham_cash" | "office_cash"; reference?: string; proofImageUrl?: string }) {
  await ensureWalletSchema(db);
  const pending = firstRow<{ count: number }>(await db.execute(sql`SELECT COUNT(*) AS \`count\` FROM \`wallet_topups\` WHERE \`customerPhone\` = ${input.phone} AND \`status\` = 'pending'`));
  if (Number(pending?.count ?? 0) >= 3) throw new Error("لديك 3 طلبات شحن بانتظار المراجعة، انتظر حتى تُراجع");
  const result = await db.execute(sql`INSERT INTO \`wallet_topups\` (\`customerPhone\`, \`amount\`, \`method\`, \`reference\`, \`proofImageUrl\`) VALUES (${input.phone}, ${input.amount}, ${input.method}, ${input.reference ?? null}, ${input.proofImageUrl ?? null})`);
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number } | undefined)?.insertId ?? 0);
}

/** Approving credits the wallet exactly once; a reviewed request cannot be reviewed again. */
export async function reviewTopup(db: Db, id: number, decision: "approved" | "rejected", reviewer: string, note?: string, amount?: number) {
  await ensureWalletSchema(db);
  const topup = firstRow<WalletTopupRow>(await db.execute(sql`SELECT * FROM \`wallet_topups\` WHERE \`id\` = ${id} LIMIT 1`));
  if (!topup) throw new Error("طلب الشحن غير موجود");
  const finalAmount = decision === "approved" ? amount ?? topup.amount : topup.amount;
  const claimed = await db.execute(sql`UPDATE \`wallet_topups\` SET \`status\` = ${decision}, \`amount\` = ${finalAmount}, \`reviewNote\` = ${note ?? null}, \`reviewedBy\` = ${reviewer}, \`reviewedAt\` = NOW() WHERE \`id\` = ${id} AND \`status\` = 'pending'`);
  if (!affected(claimed)) throw new Error("تمت مراجعة هذا الطلب من قبل");
  if (decision === "approved") await moveWallet(db, topup.customerPhone, finalAmount, "topup", { topupId: id, note: topup.method === "sham_cash" ? "شحن عبر شام كاش" : "شحن نقدي في المكتب", createdBy: reviewer });
  return { ...topup, status: decision, amount: finalAmount };
}

export async function walletBalances(db: Db, limit = 200) {
  await ensureWalletSchema(db);
  const [rows] = await db.execute(sql`SELECT \`phone\`, \`balance\`, \`updatedAt\` FROM \`customer_wallets\` WHERE \`balance\` <> 0 ORDER BY \`updatedAt\` DESC LIMIT ${limit}`);
  return (Array.isArray(rows) ? rows : []) as { phone: string; balance: number; updatedAt: Date | string }[];
}

/** A customer who changes number keeps their balance and history. */
export async function moveWalletToPhone(db: Db, from: string, to: string) {
  await ensureWalletSchema(db);
  const balance = await walletBalance(db, from);
  if (balance) {
    await db.execute(sql`INSERT INTO \`customer_wallets\` (\`phone\`, \`balance\`) VALUES (${to}, ${balance}) ON DUPLICATE KEY UPDATE \`balance\` = \`balance\` + ${balance}`);
  }
  await db.execute(sql`DELETE FROM \`customer_wallets\` WHERE \`phone\` = ${from}`);
  await db.execute(sql`UPDATE \`wallet_transactions\` SET \`customerPhone\` = ${to} WHERE \`customerPhone\` = ${from}`);
  await db.execute(sql`UPDATE \`wallet_topups\` SET \`customerPhone\` = ${to} WHERE \`customerPhone\` = ${from}`);
}
