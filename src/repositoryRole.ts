import { OctokitBroker } from './octokitBroker.js';
import { CustomRepositoryRole, EnterpriseOctokit, ListCustomRepositoryRole, RepositoryRoleAuditLogEvent } from './types.js';

export async function processRepositoryRoleEvent(broker: OctokitBroker, event: RepositoryRoleAuditLogEvent) {
  switch(event.action) {
    case 'role.create':
      await createRepositoryRole(broker, event.org, event.name);
      break;
    case 'role.update':
      await updateRepositoryRole(broker, event.org, event.name);
      break;
    case 'role.destroy':
      await deleteRepositoryRole(broker, event.org, event.name);
      break;
    default:
      console.log(`Ignoring event ${event.action}`);
      break;
  }
}

export async function createRepositoryRoles(broker: OctokitBroker, org: string) {
  const octokit = await broker.getAppInstallationOctokit(org);
  
  for await (const { data } of octokit.paginate.iterator(
    'GET /orgs/{org}/custom-repository-roles', {
    'org': org
    },
  )) {
    if (data) {
      for(const role of data as ListCustomRepositoryRole) {
        createRepositoryRole(broker, org, role.name, role)
      }
    }
  }
}

export async function createRepositoryRole(broker: OctokitBroker, org: string, roleName: string, role?: CustomRepositoryRole): Promise<void> {
  console.log(`Creating custom role ${roleName} in org ${org}...`)

  if(!role) {
    role = await getCustomRepositoryRoleByNameOnDotcom(broker, org, roleName);
  }

  if(!role) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on dotcom. The role will not be created on GHES`);
    return;
  }

  try {
    const response = await broker.ghesOctokit.request('POST /orgs/{org}/custom-repository-roles', {
      'org': org,
      'name': role.name,
      'description': role.description,
      'base_role': role.base_role,
      'permissions': role.permissions
    });
  } catch (requestError: any) {
    if (requestError.status === 422 && requestError.response?.data.message === 'Name has already been taken') {
      await updateRepositoryRole(broker, org, role.name, role);
    } else {
      console.error(`Failed to create custom role ${role.name} in org ${org}:`, requestError);
    }
  }
}

export async function updateRepositoryRole(broker: OctokitBroker, org: string, roleName: string, role?: CustomRepositoryRole): Promise<void> {
  console.log(`Updating custom repository role ${roleName} in org ${org}...`)

  // We first need to find the role id on GHES
  let customRepositoryRoleOnGHES = await getCustomRepositoryRoleByNameOnGHES(broker, org, roleName);

  if (!customRepositoryRoleOnGHES) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on GHES`);
    return;
  }

  if(!role) {
    role = await getCustomRepositoryRoleByNameOnDotcom(broker, org, roleName);
  }

  if(!role) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on dotcom. The role will not be udpated on GHES`);
    return;
  }

  try {
    const response = await broker.ghesOctokit.request('PATCH /orgs/{org}/custom-repository-roles/{role_id}', {
      'org': org,
      'role_id': customRepositoryRoleOnGHES.id,
      'description': role.description,
      'base_role': role.base_role,
      'permissions': role.permissions
    });
  } catch (requestError: any) {
    if (requestError.status === 404) {
      console.error(`Failed to update custom role ${role.name} in org ${org}:`, requestError);
    }
  }
}

export async function deleteRepositoryRole(broker: OctokitBroker, org: string, roleName: string): Promise<void> {
  console.log(`Deleting custom role ${roleName} in org ${org}...`)

  // We first need to find the role id on GHES
  let customRepositoryRole = await getCustomRepositoryRoleByNameOnGHES(broker, org, roleName);

  if (customRepositoryRole === undefined) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on GHES`);
    return;
  }

  try {
    const response = await broker.ghesOctokit.request('DELETE /orgs/{org}/custom-repository-roles/{role_id}', {
      'org': org,
      'role_id': customRepositoryRole.id
    });
  } catch (requestError: any) {
    if (requestError.status === 404) {
      console.error(`Failed to delete custom repository role ${roleName} in org ${org}:`, requestError);
    }
  }
}

async function getCustomRepositoryRoleByName(octokit: EnterpriseOctokit, org: string, roleName: string): Promise<CustomRepositoryRole | undefined> {
  for await (const { data } of octokit.paginate.iterator(
    'GET /orgs/{org}/custom-repository-roles', {
    'org': org
  }
  )) {
    if (data) {
      for (const role of data as ListCustomRepositoryRole) {
        if (role.name === roleName) {
          return role;
        }
      }
    }
  }
 
  return;
}

async function getCustomRepositoryRoleByNameOnGHES(broker: OctokitBroker, org: string, roleName: string): Promise<CustomRepositoryRole | undefined> {
  try {
    return getCustomRepositoryRoleByName(broker.ghesOctokit, org, roleName);
  } catch (error) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on GHES:`, error);
  }
  return;
}

async function getCustomRepositoryRoleByNameOnDotcom(broker: OctokitBroker, org: string, roleName: string): Promise<CustomRepositoryRole | undefined> {
  try {
    const octokit = await broker.getAppInstallationOctokit(org);
    return getCustomRepositoryRoleByName(octokit, org, roleName);
  } catch (error) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on GHES:`, error);
  }
  return;
}