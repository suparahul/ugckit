"use client";

/**
 * The text of a day-view card, held to three lines: a long plan row would
 * otherwise make the card as tall as the page. "Show more" opens this card
 * alone and becomes "Show less"; the button shows only when the text is cut.
 * It sits inside the card's link, so a click on it does not follow the link.
 */

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";

export function CellText({ topic, format }: { topic: string; format: string }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const topicRef = useRef<HTMLSpanElement>(null);
  const formatRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (open) return;
    const els = [topicRef.current, formatRef.current].filter((e): e is HTMLSpanElement => !!e);
    const measure = () => setCut(els.some((e) => e.scrollHeight > e.clientHeight + 1));
    measure();
    const ro = new ResizeObserver(measure);
    els.forEach((e) => ro.observe(e));
    return () => ro.disconnect();
  }, [open, topic, format]);

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <>
      <span ref={topicRef} className={`cell__topic${open ? " is-open" : ""}`}>{topic}</span>
      <span className="cell__format"><span ref={formatRef} className={`state cell__clamp${open ? " is-open" : ""}`}>{format}</span></span>
      {cut || open ? (
        <button type="button" className="cell__more" aria-expanded={open} onClick={toggle}>{open ? "Show less" : "Show more"}</button>
      ) : null}
    </>
  );
}
