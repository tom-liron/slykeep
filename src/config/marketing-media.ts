/**
 * Paths and capture settings for the recorded product media on the landing page.
 *
 * The landing page reads these to play its clips and show its screenshots — `Hero`, the AI section
 * through `AI_HIGHLIGHTS`, and `DeviceShowcase` — and `scripts/record-marketing.ts` reads the same
 * values to decide what to capture, at which viewport, and where under `public/` to write it.
 * Re-recording after a UI change is `npm run marketing:record`.
 *
 * @remarks
 * Kept free of imports so the recording script can load it outside the Next.js runtime.
 */

/** A recorded clip of the real app. */
export type MarketingVideo = {
    /** Public path of the H.264 MP4. */
    src: string;
    /** Public path of the still shown before the clip plays, and in place of it under reduced motion. */
    poster: string;
};

/** The hero's walkthrough: the dashboard, a search, an item opened and copied. */
export const HERO_VIDEO: MarketingVideo = {
    src: "/marketing/hero.mp4",
    poster: "/marketing/hero.jpg",
};

/** One clip per AI feature, each cropped to the item drawer. */
export const AI_VIDEOS = {
    tags: { src: "/marketing/ai-tags.mp4", poster: "/marketing/ai-tags.jpg" },
    summary: { src: "/marketing/ai-summary.mp4", poster: "/marketing/ai-summary.jpg" },
    explain: { src: "/marketing/ai-explain.mp4", poster: "/marketing/ai-explain.jpg" },
    optimize: { src: "/marketing/ai-optimize.mp4", poster: "/marketing/ai-optimize.jpg" },
} as const satisfies Record<string, MarketingVideo>;

/** A capture of the dashboard at one device's viewport, for the device showcase. */
export type DeviceScreenshot = {
    src: string;
    /** CSS viewport width the page renders at, which decides the responsive layout captured. */
    width: number;
    height: number;
    /** Pixel density of the capture, so it stays sharp inside a retina frame. */
    deviceScaleFactor: number;
};

/**
 * One capture per frame in `DeviceShowcase`. The laptop viewport is also the hero clip's.
 *
 * @remarks
 * Each viewport's aspect ratio matches its frame's screen in `DeviceFrames.tsx`, or the capture is
 * cropped.
 */
export const DEVICE_SCREENSHOTS = {
    laptop: { src: "/marketing/device-laptop.png", width: 1440, height: 900, deviceScaleFactor: 2 },
    tablet: { src: "/marketing/device-tablet.png", width: 820, height: 1180, deviceScaleFactor: 2 },
    phone: { src: "/marketing/device-phone.png", width: 390, height: 844, deviceScaleFactor: 3 },
} as const satisfies Record<string, DeviceScreenshot>;

/**
 * The viewport the AI clips are recorded at, and the region cut from it: the item drawer at full
 * height.
 *
 * @remarks
 * `ItemDrawer` is `min(92vw, 36rem)` wide, which is 576px at this viewport, so the crop is exactly
 * the drawer. Its 4:5 shape matches the player box in `AiFeatureShowcase`.
 */
export const AI_CLIP_CAPTURE = {
    width: 1440,
    height: 720,
    deviceScaleFactor: 2,
    crop: { x: 864, y: 0, width: 576, height: 720 },
} as const;
