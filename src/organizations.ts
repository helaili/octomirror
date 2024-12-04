import { EnterpriseOctokit, OrganizationLifecyleEvent } from './types.js';
import { Octokit, RequestError } from 'octokit';

export async function allInstallableOrganizations(octokit: Octokit, enterpriseSlug: string): Promise<string[]> {
  let hasMoreOrgs = true;
  let page = 1;
  let orgs: string[] = []; 

  console.log(`env is ${process.env.ENVIRONMENT} and test org is ${process.env.TEST_ORG}`);

  if (process.env.ENVIRONMENT === 'Development' && process.env.TEST_ORG) {
    return [process.env.TEST_ORG];
  } 

  // We should not need to manage the pages but the endpoint doesn't seem to support pagination
  while (hasMoreOrgs) {
    const {data: orgsInPage} = await octokit.request('GET /enterprises/{enterprise}/apps/installable_organizations', {
      'enterprise': enterpriseSlug,
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

export async function organizationAuditEvents(octokit: Octokit, enterpriseSlug: string): Promise<OrganizationLifecyleEvent[]> {
  // Using the PAT Otokit to get the audit log as the installation token doesn't have access to it
  const iterator = octokit.paginate.iterator('GET /enterprises/{enterprise}/audit-log', {
    'enterprise': enterpriseSlug,
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

export async function createOrg(octokit: EnterpriseOctokit, org: string, adminUser: string): Promise<void> {
  // Use octokit to create the orgs
  try {
    console.log(`Creating org ${org} with owner ${adminUser}...`)
    const response = await octokit.request('POST /admin/organizations', {
      login: org,
      admin: adminUser
    })
  } catch (error: any) {
    if (error.status === 422 && error.response?.data.message === 'Organization name is not available') {
      console.log(`Organization ${org} already exists, skipping creation`)
      return;
    } else {
      console.error(`Failed to create org ${org}`)
      throw error
    }
  }
}

