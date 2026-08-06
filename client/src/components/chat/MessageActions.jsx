import { useEffect, useRef } from "react";

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

export default function MessageActions({ onOpen }) {
  return (
    <span className="v480-message-actions" aria-label="Message actions">
      <button type="button" className="v482-message-menu-trigger" onClick={onOpen} title="Message options" aria-label="Message options">⋮</button>
    </span>
  );
}

export function DesktopMessageContextMenu({
  message, mine, isStarred, isPinned, position, onClose, onReact, onReply, onForward,
  onToggleStar, onTogglePin, onEdit, onDeleteForMe, onDeleteForEveryone,
}) {
  const canEdit = mine && message?.type === "text" && !message?.isDeleted;
  const menuRef = useRef(null);
  const style = { left: position?.x ?? 20, top: position?.y ?? 20 };

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    const closeMenu = () => onClose();
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [onClose]);

  return (
    <div className="v482-desktop-menu-layer" role="presentation" onMouseDown={onClose}>
      <section ref={menuRef} className="v482-desktop-menu" style={style} role="menu" aria-label="Message options" onMouseDown={(event) => event.stopPropagation()}>
        <div className="v482-desktop-reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`React ${emoji}`}>{emoji}</button>
          ))}
          <button type="button" onClick={() => onReact("+")} aria-label="More reactions">＋</button>
        </div>
        <div className="v482-desktop-actions">
          <button type="button" onClick={onReply}><span>↩</span>Reply</button>
          {canEdit ? <button type="button" onClick={onEdit}><span>✎</span>Edit</button> : null}
          <button type="button" onClick={() => { navigator.clipboard?.writeText(message?.content || ""); onClose(); }}><span>⧉</span>Copy</button>
          <button type="button" onClick={onForward}><span>↗</span>Forward</button>
          <button type="button" onClick={onTogglePin}><span>📌</span>{isPinned ? "Unpin" : "Pin"}</button>
          <button type="button" onClick={onToggleStar}><span>☆</span>{isStarred ? "Unstar" : "Star"}</button>
          <div className="v482-menu-divider" />
          <button type="button" className="danger" onClick={onDeleteForMe}><span>🗑</span>Delete for me</button>
          {mine ? <button type="button" className="danger" onClick={onDeleteForEveryone}><span>🗑</span>Delete for everyone</button> : null}
        </div>
      </section>
    </div>
  );
}

export function MobileMessageActionSheet({
  message,
  mine,
  isStarred,
  isPinned,
  onClose,
  onReact,
  onReply,
  onForward,
  onToggleStar,
  onTogglePin,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  const canEdit = mine && message?.type === "text" && !message?.isDeleted;

  return (
    <div className="v481-action-backdrop" role="presentation" onClick={onClose}>
      <section className="v481-action-sheet" role="dialog" aria-modal="true" aria-label="Message actions" onClick={(event) => event.stopPropagation()}>
        <div className="v481-sheet-handle" />
        <div className="v481-reaction-row">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`React ${emoji}`}>{emoji}</button>
          ))}
        </div>
        <div className="v481-action-list">
          <button type="button" onClick={onReply}><span>↩</span><strong>Reply</strong></button>
          {canEdit ? <button type="button" onClick={onEdit}><span>✎</span><strong>Edit</strong><small>Only you · 15 min</small></button> : null}
          <button type="button" onClick={() => navigator.clipboard?.writeText(message?.content || "")}><span>⧉</span><strong>Copy</strong></button>
          <button type="button" onClick={onForward}><span>↗</span><strong>Forward</strong></button>
          <button type="button" onClick={onToggleStar}><span>☆</span><strong>{isStarred ? "Unstar" : "Star"}</strong></button>
          <button type="button" onClick={onTogglePin}><span>📌</span><strong>{isPinned ? "Unpin" : "Pin"}</strong></button>
          <button type="button" className="danger" onClick={onDeleteForMe}><span>🗑</span><strong>Delete for me</strong></button>
          {mine ? <button type="button" className="danger" onClick={onDeleteForEveryone}><span>🗑</span><strong>Delete for everyone</strong><small>For everyone · 15 min</small></button> : null}
        </div>
        <button type="button" className="v481-cancel-action" onClick={onClose}>Cancel</button>
      </section>
    </div>
  );
}
