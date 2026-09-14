import Image from "next/image";

import { LaptopFrame, PhoneFrame, TabletFrame } from "@/components/marketing/DeviceFrames";
import { Reveal } from "@/components/marketing/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { DEVICE_SCREENSHOTS, type DeviceScreenshot } from "@/config/marketing-media";

/**
 * The landing page's responsive-design section: the dashboard on a laptop, a tablet and a phone.
 *
 * One of the sections composed by the `/welcome` page. Each frame shows a capture from
 * {@link DEVICE_SCREENSHOTS}, taken at that device's real viewport, so the layouts on screen are
 * the ones the app actually renders at those sizes.
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
                            capture={DEVICE_SCREENSHOTS.laptop}
                            alt="SlyKeep on a laptop"
                            sizes="(min-width: 1080px) 748px, 72vw"
                        />
                    </LaptopFrame>
                    <TabletFrame className="absolute bottom-0 left-0 w-[24.8%]">
                        <Screenshot
                            capture={DEVICE_SCREENSHOTS.tablet}
                            alt="SlyKeep on a tablet"
                            sizes="(min-width: 1080px) 239px, 23vw"
                        />
                    </TabletFrame>
                    <PhoneFrame className="absolute right-[1%] bottom-0 w-[12.5%]">
                        <Screenshot
                            capture={DEVICE_SCREENSHOTS.phone}
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
    capture: DeviceScreenshot;
    alt: string;
    sizes: string;
}) {
    return (
        <Image
            src={capture.src}
            alt={alt}
            width={capture.width * capture.deviceScaleFactor}
            height={capture.height * capture.deviceScaleFactor}
            sizes={sizes}
            quality={90}
            className="size-full object-cover object-top"
        />
    );
}
