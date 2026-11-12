import { describe, expect, it } from "vitest";
import { messagesFor } from "./messages";

type Tree = { [key: string]: string | readonly string[] | Tree };

const leaves = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [[path, value]];
    if (Array.isArray(value)) return value.map((item, index): [string, string] => [`${path}.${index}`, item]);
    return leaves(value as Tree, path);
  });

describe("messages", () => {
  const english = leaves(messagesFor("en") as Tree);
  const polish = leaves(messagesFor("pl") as Tree);

  it("has the same keys in both languages", () => {
    expect(polish.map(([key]) => key)).toEqual(english.map(([key]) => key));
  });

  it("has Polish text for every key", () => {
    for (const [key, value] of polish) expect(value.trim(), key).not.toBe("");
  });
});
