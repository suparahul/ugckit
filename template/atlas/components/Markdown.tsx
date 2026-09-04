/**
 * The one place raw text pasted straight out of the analysis docs gets turned
 * into real markup — TEARDOWN.md prose, and the frame-by-frame transcripts in
 * onScreen/notes, which come out of that same pipeline complete with **bold**
 * and markdown lists. Rendering it as plain text just shows the asterisks.
 *
 * GFM only for tables, since the docs use them for the format/verdict grids.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

/**
 * For a table cell or anything else that can't hold block markup (paragraphs,
 * lists) without breaking its layout, or that sits inside an <a> where block
 * children are invalid. Every block-level node collapses to an inline one, so
 * a frame-by-frame transcript's "- **0:02:** thing" runs on as one line —
 * **bold** still renders, it just doesn't get its own paragraph.
 */
const inlineBreak = (props: { children?: React.ReactNode }) => <span className="imd__brk">{props.children}</span>;

export function InlineMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: inlineBreak,
          li: inlineBreak,
          ul: "span",
          ol: "span",
          blockquote: inlineBreak,
          h1: inlineBreak,
          h2: inlineBreak,
          h3: inlineBreak,
          h4: inlineBreak,
          h5: inlineBreak,
          h6: inlineBreak,
          table: "span",
          thead: "span",
          tbody: "span",
          tr: inlineBreak,
          th: inlineBreak,
          td: inlineBreak,
          a: "span",
          img: () => null,
          hr: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </span>
  );
}
