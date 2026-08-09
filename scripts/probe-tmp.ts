import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const base = process.env.RAIN_BASE_URL!;
  const key = process.env.RAIN_API_KEY!;
  const r = await fetch(base + "/issuing/cards", { headers: { "api-key": key } });
  const cards = await r.json();
  console.log("COUNT:", Array.isArray(cards) ? cards.length : "not array");
  console.log(JSON.stringify(cards, null, 2).slice(0, 4000));
}

main();
