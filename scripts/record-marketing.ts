import "dotenv/config";

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import bcrypt from "bcryptjs";
import ffmpegPath from "ffmpeg-static";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

import { ITEM_TYPE_CATALOG } from "../src/config/item-type-catalog";
import {
    AI_CLIP_CAPTURE,
    AI_VIDEOS,
    DEVICE_SCREENSHOTS,
    HERO_VIDEO,
    type MarketingVideo,
} from "../src/config/marketing-media";
import {
    STARTER_COLLECTIONS,
    STARTER_UNFILED_ITEMS,
    type StarterItem,
} from "../src/config/starter-content";
import { prisma } from "../src/server/infra/prisma";
import { seedStarterContent } from "../src/server/onboarding";
import { PASSWORD_HASH_ROUNDS } from "../src/server/passwords";

/**
 * Marketing media recorder: the landing page's product videos and device screenshots.
 *
 * Signs a throwaway Pro account into the local dev server, drives the real UI with Playwright, and
 * writes the files `config/marketing-media.ts` names under `public/`: the hero walkthrough, one clip
 * per AI feature cropped to the item drawer, and a dashboard capture per device viewport. Frames
 * come from Chromium's screencast at retina density and are encoded to H.264 with the bundled
 * ffmpeg, so text stays sharp. Name scenes to re-record only those:
 * `npm run marketing:record -- hero ai-tags`.
 *
 * Clips show real results at an edited pace: a scene wraps each wait on the server in
 * `cues.waitFor`, and the encoder fast-forwards that stretch to {@link WAIT_KEEP_S}. A scene during
 * which the app raises an error toast fails rather than being encoded.
 *
 * @remarks
 * Needs `npm run dev` running and a development `DATABASE_URL`. The account is created there,
 * seeded with the starter content, and deleted with everything it owns when the run ends. The AI
 * clips make real OpenAI calls. Refuses production environments and non-local base URLs.
 */

const execFileAsync = promisify(execFile);

const BASE_URL = process.env.MARKETING_BASE_URL ?? "http://localhost:3000";
const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * The account every capture signs in as. Recreated at the start of a run, deleted at the end.
 *
 * @remarks
 * The sidebar shows the name and address in every published clip, so the address uses a common
 * provider for realism and a local part unlikely to belong to anyone. The account is written
 * straight to the database and never sent email.
 */
const RECORDER = { email: "amorgan.slykeep.demo@gmail.com", name: "Alex Morgan" };

/** Longest one unchanged frame may hold, so an idle stretch does not stall a clip. */
const MAX_FRAME_HOLD_S = 1.2;
/** How long the final frame holds before a clip ends. */
const END_HOLD_S = 1.2;
/** What a marked server wait is fast-forwarded to: long enough to see the spinner, and no longer. */
const WAIT_KEEP_S = 1.5;
/** Upper bound on an OpenAI round trip before a scene gives up. */
const AI_TIMEOUT_MS = 90_000;

type Session = Awaited<ReturnType<BrowserContext["storageState"]>>;
type Capture = { width: number; height: number; deviceScaleFactor: number };
type Frame = { data: Buffer; timestamp: number };

/** Marks a scene places on its own timeline while it is recorded. */
type Cues = {
    /** The screen now shows the clip's best still. */
    poster: () => void;
    /** Runs `action`, a wait on the server, and fast-forwards that stretch in the encoded clip. */
    waitFor: (action: () => Promise<unknown>) => Promise<void>;
};

/** A scene's frames, the frame its poster is cut from, and the stretches to fast-forward. */
type Captured = {
    frames: Frame[];
    posterIndex: number;
    waits: { start: number; end: number }[];
};

type Scene = {
    /** The CLI name that selects this scene. */
    name: string;
    video: MarketingVideo;
    capture: Capture;
    /** Region to keep, in CSS pixels of `capture`; the whole viewport when omitted. */
    crop?: { x: number; y: number; width: number; height: number };
    /** Encoded width in pixels. */
    outputWidth: number;
    /** Unrecorded setup, such as opening the drawer the clip is about. */
    prepare?: (page: Page) => Promise<void>;
    /** The recorded interaction. */
    run: (page: Page, cues: Cues) => Promise<void>;
};

const STARTER_ITEMS: readonly StarterItem[] = [
    ...STARTER_COLLECTIONS.flatMap((collection) => collection.items),
    ...STARTER_UNFILED_ITEMS,
];

/** The first starter item of a type — the featured snippet is the first in the first collection. */
function starterItem(type: StarterItem["type"]): StarterItem {
    const item = STARTER_ITEMS.find((candidate) => candidate.type === type);
    if (!item) throw new Error(`The starter content has no ${type} to record.`);
    return item;
}

/**
 * Injected into every recorded page. Draws a cursor that follows Playwright's synthetic mouse, which
 * the screencast does not show; makes toasts invisible, since a save's confirmation lands on the
 * very frame a clip ends on; and records the text of any error toast, which stays in the DOM, so
 * the scene can refuse to encode it. A string because it runs inside the page.
 */
const PAGE_SCRIPT = `
window.addEventListener("DOMContentLoaded", () => {
    const hideToasts = document.createElement("style");
    hideToasts.textContent = "[data-sonner-toaster] { opacity: 0 !important; }";
    document.head.appendChild(hideToasts);

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    const arrow = document.createElementNS(ns, "path");
    arrow.setAttribute("d", "M4 2l15 11-6.5 1.2L16 21l-3 1.3-3.4-6.6L4 20z");
    arrow.setAttribute("fill", "#fff");
    arrow.setAttribute("stroke", "#111");
    arrow.setAttribute("stroke-width", "1.4");
    arrow.setAttribute("stroke-linejoin", "round");
    svg.appendChild(arrow);

    const cursor = document.createElement("div");
    cursor.setAttribute("aria-hidden", "true");
    cursor.appendChild(svg);
    Object.assign(cursor.style, {
        position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none",
        transform: "translate(-100px, -100px)", transformOrigin: "3px 2px", transition: "scale 120ms",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))",
    });
    document.documentElement.appendChild(cursor);

    document.addEventListener("mousemove", (event) => {
        cursor.style.transform = "translate(" + (event.clientX - 3) + "px, " + (event.clientY - 2) + "px)";
    }, true);
    document.addEventListener("mousedown", () => { cursor.style.scale = "0.85"; }, true);
    document.addEventListener("mouseup", () => { cursor.style.scale = "1"; }, true);

    new MutationObserver(() => {
        const toast = document.querySelector('[data-sonner-toast][data-type="error"]');
        if (toast) window.__recorderError = toast.textContent || "error toast";
    }).observe(document.body, { childList: true, subtree: true });
});`;

const drawerOf = (page: Page) => page.getByRole("dialog");

/** A tab in the drawer's editor header, which Explain and Optimize add once they have an answer. */
const drawerTab = (page: Page, name: string) =>
    drawerOf(page).getByRole("tab", { name, exact: true });

/** Scrolls a target smoothly into view only when it is not already fully visible. */
async function reveal(target: Locator) {
    const moved = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!visible) element.scrollIntoView({ behavior: "smooth", block: "center" });
        return !visible;
    });
    if (moved) await target.page().waitForTimeout(600);
}

/** Moves the visible cursor to a target over a short glide, then clicks it. */
async function glideClick(target: Locator) {
    await reveal(target);
    const box = await target.boundingBox();
    if (!box) throw new Error(`Nothing on screen to click: ${target}`);

    const page = target.page();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await page.waitForTimeout(150);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
    await page.waitForTimeout(300);
}

/** Opens a starter item's drawer from its type page. */
async function openStarterItem(page: Page, item: StarterItem) {
    await page.goto(`${BASE_URL}/items/${ITEM_TYPE_CATALOG[item.type].slug}`, {
        waitUntil: "load",
    });
    // A card's click target is the transparent overlay button `ItemList` lays over it, named for
    // the item; the page can also hold hidden copies, so only a visible one is clicked.
    await page
        .getByRole("button", { name: `Open ${item.title}`, exact: true })
        .filter({ visible: true })
        .first()
        .click();
    await drawerOf(page).waitFor();
    await page.waitForTimeout(800);
}

async function selectTab(tab: Locator) {
    if ((await tab.getAttribute("aria-selected")) !== "true") await glideClick(tab);
}

/** Submits the drawer's edit form and holds until the drawer is back in view mode. */
async function saveAndSettle(page: Page, cues: Cues) {
    const drawer = drawerOf(page);
    await page.waitForTimeout(500);
    await glideClick(drawer.locator("button[type=submit]"));
    await cues.waitFor(() =>
        drawer.getByRole("button", { name: "Edit", exact: true }).waitFor({ timeout: 30_000 }),
    );
    await page.waitForTimeout(1200);
}

/** Waits for an AI action to write into a field that was empty. */
async function waitForValue(field: Locator) {
    const deadline = Date.now() + AI_TIMEOUT_MS;
    while ((await field.inputValue()).trim() === "") {
        if (Date.now() > deadline)
            throw new Error("Timed out waiting for the AI to fill the field.");
        await field.page().waitForTimeout(250);
    }
}

async function scrollDrawer(page: Page, top: number) {
    await drawerOf(page).evaluate(
        (element, by) => element.scrollBy({ top: by, behavior: "smooth" }),
        top,
    );
    await page.waitForTimeout(1600);
}

const heroScene: Scene = {
    name: "hero",
    video: HERO_VIDEO,
    capture: DEVICE_SCREENSHOTS.laptop,
    outputWidth: 1920,
    async run(page, cues) {
        await page.mouse.move(760, 420, { steps: 14 });
        await page.waitForTimeout(700);
        cues.poster();
        await page.keyboard.press("Meta+k");
        await page.waitForTimeout(450);
        await page.keyboard.type("docker", { delay: 90 });
        await page.waitForTimeout(800);
        await page.keyboard.press("Enter");

        const drawer = drawerOf(page);
        const copy = drawer.getByRole("button", { name: "Copy", exact: true });
        await copy.waitFor();
        await page.waitForTimeout(1000);
        await glideClick(copy);
        // The toolbar button relabels itself only once the text is really on the clipboard.
        await drawer
            .getByRole("button", { name: "Copied", exact: true })
            .waitFor({ timeout: 5000 });
        await page.waitForTimeout(1100);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);

        await glideClick(page.getByRole("link", { name: /Commands/ }).first());
        await page.waitForURL("**/items/commands");
        await page.waitForTimeout(1400);
    },
};

/** The shared shape of the four drawer-cropped AI clips. */
function aiScene(name: string, video: MarketingVideo, item: StarterItem, run: Scene["run"]): Scene {
    return {
        name,
        video,
        capture: AI_CLIP_CAPTURE,
        crop: AI_CLIP_CAPTURE.crop,
        outputWidth: 960,
        prepare: (page) => openStarterItem(page, item),
        run,
    };
}

const aiTagsScene = aiScene(
    "ai-tags",
    AI_VIDEOS.tags,
    starterItem("snippet"),
    async (page, cues) => {
        const drawer = drawerOf(page);
        await glideClick(drawer.getByRole("button", { name: "Edit", exact: true }));

        // Suggestions exclude tags the item already holds, so the field starts empty.
        const tags = drawer.getByRole("textbox", { name: "Tags", exact: true });
        await glideClick(tags);
        await tags.fill("");
        await page.waitForTimeout(300);

        await glideClick(drawer.getByRole("button", { name: "Suggest Tags with AI" }));
        const suggestion = drawer.getByRole("button", { name: /^Add tag / }).first();
        await cues.waitFor(() => suggestion.waitFor({ timeout: AI_TIMEOUT_MS }));
        await page.waitForTimeout(900);
        cues.poster();

        for (let accepted = 0; accepted < 3 && (await suggestion.count()) > 0; accepted++) {
            await glideClick(suggestion);
        }
        await saveAndSettle(page, cues);
    },
);

const aiSummaryScene = aiScene(
    "ai-summary",
    AI_VIDEOS.summary,
    starterItem("command"),
    async (page, cues) => {
        const drawer = drawerOf(page);
        await glideClick(drawer.getByRole("button", { name: "Edit", exact: true }));

        const description = drawer.getByRole("textbox", { name: "Description", exact: true });
        await glideClick(description);
        await description.fill("");
        await page.waitForTimeout(300);

        // An empty field is filled directly rather than offered as a proposal to accept.
        await glideClick(drawer.getByRole("button", { name: "Describe this item with AI" }));
        await cues.waitFor(() => waitForValue(description));
        await page.waitForTimeout(1500);
        cues.poster();
        await saveAndSettle(page, cues);
    },
);

const aiExplainScene = aiScene(
    "ai-explain",
    AI_VIDEOS.explain,
    starterItem("snippet"),
    async (page, cues) => {
        await glideClick(drawerOf(page).getByRole("button", { name: "Explain this code with AI" }));
        const tab = drawerTab(page, "Explain");
        await cues.waitFor(() => tab.waitFor({ timeout: AI_TIMEOUT_MS }));
        await selectTab(tab);
        await page.waitForTimeout(1600);
        cues.poster();
        await scrollDrawer(page, 280);
    },
);

const aiOptimizeScene = aiScene(
    "ai-optimize",
    AI_VIDEOS.optimize,
    starterItem("prompt"),
    async (page, cues) => {
        await glideClick(
            drawerOf(page).getByRole("button", { name: "Optimize this prompt with AI" }),
        );
        const tab = drawerTab(page, "Optimized");
        await cues.waitFor(() => tab.waitFor({ timeout: AI_TIMEOUT_MS }));
        await selectTab(tab);
        await page.waitForTimeout(1800);
        cues.poster();
        await scrollDrawer(page, 320);
    },
);

const SCENES: readonly Scene[] = [
    heroScene,
    aiTagsScene,
    aiSummaryScene,
    aiExplainScene,
    aiOptimizeScene,
];

function refuseUnsafeTarget() {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
        throw new Error(
            "Refusing to run: this script must never execute in a production environment.",
        );
    }
    const { hostname } = new URL(BASE_URL);
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        throw new Error(
            `Refusing to record against ${hostname}: MARKETING_BASE_URL must be local.`,
        );
    }
}

async function assertServerUp() {
    const response = await fetch(`${BASE_URL}/sign-in`).catch(() => null);
    if (!response?.ok) throw new Error(`No dev server at ${BASE_URL}. Start it with npm run dev.`);
}

/** Recreates the recorder as a verified Pro user holding the starter content. */
async function createRecorderAccount() {
    const password = randomBytes(18).toString("base64url");
    await prisma.user.deleteMany({ where: { email: RECORDER.email } });

    const user = await prisma.user.create({
        data: {
            ...RECORDER,
            password: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
            isPro: true,
            emailVerified: new Date(),
        },
        select: { id: true },
    });
    await seedStarterContent(user.id);
    return { id: user.id, password };
}

async function signIn(browser: Browser, password: string): Promise<Session> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/sign-in`);
    await page.locator("#email").fill(RECORDER.email);
    await page.locator("#password").fill(password);
    await page.locator("form:has(#email) button[type=submit]").click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });

    const session = await context.storageState();
    await context.close();
    return session;
}

function openContext(browser: Browser, session: Session, capture: Capture, touch = false) {
    return browser.newContext({
        storageState: session,
        viewport: { width: capture.width, height: capture.height },
        deviceScaleFactor: capture.deviceScaleFactor,
        colorScheme: "dark",
        reducedMotion: "no-preference",
        isMobile: touch,
        hasTouch: touch,
        // Headless Chromium refuses clipboard writes unless granted, and the app answers a refused
        // copy with an error toast.
        permissions: ["clipboard-read", "clipboard-write"],
    });
}

async function captureScreenshots(browser: Browser, session: Session) {
    for (const [device, capture] of Object.entries(DEVICE_SCREENSHOTS)) {
        const context = await openContext(browser, session, capture, device !== "laptop");
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(PUBLIC_DIR, capture.src) });
        await context.close();
        console.log(`Captured ${capture.src}`);
    }
}

/** Collects Chromium screencast frames, and the cues the scene places, while `run` drives the page. */
async function captureFrames(
    context: BrowserContext,
    page: Page,
    run: (cues: Cues) => Promise<void>,
): Promise<Captured> {
    const frames: Frame[] = [];
    const waits: Captured["waits"] = [];
    let posterIndex = -1;
    const latest = () => Math.max(frames.length - 1, 0);

    const cues: Cues = {
        poster: () => {
            posterIndex = latest();
        },
        waitFor: async (action) => {
            const start = latest();
            await action();
            waits.push({ start, end: latest() });
        },
    };

    const cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
        frames.push({
            data: Buffer.from(data, "base64"),
            timestamp: metadata.timestamp ?? Date.now() / 1000,
        });
        // Chromium sends the next frame only after an ack. One racing the stop call is harmless.
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });

    await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 92,
        maxWidth: 4096,
        maxHeight: 4096,
    });
    try {
        await run(cues);
        await page.waitForTimeout(300);
    } finally {
        await cdp.send("Page.stopScreencast").catch(() => {});
    }
    return { frames, posterIndex: posterIndex >= 0 ? posterIndex : frames.length - 1, waits };
}

/** Each frame's on-screen time: its real gap to the next, capped, with marked waits fast-forwarded. */
function frameHolds({ frames, waits }: Captured): number[] {
    const holds = frames.map((frame, index) => {
        const next = frames[index + 1];
        return next ? Math.min(next.timestamp - frame.timestamp, MAX_FRAME_HOLD_S) : END_HOLD_S;
    });

    for (const { start, end } of waits) {
        const span = holds.slice(start, end).reduce((total, hold) => total + hold, 0);
        if (span <= WAIT_KEEP_S) continue;
        const scale = WAIT_KEEP_S / span;
        for (let index = start; index < end; index++) holds[index] *= scale;
    }

    // The concat demuxer needs a positive duration; the constant-rate encode drops what is too short.
    return holds.map((hold) => Math.max(hold, 0.001));
}

async function ffmpeg(args: string[]) {
    if (!ffmpegPath) throw new Error("ffmpeg-static has no binary for this platform.");
    await execFileAsync(ffmpegPath, args, { maxBuffer: 16 * 1024 * 1024 });
}

function videoFilter(scene: Scene) {
    const { width, height } = scene.capture;
    const filters: string[] = [];
    if (scene.crop) {
        const { x, y, width: w, height: h } = scene.crop;
        // Proportional, so the crop holds at whatever pixel density the frames arrived.
        filters.push(`crop=iw*${w / width}:ih*${h / height}:iw*${x / width}:ih*${y / height}`);
    }
    filters.push(`scale=${scene.outputWidth}:-2:flags=lanczos`);
    return filters.join(",");
}

/** Writes the frames at their edited timing, encodes the MP4, and cuts the poster from its frame. */
async function encodeClip(scene: Scene, captured: Captured) {
    const { frames, posterIndex } = captured;
    if (frames.length === 0) throw new Error(`${scene.name}: no frames were captured.`);

    const holds = frameHolds(captured);
    const workDir = await mkdtemp(path.join(tmpdir(), `slykeep-${scene.name}-`));
    const fileOf = (index: number) => `frame-${String(index).padStart(5, "0")}.jpg`;
    try {
        const lines: string[] = [];
        for (const [index, frame] of frames.entries()) {
            await writeFile(path.join(workDir, fileOf(index)), frame.data);
            lines.push(`file '${fileOf(index)}'`, `duration ${holds[index].toFixed(4)}`);
        }
        // The concat demuxer applies the last duration only when the last file is listed again.
        lines.push(`file '${fileOf(frames.length - 1)}'`);
        const list = path.join(workDir, "frames.txt");
        await writeFile(list, lines.join("\n"));

        const output = path.join(PUBLIC_DIR, scene.video.src);
        // prettier-ignore
        await ffmpeg([
            "-y", "-f", "concat", "-safe", "0", "-i", list,
            "-vf", videoFilter(scene), "-fps_mode", "cfr", "-r", "30",
            "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-an", output,
        ]);
        // prettier-ignore
        await ffmpeg([
            "-y", "-i", path.join(workDir, fileOf(posterIndex)), "-vf", videoFilter(scene),
            "-frames:v", "1", "-q:v", "3", path.join(PUBLIC_DIR, scene.video.poster),
        ]);
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}

async function recordScene(browser: Browser, session: Session, scene: Scene) {
    const context = await openContext(browser, session, scene.capture);
    await context.addInitScript(PAGE_SCRIPT);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await scene.prepare?.(page);

    let captured: Captured;
    try {
        captured = await captureFrames(context, page, (cues) => scene.run(page, cues));
        const failure = await page.evaluate(
            () => (window as Window & { __recorderError?: string }).__recorderError,
        );
        if (failure) throw new Error(`The app showed an error toast: ${failure}`);
    } catch (error) {
        // What the page showed when a step gave up is usually the whole diagnosis.
        const shot = path.join(tmpdir(), `slykeep-${scene.name}-failure.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        console.error(`${scene.name} failed; the page at that moment is in ${shot}`);
        throw error;
    } finally {
        await context.close();
    }

    await encodeClip(scene, captured);
    console.log(`Recorded ${scene.video.src} from ${captured.frames.length} frames`);
}

async function main() {
    refuseUnsafeTarget();
    await assertServerUp();

    const requested = new Set(process.argv.slice(2));
    const wants = (name: string) => requested.size === 0 || requested.has(name);

    await mkdir(path.join(PUBLIC_DIR, "marketing"), { recursive: true });
    const account = await createRecorderAccount();
    const browser = await chromium.launch();
    try {
        const session = await signIn(browser, account.password);
        if (wants("screenshots")) await captureScreenshots(browser, session);
        for (const scene of SCENES) {
            if (wants(scene.name)) await recordScene(browser, session, scene);
        }
    } finally {
        await browser.close();
        await prisma.user.delete({ where: { id: account.id } }).catch(() => {});
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
