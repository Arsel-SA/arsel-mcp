import { audienceTools } from './audiences.js';
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
  ...templateTools,
  ...dataModelTools,
  ...messageTools,
];
