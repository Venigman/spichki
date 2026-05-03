import { useEffect, useMemo, useState } from "react";
import { Plus, X, Check, Zap } from "lucide-react";
import { useAPIs } from "../context/APIs";

interface Props {
  onAddClick: () => void;
}

export function TabBar({ onAddClick }: Props) {
  const { apis, activeId, setActiveId, removeAPI, userPresets, seedPresets } =
    useAPIs();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const presetIds = useMemo(
    () => new Set([...userPresets, ...seedPresets].map((p) => p.id)),
    [userPresets, seedPresets]
  );

  // Auto-cancel pending delete after 2.5s
  useEffect(() => {
    if (!confirmingId) return;
    const t = setTimeout(() => setConfirmingId(null), 2500);
    return () => clearTimeout(t);
  }, [confirmingId]);

  return (
    <div className="tabstrip-wrap">
    <div className="tabstrip" role="tablist" aria-label="API connections">
      {apis.map((api) => {
        const active = api.id === activeId;
        const confirming = confirmingId === api.id;
        const orphan = !!api.presetId && !presetIds.has(api.presetId);
        const noPreset = !api.presetId;
        return (
          <button
            key={api.id}
            role="tab"
            aria-selected={active}
            data-active={active}
            className="tab"
            onClick={() => setActiveId(api.id)}
            title={
              orphan
                ? `${api.baseURL} — пресет-источник удалён`
                : api.baseURL
            }
          >
            <Zap
              size={11}
              strokeWidth={2}
              className="tab-zap"
              data-orphan={orphan || noPreset}
            />
            <span>{api.name}</span>
            <span
              className="tab-close"
              data-confirming={confirming}
              role="button"
              tabIndex={0}
              aria-label={confirming ? `Confirm delete ${api.name}` : `Close ${api.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirming) {
                  removeAPI(api.id);
                  setConfirmingId(null);
                } else {
                  setConfirmingId(api.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirming) {
                    removeAPI(api.id);
                    setConfirmingId(null);
                  } else {
                    setConfirmingId(api.id);
                  }
                }
              }}
            >
              {confirming ? (
                <Check size={12} strokeWidth={2.4} />
              ) : (
                <X size={12} strokeWidth={2} />
              )}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className="tab-add"
        onClick={onAddClick}
        aria-label="Add API"
        title="Add API"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
    </div>
  );
}
