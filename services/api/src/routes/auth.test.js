import test from "node:test";
import assert from "node:assert/strict";

test("safe user role allowlist does not include privileged admin roles for public signup", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./auth.js", import.meta.url), "utf8");
  assert.match(source, /z\.enum\(\["STUDENT", "PARENT", "TEACHER", "MENTOR", "RECRUITER", "PARTNER"\]\)/);
  assert.doesNotMatch(source, /role:.*SUPER_ADMIN/);
});

test("API includes defensive account verification gate", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./auth.js", import.meta.url), "utf8");
  assert.match(source, /user\.status !== "ACTIVE"/);
  assert.match(source, /passwordHash/);
});
