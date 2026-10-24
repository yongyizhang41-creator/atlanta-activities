import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AssistantMessage from "./AssistantMessage";

const render = (content: string) =>
  renderToStaticMarkup(<AssistantMessage content={content} />);

describe("assistant Markdown", () => {
  it("renders emphasis, source links, and lists as semantic HTML", () => {
    const html = render(
      "Starts at **7:00 PM**. [Event details](https://example.com/event)\n\n- Bring tickets\n- Arrive early",
    );
    expect(html).toContain("<strong>7:00 PM</strong>");
    expect(html).toContain('href="https://example.com/event"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("<li>Bring tickets</li>");
  });
  it("does not render raw HTML or executable links or remote images", () => {
    const html = render(
      "<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![tracking](https://example.com/pixel)",
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
