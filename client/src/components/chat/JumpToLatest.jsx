export default function JumpToLatest({ visible, unreadCount = 0, onClick }) {
  if (!visible) return null;
  return (
    <button type="button" className="v483-jump-latest" onClick={onClick}>
      <span aria-hidden="true">↓</span>
      {unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"}` : "Jump to latest"}
    </button>
  );
}
