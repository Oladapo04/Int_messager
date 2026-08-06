export default function MessageActions({
  message,
  mine,
  isStarred,
  isPinned,
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
    <span className="v480-message-actions">
      <button type="button" className="wa-meta-btn" onClick={onReact} title="React">😊</button>
      <button type="button" className="wa-meta-btn" onClick={onReply}>Reply</button>
      <button type="button" className="wa-meta-btn" onClick={onForward}>Forward</button>
      <button type="button" className="wa-meta-btn" onClick={onToggleStar}>{isStarred ? "Unstar" : "Star"}</button>
      <button type="button" className="wa-meta-btn" onClick={onTogglePin}>{isPinned ? "Unpin" : "Pin"}</button>
      {canEdit ? <button type="button" className="wa-meta-btn" onClick={onEdit}>Edit</button> : null}
      <button type="button" className="wa-meta-btn" onClick={onDeleteForMe}>Delete for me</button>
      {mine ? <button type="button" className="wa-meta-btn danger" onClick={onDeleteForEveryone}>Delete for everyone</button> : null}
    </span>
  );
}
