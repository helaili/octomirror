import { Octokit } from 'octokit';
import { Organization, OrganizationLifecyleEvent } from './types.js';
import { OctokitBroker } from './octokitBroker.js';

const broker = new OctokitBroker();
while(!broker.ready()) {
  console.log('waiting for broker to be ready...');
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`broker is ready!`); 
//const repoEvents = await organizationEvents(patOctokit, 'octodemo');
//console.log(repoEvents);

// const allOrgs = await allInstallableOrganizations(broker);
// console.log(allOrgs.length);

export async function allInstallableOrganizations(broker: OctokitBroker): Promise<Organization[]> {
  let hasMoreOrgs = true;
  let page = 1;
  let orgs: Organization[] = []; 

  // We should not need to manage the pages but the endpoint doesn't seem to support pagination
  while (hasMoreOrgs) {
    const {data: orgsInPage} = await broker.installationOctokit.request('GET /enterprises/{enterprise}/apps/installable_organizations', {
      'enterprise': broker.slug,
      'per_page': 100,
      'page': page++
    });

    // add all orgs in the page to the orgs list
    orgs.push(...orgsInPage.map((org: any) => new Organization(org.name, org.login, new Date(org.created_at))));

    if (orgsInPage.length < 100) {
      hasMoreOrgs = false;
    }
  }
  return orgs;
}

export async function organizationAuditEvents(octokit: Octokit, slug: string): Promise<OrganizationLifecyleEvent[]> {
  const iterator = octokit.paginate.iterator('GET /enterprises/{enterprise}/audit-log', {
    'enterprise': slug,
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