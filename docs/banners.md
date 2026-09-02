# Banners & economy

How you acquire companions, and the two-currency system that keeps the "safe"
curated banner and the "wildcard" procedural banner feeling completely different.

<sub>[← Back to README](../README.md) · Related:
[Companions](companions.md) ·
[Daily commissions](commissions.md) ·
[Abilities](abilities.md)</sub>

## Two currencies, on purpose

- **Gems** — the premium currency. Funds the curated **Standard Summon** and
  drops from **daily commissions**. Scarcer, meant for the "I want a specific
  teacher" path.
- **Shards** — the cheap, plentiful currency. Funds the **Random banner**
  roulette. Abundant, meant for the "let's see what the model invents" path.

Keeping them separate is deliberate: you can't drain your gems into the roulette,
and the roulette can't accidentally empty your gacha bank. A fresh profile starts
with **300 gems** and **60 shards**.

## Standard Summon (the gacha tab)

The curated banner, `STANDARD_BANNER` in `src/data/gachaBanner.ts`. It pulls from
the fixed roster (the four shipped companions).

- **Cost:** **100 gems** per pull.
- **Rarity rates:** ★3 **70%**, ★4 **25%**, ★5 **5%** (no 1★/2★ exist).
- **Hard pity:** if you've gone **10 pulls** since your last ★5, the next pull is
  **guaranteed ★5**. The pity counter resets to 0 on any ★5.
- **Duplicates:** if the roll is a character you already own, it's flagged a
  duplicate and you get a **20% gem refund** (`DUPLICATE_REFUND_RATE`) instead of
  a dead pull. So a dup of a 100-gem pull refunds 20 gems.
- **Multi-pulls:** `pullMany` runs N pulls in sequence, carrying pity and
  ownership forward through the batch, so a 10-pull can't double-count pity.

Because the pool is small (four characters), duplicates are common once you've
collected a few — the refund is what keeps that from feeling punishing. The
pity guarantees you *will* get a ★5 (Yui) within 10 pulls if you're willing to
spend 1,000 gems on it.

## Random banner (the roulette)

The **Random banner** is a different animal: it doesn't select from a roster, it
*generates* a new, unique companion (see
[Companions → procedural companions](companions.md#procedural-companions)). It's
a "the gun has a 1 in 6 chance to shoot" gamble — `RANDOM_BANNER_CONFIG` in
`src/lib/randomBanner.ts`:

- **Cost:** **15 shards** per attempt.
- **Chance to get *any* character:** **1 in 6** (~16.7%). Most attempts produce
  nothing.
- **Given a hit, the rarity split:** ★3 **68%**, ★4 **25%**, ★5 **7%**.
- **Unconditional odds per attempt:** roughly **11.3% three-star**, **4.2%
  four-star**, **1.2% five-star**, and **~83.3% nothing**.
- **Roster cap:** you can own at most **12** Random-origin companions at once;
  once you hit the cap, the banner is full.
- **Wager reroll:** the reroll uses the exact same odds (it's the same function
  aliased as `wagerReroll`, kept separate so the "house edge" can be tuned
  later without touching the base roll).

The design intent: shards are plentiful, the per-attempt cost is low (15), and
the payoff is a *one-of-a-kind* companion no one else can pull — so the loop is
"grind shards cheaply, spin often, and occasionally get a genuinely novel
character." It's the anti-gacha: the fun is the invention, not the rarity.

## The economy loop, end to end

```
   daily commissions  ──pay──►  gems  ──►  Standard Summon  ──►  a curated teacher
   (see commissions.md)                                  (100 gems/pull)

   (cheap, plentiful) shards ──►  Random banner  ──►  a brand-new, unique companion
                                        (15 shards/attempt, 1-in-6)
```

Commissions are the only *renewable* gem source — they reset daily. So the
sustainable loop is: **do the three daily tasks → claim gems → spend them on the
Standard Summon** for a specific teacher, while spinning the Random banner with
shards for the novelty of invented characters. See [Daily
commissions](commissions.md) for the task details.
