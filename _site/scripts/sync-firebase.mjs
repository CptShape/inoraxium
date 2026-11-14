import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { publicMediaPaths } from "../lib/public-media.mjs";
import { createHash } from "node:crypto";
import { buildVault } from "./vault.mjs";
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId)
  throw new Error("FIREBASE_PROJECT_ID is required. See FIREBASE_SETUP.md.");
initializeApp({
  credential: applicationDefault(),
  projectId,
});
const db = getFirestore();
const vault = await buildVault(),
  present = new Set();
for (const original of vault.pages) {
  const key = createHash("sha256").update(original.id).digest("hex");
  present.add(key);
  const page = { ...original, backlinks: [] },
    assets = {};
  for (const file of page.mediaFiles) {
    const source = vault.assets[file];
    if (!source) continue;
    assets[file] = publicMediaPaths(source);
  }
  const record = { page, assets };
  if (Buffer.byteLength(JSON.stringify(record)) > 900_000)
    throw new Error(`Page is too large for Firestore: ${page.id}`);
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`pages/${key}`),
      old = await tx.get(ref);
    tx.set(ref, {
      ...record,
      visibility: old.exists ? old.data().visibility : "dm",
      readerUids: old.exists ? old.data().readerUids : [],
    });
  });
}
for (const old of (await db.collection("pages").get()).docs)
  if (!present.has(old.id)) await old.ref.delete();
console.log(
  `Synced ${present.size} pages. New pages are DM-only; existing permissions preserved.`,
);
