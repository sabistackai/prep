// Brand values for places CSS tokens can't reach: the web manifest, browser
// chrome colours and data palettes stored per child. See docs/design/PREP-theme-spec.md.

export const BRAND = {
  indigo: "#22307A",
  marigold: "#F4B740",
  lightBg: "#F5F6FB",
  darkBg: "#0E1330",
} as const;

// Child colours, assigned in this order as children are added. Ink text reads on all of them.
export const CHILD_COLORS = ["#F4B740", "#8E97CC", "#5BD1B3", "#FF8A5B", "#F2A7C3", "#7CC4F2"] as const;

export function childColor(index: number) {
  return CHILD_COLORS[index % CHILD_COLORS.length];
}
