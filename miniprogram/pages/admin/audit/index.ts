import { AuditLog } from '../../../models/index';
import { listAuditLogs } from '../../../services/repository';
import { formatRelativeTime } from '../../../utils/time';
import { showError } from '../../../utils/ui';

Page({
  data: { logs: [] as Array<AuditLog & { createdAtText: string }>, loading: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try {
      const logs = await listAuditLogs();
      this.setData({ logs: logs.map((item) => ({ ...item, createdAtText: formatRelativeTime(item.createdAt) })) });
    } catch (error) { showError(error); }
    finally { this.setData({ loading: false }); }
  },
});
