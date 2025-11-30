import React, { useEffect, useMemo, useRef, useState } from "react";
import { createBus } from "./bus";
import type { BusMessage } from "./bus";
import styles from "./AuditWidget.module.scss";

type EventEntry = {
  id: string;
  type: string;
  payload?: any;
  ts: number;
  pinned?: boolean;
};

const STORAGE_KEYS = {
  SNAPSHOT: "mfe_users_v1",
  SETTINGS: "audit_widget_settings_v1",
};

export default function AuditWidget(): React.ReactElement {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [paused, setPaused] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return false;
      return JSON.parse(raw).paused ?? false;
    } catch {
      return false;
    }
  });
  const [limit] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return 500;
      return JSON.parse(raw).limit ?? 500;
    } catch {
      return 500;
    }
  });
  const pendingRef = useRef<EventEntry[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");

  // view mode: 'list' or 'table'
  const [viewMode, setViewMode] = useState<"list" | "table">("table");

  // table state
  const [sortBy, setSortBy] = useState<"ts" | "type" | "id">("ts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify({ paused, limit })
      );
    } catch {}
  }, [paused, limit]);

  const pushEvent = (entry: EventEntry) => {
    if (seenIdsRef.current.has(entry.id)) return;
    seenIdsRef.current.add(entry.id);
    if (paused) {
      pendingRef.current.unshift(entry);
      if (pendingRef.current.length > 1000) pendingRef.current.splice(1000);
      return;
    }
    setEvents((prev) => [entry, ...prev].slice(0, Math.max(50, limit)));
  };

  useEffect(() => {
    if (!paused && pendingRef.current.length > 0) {
      setEvents((prev) => {
        const merged = [...pendingRef.current, ...prev].slice(0, limit);
        pendingRef.current = [];
        return merged;
      });
    }
  }, [paused, limit]);

  useEffect(() => {
    const bus = createBus();
    setConnected(true);

    // initial snapshot from storage
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOT);
      if (raw) {
        const users = JSON.parse(raw);
        if (Array.isArray(users) && users.length > 0) {
          const snapshotEntries: EventEntry[] = users.map((u: any) => ({
            id: `SNAP-${u.id}`,
            type: "USERS_SNAPSHOT",
            payload: { id: u.id, name: u.name, email: u.email, role: u.role },
            ts: Date.now(),
          }));
          snapshotEntries.forEach((e) => seenIdsRef.current.add(e.id));
          setEvents((prev) => [...snapshotEntries, ...prev].slice(0, limit));
        }
      }
    } catch {
      /* ignore */
    }

    const handler = (ev: MessageEvent) => {
      const msg = ev.data as BusMessage | undefined;
      if (!msg || !msg.type) return;
      const id =
        typeof msg.id === "string" && msg.id.length > 0
          ? msg.id
          : `${msg.type}-${msg.ts ?? Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;
      const ts = msg.ts ?? Date.now();
      const entry: EventEntry = {
        id,
        type: msg.type,
        payload: msg.payload,
        ts,
      };
      pushEvent(entry);
    };

    try {
      bus.addEventListener("message", handler);
    } catch {
      // fallback
      // @ts-ignore
      if (typeof (bus as any).onmessage === "function")
        (bus as any).onmessage = handler;
    }

    return () => {
      try {
        bus.removeEventListener("message", handler);
      } catch {}
      try {
        bus.close();
      } catch {}
      setConnected(false);
    };
  }, [limit, paused]);

  // derived
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) map.set(e.type, (map.get(e.type) ?? 0) + 1);
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter !== "All" && e.type !== typeFilter) return false;
      if (!q) return true;
      if (e.type.toLowerCase().includes(q)) return true;
      try {
        const s =
          typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload);
        return s.toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [events, query, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      if (sortBy === "ts") r = a.ts - b.ts;
      else if (sortBy === "type") r = a.type.localeCompare(b.type);
      else r = String(a.id).localeCompare(String(b.id));
      return sortDir === "asc" ? r : -r;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]); // clamp

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  // table helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  };
  const selectAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      pageItems.forEach((it) => {
        if (checked) {
          s.add(it.id);
        } else {
          s.delete(it.id);
        }
      });
      return s;
    });
  };
  const clearSelected = () => setSelected(new Set());

  // actions
  const clearEvents = () => {
    seenIdsRef.current.clear();
    setEvents([]);
    pendingRef.current = [];
    clearSelected();
  };
  const exportSelected = () => {
    const sel = sorted.filter((e) => selected.has(e.id));
    const data = sel.length ? sel : sorted;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const togglePin = (id: string) =>
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))
    );
  const copyPayload = async (payload: any) => {
    try {
      await navigator.clipboard.writeText(
        typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
      );
    } catch {}
  };

  const badgeClassForType = (type: string) => {
    if (type.includes("ERROR") || type.includes("FAIL"))
      return styles.badgeError;
    if (type.includes("WARN")) return styles.badgeWarn;
    if (type.includes("SNAP") || type.includes("INIT")) return styles.badgeInfo;
    return styles.badgeDefault;
  };

  // short payload helper
  const shortPayload = (p: any) => {
    try {
      if (p == null) return "<empty>";
      if (typeof p === "string")
        return p.length > 120 ? p.slice(0, 120) + "..." : p;
      const s = JSON.stringify(p);
      return s.length > 160 ? s.slice(0, 160) + "..." : s;
    } catch {
      return "<unserializable>";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Audit / Events</h3>
          <div
            className={
              connected ? styles.statusConnected : styles.statusDisconnected
            }
          >
            {connected ? "listening" : "disconnected"}
          </div>
        </div>

        <div className={styles.headerControls}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.btn} ${
                viewMode === "table" ? styles.active : ""
              }`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
            <button
              className={`${styles.btn} ${
                viewMode === "list" ? styles.active : ""
              }`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>

          <button className={styles.btn} onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className={styles.btn} onClick={clearEvents}>
            Clear
          </button>
          <button className={styles.btnPrimary} onClick={exportSelected}>
            Export (selected/all)
          </button>
        </div>
      </div>

      <div className={styles.controlsRow}>
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events or payload..."
        />
        <select
          className={styles.select}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option>All</option>
          {[...typeCounts.keys()].sort().map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <div className={styles.pagingControls}>
          <label className={styles.smallLabel}>Page size</label>
          <select
            className={styles.selectSmall}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* types summary */}
      <div className={styles.typesRow}>
        {Array.from(typeCounts.entries()).map(([t, c]) => (
          <span
            key={t}
            className={`${styles.typeBadge} ${badgeClassForType(t)}`}
          >
            {t} <span className={styles.count}>{c}</span>
          </span>
        ))}
      </div>

      {/* main pane */}
      <div className={styles.eventPane}>
        {viewMode === "list" ? (
          // original list/cards view (compact)
          <ul className={styles.list}>
            {sorted.length === 0 ? (
              <div className={styles.empty}>
                No events — perform actions in the Users app.
              </div>
            ) : (
              sorted.map((ev) => (
                <li
                  key={ev.id}
                  className={`${styles.item} ${ev.pinned ? styles.pinned : ""}`}
                >
                  <div className={styles.itemLeft}>
                    <div className={styles.itemHeader}>
                      <span
                        className={`${styles.badge} ${badgeClassForType(
                          ev.type
                        )}`}
                      >
                        {ev.type}
                      </span>
                      <div className={styles.id} title={ev.id}>
                        <strong>{ev.id}</strong>
                      </div>
                      <div className={styles.ts}>
                        {new Date(ev.ts).toLocaleString()}
                      </div>
                    </div>
                    <div className={styles.payloadShort}>
                      {shortPayload(ev.payload)}
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <button
                      className={styles.btnSmall}
                      onClick={() => togglePin(ev.id)}
                    >
                      {ev.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      className={styles.btnTiny}
                      onClick={() => copyPayload(ev.payload)}
                    >
                      Copy
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : (
          // table view
          <>
            {sorted.length === 0 ? (
              <div className={styles.empty}>
                No events — perform actions in the Users app.
              </div>
            ) : (
              <>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.colSelect}>
                          <input
                            type="checkbox"
                            checked={
                              pageItems.every((i) => selected.has(i.id)) &&
                              pageItems.length > 0
                            }
                            onChange={(e) => selectAllOnPage(e.target.checked)}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th
                          className={styles.colTs}
                          onClick={() => {
                            setSortBy("ts");
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Time{" "}
                          {sortBy === "ts"
                            ? sortDir === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </th>
                        <th
                          className={styles.colType}
                          onClick={() => {
                            setSortBy("type");
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          Type{" "}
                          {sortBy === "type"
                            ? sortDir === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </th>
                        <th
                          className={styles.colId}
                          onClick={() => {
                            setSortBy("id");
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          }}
                        >
                          ID{" "}
                          {sortBy === "id"
                            ? sortDir === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </th>
                        <th className={styles.colPayload}>Payload</th>
                        <th className={styles.colActions}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((ev) => (
                        <tr
                          key={ev.id}
                          className={ev.pinned ? styles.rowPinned : ""}
                        >
                          <td className={styles.colSelect}>
                            <input
                              type="checkbox"
                              checked={selected.has(ev.id)}
                              onChange={() => toggleSelect(ev.id)}
                            />
                          </td>
                          <td className={styles.colTs}>
                            {new Date(ev.ts).toLocaleString()}
                          </td>
                          <td className={styles.colType}>
                            <span
                              className={`${styles.badge} ${badgeClassForType(
                                ev.type
                              )}`}
                            >
                              {ev.type}
                            </span>
                          </td>
                          <td className={styles.colId} title={ev.id}>
                            {ev.id}
                          </td>
                          <td className={styles.colPayload}>
                            <div className={styles.payloadShort}>
                              {shortPayload(ev.payload)}
                            </div>
                          </td>
                          <td className={styles.colActions}>
                            <button
                              className={styles.btnTiny}
                              onClick={() => togglePin(ev.id)}
                            >
                              {ev.pinned ? "Unpin" : "Pin"}
                            </button>
                            <button
                              className={styles.btnTiny}
                              onClick={() => copyPayload(ev.payload)}
                            >
                              Copy
                            </button>
                            <details className={styles.detailsInline}>
                              <summary className={styles.btnTiny}>
                                Expand
                              </summary>
                              <pre className={styles.payloadFull}>
                                {typeof ev.payload === "string"
                                  ? ev.payload
                                  : JSON.stringify(ev.payload, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* pagination row */}
                <div className={styles.pagination}>
                  <div>
                    <button
                      className={styles.btnSmall}
                      onClick={() => {
                        setPage(1);
                      }}
                      disabled={page === 1}
                    >
                      « First
                    </button>
                    <button
                      className={styles.btnSmall}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      ‹ Prev
                    </button>
                    <span className={styles.pageInfo}>
                      Page {page} / {totalPages}
                    </span>
                    <button
                      className={styles.btnSmall}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next ›
                    </button>
                    <button
                      className={styles.btnSmall}
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      Last »
                    </button>
                  </div>

                  <div className={styles.bulkActions}>
                    <button className={styles.btn} onClick={exportSelected}>
                      Export selected
                    </button>
                    <button
                      className={styles.btn}
                      onClick={() => {
                        // remove selected items
                        if (selected.size === 0) return;
                        setEvents((prev) =>
                          prev.filter((e) => !selected.has(e.id))
                        );
                        setSelected(new Set());
                      }}
                    >
                      Clear selected
                    </button>
                    <button className={styles.btn} onClick={clearSelected}>
                      Clear selection
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
