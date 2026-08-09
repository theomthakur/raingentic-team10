import type {
  BudgetRecord,
  Decision,
  IssuedCardRecord,
  QuoteRecord,
  RuleSet,
} from "@/lib/types";
import { defaultRuleSet } from "@/lib/rules/defaults";
import { SEED_BUDGETS, SEED_QUOTES } from "@/lib/fixtures/records";
import seededDecisions from "@/lib/seed/decisions.json";
import type { Store } from "./types";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

let sqlPromise: Promise<Sql> | null = null;

async function getSql(): Promise<Sql> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      // Imported lazily so a local run with no DATABASE_URL never loads the driver.
      const { neon, neonConfig } = await import("@neondatabase/serverless");

      // 🔴 The driver talks to Neon over HTTP, and Next.js patches global fetch with its
      // own cache. Without this, the first `select * from decisions` is memoised and
      // replayed for every later read: the write lands in Postgres, the query returns
      // stale rows, and the console shows a decision count that never moves. It fails
      // exactly where it hurts: the append-only log and the replay both read through
      // here: and it fails silently, with no error in any log.
      neonConfig.fetchFunction = (input: unknown, init: unknown) =>
        fetch(input as RequestInfo, { ...(init as RequestInit), cache: "no-store" });

      const sql = neon(process.env.DATABASE_URL as string) as unknown as Sql;
      await migrate(sql);
      return sql;
    })();
  }
  return sqlPromise;
}

async function migrate(sql: Sql): Promise<void> {
  await sql`
    create table if not exists rule_sets (
      version        integer primary key,
      created_at     timestamptz not null,
      note           text not null,
      rules          jsonb not null,
      hash           text not null,
      anchor_tx_hash text,
      status         text not null default 'active',
      proposed_by    text not null default 'system',
      approved_by    text,
      approved_at    timestamptz
    )`;
  await sql`
    create table if not exists decisions (
      id           text primary key,
      created_at   timestamptz not null,
      agent        text not null,
      po           jsonb not null,
      record       jsonb not null,
      rule_version integer not null,
      checks       jsonb not null,
      outcome      text not null,
      card         jsonb,
      seeded       boolean not null default false
    )`;
  await sql`create table if not exists quotes  (po_number   text primary key, data jsonb not null)`;
  await sql`create table if not exists budgets (cost_centre text primary key, data jsonb not null)`;
  // Keyed by the order line, so a double-issue is impossible even under a concurrent
  // retry. Rule 6 is the legible version of this; the primary key is the real one.
  await sql`create table if not exists issued_cards (po_number text primary key, data jsonb not null)`;
  // The claim is what makes idempotency hold across processes, not just within one.
  // The primary key does the work: two concurrent inserts, exactly one wins.
  await sql`create table if not exists line_claims (
              po_number  text primary key,
              claimed_at timestamptz not null default now()
            )`;

  const [{ n }] = (await sql`select count(*)::int as n from rule_sets`) as { n: number }[];
  if (n === 0) await seedAll(sql);
}

async function seedAll(sql: Sql): Promise<void> {
  const rs = defaultRuleSet();
  await sql`
    insert into rule_sets (version, created_at, note, rules, hash, status, proposed_by, approved_by, approved_at)
    values (${rs.version}, ${rs.createdAt}, ${rs.note}, ${JSON.stringify(rs.rules)}, ${rs.hash},
            ${rs.status}, ${rs.proposedBy}, ${rs.approvedBy ?? null}, ${rs.approvedAt ?? null})
    on conflict (version) do nothing`;

  for (const q of SEED_QUOTES) {
    await sql`insert into quotes (po_number, data) values (${q.poNumber}, ${JSON.stringify(q)})
              on conflict (po_number) do update set data = excluded.data`;
  }
  for (const b of SEED_BUDGETS) {
    await sql`insert into budgets (cost_centre, data) values (${b.costCentre}, ${JSON.stringify(b)})
              on conflict (cost_centre) do update set data = excluded.data`;
  }
  for (const d of seededDecisions as unknown as Decision[]) {
    await sql`
      insert into decisions (id, created_at, agent, po, record, rule_version, checks, outcome, card, seeded)
      values (${d.id}, ${d.createdAt}, ${d.agent}, ${JSON.stringify(d.po)}, ${JSON.stringify(d.record)},
              ${d.ruleVersion}, ${JSON.stringify(d.checks)}, ${d.outcome},
              ${d.card ? JSON.stringify(d.card) : null}, true)
      on conflict (id) do nothing`;
  }
}

function toRuleSet(r: Record<string, unknown>): RuleSet {
  return {
    version: r.version as number,
    createdAt: new Date(r.created_at as string).toISOString(),
    note: r.note as string,
    rules: r.rules as RuleSet["rules"],
    hash: r.hash as string,
    anchorTxHash: (r.anchor_tx_hash as string) ?? undefined,
    status: (r.status as RuleSet["status"]) ?? "active",
    proposedBy: (r.proposed_by as string) ?? "system",
    approvedBy: (r.approved_by as string) ?? undefined,
    approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : undefined,
  };
}

function toDecision(r: Record<string, unknown>): Decision {
  return {
    id: r.id as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    agent: r.agent as string,
    po: r.po as Decision["po"],
    record: r.record as Decision["record"],
    ruleVersion: r.rule_version as number,
    checks: r.checks as Decision["checks"],
    outcome: r.outcome as Decision["outcome"],
    card: (r.card as Decision["card"]) ?? null,
    seeded: r.seeded as boolean,
  };
}

export function createPostgresStore(): Store {
  return {
    kind: "postgres",

    async listRuleSets() {
      const sql = await getSql();
      const rows = await sql`select * from rule_sets order by version asc`;
      return rows.map(toRuleSet);
    },
    async getRuleSet(version) {
      const sql = await getSql();
      const rows = await sql`select * from rule_sets where version = ${version}`;
      return rows[0] ? toRuleSet(rows[0]) : null;
    },
    async latestRuleSet() {
      const sql = await getSql();
      // Active only. A pending version decides nothing until a second person activates it.
      const rows = await sql`
        select * from rule_sets where status = 'active' order by version desc limit 1`;
      return toRuleSet(rows[0]);
    },
    async appendRuleSet(ruleSet) {
      const sql = await getSql();
      await sql`
        insert into rule_sets (version, created_at, note, rules, hash, status, proposed_by)
        values (${ruleSet.version}, ${ruleSet.createdAt}, ${ruleSet.note},
                ${JSON.stringify(ruleSet.rules)}, ${ruleSet.hash},
                ${ruleSet.status}, ${ruleSet.proposedBy})`;
      return ruleSet;
    },
    async activateRuleSet(ruleSet) {
      const sql = await getSql();
      await sql`
        update rule_sets
        set status = 'active', approved_by = ${ruleSet.approvedBy ?? null},
            approved_at = ${ruleSet.approvedAt ?? null}
        where version = ${ruleSet.version}`;
    },
    async setAnchor(version, txHash) {
      const sql = await getSql();
      await sql`update rule_sets set anchor_tx_hash = ${txHash} where version = ${version}`;
    },

    async listDecisions() {
      const sql = await getSql();
      const rows = await sql`select * from decisions order by created_at desc`;
      return rows.map(toDecision);
    },
    async appendDecision(decision) {
      const sql = await getSql();
      await sql`
        insert into decisions (id, created_at, agent, po, record, rule_version, checks, outcome, card, seeded)
        values (${decision.id}, ${decision.createdAt}, ${decision.agent},
                ${JSON.stringify(decision.po)}, ${JSON.stringify(decision.record)},
                ${decision.ruleVersion}, ${JSON.stringify(decision.checks)}, ${decision.outcome},
                ${decision.card ? JSON.stringify(decision.card) : null}, ${decision.seeded ?? false})`;
      return decision;
    },

    async getQuote(poNumber) {
      const sql = await getSql();
      const rows = await sql`select data from quotes where po_number = ${poNumber}`;
      return rows[0] ? (rows[0].data as QuoteRecord) : null;
    },
    async getBudget(costCentre) {
      const sql = await getSql();
      const rows = await sql`select data from budgets where cost_centre = ${costCentre}`;
      return rows[0] ? (rows[0].data as BudgetRecord) : null;
    },
    async getCardForPO(poNumber) {
      const sql = await getSql();
      const rows = await sql`select data from issued_cards where po_number = ${poNumber}`;
      return rows[0] ? (rows[0].data as IssuedCardRecord) : null;
    },

    /**
     * Read straight off the decision log. Must match `memory.ts` exactly, a rule that
     * behaves differently on the deployed store than on a laptop is worse than no rule.
     *
     * **Exposure** (rate, structuring): approved *and* held. A held purchase is pending a
     * signature rather than abandoned, and ignoring the hold queue would let an agent
     * structure a purchase through it. A refusal moved no money.
     *
     * **Payment history** (rule 10): approved only. A held purchase has paid nobody, and
     * counting it made the control defeat itself: the first attempt was held for review,
     * and that hold alone made the vendor "known", so a retry passed with no human input.
     */
    async getSpendHistory({ agent, vendor, costCentre, windowHours, excludePoNumber }) {
      const cutoff = Date.now() - windowHours * 3_600_000;
      // The order line being judged is excluded from every aggregate, or a purchase is
      // counted against itself: a held row for this same line is already in the totals
      // when a person releases it, so the release would add the amount twice.
      const all = (await this.listDecisions()).filter(
        (d) => !excludePoNumber || d.po.poNumber !== excludePoNumber
      );
      const committed = all.filter((d) => d.outcome === "approved" || d.outcome === "held");
      const settled = all.filter((d) => d.outcome === "approved");
      const inWindow = committed.filter((d) => Date.parse(d.createdAt) >= cutoff);

      const mine = inWindow.filter((d) => d.agent === agent);
      const sameLine = inWindow.filter(
        (d) => d.po.vendor === vendor && d.po.costCentre === costCentre
      );
      const total = (rows: typeof inWindow) =>
        rows.reduce((sum, d) => sum + d.po.unitPrice * d.po.quantity, 0);

      return {
        windowHours,
        agentCount: mine.length,
        agentTotalCents: total(mine),
        sameVendorCostCentreCents: total(sameLine),
        sameVendorCostCentreCount: sameLine.length,
        // Across all time, not just the window: a vendor paid two years ago is not new.
        // `settled`, not `committed`, see the note above.
        vendorEverPaid: settled.some((d) => d.po.vendor === vendor),
      };
    },

    async recordAcceptedQuote(quote) {
      const sql = await getSql();
      // do nothing on conflict: first terms win, see the interface note.
      await sql`insert into quotes (po_number, data) values (${quote.poNumber}, ${JSON.stringify(quote)})
                on conflict (po_number) do nothing`;
    },

    async claimOrderLine(poNumber) {
      const sql = await getSql();
      // RETURNING is empty when the conflict fired, which is precisely "someone else has
      // it". No read-then-write, so there is no window between checking and taking.
      const rows = await sql`
        insert into line_claims (po_number) values (${poNumber})
        on conflict (po_number) do nothing
        returning po_number`;
      return rows.length > 0;
    },
    async releaseOrderLine(poNumber) {
      const sql = await getSql();
      await sql`delete from line_claims where po_number = ${poNumber}`;
    },

    async recordIssuedCard(card) {
      const sql = await getSql();
      // do nothing on conflict: the first card for a line wins, always.
      await sql`insert into issued_cards (po_number, data) values (${card.poNumber}, ${JSON.stringify(card)})
                on conflict (po_number) do nothing`;
    },
    async chargeBudget(costCentre, cents) {
      const sql = await getSql();
      await sql`
        update budgets
        set data = jsonb_set(data, '{spentCents}',
                             to_jsonb(((data->>'spentCents')::bigint + ${cents})))
        where cost_centre = ${costCentre}`;
    },
    async markFulfilled(poNumber) {
      const sql = await getSql();
      await sql`update quotes set data = jsonb_set(data, '{fulfilled}', 'true') where po_number = ${poNumber}`;
    },
    async revokeCard(poNumber, at) {
      const sql = await getSql();
      await sql`
        update issued_cards
        set data = jsonb_set(data, '{revokedAt}', to_jsonb(${at}::text))
        where po_number = ${poNumber}`;
    },

    async reset() {
      const sql = await getSql();
      await sql`delete from issued_cards`;
      await sql`delete from line_claims`;
      await sql`delete from decisions where seeded = false`;
      await sql`delete from rule_sets where version > 1`;

      // 🔴 Quotes a negotiation created must go too, or reset does not actually reset the
      // demo. A negotiated task writes its own accepted quote (PO-71DDF45D and friends),
      // and settlement marks it fulfilled. Restoring only the seeded quotes left that row
      // behind with `fulfilled: true`, so the very first press of "Run task" after a reset
      // was refused as a duplicate, the headline moment, broken, with no way back short
      // of a redeploy. The memory driver never had this because it rebuilds from scratch.
      const seededPoNumbers = SEED_QUOTES.map((q) => q.poNumber);
      await sql`delete from quotes where po_number != ALL(${seededPoNumbers})`;

      await seedAll(sql);
      // Restore fixture quantities that live runs mutated.
      for (const q of SEED_QUOTES) {
        await sql`update quotes set data = ${JSON.stringify(q)} where po_number = ${q.poNumber}`;
      }
      for (const b of SEED_BUDGETS) {
        await sql`update budgets set data = ${JSON.stringify(b)} where cost_centre = ${b.costCentre}`;
      }
    },
  };
}
