"use client";

import React from "react";

type MarkdownTextProps = { children: string | null | undefined; className?: string };

function inlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/** Lightweight Markdown support; unformatted legacy text renders normally. */
export function MarkdownText({ children, className = "" }: MarkdownTextProps) {
  if (!children) return null;
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">{list.map((item, i) => <li key={i}>{inlineMarkdown(item)}</li>)}</ul>);
    list = [];
  };
  children.replace(/\r\n/g, "\n").split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flushList();
    if (!trimmed) return;
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    blocks.push(heading
      ? <p key={`heading-${index}`} className="mt-2 font-black">{inlineMarkdown(heading[1])}</p>
      : <p key={`paragraph-${index}`}>{inlineMarkdown(trimmed)}</p>);
  });
  flushList();
  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
}
