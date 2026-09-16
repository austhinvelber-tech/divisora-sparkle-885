import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContaDivide — Divisor de contas" },
      {
        name: "description",
        content:
          "Divida a conta do bar ou restaurante entre amigos: itens, gorjeta e divisão igual ou proporcional, na hora.",
      },
      { property: "og:title", content: "ContaDivide — Divisor de contas" },
      {
        property: "og:description",
        content:
          "Divida a conta do bar ou restaurante entre amigos: itens, gorjeta e divisão igual ou proporcional, na hora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Participant = { id: string; name: string };
type Item = { id: string; name: string; price: number; consumerIds: string[] };
type SplitMode = "igual" | "proporcional";

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parsePrice(input: string): number {
  const n = Number(input.replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function splitEven(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  const rem = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function Index() {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "p1", name: "Marina" },
    { id: "p2", name: "Diego" },
    { id: "p3", name: "Carla" },
    { id: "p4", name: "Rafael" },
  ]);
  const [items, setItems] = useState<Item[]>([
    { id: "i1", name: "Cerveja artesanal", price: 2700, consumerIds: ["p1", "p2", "p3"] },
    { id: "i2", name: "Pizza de marguerita", price: 5800, consumerIds: ["p1", "p2", "p3", "p4"] },
    { id: "i3", name: "Água mineral", price: 1100, consumerIds: ["p1", "p2"] },
  ]);
  const [tipPct, setTipPct] = useState(10);
  const [mode, setMode] = useState<SplitMode>("proporcional");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  // form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemConsumers, setNewItemConsumers] = useState<string[]>([]);
  const [newPersonName, setNewPersonName] = useState("");

  const totals = useMemo(() => {
    const itemsTotal = items.reduce((s, it) => s + it.price, 0);
    const tip = Math.round((itemsTotal * tipPct) / 100);
    const grand = itemsTotal + tip;
    const n = participants.length;
    const perPerson: Record<string, number> = {};
    participants.forEach((p) => (perPerson[p.id] = 0));
    const breakdown: Record<string, { label: string; cents: number }[]> = {};
    participants.forEach((p) => (breakdown[p.id] = []));

    if (mode === "igual") {
      const shares = splitEven(grand, n);
      participants.forEach((p, i) => {
        perPerson[p.id] = shares[i];
        breakdown[p.id].push({ label: "Divisão igual da conta", cents: shares[i] });
      });
    } else {
      const tipShares = splitEven(tip, n);
      items.forEach((it) => {
        const consumers = it.consumerIds.filter((id) =>
          participants.some((p) => p.id === id),
        );
        const pool = consumers.length ? consumers : participants.map((p) => p.id);
        const shares = splitEven(it.price, pool.length);
        pool.forEach((id, i) => {
          perPerson[id] += shares[i];
          breakdown[id].push({ label: it.name, cents: shares[i] });
        });
      });
      participants.forEach((p, i) => {
        perPerson[p.id] += tipShares[i];
        if (tip > 0) breakdown[p.id].push({ label: `Gorjeta (${tipPct}%)`, cents: tipShares[i] });
      });
    }
    return { itemsTotal, tip, grand, perPerson, breakdown };
  }, [items, participants, tipPct, mode]);

  const n = participants.length;
  const headerLabel = mode === "igual" ? "Cada pessoa paga" : "Média por pessoa";
  const headerValue =
    mode === "igual"
      ? totals.perPerson[participants[0]?.id ?? ""] ?? 0
      : n > 0
        ? Math.round(totals.grand / n)
        : 0;

  const openAddItem = () => {
    setNewItemName("");
    setNewItemPrice("");
    setNewItemConsumers(participants.map((p) => p.id));
    setAddingItem(true);
  };

  const submitItem = () => {
    const price = parsePrice(newItemPrice);
    if (!newItemName.trim() || !Number.isFinite(price) || price <= 0) return;
    if (newItemConsumers.length === 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: `i${Date.now()}`,
        name: newItemName.trim(),
        price,
        consumerIds: newItemConsumers,
      },
    ]);
    setAddingItem(false);
  };

  const submitPerson = () => {
    const name = newPersonName.trim();
    if (!name) return;
    const id = `p${Date.now()}`;
    setParticipants((prev) => [...prev, { id, name }]);
    setItems((prev) =>
      prev.map((it) =>
        it.consumerIds.length === participants.length
          ? { ...it, consumerIds: [...it.consumerIds, id] }
          : it,
      ),
    );
    setNewPersonName("");
    setAddingPerson(false);
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) =>
      prev
        .map((it) => ({ ...it, consumerIds: it.consumerIds.filter((c) => c !== id) }))
        .filter((it) => it.price > 0),
    );
    setExpandedItemId(null);
  };

  const toggleItemConsumer = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              consumerIds: it.consumerIds.includes(personId)
                ? it.consumerIds.filter((c) => c !== personId)
                : [...it.consumerIds, personId],
            }
          : it,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setExpandedItemId(null);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 pb-4 pt-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-brand text-white">
              <span className="font-display text-lg font-bold">÷</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-[17px] font-bold text-brand">ContaDivide</p>
              <p className="text-[11px] font-medium text-ink/40">Nova conta · Jantar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSheet(true)}
            className="grid size-10 place-items-center rounded-xl bg-card ring-1 ring-line transition-transform active:scale-95"
            aria-label="Resumo da divisão"
          >
            <span className="text-lg font-semibold text-ink/50">?</span>
          </button>
        </header>

        {/* Summary card */}
        <section className="mx-4 rounded-[28px] bg-brand p-5 text-white shadow-[0_18px_40px_-24px_#14133c]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {headerLabel}
          </p>
          <div className="mt-1 flex items-end justify-between">
            <p className="font-display text-[46px] font-extrabold leading-none text-white">
              {fmt(headerValue)}
            </p>
            <span className="mb-1 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white/70">
              {n} {n === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/8 px-3.5 py-3">
              <p className="text-[11px] font-medium text-white/45">Total da conta</p>
              <p className="font-display text-[19px] font-bold text-white">
                {fmt(totals.grand)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/8 px-3.5 py-3">
              <p className="text-[11px] font-medium text-white/45">Gorjeta</p>
              <p className="font-display text-[19px] font-bold text-white">{fmt(totals.tip)}</p>
            </div>
          </div>
        </section>

        {/* Tip */}
        <div className="mt-5 px-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Gorjeta</h2>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {[0, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setTipPct(pct)}
                className={
                  tipPct === pct
                    ? "rounded-2xl bg-brand py-3 font-display text-[14px] font-bold text-white transition-transform active:scale-95"
                    : "rounded-2xl bg-card py-3 font-display text-[14px] font-bold text-ink/50 ring-1 ring-line transition-transform active:scale-95"
                }
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mt-5 flex items-center justify-between px-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Itens</h2>
          {addingItem ? (
            <button
              type="button"
              onClick={() => setAddingItem(false)}
              className="rounded-full bg-lilac-soft py-1.5 px-3 text-[13px] font-semibold text-brand transition-transform active:scale-95"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={openAddItem}
              className="flex items-center gap-1 rounded-full bg-lilac-soft py-1.5 pl-2 pr-3 text-[13px] font-semibold text-brand transition-transform active:scale-95"
            >
              <span className="grid size-5 place-items-center rounded-full bg-brand text-[15px] leading-none text-white">
                +
              </span>
              Adicionar
            </button>
          )}
        </div>

        {addingItem && (
          <div className="mx-4 mt-2.5 rounded-[20px] bg-card p-4 ring-1 ring-line">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Nome do item"
              className="w-full rounded-xl bg-background px-3 py-3 text-[15px] font-medium text-ink ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-lilac"
            />
            <input
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              inputMode="decimal"
              placeholder="Valor (ex.: 27,50)"
              className="mt-2 w-full rounded-xl bg-background px-3 py-3 text-[15px] font-medium text-ink ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-lilac"
            />
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/40">
              Quem consumiu
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {participants.map((p) => {
                const selected = newItemConsumers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setNewItemConsumers((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((c) => c !== p.id)
                          : [...prev, p.id],
                      )
                    }
                    className={
                      selected
                        ? "rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-transform active:scale-95"
                        : "rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-ink/50 ring-1 ring-line transition-transform active:scale-95"
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={submitItem}
              disabled={
                !newItemName.trim() ||
                !(parsePrice(newItemPrice) > 0) ||
                newItemConsumers.length === 0
              }
              className="mt-3 w-full rounded-2xl bg-brand py-3 font-display text-[15px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              Adicionar item
            </button>
          </div>
        )}

        <ul className="mt-2.5 space-y-2.5 px-4">
          {items.map((it, idx) => {
            const consumers = it.consumerIds.filter((id) =>
              participants.some((p) => p.id === id),
            );
            const k = consumers.length || n;
            const expanded = expandedItemId === it.id;
            return (
              <li
                key={it.id}
                className="rounded-[20px] bg-card p-3.5 ring-1 ring-line"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => setExpandedItemId(expanded ? null : it.id)}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-lilac-soft font-display text-base font-bold text-brand">
                    {it.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{it.name}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-ink/40">
                      {consumers.length === n
                        ? `Dividida entre ${n}`
                        : consumers.length === 0
                          ? "Dividida entre todos"
                          : `Consumida por ${consumers.length} ${consumers.length === 1 ? "pessoa" : "pessoas"}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-[16px] font-bold text-ink">{fmt(it.price)}</p>
                    <p className="text-[11px] font-medium text-ink/35">
                      {fmt(Math.round(it.price / k))} c/p
                    </p>
                  </div>
                  <span
                    className={`ml-1 text-ink/30 transition-transform ${expanded ? "rotate-90" : ""}`}
                    aria-hidden
                  >
                    ›
                  </span>
                </button>
                {expanded && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                      Quem consumiu
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {participants.map((p) => {
                        const selected = consumers.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleItemConsumer(it.id, p.id)}
                            className={
                              selected
                                ? "rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-transform active:scale-95"
                                : "rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-ink/50 ring-1 ring-line transition-transform active:scale-95"
                            }
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="mt-3 rounded-full bg-destructive/10 px-3 py-1.5 text-[12px] font-semibold text-destructive transition-transform active:scale-95"
                    >
                      Remover item
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Split mode */}
        <div className="mt-5 px-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Método de divisão</h2>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {(
              [
                { id: "igual", label: "Igual" },
                { id: "proporcional", label: "Proporcional" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={
                  mode === m.id
                    ? "rounded-2xl bg-brand py-3 font-display text-[14px] font-bold text-white transition-transform active:scale-95"
                    : "rounded-2xl bg-card py-3 font-display text-[14px] font-bold text-ink/50 ring-1 ring-line transition-transform active:scale-95"
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Participants */}
        <div className="mt-5 flex items-center justify-between px-5">
          <h2 className="font-display text-[15px] font-bold text-ink">Participantes</h2>
          {addingPerson ? (
            <button
              type="button"
              onClick={() => setAddingPerson(false)}
              className="rounded-full bg-lilac-soft py-1.5 px-3 text-[13px] font-semibold text-brand transition-transform active:scale-95"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAddingPerson(true)}
              className="flex items-center gap-1 rounded-full bg-lilac-soft py-1.5 pl-2 pr-3 text-[13px] font-semibold text-brand transition-transform active:scale-95"
            >
              <span className="grid size-5 place-items-center rounded-full bg-brand text-[15px] leading-none text-white">
                +
              </span>
              Adicionar
            </button>
          )}
        </div>

        {addingPerson && (
          <div className="mx-4 mt-2.5 flex gap-2">
            <input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPerson()}
              placeholder="Nome da pessoa"
              className="min-w-0 flex-1 rounded-xl bg-card px-3 py-3 text-[15px] font-medium text-ink ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-lilac"
            />
            <button
              type="button"
              onClick={submitPerson}
              disabled={!newPersonName.trim()}
              className="shrink-0 rounded-xl bg-brand px-4 py-3 font-display text-[14px] font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
            >
              Incluir
            </button>
          </div>
        )}

        <ul className="mt-2.5 space-y-2.5 px-4">
          {participants.map((p, idx) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-[20px] bg-card p-3 ring-1 ring-line"
            >
              <div
                className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold text-white ${
                  idx % 2 === 0 ? "bg-brand" : "bg-lilac"
                }`}
              >
                {initials(p.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{p.name}</p>
                <p className="text-[12px] font-medium text-ink/40">
                  {mode === "igual"
                    ? "Paga o mesmo"
                    : `${items.filter((it) => it.consumerIds.includes(p.id)).length} ${items.filter((it) => it.consumerIds.includes(p.id)).length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <p className="font-display text-[16px] font-bold text-brand">
                {fmt(totals.perPerson[p.id] ?? 0)}
              </p>
              <button
                type="button"
                onClick={() => removeParticipant(p.id)}
                disabled={participants.length <= 1}
                aria-label={`Remover ${p.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-[13px] font-semibold text-ink/40 ring-1 ring-line transition-transform active:scale-95 disabled:opacity-30"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-auto px-4 pb-6 pt-5">
          <button
            type="button"
            onClick={() => setShowSheet(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-[16px] font-bold text-white ring-1 ring-brand/60 transition-transform active:scale-[0.98]"
          >
            Dividir conta
            <span className="text-[18px] leading-none">→</span>
          </button>
        </div>
      </div>

      {/* Breakdown sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Fechar resumo"
            onClick={() => setShowSheet(false)}
            className="absolute inset-0 bg-ink/45"
          />
          <div className="relative z-10 max-h-[75vh] w-full max-w-[390px] overflow-y-auto rounded-t-[28px] bg-paper p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
            <p className="font-display text-[17px] font-bold text-brand">Resumo da divisão</p>
            <p className="mt-0.5 text-[12px] font-medium text-ink/40">
              Total {fmt(totals.grand)} · {mode === "igual" ? "divisão igual" : "divisão proporcional"}
            </p>
            <ul className="mt-4 space-y-2.5">
              {participants.map((p, idx) => (
                <li key={p.id} className="rounded-[20px] bg-card p-3.5 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid size-8 place-items-center rounded-full font-display text-[13px] font-bold text-white ${
                          idx % 2 === 0 ? "bg-brand" : "bg-lilac"
                        }`}
                      >
                        {initials(p.name)}
                      </div>
                      <p className="text-[15px] font-semibold text-ink">{p.name}</p>
                    </div>
                    <p className="font-display text-[16px] font-bold text-brand">
                      {fmt(totals.perPerson[p.id] ?? 0)}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1 pl-[42px]">
                    {totals.breakdown[p.id]?.map((line, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-[12px] font-medium text-ink/50"
                      >
                        <span className="truncate pr-2">{line.label}</span>
                        <span>{fmt(line.cents)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="mt-4 w-full rounded-2xl bg-brand py-4 font-display text-[16px] font-bold text-white transition-transform active:scale-[0.98]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
