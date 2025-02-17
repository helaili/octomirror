import { OctokitBroker } from './octokitBroker.js';
import { CustomRepositoryRole, EnterpriseOctokit, ListCustomRepositoryRole, RepositoryRoleAuditLogEvent } from './types.js';

export async function processRepositoryRoleEvent(broker: OctokitBroker, event: RepositoryRoleAuditLogEvent) {
  switch(event.action) {
    case 'repository_role.create':
      await createRepositoryRole(broker, event.org, event.role);
      break;
    case 'repository_role.update':
      await updateRepositoryRole(broker, event.org, event.role);
      break;
    case 'repository_role.destroy':
      await deleteRepositoryRole(broker, event.org, event.role);
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
        createRepositoryRole(broker, org, role)
      }
    }
  }
}

export async function createRepositoryRole(broker: OctokitBroker, org: string, role: CustomRepositoryRole): Promise<void> {
  console.log(`Creating custom role ${role.name} in org ${org}...`)
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
  console.log(`Updating custom repository role ${role.name} in org ${org}...`)

  // We first need to find the role id on GHES
  let customRepositoryRole = getCustomRepositioryRoleByName(org, role);

  if (customRepositoryRole === undefined) {
    console.error(`Failed to find custom repository role ${role.name} in org ${org} on GHES`);
    return;
  }

  if(!role) {
    // We need to find the role on dotcom as it was not provided
    const octokit = await broker.getAppInstallationOctokit(org);

    for await (const { data } of octokit.paginate.iterator(
      'GET /orgs/{org}/custom-repository-roles', {
      'org': org
      },
    )) {
      if (data) {
        for(const dotcomRole of data as ListCustomRepositoryRole) {
          if (dotcomRole.name === roleName) {
            role = dotcomRole;
            break;
          }        
        }
      }
    }
  }

  if(!role) {
    console.error(`Failed to find custom repository role ${roleName} in org ${org} on dotcom. The role will not be udpated on GHES`);
    return;
  }

  try {
    const response = await broker.ghesOctokit.request('PATCH /orgs/{org}/custom-repository-roles/{role_id}', {
      'org': org,
      'role_id': customRepositoryRole.id,
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

export async function deleteRepositoryRole(broker: OctokitBroker, org: string, role: string): Promise<void> {
  console.log(`Deleting custom role ${role.name} in org ${org}...`)

  // We first need to find the role id on GHES
  let customRepositoryRole = getCustomRepositioryRoleByName(org, role);

  if (customRepositoryRole === undefined) {
    console.error(`Failed to find custom repository role ${role.name} in org ${org} on GHES`);
    return;
  }

  try {
    const response = await broker.ghesOctokit.request('DELETE /orgs/{org}/custom-repository-roles/{role_id}', {
      'org': org,
      'role_id': customRepositoryRole.id
    });
  } catch (requestError: any) {
    if (requestError.status === 404) {
      console.error(`Failed to delete custom repository role ${role.name} in org ${org}:`, requestError);
    }
  }
}


async function getCustomRepositioryRoleByName(org: string, roleName: string): Promise<CustomRepositoryRole | undefined> {
  try {
    for await (const { data } of broker.ghesOctokit.paginate.iterator(
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
  } catch (error) {
    console.error(`Failed to find custom repository role ${role.name} in org ${org} on GHES:`, error);
  }
  return null;
}