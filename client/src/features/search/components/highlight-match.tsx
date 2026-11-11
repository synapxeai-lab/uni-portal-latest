import { Fragment } from "react";

/** Escapes regex special characters so the query can be used safely inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightMatchProps {
  text: string;
  query: string;
}

/**
 * Wraps every case-insensitive occurrence of `query` inside `text` in a
 * <mark> - shared by the search dialog and the full results page so matched
 * text is highlighted identically everywhere search results are shown.
 */
export function HighlightMatch({ text, query }: HighlightMatchProps) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmedQuery)})`, "gi"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmedQuery.toLowerCase() ? (
          <mark key={index} className="rounded-sm bg-primary/20 text-inherit">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
