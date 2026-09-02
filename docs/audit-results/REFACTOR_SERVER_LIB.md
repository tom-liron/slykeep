# REFACTOR — `src/server/` and `src/lib/`

> **Audit record — `refactor-scanner` agent output, 2026-09-01. Not maintained.**
> A point-in-time scan proposing extractions; it never edited anything. Some proposals have since
> been applied, some deliberately declined, and nothing re-checks which. Re-run the agent rather
> than working from the list below.

Scanned two folders in one pass: **`src/server/`** (10 source modules, 7 co-located `*.test.ts` read
as context) and **`src/lib/`** (32 source modules, 17 co-located `*.test.ts` read as context). Read
for extraction targets and to check whether a home already exists: `src/config/`, `src/types/`,
`src/hooks/`, `src/actions/`, `src/components/`, and the two prior reports
(`REFACTOR_ACTIONS.md`, `REFACTOR_COMPONENTS.md`) so nothing already applied is re-proposed —
`server/prisma-errors.ts` and `lib/field-errors.ts`'s `fieldFailure` are both in place and are
correctly excluded.

**10 findings** — 2 High, 4 Medium, 4 Low.

Line counts are code lines only: blanks and comments are excluded, and comment lines that move to a
new home are reported separately and never counted as a saving. Net is `removed − added`, so a
**positive number means lines saved** and a negative number means the extraction costs lines.

Boundary check applied to every proposal: nothing that touches Prisma, a secret, or a `server-only`
module is proposed for a client-reachable `lib/` home, and no `src/server/` module is pulled into
`lib/`. Finding 4 is the one that argues its own placement at length, because it reads `process.env`.

---

## Decision table

| # | Finding | Folder | Grade | Sites | Net lines | Effort | Risk |
|---|---------|--------|-------|-------|-----------|--------|------|
| 1 | The row → `ItemSummaryViewModel` map, five copies | server | **High** | 5 | **+12** | S | Low |
| 2 | `AI_*_PAYLOAD_LIMIT`, one number written four times | lib | **High** | 5 (1 outside) | **+12** | S | None |
| 3 | The Stripe customer-id lookup and its guard | server | **Medium** | 3 | **+4** | S | Low |
| 4 | `origin()` and `billingOrigin()` are one function | lib | **Medium** | 2 | **+2** | M | Low |
| 5 | The collection summary: dominant type, count, name | server | **Medium** | 3 | **+2** | M | Medium |
| 6 | `findFirst({ name, userId: null })`, written twice | server | **Medium** | 2 (1 outside) | **−2** | S | Low |
| 7 | `megabytes()` reinvents `formatFileSize` | lib | **Low** | 1 | **+2** | S | None |
| 8 | The collection→item join object, written twice | server | **Low** | 2 | **+1** | S | None |
| 9 | `IMAGE_EXTENSIONS` restates the upload allow-list | lib | **Low** | 2 | **0** | S | Low |
| 10 | The sidebar's `take: 5` is the only list length not in `config/` | server | **Low** | 1 | **−1** | S | None |

**Totals**: +32 net code lines across 10 findings — High +24 (2), Medium +6 (4), Low +2 (4).

Split by folder: `src/server/` +16 across 6 findings, `src/lib/` +16 across 4 findings.

---

# Section A — `src/server/`

Findings 1, 3, 5, 6, 8, 10.

---

### 1. The row → `ItemSummaryViewModel` map, five copies — High

**Grade**: High — five call sites in three modules, and the destination already exists beside the
`select` that defines the row shape. Rubric clause: *four or more call sites, where the destination
already exists or is unmistakable.*

**Sites** (5, 0 outside the scanned folder):

- src/server/items.ts:117–118 — `getDashboardItems`, as a local `toViewModel`
- src/server/items.ts:165–167 — `getFavoriteItems`
- src/server/items.ts:294–299 — `getItemTypePageData`
- src/server/collections.ts:268–273 — `getCollectionPageData`
- src/server/search.ts:55–60 — `getSearchData`

**The duplicated logic**:

```ts
items: rows.map((row) =>
    buildItemSummaryViewModel(
        { ...row, tags: row.tags.map((tag) => tag.name) },
        itemTypesById,
    ),
),
```

**Differences between the copies**: only the parameter name (`row` in four, `item` in
`collections.ts`) and the formatting — `items.ts:117–118` is a named arrow used twice, the other four
are inline `.map`s. The expression is character-for-character the same in all five, including the
tag flattening, which is the only thing here that is not a plain forward: `ITEM_SUMMARY_SELECT`
joins tags as `{ name }[]` (items.ts:48) and `ItemSummaryRow` in `view-models.ts:55` declares
`tags: readonly string[]`, so every caller has to bridge those two shapes by hand.

A sixth site is deliberately **not** in this count: `getItemDetail` (items.ts:191–198) does the same
tag flattening but also flattens `collections`, so it goes on calling
`buildItemDetailViewModel` directly.

**Extract to**: `src/server/items.ts` — existing module, beside `ITEM_SUMMARY_SELECT` and the
`ItemSummaryRow` payload type it already declares at line 51. 8 code lines:

```ts
export function toItemSummaries(
    rows: readonly ItemSummaryRow[],
    itemTypesById: ReadonlyMap<string, ItemTypeViewModel>,
): ItemSummaryViewModel[] {
    return rows.map((row) =>
        buildItemSummaryViewModel({ ...row, tags: row.tags.map((tag) => tag.name) }, itemTypesById),
    );
}
```

`items.ts` and not `view-models.ts`: this function's input is a Prisma payload
(`Prisma.ItemGetPayload<{ select: typeof ITEM_SUMMARY_SELECT }>`), and `view-models.ts:14–19`
states as a rule that its inputs are "declared structurally rather than against Prisma's generated
types, so the derivation rules below stay decoupled from the persistence shape". This is the
adapter *between* those two worlds, so it belongs on the persistence side, next to the `select` that
produces the row. Both other consumers already import `ITEM_SUMMARY_SELECT` from `./items`, so
neither gains an import line — just a name on the line it already has.

**Lines**: removed 25 (23 for the five blocks: 2 + 3 + 6 + 6 + 6; plus 1 as `collections.ts` drops
`buildItemSummaryViewModel` from its six-line import block; plus 1 as `search.ts:8` loses its
`./view-models` import entirely) · added 13 (shared definition 8 + 4 call sites + 1 import — the
`ItemTypeViewModel` type joins `items.ts`'s existing type-import block) · **net +12** ·
comments moved 0.

**Effort**: S — three files, one existing module gains a function, no new file and no new test.

**Risk**: Low, and well covered. `items.test.ts:169` ("builds summaries with no item body in them"),
`:122` ("flattens tags and collections onto the view model"), `:147`, `:200` and `:218` all assert
the output of these call sites and run straight through the new function, so a flatten that stopped
flattening fails existing tests. `view-models.test.ts:325` pins `buildItemSummaryViewModel` itself.
`search.test.ts` exercises the fifth site.

**Behaviour change**: None.

**Why it's worth it**: the tag bridge is the one line here that can be wrong, and it is written five
times. `row.tags` is `{ name: string }[]` on one side and `string[]` on the other; a copy that
forgot the `.map` does not fail to compile in an obvious place — it fails inside
`buildItemSummaryViewModel`'s `[...item.tags]`, producing an array of objects that renders as
`[object Object]` in a badge. More to the point, this is the shape every future list query will be
written by copying: the search prefetch (`search.ts:24–27`) already documents that it deliberately
carries "the same column list every other list query reads", and the full-content search the roadmap
still owes (§10, Phase 3) is a sixth copy waiting to be written.

**Call-site after**:

```ts
items: toItemSummaries(rows, itemTypesById),
```

**Test**: not needed as a new file — the branchless mapping is already covered from both ends
(`view-models.test.ts` on the builder, `items.test.ts` and `search.test.ts` on the queries). Nothing
new becomes testable.

---

### 3. The Stripe customer-id lookup and its guard — Medium

**Grade**: Medium — three sites of real logic (a scoped read plus a null guard that decides whether
an API call happens at all), identical today, where drift costs maintenance rather than correctness.
Rubric clause: *two or three sites of real logic, identical today.*

**Sites** (3, 0 outside the scanned folder):

- src/server/billing.ts:36–41 — `getOrCreateCustomerId`
- src/server/billing.ts:213–218 — `hasBillableSubscription`
- src/server/billing.ts:255–262 — `endBillingRelationship`

**The duplicated logic**:

```ts
const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
});

if (!row?.stripeCustomerId) return false;
```

**Differences between the copies**: what the guard returns — `existing.stripeCustomerId` (an early
success), `false`, and a bare `return` — and that `getOrCreateCustomerId` reads `user.id` from an
already-resolved `UserViewModel` while the other two take a `userId` parameter.
`endBillingRelationship` additionally re-binds the value at :262 (`const customerId =
row.stripeCustomerId;`) purely to narrow it for the closures below, which is a fourth line the
helper removes. The four lines of the query itself are identical in all three.

**Extract to**: `src/server/billing.ts` — same module, a private (non-exported) helper above
`getOrCreateCustomerId`. Not exported, because nothing outside this module should be reading the
column directly: the three functions here *are* the billing boundary. 6 code lines:

```ts
async function customerIdFor(userId: string): Promise<string | null> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    return row?.stripeCustomerId ?? null;
}
```

**Lines**: removed 16 (5 + 5 + 6) · added 12 (shared definition 6 + 6 call sites, 2 per site +
0 imports) · **net +4** · comments moved 0.

**Effort**: S — one file, three mechanical edits, no new module and no new test.

**Risk**: Low, and directly covered. `billing.test.ts:87` ("is false without a Stripe customer, and
asks Stripe nothing") and `:266` ("does nothing when there is no customer to remove") both assert
the *absence* of a Stripe call on the null branch — which is exactly the branch this helper now
owns, so a guard inverted in the port fails both. `npm run billing:test` covers the third site
end to end and `CLAUDE.md` requires running it either side of any billing change.

**Behaviour change**: None. `row?.stripeCustomerId ?? null` and `!row?.stripeCustomerId` treat a
missing row, a null column and an empty string identically today, and the empty string cannot occur —
the column is written only from `customer.id`.

**Why it's worth it**: the two guards that answer `false` and `return` are what keep the common
path free of API calls for an account that never opened checkout, and `hasBillableSubscription`'s
doc comment at :210–211 makes that a stated property ("An account that never opened checkout has no
customer, so the common path costs no API call at all"). It is a property of three copies of a
guard. Any fourth billing read — the export feature and the account sweep both want one — is written
by copying whichever of the three is nearest.

**Call-site after**:

```ts
const customerId = await customerIdFor(userId);

if (!customerId) return false;
```

**Test**: not needed — the helper has one branch, and `billing.test.ts` already asserts both sides
of it through the two public functions.

---

### 5. The collection summary: dominant type, count, name — Medium

**Grade**: Medium — a High-shaped finding (three sites, and two of them **already disagree** with the
third about what an unresolvable dominant type means) whose extraction carries a behaviour change
that has to be decided before it lands. Rubric clause: *a High-shaped invariant whose extraction
carries a behaviour change that has to be decided before it lands.*

**Sites** (3, 0 outside the scanned folder):

- src/server/collections.ts:159–171 — `toSidebarCollection`, inside `getSidebarCollections`
- src/server/collections.ts:198–209 — inside `getFavoriteCollections`
- src/server/view-models.ts:195, 203–212 — inside `buildCollectionViewModel`

**The duplicated logic**:

```ts
const items = row.items.map(({ item }) => item);
const dominantTypeId = resolveDominantTypeId(row, items);

return {
    id: row.id,
    name: row.name,
    itemCount: items.length,
    dominantItemType: dominantTypeId ? (itemTypesById.get(dominantTypeId) ?? null) : null,
};
```

**Differences between the copies**: the sidebar adds `isFavorite`, the favourites list adds
`updatedAt`, and `buildCollectionViewModel` adds `description`, `isFavorite`, `updatedAt` and
`itemTypes`. Those are the caller's, and stay.

The difference that matters is the last line. The two copies in `collections.ts` resolve the type
with `itemTypesById.get(id) ?? null`; `view-models.ts:212` resolves the same id with
`requireItemType(dominantTypeId, itemTypesById)`, which **throws**:

```ts
// view-models.ts:116–122
function requireItemType(itemTypeId: string, itemTypesById: ItemTypeMap): ItemTypeViewModel {
    const itemType = itemTypesById.get(itemTypeId);
    if (!itemType) {
        throw new Error(`Unknown item type: ${itemTypeId}`);
    }
    return itemType;
}
```

So the same unresolvable id renders a colourless dot in the sidebar and 500s the collections page.
Nothing documents the difference, and it reads as three people writing the same four lines rather
than a decision.

**Extract to**: `src/server/view-models.ts` — existing module, which already owns
`resolveDominantTypeId` and `buildCollectionViewModel` and is where a "row → view model" rule
belongs. Its structural-input rule is respected: the parameters are the same `CollectionRow` /
`CollectionItemRow` shapes the file already declares. 12 code lines:

```ts
export function buildCollectionSummary(
    collection: Pick<CollectionRow, "id" | "name" | "defaultTypeId">,
    collectionItems: CollectionItemRow[],
    itemTypesById: ItemTypeMap,
): { id: string; name: string; itemCount: number; dominantItemType: ItemTypeViewModel | null } {
    const dominantTypeId = resolveDominantTypeId(collection, collectionItems);

    return {
        id: collection.id,
        name: collection.name,
        itemCount: collectionItems.length,
        dominantItemType: dominantTypeId ? requireItemType(dominantTypeId, itemTypesById) : null,
    };
}
```

`buildCollectionViewModel` then spreads it, which is what makes the third site part of this finding
rather than a bystander.

**Lines**: removed 29 (13 sidebar + 11 favourites + 5 inside `buildCollectionViewModel`) · added 27
(shared definition 12 + 14 call sites: 6 sidebar, 7 favourites, 1 spread + 1 import, a name added on
its own line in `collections.ts`'s existing multi-line `./view-models` block) · **net +2** ·
comments moved 0.

**Effort**: M — two files, one existing module gains an exported function, and the behaviour question
below has to be answered first.

**Risk**: **Medium**, and this is the reason. There is no `src/server/collections.test.ts` — the
folder has tests for items, search, view-models, profile, billing, verification and prisma-errors,
and none for collections. So two of the three call sites have no coverage at all, and the only thing
that fails on a bad port is `view-models.test.ts:153–192` (dominant-type ties, empty collections,
the default-type fallback), which covers the third. Port the sidebar and favourites sites by reading
them, not by trusting the suite, and click `/favorites` and the sidebar afterwards.

**Behaviour change**: **One, and it is the decision.** Unifying on `requireItemType` makes the
sidebar and `/favorites` throw where they currently render a null type, for a dominant type id that
is not in `itemTypesById`. That state is unreachable today — `getItemTypesById` returns every system
type plus all of the user's own, and a dominant id can only come from one of the user's own items or
from `collection.defaultTypeId` — so this is a change to an impossible path, and it makes the
failure loud in the two places it is currently silent. Unifying the other way (lenient everywhere)
is the alternative, and it is worse: it would remove the throw from the one site that has a test
covering it. If neither is acceptable, the finding should be dropped rather than made configurable
with a flag.

**Why it's worth it**: `dominantItemType` is the collection's colour, and the rule that produces it
(`resolveDominantTypeId` plus a lookup) is stated once in a tested function and then re-derived three
times around it. The disagreement above is already the cost of that; a fourth surface — the
collection picker, or the export — is what turns it into three different answers.

**Call-site after**:

```ts
return rows.map((row) => {
    const items = row.items.map(({ item }) => item);

    return {
        ...buildCollectionSummary(row, items, itemTypesById),
        updatedAt: row.updatedAt.toISOString(),
    };
});
```

**Test**: `src/server/view-models.test.ts` — existing file, add a `buildCollectionSummary` block:
an empty collection with a `defaultTypeId` reports `itemCount: 0` with that type; an empty one
without reports a null type; and an id absent from the map throws, which is the branch the whole
behaviour decision rests on.

---

### 6. `findFirst({ name, userId: null })`, written twice — Medium

**Grade**: Medium — two sites of a documented correctness workaround, correct in both copies today,
where the extraction makes a trap that five separate comments warn about unavailable rather than
merely documented. Rubric clause: *two or three sites of real logic, identical today.*

**Sites** (2, **1 outside the scanned folder**):

- src/server/items.ts:244–247 — `getItemTypePageData`
- src/actions/items.ts:147–150 — `createItem` — **outside the scanned folder**

**The duplicated logic**:

```ts
const typeRow = await prisma.itemType.findFirst({
    where: { name, userId: null },
    select: { id: true, name: true, icon: true, color: true },
});
```

**Differences between the copies**: the `select` — the action reads `{ id: true }` only, the query
reads the four columns `toItemTypeViewModel` needs. Nothing else.

The rule behind them is stated in prose **five** times and implemented twice:
`CLAUDE.md`, `prisma/schema.prisma`'s note, `project-overview.md` §5 ("Never `findUnique` an item
type by `name` alone"), `actions/items.ts:59–61`, `server/items.ts:226–227`, and again at
`server/item-types.ts:52–55`. That is the signature of a rule with no owner: it type-checks as
`findUnique`, it is wrong, and the only thing stopping it is that everybody has read the comment.

**Extract to**: `src/server/item-types.ts` — existing module, which the project structure already
names as the owner of item-type resolution ("item types, per-type counts, sidebar nav"). 7 code
lines, including the selector constant that also de-duplicates the three copies of the same column
list in that file (:24, :57) and in `items.ts` (:246):

```ts
export const ITEM_TYPE_SELECT = { id: true, name: true, icon: true, color: true } as const;

/** The system item type with this name, or null. Never `findUnique` by name — see `CLAUDE.md`. */
export function findSystemItemType(name: string) {
    return prisma.itemType.findFirst({
        where: { name, userId: null },
        select: ITEM_TYPE_SELECT,
    });
}
```

Deliberately returns the row rather than an `ItemTypeViewModel`: routing `createItem` through
`toItemTypeViewModel` would add a validation throw on the `icon` column to a write path that does
not have one today, which is a behaviour change dressed as a refactor.

**Lines**: removed 8 (4 + 4) · added 10 (shared definition 7 + 2 call sites + 1 import — `items.ts`
adds a name to its existing `./item-types` line for free, `actions/items.ts` gains a line) ·
**net −2** · comments moved 0 — the reasoning at `server/items.ts:226–227` is about the *slug*
resolution and stays; the note at `actions/items.ts:59–61` shortens to a pointer.

**This extraction costs two lines**, and the argument is the invariant, not the count.

**Effort**: S — one existing module gains two exports, two call sites, one of them in `actions/`.

**Risk**: Low, and there is a test written specifically for this hazard.
`actions/items.test.ts:192–198` seeds a *custom* item type named `snippet` alongside the system one
and asserts the create path resolves the system row — the exact bug a `findUnique` would introduce.
That test runs straight through the new helper, so a `where` clause that lost `userId: null` fails
it. `server/items.test.ts` does not cover `getItemTypePageData`, so verify `/items/snippets` renders
after the edit.

**Behaviour change**: None functionally. `createItem` reads three extra narrow scalars it discards —
three columns on a row already being read, on a path that then performs a write.

**Why it's worth it**: this is the one duplication in either folder with a real correctness story.
Two hand-written queries implement a Prisma-bug workaround ([prisma#29282], recorded in
`project-overview.md` §5), and the custom item types the roadmap promises in Phase 7 are precisely
what makes the wrong version wrong — today no user owns a type named `snippet`, so a `findUnique`
would pass every test. A third write path added after that ships, by someone who has not read all
five comments, is the failure this closes.

**Call-site after**:

```ts
const itemType = await findSystemItemType(type);
```

**Test**: not needed as a new file. `actions/items.test.ts:192–198` already pins the property, and it
keeps its teeth through the indirection. If `item-types.ts` gains its own test later, that case is
the one to move into it.

---

### 8. The collection→item join object, written twice — Low

**Grade**: Low — real duplication of a Prisma `select` fragment with a small positive saving and no
invariant behind it. Rubric clause: *real duplication with a small net saving and no invariant.*

**Sites** (2, 0 outside the scanned folder):

- src/server/collections.ts:38–40 — inside `COLLECTION_SELECT`
- src/server/collections.ts:52–54 — inside `SIDEBAR_COLLECTION_SELECT`

**The duplicated logic**:

```ts
items: {
    select: { item: { select: { itemTypeId: true, editedAt: true } } },
},
```

**Differences between the copies**: none. Identical to the character, and the doc comment on the
second one (:43–46) says so in prose: "it needs the same item joins as a card — but none of the
description/timestamp columns those cards also read."

**Extract to**: `src/server/collections.ts` — same module, one constant above the two selects.
3 code lines:

```ts
/** The two columns the dominant-type rule reads, and nothing else — never an item body. */
const COLLECTION_ITEMS_JOIN = {
    select: { item: { select: { itemTypeId: true, editedAt: true } } },
} as const;
```

**Lines**: removed 6 (3 × 2) · added 5 (shared definition 3 + 2 call sites + 0 imports) ·
**net +1** · comments moved 0.

**Effort**: S — one file, two edits.

**Risk**: None — `as const` preserves the literal types both `Prisma.CollectionGetPayload<>`
aliases are derived from, and the compiler checks that.

**Behaviour change**: None.

**Why it's worth it**: the load-bearing part of this fragment is what it *omits*. `COLLECTION_SELECT`'s
doc comment (:27–30) states the rule — "pulling whole items here would drag every item body into a
card query" — and then the fragment it is defending is written again nine lines below, under a
comment that has to re-assert the same thing. One definition is where that rule stops being a
convention. Do this in the same commit as finding 5, which edits the two functions that read these
selects.

**Call-site after**:

```ts
items: COLLECTION_ITEMS_JOIN,
```

**Test**: not needed — a select object with no behaviour; the type system is the check.

---

### 10. The sidebar's `take: 5` is the only list length not in `config/` — Low

**Grade**: Low — a placement finding (right value, wrong file) with a negative net that nothing
currently depends on. Rubric clause: *a placement finding that nothing currently depends on.*

**Sites** (1, 0 outside the scanned folder):

- src/server/collections.ts:153 — `take: 5,` in `getSidebarCollections`

**The duplicated logic**: none — this is placement. The value is a list length, and every other list
length in the app is configuration: `DASHBOARD_COLLECTIONS_LIMIT` and `DASHBOARD_RECENT_ITEMS_LIMIT`
(`config/dashboard.ts:12–13`), `ITEMS_PER_PAGE` and `COLLECTIONS_PER_PAGE`
(`config/pagination.ts`), `SEARCH_ITEM_LIMIT` (a named constant in `search.ts:18`, with a paragraph
explaining it). This one is a bare literal three lines under `take: DASHBOARD_COLLECTIONS_LIMIT`
in the same file — `collections.ts:126` reads the constant, `collections.ts:153` does not.

**Differences between the copies**: n/a.

**Extract to**: `src/config/dashboard.ts` — existing module, whose doc comment at :3–11 already
reasons about exactly this class of number ("Unlike the page sizes in `config/pagination.ts` these
are caps, not windows"). 1 code line:

```ts
export const SIDEBAR_RECENT_COLLECTIONS_LIMIT = 5;
```

`config/`, not `types/`: it is a runtime value. `collections.ts:3` already imports from
`@/config/dashboard`, so the name joins a line that exists.

**Lines**: removed 0 · added 1 (shared definition 1 + 0 call sites — the literal is replaced in
place + 0 imports) · **net −1** · comments moved 0.

**This extraction costs one line.** The value is that the number becomes findable.

**Effort**: S — two files, one line each.

**Risk**: None.

**Behaviour change**: None.

**Why it's worth it**: someone tuning how much the sidebar shows will find the dashboard's two
constants, change them, and not find this one — the sidebar's rail and the dashboard's grid are
the same question asked twice, and only one of them answers from `config/`. It is a one-line edit;
take it the next time anything in `collections.ts` is touched.

**Call-site after**:

```ts
take: SIDEBAR_RECENT_COLLECTIONS_LIMIT,
```

**Test**: not needed — a constant with no branches.

---

# Section B — `src/lib/`

Findings 2, 4, 7, 9.

---

### 2. `AI_*_PAYLOAD_LIMIT`, one number written four times — High

**Grade**: High — four declaration sites of one value with four copies of the paragraph explaining
it, and a consumer whose only defence against their drifting is a `Math.min` over all four. The
destination is unmistakable. Rubric clause: *four or more call sites, where the destination already
exists or is unmistakable.*

**Sites** (5, **1 outside the scanned folder**):

- src/lib/ai-tags.ts:40 — `AI_TAG_PAYLOAD_LIMIT = 100_000`
- src/lib/ai-description.ts:30 — `AI_DESCRIPTION_PAYLOAD_LIMIT = 100_000`
- src/lib/ai-explain.ts:35 — `AI_EXPLAIN_PAYLOAD_LIMIT = 100_000`
- src/lib/ai-optimize.ts:40 — `AI_OPTIMIZE_PAYLOAD_LIMIT = 100_000`
- src/actions/ai.ts:70–75 — the only consumer, **outside the scanned folder**

**The duplicated logic**:

```ts
/**
 * The largest payload the action will consider, per field. Not a product limit — an item's content
 * is not capped anywhere and legitimately runs past the limit above, which is why that one
 * truncates rather than refuses. This is a bound on what a hand-made request can make the server
 * hold in memory before the truncation gets to run.
 */
export const AI_OPTIMIZE_PAYLOAD_LIMIT = 100_000;
```

and, at the single consumer:

```ts
const PAYLOAD_LIMIT = Math.min(
    AI_TAG_PAYLOAD_LIMIT,
    AI_DESCRIPTION_PAYLOAD_LIMIT,
    AI_EXPLAIN_PAYLOAD_LIMIT,
    AI_OPTIMIZE_PAYLOAD_LIMIT,
);
```

**Differences between the copies**: the constant's name, and one word of prose —
`ai-tags.ts` says "The largest payload the action will consider." where the other three say
"…will consider, per field." The value and the reasoning are the same in all four; the three later
comments are verbatim copies of each other bar the cross-reference.

The `Math.min` is the evidence. Four per-feature constants that the consumer immediately collapses
to one number are not four decisions — and the collapse is lossy in the dangerous direction: raising
`AI_EXPLAIN_PAYLOAD_LIMIT` alone, which is the obvious thing to do when explain needs a bigger
payload, changes nothing at all and does so silently.

Note the contrast with `AI_*_CONTENT_LIMIT` (2000 / 2000 / 6000 / 4000), which are genuinely
per-feature and which `ai-description.ts:17–21` argues at length must stay separate ("equal by
coincidence, not by rule"). That argument is about the content limits and does not transfer: the
payload bound is not about the feature at all, it is about what one request may make the server
hold, and all four say so in the same words.

**Extract to**: `src/lib/ai-text.ts` — existing module, whose doc comment already claims exactly this
role: "The text handling both model calls need, in the one place neither of them owns." 1 code line:

```ts
export const AI_PAYLOAD_LIMIT = 100_000;
```

Considered and rejected as a home: `src/config/ai.ts` (new). Every one of the four comments states
"Not a product limit", and `config/` is where product configuration lives; `ai-text.ts` already owns
`truncateForModel`, the function this bound exists to stand in front of.

**Lines**: removed 14 (4 constant declarations + the 6-line `Math.min` block + 4 import-name lines at
`actions/ai.ts:7, 15, 25, 35`) · added 2 (shared definition 1 + 0 call sites — the schema at
`ai.ts:78–83` just refers to the new name + 1 import, since `actions/ai.ts` does not yet import from
`@/lib/ai-text`) · **net +12** · comments moved 24, collapsing to about 6 in the shared module, and
not counted.

**Effort**: S — five files, all mechanical, no new file and no new test.

**Risk**: None. The four constants have exactly one consumer between them (verified by grep across
`src/`), the value is unchanged, and `ai.test.ts` exercises the schema those `.max()` calls sit in.
The only way to get this wrong is to change the number, and there is nothing to change it to.

**Behaviour change**: None — `Math.min(100_000, 100_000, 100_000, 100_000)` is `100_000`.

**Why it's worth it**: a fifth AI feature is already named in the codebase — `ai-explain.ts:110–112`
points at "the summary feature, which is its own line in `docs/ai-integration-plan.md`" — and the
file it lands in will declare a fifth `AI_SUMMARY_PAYLOAD_LIMIT = 100_000` under a fifth copy of the
paragraph, and add a fifth argument to the `Math.min`. That is the shape this is in. Meanwhile the
existing four give a false impression of tunability: they read as four knobs and behave as one, and
the one that behaves is the smallest.

**Call-site after**:

```ts
const itemDraftSchema = z.object({
    title: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    ...
```

**Test**: not needed — a constant with no branches. `ai-text.test.ts` exists and covers
`truncateForModel`, which is the function that uses limits; nothing new becomes testable.

---

### 4. `origin()` and `billingOrigin()` are one function — Medium

**Grade**: Medium — two sites of real logic (an environment fallback chain and a normalization),
identical today, where drift costs maintenance. Rubric clause: *two or three sites of real logic,
identical today, where drift costs maintenance rather than correctness.*

**Sites** (2, 0 outside the scanned folder):

- src/lib/email.ts:32–38 — `origin()`, private, three callers in the file
- src/lib/stripe.ts:60–66 — `billingOrigin()`, exported, three callers in `actions/billing.ts`

**The duplicated logic**:

```ts
export function billingOrigin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; Stripe return URLs cannot be built.");

    return url.replace(/\/$/, "");
}
```

**Differences between the copies**: the function name, whether it is exported, and the second half of
the error message ("verification links cannot be built." / "Stripe return URLs cannot be built.").
The variable fallback, the guard and the trailing-slash strip are identical.

Both doc comments make the same argument in different words. `email.ts:28–30`: "`AUTH_URL` is
already the value NextAuth uses for its own callbacks, so reusing it keeps one source of truth for
'where this deployment lives'." `stripe.ts:55–58`: "it is already the deployment's canonical origin
for NextAuth's callbacks and for `lib/email.ts`'s links, and a second name for the same value is a
second thing to get wrong in production." The second one names the first file and then writes the
function out again.

A third site nearly exists and deliberately does not: `app/api/auth/verify-email/route.ts:34` builds
its origin from `request.url` instead, with a comment saying why ("this request *is* the click, so
its origin is…"). That is a decision, and it is the kind that gets easier to make correctly when
there is one function to decide against.

**Extract to**: `src/lib/app-origin.ts` — **new file**, 6 code lines:

```ts
import "server-only";

export function appOrigin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; absolute URLs cannot be built.");

    return url.replace(/\/$/, "");
}
```

**On the boundary rule**, because this is the one proposal in the report that has to argue its
placement. The rule is that anything reading a server `process.env` value belongs in `src/server/`,
not in client-reachable `lib/`. Three things put this in `lib/` anyway, and the choice should be
made deliberately rather than by default:

1. Both current homes are already `lib/` modules carrying `import "server-only"`, and so are
   `lib/r2.ts`, `lib/openai.ts` and `lib/rate-limit.ts` — five precedents, each with a doc comment
   stating the same reasoning ("the directive turns a mistaken client import into a build error
   rather than a leak"). This is an established, documented pattern in this codebase, not a lapse.
2. `AUTH_URL` is not a secret. It is the deployment's public origin, already visible in every link
   the app emits. The directive here is belt-and-braces rather than the thing standing between a key
   and a bundle.
3. `src/server/` is defined as "server-only queries, repositories, and view-model preparation", and
   **no module in `src/lib/` imports from `src/server/` today** (verified). Putting this there would
   open a new `lib/ → server/` dependency edge for an environment string, which is a larger
   architectural change than the finding is worth.

If the reviewer prefers the letter of the rule, `src/server/app-origin.ts` works and costs the same
lines; the import direction is the only thing that changes.

**Lines**: removed 10 (5 + 5) · added 8 (shared definition 6 + 0 call sites — `origin()` becomes
`appOrigin()` in place at three sites in `email.ts` and `billingOrigin()` becomes `appOrigin()` at
three sites in `actions/billing.ts` + 2 imports: one in `email.ts`, and one in `actions/billing.ts`
as `import { billingOrigin, stripe } from "@/lib/stripe";` splits in two) · **net +2** ·
comments moved 8 — the two rationale blocks (`email.ts:24–31`, `stripe.ts:52–59`) become one.

**Effort**: M — one new file, three files edited, and one test mock to fix (see Risk). No new test.

**Risk**: Low, with one thing to not miss. `server/billing.test.ts:58` mocks
`billingOrigin: () => "https://devstash.test"` as part of its `@/lib/stripe` mock — for a function
`server/billing.ts` never calls, so the line can simply be deleted; but if `actions/billing.ts`
gains a test later it will need to mock `@/lib/app-origin` rather than `@/lib/stripe`. Nothing else
covers either function: there is no `email.test.ts` and no `stripe.test.ts`. `npm run email:test`
and `npm run billing:test` exercise both paths against real services, and both should be run.

**Behaviour change**: One, and it is developer-facing only. The two error messages collapse into
one, so a deployment with no `AUTH_URL` throws "AUTH_URL is not set; absolute URLs cannot be built."
from both paths instead of naming which feature asked. The stack trace still names the caller, and
the fix is the same variable either way. If that is not acceptable, a `purpose: string` parameter
restores both messages at a cost of nothing in lines — it is left out because a parameter that
exists only to vary a clause of an error message is the kind of surface that outlives its reason.

**Why it's worth it**: two functions answer "where does this deployment live", and the fallback chain
is the part that can rot — `NEXTAUTH_URL` is the v4 name kept as a fallback, and the day it is
dropped it has to be dropped in two files or half the app's absolute URLs quietly stop resolving in
an environment that still sets only the old name. Email links and Stripe return URLs are also the
two things nobody tests locally, so a disagreement between them surfaces in production or not at all.

**Call-site after**:

```ts
const link = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
```

**Test**: `src/lib/app-origin.test.ts` — new, and worth it because this is currently untested logic
that only runs in production. Three cases: `AUTH_URL` wins over `NEXTAUTH_URL`; `NEXTAUTH_URL` is
used when `AUTH_URL` is absent; a trailing slash is stripped exactly once, so
`https://x.test/` gives `https://x.test` and the interpolated `${appOrigin()}/settings` cannot
become `//settings`. The fourth case — neither variable set — asserts the throw.

---

### 7. `megabytes()` reinvents `formatFileSize` — Low

**Grade**: Low — a helper reinvented beside one that already exists, where the code has reasoned
about it in a comment and got the current answer right. Rubric clause: *something the code has
already reasoned about in a comment and got right, where the extraction is a mild improvement.*

**Sites** (1 definition, 1 use, 0 outside the scanned folder):

- src/lib/file-constraints.ts:99–102 — `megabytes()`, used once at :131

**The duplicated logic**:

```ts
/** Megabytes, for a message — the limits are whole megabytes by construction. */
function megabytes(bytes: number): number {
    return bytes / (1024 * 1024);
}

// ...used once:
return { valid: false, error: `Files must be ${megabytes(maxSize)} MB or smaller.` };
```

against `src/lib/format.ts:45–63`, which already turns a byte count into a display string with
binary units and one decimal place.

**Differences between the copies**: `formatFileSize` handles B / KB / MB / GB and drops the decimal
on whole numbers; `megabytes` divides and lets the template add "MB". For the two values that reach
it — `5 * 1024 * 1024` and `10 * 1024 * 1024` — both produce exactly "5 MB" and "10 MB", which
`format.test.ts:62–63` already asserts for the shared one.

The other half of the pair already does this correctly: `components/items/FileUpload.tsx:164`
renders the same `maxSize` with `formatFileSize(maxSize)` to say "up to 5 MB" in the field. So the
same number is already formatted two ways in the two places that show it to the same user.

**Extract to**: nothing new. `src/lib/format.ts` — existing module — already exports it; delete
`megabytes` and call `formatFileSize`. Both modules are pure and client-reachable, `format.ts`
imports nothing, so no cycle and no boundary issue.

```ts
export function formatFileSize(bytes: number): string; // already exists
```

**Lines**: removed 3 · added 1 (shared definition 0 — it already exists + 0 call sites, the template
changes in place + 1 import, since `file-constraints.ts` currently imports nothing) · **net +2** ·
comments removed 1 (the `megabytes` doc line, which has nothing left to describe).

**Effort**: S — one file, three lines.

**Risk**: None today. `file-constraints.test.ts` asserts the rejection messages; if it asserts the
"5 MB" string it keeps passing unchanged, because the two functions agree on both current limits.

**Behaviour change**: None at the current limits, and a correction at any other. Today
`megabytes(5 * 1024 * 1024)` renders "5 MB". The moment a limit stops being a whole number of
megabytes — a 512 KB cap on a new type, say — the current code renders "Files must be 0.5 MB or
smaller." at best and "0.48828125 MB" at worst, while the upload field two inches away says
"512 KB". `formatFileSize` says "512 KB" on both.

**Why it's worth it**: the comment is the finding. "the limits are whole megabytes by construction"
is true, is load-bearing, and is enforced by nothing — it is a precondition on a private helper that
exists only because a public one that has no such precondition was not found. `lib/` has 32 modules
and `format.ts` is where byte formatting lives; this is the reinvention the folder's playbook warns
about, caught small.

**Call-site after**:

```ts
return { valid: false, error: `Files must be ${formatFileSize(maxSize)} or smaller.` };
```

**Test**: not needed — `format.test.ts:47–68` already covers `formatFileSize` across bytes, KB, MB
and GB, including both values this call site passes it.

---

### 9. `IMAGE_EXTENSIONS` restates the upload allow-list — Low

**Grade**: Low — real duplication of a list with a zero net saving, where the divergence it risks is
a silent degradation rather than a bug. Rubric clause: *real duplication with a small or negative net
saving and no invariant behind it.*

**Sites** (2, 0 outside the scanned folder):

- src/lib/file-preview.ts:50 — `IMAGE_EXTENSIONS`
- src/lib/file-constraints.ts:59 — `FILE_CONSTRAINTS.image.extensions`

**The duplicated logic**:

```ts
// file-preview.ts:50
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

// file-constraints.ts:59
extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
```

**Differences between the copies**: `.svg`, and the difference is deliberate and documented —
`file-preview.ts:52–58` says "Every uploadable image extension except `.svg`, which the gallery and
the drawer both have to exclude for the reason `isInlineDisposition` gives". So the second list is
already defined, in prose, as a derivation of the first.

**Extract to**: nothing new. `src/lib/file-constraints.ts` — existing module — already owns the
allow-list, and `file-preview.ts:1` already imports `extensionOf` from it. 1 code line, in place:

```ts
const IMAGE_EXTENSIONS: readonly string[] = FILE_CONSTRAINTS.image.extensions.filter(
    (extension) => extension !== ".svg",
);
```

(Written across three lines by the formatter; counted as the one logical line it replaces, plus two
wrap lines — see below.)

**Lines**: removed 1 · added 1 (shared definition 0 — the source list already exists + 1 call site +
0 imports, since `file-preview.ts` already imports from that module) · **net 0** · comments moved 0.
The formatter will wrap the replacement across three physical lines; counted as one, because the
line it replaces is one and the wrapping is not code.

**Effort**: S — one file, one declaration.

**Risk**: Low. `file-preview.test.ts` exists and covers `isRenderableImage`, `filePreviewFor` and
`isInlineDisposition`, so a filter that excluded the wrong entry fails it immediately. The one thing
to check is the type: `FILE_CONSTRAINTS` is `as const`, so `.filter` on
`readonly [".png", …]` returns `string[]` and the annotation above keeps `includes()` accepting an
arbitrary string.

**Behaviour change**: None — the filter produces the same five entries in the same order.

**Why it's worth it**: adding an image format is one line in `FILE_CONSTRAINTS` and the product
half-works. `.avif` becomes uploadable, and then `isRenderableImage` says no, so the gallery draws
no thumbnail, the drawer offers a name and a size instead of the picture, and
`isInlineDisposition` serves it as an attachment — three silent degradations from one edit that
looked complete, with nothing failing anywhere. Deriving the list makes `.svg` the only exception,
which is what the comment already says it is.

**Call-site after**: unchanged — `isRenderableImage` and `isInlineDisposition` read the same name.

**Test**: not needed as a new file. `file-preview.test.ts` already covers both readers of this list;
if a case is added, the one worth pinning is that `.svg` is *not* a renderable image while being a
permitted upload, which is the whole reason the two lists differ.

---

## Considered and rejected

### `src/server/`

- **`const userId = await getCurrentUserId();`, in nine query functions.** One line, no branch, and
  it is the authentication boundary — the same reason `REFACTOR_ACTIONS.md` rejected it on the write
  side. Wrapping it hides the one call every user-scoped read must make.
- **`where: { userId }` and the `count({ where: { userId } })` pairs.** `prisma.item.count` and
  `prisma.collection.count` with that same `where` appear seven times across `items.ts`,
  `collections.ts` and `profile.ts`. Each is one line, and a named helper would be longer than the
  expression it replaces. The user scoping is not at risk of drifting — it is one identifier.
- **`getProfile` / `getAccountSettings`'s shared preamble** (`profile.ts:21–35`, `:60–73`). Two
  sites of "user row + two counts + fail if the row is gone", and the second one's comment already
  cross-references the first ("Same reasoning as `getProfile`"). Rejected on arithmetic: the two
  `select`s differ, `getProfile` adds `getItemTypeCounts` to the same `Promise.all`, and a
  `getContentTotals(userId)` helper costs 8 lines to save 6. The three-line not-found guard is the
  only verbatim part, and a `requireAccount()` wrapper for it nets zero.
- **`stripe().subscriptions.list({ customer, status: "all", limit })`** — `billing.ts:71–75`,
  `:220–224`, `:267–269`. Three sites and the `status: "all"` is genuinely load-bearing (the
  cancelled and past-due rows are the ones `hasBillableSubscription` reasons about), but `limit`
  differs (10, 10, 100) and one call is wrapped in `forgiving()` while two are not. A helper taking
  a limit and a forgiveness flag is the two-flag shape that is worse than the copies. Finding 3
  takes the part of these three functions that genuinely is the same.
- **`orderBy: [{ isPinned: "desc" }, { editedAt: "desc" }, { id: "desc" }]`** — `items.ts:282`,
  `collections.ts:252`. One line, twice, and it is a real rule (a total order is what makes
  `skip`/`take` mean anything). Rejected because the two comments above it explain *different*
  halves — `items.ts:275–281` the in-query-versus-in-memory sort, `collections.ts:250–251` the
  cross-reference — and a named constant would separate each from its reasoning to save one line.
  The two neighbouring orderings (`getFavoriteItems`, `getSearchData`) are deliberately different,
  so there is no single "item order" to name.
- **The view-model builders in `view-models.ts` with similar field lists.** Out of scope by the
  brief, and correctly so: the repetition is the type safety. Finding 5 is not this — it is one
  computation with a branch, written three times, that two of the three get subtly differently.
- **`ITEM_SUMMARY_SELECT` versus `ITEM_DETAIL_SELECT`** (`items.ts:34–65`). Already composed —
  the detail select spreads the summary one. Nothing to do.
- **`SIDEBAR_COLLECTION_SELECT` versus `COLLECTION_SELECT`.** Also already composed where it counts:
  `getFavoriteCollections` builds `{ ...SIDEBAR_COLLECTION_SELECT, updatedAt: true }`. Only the item
  join is restated, which is finding 8.
- **`getItemTypesById`'s `OR: [{ userId: null }, { userId }]` against
  `getItemTypeCounts`'s `where: { userId: null }`.** They look like the same scoping and are not:
  one is "types this user can see", the other is "system types only", and `item-types.ts:51–55`
  explains at length why conflating them would let a custom type shadow a system one. Finding 6
  shares the `select` between them and leaves the two `where`s alone, deliberately.
- **Duplication in `*.test.ts`.** `billing.test.ts` and `items.test.ts` both build in-memory
  stand-ins, but for different clients (Stripe / Prisma) with different matchers. Out of scope, and
  correct as it stands.

### `src/lib/`

- **The lazy-client singleton**, in `stripe.ts:35–50`, `openai.ts:26–46`, `r2.ts:29–53`,
  `email.ts:12–22` and `rate-limit.ts:135–164`. Five sites of `let client = null; if (client) return
  client; read env; throw if absent; construct; return`. The nearest thing to a High-count finding in
  this folder, and it is not one: what varies is every part that matters — one, three, or two
  environment variables, five different error messages, three different constructor option objects,
  and `redisClient()` returns `null` instead of throwing because absent credentials are its normal
  state. A `lazy(create)` factory saves about two lines each and hides the only thing each function
  is actually doing. The five doc comments already cross-reference one another correctly.
- **The four prompt builders** — `buildTagInput`, `buildDescriptionInput`, `buildExplainInput`,
  `buildOptimizeInput`. They share a `parts` array and a `join("\n\n")`, and nothing else: the field
  lists differ per feature (tags reads three, description six, explain four, optimize two), three
  open with `Item type:` and one does not, one wraps its body in injection delimiters, three end
  with a "return this as JSON" line and one deliberately does not. A shared builder taking a field
  list and four flags is exactly the abstraction the brief says to name and skip. Each file
  documents its own differences.
- **The three `parse*` bound checks** — `ai-description.ts:141`, `ai-explain.ts:202`,
  `ai-optimize.ts:231`, all `if (x === "" || x.length > MAX) return null;`. One line each, and the
  normalization immediately above them differs in every case (collapse whitespace / trim / trim and
  preserve newlines). A `boundedText()` helper is 4 lines to remove 3.
- **The "the input must contain the word json" rule**, explained at length three times
  (`ai-tags.ts:59–67`, `ai-description.ts:84–92`, referenced at `ai-optimize.ts:151–154`). This is a
  genuine trap — the API answers 400 on *every* call if the word is missing — but it is a repeated
  *paragraph*, not repeated code: the three sentences that satisfy it are different sentences. The
  only real fix is enforcement at the point where `text.format: { type: "json_object" }` is set,
  which is in `actions/ai.ts`, outside this folder, and would need a new abstraction rather than an
  extraction. Recorded so the next scan does not re-derive it.
- **`blankToNull` / `optionalText`, in both `item-schemas.ts` and `collection-schemas.ts`.** Out of
  scope by the brief, and `collection-schemas.ts:22–28` has already made the argument: "Same two
  lines as `item-schemas.ts`, which is a copy worth making: extracting them would couple two
  otherwise independent contracts through a shared module." Agreed.
- **`CODE_LANGUAGE_BY_EXTENSION` (`file-preview.ts:38–48`) against `LANGUAGE_ALIASES`
  (`code-language.ts:12–27`).** They overlap on `yml → yaml` and look like one table. They are two:
  one maps a *file extension* to a viewer language and includes `.toml → ini` and
  `.csv → plaintext`, which are viewer choices; the other maps *free text a user typed* into a
  monaco id. `code-language.ts:41–46` already explains why its two tables live together and what
  invariant binds them, and it is not this one.
- **`itemSortFields` / `collectionSortFields` (`favorites-sort.ts:175–192`).** Two near-identical
  four-field projections, and the module's own doc comment (:16–19) has already argued the case:
  "Rather than a generic constrained on fields they do not share, each shape projects to
  `FavoriteSortFields` and the comparator sees only that." Correct as it stands.
- **`getFirstName` and `getInitials` (`format.ts:32–36`, `:66–74`)** both do
  `name.trim().split(/\s+/).filter(Boolean)`. One line, twice, in the same file, and each then does
  something entirely different with it. Below the bar.
- **`extensionOf` (`file-constraints.ts:95–97`) against `buildObjectKey`'s
  `fileName.match(/\.[a-z0-9]+$/i)` (`r2.ts:84`).** Two extension parses with different regexes, and
  the difference is deliberate: `r2.ts` keeps the extension only so an object is recognizable in the
  Cloudflare dashboard, and constrains it to `[a-z0-9]` precisely because that value goes into an
  object key. `extensionOf` accepts anything after the last dot, which is right for validation and
  wrong for a key. Merging them would widen what can appear in a key.
- **`type-color-vars.ts`, `limits.ts`, `markdown-plugins.ts`, `pagination.ts`, `fuzzy-search.ts`,
  `auth-redirects.ts`, `auth-errors.ts`, `editor-metrics.ts`, `editor-preferences.ts`,
  `clipboard.ts`, `utils.ts`.** Read in full; each is a single-purpose module with no internal
  duplication and no reinvention of anything else in the folder. `editor-metrics.ts` reads all four
  of its numbers from `config/editor.ts`; `type-color-vars.ts` derives the whole palette from
  `config/item-type-catalog.ts`; `limits.ts` routes every gate through `ENFORCE_PRO_LIMITS`. Nothing
  to do.
- **Hard-coded item-type colours, icons, routes, or Pro gating anywhere in either folder.** Checked
  and clean. `config/item-type-catalog.ts` is read by `lib/type-color-vars.ts`,
  `lib/item-schemas.ts`, `lib/ai-explain.ts`, `server/view-models.ts`, `server/item-types.ts` and
  `server/items.ts`; no literal colour, slug, label or `isPro` flag is restated in either folder.

---

## Summary

**+32 net code lines across 10 findings — High +24 (2), Medium +6 (4), Low +2 (4).**
By folder: `src/server/` +16 across 6, `src/lib/` +16 across 4.

Recommended order, cheapest and safest first:

1. **Finding 2** (`AI_PAYLOAD_LIMIT`) — the largest saving tied, zero risk, five mechanical edits,
   and the one whose cost grows the moment the fifth AI feature lands.
2. **Finding 1** (`toItemSummaries`) — the largest in-folder saving, fully covered by existing tests,
   three files.
3. **Finding 3** (`customerIdFor`) — one file, +4, and `billing.test.ts` already asserts both
   branches. Run `npm run billing:test` either side of it regardless.
4. **Findings 8 and 5 together** — both edit `collections.ts`'s selects and the two functions that
   read them; doing them separately means reading the same file twice. Answer finding 5's throw
   question first, and give it its own commit because it is the only Medium-risk item here.
5. **Finding 6** (`findSystemItemType`) — costs two lines, closes the one genuine correctness trap
   in either folder, and crosses into `actions/items.ts`. Worth doing before custom item types.
6. **Finding 4** (`appOrigin`) — needs a placement decision and a new test; do it in one commit with
   both `npm run email:test` and `npm run billing:test`.
7. **Findings 7, 9, 10** — opportunistic, next time anyone is in `file-constraints.ts`,
   `file-preview.ts` or `collections.ts`.

**Assessment.** Both folders are in good order and for the same reason: they are heavily commented by
someone who noticed the duplication at the time. That shows up in what this scan actually found —
several of the strongest findings are places where a doc comment states a rule and then the code
next to it restates the rule instead of importing it. `server/collections.ts` says the sidebar select
"needs the same item joins as a card" and writes them again; `stripe.ts` says a second name for the
deployment origin is "a second thing to get wrong in production" and defines a second function for
it; four AI modules each explain in the same paragraph why they hold the same number, and their one
consumer takes the minimum of all four.

Nothing here is an authorization or ownership problem. Ownership scoping in `src/server/` is in the
`where` clause everywhere it should be, `getItemDetail` and `getItemFile` both document the
indistinguishability property they rely on, and no query reads an item body into a list. The one
correctness-shaped finding is number 6, and both of its copies are currently right — it is worth
doing because Phase 7's custom item types are what make a third copy dangerous, not because
anything is broken today. `src/lib/` is the tidier of the two: 32 modules, one reinvented helper
(finding 7), one restated list (finding 9), and one function that exists twice (finding 4).
