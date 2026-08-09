import { useEffect, useRef } from "react";

export default function ConversationView({ messageArea, composer }) {
  const stackRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    const stack = stackRef.current;
    const composerArea = composerRef.current;
    if (!stack || !composerArea) return undefined;

    const updateComposerHeight = () => {
      const height = Math.ceil(composerArea.getBoundingClientRect().height || 0);
      if (height > 0) stack.style.setProperty("--wa-live-composer-height", `${height}px`);
    };

    const updateViewportHeight = () => {
      const viewport = window.visualViewport;
      const visibleHeight = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
      if (visibleHeight > 0) {
        document.documentElement.style.setProperty("--wa-visible-viewport-height", `${visibleHeight}px`);
      }
      updateComposerHeight();
    };

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateComposerHeight)
      : null;

    observer?.observe(composerArea);
    updateComposerHeight();
    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateViewportHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
    };
  }, []);

  return (
    <section ref={stackRef} className="wa-conversation-stack wa-mobile-overlap-safe" aria-label="Conversation">
      <div className="wa-conversation-message-area">{messageArea}</div>
      <div ref={composerRef} className="wa-conversation-composer-area">{composer}</div>
    </section>
  );
}
