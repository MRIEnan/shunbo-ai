"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: number;
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
  dictations: number;
  wordsThisWeek: number;
};

type Props = { plans: { slug: string; name: string }[] };

export function AdminUsers({ plans }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (query: string, after?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}${after ? `&cursor=${after}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users");
      setRows((prev) => (after ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(q), q ? 250 : 0);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setRows((r) => r.map((x) => (x.id === id ? { ...x, role: data.item.role, plan: data.item.plan, status: data.item.status } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete ${row.email} and all their data? This cannot be undone.`)) return;
    setBusy(row.id);
    const res = await fetch(`/api/admin/users/${row.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Delete failed");
    else setRows((r) => r.filter((x) => x.id !== row.id));
    setBusy(null);
  };

  return (
    <div className="rounded-card border border-ink/10 bg-cream-2">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <Search className="size-4 text-ink/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        {loading && <Loader2 className="size-4 animate-spin text-ink/60" />}
      </div>
      {error && <p className="m-4 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="text-left text-xs text-ink/60">
            <tr className="border-b border-ink/10">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Dictations</th>
              <th className="px-4 py-2 font-medium text-right">Words this week</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((r) => (
              <tr key={r.id} className={cn(busy === r.id && "opacity-50")}>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.email}</div>
                  <div className="text-xs text-ink/60">
                    Joined {new Date(r.createdAt).toLocaleDateString()}
                    {r.stripeCustomerId && <span className="ml-2 font-mono">{r.stripeCustomerId}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select value={r.plan} onChange={(e) => patch(r.id, { plan: e.target.value })} className="h-8 rounded-lg border border-ink/15 bg-cream px-2 text-xs">
                    {plans.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-pill px-2 py-0.5 text-xs", r.status === "active" || r.status === "trialing" ? "bg-mint/20 text-forest" : "bg-coral/10 text-coral")}>
                    {r.status}{r.cancelAtPeriodEnd ? " · cancelling" : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.dictations.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{r.wordsThisWeek.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => patch(r.id, { role: r.role === "admin" ? "user" : "admin" })}
                    className={cn("inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs", r.role === "admin" ? "border-ink bg-ink text-cream" : "border-ink/15")}
                  >
                    <Shield className="size-3" /> {r.role}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => remove(r)} aria-label="Delete user" className="p-1 text-ink/60 hover:text-coral">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/60">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {cursor && (
        <div className="border-t border-ink/10 p-3 text-center">
          <button type="button" onClick={() => load(q, cursor)} disabled={loading} className="rounded-pill border border-ink/15 px-4 py-1.5 text-xs">Load more</button>
        </div>
      )}
    </div>
  );
}
