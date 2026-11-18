// The piece's main size in one short line under its name (BG jewellery, owner 18.11.2026): "Дължина 16,5–21,5 см, регулируема".
// The text comes from the catalogue (Product.sizeLine); nothing is shown without it.
export function SizeLine({ text, className = "", testId = "size-line" }: { text: string; className?: string; testId?: string }) {
  return <p data-testid={testId} className={`font-sans text-xs text-ink-soft leading-snug ${className}`}>{text}</p>;
}
