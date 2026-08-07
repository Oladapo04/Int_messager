export default function ReplyPreview({ sender, text, onClick }) {
  const content = (
    <>
      <strong>{sender || "Message"}</strong>
      <span>{text || "Message unavailable"}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="v483-reply-preview" onClick={onClick}>{content}</button>
  ) : (
    <div className="v483-reply-preview">{content}</div>
  );
}
