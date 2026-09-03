"use client";

import { useEffect, useRef } from "react";
import { AppWindow, Bookmark, FileText, Terminal } from "lucide-react";

import { GitHubMark, NotionMark, SlackMark, VsCodeMark } from "./chaos-icons";

/** px/s. Slow enough to read as drifting rather than bouncing. */
const MIN_SPEED = 16;
const MAX_SPEED = 34;
/** A repel can only push an icon this fast, so a frantic mouse cannot fling everything into a corner. */
const SPEED_CEILING = 260;
/** How hard the cursor pushes, and how far its influence reaches. */
const REPEL_RADIUS = 150;
const REPEL_FORCE = 900;
/**
 * Per second, how much of the gap back to base speed is closed after a push — this is what makes
 * the field settle again.
 */
const SETTLE = 1.4;

const ICONS = [
    { label: "Notion", node: <NotionMark className="size-[26px]" /> },
    { label: "GitHub", node: <GitHubMark className="size-[26px]" /> },
    { label: "Slack", node: <SlackMark className="size-[26px]" /> },
    { label: "VS Code", node: <VsCodeMark className="size-[26px]" /> },
    {
        label: "Browser tabs",
        node: <AppWindow className="size-6 text-indigo-200" strokeWidth={1.7} aria-hidden="true" />,
    },
    {
        label: "Terminal",
        node: <Terminal className="size-6 text-green-300" strokeWidth={1.9} aria-hidden="true" />,
    },
    {
        label: "Text file",
        node: <FileText className="size-6 text-amber-300" strokeWidth={1.7} aria-hidden="true" />,
    },
    {
        label: "Bookmark",
        node: <Bookmark className="size-6 text-pink-300" strokeWidth={1.8} aria-hidden="true" />,
    },
];

type ChaosItem = {
    el: HTMLElement;
    size: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** The drift speed this icon settles back to once the cursor has left it alone. */
    base: number;
    rot: number;
    /** deg/s */
    vr: number;
    phase: number;
    /** scale-pulse speed */
    pulse: number;
};

/**
 * The left half of the hero's chaos → order figure: eight app icons drifting in a box, bouncing off
 * its walls and shying away from the cursor.
 *
 * The `requestAnimationFrame` loop writes `transform` straight to the elements — routing eight
 * positions a frame through React state would be eight re-renders a frame for state no other
 * component reads.
 *
 * @remarks
 * The loop runs only while the field is on screen *and* the tab is visible, and `prefers-reduced-
 * motion` replaces it with a still grid.
 */
export function ChaosField() {
    const fieldRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const field = fieldRef.current;
        if (!field) return;

        // Read by CSS to fade the icons in, once they have somewhere to be. Set on the element
        // rather than held in state for the same reason the positions are: React renders nothing
        // differently for it, so a render pass would be pure cost.
        const markReady = () => {
            field.dataset.ready = "true";
        };

        const elements = Array.from(field.querySelectorAll<HTMLElement>("[data-chaos-icon]"));
        if (elements.length === 0) return;

        const bounds = { w: 0, h: 0 };
        const pointer = { x: 0, y: 0, active: false };
        let frame: number | null = null;
        let last = 0;

        const items: ChaosItem[] = elements.map((el) => {
            const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
            const angle = Math.random() * Math.PI * 2;
            return {
                el,
                size: 52,
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                base: speed,
                rot: Math.random() * 20 - 10,
                vr: (Math.random() * 2 - 1) * 7,
                phase: Math.random() * Math.PI * 2,
                pulse: 0.5 + Math.random() * 0.4,
            };
        });

        function draw(item: ChaosItem, scale: number) {
            item.el.style.transform = `translate3d(${item.x.toFixed(2)}px, ${item.y.toFixed(2)}px, 0) rotate(${item.rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        }

        function measure() {
            if (!field) return;
            bounds.w = field.clientWidth;
            bounds.h = field.clientHeight;
            for (const item of items) {
                item.size = item.el.offsetWidth || 52;
                // A resize can leave an icon outside the new box.
                item.x = Math.min(item.x, Math.max(0, bounds.w - item.size));
                item.y = Math.min(item.y, Math.max(0, bounds.h - item.size));
            }
        }

        // Scatter, retrying a few times so two icons rarely start on top of each other. Nothing
        // depends on it succeeding — they drift apart.
        function scatter() {
            items.forEach((item, index) => {
                const maxX = Math.max(0, bounds.w - item.size);
                const maxY = Math.max(0, bounds.h - item.size);
                for (let attempt = 0; attempt < 24; attempt++) {
                    item.x = Math.random() * maxX;
                    item.y = Math.random() * maxY;
                    const clear = items
                        .slice(0, index)
                        .every(
                            (other) =>
                                Math.hypot(item.x - other.x, item.y - other.y) > item.size * 1.15,
                        );
                    if (clear) break;
                }
                draw(item, 1);
            });
        }

        // The still fallback: a tidy grid, so the box is not empty for anyone who has asked the OS
        // for less movement.
        function placeStatic() {
            const columns = 4;
            items.forEach((item, index) => {
                const cellW = bounds.w / columns;
                const cellH = bounds.h / Math.ceil(items.length / columns);
                item.x = (index % columns) * cellW + (cellW - item.size) / 2;
                item.y = Math.floor(index / columns) * cellH + (cellH - item.size) / 2;
                item.rot = 0;
                draw(item, 1);
            });
        }

        function step(now: number) {
            const dt = Math.min((now - last) / 1000, 0.05); // a tab switch must not teleport anything
            last = now;

            for (const item of items) {
                const maxX = Math.max(0, bounds.w - item.size);
                const maxY = Math.max(0, bounds.h - item.size);

                if (pointer.active) {
                    const dx = item.x + item.size / 2 - pointer.x;
                    const dy = item.y + item.size / 2 - pointer.y;
                    const dist = Math.hypot(dx, dy) || 0.001;
                    if (dist < REPEL_RADIUS) {
                        const push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
                        item.vx += (dx / dist) * push;
                        item.vy += (dy / dist) * push;
                    }
                }

                // Bleed back to the icon's own drift speed, and never exceed the ceiling however
                // hard the cursor was moved.
                const speed = Math.hypot(item.vx, item.vy) || 0.001;
                let target = Math.min(speed, SPEED_CEILING);
                target += (item.base - target) * Math.min(1, SETTLE * dt);
                const scale = target / speed;
                item.vx *= scale;
                item.vy *= scale;

                item.x += item.vx * dt;
                item.y += item.vy * dt;

                if (item.x <= 0) {
                    item.x = 0;
                    item.vx = Math.abs(item.vx);
                } else if (item.x >= maxX) {
                    item.x = maxX;
                    item.vx = -Math.abs(item.vx);
                }
                if (item.y <= 0) {
                    item.y = 0;
                    item.vy = Math.abs(item.vy);
                } else if (item.y >= maxY) {
                    item.y = maxY;
                    item.vy = -Math.abs(item.vy);
                }

                item.rot += item.vr * dt;
                item.phase += item.pulse * dt;
                draw(item, 1 + Math.sin(item.phase) * 0.05);
            }

            frame = window.requestAnimationFrame(step);
        }

        // The loop runs only when the field is both on-screen and in a visible tab. Two independent
        // conditions, so neither one can restart it while the other still says no.
        let inView = true;
        let tabVisible = !document.hidden;

        function sync() {
            const shouldRun = inView && tabVisible;
            if (shouldRun && frame === null) {
                last = window.performance.now();
                frame = window.requestAnimationFrame(step);
            } else if (!shouldRun && frame !== null) {
                window.cancelAnimationFrame(frame);
                frame = null;
            }
        }

        measure();

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            placeStatic();
            markReady();

            const onResize = () => {
                measure();
                placeStatic();
            };
            window.addEventListener("resize", onResize);
            return () => window.removeEventListener("resize", onResize);
        }

        scatter();
        markReady();
        sync();

        const onPointerMove = (event: PointerEvent) => {
            const rect = field.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;
        };
        const onPointerLeave = () => {
            pointer.active = false;
        };
        // Nothing should burn a frame budget off-screen or in a background tab.
        const onVisibilityChange = () => {
            tabVisible = !document.hidden;
            sync();
        };

        field.addEventListener("pointermove", onPointerMove);
        field.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("resize", measure);
        document.addEventListener("visibilitychange", onVisibilityChange);

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) inView = entry.isIntersecting;
            sync();
        });
        observer.observe(field);

        return () => {
            if (frame !== null) window.cancelAnimationFrame(frame);
            field.removeEventListener("pointermove", onPointerMove);
            field.removeEventListener("pointerleave", onPointerLeave);
            window.removeEventListener("resize", measure);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={fieldRef}
            aria-hidden="true"
            // The faint grid is what the drift reads as movement against.
            className="group/field relative min-h-[300px] flex-1 cursor-crosshair overflow-hidden rounded-md [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:26px_26px]"
        >
            {ICONS.map((icon) => (
                // Until they have been scattered every icon sits stacked at 0,0 — hidden for that
                // one frame rather than flashing a pile in the corner.
                <span
                    key={icon.label}
                    data-chaos-icon
                    className="absolute top-0 left-0 grid size-13 place-items-center rounded-xl border border-border bg-[rgba(24,24,28,0.92)] opacity-0 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.9)] will-change-transform group-data-[ready]/field:opacity-100 max-[460px]:size-[46px]"
                >
                    {icon.node}
                </span>
            ))}
        </div>
    );
}
