/** Ordered ids of the rendered board cards, left-to-right, top-to-bottom. */
export function boardCardIds(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>("#board [data-issue-id]");
  return [...nodes].map((n) => n.dataset.issueId!).filter(Boolean);
}
