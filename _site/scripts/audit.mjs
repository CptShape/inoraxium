import { buildVault } from "./vault.mjs";
const data = await buildVault();
for (const warning of data.warnings)
  console.log(`${warning.page} -> ${warning.target} (${warning.kind})`);
console.log(
  `\n${data.warnings.length} unresolved references in the source vault. These appear as unavailable entries on the website; publishing does not invent missing pages.`,
);
