import { EnterpriseOctokit } from './types.js';
import { Octokit } from 'octokit';

export async function allInstallableOrganizations(octokit: Octokit, enterpriseSlug: string): Promise<string[]> {
  let hasMoreOrgs = true;
  let page = 1;
  let orgs: string[] = []; 

  console.log(`env is ${process.env.ENVIRONMENT} and test org is ${process.env.TEST_ORG}`);

  if (process.env.ENVIRONMENT === 'Development' && process.env.TEST_ORG) {
    return process.env.TEST_ORG.split(',');
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

export async function createOrg(octokit: EnterpriseOctokit, org: string, adminUser: string): Promise<void> {
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

export async function deleteOrg(octokit: EnterpriseOctokit, org: string): Promise<void> {
  try {
    console.log(`Deleting org ${org}...`)
    await octokit.request(`DELETE /orgs/${org}`)
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`Organization ${org} does not exist, skipping deletion`)
      return
    } else {
      console.error(`Failed to delete org ${org}`)
      throw error
    }
  }
}

export async function renameOrg(octokit: EnterpriseOctokit, oldOrg: string, newOrg: string): Promise<number> {
  try {
    console.log(`Renaming org ${oldOrg} to ${newOrg}...`)
    const response = await octokit.request(`PATCH /admin/organizations/{oldOrg}`, {
      'login': newOrg
    })
    return response.status
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`Organization ${oldOrg} does not exist, skipping renaming`)
      return error.status
    } else {
      console.error(`Failed to rename org ${oldOrg}`)
      throw error
    }
  }
}


