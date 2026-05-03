import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import {
  type AIConfig,
  type AIProvider,
  loadAIConfig,
  saveAIConfig,
  clearAIConfig,
} from "../lib/ai";
import { Dropdown } from "./Dropdown";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Если задан — после сохранения вызывается. */
  onSaved?: (cfg: AIConfig) => void;
}

const MODELS: Record<AIProvider, string[]> = {
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
  ],
};

export function AISettingsModal({ open, onClose, onSaved }: Props) {
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODELS.anthropic[0]);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const cfg = loadAIConfig();
    if (cfg) {
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
      setModel(cfg.model);
    } else {
      setApiKey("");
      setModel(MODELS.anthropic[0]);
    }
    setTimeout(() => firstRef.current?.focus(), 50);
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

  const canSave = apiKey.trim().length > 10;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const cfg: AIConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || MODELS[provider][0],
    };
    saveAIConfig(cfg);
    onSaved?.(cfg);
    onClose();
  }

  function handleClear() {
    clearAIConfig();
    setApiKey("");
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        onSubmit={handleSubmit}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <h2 id="ai-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} strokeWidth={1.8} />
            <span>ИИ-помощник</span>
          </h2>
          <p>
            Ключ хранится только в твоём браузере (localStorage). Никуда не уходит,
            в репо не попадёт.
          </p>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Провайдер</label>
            <Dropdown<AIProvider>
              ariaLabel="Провайдер"
              value={provider}
              onChange={(v) => {
                setProvider(v);
                setModel(MODELS[v][0]);
              }}
              options={[{ value: "anthropic", label: "Anthropic Claude" }]}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ai-key">
              API ключ
            </label>
            <input
              id="ai-key"
              ref={firstRef}
              className="field-input"
              type="password"
              placeholder="sk-ant-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label className="field-label">Модель</label>
            <Dropdown<string>
              ariaLabel="Модель"
              value={model}
              onChange={setModel}
              options={MODELS[provider].map((m) => ({ value: m, label: m }))}
            />
          </div>
        </div>
        <div className="modal-footer">
          {loadAIConfig() && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleClear}
              title="Удалить ключ из браузера"
            >
              <Trash2 size={14} strokeWidth={1.6} />
              <span>Удалить</span>
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!canSave}
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}
