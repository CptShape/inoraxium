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
import { ref, getBytes, uploadBytes } from "firebase/storage";
import { readFile } from "node:fs/promises";
import { test, after } from "node:test";
const env = await initializeTestEnvironment({
  projectId: "demo-inoraxium",
  firestore: { rules: await readFile("firestore.rules", "utf8") },
  storage: { rules: await readFile("storage.rules", "utf8") },
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
    await uploadBytes(
      ref(ctx.storage(), `page-media/${key}/image.webp`),
      new Uint8Array([1, 2, 3]),
    );
  }
});
test("guests can query only public pages; direct DM page and media requests fail", async () => {
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
  await assertSucceeds(
    getBytes(ref(guest.storage(), "page-media/public/image.webp")),
  );
  await assertFails(
    getBytes(ref(guest.storage(), "page-media/secret/image.webp")),
  );
});
test("a chosen player can read shared pages and media; a different player cannot", async () => {
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
  await assertSucceeds(
    getBytes(ref(player.storage(), "page-media/shared/image.webp")),
  );
  await assertFails(getDoc(doc(other.firestore(), "pages/shared")));
  await assertFails(
    getBytes(ref(other.storage(), "page-media/shared/image.webp")),
  );
});
test("DM can read all and change ACL but no client can promote itself or overwrite content", async () => {
  await assertSucceeds(getDocs(collection(dm.firestore(), "pages")));
  await assertSucceeds(
    getBytes(ref(dm.storage(), "page-media/secret/image.webp")),
  );
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
test("revocation blocks direct page and image requests; Public can be reverted to DM", async () => {
  await assertSucceeds(
    updateDoc(doc(dm.firestore(), "pages/shared"), {
      visibility: "dm",
      readerUids: [],
    }),
  );
  await assertFails(getDoc(doc(player.firestore(), "pages/shared")));
  await assertFails(
    getBytes(ref(player.storage(), "page-media/shared/image.webp")),
  );
  await assertSucceeds(
    updateDoc(doc(dm.firestore(), "pages/public"), {
      visibility: "dm",
      readerUids: [],
    }),
  );
  await assertFails(getDoc(doc(guest.firestore(), "pages/public")));
  await assertFails(
    getBytes(ref(guest.storage(), "page-media/public/image.webp")),
  );
});
