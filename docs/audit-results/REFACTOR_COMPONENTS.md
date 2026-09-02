# REFACTOR_COMPONENTS

> **Audit record — `refactor-scanner` agent output, 2026-08-31. Not maintained.**
> A point-in-time scan proposing extractions; it never edited anything. Some proposals have since
> been applied, some deliberately declined, and nothing re-checks which. Re-run the agent rather
> than working from the list below.

Scanned `src/components/` — 86 `.tsx` files across 11 subfolders (82 components, 4 co-located
tests; no `.ts` files). Read for extraction targets: `src/lib/`, `src/hooks/`, `src/config/`,
`src/types/`, `src/server/`, and `src/components/ui/`.

**D** = duplication, **S** = split.

| # | Finding | Kind | Grade | Sites | Net lines | Effort | Risk |
|---|---------|------|-------|-------|-----------|--------|------|
| 1 | The auth labelled-field-with-error block, nine copies | D | High | 9 | +38 | M | Medium |
| 2 | The Pinned / Favorite badge pair | D | High | 4 | +35 | S | Low |
| 3 | The `invalid()` aria-props helper, five copies | D | High | 5 | +10 | S | Low |
| 4 | `ExplainButton` and `OptimizeButton` are one button | D | Medium | 2 | +21 | M | Low |
| 5 | Monaco surface colours hard-coded beside the catalog that declares them | D | Medium | 2 | 0 | S | None |
| 6 | The Pro price sentence, written out twice | D | Medium | 2 | −3 | S | None |
| 7 | The optimistic favourite / pin toggle | D | Medium | 3 | −6 | M | Low |
| 8 | The editor header `Tab`, defined twice verbatim | D | Low | 2 | +9 | S | None |
| 9 | The sidebar nav row class string | D | Low | 3 | +7 | S | None |
| 10 | `typeForPath` reinvents `getItemTypeNameBySlug` | D | Low | 2 | +2 | S | Low |
| 11 | The 81-line monaco theme block inside `CodeEditor` | S | Low | 1 | −3 | S | Low |
| 12 | `FilePreview` inside `ItemDrawer` | S | Low | 1 | −5 | S | None |

**Totals**: +105 net code lines across 12 findings — High +83 (3), Medium +12 (4), Low +10 (5).

---

### 1. The auth labelled-field-with-error block, nine copies — High

**Grade**: High — nine call sites, and the destination is unmistakable (`components/ui/`, beside the
`Field` that already does exactly this job for the item forms). Rubric clause: *four or more call
sites, where the destination already exists or is unmistakable.*

**Sites** (9, 0 outside the scanned folder):

- src/components/auth/SignInForm.tsx:26–49 (email)
- src/components/auth/SignInForm.tsx:51–77 (password — carries a "Forgot password?" link on the label row)
- src/components/auth/RegisterForm.tsx:104–125 (inside the `FIELDS.map`)
- src/components/auth/ResetPasswordForm.tsx:82–98
- src/components/auth/ResetPasswordForm.tsx:100–118
- src/components/settings/ChangePasswordDialog.tsx:94–112
- src/components/settings/ChangePasswordDialog.tsx:114–130
- src/components/settings/ChangePasswordDialog.tsx:132–150
- src/components/settings/DeleteAccountDialog.tsx:133–156

**The duplicated logic**:

```tsx
<div className="space-y-1.5">
    <label htmlFor="password" className="text-sm font-medium">
        New password
    </label>
    <PasswordInput
        id="password"
        name="password"
        autoComplete="new-password"
        aria-invalid={fieldErrors.password ? true : undefined}
        aria-describedby={fieldErrors.password ? "password-error" : undefined}
    />
    {fieldErrors.password && (
        <p id="password-error" className="text-sm text-destructive">
            {fieldErrors.password[0]}
        </p>
    )}
</div>
```

**Differences between the copies**: the label text and the input's `id` / `name` / `autoComplete`
(all stay at the call site); the error's type — `string[]` in `RegisterForm` and
`ResetPasswordForm` (`fieldErrors.password[0]`) versus `string` in `SignInForm`,
`ChangePasswordDialog` and `DeleteAccountDialog` (`state.fields?.password`); `SignInForm`'s
`aria-invalid` additionally ORs `state.error`, because a rejected credential marks both fields;
`SignInForm`'s password label row carries a link and `DeleteAccountDialog`'s label carries a
`<span className="font-mono">`. The first becomes the caller's expression, the second stays at the
call site as it is today, the last two become `action` and a `ReactNode` label.

That the error type disagrees across the nine is the evidence they were written independently.

**Extract to**: `src/components/ui/AuthField.tsx` — new file. Deliberately *not* a variant of the
existing `ui/Field.tsx`: that one styles its label `text-xs font-medium text-muted-foreground` and
offers a `hint`, which is the item-form shape; these are `text-sm font-medium` with no hint. Two
small components beat one with a `size` prop.

```tsx
export function AuthField(props: {
    id: string;
    label: React.ReactNode;
    error?: string;
    /** A control on the label's row — the sign-in password field's "Forgot password?" link. */
    action?: React.ReactNode;
    children: React.ReactNode;
}): React.ReactElement
```

**Lines**: removed 120 · added 82 (shared definition 30 + 9 call sites 47 + 5 imports) · **net +38**
· comments moved 0 (the four comment lines at SignInForm:35–36 and 39–40 stay at the call site;
they are about `key`/`defaultValue` and about the shared `aria-invalid`, not about the wrapper).

**Effort**: M — one new `ui/` file plus edits in 5 files across `auth/` and `settings/`. No test
(see below).

**Risk**: Medium — nothing in `npm test` renders any of these nine; there is no test file under
`components/auth/` or `components/settings/` at all, so the only check is `npm run build` plus
clicking the four auth flows. That is exactly the multi-step end-to-end case
`context/ai-interaction.md` names as worth driving the browser for.

**Behaviour change**: one, and it must be decided before this lands. `AuthField` renders the
label inside a `flex items-baseline justify-between` row so that `action` has somewhere to sit —
which is `SignInForm`'s password markup, applied to all nine. For the eight fields with no action
that is one extra `<div>` in the DOM and no visual change (a single flex child at
`justify-between` sits at the start). If that is not acceptable, render the row only when `action`
is present, at a cost of 3 lines in the shared definition.

**Why it's worth it**: the `id` on the input and the `id` on the `<p>` have to match, in nine
places, with nothing checking that they do. A mismatch is silent — the field still renders, the
message still shows, and only a screen reader notices the two are no longer connected. This is the
same argument `ui/Field.tsx`'s own doc comment already makes for the item forms; the auth forms
were simply never brought under it.

**Call-site after**:

```tsx
<AuthField id="password" label="New password" error={fieldErrors.password?.[0]}>
    <PasswordInput id="password" name="password" autoComplete="new-password"
        {...invalidProps("password", fieldErrors.password?.[0])} />
</AuthField>
```

**Test**: not needed — the component is markup with one conditional, and there is no test
infrastructure for rendering components in this repo. The `invalidProps` half it composes with does
get one; see finding 3.

---

### 2. The Pinned / Favorite badge pair — High

**Grade**: High — four call sites, verbatim, and the destination is unmistakable. Rubric clause:
*four or more call sites, where the destination already exists or is unmistakable.*

**Sites** (4, 0 outside the scanned folder):

- src/components/items/ItemCard.tsx:63–80 (both badges)
- src/components/items/ImageCard.tsx:57–74 (both badges)
- src/components/items/FileRow.tsx:56–73 (both badges)
- src/components/collections/CollectionCard.tsx:30–38 (the star only)

**The duplicated logic**:

```tsx
{item.isPinned && (
    <>
        <Pin className="size-3.5 shrink-0 fill-sky-400 text-sky-400" aria-hidden="true" />
        <span className="sr-only">Pinned</span>
    </>
)}
{item.isFavorite && (
    <>
        <Star className="size-3.5 shrink-0 fill-favorite text-favorite" aria-hidden="true" />
        <span className="sr-only">Favorite</span>
    </>
)}
```

**Differences between the copies**: none in the three item components — byte-identical, including
the `sr-only` wording. `CollectionCard` renders the star half only, with the same classes and the
same `sr-only` text.

**Extract to**: `src/components/ui/StatusBadges.tsx` — new file. `ui/` rather than `items/` because
`CollectionCard` is one of the four callers, and the fill rule these implement is stated as an
app-wide rule in `CollectionActions.tsx:94–110`.

```tsx
export function FavoriteBadge(props: { label?: string }): React.ReactElement
export function PinnedBadge(): React.ReactElement
```

`label` exists for one caller outside this finding: `app/(dashboard)/collections/[id]/page.tsx:47–51`
draws the same star at `size-4` with `sr-only` text "Favorite collection". That site is outside the
scanned folder and outside this proposal — it also differs in size — but it is why the prop is there
rather than hard-coded.

**Lines**: removed 63 (54 for the three pairs, 9 for `CollectionCard`'s star) · added 28 (shared
definition 17 + 7 call-site lines + 4 imports) · **net +35** · comments moved 0. Three of the four
files additionally shed a now-unused `lucide-react` import line; not counted as a saving.

**Effort**: S — one new file, four mechanical edits, no signature anyone depends on.

**Risk**: Low — pure markup with no state. `ItemCard`, `ImageCard` and `FileRow` are server
components and stay server components: `StatusBadges.tsx` carries no `"use client"` and uses no
hooks, so nothing is pushed across the boundary.

**Behaviour change**: None.

**Why it's worth it**: `CollectionActions.tsx:94–110` records a rule the whole app is supposed to
follow — *a filled star asserts that this particular thing is favourited; an outline star is the
word "favourites" as a place*. That comment also records that the rule was got wrong once and
revised. Four hand-written copies of the badge is precisely the shape in which it gets got wrong
again: retuning `--favorite`, or changing `fill-sky-400` for the pin, currently means finding three
files by grep.

**Call-site after**:

```tsx
{item.isPinned && <PinnedBadge />}
{item.isFavorite && <FavoriteBadge />}
```

**Test**: not needed — two components with no branches and no logic beyond a default prop.

---

### 3. The `invalid()` aria-props helper, five copies — High

**Grade**: High — five call sites, and the destination already exists (`ui/Field.tsx` owns the
`${id}-error` contract these all derive by hand). Rubric clause: *four or more call sites, where
the destination already exists.*

**Sites** (5, 0 outside the scanned folder):

- src/components/items/ItemFormFields.tsx:73–75 (the generic form, already written)
- src/components/items/CreateItemDialog.tsx:198–201
- src/components/items/ItemEditForm.tsx:93–96
- src/components/collections/CreateCollectionDialog.tsx:86–89
- src/components/collections/EditCollectionDialog.tsx:86–92

**The duplicated logic**:

```ts
/** Points a rejected input at the message `Field` renders for it, as the item forms do. */
const invalid = (field: CreateCollectionField) =>
    fieldErrors[field]
        ? { "aria-invalid": true, "aria-describedby": `new-collection-${field}-error` }
        : undefined;
```

**Differences between the copies**: the field-name type parameter, and the id prefix
(`new-item-` / `item-` / `new-collection-` / `edit-collection-`). `ItemFormFields`' version is
already generic over the whole id and is the one the others should have been calling.
`EditCollectionDialog` spells the same object across seven lines rather than four — cosmetic, but
it is what four independent copies look like.

The doc comments are themselves the evidence: each one points at the others. "as the item forms
do" (CreateCollectionDialog:85), "as the auth forms do" (ItemEditForm:92), "as the edit form does"
(CreateItemDialog:197), "as the other forms do" (EditCollectionDialog:85). Four comments asserting
a convention is exactly the state `config/editor.ts` was written to end for the editor constants.

**Extract to**: `src/components/ui/Field.tsx` — existing module, two new exports.

```ts
export function invalidProps(
    id: string,
    error?: string,
): { "aria-invalid": true; "aria-describedby": string } | undefined

export function invalidFor<F extends string>(
    prefix: string,
    errors: Partial<Record<F, string>>,
): (field: F) => ReturnType<typeof invalidProps>
```

`ui/Field.tsx` is the right home and not a boundary problem: it is a pure presentational module
with no `"use client"`, no Prisma, no `process.env`, imported by client and server components
alike.

**Lines**: removed 22 (4 + 4 + 4 + 7 + 3) · added 12 (shared definition 8 + 4 call sites 4 +
0 imports) · **net +10** · comments moved 5 — four near-identical one-liners collapse into the
shared definition's own doc.

All five files already import from `@/components/ui/Field`, so every import is a name added to an
existing line and no file gains one.

**Effort**: S — one existing module gains two functions, five mechanical edits.

**Risk**: Low — the failure mode is invisible rather than loud, which is what the test is for.

**Behaviour change**: None. `invalidFor(prefix, errors)(field)` produces the same object and the
same `${prefix}-${field}-error` string each copy produces today.

**Why it's worth it**: there are two different derivations of one id in the same folder.
`ui/Field.tsx:42` renders `<p id={`${id}-error`}>` from the input's full id; the four form helpers
rebuild that string as `` `${prefix}-${field}-error` `` from two halves. They agree only because
every call site happens to pass `id={`${prefix}-${field}`}` to the `<Field>` as well. Change one
prefix in one place — rename `new-item-` — and the `aria-describedby` points at an element that
does not exist, with no error, no warning, and no test.

**Call-site after**:

```ts
const invalid = invalidFor<CreateCollectionField>("new-collection", fieldErrors);
```

**Test**: `src/components/ui/Field.test.ts` — new. Cover the three branches that matter:
`invalidProps` returns `undefined` for no error (so the attribute is absent, not `false`); it
returns `aria-describedby` matching exactly the id `Field` renders for the same input; and
`invalidFor` composes prefix and field in that order. The third is the one that would have caught
a renamed prefix.

---

### 4. `ExplainButton` and `OptimizeButton` are one button — Medium

**Grade**: Medium — two sites of real logic (an entitlement branch, a three-way icon state, a label
ordering rule), identical today, where drift costs maintenance rather than correctness. Rubric
clause: *two or three sites of real logic, identical today.*

**Sites** (2, 0 outside the scanned folder):

- src/components/items/CodeEditor.tsx:520–581 (`ExplainButton`)
- src/components/items/MarkdownEditor.tsx:341–391 (`OptimizeButton`)

**The duplicated logic**:

```tsx
const label = canExplain
    ? hasExplanation
        ? "Explain this code with AI again"
        : "Explain this code with AI"
    : "AI features require Pro subscription";

return (
    <Button
        type="button" variant="ghost" size="sm"
        onClick={onClick}
        disabled={!canExplain || isExplaining}
        aria-label={label}
        title={label}
        className="-my-1 h-7 gap-1.5 px-2 text-xs hover:bg-white/10 dark:hover:bg-white/10"
    >
        {!canExplain ? (
            <Crown className="size-3.5" aria-hidden="true" />
        ) : isExplaining ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
            <MessageSquareText className="size-3.5" aria-hidden="true" />
        )}
        <span>{isExplaining ? "Explaining…" : "Explain"}</span>
    </Button>
);
```

**Differences between the copies**: the icon (`MessageSquareText` / `Sparkles`), the verb
("Explain" / "Optimize"), the pending verb ("Explaining…" / "Optimizing…"), and the label's subject
("this code" / "this prompt"). Four values. The className, the disabled rule, the Crown/spinner/icon
ordering, the "…again" suffix rule and the Pro refusal sentence are byte-identical.

**Extract to**: `src/components/items/EditorAiButton.tsx` — new file. `items/` rather than `ui/`:
both callers are in `items/`, and this button is specific to the editor chrome's hard-coded monaco
surface — the long comment at `CodeEditor.tsx:552–568` explains why its hover is a white alpha
rather than a theme token, which makes it wrong for `ui/`.

```tsx
export function EditorAiButton(props: {
    icon: LucideIcon;
    /** The word on the button — "Explain", "Optimize". */
    verb: string;
    /** What it says while running — "Explaining…". */
    pendingVerb: string;
    /** Completes the accessible label: `${verb} ${subject} with AI`. */
    subject: string;
    canUse: boolean;
    isPending: boolean;
    hasResult: boolean;
    onClick: () => void;
}): React.ReactElement
```

**Lines**: removed 76 (38 + 38) · added 55 (shared definition 47 + 2 call sites 6 + 2 imports) ·
**net +21** · comments moved 35 — the long notes on the white-alpha hover, the icon-weight rule and
the Crown decision all move to the shared module, where they stop being written twice.

**Effort**: M — one new file, two files edited, no test (see below).

**Risk**: Low — both call sites are already the same shape (`<ExplainButton canExplain=… isExplaining=…
hasExplanation=… onClick=… />`), so this is a rename of four props plus four new literals.
`MarkdownEditor.test.tsx` exists and does not touch this button; nothing else does either.

**Behaviour change**: None. `` `${verb} ${subject} with AI${hasResult ? " again" : ""}` ``
reproduces all four current label strings exactly.

**Why it's worth it**: the two files already tell each other to stay in step and cannot enforce it.
`MarkdownEditor.tsx:373–378` says "See the long note on `ExplainButton`'s className, which this
matches to the digit so the two AI buttons in the two editors light up by the same amount."
`CodeEditor.tsx:490–492` says the same in the other direction, and points at a *third* button
(`SuggestButton` in `ItemFormFields.tsx:97–127`) it also matches. That third one is deliberately
not part of this proposal — see *Considered and rejected* — but two of the three being one
definition is what makes the third's difference a decision rather than an accident.

**Call-site after**:

```tsx
<EditorAiButton icon={MessageSquareText} verb="Explain" pendingVerb="Explaining…"
    subject="this code" canUse={canExplain} isPending={isExplaining}
    hasResult={explanation !== null} onClick={requestExplanation} />
```

**Test**: not needed for the markup. If one is written, the branch worth pinning is the label:
`canUse === false` must produce "AI features require Pro subscription" and never the verb, because
that string is what tells a free account why the control is inert.

---

### 5. Monaco surface colours hard-coded beside the catalog that declares them — Medium

**Grade**: Medium — a High-shaped invariant (a mismatch renders a visible seam between the editor's
frame and its body) that the code has already reasoned about in a comment and got right, with a
zero net. Rubric: *something the code has already reasoned about and got right, where the extraction
is a correction of the mechanism rather than of the output* — graded up from Low because a wrong
copy here is a rendering bug, not a mess.

**Sites** (2 constants, each written twice; 0 outside the scanned folder):

- src/components/items/CodeEditor.tsx:121–122 — `"#272822"`, against src/config/editor.ts:55
- src/components/items/CodeEditor.tsx:152–153 — `"#0d1117"`, against src/config/editor.ts:56

**The duplicated logic**:

```ts
// CodeEditor.tsx:120–122
colors: {
    "editor.background": "#272822",
    "editorGutter.background": "#272822",
```

```ts
// config/editor.ts:55
monokai: { label: "Monokai", surface: "#272822" },
```

**Differences between the copies**: none — the same six hex digits. The third theme,
`devstash-dark`, already does this correctly: `CodeEditor.tsx:90–91` reads `EDITOR_SURFACE`, which
`config/editor.ts:54` also reads. Two of the three registered themes were simply not brought
under the same rule.

**Extract to**: `src/config/editor.ts` — existing module, already the single source of truth. No new
export needed; `EDITOR_THEME_CATALOG` is already imported by `CodeEditor.tsx:14`.

```ts
"editor.background": EDITOR_THEME_CATALOG.monokai.surface,
"editorGutter.background": EDITOR_THEME_CATALOG.monokai.surface,
```

**Lines**: removed 4 · added 4 (shared definition 0 — it already exists + 4 call sites + 0 imports)
· **net 0** · comments moved 0.

**Effort**: S — four lines in one file.

**Risk**: None — a literal is replaced by a constant that already holds that literal.

**Behaviour change**: None today, by construction.

**Why it's worth it**: `CodeEditor.tsx:77–78` states the invariant and then leaves it to a comment:
"Backgrounds are duplicated in `EDITOR_THEME_CATALOG` as `surface`, which is what the frame around
the editor is painted with — **the two must agree**." What happens when they stop agreeing is
visible and confusing: the header band and the border around the editor stay one colour while the
editor body is another, on one theme only, for whoever has that theme selected. This is the same
argument `config/editor.ts:9–20` makes for its own existence — "They used to hold their own copies
of these three values, kept in step by comments in each file saying the other one had the same
number. That is a convention, not a constraint; this is the constraint." Two of the five theme
surfaces never made it across.

**Call-site after**: as shown above.

**Test**: not needed — after this edit there is one definition, so there is nothing left to assert
agreement between. That is the point.

---

### 6. The Pro price sentence, written out twice — Medium

**Grade**: Medium — a repeated user-facing string that restates three values `config/marketing.ts`
already owns. Rubric clause: *a repeated user-facing string.*

**Sites** (2, 0 outside the scanned folder):

- src/components/items/ProTypeUpgrade.tsx:85
- src/components/settings/BillingPanelRows.tsx:224

**The duplicated logic**:

```
$8 a month, or $72 a year — save 25%. Cancel any time.
```

**Differences between the copies**: `BillingPanelRows` prefixes it with "Upgrade for unlimited items
and collections, file and image uploads, AI features, and export. "; `ProTypeUpgrade` renders it
alone. The 54 characters quoted above are identical.

**Extract to**: `src/config/marketing.ts` — existing module, which already holds `$8` and `$72`
(`PRICING_PLANS[1].price`) and `"Save 25%"` (`BILLING_CYCLES[1].badge`).

```ts
/** The plan summary in prose, for the surfaces that state the price without rendering a card. */
export const PRO_PRICE_SUMMARY = "$8 a month, or $72 a year — save 25%. Cancel any time.";
```

**Lines**: removed 2 · added 5 (shared definition 1 + 2 call sites 2 + 2 imports) · **net −3** ·
comments moved 0. The extraction costs three lines; the argument is the drift, not the saving.

**Effort**: S — one constant, two edits.

**Risk**: None.

**Behaviour change**: None.

**Why it's worth it**: three numbers — 8, 72, and 25% — are already configuration, and these two
prose lines restate all three where nothing can see them. A price change means editing
`PRICING_PLANS`, and the pricing cards on `/welcome` and `/upgrade` update while the locked
file-type page and the settings billing row keep quoting the old price at the same user. Note that
`config/marketing.ts` already carries the yearly saving in two forms (`"Save 25%"` on the badge,
`"$24 less than monthly"` in the yearly note), so a stricter version of this — deriving the
percentage — is available and deliberately not proposed: it would turn a copy string into arithmetic
for no gain.

**Call-site after**:

```tsx
<p className="text-sm text-muted-foreground">{PRO_PRICE_SUMMARY}</p>
```

**Test**: not needed — a string constant with no branches.

---

### 7. The optimistic favourite / pin toggle — Medium

**Grade**: Medium — three sites of real logic, identical today, whose extraction *adds* lines. The
invariant carries it, not the count. Rubric clause: *two or three sites of real logic, identical
today, where drift costs maintenance.*

**Sites** (3, 0 outside the scanned folder):

- src/components/collections/CollectionActions.tsx:52, 62–63, 65–88 (collection favourite)
- src/components/items/ItemDrawer.tsx:47, 56, 232–258 (item favourite)
- src/components/items/ItemDrawer.tsx:57, 59, 260–284 (item pin)

**The duplicated logic**:

```tsx
const [isFavoriting, startFavoriting] = useTransition();
const [written, setWritten] = useState<boolean | null>(null);
const isFavorite = written ?? collection.isFavorite;

const favorite = () => {
    const next = !isFavorite;

    startFavoriting(async () => {
        const result = await toggleCollectionFavorite(collection.id, next);

        if (!result.success) {
            toast.error(result.error);

            return;
        }

        setWritten(result.data.isFavorite);
        toast.success(result.data.isFavorite ? "Added to favorites." : "Removed from favorites.");

        router.refresh();
    });
};
```

**Differences between the copies**: the action called (`toggleCollectionFavorite` /
`toggleItemFavorite` / `toggleItemPin`), the result field read (`isFavorite` / `isPinned`), the
fallback prop, and the two toast strings — which are byte-identical between the two favourite
copies ("Added to favorites." / "Removed from favorites.") and different only for the pin
("Pinned to the top." / "Unpinned."). Everything else, including the `written ?? prop` shape and
reading the new value from `result.data` rather than from `next`, is the same in all three.

**Extract to**: `src/hooks/use-optimistic-toggle.ts` — new file. `hooks/` is the right home and not
a boundary problem: it is client-side state over an action the caller passes in, so nothing
server-only crosses.

```ts
export function useOptimisticToggle<K extends string>(options: {
    /** Which boolean the action returns — "isFavorite", "isPinned". */
    field: K;
    /** The prop's value, used until this hook has written one of its own. */
    serverValue: boolean;
    toggle: (next: boolean) => Promise<
        { success: true; data: Record<K, boolean> } | { success: false; error: string }
    >;
    messages: { on: string; off: string };
}): { value: boolean; isPending: boolean; onToggle: () => void }
```

**Lines**: removed 52 (18 + 18 + 16) · added 58 (shared definition 38 + 3 call sites 18 +
2 imports) · **net −6** · comments moved 32 — including the whole of `ItemDrawer.tsx:48–55`, which
explains why neither `item` nor `detail` can hold this state on its own, and
`CollectionActions.tsx:54–61`, which explains the same thing in different words.

The `router.refresh()` comments (`CollectionActions.tsx:84–85`, `ItemDrawer.tsx:251–255` and
`276–281`) are *not* in that 32: each says something different about what refreshing does on that
particular surface, and they stay at the call site.

**Effort**: M — one new hook, its test, and three call sites in two files.

**Risk**: Low — neither `CollectionActions` nor `ItemDrawer` has a test, so the hook's own test is
the only coverage this gains. The one thing to get right in the port is that `serverValue` must be
read from `view` in `ItemDrawer` (the newer of `detail` and `item`), not from `item`.

**Behaviour change**: None, if `serverValue` is passed as an expression rather than captured — the
hook re-reads it each render exactly as `written ?? view.isFavorite` does today.

**Why it's worth it**: two things, and only one of them is the toast strings. The strings are the
visible half: two copies of "Added to favorites." with nothing keeping them identical, which is the
same problem `lib/clipboard.ts` was written to solve for the copy control ("the same action reached
two ways should not be able to start reporting itself two ways"). The invisible half is the rule
`CollectionActions.tsx:77–78` states: *"From what came back, not from `next`: the star follows the
row, so it cannot end up filled over a collection the write left alone."* All three copies get that
right today. A fourth toggle — the pin control the roadmap still owes the item card, or a collection
pin — is written by copying one of them, and `setWritten(next)` is the obvious and wrong thing to
write.

**Call-site after**:

```tsx
const { value: isFavorite, isPending: isFavoriting, onToggle: toggleFavorite } =
    useOptimisticToggle({
        field: "isFavorite",
        serverValue: view.isFavorite,
        toggle: (next) => toggleItemFavorite(itemId, next),
        messages: { on: "Added to favorites.", off: "Removed from favorites." },
    });
```

**Test**: `src/hooks/use-optimistic-toggle.test.ts` — new. Three branches worth pinning: a failed
result toasts the error and leaves `value` at the server value (it must not flip); a successful
result sets `value` from `result.data[field]` and **not** from `next`, which the test asserts by
returning the *opposite* boolean from a stubbed action; and `value` falls back to a changed
`serverValue` prop only while nothing has been written locally.

---

### 8. The editor header `Tab`, defined twice verbatim — Low

**Grade**: Low — real duplication with a small positive saving and no invariant behind it; a
repeated multi-class surface, which is the components playbook's own threshold, but only two sites
and only cosmetic drift. Rubric clause: *real duplication with a small net saving and no invariant.*

**Sites** (2, 0 outside the scanned folder):

- src/components/items/CodeEditor.tsx:476–486
- src/components/items/MarkdownEditor.tsx:393–403

**The duplicated logic**:

```tsx
/** A header tab: quiet until selected, and never loud — the content below it is the point. */
function Tab({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <TabsPrimitive.Trigger
            value={value}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
        >
            {children}
        </TabsPrimitive.Trigger>
    );
}
```

**Differences between the copies**: None. Identical to the character, doc comment included.

**Extract to**: `src/components/items/ContentTextarea.tsx` — existing module. That file already
owns exactly this role: it exports `EDITOR_PANEL` and `EDITOR_PANEL_BOUNDS`, the two other pieces
of furniture both editors share, and its doc comment names the reason ("so a note and a snippet do
not sit in one drawer with different furniture"). Both editors already import from it.

```tsx
export function Tab(props: { value: string; children: React.ReactNode }): React.ReactElement
```

**Lines**: removed 20 · added 11 (shared definition 10 + 0 call sites — both files already write
`<Tab value="code">` — + 1 import for `TabsPrimitive` in `ContentTextarea`) · **net +9** ·
comments moved 1 (two identical comment lines become one).

**Effort**: S — one existing module gains a component; two files each drop ten lines and add a name
to an import they already have.

**Risk**: None.

**Behaviour change**: None.

**Why it's worth it**: nine classes, five of them state-dependent, written twice. This is the
smallest of the findings and the easiest; it belongs in the same commit as finding 4, which touches
the same two files for the same reason.

**Call-site after**: unchanged — `<Tab value="code">Code</Tab>`.

**Test**: not needed — a class string and a slot.

---

### 9. The sidebar nav row class string — Low

**Grade**: Low — real duplication with a small saving, entirely inside one file, and nothing
depends on it. Rubric clause: *real duplication with a small net saving and no invariant behind it.*

**Sites** (3, all in one file, 0 outside the scanned folder):

- src/components/layout/SidebarNav.tsx:42–45 (the Favorites link)
- src/components/layout/SidebarNav.tsx:77–80 (each item-type link)
- src/components/layout/SidebarNav.tsx:237–240 (inside `CollectionLink`)

**The duplicated logic**:

```tsx
className={cn(
    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 hover:bg-sidebar-accent",
    active && "bg-sidebar-accent font-medium",
)}
```

**Differences between the copies**: only how "active" is spelled — `pathname === "/favorites"`,
`active` (a local const), and the `active` prop. The two class strings are identical in all three.

**Extract to**: `src/components/layout/SidebarNav.tsx` — the same file, two module-level constants
above the component. Deliberately *not* a shared component: `CollectionLink` at :217–248 already is
that component, and it renders its own `<li>`, which the Favorites link (not in a list) does not
want. Generalising it would mean adding a wrapper prop to serve three call sites — worse than the
three copies, which is the case the brief says to name and skip.

```ts
const SIDEBAR_ROW =
    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors pointer-coarse:py-3 hover:bg-sidebar-accent";
const SIDEBAR_ROW_ACTIVE = "bg-sidebar-accent font-medium";
```

**Lines**: removed 12 (3 × 4) · added 5 (shared definition 2 + 3 call sites 3 + 0 imports) ·
**net +7** · comments moved 0.

**Effort**: S — one file, three edits.

**Risk**: None.

**Behaviour change**: None.

**Why it's worth it**: `pointer-coarse:py-3` is a touch-target floor, and it is written three times
in one file. The next row added to this rail is written by copying whichever of the three the author
scrolled to; if that is the "View all collections" link at :175 — which is `pointer-coarse:py-3.5`,
not `py-3`, and is a fourth spelling already — the floor drifts by a pixel per row.

**Call-site after**:

```tsx
className={cn(SIDEBAR_ROW, pathname === "/favorites" && SIDEBAR_ROW_ACTIVE)}
```

**Test**: not needed — a class string.

---

### 10. `typeForPath` reinvents `getItemTypeNameBySlug` — Low

**Grade**: Low — a helper reinvented beside one that already exists, with a small saving and no
invariant currently at risk (a test pins the two sets equal). Rubric clause: *real duplication with
a small net saving.*

**Sites** (2, 1 outside the scanned folder):

- src/components/items/CreateItemDialog.tsx:56–63 (the copy)
- src/server/items.ts:237 — **outside the scanned folder**; the site that uses the shared helper,
  cited as evidence that one exists and is already the way this is done

**The duplicated logic**:

```ts
function typeForPath(pathname: string): CreatableItemTypeName {
    const slug = pathname.match(/^\/items\/([^/]+)/)?.[1];

    return (
        CREATABLE_ITEM_TYPE_NAMES.find((name) => ITEM_TYPE_CATALOG[name].slug === slug) ??
        DEFAULT_TYPE
    );
}
```

against `src/config/item-type-catalog.ts:98–100, 116–118`:

```ts
const itemTypeNameBySlug = new Map<string, ItemTypeName>(
    SYSTEM_ITEM_TYPE_NAMES.map((name) => [ITEM_TYPE_CATALOG[name].slug, name]),
);

export function getItemTypeNameBySlug(slug: string): ItemTypeName | undefined {
    return itemTypeNameBySlug.get(slug);
}
```

**Differences between the copies**: the component scans `CREATABLE_ITEM_TYPE_NAMES` where the
catalog's map is built from `SYSTEM_ITEM_TYPE_NAMES` — and `src/lib/item-schemas.test.ts:204–206`
asserts those two lists are equal, so the result is the same for every input. The component also
does the URL parse and the fallback, which stay.

**Extract to**: nothing new. `src/config/item-type-catalog.ts` — existing module — already exports
the lookup; `CreateItemDialog` should call it.

```ts
getItemTypeNameBySlug(slug: string): ItemTypeName | undefined
```

**Lines**: removed 8 · added 6 (shared definition 0 — it already exists + 6 call-site lines +
0 imports, since `CreateItemDialog.tsx:32` already imports from that module) · **net +2** ·
comments moved 0 — the nine-line comment at :47–55 is about *which type the dialog opens on*, not
about the lookup, and stays.

**Effort**: S — one function body, one file.

**Risk**: Low — the narrowing back to a creatable name has to be kept, or the function's return type
widens from `CreatableItemTypeName` to `ItemTypeName` and the `useState` it seeds stops
type-checking. `item-schemas.test.ts:204` keeps its teeth here: if the two name lists ever diverge,
that test fails before this function silently starts accepting a non-creatable type.

**Behaviour change**: None, given that test.

**Why it's worth it**: "which item type does this route slug mean" is one rule with one owner, and
`server/items.ts:237` already reads it from that owner to resolve the very same `/items/<slug>`
URLs. The component's copy is also a linear scan where the catalog keeps a prebuilt `Map` — which
matters not at all for seven entries, and matters the moment custom types (Phase 7) make the list
per-user.

**Call-site after**:

```ts
function typeForPath(pathname: string): CreatableItemTypeName {
    const name = getItemTypeNameBySlug(pathname.match(/^\/items\/([^/]+)/)?.[1] ?? "");

    return name && CREATABLE_ITEM_TYPE_NAMES.includes(name) ? name : DEFAULT_TYPE;
}
```

**Test**: not needed as a new file — `lib/item-schemas.test.ts:201–207` already pins the premise
this relies on. If `typeForPath` is exported for its own test, the branch worth covering is a slug
that is not a type at all (`/items/`, `/favorites`), which must fall back rather than throw.

---

### 11. The 81-line monaco theme block inside `CodeEditor` — Low

**Grade**: Low — a placement finding with a slightly negative net, and nothing currently depends on
it. Rubric clause: *a placement finding (right logic, wrong folder) that nothing currently depends
on.*

**Sites** (1, 0 outside the scanned folder):

- src/components/items/CodeEditor.tsx:32–34 (`loader.config`), 42–164 (`THEME_NAME`,
  `SLIDER_COLORS`, `defineTheme`)

**The duplicated logic**: none — this is the split half of the brief. What is at :42–164 is a
`BeforeMount` callback and two constants: three monaco theme definitions of `rules` and `colors`
arrays, with no reference to any prop, any state, or anything else in the file. `defineTheme` is
passed straight to `<Editor beforeMount={defineTheme}>` at :395 and is touched nowhere else.

**The seam**: a self-contained module-level value with its own name, read as a unit, referenced from
exactly one line. `CodeEditor.tsx` is 581 lines of which these are 123 — the file currently reads as
a colour table with a component underneath it.

**Extract to**: `src/components/items/editor-themes.ts` — new file, beside its only consumer.

Deliberately **not** `src/config/`, though the colours are configuration: `defineTheme` is typed
`BeforeMount` from `@monaco-editor/react`, and `config/` modules are imported by the seed script
(`prisma/seed.ts` reads `item-type-catalog.ts`) and by server code. Pulling a client editor
library's types into that folder is the wrong direction. Deliberately not `src/lib/` either, for
the same reason — `lib/` is client-*reachable*, not client-specific, and a monaco dependency there
would be reachable from anything.

```ts
export const defineEditorThemes: BeforeMount
```

`loader.config` (:32–34) goes with it: it pins the CDN build to the installed `monaco-editor`
version, which is the same subject.

**Lines**: removed 82 (81 code lines in the block + 1, the `EditorThemeId` type import at :22 that
becomes unused) · added 85 (shared definition 81 + 0 call-site lines — `beforeMount={defineTheme}`
becomes `beforeMount={defineEditorThemes}`, still one line — + 4 imports: the `BeforeMount` type,
`EDITOR_SURFACE`, `EDITOR_THEME_CATALOG`, `EditorThemeId`, plus 1 in `CodeEditor` for the new
module, less 1 for `EDITOR_SURFACE` leaving `CodeEditor`'s existing import line) · **net −3** ·
comments moved 36.

**Effort**: S — one new file, one mechanical cut, no signature anyone else depends on.

**Risk**: Low — the one thing to check is that `defineTheme` still runs *before* mount. It is passed
as a prop, so moving the definition changes nothing about when it is called; the failure mode if it
were called late is documented at :74–75 and would be visible immediately as an unthemed editor.

**Behaviour change**: None.

**Why it's worth it**: `CodeEditor.tsx` drops from 581 lines to about 460, and what remains is the
component. The theme table is the only part of that file a designer would ever open, and it is
currently 120 lines below a CDN pin and above a 90-line prop contract. Do this in the same commit
as finding 5, which edits four lines inside the block being moved.

**Call-site after**:

```tsx
<Editor beforeMount={defineEditorThemes} … />
```

**Test**: not needed — the module is a data table and a registration call, and there is no monaco
instance to register against outside a browser. Finding 5 removes the only thing in it that could
disagree with something else.

---

### 12. `FilePreview` inside `ItemDrawer` — Low

**Grade**: Low — a placement finding with a negative net; do it when next editing the drawer.
Rubric clause: *a placement finding that nothing currently depends on.*

**Sites** (1, 0 outside the scanned folder):

- src/components/items/ItemDrawer.tsx:633–713 (the component and its doc comment), rendered at
  :529–536

**The duplicated logic**: none — this is a split. `FilePreview` is a local component with six props
it already declares explicitly, rendered from exactly one place, that decides which of four viewers
a file opens in and draws the name-and-size floor beneath it. It reads nothing from the drawer's
scope.

**The seam**: the file already declares it as a separate component with a written signature; it just
lives in the same file. The give-away is `ItemDrawer.tsx:13–14`, an import comment that exists only
because of the co-location: `// Aliased because the component below already owns the name
'FilePreview'.` — `import { filePreviewFor, type FilePreview as FilePreviewInfo } from
"@/lib/file-preview";`. That alias, and the comment explaining it, both disappear.

**Extract to**: `src/components/items/FilePreview.tsx` — new file, beside `FileTypeIcon.tsx` and
`FileRow.tsx`.

```tsx
export function FilePreview(props: {
    name: string;
    size: number;
    src: string;
    preview: FilePreviewInfo;
    /** The object's contents, once fetched. Empty for the kinds that are not text. */
    text: string;
    error: string;
}): React.ReactElement
```

**Lines**: removed 59 · added 64 (shared definition 59 + 0 call-site lines — the `<FilePreview …/>`
at :529–536 is unchanged — + 5 imports: `CodeEditor`, `MarkdownEditor`, `formatFileSize` and the
`FilePreview` type in the new file, plus 1 in `ItemDrawer`) · **net −5** · comments moved 13, plus
2 comment lines deleted outright (the alias note at :13–14).

`ItemDrawer` keeps its `formatFileSize` import? No — `formatFileSize` is used only inside
`FilePreview` (:707), so that name leaves `ItemDrawer`'s import line while `formatLongDate` stays.
Counted as 0, since the line survives either way.

**Effort**: S — one cut, one import each way.

**Risk**: None — no state crosses, and the new file needs no `"use client"`: it renders `CodeEditor`
and `MarkdownEditor`, which declare their own, and it is only ever imported by `ItemDrawer`, which
is already a client component.

**Behaviour change**: None.

**Why it's worth it**: `ItemDrawer.tsx` is 733 lines and the single longest file in the folder. This
takes 80 off it, removes a name collision that currently costs an aliased import and a comment
explaining the alias, and gives the four-way preview decision a file of its own next to the other
file-shaped components. It is the *only* clean seam in that file — see below for the one that looks
like a seam and is not.

**Call-site after**: unchanged.

**Test**: not needed — the branching this component does is over `preview.kind`, and the function
that computes `preview.kind` is `lib/file-preview.ts`, which already has `file-preview.test.ts`
covering it. The component itself picks a viewer per kind and has nothing else to assert.

---

## Considered and rejected

- **`ItemDrawer`'s toolbar row (:356–501, 146 lines).** The obvious second split, and it is not one.
  The row reads `isFavorite`, `isPinned`, `isFavoriting`, `isPinning`, `showsCopy`, `body`, `isFile`,
  `detail`, `fileUrl`, `itemId`, `view.title`, and both toggle handlers. Extracting it converts
  twelve local values into twelve props and moves nothing but braces — a component whose prop list
  is longer than the state it replaces.

- **`ItemFormFields.tsx` (634 lines) split into five files.** Long, and correctly so. It is already
  five separate exported components with their own props; both consumers (`CreateItemDialog`,
  `ItemEditForm`) import all five together, so five files would cost ten import lines and buy
  nothing. Roughly 40% of the file is doc comment, and the comment at :35–56 has already argued
  where the boundary of this module is and why title and URL are on the other side of it.

- **`SuggestButton` (`ItemFormFields.tsx:97–127`) folded into finding 4's `EditorAiButton`.**
  The third AI button, and deliberately left out. It has no Pro branch (a free account never sees
  it — `canSuggest` gates its existence, where the editor buttons stay on screen wearing a crown),
  no `hasResult` "…again" state, no white-alpha hover (it sits on a theme surface, not on monaco's),
  and no `Loader2` — it pulses its own icon instead. `CodeEditor.tsx:248–251` records that this
  difference is a decision, not an accident. Merging all three would need four flags to serve three
  sites.

- **`ChaosField.tsx` (308 lines).** Long and cohesive: one `useEffect` holding a physics
  simulation whose parts (`measure`, `scatter`, `placeStatic`, `step`, `sync`) all close over the
  same `items` array and the same `bounds`. The simulation cannot move to `lib/` — it writes
  `style.transform` on real elements, so it is not pure and has nothing to test. The rAF-gating
  (in-view + tab-visible) is the one generic piece, and it has one caller.

- **`MarketingNav.tsx` (265 lines).** Three effects, of which two look generic — dismiss-on-
  Escape-or-outside-click, and close-on-widen. Each has exactly one caller, and roughly a third of
  the file is the doc comment at :63–89 explaining the three ways `variant="auth"` differs. Nothing
  to share; nothing to split.

- **`TopBar.tsx` (262 lines).** Over half is comment, including four separate blocks recording
  measurements taken at 320px and 360px. What remains is a header of about 100 lines. No seam.

- **The abortable-fetch effect** — `ItemDrawer.tsx:66–92`, `ItemDrawer.tsx:111–133`, and
  `hooks/use-collection-options.ts:24–41`. Three sites of `new AbortController()` → `fetch` →
  throw-on-`!ok` → set state → swallow `AbortError`. A shared hook would need the url, the parse
  mode (`json` twice, `text` once), the error message, an enabled flag, and a typed success
  callback — five parameters for three sites, which is the abstraction that has to be re-read to be
  understood.

- **The file name-and-size card** — `ItemDrawer.tsx:702–710`, `ItemEditForm.tsx:210–216`,
  `FileUpload.tsx:187–198`. Three sites sharing
  `rounded-lg border border-border bg-muted/40 p-3` plus a truncated name and a
  `formatFileSize` line. They differ in a leading icon chip (one), a trailing remove button (one),
  and the suffix after the size ("· download to open this one", "· replacing a file is not supported
  yet", nothing) — three sites, five props, nine lines saved.

- **The macOS window dots** — `CodeEditor.tsx:320–324` and `AiSection.tsx:126–133`. Three lines and
  three hex literals, twice. One is app chrome and one is a marketing mock of a different editor;
  coupling the landing page's illustration to the real editor's header means a change to one has to
  be reasoned about for the other.

- **`CreateCollectionForm` and `EditCollectionForm`** (`CreateCollectionDialog.tsx:75–158`,
  `EditCollectionDialog.tsx:69–162`). The two bodies rhyme almost line for line — same two fields,
  same placeholders, same footer. They are still create and update: different actions, different
  contracts (`CreateCollectionInput` / `UpdateCollectionInput`), different id prefixes so both can
  be open at once, and different toasts. Collapsing them into one parameterized form is the thing
  the actions playbook rules out for the same reason. Findings 3 and 1 take the parts of them that
  *are* genuinely shared.

- **The controlled/uncontrolled dialog-open triad** — `CreateItemDialog.tsx:107–110` and
  `CreateCollectionDialog.tsx:43–46`, four identical lines. Two sites of plumbing, no branch worth
  naming, and a `useControllableOpen` hook would be four lines of definition plus two imports to
  save four. Below the bar.

- **The `selected` + `open` drawer pairing** — `ItemList.tsx:45–51` and
  `CommandPalette.tsx:75–76, 122–126`. Two sites, and `CommandPalette.tsx:72–74` already documents
  it as "the same pairing `ItemList` uses". Eight lines each, no branch, and the two differ in what
  else the open handler does (one closes a palette first). Low value; skipped rather than graded.

- **The pricing components.** `billing/UpgradePlans.tsx` and `marketing/PricingPlans.tsx` render
  visibly similar plan grids and are **already** correctly factored: both compose
  `pricing/PricingPlanCard` and `pricing/BillingCycleToggle` from `config/marketing.ts`. The
  `pricing/` folder exists precisely so the two cannot drift. Nothing to do.

- **Hard-coded item-type colours, icons, routes, or Pro gating.** Checked and clean. No component
  in the folder writes a type colour literal; `ITEM_TYPE_COLORS` is imported by
  `lib/type-color-vars.ts`, `config/marketing.ts` and `marketing/AppPreview.tsx`, and the Pro gate
  is read through `canAccessItemType` (`SidebarNav.tsx:89`) and `canUseAi`
  (`ItemFormFields.tsx:166, 419`, `CodeEditor.tsx:252`, `MarkdownEditor.tsx:110`) rather than
  restated. `config/item-type-catalog.ts` is being respected.

- **Copy-pasted clipboard handling.** Checked and clean. `lib/clipboard.ts` is the only place
  `navigator.clipboard` is touched; both callers (`CopyItemButton.tsx:98`, `ItemDrawer.tsx:230`)
  go through `copyToClipboard`.

- **The billing action handler** — `BillingPanelRows.tsx:74–78` and `:80–84`,
  `UpgradePlans.tsx:28–32`, `DeleteAccountDialog.tsx:62–66`. Four copies of
  `start(async () => { const result = await X(); if (result) toast.error(result.error); })`, three
  of them carrying the identical comment "Only ever returns on failure — success is a redirect to
  Stripe — so any value is an error." This is genuinely four sites and it very nearly made the
  table. It is left out because the block is two statements of plumbing with no branch of its own
  and no invariant: the *rule* it encodes ("any returned value is a failure") is enforced by the
  return type in `types/billing.ts`, not by these four lines. A `useBillingAction` hook would be
  eight lines to save eight. Worth reconsidering the moment a fifth billing action appears.

## Summary

**+105 net code lines across 12 findings — High +83 (3), Medium +12 (4), Low +10 (5).**

Recommended order, which is also roughly cheapest-first within each grade:

1. **Finding 3** (`invalidProps` / `invalidFor` into `ui/Field.tsx`) — smallest High, and finding 1
   composes with it. Do it first so finding 1's call sites can use it.
2. **Finding 1** (`ui/AuthField.tsx`) — the largest saving in the report, and the one with real
   risk; give it its own commit and click the four auth flows.
3. **Finding 2** (`ui/StatusBadges.tsx`) — purely mechanical, zero risk, +35.
4. **Findings 4, 5, 8, 11 together** — all four touch `CodeEditor.tsx` and `MarkdownEditor.tsx`,
   and doing them separately means reading the same 1,000 lines four times. Combined net: +27.
5. **Finding 7** (`use-optimistic-toggle`) — the one that needs a test written, and the only one
   whose argument is an invariant rather than a line count.
6. **Findings 6, 9, 10, 12** — opportunistic, next time someone is in those files.

The folder is in good shape. The three things that stand out are all *structural* rather than
sloppy: `components/ui/` has the right primitives for the item forms and none for the auth forms,
which is why nine near-identical field blocks exist in `auth/` and `settings/`; the two editors were
built as a matched pair and are kept matched by comments in each file saying the other one has the
same number, which is the exact convention-not-a-constraint problem `config/editor.ts` was created
to end and only half-finished; and four components draw the favourite star by hand against a rule
that is written down once, in a fifth file's comment. Nothing here is a correctness or authorization
problem — the ownership checks, entitlement gates, and the item-type catalog are all read from their
single sources, and the two long marketing components are long for good reasons. The oversized-file
brief turned up exactly two real seams out of ten candidates, which is the honest answer: eight of
those files are long because their doc comments are, and that is not a defect.
