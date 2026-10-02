# Daily commissions

Three small daily tasks that pay **gems** when you complete and claim them. This
is the app's only *renewable* gem source — the loop that keeps the Standard
Summon funded day to day.

<sub>[← Back to README](../README.md) · Related:
[Banners & economy](banners.md) ·
[Teaching & review](teaching.md)</sub>

## The three tasks

Defined in `src/data/commissions.ts`. Each is scoped to *today*; progress resets
when the date rolls over.

| Task | ID | Target | Reward |
|---|---|---|---|
| **Say hello** | `daily_talk` | Send at least **1** message to a companion | **20 gems** |
| **Learn something new** | `daily_learn_words` | Have a companion teach **3** new words | **40 gems** |
| **Keep it fresh** | `daily_review` | Complete **10** SRS reviews | **30 gems** |

Claiming all three in a day nets **90 gems** — just under the 100-gem cost of a
single Standard pull, so a day of light play keeps you roughly one pull behind
where you were. That's the intended pacing: consistent daily play funds
consistent gacha.

## How progress accrues

Progress is bumped automatically by the actions that count, not by a manual
counter:

- **Say hello** advances by 1 on **every** chat message you send (it's
  incremented in the chat handler after each turn).
- **Learn something new** advances by the **number of new words** the companion
  taught that turn (so a single turn that teaches 2 words moves it by 2).
- **Keep it fresh** advances by 1 for each SRS card you review in the Review tab.

Progress is **capped at the target** — teaching 10 words only moves
*Learn something new* by its 3 (the cap), it doesn't bank the overflow. Once
`progress >= target` the task is marked **completed**.

## Claiming

A completed task shows a **Claim** button. Claiming:

1. Adds the task's `rewardGems` to your gem balance.
2. Marks the task **claimed** so it can't be claimed twice.

You can only claim a task that is both **completed** and **not yet claimed** —
the store guards both. Claiming is the only thing that actually pays out the
gems; completing a task on its own doesn't.

## Why it exists

Commissions are the bridge between *learning* and *collecting*. Doing them means
you're doing the actual app — chatting, learning words, reviewing cards — and
that's what buys you the companions you want. It also gives the Review tab a
reason to exist every day (the 10-review task), which is important because
spaced repetition only works if you keep showing up.
