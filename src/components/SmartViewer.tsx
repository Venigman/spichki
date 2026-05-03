import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
  Rows3,
  FileText,
  Sparkles,
  FileCode,
  FolderOpen,
  Folder,
  File as FileIcon,
} from "lucide-react";
import { collectColumns, findPrimaryArray, previewCell } from "../lib/inspect";

type ViewMode = "pretty" | "file" | "files" | "tree" | "table" | "raw";

interface FileEntry {
  name: string;
  path: string;
  type: "dir" | "file" | "symlink" | "submodule";
  size?: number;
}

/** Распознаём GitHub-style файловый листинг (массив объектов с type/name/path). */
function findFileListing(value: unknown): FileEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const entries: FileEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.name !== "string" ||
      typeof obj.path !== "string" ||
      (obj.type !== "dir" && obj.type !== "file" && obj.type !== "symlink" && obj.type !== "submodule")
    ) {
      return null;
    }
    entries.push({
      name: obj.name,
      path: obj.path,
      type: obj.type,
      size: typeof obj.size === "number" ? obj.size : undefined,
    });
  }
  // Папки сверху, потом файлы — алфавитный порядок.
  entries.sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

/** Generic «human friendly» fields commonly used by APIs to expose a ready-to-show message. */
const HUMAN_FIELDS = [
  "text",
  "message",
  "description",
  "summary",
  "detail",
  "msg",
];

function findHumanText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  for (const key of HUMAN_FIELDS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

/**
 * Распознаём GitHub-style file content: { content: "<base64>", encoding: "base64", name? }
 * Возвращаем декодированный текст или null.
 */
function findFileContent(
  value: unknown
): { name: string | null; text: string; size: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  const content = obj.content;
  const encoding = obj.encoding;
  if (typeof content !== "string" || encoding !== "base64") return null;
  try {
    // GitHub возвращает base64 с переносами строк — atob их не любит
    const cleaned = content.replace(/\s+/g, "");
    const binary = atob(cleaned);
    // utf-8 декодинг
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return {
      name: typeof obj.name === "string" ? obj.name : null,
      text,
      size: bytes.byteLength,
    };
  } catch {
    return null;
  }
}

interface Props {
  data: unknown;
  rawText: string;
  /**
   * Колбэк навигации (для File Browser). При клике по папке/файлу в табе Files
   * SmartViewer сообщает path родителю — Workspace сам делает запрос.
   * Получает path относительно родителя репо: если url ответа содержит
   * `/repos/{owner}/{repo}/contents/foo/bar`, navigate("foo/bar/baz") вернёт
   * новый запрос на `/repos/{owner}/{repo}/contents/foo/bar/baz`.
   */
  onNavigateFile?: (entry: FileEntry, currentRequestPath: string) => void;
  /** Текущий path запроса — нужен для навигации (хлебные крошки вверх). */
  currentRequestPath?: string;
}

export function SmartViewer({
  data,
  rawText,
  onNavigateFile,
  currentRequestPath,
}: Props) {
  const primaryArray = useMemo(() => findPrimaryArray(data), [data]);
  const humanText = useMemo(() => findHumanText(data), [data]);
  const fileContent = useMemo(() => findFileContent(data), [data]);
  const fileListing = useMemo(() => findFileListing(data), [data]);
  const hasPretty =
    humanText !== null ||
    (data !== null &&
      data !== undefined &&
      (typeof data === "object" || typeof data === "string"));
  // Приоритет открытия: декодированный файл → файловый листинг → pretty → table → tree.
  const [mode, setMode] = useState<ViewMode>(
    fileContent
      ? "file"
      : fileListing
        ? "files"
        : humanText
          ? "pretty"
          : primaryArray
            ? "table"
            : "tree"
  );

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: "file",
      label: "File",
      icon: <FileCode size={13} strokeWidth={1.6} />,
      show: !!fileContent,
    },
    {
      id: "files",
      label: "Files",
      icon: <FolderOpen size={13} strokeWidth={1.6} />,
      show: !!fileListing,
    },
    {
      id: "pretty",
      label: "Pretty",
      icon: <Sparkles size={13} strokeWidth={1.6} />,
      show: hasPretty,
    },
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

      {mode === "file" && fileContent && <FileView file={fileContent} />}
      {mode === "files" && fileListing && (
        <FilesView
          entries={fileListing}
          currentRequestPath={currentRequestPath}
          onNavigate={onNavigateFile}
        />
      )}
      {mode === "pretty" && <PrettyView value={data} humanText={humanText} />}
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

/* ─────────────────────────────────────────────
   PRETTY VIEW — universal human-readable
   ─────────────────────────────────────────────
   Стратегия:
   1. Если в ответе есть human-friendly поле (text/message/description/...) — показываем
      его как pre-formatted текст с переносами и эмодзи (это как раз то что API
      обычно готовит для отображения).
   2. Иначе раскладываем объект как «ключ → значение» без скобок и кавычек.
   3. Массив однородных объектов — список карточек.
   4. Скаляры — крупным значением.
   ───────────────────────────────────────────── */
function PrettyView({
  value,
  humanText,
}: {
  value: unknown;
  humanText: string | null;
}) {
  if (humanText !== null) {
    return (
      <div className="pretty-text">
        {humanText}
      </div>
    );
  }
  return (
    <div className="pretty-root">
      <PrettyAny value={value} />
    </div>
  );
}

function PrettyAny({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="pretty-muted">—</span>;
  }
  if (typeof value === "string") {
    return <span className="pretty-string">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="pretty-scalar">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="pretty-muted">пусто</span>;
    return (
      <div className="pretty-list">
        {value.map((item, i) => (
          <div key={i} className="pretty-list-item">
            <PrettyAny value={item} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="pretty-object">
        {entries.map(([k, v]) => (
          <div key={k} className="pretty-row">
            <div className="pretty-key">{prettifyKey(k)}</div>
            <div className="pretty-value">
              <PrettyAny value={v} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function prettifyKey(k: string): string {
  // user_name → User Name; firstName → First Name. Без перевода — просто читаемее.
  return k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─────────────────────────────────────────────
   FILE VIEW — декодированный текст файла
   ───────────────────────────────────────────── */
function FileView({
  file,
}: {
  file: { name: string | null; text: string; size: number };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 10px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-muted)",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {file.name || "файл"}
        </span>
        <span>{formatBytes(file.size)}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn--ghost"
          style={{ height: 22, padding: "0 8px", fontSize: 11 }}
          onClick={() => navigator.clipboard.writeText(file.text)}
          title="Копировать содержимое"
        >
          <Copy size={12} strokeWidth={1.6} />
          <span style={{ marginLeft: 4 }}>Copy</span>
        </button>
      </div>
      <pre className="response-area" style={{ margin: 0 }}>
        {file.text}
      </pre>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* ─────────────────────────────────────────────
   FILES VIEW — кликабельный браузер по репо
   ───────────────────────────────────────────── */
function FilesView({
  entries,
  currentRequestPath,
  onNavigate,
}: {
  entries: FileEntry[];
  currentRequestPath?: string;
  onNavigate?: (entry: FileEntry, currentRequestPath: string) => void;
}) {
  // Хлебные крошки строим из текущего request path. Пример:
  //   /repos/owner/repo/contents/src/components → ["src", "components"]
  // Наверх (в корень) ведёт ссылка на /repos/owner/repo/contents/
  const crumbs = useMemo(() => {
    if (!currentRequestPath) return null;
    const m = currentRequestPath.match(
      /^\/repos\/([^/]+)\/([^/]+)\/contents\/?(.*?)(?:\?.*)?$/
    );
    if (!m) return null;
    const [, owner, repo, rest] = m;
    const parts = rest ? rest.split("/").filter(Boolean) : [];
    return { owner, repo, parts };
  }, [currentRequestPath]);

  function navigateToCrumb(idx: number) {
    if (!crumbs || !onNavigate) return;
    const newPath = crumbs.parts.slice(0, idx + 1).join("/");
    // Создаём виртуальный entry для навигации
    const synthetic: FileEntry = {
      name: idx === -1 ? crumbs.repo : crumbs.parts[idx],
      path: newPath,
      type: "dir",
    };
    onNavigate(synthetic, currentRequestPath || "");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {crumbs && (
        <div className="files-crumbs">
          <button
            type="button"
            className="files-crumb"
            onClick={() => navigateToCrumb(-1)}
            title={`${crumbs.owner}/${crumbs.repo}`}
          >
            {crumbs.repo}
          </button>
          {crumbs.parts.map((part, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <button
                type="button"
                className="files-crumb"
                onClick={() => navigateToCrumb(i)}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="files-list">
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="files-entry"
            data-type={entry.type}
            onClick={() => onNavigate?.(entry, currentRequestPath || "")}
            title={entry.path}
          >
            {entry.type === "dir" ? (
              <Folder size={14} strokeWidth={1.6} className="files-entry-icon" />
            ) : (
              <FileIcon size={14} strokeWidth={1.6} className="files-entry-icon" />
            )}
            <span className="files-entry-name">{entry.name}</span>
            {entry.type === "file" && entry.size !== undefined && (
              <span className="files-entry-size">{formatBytes(entry.size)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
