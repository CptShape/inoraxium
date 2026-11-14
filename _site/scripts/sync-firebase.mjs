import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildVault, vaultRoot } from "./vault.mjs";
const projectId = process.env.FIREBASE_PROJECT_ID,
  bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!projectId || !bucketName)
  throw new Error(
    "FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET are required. See FIREBASE_SETUP.md.",
  );
initializeApp({
  credential: applicationDefault(),
  projectId,
  storageBucket: bucketName,
});
const db = getFirestore(),
  bucket = getStorage().bucket();
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
    const pair = {};
    for (const kind of ["src", "thumb"]) {
      const filename = path.basename(source[kind]),
        destination = `page-media/${key}/${filename}`;
      const local = path.join(vaultRoot, ".private-build", source[kind]);
      const [exists] = await bucket.file(destination).exists();
      if (!exists)
        await bucket.upload(local, {
          destination,
          metadata: { cacheControl: "private, no-store", metadata: {} },
        });
      pair[kind] = destination;
    }
    assets[file] = pair;
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
