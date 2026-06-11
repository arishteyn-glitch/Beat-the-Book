"use client";

// ── Recharts wrappers with consistent dark-terminal styling ──────────
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const C = {
  profit: "#10b981",
  loss: "#ef4444",
  accent: "#3b82f6",
  warn: "#f59e0b",
  violet: "#8b5cf6",
  grid: "rgba(255,255,255,0.06)",
  text: "#8b93a7",
};

const tooltipStyle = {
  backgroundColor: "#11161f",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

const axisProps = {
  stroke: C.grid,
  tick: { fill: C.text, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function ProfitAreaChart({
  data,
  dataKey,
  height = 240,
  prefix = "$",
}: {
  data: any[];
  dataKey: string;
  height?: number;
  prefix?: string;
}) {
  const last = data.length ? data[data.length - 1][dataKey] : 0;
  const color = last >= 0 ? C.profit : C.loss;
  const gid = `grad-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={28} />
        <YAxis {...axisProps} tickFormatter={(v: number) => `${prefix}${v}`} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gid})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PnlBarChart({
  data,
  dataKey = "profit",
  labelKey = "label",
  height = 220,
}: {
  data: any[];
  dataKey?: string;
  labelKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey={labelKey} {...axisProps} minTickGap={16} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d[dataKey] ?? 0) >= 0 ? C.profit : C.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({
  data,
  dataKey = "roi",
  labelKey = "key",
  height = 260,
  suffix = "%",
}: {
  data: any[];
  dataKey?: string;
  labelKey?: string;
  height?: number;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v: number) => `${v}${suffix}`} />
        <YAxis
          type="category"
          dataKey={labelKey}
          {...axisProps}
          width={130}
          tick={{ fill: "#c6cbd6", fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} barSize={14}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d[dataKey] ?? 0) >= 0 ? C.profit : C.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({
  data,
  dataKey,
  height = 220,
  color = C.accent,
  suffix = "",
}: {
  data: any[];
  dataKey: string;
  height?: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={28} />
        <YAxis {...axisProps} tickFormatter={(v: number) => `${v}${suffix}`} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CountBarChart({
  data,
  dataKey = "count",
  labelKey = "bucket",
  height = 220,
  color = C.accent,
}: {
  data: any[];
  dataKey?: string;
  labelKey?: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey={labelKey} {...axisProps} interval={0} angle={-20} height={48} textAnchor="end" />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClvScatterChart({
  data,
  height = 260,
  yKey = "roi",
  ySuffix = "%",
}: {
  data: { clv: number; [k: string]: any }[];
  height?: number;
  yKey?: string;
  ySuffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} />
        <XAxis
          type="number"
          dataKey="clv"
          name="CLV"
          {...axisProps}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="number"
          dataKey={yKey}
          {...axisProps}
          tickFormatter={(v: number) => `${v}${ySuffix}`}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill={C.accent} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
