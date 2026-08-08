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
      const { neon } = await import("@neondatabase/serverless");
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
      anchor_tx_hash text
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

  const [{ n }] = (await sql`select count(*)::int as n from rule_sets`) as { n: number }[];
  if (n === 0) await seedAll(sql);
}

async function seedAll(sql: Sql): Promise<void> {
  const rs = defaultRuleSet();
  await sql`
    insert into rule_sets (version, created_at, note, rules, hash)
    values (${rs.version}, ${rs.createdAt}, ${rs.note}, ${JSON.stringify(rs.rules)}, ${rs.hash})
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
      const rows = await sql`select * from rule_sets order by version desc limit 1`;
      return toRuleSet(rows[0]);
    },
    async appendRuleSet(ruleSet) {
      const sql = await getSql();
      await sql`
        insert into rule_sets (version, created_at, note, rules, hash)
        values (${ruleSet.version}, ${ruleSet.createdAt}, ${ruleSet.note},
                ${JSON.stringify(ruleSet.rules)}, ${ruleSet.hash})`;
      return ruleSet;
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
      await sql`delete from decisions where seeded = false`;
      await sql`delete from rule_sets where version > 1`;
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
