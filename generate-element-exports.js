import fs from 'fs';
import tags from './html-tags.json' assert { type: "json" };
const SKIP_TAGS = ['var'];
let content = `
import { h } from 'guigna';
const c = (query) => (...args) => h(query, ...args);`;
for(let tag of tags) {
  if (SKIP_TAGS.includes(tag)) continue;
  content += `
export const ${tag} = c('${tag}');`;
}
fs.writeFileSync('./elements/elements.ts', content);