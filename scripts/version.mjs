// Copies the version in package.json into the Android and iOS projects, so
// every release has one version number everywhere. Run by `npm run app:sync`.
// The build number is derived from it (2.1.0 becomes 20100) and so always
// increases with the version, as both stores require.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(root + "package.json", "utf8"));
const [major, minor, patch] = version.split(".").map(Number);
if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0 && n < 100 && major >= 0)) {
  throw new Error(`package.json version must be x.y.z with parts under 100, not "${version}"`);
}
const build = major * 10000 + minor * 100 + patch;

const edit = (file, pairs) => {
  const path = root + file;
  let text = readFileSync(path, "utf8");
  for (const [pattern, value] of pairs) {
    if (!pattern.test(text)) throw new Error(`${file}: could not find ${pattern}`);
    text = text.replace(pattern, value);
  }
  writeFileSync(path, text);
};

edit("android/app/build.gradle", [
  [/versionCode \d+/, `versionCode ${build}`],
  [/versionName "[^"]*"/, `versionName "${version}"`],
]);
edit("ios/App/App.xcodeproj/project.pbxproj", [
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`],
]);
console.log(`App version ${version} (build ${build}) set for Android and iOS.`);
