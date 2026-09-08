# Closed Design Questions

Questions that stood open in `project-overview.md` §11 and have since been settled. They are kept
because a closed decision is still load-bearing: each one records a course that was considered and
ruled out, so re-proposing it wastes the same argument twice. §11 keeps only what is still open.

Nothing here is maintained. Where an entry disagrees with `src/`, the code wins.

## Search depth, free vs Pro

**Decided 2026-09-02: the distinction is dropped.** §7 listed `Basic | Basic`, which compared nothing, while the shipped pricing card had already settled it — Free reads "Instant ⌘K search" and Pro reads "Everything in Free, plus". One search for everyone. §7 now says so. What remains is a *depth* question with no tier in it: the palette matches client-side over prefetched summaries and deliberately never reads item bodies, because list queries do not select content (§5). Full-content search therefore needs a server-side query, not a wider prefetch — and if it is ever built, it is built for both tiers.

## Tag scoping

**Resolved 2026-09-02.** Tags were global rows keyed by `name @unique`, so two users who both wrote `react` shared one row — which made "this user's tags" a question the database could not answer, and therefore made tag autocomplete unbuildable without leaking the names other accounts had coined. `Tag` now carries `userId` and `normalized`, with `@@unique([userId, normalized])`; see §5. The migration does a full per-user split and a case collapse, both proven against manufactured data since no environment actually held either case. **What this unblocks, and what is still open:** autocomplete (suggest from the user's own vocabulary, which is the real defence against `react`/`reactjs` drift — and it should also feed the AI tagger, which currently invents fresh spellings because the prompt never sees the tags the account already uses) and tag filtering (the badges on `ItemCard` are inert; nothing turns a tag into a query). Neither is on the roadmap yet. A **merge/rename** control is the third piece, and is cheap now that tags have an owner.

## Free-tier limit enforcement

**Decided 2026-08-17.** Limits are checked at the *write boundary* — the Server Action, not the data layer — which is the same division `contentType` follows: the UI may show the cap, the action is the authority. Hitting the cap is a **hard block** with an upgrade-flavoured error toast, because the pricing page already promises "Up to 50 items" and a 51st that succeeds turns the number into decoration. The rules themselves are pure functions in `src/lib/limits.ts` beside `canAccessItemType`, taking the count rather than querying, so they stay unit-testable without a database. See `context/features/stripe-phase-1-spec.md` (the rules) and `stripe-phase-2-spec.md` (the call sites). `ENFORCE_PRO_LIMITS` is now `true`, so all of this refuses for real. One thing stays open and is noted there: the accepted race where two concurrent creates both read 49.

## R2 objects outlive a deleted account

**Resolved 2026-09-01.** `deleteAccount()` deleted the `User` row and Postgres cascaded every item with it, but `deleteObject` was only ever called by `deleteItem` — so the bytes stayed in the bucket with nothing left in the database pointing at them, and "delete my account" did not delete the account's files. `deleteUserObjects(userId)` in `src/server/infra/r2.ts` now lists and deletes the `users/<id>/` prefix a page at a time, and `deleteAccount` calls it. The prefix rather than `Item.fileKey` is the point: the cascade destroys every row that could hold a key, while `buildObjectKey` is the only thing that mints one and `isOwnedKey` already treats the prefix as proof of ownership — so the prefix is the authority on what belongs to the account, and it also catches the orphans `deleteItem` leaves behind when its own object delete fails. **Ordering:** the sweep runs *after* the row delete, unlike the Stripe cleanup which must run before it, because sweeping first would mean a failed `user.delete` had already destroyed a live account's files — the same trade `deleteItem` makes at item scale. Best-effort and logged either way. **Still open, and deliberately:** the crash window between the two is now bounded rather than unbounded, and closing it needs a `/api/cron/sweep-orphaned-objects` route in the pattern `/api/cron/sweep-unverified` established — the mechanism it would call already exists.

## An unverified account holds its email address forever

**Resolved 2026-09-01.** Registration created the `User` row before the verification email was sent and nothing ever removed it, so a typo at signup — `tomm@` for `tom@` — locked that address out of the product for good, and the person it belonged to hit the 409 in `api/auth/register` with no route forward. A nightly Vercel Cron now calls `/api/cron/sweep-unverified`, which deletes `emailVerified: null` rows older than `UNVERIFIED_ACCOUNT_TTL_DAYS` (seven) — the number GitLab's own issue proposes as a default for exactly this case. The rule lives in `src/server/unverified.ts`; `npm run users:sweep` runs the same function by hand. Three of its six `where` clauses are guards rather than the rule, and the load-bearing one is `accounts: { none: {} }`: a GitHub sign-up is stamped verified by the `linkAccount` event in `src/auth.ts`, which is a *second* write after the `User` and `Account` rows exist, so a transient failure there would leave a real GitHub account looking exactly like an abandoned registration. **Re-registration takeover** — letting a fresh signup replace an unverified row — is the half deliberately *not* built: it answers the person who spotted the typo immediately, which a sweep cannot, but it widens an existence disclosure and costs nothing to defer while there are no real users. **Deployment dependency:** the route refuses to run unless `CRON_SECRET` is set in Vercel, which it is (confirmed 2026-09-05).

## Collection recency is creation order in practice

**Resolved 2026-09-02.** §8 said recency was `updatedAt` and both the dashboard's recent collections and the sidebar's recent list did order by it — but nothing ever moved the column. Membership is written as a nested write on the **Item**, so `item_collections` changed while the `collections` row was never in the statement; `updatedAt` therefore equalled `createdAt` for every collection nobody had renamed, "recent" meant "newest", and the one thing that did move it was a rename, which is metadata rather than activity. `touchCollections()` in `src/actions/items.ts` now moves it from all three item write paths. The two halves worth knowing: an **edit takes the union of old and new membership**, because a collection the item left changed as much as the one it joined — and when a payload carries no `collectionIds` at all, the collections already holding the item are still touched, since editing an item is activity for wherever it is filed (that is the common case, and the one a naive implementation misses). **Delete reads membership before the row**, since the join rows cascade. The read-time alternative — the greatest of the collection's own `updatedAt`, its items' and `ItemCollection.addedAt` — was rejected: it puts a joined aggregate no index can serve into the `ORDER BY` of two queries on every dashboard page view, to save one `UPDATE` on a path already writing. Last *visited* was rejected too; it needs a new column and a write on every page view, and the products this imitates sort by last message, not by opening a conversation. The touch is best-effort and logged: the item write has already succeeded and been reported, so a failure costs a sidebar ordering rather than the user's work.


## Account linking must read the local row's `emailVerified`

**Recorded 2026-09-08, ahead of the feature it constrains.** The soft verification gate lets an
unconfirmed account sign in and use the product, which raises the obvious question of whether it
reopens the account-takeover class that verification-on-signup is usually credited with closing. It
does not, because that class is a **linking**-layer failure rather than a login-layer one.
[CVE-2026-53516](https://github.com/advisories/GHSA-g38m-r43w-p2q7) hit applications whether or not
they gated signup: the auto-link check read the OAuth provider's verified claim and never read the
local row's `emailVerified`, so an attacker who registered `victim@x.com` and never confirmed it was
handed the account the moment the victim signed in with GitHub. A hard front door was never what
protected against it. **There is no account linking here and none is planned**, so nothing is exposed
today — this exists so a future feature cannot reintroduce it.

> If account linking is ever built, check the **local row's** `emailVerified` when an OAuth sign-in
> matches an existing account by email. Never merge on email match alone, and never accept the
> provider's claim as a substitute.

`src/auth.ts` currently has no `signIn` callback doing email matching, and its `linkAccount` event
only stamps `emailVerified` on an account NextAuth has already decided to link — which today is only
ever a fresh GitHub sign-up. The `OAuthAccountNotLinked` message in `lib/auth-errors.ts` is the
current behaviour: a GitHub sign-in whose address already belongs to a password account is
**refused**, and the user is sent to the credentials form. That refusal is the protection, and it is
what a linking feature would be replacing.

**What carries the risk instead of the login gate:** spam and abuse are handled by gating billing,
the AI actions and uploads behind a confirmed address, and by keeping the seven-day prune for
untouched registrations. [The pre-hijacking study](https://arxiv.org/pdf/2205.10174) names pruning
as a primary mitigation, and a pre-hijacking account is untouched by construction — the attacker
registers the victim's address and then waits — so pruning untouched accounts removes exactly the
risky rows and spares exactly the real ones. The rules are in `src/lib/verification-access.ts` and
the sweep in `src/server/unverified.ts`.

## How long an unverified account keeps working

**Decided 2026-09-08, replacing two earlier answers from the same day.** The soft-gate plan gave an
unconfirmed account seven days of full access and then dropped it to read-only, and a first pass also
opened checkout to it on the reasoning that payment is a stronger identity signal than a clicked
link. Both were wrong, and checking what established products do is what settled it.

**Nobody uses a timer.** The two patterns in the field are
[Supabase's default](https://supabase.com/docs/guides/auth/passwords), which refuses sign-in until
the address is confirmed, and
[GitHub's](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference), which
lets an unverified user sign in and read but blocks creating repositories, issues, pull requests,
comments, gists, stars, Actions, tokens — and Sponsors, which is a payment action. GitHub's
restrictions apply from signup. A seven-day window has the property that nothing signals anything
until a working application quietly stops working, and the restriction is what teaches the rule, so
deferring it defers the teaching.

**What we do:** GitHub's model. An unconfirmed account signs in, reads and copies everything
including its seeded starter content, and cannot create, edit, delete, or reach checkout. One flag,
checked in `server/access.ts`, and no clock anywhere.

**What this deleted rather than added:** the grace period, `lib/verification-access.ts` and its
day-count rules, `hasContentBeyondSeed`, the day-7 read-only reminder, the day-83 warning, the day-90
deletion, two `User` columns and two email templates. If an unconfirmed account can never write, it
can never accumulate work, so every account the nightly sweep sees holds exactly its seed — which is
what made the elaborate lifecycle unnecessary. The sweep is the seven-day delete it always was,
minus the `items: { none: {} }` guard that seeding had already invalidated, plus `isPro` and
`stripeSubscriptionId` guards so a paying row can never be reached by it.

## Whether an unverified account may pay

**Superseded the same day by "How long an unverified account keeps working" above — checkout is
gated again, following GitHub's treatment of Sponsors. Kept because the reasoning about
`ENFORCE_PRO_LIMITS` still holds and explains why the AI and upload gates do not exist.**

**Decided 2026-09-08, reversing this plan's own first answer.** The soft-gate plan gated billing
alongside the AI actions, and it was built that way before the contradiction surfaced: the AI
features and file uploads are **already Pro-only** under `ENFORCE_PRO_LIMITS`, so gating checkout
made the other two gates unreachable. An unconfirmed account could not pay, so it could not be Pro,
so `canUseAi` and `canAccessItemType` refused it before verification was ever consulted. The gate
was dead code, and the manual test for it was impossible to perform.

**Checkout is now open to an unconfirmed account, and payment substitutes for a confirmed address**
everywhere the rules are read: `canWriteContent` returns true for a Pro account, `unverifiedRefusal`
passes it, and `SWEEPABLE` in `server/unverified.ts` excludes any row with `isPro` or a
`stripeSubscriptionId`. The reasoning is that a completed payment is a far stronger identity signal
than a clicked link, Stripe collects a billing address of its own, and the alternative — taking
someone's money and then making their account read-only, or deleting it on day 90 — is indefensible.
Both billing columns are checked in the sweep rather than one, because they fail apart: `isPro` is
only as current as the last webhook that landed, and `stripeSubscriptionId` survives a cancellation,
which is the conservative direction for a rule that deletes rows.

**What verification still gates**, therefore, is exactly one thing: the seven-day write clock on a
free account. The AI and upload checks are kept as cover for `ENFORCE_PRO_LIMITS` being switched
off — which opens both features to every account — and are documented as that rather than as a live
gate.
