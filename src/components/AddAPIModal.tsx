import { useEffect, useRef, useState } from "react";
import { useAPIs } from "../context/APIs";
import type { AuthKind } from "../lib/storage";
import { Dropdown } from "./Dropdown";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddAPIModal({ open, onClose }: Props) {
  const { addAPI } = useAPIs();
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [authKind, setAuthKind] = useState<AuthKind>("bearer");
  const [token, setToken] = useState("");
  const [headerName, setHeaderName] = useState("X-API-Key");
  const [queryName, setQueryName] = useState("api_key");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    } else {
      setName("");
      setBaseURL("");
      setToken("");
      setAuthKind("bearer");
      setHeaderName("X-API-Key");
      setQueryName("api_key");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSave = name.trim() && /^https?:\/\//i.test(baseURL.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    addAPI({
      name: name.trim(),
      baseURL: baseURL.trim(),
      auth: {
        kind: authKind,
        token: token.trim() || undefined,
        headerName: authKind === "header" ? headerName.trim() : undefined,
        queryName: authKind === "query" ? queryName.trim() : undefined,
      },
      defaultHeaders: [],
    });
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-api-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2 id="add-api-title">Подключить API</h2>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="api-name">
              Название
            </label>
            <input
              id="api-name"
              ref={firstFieldRef}
              className="field-input"
              placeholder="GitHub, Telegram, OpenAI…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="api-base">
              Base URL
            </label>
            <input
              id="api-base"
              className="field-input"
              placeholder="https://api.github.com"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label className="field-label">Авторизация</label>
            <Dropdown<AuthKind>
              ariaLabel="Авторизация"
              value={authKind}
              onChange={setAuthKind}
              options={[
                { value: "none", label: "Без авторизации" },
                { value: "bearer", label: "Bearer Token (Authorization)" },
                { value: "header", label: "Custom header" },
                { value: "query", label: "Query parameter" },
              ]}
            />
          </div>
          {authKind === "header" && (
            <div className="field">
              <label className="field-label" htmlFor="api-hname">
                Header name
              </label>
              <input
                id="api-hname"
                className="field-input"
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
              />
            </div>
          )}
          {authKind === "query" && (
            <div className="field">
              <label className="field-label" htmlFor="api-qname">
                Query name
              </label>
              <input
                id="api-qname"
                className="field-input"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
              />
            </div>
          )}
          {authKind !== "none" && (
            <div className="field">
              <label className="field-label" htmlFor="api-token">
                Token
              </label>
              <input
                id="api-token"
                className="field-input"
                type="password"
                placeholder="ghp_••••, sk-••••, и т.п."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            Подключить
          </button>
        </div>
      </form>
    </div>
  );
}
