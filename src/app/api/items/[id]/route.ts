import { NextResponse } from "next/server";

import { getItemDetail } from "@/server/items";

/**
 * The detail behind an item card, fetched when the drawer opens on it.
 *
 * A route handler rather than a Server Action because the caller needs the status: the drawer shows
 * "not found" for a 404 and a retryable error for anything else, which is the same rule that made
 * `api/auth/register` a route. Unlike `api/auth`, this path is inside the proxy's matcher, so a
 * signed-out request never reaches it; `getItemDetail` scopes the read to the signed-in user on top
 * of that, and answers 404 for an item belonging to someone else.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const item = await getItemDetail(id);

    if (!item) {
        return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json(item);
}
