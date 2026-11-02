import { sql } from "drizzle-orm";
import type { getDb } from "./db";
import { moveWallet } from "./wallet";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * The Lahza contest: within its dates, the first customers to complete enough
 * orders of their own and to have enough friends complete an order with their
 * referral code win. One editable contest (id 1); the owner confirms winners once.
 */
export type ReferralOffer = {
  enabled: boolean;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  winnersCount: number;
  minPersonalOrders: number;
  minReferrals: number;
  prizeText: string;
  rewardAmount: number;
  awardedAt: Date | null;
};

let schemaPromise: Promise<void> | null = null;
function ensureSchema(db: Db) {
  schemaPromise ??= (async () => {
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `referral_offer` (`id` INT NOT NULL PRIMARY KEY, `enabled` BOOLEAN NOT NULL DEFAULT FALSE, `title` VARCHAR(120) NOT NULL DEFAULT 'مسابقة لحظة', `startsAt` TIMESTAMP NULL, `endsAt` TIMESTAMP NULL, `winnersCount` INT NOT NULL DEFAULT 5, `minReferrals` INT NOT NULL DEFAULT 3, `rewardAmount` INT NOT NULL DEFAULT 0, `awardedAt` TIMESTAMP NULL) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("ALTER TABLE `referral_offer` ADD COLUMN IF NOT EXISTS `minPersonalOrders` INT NOT NULL DEFAULT 10"));
    await db.execute(sql.raw("ALTER TABLE `referral_offer` ADD COLUMN IF NOT EXISTS `prizeText` VARCHAR(1000) NOT NULL DEFAULT ''"));
    await db.execute(sql.raw("INSERT IGNORE INTO `referral_offer` (`id`, `winnersCount`) VALUES (1, 5)"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `referral_offer_winners` (`phone` VARCHAR(24) NOT NULL PRIMARY KEY, `rank` INT NOT NULL, `referrals` INT NOT NULL, `amount` INT NOT NULL, `awardedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("ALTER TABLE `referral_offer_winners` ADD COLUMN IF NOT EXISTS `personalOrders` INT NOT NULL DEFAULT 0"));
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
    title: String(row.title ?? "مسابقة لحظة"),
    startsAt: date(row.startsAt),
    endsAt: date(row.endsAt),
    winnersCount: Number(row.winnersCount ?? 5),
    minPersonalOrders: Number(row.minPersonalOrders ?? 10),
    minReferrals: Number(row.minReferrals ?? 3),
    prizeText: String(row.prizeText ?? ""),
    rewardAmount: Number(row.rewardAmount ?? 0),
    awardedAt: date(row.awardedAt),
  };
}

export async function updateReferralOffer(db: Db, input: Omit<ReferralOffer, "awardedAt">) {
  await ensureSchema(db);
  await db.execute(sql`UPDATE \`referral_offer\` SET \`enabled\` = ${input.enabled}, \`title\` = ${input.title}, \`startsAt\` = ${input.startsAt}, \`endsAt\` = ${input.endsAt}, \`winnersCount\` = ${input.winnersCount}, \`minPersonalOrders\` = ${input.minPersonalOrders}, \`minReferrals\` = ${input.minReferrals}, \`prizeText\` = ${input.prizeText}, \`rewardAmount\` = ${input.rewardAmount} WHERE \`id\` = 1`);
}

export type Participant = { phone: string; personalOrders: number; referrals: number; qualifiedAt: Date | null };

/**
 * Everyone with activity in the contest dates: completed orders of their own, and distinct
 * friends whose order with their code was completed. A participant qualifies at the moment
 * the later of the two targets is reached.
 */
export async function contestParticipants(db: Db, offer: ReferralOffer): Promise<Participant[]> {
  await ensureSchema(db);
  const from = offer.startsAt ?? new Date(0);
  const to = offer.endsAt ?? new Date("2999-01-01");
  const personal = rowsOf<{ phone: string; at: string | Date }>(await db.execute(sql`SELECT \`customerPhone\` AS \`phone\`, \`statusChangedAt\` AS \`at\` FROM \`orders\` WHERE \`status\` = 'completed' AND \`statusChangedAt\` >= ${from} AND \`statusChangedAt\` <= ${to}`));
  const friends = rowsOf<{ phone: string; at: string | Date }>(await db.execute(sql`SELECT \`ownerPhone\` AS \`phone\`, MIN(\`completedAt\`) AS \`at\` FROM \`customer_referrals\` WHERE \`referredPhone\` IS NOT NULL AND \`completedAt\` IS NOT NULL AND \`completedAt\` >= ${from} AND \`completedAt\` <= ${to} GROUP BY \`ownerPhone\`, \`referredPhone\``));
  const times = new Map<string, { personal: number[]; friends: number[] }>();
  const slot = (phone: string) => { let entry = times.get(phone); if (!entry) { entry = { personal: [], friends: [] }; times.set(phone, entry); } return entry; };
  for (const row of personal) slot(row.phone).personal.push(new Date(row.at).getTime());
  for (const row of friends) slot(row.phone).friends.push(new Date(row.at).getTime());
  return Array.from(times, ([phone, entry]) => {
    entry.personal.sort((a, b) => a - b);
    entry.friends.sort((a, b) => a - b);
    const personalDone = entry.personal[offer.minPersonalOrders - 1];
    const friendsDone = entry.friends[offer.minReferrals - 1];
    return { phone, personalOrders: entry.personal.length, referrals: entry.friends.length, qualifiedAt: personalDone !== undefined && friendsDone !== undefined ? new Date(Math.max(personalDone, friendsDone)) : null };
  });
}

/** The first to qualify win, up to the number of prizes. */
export function rankParticipants(participants: Participant[], offer: Pick<ReferralOffer, "winnersCount">) {
  return participants
    .filter((row): row is Participant & { qualifiedAt: Date } => row.qualifiedAt !== null)
    .sort((a, b) => a.qualifiedAt.getTime() - b.qualifiedAt.getTime())
    .slice(0, offer.winnersCount)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function listWinners(db: Db) {
  await ensureSchema(db);
  return rowsOf<{ phone: string; rank: number; referrals: number; personalOrders: number; amount: number; awardedAt: string | Date }>(await db.execute(sql.raw("SELECT * FROM `referral_offer_winners` ORDER BY `rank`")));
}

/** Records the winners once, adding the optional balance prize. The contest is marked first, so a second press cannot pay twice. */
export async function awardReferralOffer(db: Db, awardedBy: string) {
  const offer = await getReferralOffer(db);
  if (offer.awardedAt) throw new Error("اعتُمد الفائزون في هذه المسابقة من قبل");
  const winners = rankParticipants(await contestParticipants(db, offer), offer);
  if (!winners.length) throw new Error("لم يحقق أحد شروط المسابقة بعد");
  const claimed = await db.execute(sql.raw("UPDATE `referral_offer` SET `awardedAt` = NOW() WHERE `id` = 1 AND `awardedAt` IS NULL"));
  const header = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0)) throw new Error("اعتُمد الفائزون في هذه المسابقة من قبل");
  await db.execute(sql.raw("DELETE FROM `referral_offer_winners`"));
  for (const winner of winners) {
    await db.execute(sql`INSERT INTO \`referral_offer_winners\` (\`phone\`, \`rank\`, \`referrals\`, \`personalOrders\`, \`amount\`) VALUES (${winner.phone}, ${winner.rank}, ${winner.referrals}, ${winner.personalOrders}, ${offer.rewardAmount})`);
    if (offer.rewardAmount > 0) await moveWallet(db, winner.phone, offer.rewardAmount, "reward", { note: `جائزة ${offer.title} · المركز ${winner.rank}`, createdBy: awardedBy });
  }
  return { offer, winners };
}

/** Starting the contest again clears the previous winners so it can be confirmed once more. Prizes already paid stay paid. */
export async function resetReferralOfferAward(db: Db) {
  await ensureSchema(db);
  await db.execute(sql.raw("UPDATE `referral_offer` SET `awardedAt` = NULL WHERE `id` = 1"));
  await db.execute(sql.raw("DELETE FROM `referral_offer_winners`"));
}
