// Explicit alternative to the service-account uploader: reuse `firebase login`.
// Credentials stay in the CLI's credential store; no token is written or printed.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { buildVault } from "./vault.mjs";
import { publicMediaPaths } from "../lib/public-media.mjs";
const require = createRequire(import.meta.url);
const {
  getProjectDefaultAccount,
  getAccessToken,
} = require("firebase-tools/lib/auth");
const project = process.env.FIREBASE_PROJECT_ID;
if (!project) throw Error("Set FIREBASE_PROJECT_ID in .env.");
const account = getProjectDefaultAccount(process.cwd());
if (!account) throw Error("Run npx firebase login first.");
const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
async function request(url, method = "GET", body) {
  const token = await getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
  ]);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = Error(result.error?.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}
function value(item) {
  if (item === null) return { nullValue: null };
  if (typeof item === "string") return { stringValue: item };
  if (typeof item === "boolean") return { booleanValue: item };
  if (typeof item === "number")
    return Number.isInteger(item)
      ? { integerValue: String(item) }
      : { doubleValue: item };
  if (Array.isArray(item)) return { arrayValue: { values: item.map(value) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(item).map(([k, v]) => [k, value(v)]),
      ),
    },
  };
}
const existing = [];
let cursor = "";
do {
  const result = await request(
    `${base}/pages?pageSize=1000${cursor ? `&pageToken=${encodeURIComponent(cursor)}` : ""}`,
  );
  existing.push(...(result.documents || []));
  cursor = result.nextPageToken || "";
} while (cursor);
const oldIds = new Set(existing.map((d) => d.name.split("/").pop()));
const vault = await buildVault(),
  present = new Set();
for (const original of vault.pages) {
  const id = createHash("sha256").update(original.id).digest("hex");
  present.add(id);
  const record = { page: { ...original, backlinks: [] }, assets: {} };
  for (const file of original.mediaFiles)
    if (vault.assets[file])
      record.assets[file] = publicMediaPaths(vault.assets[file]);
  if (Buffer.byteLength(JSON.stringify(record)) > 900000)
    throw Error(`Page too large: ${original.id}`);
  const content = { fields: value(record).mapValue.fields };
  if (!oldIds.has(id)) {
    try {
      await request(`${base}/pages?documentId=${id}`, "POST", {
        fields: {
          ...content.fields,
          visibility: { stringValue: "dm" },
          readerUids: { arrayValue: { values: [] } },
        },
      });
      continue;
    } catch (error) {
      if (error.status !== 409) throw error;
    }
  }
  // Updating only content fields preserves any concurrent DM permission changes.
  await request(
    `${base}/pages/${id}?updateMask.fieldPaths=page&updateMask.fieldPaths=assets&currentDocument.exists=true`,
    "PATCH",
    content,
  );
}
for (const id of oldIds)
  if (!present.has(id)) await request(`${base}/pages/${id}`, "DELETE");
console.log(
  `Synced ${present.size} pages to ${project} using Firebase CLI login. New pages: DM; existing permissions preserved.`,
);
