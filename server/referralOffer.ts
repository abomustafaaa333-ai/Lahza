import { sql } from "drizzle-orm";
import type { getDb } from "./db";
import { moveWallet } from "./wallet";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * The launch offer: the referrers with the most friends whose first order with
 * their code was completed win wallet credit. One editable offer (id 1); the
 * owner awards it once, after it ends.
 */
export type ReferralOffer = {
  enabled: boolean;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  winnersCount: number;
  minReferrals: number;
  rewardAmount: number;
  awardedAt: Date | null;
};

let schemaPromise: Promise<void> | null = null;
function ensureSchema(db: Db) {
  schemaPromise ??= (async () => {
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `referral_offer` (`id` INT NOT NULL PRIMARY KEY, `enabled` BOOLEAN NOT NULL DEFAULT FALSE, `title` VARCHAR(120) NOT NULL DEFAULT 'عرض الإطلاق', `startsAt` TIMESTAMP NULL, `endsAt` TIMESTAMP NULL, `winnersCount` INT NOT NULL DEFAULT 10, `minReferrals` INT NOT NULL DEFAULT 3, `rewardAmount` INT NOT NULL DEFAULT 0, `awardedAt` TIMESTAMP NULL) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("INSERT IGNORE INTO `referral_offer` (`id`) VALUES (1)"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `referral_offer_winners` (`phone` VARCHAR(24) NOT NULL PRIMARY KEY, `rank` INT NOT NULL, `referrals` INT NOT NULL, `amount` INT NOT NULL, `awardedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4"));
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const rowsOf = <T>(result: unknown) => { const rows = Array.isArray(result) ? result[0] : []; return (Array.isArray(rows) ? rows : []) as T[]; };

export async function getReferralOffer(db: Db): Promise<ReferralOffer> {
  await ensureSchema(db);
  const row = rowsOf<Record<string, unknown>>(await db.execute(sql.raw("SELECT * FROM `referral_offer` WHERE `id` = 1")))[0] ?? {};
  const date = (value: unknown) => value ? new Date(value as string) : null;
  return {
    enabled: Boolean(row.enabled),
    title: String(row.title ?? "عرض الإطلاق"),
    startsAt: date(row.startsAt),
    endsAt: date(row.endsAt),
    winnersCount: Number(row.winnersCount ?? 10),
    minReferrals: Number(row.minReferrals ?? 3),
    rewardAmount: Number(row.rewardAmount ?? 0),
    awardedAt: date(row.awardedAt),
  };
}

export async function updateReferralOffer(db: Db, input: Omit<ReferralOffer, "awardedAt">) {
  await ensureSchema(db);
  await db.execute(sql`UPDATE \`referral_offer\` SET \`enabled\` = ${input.enabled}, \`title\` = ${input.title}, \`startsAt\` = ${input.startsAt}, \`endsAt\` = ${input.endsAt}, \`winnersCount\` = ${input.winnersCount}, \`minReferrals\` = ${input.minReferrals}, \`rewardAmount\` = ${input.rewardAmount} WHERE \`id\` = 1`);
}

/** Friends counted for each referrer: distinct people whose order with the code was completed inside the offer dates. */
export async function referralCounts(db: Db, offer: ReferralOffer) {
  await ensureSchema(db);
  const from = offer.startsAt ?? new Date(0);
  const to = offer.endsAt ?? new Date("2999-01-01");
  return rowsOf<{ phone: string; referrals: number; lastAt: string | Date }>(await db.execute(sql`
    SELECT \`ownerPhone\` AS \`phone\`, COUNT(DISTINCT \`referredPhone\`) AS \`referrals\`, MAX(\`completedAt\`) AS \`lastAt\`
    FROM \`customer_referrals\`
    WHERE \`referredPhone\` IS NOT NULL AND \`completedAt\` IS NOT NULL AND \`completedAt\` >= ${from} AND \`completedAt\` <= ${to}
    GROUP BY \`ownerPhone\``)).map(row => ({ ...row, referrals: Number(row.referrals) }));
}

/** Ranked by friends, then by who got there first; only those who reached the minimum, and only as many as there are prizes. */
export function rankReferrers(counts: { phone: string; referrals: number; lastAt: string | Date }[], offer: Pick<ReferralOffer, "minReferrals" | "winnersCount">) {
  return counts
    .filter(row => row.referrals >= offer.minReferrals)
    .sort((a, b) => b.referrals - a.referrals || new Date(a.lastAt).getTime() - new Date(b.lastAt).getTime())
    .slice(0, offer.winnersCount)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function listWinners(db: Db) {
  await ensureSchema(db);
  return rowsOf<{ phone: string; rank: number; referrals: number; amount: number; awardedAt: string | Date }>(await db.execute(sql.raw("SELECT * FROM `referral_offer_winners` ORDER BY `rank`")));
}

/** Credits each winner once. The offer is marked awarded first, so a second press cannot pay twice. */
export async function awardReferralOffer(db: Db, awardedBy: string) {
  const offer = await getReferralOffer(db);
  if (offer.awardedAt) throw new Error("وُزّعت جوائز هذا العرض من قبل");
  if (offer.rewardAmount <= 0) throw new Error("حدّد قيمة الجائزة أولاً");
  const winners = rankReferrers(await referralCounts(db, offer), offer);
  if (!winners.length) throw new Error("لا يوجد من حقق شرط العرض بعد");
  const claimed = await db.execute(sql.raw("UPDATE `referral_offer` SET `awardedAt` = NOW() WHERE `id` = 1 AND `awardedAt` IS NULL"));
  const header = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0)) throw new Error("وُزّعت جوائز هذا العرض من قبل");
  await db.execute(sql.raw("DELETE FROM `referral_offer_winners`"));
  for (const winner of winners) {
    await db.execute(sql`INSERT INTO \`referral_offer_winners\` (\`phone\`, \`rank\`, \`referrals\`, \`amount\`) VALUES (${winner.phone}, ${winner.rank}, ${winner.referrals}, ${offer.rewardAmount})`);
    await moveWallet(db, winner.phone, offer.rewardAmount, "reward", { note: `جائزة ${offer.title} · المركز ${winner.rank}`, createdBy: awardedBy });
  }
  return { offer, winners };
}

/** Starting the offer again (new dates or rules) clears the previous award so it can be paid once more. */
export async function resetReferralOfferAward(db: Db) {
  await ensureSchema(db);
  await db.execute(sql.raw("UPDATE `referral_offer` SET `awardedAt` = NULL WHERE `id` = 1"));
  await db.execute(sql.raw("DELETE FROM `referral_offer_winners`"));
}
