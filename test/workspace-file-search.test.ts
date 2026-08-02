import { describe, it, expect } from "vitest";
import { parseAtMentionQuery, rankWorkspaceFileHits } from "../src/workspace-file-search";

describe("parseAtMentionQuery", () => {
  it("detects trailing @query", () => {
    expect(parseAtMentionQuery("look at @src/")).toBe("src/");
    expect(parseAtMentionQuery("@foo")).toBe("foo");
  });

  it("returns null without @ token", () => {
    expect(parseAtMentionQuery("hello")).toBeNull();
    expect(parseAtMentionQuery("user@email.com")).toBeNull();
  });
});

describe("rankWorkspaceFileHits", () => {
  const files = ["src/sidebar.ts", "src/session.ts", "media/chat.js", "package.json"];

  it("ranks basename prefix higher", () => {
    const r = rankWorkspaceFileHits(files, "side", 10);
    expect(r[0]).toBe("src/sidebar.ts");
  });

  it("caps results", () => {
    expect(rankWorkspaceFileHits(files, "", 2)).toHaveLength(2);
  });

  it("filters non-matches", () => {
    expect(rankWorkspaceFileHits(files, "zzz", 10)).toEqual([]);
  });
});
