"use client";

import React from "react";

interface Props {
  content: string;
  className?: string;
}

function renderInline(text: string, keyBase: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      segments.push(
        <strong key={`${keyBase}-b${k++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      segments.push(
        <code key={`${keyBase}-c${k++}`} className="bg-white/10 text-primary px-1 py-0.5 rounded text-[0.82em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*")) {
      segments.push(
        <em key={`${keyBase}-i${k++}`} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length > 0 ? <>{segments}</> : text;
}

export default function MarkdownMessage({ content, className = "" }: Props) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let bk = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={bk++} className="bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto my-2">
          {lang && (
            <span className="text-[0.7rem] text-muted-foreground block mb-1 uppercase tracking-wider">
              {lang}
            </span>
          )}
          <code className="text-xs font-mono text-foreground/90 whitespace-pre leading-relaxed">
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={bk++} className="text-sm font-semibold text-foreground mt-3 mb-0.5">
          {renderInline(line.slice(4), `h3-${bk}`)}
        </h3>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={bk++} className="text-sm font-bold text-primary mt-3 mb-1">
          {renderInline(line.slice(3), `h2-${bk}`)}
        </h2>
      );
      i++;
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={bk++} className="text-base font-bold text-foreground mt-2 mb-1">
          {renderInline(line.slice(2), `h1-${bk}`)}
        </h1>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---" || line.trim() === "***") {
      blocks.push(<hr key={bk++} className="border-white/10 my-2" />);
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*•]\s/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        items.push(
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="text-primary shrink-0 mt-px">•</span>
            <span>{renderInline(lines[i].slice(2).trim(), `li-${i}`)}</span>
          </li>
        );
        i++;
      }
      blocks.push(
        <ul key={bk++} className="space-y-0.5 my-1 ml-1">
          {items}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        const text = lines[i].replace(/^\d+\.\s/, "");
        items.push(
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="text-primary font-mono shrink-0 min-w-[1.4em] text-right">{num}.</span>
            <span>{renderInline(text, `li-${i}`)}</span>
          </li>
        );
        i++;
        num++;
      }
      blocks.push(
        <ol key={bk++} className="space-y-0.5 my-1 ml-1">
          {items}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^[#`]/) &&
      !lines[i].match(/^[-*•]\s/) &&
      !lines[i].match(/^\d+\.\s/) &&
      lines[i].trim() !== "---"
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const pk = bk++;
      blocks.push(
        <p key={pk} className="leading-relaxed">
          {paraLines.map((pl, pi) => (
            <React.Fragment key={pi}>
              {pi > 0 && <br />}
              {renderInline(pl, `p-${pk}-${pi}`)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return (
    <div className={`text-sm space-y-1 ${className}`}>
      {blocks}
    </div>
  );
}
