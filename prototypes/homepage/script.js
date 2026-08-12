/* =========================================================================
   DevStash — marketing homepage prototype

   Five independent behaviours, each guarded so a missing element is a no-op
   rather than an exception that kills the rest of the file:

     1. the chaos field   — requestAnimationFrame drift, wall bounce, cursor repel
     2. scroll reveal     — IntersectionObserver, one-shot
     3. the navbar        — opacity on scroll
     4. the small-screen menu — hamburger open/close
     5. odds and ends     — billing toggle, copyright year

   Everything honours prefers-reduced-motion.
   ========================================================================= */

(function () {
    "use strict";

    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── 1. The chaos field ──────────────────────────────────────────────── */

    function initChaos() {
        var field = document.getElementById("chaos-field");
        if (!field) return;

        var icons = Array.prototype.slice.call(field.querySelectorAll(".chaos-icon"));
        if (!icons.length) return;

        // px/s. Slow enough to read as drifting rather than bouncing.
        var MIN_SPEED = 16;
        var MAX_SPEED = 34;
        // A repel can only push an icon this fast, so a frantic mouse cannot
        // fling everything into a corner.
        var SPEED_CEILING = 260;
        // How hard the cursor pushes, and how far its influence reaches.
        var REPEL_RADIUS = 150;
        var REPEL_FORCE = 900;
        // Per second, how much of the gap back to base speed is closed after a
        // push — this is what makes the field settle again.
        var SETTLE = 1.4;

        var bounds = { w: 0, h: 0 };
        var pointer = { x: 0, y: 0, active: false };
        var frame = null;
        var last = 0;

        var items = icons.map(function (el) {
            var speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
            var angle = Math.random() * Math.PI * 2;
            return {
                el: el,
                size: 52,
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                base: speed,
                rot: Math.random() * 20 - 10,
                vr: (Math.random() * 2 - 1) * 7, // deg/s
                phase: Math.random() * Math.PI * 2,
                pulse: 0.5 + Math.random() * 0.4, // scale-pulse speed
            };
        });

        function draw(item, scale) {
            item.el.style.transform =
                "translate3d(" +
                item.x.toFixed(2) +
                "px, " +
                item.y.toFixed(2) +
                "px, 0) rotate(" +
                item.rot.toFixed(2) +
                "deg) scale(" +
                scale.toFixed(3) +
                ")";
        }

        function measure() {
            bounds.w = field.clientWidth;
            bounds.h = field.clientHeight;
            items.forEach(function (item) {
                item.size = item.el.offsetWidth || 52;
                // A resize can leave an icon outside the new box.
                item.x = Math.min(item.x, Math.max(0, bounds.w - item.size));
                item.y = Math.min(item.y, Math.max(0, bounds.h - item.size));
            });
        }

        // Scatter, retrying a few times so two icons rarely start on top of
        // each other. Nothing depends on it succeeding — they drift apart.
        function scatter() {
            items.forEach(function (item, index) {
                var maxX = Math.max(0, bounds.w - item.size);
                var maxY = Math.max(0, bounds.h - item.size);
                for (var attempt = 0; attempt < 24; attempt++) {
                    item.x = Math.random() * maxX;
                    item.y = Math.random() * maxY;
                    var clear = items.slice(0, index).every(function (other) {
                        return Math.hypot(item.x - other.x, item.y - other.y) > item.size * 1.15;
                    });
                    if (clear) break;
                }
                draw(item, 1);
            });
        }

        // The still fallback: a tidy grid, so the box is not empty for anyone
        // who has asked the OS for less movement.
        function placeStatic() {
            var columns = 4;
            items.forEach(function (item, index) {
                var cellW = bounds.w / columns;
                var cellH = bounds.h / Math.ceil(items.length / columns);
                item.x = (index % columns) * cellW + (cellW - item.size) / 2;
                item.y = Math.floor(index / columns) * cellH + (cellH - item.size) / 2;
                item.rot = 0;
                draw(item, 1);
            });
        }

        function step(now) {
            var dt = Math.min((now - last) / 1000, 0.05); // a tab switch must not teleport anything
            last = now;

            items.forEach(function (item) {
                var maxX = Math.max(0, bounds.w - item.size);
                var maxY = Math.max(0, bounds.h - item.size);

                if (pointer.active) {
                    var dx = item.x + item.size / 2 - pointer.x;
                    var dy = item.y + item.size / 2 - pointer.y;
                    var dist = Math.hypot(dx, dy) || 0.001;
                    if (dist < REPEL_RADIUS) {
                        var push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
                        item.vx += (dx / dist) * push;
                        item.vy += (dy / dist) * push;
                    }
                }

                // Bleed back to the icon's own drift speed, and never exceed
                // the ceiling however hard the cursor was moved.
                var speed = Math.hypot(item.vx, item.vy) || 0.001;
                var target = Math.min(speed, SPEED_CEILING);
                target += (item.base - target) * Math.min(1, SETTLE * dt);
                var scale = target / speed;
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
            });

            frame = window.requestAnimationFrame(step);
        }

        // The loop runs only when the field is both on-screen and in a visible
        // tab. Two independent conditions, so neither one can restart it while
        // the other still says no.
        var inView = true;
        var tabVisible = !document.hidden;

        function sync() {
            var shouldRun = inView && tabVisible;
            if (shouldRun && frame === null) {
                last = window.performance.now();
                frame = window.requestAnimationFrame(step);
            } else if (!shouldRun && frame !== null) {
                window.cancelAnimationFrame(frame);
                frame = null;
            }
        }

        measure();

        if (prefersReducedMotion) {
            placeStatic();
            field.classList.add("is-ready");
            window.addEventListener("resize", function () {
                measure();
                placeStatic();
            });
            return;
        }

        scatter();
        field.classList.add("is-ready");
        sync();

        field.addEventListener("pointermove", function (event) {
            var rect = field.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;
        });
        field.addEventListener("pointerleave", function () {
            pointer.active = false;
        });

        window.addEventListener("resize", measure);

        // Nothing should burn a frame budget off-screen or in a background tab.
        document.addEventListener("visibilitychange", function () {
            tabVisible = !document.hidden;
            sync();
        });

        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                });
                sync();
            }).observe(field);
        }
    }

    /* ── 2. Scroll reveal ────────────────────────────────────────────────── */

    function initReveal() {
        var targets = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
        if (!targets.length) return;

        function showAll() {
            targets.forEach(function (el) {
                el.classList.add("is-visible");
            });
        }

        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
            showAll();
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target); // one-shot: it must not fade back out
                });
            },
            { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
        );

        targets.forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ── 3. The navbar ───────────────────────────────────────────────────── */

    function initNav() {
        var nav = document.getElementById("nav");
        if (!nav) return;

        var ticking = false;

        function apply() {
            nav.classList.toggle("is-scrolled", window.scrollY > 8);
            ticking = false;
        }

        window.addEventListener(
            "scroll",
            function () {
                if (ticking) return;
                ticking = true;
                window.requestAnimationFrame(apply);
            },
            { passive: true },
        );

        apply(); // a reload partway down the page must not start transparent
    }

    /* ── 4. The small-screen menu ────────────────────────────────────────── */

    function initNavMenu() {
        var nav = document.getElementById("nav");
        var toggle = document.getElementById("nav-toggle");
        var menu = document.getElementById("nav-menu");
        if (!nav || !toggle || !menu) return;

        function setOpen(open) {
            nav.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }

        toggle.addEventListener("click", function () {
            setOpen(!nav.classList.contains("is-open"));
        });

        // Every way out of the menu, so it can never be left stranded open.
        menu.addEventListener("click", function (event) {
            if (event.target.closest("a")) setOpen(false);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape" || !nav.classList.contains("is-open")) return;
            setOpen(false);
            toggle.focus(); // Escape should not strand focus inside a menu that just closed
        });

        document.addEventListener("click", function (event) {
            if (!nav.classList.contains("is-open")) return;
            if (!nav.contains(event.target)) setOpen(false);
        });

        // Widening past the breakpoint restores the full bar, and a menu left
        // open would then be hidden but still flagged as expanded.
        var wide = window.matchMedia("(min-width: 861px)");
        var onChange = function (event) {
            if (event.matches) setOpen(false);
        };
        if (typeof wide.addEventListener === "function") wide.addEventListener("change", onChange);
        else wide.addListener(onChange);
    }

    /* ── 5. Billing toggle ───────────────────────────────────────────────── */

    function initPricing() {
        var toggle = document.getElementById("billing-toggle");
        var amount = document.getElementById("pro-amount");
        var period = document.getElementById("pro-period");
        var note = document.getElementById("pro-note");
        if (!toggle || !amount || !period || !note) return;

        var copy = {
            monthly: {
                amount: "$8",
                period: "per month",
                note: "Billed monthly. Cancel any time.",
            },
            yearly: {
                amount: "$72",
                period: "per year",
                note: "That is $6 a month, billed annually — $24 less than monthly.",
            },
        };

        toggle.addEventListener("click", function (event) {
            var button = event.target.closest("button[data-cycle]");
            if (!button) return;

            var next = copy[button.dataset.cycle];
            if (!next) return;

            Array.prototype.forEach.call(toggle.querySelectorAll("button"), function (el) {
                el.classList.toggle("is-active", el === button);
            });

            amount.textContent = next.amount;
            period.textContent = next.period;
            note.textContent = next.note;
        });
    }

    /* ── 6. Copyright year ───────────────────────────────────────────────── */

    function initYear() {
        var year = document.getElementById("year");
        if (year) year.textContent = String(new Date().getFullYear());
    }

    initChaos();
    initReveal();
    initNav();
    initNavMenu();
    initPricing();
    initYear();
})();
