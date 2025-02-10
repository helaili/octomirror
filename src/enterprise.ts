import { AuditLogEvent, EnterpriseOctokit, OrganizationAuditLogEvent } from "./types.js";

/*
 * Return the audit log events for the given enterprise from syncFrom date to now
 * @param octokit The Octokit instance to use for the request
 * @param enterpriseSlug The slug of the enterprise to get the audit log for
 * @param syncFrom The date to sync from
 * @returns The audit log events
 */
export async function auditEvents(octokit: EnterpriseOctokit, enterpriseSlug: string, syncFrom: Date): Promise<OrganizationAuditLogEvent[]> {
  let orgEvents: OrganizationAuditLogEvent[] = [];

  const iterator = await octokit.paginate.iterator(
    'GET /enterprises/{enterprise}/audit-log', {
    'enterprise': enterpriseSlug,
    'phrase': 'action:org.create action:org.delete action:org.rename action:repo.create action:repo.destroy action:repo.rename action:team.create action:team.delete',
    'order': 'desc',
    'per_page': 100,
    }
  )
  
  for await (const {data: logEvents} of iterator) {
    if(new Date((logEvents[logEvents.length - 1] as AuditLogEvent).created_at) >= syncFrom) {
      // The whole page is more recent than the date we want to sync from
      orgEvents.push(...logEvents as AuditLogEvent[]);
    }
    for(const auditLogEvent of logEvents as AuditLogEvent[]) {
      if ((new Date(auditLogEvent.created_at)) > syncFrom) {
        // We have reached the date we want to sync from
        orgEvents.push(auditLogEvent)
      } else {
        return orgEvents.reverse();
      }
    }
  }
  return orgEvents.reverse();
}