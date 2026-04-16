"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

type Range = "1" | "7" | "30";

interface DataPoint { date: string; value: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs border border-white/10">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground font-semibold">
        ${payload[0].value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

interface Props {
  ethBalance: number | null;
}

const RANGE_LABELS: Record<Range, string> = { "1": "1T", "7": "7T", "30": "30T" };

export function PortfolioChart({ ethBalance }: Props) {
  const [range, setRange] = useState<Range>("7");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [change, setChange] = useState<number | null>(null);

  useEffect(() => {
    if (ethBalance === null) return;
    setLoading(true);

    fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${range}`
    )
      .then(r => r.json())
      .then((json: { prices: [number, number][] }) => {
        const prices = json.prices ?? [];
        // Sample ~30 points max for clean chart
        const step = Math.max(1, Math.floor(prices.length / 30));
        const points: DataPoint[] = prices
          .filter((_, i) => i % step === 0)
          .map(([ts, price]) => ({
            date: new Date(ts).toLocaleDateString("de-CH", {
              month: "short", day: "numeric",
              ...(range === "1" ? { hour: "2-digit", minute: "2-digit" } : {}),
            }),
            value: parseFloat((ethBalance * price).toFixed(2)),
          }));
        setData(points);
        if (points.length >= 2) {
          const first = points[0].value;
          const last = points[points.length - 1].value;
          setChange(first > 0 ? ((last - first) / first) * 100 : null);
        }
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [range, ethBalance]);

  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Portfolio-Wert (USD)</p>
          {change !== null && (
            <div className={`flex items-center gap-1 text-sm font-medium mt-0.5 ${isPositive ? "text-success" : "text-destructive"}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? "+" : ""}{change.toFixed(2)}% ({RANGE_LABELS[range]})
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {(["1", "7", "30"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                range === r ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : ethBalance === null ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Verbinde Wallet für Chart-Daten
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Keine Daten verfügbar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22D3EE"
                strokeWidth={2}
                fill="url(#portfolioGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#22D3EE", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
