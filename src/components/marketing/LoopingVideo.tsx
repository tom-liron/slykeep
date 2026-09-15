"use client";

import { useEffect, useRef } from "react";

import type { MarketingVideo } from "@/config/marketing-media";

/**
 * Muted, inline product-clip player for the landing page.
 *
 * Plays a {@link MarketingVideo} on every device while it is on screen, so clips further down the
 * page do not decode in the background.
 *
 * @remarks
 * Browsers that refuse muted autoplay — iOS Low Power Mode, Android data saver — keep the poster
 * showing, and the visitor's next tap or click anywhere on the page starts the visible clip, since
 * a user gesture lifts that restriction.
 */
export function LoopingVideo({
    video,
    label,
    loop = true,
    onEnded,
    className,
}: {
    video: MarketingVideo;
    /** Describes what the clip shows, for assistive technology. */
    label: string;
    /** @defaultValue `true` */
    loop?: boolean;
    /** Fires when a non-looping clip finishes, so a caller can advance to the next one. */
    onEnded?: () => void;
    className?: string;
}) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        // Autoplay policies check the `muted` property, which React does not reliably set from the prop.
        element.muted = true;

        let visible = false;
        const play = () => element.play().catch(() => {});
        const retryOnGesture = () => {
            if (visible && element.paused) play();
        };

        const observer = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting;
                if (visible) play();
                else element.pause();
            },
            { threshold: 0.25 },
        );

        observer.observe(element);
        document.addEventListener("touchend", retryOnGesture, { passive: true });
        document.addEventListener("click", retryOnGesture);

        return () => {
            observer.disconnect();
            document.removeEventListener("touchend", retryOnGesture);
            document.removeEventListener("click", retryOnGesture);
        };
    }, [video.src]);

    return (
        <video
            ref={ref}
            key={video.src}
            src={video.src}
            poster={video.poster}
            aria-label={label}
            muted
            playsInline
            loop={loop}
            preload="metadata"
            onEnded={onEnded}
            className={className}
        />
    );
}
