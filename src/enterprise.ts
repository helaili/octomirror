import { AuditLogEvent, EnterpriseOctokit, OrganizationAuditLogEvent } from "./types.js";
import logger from './logger.js';

/*
 * Return the audit log events for the given enterprise from syncFrom date to now
 * @param octokit The Octokit instance to use for the request
 * @param enterpriseSlug The slug of the enterprise to get the audit log for
 * @param syncFrom The date to sync from
 * @returns The audit log events
 */
export async function auditEvents(octokit: EnterpriseOctokit, enterpriseSlug: string, syncFrom: Date): Promise<AuditLogEvent[]> {
  let orgEvents: OrganizationAuditLogEvent[] = [];

  const iterator = await octokit.paginate.iterator(
    'GET /enterprises/{enterprise}/audit-log', {
    'enterprise': enterpriseSlug,
    'phrase': 'action:org.create action:org.delete action:org.rename \
               action:repo.create action:repo.destroy action:repo.rename \
               action:team.create action:team.destroy action:team.rename \
               action:team.add_member action:team.remove_member action:team.add_repository action:team.remove_repository action:team.update_repository_permission \
               action:team.change_parent_team action:team.change_privacy action:team.demote_maintainer action:team.promote_maintainer \
               action:role.update action:role.destroy action:role.create',
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
        logger.info('Returning audit log events');
        return orgEvents.reverse();
      }
    }
  }
  logger.info('Returning audit log events');
  return orgEvents.reverse();
}