const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'project.config.json',
  'tsconfig.json',
  'miniprogram/app.json',
  'miniprogram/app.ts',
  'miniprogram/pages/auth/login/index.ts',
  'miniprogram/pages/auth/privacy/index.ts',
  'miniprogram/pages/feed/index.ts',
  'miniprogram/pages/post/create.ts',
  'miniprogram/pages/post/detail.ts',
  'miniprogram/pages/pet/create.ts',
  'miniprogram/pages/user/profile/index.ts',
  'miniprogram/pages/user/relations/index.ts',
  'miniprogram/pages/notification/index.ts',
  'miniprogram/services/mock-repository.ts',
  'miniprogram/services/cloud-repository.ts',
  'miniprogram/services/session.ts',
  'miniprogram/services/upload.ts',
  'miniprogram/services/content-security.ts',
  'cloudfunctions/auth/index.js',
  'cloudfunctions/auth/config.json',
  'cloudfunctions/content/index.js',
  'cloudfunctions/contentSecurity/index.js',
  'cloudfunctions/moderationCallback/index.js',
  'cloudfunctions/interaction/index.js',
  'cloudfunctions/governance/index.js',
  'cloudfunctions/admin/index.js',
  'miniprogram/pages/user/settings/index.ts',
  'miniprogram/pages/user/blocked/index.ts',
  'miniprogram/pages/admin/dashboard/index.ts',
  'miniprogram/pages/admin/reports/index.ts',
  'miniprogram/pages/admin/moderation/index.ts',
  'miniprogram/pages/admin/users/index.ts',
  'miniprogram/pages/admin/audit/index.ts',
  '.github/workflows/verify.yml',
  'docs/ARCHITECTURE.md',
  'docs/DEPLOYMENT.md',
  'docs/PRIVACY_POLICY_TEMPLATE.md',
  'docs/RELEASE_CHECKLIST.md',
  'docs/FINAL_ACCEPTANCE.md',
  'docs/RELEASE_MANIFEST.md',
  'docs/CLOUD_SETUP.md',
  'docs/PHONE_AUTH.md',
  'docs/MODERATION_CALLBACK.md',
  'docs/CLOUD_SECURITY_RULES.md',
];

let failed = false;
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing: ${file}`);
    failed = true;
  }
}

function walk(directory) {
  const ignored = new Set(['.git', 'node_modules', '.tmp-test', 'dist', 'miniprogram_npm']);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignored.has(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const allFiles = walk(root);
const wxssFiles = allFiles.filter((file) => file.endsWith('.wxss'));
for (const file of wxssFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (/(^|[,{\s])\*\s*\{/m.test(content)) {
    console.error(`Unsupported WXSS universal selector: ${path.relative(root, file)}`);
    failed = true;
  }
}

const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));
for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON: ${path.relative(root, file)}`, error.message);
    failed = true;
  }
}

const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
for (const page of app.pages || []) {
  for (const extension of ['.ts', '.json', '.wxml', '.wxss']) {
    const file = path.join(root, 'miniprogram', `${page}${extension}`);
    if (!fs.existsSync(file)) {
      console.error(`Page asset missing: ${page}${extension}`);
      failed = true;
    }
  }
}

for (const file of allFiles.filter((item) => /cloudfunctions\/[^/]+\/index\.js$/.test(item))) {
  const result = childProcess.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Invalid JavaScript: ${path.relative(root, file)}\n${result.stderr}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Project structure, ${jsonFiles.length} JSON files, ${wxssFiles.length} WXSS files, and cloud function syntax passed checks.`);
