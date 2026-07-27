import { Brand } from "@/components/layout/Brand";

/**
 * The signed-out shell: brand and a centered card, no sidebar.
 *
 * `(auth)` is a route group, so it adds nothing to the URL — these pages are `/sign-in` and
 * `/register`. It exists to give the signed-out routes their own layout without nesting them under
 * the dashboard chrome.
 *
 * `h-full` with its own `overflow-y-auto`, because the root layout pins the body to the viewport
 * and hides its overflow. A short form centers; a tall one scrolls here rather than being clipped.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-8 overflow-y-auto bg-background px-4 py-10">
            <Brand />
            <main className="w-full max-w-sm">{children}</main>
        </div>
    );
}
