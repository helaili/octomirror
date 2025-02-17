import { installApp } from './installation.js';
import { OctokitBroker } from './octokitBroker.js';
import { Octomirror } from './octomirror.js';
import { createOrgRepos } from './repositories.js';
import { createRepositoryRoles } from './repositoryRole.js';
import { createOrgTeams } from './teams.js';
import { EnterpriseOctokit, OrganizationAuditLogEvent, OrganizationRenameAuditLogEvent } from './types.js';
import logger from './logger.js';

export async function allInstallableOrganizations(octokit: EnterpriseOctokit, enterpriseSlug: string): Promise<string[]> {
  let hasMoreOrgs = true;
  let page = 1;
  let orgs: string[] = []; 

  logger.info(`env is ${process.env.ENVIRONMENT} and test org is ${process.env.TEST_ORG}`);

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

export async function processOrganizationEvent(om: Octomirror, event: OrganizationAuditLogEvent) {
  switch(event.action) {
    case 'org.create':
      await processOrgCreation(om.broker, om.appClientId, event.org, om.ghesOwnerUser);
      break;
    case 'org.delete':
      await processOrgDeletion(om.broker, event.org);
      break; 
    case 'org.rename': 
      const orgRenameEvent = event as OrganizationRenameAuditLogEvent;
      const httpStatus = await processOrgRename(om.broker, orgRenameEvent.old_login, orgRenameEvent.org);
      if (httpStatus == 404) {
        // The old org wasn't found, let's create the new one
        processOrgCreation(om.broker, om.appClientId, event.org, om.ghesOwnerUser);
      }  
      break;
    default:
      logger.info(`Ignoring event ${event.action}`);
      break;
  }
}

export async function processOrgCreation(broker: OctokitBroker, appClientId: string, orgLogin: string, ghesOwnerUser: string) {
  // Install the app on the dotcom org so that we can access its repositories
  const installationId = await installApp(broker.installationOctokit, broker.enterpriseSlug, orgLogin, broker.appSlug, appClientId);
  if (installationId) {
    // Get the ocktokit for this app.
    const orgOctokit = await broker.getAppInstallationOctokit(orgLogin, installationId);
    
    // Create the org on GHES
    await createOrg(broker.ghesOctokit, orgLogin, ghesOwnerUser)
    
    //Create all repos on the GHES org
    await createOrgRepos(broker, orgLogin);

    //Create all repository roles on the GHES org
    await createRepositoryRoles(broker, orgLogin);
    
    //Create all teams on the GHES org
    await createOrgTeams(broker, orgLogin, ghesOwnerUser);
  }
}

async function processOrgDeletion(broker: OctokitBroker, orgLogin: string) {
  await deleteOrg(broker.ghesOctokit, orgLogin)
}

async function processOrgRename(broker: OctokitBroker, oldLogin: string, newLogin: string) : Promise<number> {
  return renameOrg(broker.ghesOctokit, oldLogin, newLogin)
}

export async function createOrg(octokit: EnterpriseOctokit, org: string, adminUser: string): Promise<void> {
  try {
    logger.info(`Creating org ${org} with owner ${adminUser}...`)
    const response = await octokit.request('POST /admin/organizations', {
      login: org,
      admin: adminUser
    })
  } catch (error: any) {
    if (error.status === 422 && error.response?.data.message === 'Organization name is not available') {
      logger.warn(`Organization ${org} already exists, skipping creation`)
      return;
    } else {
      logger.error(`Failed to create org ${org}`)
      throw error
    }
  }
}

export async function deleteOrg(octokit: EnterpriseOctokit, org: string): Promise<void> {
  try {
    logger.info(`Deleting org ${org}...`)
    await octokit.request(`DELETE /orgs/${org}`)
  } catch (error: any) {
    if (error.status === 404) {
      logger.warn(`Organization ${org} does not exist, skipping deletion`)
      return
    } else {
      logger.error(`Failed to delete org ${org}`)
      throw error
    }
  }
}

export async function renameOrg(octokit: EnterpriseOctokit, oldOrg: string, newOrg: string): Promise<number> {
  try {
    logger.info(`Renaming org ${oldOrg} to ${newOrg}...`)
    const response = await octokit.request(`PATCH /admin/organizations/{oldOrg}`, {
      'login': newOrg
    })
    return response.status
  } catch (error: any) {
    if (error.status === 404) {
      logger.warn(`Organization ${oldOrg} does not exist, skipping renaming`)
      return error.status
    } else {
      logger.error(`Failed to rename org ${oldOrg}`)
      throw error
    }
  }
}


