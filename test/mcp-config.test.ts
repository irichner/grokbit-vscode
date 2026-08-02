import { describe, it, expect } from "vitest";
import { countMcpServersFromFiles, countMcpServersInToml } from "../src/mcp-config";

describe("countMcpServersInToml", () => {
  it("counts mcp_servers tables", () => {
    const toml = `
[mcp_servers.github]
command = "npx"

[mcp_servers.postgres]
command = "uvx"
`;
    expect(countMcpServersInToml(toml)).toBe(2);
  });

  it("returns 0 for empty or unrelated", () => {
    expect(countMcpServersInToml("")).toBe(0);
    expect(countMcpServersInToml("[other]\nx=1")).toBe(0);
    expect(countMcpServersInToml(null)).toBe(0);
  });
});

describe("countMcpServersFromFiles", () => {
  it("unions names across files", () => {
    const r = countMcpServersFromFiles(
      ["/a.toml", "/b.toml"],
      (p) => {
        if (p === "/a.toml") return "[mcp_servers.github]\n";
        if (p === "/b.toml") return "[mcp_servers.github]\n[mcp_servers.slack]\n";
        return null;
      },
    );
    expect(r.count).toBe(2);
    expect(r.sources).toEqual(["/a.toml", "/b.toml"]);
  });
});
