export default function MessageRenderer({ entry, index, sequence, renderMessage }) {
  if (!entry || entry.type !== "message") return null;
  return renderMessage(entry.message, index, sequence);
}
