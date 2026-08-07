import DateDivider from "./DateDivider";
import MessageRenderer from "./MessageRenderer";

const FIVE_MINUTES = 5 * 60 * 1000;

function sameSequence(first, second) {
  if (!first || !second) return false;
  if (String(first.senderProfileId || first.sender || "") !== String(second.senderProfileId || second.sender || "")) return false;

  const firstTime = new Date(first.createdAt || 0).getTime();
  const secondTime = new Date(second.createdAt || 0).getTime();
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return false;

  return Math.abs(secondTime - firstTime) <= FIVE_MINUTES;
}

export default function MessageList({ groupedMessages, renderMessage }) {
  return groupedMessages.map((entry, index) => {
    if (entry.type === "day") {
      return <DateDivider key={`day-${entry.label}-${index}`} label={entry.label} />;
    }

    const previousEntry = groupedMessages[index - 1];
    const nextEntry = groupedMessages[index + 1];
    const previousMessage = previousEntry?.type === "message" ? previousEntry.message : null;
    const nextMessage = nextEntry?.type === "message" ? nextEntry.message : null;

    const isSequenceStart = !sameSequence(previousMessage, entry.message);
    const isSequenceEnd = !sameSequence(entry.message, nextMessage);

    return (
      <MessageRenderer
        key={entry.message?._id || `${entry.message?.createdAt || "message"}-${index}`}
        entry={entry}
        index={index}
        sequence={{ isSequenceStart, isSequenceEnd }}
        renderMessage={renderMessage}
      />
    );
  });
}
