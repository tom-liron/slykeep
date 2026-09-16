import Image, { type StaticImageData } from "next/image";

import laptopCapture from "../../../public/marketing/device-laptop.png";
import phoneCapture from "../../../public/marketing/device-phone.png";
import tabletCapture from "../../../public/marketing/device-tablet.png";
import { LaptopFrame, PhoneFrame, TabletFrame } from "@/components/marketing/DeviceFrames";
import { Reveal } from "@/components/marketing/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";

/**
 * The captures, imported rather than referenced by path, so their URLs carry a content hash.
 *
 * `next/image` given the string `/marketing/device-laptop.png` produces an optimizer URL keyed on
 * that path and nothing else, so re-recording leaves every cached copy — browser, optimizer, CDN —
 * pointing at bytes that no longer exist on disk, and the page keeps showing the previous design
 * until something expires. That is not a local annoyance only: the same staleness would meet
 * returning visitors after a deploy, since these filenames are deliberately stable so
 * `scripts/record-marketing.ts` can overwrite them.
 *
 * A static import makes the build emit `/_next/static/media/device-laptop.<hash>.png`. New bytes
 * mean a new hash, a new URL, and nothing to go stale. The recorder still writes to `public/`, and
 * `marketing-media.ts` still describes the captures for it — that module stays import-free so the
 * script can load it outside the Next runtime.
 */
const CAPTURES = {
    laptop: laptopCapture,
    tablet: tabletCapture,
    phone: phoneCapture,
} satisfies Record<string, StaticImageData>;

/**
 * The landing page's responsive-design section: the dashboard on a laptop, a tablet and a phone.
 *
 * One of the sections composed by the `/welcome` page. Each frame shows a capture from
 * {@link CAPTURES}, recorded at that device's real viewport by `scripts/record-marketing.ts` — which
 * reads those viewports from `DEVICE_SCREENSHOTS` in `config/marketing-media.ts` — so the layouts on
 * screen are the ones the app actually renders at those sizes.
 */
export function DeviceShowcase() {
    return (
        <section className="overflow-hidden py-[clamp(3rem,6vw,4.5rem)]">
            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal>
                    <SectionHeading
                        eyebrow="Any device"
                        title="Across all your devices"
                        sub="Start on your laptop, pick up on your phone. Everything you keep is always in reach."
                        className="mb-[clamp(2.5rem,5vw,3.5rem)]"
                    />
                </Reveal>

                <Reveal className="relative mx-auto max-w-[1040px] pb-[4%]">
                    <LaptopFrame className="mx-auto w-[84%]">
                        <Screenshot
                            capture={CAPTURES.laptop}
                            alt="SlyKeep on a laptop"
                            sizes="(min-width: 1080px) 748px, 72vw"
                        />
                    </LaptopFrame>
                    <TabletFrame className="absolute bottom-0 left-0 w-[24.8%]">
                        <Screenshot
                            capture={CAPTURES.tablet}
                            alt="SlyKeep on a tablet"
                            sizes="(min-width: 1080px) 239px, 23vw"
                        />
                    </TabletFrame>
                    <PhoneFrame className="absolute right-[1%] bottom-0 w-[12.5%]">
                        <Screenshot
                            capture={CAPTURES.phone}
                            alt="SlyKeep on a phone"
                            sizes="(min-width: 1080px) 120px, 12vw"
                        />
                    </PhoneFrame>
                </Reveal>
            </div>
        </section>
    );
}

/**
 * A capture filling its frame's screen, resized by the image optimizer to the frame's rendered size.
 *
 * @param sizes - The screen's rendered width: fixed once the showcase reaches its 1040px cap
 * (a 1080px viewport, with the page gutter), a share of the viewport below it. Keep it in step with
 * the frame's width class, so the optimizer rather than the browser does the downscaling.
 */
function Screenshot({
    capture,
    alt,
    sizes,
}: {
    /** A static import from {@link CAPTURES}, which carries its own dimensions and hashed URL. */
    capture: StaticImageData;
    alt: string;
    sizes: string;
}) {
    return (
        <Image
            src={capture}
            alt={alt}
            sizes={sizes}
            quality={90}
            className="size-full object-cover object-top"
        />
    );
}
