import { Octokit } from 'octokit';
import { Organization, OrganizationLifecyleEvent } from './types.js';

const pat = process.env.PAT;
const patOctokit = new Octokit({
  auth: pat,
});

//const repoEvents = await organizationEvents(patOctokit, 'octodemo');
//console.log(repoEvents);

const allOrgs = await allOrganizations(patOctokit, 'octodemo');
console.log(allOrgs);

export async function allOrganizations(octokit: Octokit, slug: string): Promise<Organization[]> {
  const {enterprise} = await octokit.graphql.paginate(`query allOrgs ($enterprise:String!, $cursor:String) {
    enterprise(slug: $enterprise) {
      organizations(first: 100,after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          login
          createdAt
        }
      }
    }
  }`, {
    'enterprise': slug
  })

  return enterprise.organizations.nodes;
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