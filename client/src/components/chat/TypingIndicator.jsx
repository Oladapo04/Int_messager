export default function TypingIndicator({ name }) {
  if (!name) return null;
  return (
    <div className="v483-typing" role="status" aria-live="polite">
      <span>{name}</span>
      <span className="v483-typing-dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}
