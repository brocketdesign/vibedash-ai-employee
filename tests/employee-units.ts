import { parseJson } from "@/lib/employee/model";
import { isValidSubdomain, sanitizeFilePath, guessMimeType, looksLikeBase64, liveUrlFor, formatHost } from "@/lib/employee/vps";
import { slugify } from "@/lib/employee/db";
import { isValidEmail } from "@/lib/employee/outreach";
import { MANAGERS, managerMenu, managerTools, managerForKind, capabilities } from "@/lib/employee/managers";
import { TASK_KINDS } from "@/lib/employee/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

console.log("\n— model.parseJson —");
check("plain object", parseJson<{a:number}>('{"a":1}')?.a === 1);
check("fenced json", parseJson<{a:number}>('```json\n{"a":2}\n```')?.a === 2);
check("prose-wrapped", parseJson<{a:number}>('Sure! {"a":3} hope that helps')?.a === 3);
check("nested braces", parseJson<{a:{b:number}}>('text {"a":{"b":4}} tail')?.a.b === 4);
check("array", JSON.stringify(parseJson('[1,2,3]')) === "[1,2,3]");
check("garbage → null", parseJson("not json at all") === null);
check("empty → null", parseJson("") === null);

console.log("\n— vps helpers —");
check("valid subdomain", isValidSubdomain("acme-invoicing"));
check("reserved rejected", !isValidSubdomain("admin"));
check("underscore rejected", !isValidSubdomain("bad_name"));
check("leading dash rejected", !isValidSubdomain("-nope"));
check("traversal stripped", sanitizeFilePath("../../etc/passwd") === "etc/passwd", sanitizeFilePath("../../etc/passwd"));
check("leading slash stripped", sanitizeFilePath("/index.html") === "index.html");
check("backslash normalised", sanitizeFilePath("a\\b.html") === "a/b.html");
check("mime html", guessMimeType("index.html") === "text/html");
check("mime unknown", guessMimeType("x.bin") === "application/octet-stream");
check("base64 detect", looksLikeBase64("aGVsbG8="));
check("html not base64", !looksLikeBase64("<!doctype html>"));
check("live url", liveUrlFor("acme", "/a.html").endsWith("/a.html"));

console.log("\n— host formatting (IPv6 must be bracketed) —");
check("ipv4 untouched", formatHost("203.0.113.10") === "203.0.113.10");
check("hostname untouched", formatHost("vps.example.com") === "vps.example.com");
check("ipv6 bracketed", formatHost("2001:db8::10") === "[2001:db8::10]", formatHost("2001:db8::10"));
check("ipv6 full form bracketed", formatHost("2001:0db8:0000:0000:0000:0000:0000:0010").startsWith("["));
check("already bracketed left alone", formatHost("[2001:db8::1]") === "[2001:db8::1]");
check("whitespace trimmed", formatHost("  203.0.113.10  ") === "203.0.113.10");
check("ipv6 url is valid", (() => { try { new URL(`http://${formatHost("2001:db8::10")}:7854/health`); return true; } catch { return false; } })());
check("bare ipv6 url would be invalid", (() => { try { new URL("http://2001:db8::10:7854/health"); return false; } catch { return true; } })());

console.log("\n— slugify —");
check("basic", slugify("Acme Invoicing") === "acme-invoicing", slugify("Acme Invoicing"));
check("punctuation", slugify("Foo & Bar, Inc.!") === "foo-bar-inc", slugify("Foo & Bar, Inc.!"));
check("empty fallback", slugify("!!!") === "company");

console.log("\n— email validation —");
check("valid", isValidEmail("a@b.co"));
check("no tld", !isValidEmail("a@b"));
check("no at", !isValidEmail("ab.co"));

console.log("\n— manager registry —");
const ids = Object.keys(MANAGERS);
check(`${ids.length} managers registered`, ids.length === 8, ids.join(","));
check("every manager has a moneyPath", Object.values(MANAGERS).every(m => m.moneyPath.length > 40));
check("every manager id is unique", new Set(ids).size === ids.length);
const kinds = Object.values(MANAGERS).map(m => m.kind);
check("every manager kind is a valid TaskKind", kinds.every(k => TASK_KINDS.includes(k)), kinds.join(","));
check("every manager kind resolves back", kinds.every(k => managerForKind(k) !== undefined));
check("menu lists all managers", ids.every(id => managerMenu().includes(`### ${id}`)));
const tools = managerTools();
check("one tool per manager", tools.length === ids.length);
check("tools are queue_-prefixed", tools.every(t => t.function.name.startsWith("queue_")));
check("every tool requires a title", tools.every(t => (t.function.parameters.required as string[]).includes("title")));
check("every tool has object params", tools.every(t => t.function.parameters.type === "object"));

console.log("\n— capabilities gating (nothing configured) —");
const caps = capabilities();
check("all capabilities off without env", Object.values(caps).every(v => v === false), JSON.stringify(caps));
check("menu flags unavailable managers", managerMenu().includes("UNAVAILABLE"));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
