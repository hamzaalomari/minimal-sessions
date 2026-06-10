import { useMemo, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from './Icon';
import { getModel } from '../data/models';
import { useSessions } from '../state/sessions';

export function TabBar() {
  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { sessions, openIds, activeId, selectSession, closeTab, reorderTabs, setShowNew } =
    useSessions(
      useShallow((s) => ({
        sessions: s.sessions,
        openIds: s.openIds,
        activeId: s.activeId,
        selectSession: s.selectSession,
        closeTab: s.closeTab,
        reorderTabs: s.reorderTabs,
        setShowNew: s.setShowNew,
      })),
    );

  const open = useMemo(
    () =>
      openIds
        .map((id) => sessions.find((s) => s.id === id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [openIds, sessions],
  );

  const onDragStart = (id: string) => () => {
    dragId.current = id;
    setDragging(id);
  };

  const onDragOver = (id: string) => (e: DragEvent) => {
    e.preventDefault();
    if (dragOver !== id) setDragOver(id);
  };

  const onDragLeave = (id: string) => () => {
    setDragOver((d) => (d === id ? null : d));
  };

  const onDrop = (id: string) => (e: DragEvent) => {
    e.preventDefault();
    if (dragId.current) reorderTabs(dragId.current, id);
    setDragOver(null);
    setDragging(null);
    dragId.current = null;
  };

  const onDragEnd = () => {
    // Fires whether the drop landed or was cancelled.
    setDragging(null);
    setDragOver(null);
    dragId.current = null;
  };

  const onClose = (id: string) => (e: MouseEvent) => {
    e.stopPropagation();
    closeTab(id);
  };

  return (
    <div className="tabbar" role="tablist" aria-label="Open sessions">
      <div className="tabs scroll">
        {open.map((s) => {
          const m = getModel(s.model);
          const dot = m?.color ?? 'var(--faint)';
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              role="tab"
              aria-selected={isActive}
              className={
                'tab' +
                (isActive ? ' active' : '') +
                (dragging === s.id ? ' dragging' : '') +
                (dragOver === s.id && dragging !== s.id ? ' drop-target' : '')
              }
              draggable
              onClick={() => selectSession(s.id)}
              onDragStart={onDragStart(s.id)}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver(s.id)}
              onDragLeave={onDragLeave(s.id)}
              onDrop={onDrop(s.id)}
              data-testid={`tab-${s.id}`}
            >
              <span className="tab-dot" style={{ background: dot }} />
              <span className="tab-name">{s.name}</span>
              <button
                className="tab-close"
                title="Close tab"
                aria-label={`Close ${s.name}`}
                onClick={onClose(s.id)}
              >
                <Icon name="close" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="tab-add"
        title="New session"
        aria-label="New session"
        onClick={() => setShowNew(true)}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
