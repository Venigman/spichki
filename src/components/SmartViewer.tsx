import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Layers, Rows3, FileText } from "lucide-react";
import { collectColumns, findPrimaryArray, previewCell } from "../lib/inspect";

type ViewMode = "tree" | "table" | "raw";

interface Props {
  data: unknown;
  rawText: string;
}

export function SmartViewer({ data, rawText }: Props) {
  const primaryArray = useMemo(() => findPrimaryArray(data), [data]);
  const [mode, setMode] = useState<ViewMode>(primaryArray ? "table" : "tree");

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: "table",
      label: "Table",
      icon: <Rows3 size={13} strokeWidth={1.6} />,
      show: !!primaryArray,
    },
    { id: "tree", label: "Tree", icon: <Layers size={13} strokeWidth={1.6} />, show: true },
    { id: "raw", label: "Raw", icon: <FileText size={13} strokeWidth={1.6} />, show: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className="btn btn--ghost"
              data-active={mode === t.id}
              style={{
                height: 28,
                padding: "0 10px",
                fontSize: 12,
                background: mode === t.id ? "var(--bg-overlay)" : "transparent",
                color: mode === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                border: `1px solid ${mode === t.id ? "var(--border)" : "transparent"}`,
              }}
            >
              {t.icon}
              <span style={{ marginLeft: 4 }}>{t.label}</span>
            </button>
          ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn--ghost"
          style={{ height: 28, padding: "0 10px", fontSize: 12 }}
          onClick={() => navigator.clipboard.writeText(rawText)}
          title="Copy raw response"
        >
          <Copy size={13} strokeWidth={1.6} />
          <span style={{ marginLeft: 4 }}>Copy</span>
        </button>
      </div>

      {mode === "tree" && <TreeView value={data} />}
      {mode === "table" && primaryArray && <TableView rows={primaryArray} />}
      {mode === "raw" && (
        <pre className="response-area" style={{ margin: 0 }}>
          {rawText}
        </pre>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TREE VIEW
   ───────────────────────────────────────────── */
function TreeView({ value }: { value: unknown }) {
  return (
    <div className="response-area">
      <TreeNode value={value} depth={0} isRoot />
    </div>
  );
}

const MAX_DEPTH = 64;

function TreeNode({
  value,
  depth,
  keyName,
  isRoot,
  isLast,
}: {
  value: unknown;
  depth: number;
  keyName?: string;
  isRoot?: boolean;
  isLast?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);

  const indent = { paddingLeft: depth === 0 ? 0 : 16 };

  if (depth > MAX_DEPTH) {
    return (
      <div style={indent}>
        <span className="json-punct">…</span>
        <span className="json-null" style={{ marginLeft: 6, fontSize: 11 }}>
          (max depth reached)
        </span>
      </div>
    );
  }
  const keyEl = keyName !== undefined ? <span className="json-key">"{keyName}"</span> : null;
  const colon = keyName !== undefined ? <span className="json-punct">: </span> : null;
  const comma = !isLast && !isRoot ? <span className="json-punct">,</span> : null;

  if (value === null) {
    return (
      <div style={indent}>
        {keyEl}
        {colon}
        <span className="json-null">null</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div style={indent}>
        {keyEl}
        {colon}
        <span className="json-str">"{value}"</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div style={indent}>
        {keyEl}
        {colon}
        <span className="json-num">{value}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <div style={indent}>
        {keyEl}
        {colon}
        <span className="json-bool">{String(value)}</span>
        {comma}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const open_brk = isArray ? "[" : "{";
  const close_brk = isArray ? "]" : "}";

  return (
    <div style={indent}>
      <div
        style={{ display: "flex", alignItems: "center", cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ display: "inline-flex", marginRight: 2, color: "var(--text-muted)" }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        {keyEl}
        {colon}
        <span className="json-punct">{open_brk}</span>
        {!open && (
          <>
            <span className="json-punct" style={{ opacity: 0.6, marginLeft: 4 }}>
              {entries.length} {isArray ? "item" + (entries.length === 1 ? "" : "s") : "key" + (entries.length === 1 ? "" : "s")}
            </span>
            <span className="json-punct">{close_brk}</span>
            {comma}
          </>
        )}
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <TreeNode
              key={k}
              value={v}
              keyName={isArray ? undefined : k}
              depth={depth + 1}
              isLast={i === entries.length - 1}
            />
          ))}
          <div>
            <span className="json-punct">{close_brk}</span>
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TABLE VIEW
   ───────────────────────────────────────────── */
function TableView({ rows }: { rows: unknown[] }) {
  const cols = useMemo(() => collectColumns(rows, 8), [rows]);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--bg-canvas)",
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-muted)",
          fontSize: 11,
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {rows.length} {rows.length === 1 ? "row" : "rows"} · {cols.length}{" "}
        {cols.length === 1 ? "column" : "columns"}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              {cols.map((c) => (
                <th key={c} style={thStyle}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((row, i) => {
              const obj =
                row && typeof row === "object" && !Array.isArray(row)
                  ? (row as Record<string, unknown>)
                  : {};
              const isOpen = expanded === i;
              const main = (
                <tr
                  key={i}
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    cursor: "pointer",
                    background: isOpen ? "var(--bg-overlay)" : "transparent",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-muted)",
                  }}
                >
                  <td style={{ ...tdStyle, color: "var(--text-muted)", width: 36 }}>{i}</td>
                  {cols.map((c) => (
                    <td key={c} style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          verticalAlign: "middle",
                        }}
                        title={previewCell(obj[c])}
                      >
                        {previewCell(obj[c])}
                      </span>
                    </td>
                  ))}
                </tr>
              );
              if (!isOpen) return [main];
              return [
                main,
                <tr key={`${i}-detail`}>
                  <td
                    colSpan={cols.length + 1}
                    style={{
                      padding: "8px 16px",
                      background: "var(--bg-canvas)",
                      borderTop: "1px solid var(--border-muted)",
                    }}
                  >
                    <TreeNode value={row} depth={0} isRoot />
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  background: "var(--bg-surface)",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  color: "var(--text-primary)",
  verticalAlign: "top",
};
