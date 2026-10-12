import test from "node:test";
import assert from "node:assert/strict";
import { PROFILE_CATALOG, PROFILE_BY_KEY, PRIVILEGED_PROFILE_TYPES } from "./profile-catalog.js";

test("the profile catalog contains 70 unique personas", () => {
  assert.equal(PROFILE_CATALOG.length, 70);
  assert.equal(new Set(PROFILE_CATALOG.map(profile => profile.key)).size, 70);
});

test("assignable profiles have a server-side access role and at least one permitted scope", () => {
  for (const profile of PROFILE_CATALOG.filter(item => item.assignable)) {
    assert.equal(typeof profile.accessRole, "string", `${profile.key} must map to an access role`);
    assert.ok(profile.allowedScopes.length > 0, `${profile.key} must have a scope`);
  }
});

test("platform admin and super admin personas are deliberately not self-service assignable", () => {
  for (const key of PRIVILEGED_PROFILE_TYPES) {
    assert.equal(PROFILE_BY_KEY[key]?.assignable, false);
    assert.equal(PROFILE_BY_KEY[key]?.accessRole, null);
    assert.deepEqual(PROFILE_BY_KEY[key]?.allowedScopes, []);
  }
});

test("organization, branch and territory profiles only expose their supported scope types", () => {
  assert.deepEqual(PROFILE_BY_KEY.SCHOOL_TEACHER.allowedScopes, ["ORGANIZATION", "BRANCH"]);
  assert.deepEqual(PROFILE_BY_KEY.DISTRICT_PARTNER.allowedScopes, ["TERRITORY"]);
  assert.deepEqual(PROFILE_BY_KEY.PARENT_GUARDIAN.allowedScopes, ["SELF"]);
});
