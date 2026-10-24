import React from "react";
import Markdown from "react-markdown";

/** Render model output without interpreting raw HTML or loading remote images. */
export default function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <Markdown
        skipHtml
        components={{
          a: ({ href, children }) =>
            href && /^https?:\/\//i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
