const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp-test');
const storage = new Map();

global.wx = {
  getStorageSync(key) { return storage.get(key) || ''; },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); },
};

function expect(name, condition) {
  if (!condition) throw new Error(`Failed: ${name}`);
  console.log(`✓ ${name}`);
}

try {
  fs.rmSync(output, { recursive: true, force: true });
  childProcess.execFileSync('tsc', ['-p', path.join(root, 'scripts/tsconfig.runtime.json')], {
    cwd: root,
    stdio: 'inherit',
  });
  const repository = require(path.join(output, 'services/mock-repository.js'));

  (async () => {
    repository.resetDemoData();
    let user = await repository.getCurrentUser();
    expect('Mock current user is initialized as admin', user.id === 'user_me' && user.role === 'admin');
    expect('Mock current user requires phone authorization on first entry', !user.phoneBound);
    user = await repository.bindMockPhoneNumber();
    expect('Mock phone authorization binds a masked number', user.phoneBound === true && user.phoneNumberMasked === '138****0000');

    const pet = (await repository.listPets())[0];
    const topic = (await repository.listTopics())[0];
    const pending = await repository.createPost({
      petId: pet.id,
      topicId: topic.id,
      content: '[待审核] 这是一条图片审核流程演示动态',
      images: [],
    });
    expect('Mock can simulate pending moderation', pending.moderationStatus === 'pending');

    let publicFeed = await repository.listFeed({ offset: 0, limit: 50 });
    expect('Pending post is hidden from public feed', !publicFeed.items.some((item) => item.id === pending.id));

    const ownFeed = await repository.listFeed({
      authorId: user.id,
      includeOwnPending: true,
      offset: 0,
      limit: 50,
    });
    expect('Pending post is visible to its author', ownFeed.items.some((item) => item.id === pending.id));

    const queue = await repository.listModerationQueue();
    expect('Pending post appears in admin moderation queue', queue.some((item) => item.id === pending.id));
    const reviewed = await repository.reviewPost(pending.id, 'approved', '人工验收通过');
    expect('Admin can approve pending post', reviewed.moderationStatus === 'approved');
    publicFeed = await repository.listFeed({ offset: 0, limit: 50 });
    expect('Approved post enters public feed', publicFeed.items.some((item) => item.id === pending.id));

    const reply = await repository.createComment('post_seed_1', '回复测试', {
      parentId: 'comment_seed_1',
      replyToUserId: 'user_friend',
      replyToNickname: '橘猫研究员',
    });
    expect('Comment reply metadata is preserved', reply.parentId === 'comment_seed_1' && reply.replyToUserId === 'user_friend');

    const report = await repository.reportTarget({
      targetType: 'post',
      targetId: 'post_seed_2',
      reason: '不当内容',
      detail: '自动化测试举报',
    });
    const duplicate = await repository.reportTarget({
      targetType: 'post',
      targetId: 'post_seed_2',
      reason: '不当内容',
      detail: '重复举报',
    });
    expect('Duplicate pending report is idempotent', report.id === duplicate.id);

    let stats = await repository.getAdminStats();
    expect('Admin dashboard counts pending reports', stats.pendingReportCount === 1);
    const resolved = await repository.resolveReport(report.id, 'resolved', '已核查');
    expect('Admin can resolve reports', resolved.status === 'resolved' && resolved.handlerId === 'user_me');
    stats = await repository.getAdminStats();
    expect('Resolved report leaves pending count', stats.pendingReportCount === 0);

    const blocked = await repository.toggleBlock('user_friend');
    expect('User can block another user', blocked === true && await repository.isUserBlocked('user_friend'));
    publicFeed = await repository.listFeed({ offset: 0, limit: 50 });
    expect('Blocked author content is hidden from feed', !publicFeed.items.some((item) => item.authorId === 'user_friend'));
    const following = await repository.listFollowing('user_me');
    expect('Blocking removes follow relation', !following.some((item) => item.id === 'user_friend'));
    const unblocked = await repository.toggleBlock('user_friend');
    expect('User can unblock another user', unblocked === false && !(await repository.isUserBlocked('user_friend')));

    const users = await repository.listAdminUsers();
    expect('Admin can list users', users.some((item) => item.id === 'user_friend'));
    const muted = await repository.updateUserAdmin('user_friend', {
      status: 'muted',
      mutedUntil: Date.now() + 3600000,
    });
    expect('Admin can mute users', muted.status === 'muted' && Number(muted.mutedUntil) > Date.now());
    const auditLogs = await repository.listAuditLogs();
    expect('Admin actions create audit logs', auditLogs.some((item) => item.action === 'resolve_report') && auditLogs.some((item) => item.action === 'review_post'));

    await repository.markAllNotificationsRead();
    expect('All notifications can be marked read', await repository.getUnreadNotificationCount() === 0);

    console.log('Mock M1-M12 integration tests passed.');
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(() => {
    fs.rmSync(output, { recursive: true, force: true });
  });
} catch (error) {
  fs.rmSync(output, { recursive: true, force: true });
  throw error;
}
