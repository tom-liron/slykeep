"use client";

import { useEffect, useRef } from "react";

import type { MarketingVideo } from "@/config/marketing-media";

/**
 * Muted, inline product-clip player for the landing page.
 *
 * Plays a {@link MarketingVideo} only while it is on screen, so clips further down the page do not
 * decode in the background. For a visitor who prefers reduced motion it never starts on its own:
 * the poster shows, with native controls to play it by choice.
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

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            element.controls = true;
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // A refused autoplay leaves the poster in place, which is the intended fallback.
                    element.play().catch(() => {});
                } else {
                    element.pause();
                }
            },
            { threshold: 0.25 },
        );

        observer.observe(element);
        return () => observer.disconnect();
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
