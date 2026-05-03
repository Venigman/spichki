import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  X,
  Check,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useAPIs } from "../context/APIs";
import {
  PRESET_CATEGORIES,
  type APIPreset,
  type PresetCategory,
  type PresetEndpoint,
} from "../lib/presets";
import type { AuthKind } from "../lib/storage";
import { uid } from "../lib/storage";
import { Dropdown } from "./Dropdown";

const METHODS: PresetEndpoint["method"][] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function emptyPreset(): APIPreset {
  return {
    id: uid(),
    name: "",
    emoji: "",
    category: "Свои",
    baseURL: "",
    auth: { kind: "bearer" },
    defaultHeaders: [],
    endpoints: [],
    note: "",
  };
}

export function PresetsPage() {
  const {
    userPresets,
    saveUserPreset,
    removeUserPreset,
    seedPresets,
    removeSeedPreset,
    saveSeedPreset,
    addAPI,
    setView,
  } = useAPIs();
  const [editing, setEditing] = useState<APIPreset | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");

  function applyPreset(p: APIPreset, token: string) {
    addAPI({
      name: p.name || "Без имени",
      baseURL: p.baseURL.replace(/\/+$/, ""),
      auth: {
        kind: p.auth.kind,
        headerName: p.auth.headerName,
        queryName: p.auth.queryName,
        token: p.auth.kind === "none" ? undefined : token.trim() || undefined,
      },
      defaultHeaders: p.defaultHeaders ?? [],
      endpoints: p.endpoints,
      endpointCategories: p.endpointCategories,
      presetId: p.id,
    });
    setApplyingId(null);
    setTokenDraft("");
    setView("workspace");
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">Пресеты</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setEditing(emptyPreset())}
        >
          <Plus size={14} strokeWidth={2} />
          <span>Создать пресет</span>
        </button>
      </div>
      <div className="page-body">
        {userPresets.length === 0 && seedPresets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <LayoutGrid size={22} strokeWidth={1.5} />
            </div>
            <h2>Пресетов пока нет</h2>
            <p>
              Жми «Создать пресет» — собери своё API: имя, базовый URL, тип
              авторизации и список действий.
            </p>
          </div>
        ) : (
          <div className="preset-cards">
            {userPresets.map((p) => {
              const confirming = confirmingId === p.id;
              const applying = applyingId === p.id;
              return (
                <PresetCard
                  key={p.id}
                  preset={p}
                  applying={applying}
                  tokenDraft={tokenDraft}
                  onTokenChange={setTokenDraft}
                  onApplyOpen={() => {
                    setApplyingId(p.id);
                    setTokenDraft("");
                  }}
                  onApplyCancel={() => {
                    setApplyingId(null);
                    setTokenDraft("");
                  }}
                  onApplySubmit={() => applyPreset(p, tokenDraft)}
                  actions={
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Редактировать"
                        onClick={() => setEditing(p)}
                      >
                        <Pencil size={14} strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        data-danger={confirming}
                        title={confirming ? "Точно удалить?" : "Удалить"}
                        onClick={() => {
                          if (confirming) {
                            removeUserPreset(p.id);
                            setConfirmingId(null);
                          } else {
                            setConfirmingId(p.id);
                            setTimeout(() => setConfirmingId(null), 2500);
                          }
                        }}
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                      </button>
                    </>
                  }
                />
              );
            })}
            {seedPresets.map((p) => {
              const applying = applyingId === p.id;
              const confirming = confirmingId === p.id;
              return (
                <PresetCard
                  key={p.id}
                  preset={p}
                  applying={applying}
                  tokenDraft={tokenDraft}
                  onTokenChange={setTokenDraft}
                  onApplyOpen={() => {
                    setApplyingId(p.id);
                    setTokenDraft("");
                  }}
                  onApplyCancel={() => {
                    setApplyingId(null);
                    setTokenDraft("");
                  }}
                  onApplySubmit={() => applyPreset(p, tokenDraft)}
                  source="claude"
                  sourceTag="Claude"
                  actions={
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Редактировать"
                        onClick={() => setEditing(p)}
                      >
                        <Pencil size={14} strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        data-danger={confirming}
                        title={confirming ? "Точно удалить?" : "Удалить"}
                        onClick={() => {
                          if (confirming) {
                            void removeSeedPreset(p.id);
                            setConfirmingId(null);
                          } else {
                            setConfirmingId(p.id);
                            setTimeout(() => setConfirmingId(null), 2500);
                          }
                        }}
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <PresetModal
        open={editing !== null}
        preset={editing}
        onClose={() => setEditing(null)}
        onSave={(p) => {
          // Route to the right store: seed-preset (Claude/file) vs user (localStorage).
          const isSeed = seedPresets.some((s) => s.id === p.id);
          if (isSeed) void saveSeedPreset(p);
          else saveUserPreset(p);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* ─── Preset card (used for both user & seed presets) ─────────────── */
function PresetCard({
  preset,
  applying,
  tokenDraft,
  onTokenChange,
  onApplyOpen,
  onApplyCancel,
  onApplySubmit,
  actions,
  source,
  sourceTag,
}: {
  preset: APIPreset;
  applying: boolean;
  tokenDraft: string;
  onTokenChange: (v: string) => void;
  onApplyOpen: () => void;
  onApplyCancel: () => void;
  onApplySubmit: () => void;
  actions?: React.ReactNode;
  source?: string;
  sourceTag?: string;
}) {
  const needsToken = preset.auth.kind !== "none";

  return (
    <div className="preset-card" data-source={source}>
      <div className="preset-card-main">
        <div className="preset-card-name">
          {preset.name || "Без имени"}
          {sourceTag && <span className="preset-source-tag">{sourceTag}</span>}
        </div>
        <div className="preset-card-meta">
          {preset.baseURL.replace(/^https?:\/\//, "")} · {preset.endpoints.length}{" "}
          {endpointsWord(preset.endpoints.length)}
        </div>
        {applying && (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginTop: 8,
              width: "100%",
            }}
          >
            {needsToken ? (
              <input
                className="kv-input"
                type="password"
                value={tokenDraft}
                placeholder="Токен"
                spellCheck={false}
                autoFocus
                onChange={(e) => onTokenChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onApplySubmit();
                  if (e.key === "Escape") onApplyCancel();
                }}
                style={{ flex: 1 }}
              />
            ) : (
              <div style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
                Без авторизации — токен не нужен
              </div>
            )}
            <button
              type="button"
              className="icon-btn"
              title="Подключить"
              onClick={onApplySubmit}
            >
              <Check size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Отмена"
              onClick={onApplyCancel}
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
      {!applying && (
        <button
          type="button"
          className="icon-btn"
          title="Применить как API-таб"
          onClick={onApplyOpen}
        >
          <Zap size={14} strokeWidth={1.6} />
        </button>
      )}
      {actions}
    </div>
  );
}

function endpointsWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "действий";
  if (mod10 === 1) return "действие";
  if (mod10 >= 2 && mod10 <= 4) return "действия";
  return "действий";
}

/* ─────────────────────────────────────────────
   MODAL — same vibe as AddAPIModal
   ───────────────────────────────────────────── */
function PresetModal({
  open,
  preset,
  onClose,
  onSave,
}: {
  open: boolean;
  preset: APIPreset | null;
  onClose: () => void;
  onSave: (p: APIPreset) => void;
}) {
  const [draft, setDraft] = useState<APIPreset>(preset ?? emptyPreset());
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const isNew = !preset?.name;

  useEffect(() => {
    if (open) {
      setDraft(preset ?? emptyPreset());
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, preset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch: Partial<APIPreset>) => setDraft((d) => ({ ...d, ...patch }));
  const updateAuth = (patch: Partial<APIPreset["auth"]>) =>
    setDraft((d) => ({ ...d, auth: { ...d.auth, ...patch } }));

  const canSave =
    draft.name.trim().length > 0 && /^https?:\/\//i.test(draft.baseURL.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const cleanEndpoints = draft.endpoints.filter(
      (ep) => ep.path.trim() && ep.label.trim()
    );
    // Preserve category order — even for empty categories the user just created.
    const cats = draft.endpointCategories ?? [];
    const seen = new Set<string>();
    const orderedCats: string[] = [];
    for (const c of cats) {
      const t = c.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        orderedCats.push(t);
      }
    }
    for (const ep of cleanEndpoints) {
      const c = ep.category?.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        orderedCats.push(c);
      }
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      baseURL: draft.baseURL.trim().replace(/\/+$/, ""),
      defaultHeaders: (draft.defaultHeaders ?? []).filter((h) => h.key.trim()),
      endpoints: cleanEndpoints,
      endpointCategories: orderedCats.length > 0 ? orderedCats : undefined,
      note: draft.note?.trim() || undefined,
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        onSubmit={handleSubmit}
        style={{ maxWidth: 520, maxHeight: "calc(100svh - 40px)", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-header">
          <h2 id="preset-modal-title">{isNew ? "Новый пресет" : "Редактировать пресет"}</h2>
          <p>Шаблон API: имя, base URL, авторизация и список действий.</p>
        </div>
        <div className="modal-body" style={{ overflowY: "auto" }}>
          <div className="field">
            <label className="field-label" htmlFor="preset-name">Название</label>
            <input
              id="preset-name"
              ref={firstFieldRef}
              className="field-input"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Например: Мой backend"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label className="field-label">Категория</label>
            <Dropdown<PresetCategory>
              ariaLabel="Категория"
              value={draft.category}
              onChange={(v) => update({ category: v })}
              options={PRESET_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="preset-base">Base URL</label>
            <input
              id="preset-base"
              className="field-input"
              value={draft.baseURL}
              onChange={(e) => update({ baseURL: e.target.value })}
              placeholder="https://api.example.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label className="field-label">Авторизация</label>
            <Dropdown<AuthKind>
              ariaLabel="Авторизация"
              value={draft.auth.kind}
              onChange={(v) => updateAuth({ kind: v })}
              options={[
                { value: "none", label: "Без авторизации" },
                { value: "bearer", label: "Bearer Token (Authorization)" },
                { value: "header", label: "Custom header" },
                { value: "query", label: "Query parameter" },
              ]}
            />
          </div>

          {draft.auth.kind === "header" && (
            <div className="field">
              <label className="field-label" htmlFor="preset-hname">Header name</label>
              <input
                id="preset-hname"
                className="field-input"
                value={draft.auth.headerName ?? ""}
                onChange={(e) => updateAuth({ headerName: e.target.value })}
                placeholder="X-API-Key"
              />
            </div>
          )}

          {draft.auth.kind === "query" && (
            <div className="field">
              <label className="field-label" htmlFor="preset-qname">Query name</label>
              <input
                id="preset-qname"
                className="field-input"
                value={draft.auth.queryName ?? ""}
                onChange={(e) => updateAuth({ queryName: e.target.value })}
                placeholder="api_key"
              />
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="preset-note">Подсказка (необязательно)</label>
            <textarea
              id="preset-note"
              className="field-input"
              style={{ minHeight: 64, height: "auto", padding: "8px 12px", fontFamily: "var(--font-sans)", resize: "vertical" }}
              value={draft.note ?? ""}
              onChange={(e) => update({ note: e.target.value })}
              placeholder="Например: ключ нужно вставить как 'OAuth <твой_ключ>'"
              spellCheck={false}
            />
          </div>

          <HeadersEditor
            rows={draft.defaultHeaders ?? []}
            onChange={(rows) => update({ defaultHeaders: rows })}
          />

          <EndpointsEditor
            rows={draft.endpoints}
            categories={draft.endpointCategories ?? []}
            onChange={(rows, cats) =>
              update({ endpoints: rows, endpointCategories: cats })
            }
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            {isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Headers editor ─────────────────────────────────── */
function HeadersEditor({
  rows,
  onChange,
}: {
  rows: Array<{ key: string; value: string }>;
  onChange: (r: Array<{ key: string; value: string }>) => void;
}) {
  return (
    <div className="section">
      <div className="section-label">
        <span>Дефолтные заголовки</span>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ height: 24, padding: "0 8px", fontSize: 11 }}
          onClick={() => onChange([...rows, { key: "", value: "" }])}
        >
          <Plus size={11} strokeWidth={2} />
          <span style={{ marginLeft: 2 }}>Добавить</span>
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>
          —
        </div>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="kv-row">
            <input
              className="kv-input"
              value={row.key}
              placeholder="header"
              spellCheck={false}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...row, key: e.target.value };
                onChange(next);
              }}
            />
            <input
              className="kv-input"
              value={row.value}
              placeholder="value"
              spellCheck={false}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...row, value: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="kv-remove"
              aria-label="Remove"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            >
              <X size={12} strokeWidth={1.6} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Endpoints editor ───────────────────────────────── */
const UNCAT = "Без категории";

function EndpointsEditor({
  rows,
  categories,
  onChange,
}: {
  rows: PresetEndpoint[];
  categories: string[];
  onChange: (rows: PresetEndpoint[], cats: string[]) => void;
}) {
  // Build display order: explicit categories first, then any categories that exist
  // only on endpoints. UNCAT shown only if there are uncategorised endpoints.
  const displayCats = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of categories) {
      const t = c.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    for (const r of rows) {
      const c = r.category?.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    if (rows.some((r) => !r.category?.trim())) out.push(UNCAT);
    return out;
  }, [rows, categories]);

  const grouped = useMemo<Array<[string, PresetEndpoint[]]>>(() => {
    const map = new Map<string, PresetEndpoint[]>();
    for (const cat of displayCats) map.set(cat, []);
    for (const r of rows) {
      const cat = r.category?.trim() || UNCAT;
      const arr = map.get(cat) ?? [];
      arr.push(r);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [rows, displayCats]);

  function addCategory() {
    const name = `Категория ${categories.length + 1}`;
    onChange(rows, [...categories, name]);
  }

  function renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const nextRows = rows.map((r) =>
      r.category === oldName ? { ...r, category: trimmed } : r
    );
    const nextCats = categories.map((c) => (c === oldName ? trimmed : c));
    onChange(nextRows, nextCats);
  }

  function removeCategory(name: string) {
    if (name === UNCAT) {
      onChange(
        rows.filter((r) => r.category?.trim()),
        categories
      );
      return;
    }
    onChange(
      rows.filter((r) => r.category !== name),
      categories.filter((c) => c !== name)
    );
  }

  function addEndpoint(category: string) {
    const cat = category === UNCAT ? undefined : category;
    onChange(
      [...rows, { method: "GET", path: "/", label: "", category: cat }],
      categories
    );
  }

  function patchEndpointAt(globalIdx: number, patch: Partial<PresetEndpoint>) {
    const next = rows.slice();
    next[globalIdx] = { ...next[globalIdx], ...patch };
    onChange(next, categories);
  }

  function removeEndpointAt(globalIdx: number) {
    onChange(
      rows.filter((_, i) => i !== globalIdx),
      categories
    );
  }

  return (
    <div className="section">
      <div className="section-label">
        <span>Действия по категориям</span>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ height: 24, padding: "0 8px", fontSize: 11 }}
          onClick={addCategory}
        >
          <Plus size={11} strokeWidth={2} />
          <span style={{ marginLeft: 2 }}>Добавить категорию</span>
        </button>
      </div>

      {grouped.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>
          Нет категорий — нажми «Добавить категорию» сверху
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grouped.map(([cat, items]) => (
            <CategorySection
              key={cat}
              name={cat}
              items={items}
              onRename={(newName) => renameCategory(cat, newName)}
              onRemove={() => removeCategory(cat)}
              onAddEndpoint={() => addEndpoint(cat)}
              onPatch={(epIdx, patch) => {
                const globalIdx = rows.indexOf(items[epIdx]);
                if (globalIdx !== -1) patchEndpointAt(globalIdx, patch);
              }}
              onRemoveEndpoint={(epIdx) => {
                const globalIdx = rows.indexOf(items[epIdx]);
                if (globalIdx !== -1) removeEndpointAt(globalIdx);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  name,
  items,
  onRename,
  onRemove,
  onAddEndpoint,
  onPatch,
  onRemoveEndpoint,
}: {
  name: string;
  items: PresetEndpoint[];
  onRename: (newName: string) => void;
  onRemove: () => void;
  onAddEndpoint: () => void;
  onPatch: (idx: number, patch: Partial<PresetEndpoint>) => void;
  onRemoveEndpoint: (idx: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const isUncat = name === UNCAT;
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  return (
    <div
      style={{
        border: "1px solid var(--border-muted)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderBottom: open ? "1px solid var(--border-muted)" : "none",
        }}
      >
        <button
          type="button"
          className="icon-btn"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          style={{ width: 24, height: 24 }}
        >
          <ChevronRight
            size={12}
            strokeWidth={2}
            className="preset-category-chevron"
            data-open={open}
          />
        </button>
        {isUncat ? (
          <span
            style={{
              flex: 1,
              fontSize: 12,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            {name}
          </span>
        ) : (
          <input
            className="kv-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => onRename(draftName)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") setDraftName(name);
            }}
            style={{ flex: 1, fontWeight: 600 }}
            placeholder="Имя категории"
          />
        )}
        <span
          className="preset-category-count"
          style={{ height: 20, minWidth: 24 }}
        >
          {items.length}
        </span>
        <button
          type="button"
          className="icon-btn"
          title="Добавить действие"
          onClick={onAddEndpoint}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={
            isUncat
              ? "Удалить все действия без категории"
              : "Удалить категорию"
          }
          onClick={onRemove}
        >
          <Trash2 size={12} strokeWidth={1.6} />
        </button>
      </div>
      {open && (
        <div
          style={{
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                padding: "4px 0",
              }}
            >
              Пусто — нажми «+» в шапке чтобы добавить действие
            </div>
          ) : (
            items.map((ep, i) => (
              <EndpointRow
                key={i}
                ep={ep}
                onPatch={(patch) => onPatch(i, patch)}
                onRemove={() => onRemoveEndpoint(i)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EndpointRow({
  ep,
  onPatch,
  onRemove,
}: {
  ep: PresetEndpoint;
  onPatch: (patch: Partial<PresetEndpoint>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px 1fr 1.4fr 90px 28px",
        gap: 6,
        alignItems: "center",
      }}
    >
      <Dropdown<PresetEndpoint["method"]>
        className="kv-input"
        ariaLabel="HTTP method"
        value={ep.method}
        onChange={(m) => onPatch({ method: m })}
        triggerStyle={{
          fontWeight: 700,
          color: `var(--method-${ep.method.toLowerCase()})`,
        }}
        options={METHODS.map((m) => ({
          value: m,
          label: m,
          color: `var(--method-${m.toLowerCase()})`,
        }))}
      />
      <input
        className="kv-input"
        value={ep.path}
        placeholder="/users/me"
        spellCheck={false}
        onChange={(e) => onPatch({ path: e.target.value })}
      />
      <input
        className="kv-input"
        value={ep.label}
        placeholder="Что делает"
        onChange={(e) => onPatch({ label: e.target.value })}
      />
      <Dropdown<string>
        className="kv-input"
        ariaLabel="Статус"
        value={ep.status ?? ""}
        onChange={(s) =>
          onPatch({ status: (s || undefined) as PresetEndpoint["status"] })
        }
        options={[
          { value: "", label: "—" },
          { value: "ready", label: "RDY" },
          { value: "soon", label: "SOON" },
          { value: "wip", label: "WIP" },
          { value: "broken", label: "ERR" },
        ]}
      />
      <button
        type="button"
        className="kv-remove"
        aria-label="Remove"
        onClick={onRemove}
      >
        <X size={12} strokeWidth={1.6} />
      </button>
    </div>
  );
}

// Old flat editor (kept around as reference, no longer used).
