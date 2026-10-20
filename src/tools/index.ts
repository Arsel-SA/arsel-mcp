import { accountTools } from './account.js';
import { audienceTools } from './audiences.js';
import { automationTools } from './automations.js';
import { campaignTools } from './campaigns.js';
import { contactTools } from './contacts.js';
import type { ArselTool } from './define.js';
import { dataModelTools } from './data-model.js';
import { messageTools } from './messages.js';
import { templateTools } from './templates.js';

export const ALL_TOOLS: readonly ArselTool[] = [
  ...contactTools,
  ...audienceTools,
  ...campaignTools,
  ...automationTools,
  ...templateTools,
  ...dataModelTools,
  ...messageTools,
  ...accountTools,
];
