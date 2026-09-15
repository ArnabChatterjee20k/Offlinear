import type { Priority, State, StateType } from "@offlinear/shared";
import { PRIORITY_COLORS } from "@offlinear/shared";

/** Linear-style priority glyph: stacked bars (none = dashes). */
export function PriorityIcon({ priority, size = 16 }: { priority: Priority; size?: number }) {
  const color = PRIORITY_COLORS[priority];
  if (priority === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="text-ink-tertiary">
        {[3, 7, 11].map((x) => (
          <rect key={x} x={x} y={7} width={2.5} height={2} rx={0.5} fill="currentColor" />
        ))}
      </svg>
    );
  }
  if (priority === 1) {
    // Urgent: filled warning square.
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <rect x={1.5} y={1.5} width={13} height={13} rx={3} fill={color} />
        <rect x={7} y={4} width={2} height={5} rx={1} fill="#fff" />
        <rect x={7} y={10.5} width={2} height={2} rx={1} fill="#fff" />
      </svg>
    );
  }
  const bars = [
    { x: 2, h: 5 },
    { x: 6.5, h: 9 },
    { x: 11, h: 13 },
  ];
  const active = priority === 2 ? 3 : priority === 3 ? 2 : 1; // high/med/low
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      {bars.map((b, i) => (
        <rect
          key={b.x}
          x={b.x}
          y={14 - b.h}
          width={2.6}
          height={b.h}
          rx={0.8}
          fill={color}
          opacity={i < active ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

/** State glyph: ring whose fill encodes the workflow category. */
export function StateIcon({
  state,
  size = 14,
}: {
  state: Pick<State, "type" | "color"> | undefined;
  size?: number;
}) {
  const type: StateType = state?.type ?? "backlog";
  const color = state?.color ?? "#8a8f98";
  const r = 6;
  const c = 8;
  if (type === "completed") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <circle cx={c} cy={c} r={r} fill={color} />
        <path d="M5 8.2l2 2 4-4.2" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "canceled") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <circle cx={c} cy={c} r={r} fill={color} />
        <path d="M6 6l4 4M10 6l-4 4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    );
  }
  const dash = type === "backlog" ? "2.2 2.2" : undefined;
  const progress = type === "started" ? 0.5 : 0; // half-filled when in progress
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray={dash} />
      {progress > 0 && (
        <path d={`M8 8 L8 2 A6 6 0 0 1 14 8 Z`} fill={color} opacity={0.9} />
      )}
    </svg>
  );
}
