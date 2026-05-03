import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type APITab,
  type HistoryItem,
  loadAPIs,
  loadActiveId,
  loadHistory,
  saveAPIs,
  saveActiveId,
  saveHistory,
  uid,
} from "../lib/storage";
import {
  type APIPreset,
  loadUserPresets,
  saveUserPresets,
} from "../lib/presets";

export type RequestMode = "read" | "edit";
export type AppView = "workspace" | "keys" | "presets";

interface APIsContextValue {
  apis: APITab[];
  activeId: string | null;
  active: APITab | null;
  history: HistoryItem[];
  mode: RequestMode;
  setMode: (mode: RequestMode) => void;
  view: AppView;
  setView: (view: AppView) => void;
  userPresets: APIPreset[];
  saveUserPreset: (preset: APIPreset) => void;
  removeUserPreset: (id: string) => void;
  seedPresets: APIPreset[];
  removeSeedPreset: (id: string) => Promise<void>;
  saveSeedPreset: (preset: APIPreset) => Promise<void>;
  addAPI: (
    input: Omit<APITab, "id" | "createdAt" | "defaultHeaders"> & {
      defaultHeaders?: APITab["defaultHeaders"];
    }
  ) => APITab;
  removeAPI: (id: string) => void;
  updateAPI: (id: string, patch: Partial<APITab>) => void;
  setActiveId: (id: string | null) => void;
  pushHistory: (item: Omit<HistoryItem, "id" | "at">) => void;
  clearHistory: (apiId?: string) => void;
}

const Ctx = createContext<APIsContextValue | null>(null);

export function APIsProvider({ children }: { children: ReactNode }) {
  const [apis, setApis] = useState<APITab[]>(() => loadAPIs());
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    loadActiveId()
  );
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [mode, setMode] = useState<RequestMode>("read");
  const [view, setView] = useState<AppView>("workspace");
  const [userPresets, setUserPresets] = useState<APIPreset[]>(() =>
    loadUserPresets()
  );
  const [seedPresets, setSeedPresets] = useState<APIPreset[]>([]);

  useEffect(() => saveAPIs(apis), [apis]);
  useEffect(() => saveActiveId(activeId), [activeId]);
  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveUserPresets(userPresets), [userPresets]);

  // Pull Claude-managed presets from the dev-server file. Polling cheaply so
  // edits made via /api/presets show up without manual refresh.
  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetch("/api/presets")
        .then((r) => (r.ok ? (r.json() as Promise<APIPreset[]>) : []))
        .then((list) => {
          if (alive && Array.isArray(list)) setSeedPresets(list);
        })
        .catch(() => {});
    pull();
    const t = setInterval(pull, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Reconcile activeId when the underlying apis list changes:
  // if active was removed, fall back to the first remaining tab.
  useEffect(() => {
    if (activeId && !apis.some((a) => a.id === activeId)) {
      setActiveIdState(apis[0]?.id ?? null);
    }
  }, [apis, activeId]);

  // Live-sync: when a preset (user or seed) changes, propagate to every tab
  // that was created from it. We sync everything EXCEPT token + name.
  // If the preset was deleted, the tab stays — just becomes "orphaned".
  useEffect(() => {
    const allPresets = [...userPresets, ...seedPresets];
    setApis((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (!tab.presetId) return tab;
        const preset = allPresets.find((p) => p.id === tab.presetId);
        if (!preset) return tab; // orphan — keep as-is
        const updated: APITab = {
          ...tab,
          baseURL: preset.baseURL.replace(/\/+$/, ""),
          auth: {
            ...tab.auth,
            kind: preset.auth.kind,
            headerName: preset.auth.headerName,
            queryName: preset.auth.queryName,
            // token preserved
          },
          defaultHeaders: preset.defaultHeaders ?? [],
          endpoints: preset.endpoints,
          endpointCategories: preset.endpointCategories,
        };
        if (JSON.stringify(updated) !== JSON.stringify(tab)) {
          changed = true;
          return updated;
        }
        return tab;
      });
      return changed ? next : prev;
    });
  }, [userPresets, seedPresets]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
  }, []);

  const addAPI: APIsContextValue["addAPI"] = useCallback((input) => {
    const next: APITab = {
      ...input,
      defaultHeaders: input.defaultHeaders ?? [],
      id: uid(),
      createdAt: Date.now(),
    };
    setApis((prev) => [...prev, next]);
    setActiveIdState(next.id);
    return next;
  }, []);

  const removeAPI = useCallback((id: string) => {
    setApis((prev) => prev.filter((a) => a.id !== id));
    setHistory((prev) => prev.filter((x) => x.apiId !== id));
    // Active reconciliation handled by the useEffect above — single source of truth.
  }, []);

  const updateAPI = useCallback((id: string, patch: Partial<APITab>) => {
    setApis((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const pushHistory: APIsContextValue["pushHistory"] = useCallback((item) => {
    setHistory((prev) =>
      [{ id: uid(), at: Date.now(), ...item }, ...prev].slice(0, 200)
    );
  }, []);

  const clearHistory = useCallback((apiId?: string) => {
    setHistory((prev) => (apiId ? prev.filter((x) => x.apiId !== apiId) : []));
  }, []);

  const saveUserPreset = useCallback((preset: APIPreset) => {
    setUserPresets((prev) => {
      const idx = prev.findIndex((p) => p.id === preset.id);
      if (idx === -1) return [...prev, preset];
      const next = prev.slice();
      next[idx] = preset;
      return next;
    });
  }, []);

  const removeUserPreset = useCallback((id: string) => {
    setUserPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removeSeedPreset = useCallback(async (id: string) => {
    // Optimistic — drop immediately, server pull (every 4s) will reconcile.
    setSeedPresets((prev) => prev.filter((p) => p.id !== id));
    try {
      await fetch(`/api/presets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore — next poll will resurrect if delete didn't reach the server
    }
  }, []);

  const saveSeedPreset = useCallback(async (preset: APIPreset) => {
    // Optimistic upsert in local state, then push to /api/presets file.
    setSeedPresets((prev) => {
      const idx = prev.findIndex((p) => p.id === preset.id);
      if (idx === -1) return [...prev, preset];
      const next = prev.slice();
      next[idx] = preset;
      return next;
    });
    try {
      await fetch("/api/presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preset),
      });
    } catch {
      // server will reconcile on next poll
    }
  }, []);

  const active = useMemo(
    () => apis.find((a) => a.id === activeId) ?? null,
    [apis, activeId]
  );

  const value = useMemo<APIsContextValue>(
    () => ({
      apis,
      activeId,
      active,
      history,
      mode,
      setMode,
      view,
      setView,
      userPresets,
      saveUserPreset,
      removeUserPreset,
      seedPresets,
      removeSeedPreset,
      saveSeedPreset,
      addAPI,
      removeAPI,
      updateAPI,
      setActiveId,
      pushHistory,
      clearHistory,
    }),
    [
      apis,
      activeId,
      active,
      history,
      mode,
      view,
      userPresets,
      saveUserPreset,
      removeUserPreset,
      seedPresets,
      removeSeedPreset,
      saveSeedPreset,
      addAPI,
      removeAPI,
      updateAPI,
      setActiveId,
      pushHistory,
      clearHistory,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAPIs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAPIs must be inside APIsProvider");
  return ctx;
}
