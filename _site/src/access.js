import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { getStorage, ref, getBlob } from "firebase/storage";
import { visibleAtlas } from "./access-data.js";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const access = {
  configured: Object.values(config).every(Boolean),
  user: null,
  dm: false,
  loading: true,
  error: "",
};
let auth,
  db,
  storage,
  generation = 0,
  roleStop,
  pageStops = [],
  urls = [];
function release() {
  pageStops.forEach((stop) => stop());
  pageStops = [];
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
}
export function connectAccess(shell, receive) {
  const empty = () => receive(visibleAtlas(shell, []));
  if (!access.configured) {
    access.loading = false;
    empty();
    return;
  }
  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  function subscribe() {
    const scope = ++generation;
    release();
    access.loading = true;
    access.error = "";
    empty();
    const buckets = new Map();
    let hydrate = 0;
    const targets = access.dm
      ? [collection(db, "pages")]
      : [
          query(collection(db, "pages"), where("visibility", "==", "public")),
          ...(access.user
            ? [
                query(
                  collection(db, "pages"),
                  where("visibility", "==", "users"),
                  where("readerUids", "array-contains", access.user.uid),
                ),
              ]
            : []),
        ];
    const ready = new Set();
    const fail = (error) => {
      if (scope !== generation) return;
      access.error = error.code || error.message;
      access.loading = false;
      ++hydrate;
      release();
      empty();
    };
    targets.forEach((target, index) =>
      pageStops.push(
        onSnapshot(
          target,
          async (snapshot) => {
            buckets.set(
              index,
              snapshot.docs.map((d) => ({ ...d.data(), key: d.id })),
            );
            ready.add(index);
            // Immediately discard stale content, URLs and search results on ACL changes.
            access.loading = true;
            empty();
            if (ready.size !== targets.length) return;
            const run = ++hydrate;
            const docs = [
              ...new Map(
                [...buckets.values()].flat().map((d) => [d.key, d]),
              ).values(),
            ];
            const assets = {};
            const created = [];
            const entries = [
              ...new Map(
                docs.flatMap((d) => Object.entries(d.assets || {})),
              ).entries(),
            ];
            try {
              let cursor = 0;
              await Promise.all(
                Array.from(
                  { length: Math.min(6, entries.length) },
                  async () => {
                    while (cursor < entries.length) {
                      const [file, paths] = entries[cursor++];
                      const pair = {};
                      for (const key of ["src", "thumb"]) {
                        const blob = await getBlob(ref(storage, paths[key]));
                        pair[key] = URL.createObjectURL(blob);
                        created.push(pair[key]);
                      }
                      assets[file] = pair;
                    }
                  },
                ),
              );
              if (scope !== generation || run !== hydrate) {
                created.forEach((url) => URL.revokeObjectURL(url));
                return;
              }
              urls.forEach((url) => URL.revokeObjectURL(url));
              urls = created;
              access.loading = false;
              receive(visibleAtlas(shell, docs, assets));
            } catch (error) {
              created.forEach((url) => URL.revokeObjectURL(url));
              if (scope === generation && run === hydrate) fail(error);
            }
          },
          fail,
        ),
      ),
    );
  }
  onAuthStateChanged(auth, async (user) => {
    ++generation;
    roleStop?.();
    release();
    access.user = user;
    access.dm = false;
    access.loading = true;
    empty();
    if (!user) {
      subscribe();
      return;
    }
    // Registration creates only a profile, never a role or a permission.
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email || "",
        displayName: (user.displayName || user.email || "Oyuncu").slice(0, 200),
      });
    } catch (error) {
      access.error = error.code;
    }
    if (auth.currentUser?.uid !== user.uid) return;
    roleStop = onSnapshot(
      doc(db, "roles", user.uid),
      (snap) => {
        access.dm = snap.exists() && snap.data().dm === true;
        subscribe();
      },
      (error) => {
        access.dm = false;
        access.error = error.code;
        subscribe();
      },
    );
  });
}
export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = async () => {
  ++generation;
  release();
  await signOut(auth);
};
export const registeredUsers = async () =>
  (await getDocs(collection(db, "users"))).docs.map((d) => ({
    uid: d.id,
    ...d.data(),
  }));
export const saveAccess = (key, visibility, readerUids) =>
  updateDoc(doc(db, "pages", key), {
    visibility,
    readerUids: visibility === "users" ? [...new Set(readerUids)] : [],
  });
