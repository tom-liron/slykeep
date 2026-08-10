import { NextResponse } from "next/server";

import { getCollectionOptions } from "@/server/collections";

/**
 * The collections an item can be filed into, fetched by the picker on both item forms.
 *
 * A route handler rather than props threaded from a server component, because the two callers are
 * client components reached from unrelated places: the create dialog hangs off the top bar, and the
 * edit form is opened from inside `ItemDrawer`, which every item list renders. Passing the list down
 * would mean every page that can show an item card also has to read collections and forward them
 * through `ItemList` — for a list neither is used until a form is actually opened.
 *
 * Fetching it per open is also what keeps it current: a collection created a moment ago from the top
 * bar's other dialog is in the next response, with no cache to invalidate.
 *
 * `getCollectionOptions` scopes the read to the signed-in user, and this path is inside the proxy's
 * matcher, so a signed-out request never arrives.
 */
export async function GET() {
    return NextResponse.json(await getCollectionOptions());
}
