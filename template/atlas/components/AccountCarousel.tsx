"use client";

/**
 * The creator carousel — every account in the network, as the ThreeUI
 * CharacterCarousel filmstrip.
 *
 * PORTED INLINE, NOT IFRAMED. The registered CharacterCarousel.tsx wrapper puts
 * the authored document inside `<iframe sandbox="allow-scripts">`, which is an
 * opaque origin: the parent page cannot see into it, and neither can a driver.
 * The filmstrip is pure DOM and CSS — no shaders, no three.js — and its cards
 * are already real <button>s with accessible names, so rendering it in this
 * document instead of in a frame costs nothing visually and puts every card in
 * the top-level accessibility tree, which agent-operability requires. The
 * authored geometry, easing, spacing, transform stack, idle drift, pointer
 * parallax, wheel and arrow-key handling are all reproduced exactly as written.
 *
 * The one authored affordance we bend is the numbered identity footer: the brief
 * calls it out as the slot for our figures, so `name`/`role` become the handle
 * and its metrics. That is the design accommodating the data rather than
 * fighting it.
 *
 * THE BRAND'S OWN ACCOUNT sits in this deck unmarked and at true size. No badge,
 * no reordering, no separate row. Scrolling past @ventnowapp's 386 followers
 * between personas doing millions is the load-bearing finding of the whole
 * study, and it only lands if the app refuses to editorialise it. `isOwn` is
 * used for the control layer's accessible names only — a driver has to be able
 * to ask for "the brand's own account" — and never as a visible marker.
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ControlLayer } from "./Chrome";

export type CarouselAccount = {
  handle: string;
  name: string;
  href: string;
  maxViews: number;
  videos: number;
  slideshows: number;
  convention: string;
  insertion: string;
  disclosure: string;
  cover: string | null;
  isOwn: boolean;
};

function fmt(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return String(n);
}

export default function AccountCarousel({ accounts }: { accounts: CarouselAccount[] }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ phase: 0, target: 0, base: 0, pointerX: 0, pointerY: 0, active: false, lastInput: 0 });
  const moveToRef = useRef<(i: number) => void>(() => {});

  const count = accounts.length;

  /** Focus a card by handle — the control layer's lever into the deck. */
  const focus = useCallback(
    (handle: string) => {
      const i = accounts.findIndex((a) => a.handle === handle);
      if (i >= 0) moveToRef.current(i);
    },
    [accounts]
  );

  useEffect(() => {
    const stage = stageRef.current;
    const deck = deckRef.current;
    if (!stage || !deck || !count) return;

    const cards = Array.from(deck.querySelectorAll<HTMLElement>(".ccard"));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = stateRef.current;
    state.phase = 3;
    state.target = 3;
    state.base = 3;
    state.lastInput = performance.now();

    const wrappedDelta = (index: number, phase: number) => {
      let delta = index - phase;
      while (delta > count / 2) delta -= count;
      while (delta < -count / 2) delta += count;
      return delta;
    };
    const nearestIndex = () => ((Math.round(state.phase) % count) + count) % count;

    const moveTo = (index: number) => {
      const current = nearestIndex();
      let delta = index - current;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      state.base += delta;
      state.target = state.base;
      state.active = false;
      state.lastInput = performance.now();
    };
    moveToRef.current = moveTo;

    const onPointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
      state.pointerX = nx;
      state.pointerY = ny;
      state.active = true;
      state.target = state.base + (innerWidth < 650 ? ny * 2.2 : nx * 3.1);
      state.lastInput = performance.now();
      stage.style.setProperty("--pointer-x", `${(nx + 1) * 50}%`);
    };
    const onPointerLeave = () => {
      state.active = false;
      state.pointerX = 0;
      state.pointerY = 0;
      state.target = state.base;
      stage.style.setProperty("--pointer-x", "50%");
    };
    // A trackpad swipe fires dozens of wheel events for one gesture, and each
    // one used to move a full card — a single flick could spin through the
    // whole deck with no way to stop on one. Throttled to one card-step per
    // ~110ms, which is enough to move fast but leaves the deck restable.
    let lastWheelAt = 0;
    const onWheel = (event: WheelEvent) => {
      const direction = Math.sign(Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX);
      if (!direction) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt < 110) return;
      lastWheelAt = now;
      state.base += direction;
      state.target = state.base;
      state.active = false;
      state.lastInput = now;
    };
    // Arrow keys are scoped to the deck rather than the window: the authored
    // demo owns the whole page, this one shares it with a command bar.
    const onKeyDown = (event: KeyboardEvent) => {
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
      if (!forward && !backward) return;
      event.preventDefault();
      state.base += forward ? 1 : -1;
      state.target = state.base;
      state.active = false;
      state.lastInput = performance.now();
    };

    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("keydown", onKeyDown);

    const onCardFocus = cards.map((card, index) => {
      const h = () => moveTo(index);
      card.addEventListener("focus", h);
      return h;
    });

    let previousTime = performance.now();
    let raf = 0;

    function render(time: number) {
      const deltaTime = Math.min(32, time - previousTime);
      previousTime = time;
      const ease = reducedMotion ? 1 : 1 - Math.pow(0.001, deltaTime / 1000);

      if (!state.active && time - state.lastInput > 3600) {
        const idle = time - state.lastInput - 3600;
        state.target = state.base + Math.sin(idle * 0.00042) * 2.45;
      }

      state.phase += (state.target - state.phase) * ease;
      const compact = innerWidth < 650;
      const activeIndex = nearestIndex();
      const horizontalSpacing = Math.min(168, Math.max(112, innerWidth * 0.116));
      const verticalSpacing = Math.min(122, Math.max(88, innerHeight * 0.112));

      cards.forEach((card, index) => {
        const delta = wrappedDelta(index, state.phase);
        const distance = Math.abs(delta);
        const focusV = Math.exp(-distance * distance * 1.28);
        const side = Math.max(0, 1 - distance / 5);
        const direction = Math.sign(delta);
        const x = compact ? delta * 24 + Math.sin(delta * 0.9) * 25 : delta * horizontalSpacing;
        const y = compact ? delta * verticalSpacing : distance * 8 + state.pointerY * focusV * 10;
        const z = focusV * 145 - distance * 148;
        const scale = 0.54 + side * 0.15 + focusV * 0.54;
        const rotateX = compact ? delta * 2.1 : -state.pointerY * focusV * 3.5;
        const rotateY = compact
          ? -delta * 5
          : -direction * (distance > 0.2 ? 14 + Math.min(distance, 3) * 5 : 0) + state.pointerX * focusV * 3;
        const rotateZ = compact ? delta * -1.4 : delta * 0.7;

        card.style.setProperty("--focus", focusV.toFixed(4));
        card.style.zIndex = String(Math.round(1000 - distance * 100));
        card.style.opacity = String(Math.max(0.13, side * 0.76 + focusV * 0.24));
        card.style.filter = `blur(${Math.max(0, distance - 1.5) * 0.38}px)`;
        card.style.transform = [
          "translate(-50%, -50%)",
          `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`,
          `rotateX(${rotateX.toFixed(2)}deg)`,
          `rotateY(${rotateY.toFixed(2)}deg)`,
          `rotateZ(${rotateZ.toFixed(2)}deg)`,
          `scale(${scale.toFixed(4)})`,
        ].join(" ");
        card.setAttribute("aria-current", index === activeIndex ? "true" : "false");
      });

      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("keydown", onKeyDown);
      cards.forEach((card, i) => card.removeEventListener("focus", onCardFocus[i]));
    };
  }, [count]);

  return (
    <div className="carousel">
      <div className="ccstage" ref={stageRef} tabIndex={-1}>
        <div className="ccdeck" ref={deckRef} data-testid="filmstrip">
          {accounts.map((a, i) => (
            <button
              key={a.handle}
              type="button"
              className="ccard"
              data-handle={a.handle}
              aria-label={`${a.handle}, ${fmt(a.maxViews)} top views, ${a.videos} videos, ${a.slideshows} carousels`}
              onClick={(e) => {
                // First click centres the card; a click on the already-centred
                // card opens it. A card you cannot read should not navigate.
                const current = ((Math.round(stateRef.current.phase) % count) + count) % count;
                if (current === i) router.push(a.href);
                else {
                  moveToRef.current(i);
                  e.preventDefault();
                }
              }}
            >
              <span className="ccard__portrait">
                {a.cover ? (
                  <img src={a.cover} alt="" loading="lazy" width={525} height={700} />
                ) : (
                  <span className="ccard__noportrait" aria-hidden="true" />
                )}
              </span>

              {/* The authored numbered identity footer, carrying the account's
                  own figures where the job title used to go. */}
              <span className="ccard__footer">
                <span className="ccard__index">{String(i + 1).padStart(2, "0")}</span>
                <span className="ccard__meta">
                  <span className="ccard__name">@{a.handle}</span>
                  <span className="ccard__role">
                    {fmt(a.maxViews)} top · {a.videos}v · {a.slideshows}c
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Every card is also a named, focusable node reachable without touching
          the deck at all. */}
      <ControlLayer
        title="Accounts in this network"
        items={accounts.map((a) => ({
          id: a.handle,
          name: `@${a.handle} · ${fmt(a.maxViews)} top · ${a.videos} videos · ${a.slideshows} carousels · ${a.convention}${
            a.isOwn ? " · the brand's own account" : ""
          }`,
        }))}
        onSelect={focus}
      />
    </div>
  );
}
