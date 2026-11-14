import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import { test, after } from "node:test";
const env = await initializeTestEnvironment({
  projectId: "demo-inoraxium",
  firestore: { rules: await readFile("firestore.rules", "utf8") },
});
after(() => env.cleanup());
const guest = env.unauthenticatedContext(),
  player = env.authenticatedContext("player", {
    email: "p@example.com",
    email_verified: true,
  }),
  other = env.authenticatedContext("other"),
  dm = env.authenticatedContext("dm");
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "roles/dm"), { dm: true });
  for (const [key, visibility, readerUids] of [
    ["secret", "dm", []],
    ["public", "public", []],
    ["shared", "users", ["player"]],
  ]) {
    await setDoc(doc(ctx.firestore(), `pages/${key}`), {
      visibility,
      readerUids,
      page: { id: `${key}.md`, body: "protected" },
      assets: {},
    });
  }
});
test("guests can query only public pages; direct DM page requests fail", async () => {
  await assertSucceeds(
    getDocs(
      query(
        collection(guest.firestore(), "pages"),
        where("visibility", "==", "public"),
      ),
    ),
  );
  await assertFails(getDocs(collection(guest.firestore(), "pages")));
  await assertFails(getDoc(doc(guest.firestore(), "pages/secret")));
});
test("a chosen player can read shared pages; a different player cannot", async () => {
  await assertSucceeds(getDoc(doc(player.firestore(), "pages/shared")));
  await assertSucceeds(
    getDocs(
      query(
        collection(player.firestore(), "pages"),
        where("visibility", "==", "users"),
        where("readerUids", "array-contains", "player"),
      ),
    ),
  );
  await assertFails(getDoc(doc(other.firestore(), "pages/shared")));
});
test("DM can read all and change ACL but no client can promote itself or overwrite content", async () => {
  await assertSucceeds(getDocs(collection(dm.firestore(), "pages")));
  await assertFails(
    setDoc(doc(player.firestore(), "roles/player"), { dm: true }),
  );
  await assertFails(
    updateDoc(doc(player.firestore(), "pages/secret"), {
      visibility: "public",
    }),
  );
  await assertFails(
    updateDoc(doc(dm.firestore(), "pages/secret"), {
      page: { body: "overwritten" },
    }),
  );
  await assertFails(
    setDoc(doc(player.firestore(), "users/player"), {
      uid: "player",
      email: "p@example.com",
      displayName: "P",
      dm: true,
    }),
  );
  await assertSucceeds(
    setDoc(doc(player.firestore(), "users/player"), {
      uid: "player",
      email: "p@example.com",
      displayName: "P",
    }),
  );
  await assertFails(getDocs(collection(player.firestore(), "users")));
});
test("revocation blocks direct page requests; Public can be reverted to DM", async () => {
  await assertSucceeds(
    updateDoc(doc(dm.firestore(), "pages/shared"), {
      visibility: "dm",
      readerUids: [],
    }),
  );
  await assertFails(getDoc(doc(player.firestore(), "pages/shared")));
  await assertSucceeds(
    updateDoc(doc(dm.firestore(), "pages/public"), {
      visibility: "dm",
      readerUids: [],
    }),
  );
  await assertFails(getDoc(doc(guest.firestore(), "pages/public")));
});
