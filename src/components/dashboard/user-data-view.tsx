"use client";

import { UserDataViewConfig, ViewStatCard, ViewChart, ViewTable, ViewTab } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Crown,
  Star,
  TrendingUp,
  BarChart3,
  Zap,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Resolve a dot-notation path against a data object
function resolvePath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (format === "currency") return `$${num.toLocaleString()}`;
  if (format === "percent") return `${num.toFixed(1)}%`;
  return num.toLocaleString();
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  crown: Crown,
  star: Star,
  "trending-up": TrendingUp,
  "bar-chart": BarChart3,
  zap: Zap,
  dollar: DollarSign,
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "text-blue-600 bg-blue-500/10",
  green: "text-green-600 bg-green-500/10",
  gold: "text-yellow-600 bg-yellow-500/10",
  violet: "text-violet-600 bg-violet-500/10",
  rose: "text-rose-600 bg-rose-500/10",
  orange: "text-orange-600 bg-orange-500/10",
};

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function StatCardView({ card, data }: { card: ViewStatCard; data: Record<string, unknown> }) {
  const value = resolvePath(data, card.dataPath);
  const Icon = ICON_MAP[card.icon] || Users;
  const colorClass = COLOR_CLASSES[card.color] || COLOR_CLASSES.blue;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{formatValue(value, card.format)}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartView({ chart, data }: { chart: ViewChart; data: Record<string, unknown> }) {
  const chartData = resolvePath(data, chart.dataPath);
  if (!Array.isArray(chartData) || chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          {chart.type === "pie" ? (
            <PieChart>
              <Pie
                data={chartData as Record<string, unknown>[]}
                dataKey={chart.yKey}
                nameKey={chart.xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {(chartData as Record<string, unknown>[]).map((_: unknown, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : chart.type === "line" ? (
            <LineChart data={chartData as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey={chart.yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={chartData as Record<string, unknown>[]}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey={chart.yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TableView({ table, data }: { table: ViewTable; data: Record<string, unknown> }) {
  const rows = resolvePath(data, table.dataPath);
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{table.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {table.columns.map((col) => (
                  <th key={col} className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground capitalize">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as Record<string, unknown>[]).slice(0, 20).map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {table.columns.map((col) => (
                    <td key={col} className="py-2 pr-4 text-xs">
                      {String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p className="mt-2 text-xs text-muted-foreground">Showing 20 of {rows.length} rows</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TabContentView({ tab, data }: { tab: ViewTab; data: Record<string, unknown> }) {
  const cards = tab.cards ?? [];
  const charts = tab.charts ?? [];
  const tables = tab.tables ?? [];
  return (
    <div className="space-y-6 pt-4">
      {tab.description && (
        <p className="text-sm text-muted-foreground">{tab.description}</p>
      )}
      {cards.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card, i) => (
            <StatCardView key={i} card={card} data={data} />
          ))}
        </div>
      )}
      {charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((chart, i) => (
            <ChartView key={i} chart={chart} data={data} />
          ))}
        </div>
      )}
      {tables.length > 0 && (
        <div className="space-y-4">
          {tables.map((table, i) => (
            <TableView key={i} table={table} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}

interface UserDataViewProps {
  viewConfig: UserDataViewConfig;
  cachedData: Record<string, unknown>;
}

export function UserDataView({ viewConfig, cachedData }: UserDataViewProps) {
  // Tabbed layout — used when AI generated tabs
  if (viewConfig.tabs && viewConfig.tabs.length > 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{viewConfig.title}</h3>
          {viewConfig.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{viewConfig.description}</p>
          )}
        </div>
        <Tabs defaultValue="0">
          <TabsList className="h-auto flex-wrap gap-1">
            {viewConfig.tabs.map((tab, i) => (
              <TabsTrigger key={i} value={String(i)}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {viewConfig.tabs.map((tab, i) => (
            <TabsContent key={i} value={String(i)}>
              <TabContentView tab={tab} data={cachedData} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // Flat layout — fallback for views generated before tabs were introduced
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{viewConfig.title}</h3>
        {viewConfig.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{viewConfig.description}</p>
        )}
      </div>
      {viewConfig.cards.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {viewConfig.cards.map((card, i) => (
            <StatCardView key={i} card={card} data={cachedData} />
          ))}
        </div>
      )}
      {viewConfig.charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {viewConfig.charts.map((chart, i) => (
            <ChartView key={i} chart={chart} data={cachedData} />
          ))}
        </div>
      )}
      {viewConfig.tables.length > 0 && (
        <div className="space-y-4">
          {viewConfig.tables.map((table, i) => (
            <TableView key={i} table={table} data={cachedData} />
          ))}
        </div>
      )}
    </div>
  );
}
