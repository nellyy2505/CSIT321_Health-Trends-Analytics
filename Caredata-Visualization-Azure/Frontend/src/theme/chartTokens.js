// Single source of truth for chart colors and typography across the app.
// Mirrors CSS variables in index.css so SVG (recharts) gets concrete values.

export const CHART_PALETTE = [
  "#8AA791", // light sage
  "#95A8BD", // light dusty-blue
  "#B7A07F", // light clay
  "#A4ACA6", // light ink
  "#B4CDBA", // very light sage
  "#C4D0DC", // very light dusty-blue
  "#DBC7A2", // very light clay
];

export const STATUS = {
  good: "#8AA791",
  warn: "#D4AC83",
  bad:  "#C68C8C",
  none: "#B4BAB4",
};

// Aliases used by older code paths
export const STATUS_BY_KEY = {
  green: STATUS.good,
  amber: STATUS.warn,
  red:   STATUS.bad,
  grey:  STATUS.none,
  nodata: STATUS.none,
};

export const CHART_GRID = "#E1DBCC";
export const CHART_AXIS = "#6B7570";
export const CHART_TEXT = "#3D4743";

export const CHART_FONT =
  "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif";

// Standard prop bundles for recharts
export const axisTickStyle = {
  fontSize: 11,
  fill: CHART_AXIS,
  fontFamily: CHART_FONT,
};

export const axisLabelStyle = {
  fontSize: 11,
  fill: CHART_AXIS,
  fontFamily: CHART_FONT,
};

export const tooltipStyle = {
  contentStyle: {
    background: "#FFFFFF",
    border: "1px solid " + CHART_GRID,
    borderRadius: 8,
    fontFamily: CHART_FONT,
    fontSize: 12,
    color: CHART_TEXT,
  },
  labelStyle: { color: CHART_TEXT, fontWeight: 500 },
  itemStyle: { color: CHART_TEXT },
};

export const legendStyle = {
  fontFamily: CHART_FONT,
  fontSize: 12,
  color: CHART_TEXT,
};

// Pick a categorical color by index (wraps).
export const pickColor = (i) => CHART_PALETTE[i % CHART_PALETTE.length];

// Map a status key (red/amber/green/grey) to its readable color.
export const statusColor = (key) => STATUS_BY_KEY[key] || STATUS.none;
