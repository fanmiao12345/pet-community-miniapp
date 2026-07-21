const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = false;

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function expect(name, condition) {
  if (condition) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}`);
    failed = true;
  }
}

const upload = read('miniprogram/services/upload.ts');
const session = read('miniprogram/services/session.ts');
const content = read('cloudfunctions/content/index.js');
const callback = read('cloudfunctions/moderationCallback/index.js');
const interaction = read('cloudfunctions/interaction/index.js');
const governance = read('cloudfunctions/governance/index.js');
const admin = read('cloudfunctions/admin/index.js');
const auth = read('cloudfunctions/auth/index.js');
const user = read('cloudfunctions/user/index.js');
const mePage = read('miniprogram/pages/me/index.ts');
const models = read('miniprogram/models/index.ts');
const appStyle = read('miniprogram/app.wxss');
const feedPage = read('miniprogram/pages/feed/index.wxml');
const loginPage = read('miniprogram/pages/auth/login/index.wxml');
const loginLogic = read('miniprogram/pages/auth/login/index.ts');
const appLogic = read('miniprogram/app.ts');
const repositoryFacade = read('miniprogram/services/repository.ts');

expect('Cloud upload uses wx.cloud.uploadFile', upload.includes('wx.cloud.uploadFile'));
expect('Images are compressed before cloud upload', upload.includes('wx.compressImage'));
expect('Partial uploads are cleaned on failure', upload.includes('deleteCloudFiles(') && /catch[^{]*\{[\s\S]*?deleteCloudFiles\(/.test(upload));
expect('Session initializes through auth cloud function', session.includes("name: 'auth'"));
expect('Phone login page uses the official getPhoneNumber button capability', loginPage.includes('open-type="getPhoneNumber"') && loginPage.includes('bindgetphonenumber="authorizePhone"'));
expect('Phone login requires explicit privacy agreement', loginPage.includes('隐私保护说明') && loginLogic.includes('this.data.agreed'));
expect('QR entry target is preserved across login', appLogic.includes('pendingEntryUrl') && session.includes('consumePendingEntryUrl'));
expect('Repository operations require phone authorization', repositoryFacade.includes('ensurePhoneAuthorized') && repositoryFacade.includes('protectedOperation'));
expect('Auth cloud function exchanges phone code on the server', auth.includes('phonenumber.getPhoneNumber') && auth.includes('event.code'));
expect('Phone identifiers use keyed HMAC and full phone numbers are not persisted', auth.includes('createHmac') && auth.includes('PHONE_HASH_SECRET') && !auth.includes('phoneNumber: purePhoneNumber'));
expect('Auth cloud function prevents duplicate phone bindings', auth.includes('already bound') || auth.includes('已绑定其他账号'));
expect('Business cloud functions require a verified phone', content.includes('PHONE_AUTH_REQUIRED') && interaction.includes('PHONE_AUTH_REQUIRED') && user.includes('PHONE_AUTH_REQUIRED'));
expect('New cloud users default to user role', auth.includes("role: 'user'"));
expect('Deleted cloud accounts cannot log in', auth.includes("'deleted'"));
expect('Cloud post creation checks text security', content.includes('msgSecCheck'));
expect('Muted users cannot create posts', content.includes("event.action === 'createPost'") && content.includes('Account muted'));
expect('Cloud post images use asynchronous media security', content.includes('mediaCheckAsync'));
expect('Image posts start in pending moderation', content.includes("initialStatus = images.length") && content.includes("'pending'"));
expect('Moderation callback can approve posts', callback.includes("moderationStatus: 'approved'"));
expect('Moderation callback can reject posts', callback.includes("moderationStatus: 'rejected'"));
expect('Manual moderation takes precedence over late callbacks', callback.includes('Manual review takes precedence'));
expect('Interactions reject non-approved posts', interaction.includes("post.moderationStatus !== 'approved'"));
expect('Comment replies derive recipient metadata from the parent comment', interaction.includes('Reply target unavailable') && interaction.includes('parent.data.authorId'));
expect('Governance implements reports', governance.includes("event.action === 'reportTarget'"));
expect('Governance implements blocking and removes follows', governance.includes("event.action === 'toggleBlock'") && governance.includes("collection('follows')"));
expect('Admin endpoint validates role', admin.includes("user.role !== 'admin'"));
expect('Admin endpoint writes and lists audit logs', admin.includes("collection('audit_logs')") && admin.includes("event.action === 'listAuditLogs'"));
expect('Admin endpoint handles moderation and reports', admin.includes("event.action === 'reviewPost'") && admin.includes("event.action === 'resolveReport'"));
expect('Account deletion anonymizes cloud identity', user.includes('deleted:') && user.includes("status: 'deleted'"));
expect('Cloud identity is not hard-coded on the Me page', !mePage.includes("authorId: 'user_me'"));
expect('Models include governance entities', models.includes('interface Report') && models.includes('interface BlockRelation'));
expect('Models include admin and user status types', models.includes("'admin'") && models.includes("'muted'"));
expect('Basic dark mode is implemented', appStyle.includes('prefers-color-scheme: dark'));
expect('Feed includes skeleton and retry states', feedPage.includes('skeleton-list') && feedPage.includes('retry'));
expect('Admin and privacy pages are present', exists('miniprogram/pages/admin/dashboard/index.ts') && exists('miniprogram/pages/admin/audit/index.ts') && exists('miniprogram/pages/user/settings/index.ts'));
expect('CI workflow is present', exists('.github/workflows/verify.yml'));
expect('Deployment and privacy docs are present', exists('docs/DEPLOYMENT.md') && exists('docs/PRIVACY_POLICY_TEMPLATE.md'));

if (failed) process.exit(1);
console.log('M6-M12 contract tests passed.');
