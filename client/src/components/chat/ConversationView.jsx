export default function ConversationView({ messageArea, composer }) {
  return (
    <section className="wa-conversation-stack" aria-label="Conversation">
      <div className="wa-conversation-message-area">{messageArea}</div>
      <div className="wa-conversation-composer-area">{composer}</div>
    </section>
  );
}
