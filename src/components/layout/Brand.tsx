import { Layers } from "lucide-react";

/** DevStash wordmark + logo. Lives in the top bar and the mobile drawer header. */
export function Brand() {
    return (
        <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Layers className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">DevStash</span>
        </div>
    );
}
