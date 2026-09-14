import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Hardware frames for showing the real app on the landing page: a laptop, a tablet and a phone.
 *
 * Drawn in CSS rather than shipped as device images, so they stay sharp at any size and carry no
 * third-party artwork. `DeviceShowcase` composes all three around screenshots of the dashboard.
 *
 * @remarks
 * Every measurement is in `cqw` of the frame's own width, so a frame keeps its proportions at any
 * size its parent gives it. Each screen's aspect ratio matches the viewport its capture is taken
 * at in `DEVICE_SCREENSHOTS` (`config/marketing-media.ts`).
 */

type FrameProps = {
    /** What the screen shows — an image or video that fills it. */
    children: ReactNode;
    /** Sizing and placement; the frame fills the width it is given. */
    className?: string;
};

/** A slim-bezel laptop: lid with camera, 16:10 screen, and a base with the opening notch. */
export function LaptopFrame({ children, className }: FrameProps) {
    return (
        <div className={cn("@container", className)}>
            <div className="relative mx-auto w-[88cqw] rounded-t-[2.2cqw] bg-[#0b0b0d] p-[1.2cqw] pb-[1.6cqw] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_50px_90px_-40px_rgba(0,0,0,0.95)]">
                <span
                    aria-hidden="true"
                    className="absolute top-[0.45cqw] left-1/2 size-[0.45cqw] -translate-x-1/2 rounded-full bg-[#1d1d22]"
                />
                <div className="aspect-[16/10] overflow-hidden rounded-[0.5cqw] bg-black">
                    {children}
                </div>
            </div>
            <div
                aria-hidden="true"
                className="relative h-[1.9cqw] rounded-t-[0.3cqw] rounded-b-[3cqw_1.5cqw] bg-linear-to-b from-[#5b5b61] via-[#2e2e33] to-[#18181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            >
                <span className="absolute top-0 left-1/2 h-[0.75cqw] w-[13cqw] -translate-x-1/2 rounded-b-[0.8cqw] bg-[#1c1c20]" />
            </div>
        </div>
    );
}

/** A tablet in portrait with an even bezel and rounded screen corners. */
export function TabletFrame({ children, className }: FrameProps) {
    return (
        <div className={cn("@container", className)}>
            <div className="relative rounded-[7cqw] bg-[#0b0b0d] p-[3.6cqw] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_40px_70px_-30px_rgba(0,0,0,0.95)]">
                <div className="aspect-[820/1180] overflow-hidden rounded-[3.6cqw] bg-black">
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * A phone with thin bezels, deep corner radii, side buttons, and a status bar holding the camera
 * island.
 *
 * @remarks
 * The screen content starts below the status bar, as an app does on a real phone, so the island
 * never covers the app's header. The bar's colour matches the top edge of the phone capture so the
 * two read as one surface; a re-recorded capture with a different header colour needs it updated.
 */
export function PhoneFrame({ children, className }: FrameProps) {
    return (
        <div className={cn("@container relative", className)}>
            <span
                aria-hidden="true"
                className="absolute top-[26cqw] -left-[1.2cqw] h-[11cqw] w-[1.4cqw] rounded-l-[1cqw] bg-[#2a2a2f]"
            />
            <span
                aria-hidden="true"
                className="absolute top-[34cqw] -right-[1.2cqw] h-[18cqw] w-[1.4cqw] rounded-r-[1cqw] bg-[#2a2a2f]"
            />
            <div className="rounded-[16cqw] bg-[#0b0b0d] p-[3.8cqw] shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_30px_60px_-24px_rgba(0,0,0,0.95)]">
                <div className="flex aspect-[390/844] flex-col overflow-hidden rounded-[12.5cqw] bg-black">
                    <div aria-hidden="true" className="relative h-[11cqw] shrink-0 bg-[#0a0a0a]">
                        <span className="absolute top-[2.5cqw] left-1/2 h-[6.5cqw] w-[22cqw] -translate-x-1/2 rounded-full bg-black" />
                    </div>
                    <div className="min-h-0 flex-1">{children}</div>
                </div>
            </div>
        </div>
    );
}
