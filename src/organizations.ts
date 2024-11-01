import { OrganizationLifecyleEvent } from './types.js';
import { OctokitBroker } from './octokitBroker.js';

export async function allInstallableOrganizations(broker: OctokitBroker): Promise<string[]> {
  let hasMoreOrgs = true;
  let page = 1;
  let orgs: string[] = []; 

  // We should not need to manage the pages but the endpoint doesn't seem to support pagination
  while (hasMoreOrgs) {
    const {data: orgsInPage} = await broker.installationOctokit.request('GET /enterprises/{enterprise}/apps/installable_organizations', {
      'enterprise': broker.slug,
      'per_page': 100,
      'page': page++
    });

    // add all orgs in the page to the orgs list
    orgs.push(...orgsInPage.map((org: any) => org.login));

    if (orgsInPage.length < 100) {
      hasMoreOrgs = false;
    }
  }
  return orgs;
}

export async function organizationAuditEvents(broker: OctokitBroker): Promise<OrganizationLifecyleEvent[]> {
  // Using the PAT Otokit to get the audit log as the installation token doesn't have access to it
  const iterator = broker.patOctokit.paginate.iterator('GET /enterprises/{enterprise}/audit-log', {
    'enterprise': broker.slug,
    'phrase': 'action:org.create action:org.delete',
    'order': 'asc',
    'per_page': 100,
  });

  let orgEvents: OrganizationLifecyleEvent[] = [];

  for await (const {data: events} of iterator) {
    for (const event of events as any[]) {
      let action: 'created' | 'deleted';
      if (event.action === 'org.create') {
        action = 'created';
      } else if (event.action === 'org.delete') {
        action = 'deleted';
      } else {
        throw new Error(`Unexpected event type: ${event.action}`);
      }

      orgEvents.push(new OrganizationLifecyleEvent(event.org, action, new Date(event.created_at)));
    }
  }
  return orgEvents;
}