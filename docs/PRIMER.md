# Raingentic, explained from zero

No assumed knowledge. Read this once and you can hold a conversation with anyone in the
room today.

---

## 1. The one-sentence version

**AI agents are getting good enough to do real tasks, but they cannot pay for anything, and
this weekend is about fixing that.**

An agent can find you the cheapest flight, compare twelve suppliers, or spin up a server.
Then it stops, because paying requires a card number, a bank account, a human. Everything
today assumes a person is at the end of the transaction.

---

## 2. Why money is genuinely hard for software

A bank account belongs to a legal person or company. An AI agent is neither. It cannot open
one, cannot be liable, cannot be sued.

The traditional workaround is to give the agent a human's card details, which is obviously
terrible: no limit on what it buys, no record of why, no way to revoke just that agent's
access without cancelling the card for everyone.

So the industry needs money that software can hold and spend, with rules attached. Two
technologies converge on that.

---

## 3. Blockchain, in plain terms

**A blockchain is a shared ledger that many parties write to and nobody owns.**

That is genuinely it. A list of transactions, copied across thousands of computers, where
changing history would require out-muscling all of them at once. There is no company in the
middle who can freeze your row or go out of business.

Two consequences that actually matter here:

- **Software can hold an account.** A wallet is a keypair, not a legal identity. A program
  can own one. A bank account requires a person; a wallet does not.
- **Money moves like data.** No banking hours, no wire cutoff, no correspondent bank. A
  transfer settles in seconds, and code can trigger it.

**"L1"** just means a base blockchain, one that settles its own transactions rather than
relying on another. Ethereum is an L1. Monad is an L1.

**"EVM-compatible"** means it runs the same programs Ethereum does. Programs on a
blockchain are called **smart contracts**, which is a bad name: they are not contracts, they
are just code that lives on the chain and runs when called. EVM compatibility matters
because every existing tool and library works without a rewrite.

---

## 4. Stablecoins

Bitcoin is useless for paying for things because its price moves. Nobody prices a coffee in
something that might be worth 15% less by Thursday.

**A stablecoin is a token that is always worth one dollar**, because a company holds a real
dollar in a real bank for every token issued. USDC is the well-known one. Rain uses **RUSD**.

So a stablecoin is a dollar that moves at the speed of a database write. That is the entire
appeal, and it is why every payments company is building on them.

---

## 5. The bit most people miss: stablecoins do not buy anything

You cannot pay a New York deli in USDC. Merchants take Visa and Mastercard.

So the actual bridge between crypto money and the real economy is **a card**. And issuing
cards is hard, regulated, and slow.

**That is Rain's whole business.**

---

## 6. The companies

### Rain, the main host

A **stablecoin payments platform**. Their pitch is that you hold stablecoins and spend them
anywhere, and everything in between is their problem.

What makes them serious rather than a crypto startup:

- **A Visa and Mastercard Principal Member.** Principal membership means they issue cards
  directly rather than renting someone else's licence. Very few companies have it.
- **175 million merchant locations, 220+ countries.** Anywhere a card works.
- **100+ organizations** use them. They raised **$250 million**.

Their products: card issuing, stablecoin and fiat wallets, on-ramps and off-ramps (moving
between dollars and stablecoins), and cross-border rails.

**How the card actually works:** you deposit stablecoin into a contract that belongs to you.
That deposit is **collateral**. Your card's spending power is backed by it. Like a secured
credit card, except the security deposit is a token and the whole thing is programmable.

That is why your credentials sheet has a **Collateral contract ID**. Rain has already
created that contract for Team 10.

### 🔴 The Agent Control Layer, their newest product

Shipped **June 2026**, and the reason this hackathon exists. In their words:

> "Businesses need to **bound what an agent can do**, keep its activity **auditable**, and
> adjust the limits as workflows grow."

You define, in code, before the agent acts: how much per transaction, which merchants and
categories, how often, when the card expires, and caps across your whole program.

And the line that matters most:

> "The controls are **enforced at card issuance and transfer initiation rather than applied
> after the fact.**"

A transaction that breaks the rules does not get reviewed and reversed. **It never
happens.**

### Monad, the co-host

An **L1 blockchain, EVM-compatible, up to 10,000 transactions per second**.

Why speed matters here: if agents pay each other tiny amounts constantly, say a tenth of a
cent per API call, then a chain that handles 15 transactions per second at a dollar of fees
is useless. Micropayments only work if settlement is fast and nearly free.

Monad is also a member of the **x402 Foundation**, which brings us to the last concept.

### Encode Club, the organiser

A global developer community, around 500,000 members, that runs hackathons and accelerators.
They are not a sponsor with a product here, they run the event and the submission platform.

---

## 7. x402, and why it keeps coming up

When your browser fetches a page, the server replies with a status code. **200** means fine.
**404** means not found. **403** means forbidden.

**402 means "Payment Required."** It was written into the HTTP spec in the 1990s, reserved
for a future where the web could charge for things directly, and then never used. For thirty
years it has sat there marked "reserved."

**x402 is the standard that finally uses it.**

The flow is simple:

1. A client asks for something.
2. The server replies **402**, with a machine-readable price and where to pay.
3. The client pays, on-chain, automatically.
4. The client asks again, with proof of payment.
5. The server returns the thing.

No signup, no API key, no invoice, no monthly plan. **A program can pay another program for
one request.** That is the part that is new, and it is why every agentic commerce hackathon
in the last year has been organised around it.

---

## 8. So what is "agentic commerce"

Agents buying and selling on their own, without a person in the loop for each transaction.

Two directions, and both are live:

- **Agents as buyers.** Your agent books the flight, pays the supplier, buys the compute.
- **Agents as sellers.** An API charges a fraction of a cent per call and gets paid by
  whoever calls it, human or machine.

The hard part is not the paying. It is **trust**. The moment software can spend money by
itself, someone has to answer: how much, on what, for whom, and who is responsible when it
gets it wrong.

**Everything interesting at this hackathon lives in that question**, which is also exactly
where your existing work lives.

---

## 9. The three tracks, translated

| As written | What it means |
|---|---|
| **Best use of Rain** | Use Rain's payment infrastructure so an agent can transact by itself. In practice: your code issues a card or moves money, and an agent decides when. |
| **General track** | *"We want to see agents actually move money."* Any infrastructure. The bar is that money genuinely moves, not that you demo a plan to move it. |
| **Monad bounty** | Best use of Monad for agentic commerce, alongside Rain. **Optional.** One extra prize, a Mac Mini and studio access. |

**Do not chase all three.** Win one properly.

---

## 10. Who is judging, and what they care about

| Judge | Background | What they will notice |
|---|---|---|
| **Siggy Bilstein** | Engineering Manager at **Cursor**, works on Origin, a git forge built for AI agents. Previously co-founded Maza, Director of Engineering at Flex, EM at Graphite. | Code quality and whether the system design is coherent. He is not a payments person, he is an engineering leader. |
| **Ross Basri** | **Product lead at Rain**, launched Rain Rewards. Co-founded Uptop, acquired by Rain in 2025. | Whether this is a product or a script. Whether a real customer would use it. |
| **Farhan Khwaja** | **Software engineer at Rain**, backend and Web3 infrastructure, high-throughput transactional systems, custody. Previously Fern Money, Multiplex, Thirdweb Engine. | Whether you handled the transactional edges: retries, idempotency, failure. |
| **Juan Blanco** | **Data engineer at Rain**, formerly Messari, Flipside Crypto, Santander. **Has won Ethereum hackathons in Amsterdam and Paris.** | He has been on your side of the table and will know what was faked. |
| **Jarrod Watts** | **AI Engineering Lead at Monad**, works on agent orchestration and agents transacting on-chain. | The agent side. Whether the agent is doing real work or is a prompt wrapper. |

**Three of five work at Rain.** Build with Rain's tools, use Rain's vocabulary, and read
what Rain shipped in June.

---

## 11. Words you will hear today

| Term | What it means |
|---|---|
| **Wallet** | A keypair that can hold and send tokens. Software can own one. |
| **On-chain** | Recorded on the blockchain, publicly, permanently. |
| **Gas** | The fee to run a transaction. Cheap on Monad, which is the point. |
| **Smart contract** | Code that lives on a chain and runs when called. Not a contract. |
| **Testnet** | A practice blockchain with worthless tokens. **Base Sepolia** is one. |
| **Settlement** | The money actually moving, as opposed to being promised. |
| **Custody** | Who holds the keys, and therefore the money. |
| **Idempotency** | Doing the same operation twice has the same effect as once. Critical for payments, because retries happen and nobody wants to be charged twice. |
| **Rails** | The plumbing money moves through. Card rails, bank rails. |
| **KYC** | Know Your Customer, the identity check regulators require. |
| **Principal Member** | Licensed by Visa or Mastercard to issue cards directly. |

---

## 12. The honest summary

Three technologies arrived at once. **Agents** got good enough to act. **Stablecoins** made
dollars programmable. **x402** gave machines a way to pay each other over plain HTTP.

Rain sits at the point where programmable money meets the 175 million shops that only take
cards. Monad makes tiny payments cheap enough to be worth making.

What nobody has solved is the governance layer: **when software can spend, what stops it
spending wrongly?** Rain has started, with limits and allowlists enforced before the money
moves.

That question is the whole event, and you have been building the answer to a version of it
for a year.
