"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Asset { name: string; value: number; color: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Asset & { total: number };
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs border border-white/10">
      <p className="text-foreground font-semibold">{d.name}</p>
      <p className="text-muted-foreground">
        ${d.value.toFixed(2)}{d.total > 0 ? ` (${((d.value / d.total) * 100).toFixed(1)}%)` : ""}
      </p>
    </div>
  );
}

interface Props {
  ethBalance: number | null;
  ethPrice: number | null;
  stakedEth: number;
}

export function AllocationChart({ ethBalance, ethPrice, stakedEth }: Props) {
  const ethUsd  = ethBalance != null && ethPrice ? ethBalance * ethPrice : 0;
  const stEthUsd = ethPrice ? stakedEth * ethPrice : 0;

  const assets: Asset[] = [
    { name: "ETH",   value: ethUsd,   color: "#22D3EE" },
    { name: "stETH", value: stEthUsd, color: "#6366F1" },
    { name: "USDC",  value: 0,        color: "#10B981" },
  ].filter(a => a.value > 0);

  const total = assets.reduce((s, a) => s + a.value, 0);

  if (total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-xs">
          —
        </div>
        <p>Keine Assets</p>
      </div>
    );
  }

  // Inject total into each data point so PieTooltip can access it
  const assetsWithTotal = assets.map(a => ({ ...a, total }));

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={assetsWithTotal}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {assets.map((a, i) => <Cell key={i} fill={a.color} />)}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {assets.map(a => (
          <div key={a.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
              <span className="text-muted-foreground">{a.name}</span>
            </div>
            <div className="text-right">
              <span className="text-foreground font-medium">{((a.value / total) * 100).toFixed(1)}%</span>
              <span className="text-muted-foreground ml-1">${a.value.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
