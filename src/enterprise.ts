import { Octokit } from "octokit";
import { AuditLogEvent, EnterpriseOctokit, OrganizationAuditLogEvent } from "./types.js";
import { eventNames } from "process";


export async function auditEvents(octokit: EnterpriseOctokit, enterpriseSlug: string, syncFrom: Date): Promise<OrganizationAuditLogEvent[]> {
  let orgEvents: OrganizationAuditLogEvent[] = [];

  const iterator = await octokit.paginate.iterator(
    'GET /enterprises/{enterprise}/audit-log', {
    'enterprise': enterpriseSlug,
    'phrase': 'action:org.create action:org.delete action:org.rename',
    'order': 'desc',
    'per_page': 100,
    }
  )
  
  for await (const {data: logEvents} of iterator) {
    for(const auditLogEvent of logEvents as OrganizationAuditLogEvent[]) {
      if ((new Date(auditLogEvent.created_at)) > syncFrom) {
        orgEvents.push(auditLogEvent)
      } else {
        return orgEvents;
      }
    }
  }
  return orgEvents;
}