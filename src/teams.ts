import { SCIMGroup, GetTeamByName, Team, TeamToCreate, ListProvisionedGroupsEnterprise, TeamAuditLogEvent, TeamMemberAuditLogEvent, TeamAddOrUpdateRepositoryAuditLogEvent, TeamRepositoryAuditLogEvent } from "./types.js";
import { OctokitBroker } from "./octokitBroker.js";
import { Octomirror } from "./octomirror.js";
import logger from './logger.js';

const teamCache = new Map<string, Team>();
const dotcomExternalGroups = new Map<string, number>();
const ghesExternalGroups = new Map<string, number>();
const scimGroups = new Map<string, SCIMGroup>();

const PARENT_TEAM_LOOKUP_RETRY_LIMIT = parseInt(process.env.PARENT_TEAM_LOOKUP_RETRY_LIMIT || '3', 10);

const TEAM_MEMBERSHIP_QUERY = `query ($organization: String!, $team: String!, $curssor: String) {
	organization(login:$organization) {
		teams(query:$team, first: 1) {
			nodes {
				members(first:100, after:$curssor) {
					pageInfo {
						hasNextPage
						endCursor
					}
					edges {
						role
						node {
							login
						}					
					}
				}
			}
		}
	}
}
`

async function loadDotComdotcomExternalGroups(broker: OctokitBroker, org: string) {
  // Loading the external groups if we don't have them yet
  // We are assuming that all orgs have the same list of external groups
  if(dotcomExternalGroups.size === 0) {
    const orgOctokit = await broker.getAppInstallationOctokit(org);
  
    try {
      for await (const { data } of orgOctokit.paginate.iterator(
        'GET /orgs/{org}/external-groups', {
        'org': org,
        },
      )) {
        const groups = (data as any as {groups: { group_name: string; group_id: number; }[]}).groups;
        for(const group of groups) {
          dotcomExternalGroups.set(group.group_name, group.group_id);
        }
      }
    } catch (error: any) {
      logger.error(`Failed to list external IDP groups for org ${org}. Error is: ${error}`);
      if(error.status === 404) {
        logger.debug(`Org ${org} doesn't have any external group`);
      } else {
        logger.error(`Failed to list external IDP groups for org ${org}. Error is: ${error.message}`);
      }
    }
  }
}

async function loadGHESdotcomExternalGroups(broker: OctokitBroker, org: string) {
  // Loading the external groups if we don't have them yet.
  // We are assuming that all orgs have the same list of external groups
  if(ghesExternalGroups.size === 0) {
    
    try {
      for await (const { data } of broker.ghesOctokit.paginate.iterator(
        'GET /orgs/{org}/external-groups', {
        'org': org,
        },
      )) {
        const groups = (data as any as {groups: { group_name: string; group_id: number; }[]}).groups;
        for(const group of groups) {
          ghesExternalGroups.set(group.group_name, group.group_id);
        }
      }
    } catch (error: any) {
      logger.error(`Failed to list external IDP groups for org ${org} on GHES. Error is: ${error}`);
      if(error.status === 404) {
        logger.debug(`Org ${org} doesn't have any external group`);
      } else {
        logger.error(`Failed to list external IDP groups for org ${org}. Error is: ${error.message}`);
      }
    }
  }
}

async function loadEnterpriseGroups(broker: OctokitBroker) {
  if(scimGroups.size === 0) {
    try {
      let groupCount = 0;
      let startIndex = 1;
      const itemsPerPage = 100;
      do {
        const response = await broker.dotcomOctokit.enterpriseAdmin.listProvisionedGroupsEnterprise({
          'enterprise': broker.enterpriseSlug,
          'startIndex': startIndex,
          'count': itemsPerPage,
        });
        const data = response.data as any as ListProvisionedGroupsEnterprise;
        startIndex = data.startIndex + itemsPerPage;
        groupCount = data.totalResults;

        for(const group of data.Resources) {
          if(group.displayName) {
            scimGroups.set(group.displayName, group);
            logger.debug(`Adding SCIM group ${group.displayName} with externalId ${group.externalId} to cache`);
          } else {
            logger.error(`SCIM roup ${group.externalId} has no displayName`);
          }
        }
      } while(startIndex < groupCount);
    } catch (error: any) {
      logger.error(`Failed to list external IDP groups for enterprise ${broker.enterpriseSlug}. Error is: ${error}`);
    }
  }
}

export async function processTeamEvent(om: Octomirror, event: TeamAuditLogEvent) {
  switch(event.action) {
    case 'team.create':
      const teamName = event.team?.split('/').pop() || '';
      if(teamName === '') {
        logger.error(`Invalid team name for creation event: ${event.team}`);
        break;
      }
      await createTeamFromAuditLog(om.broker, event.org, teamName, om.ghesOwnerUser);
      break;
    case 'team.destroy':
      const teamNameToDelete = event.team?.split('/').pop() || '';
      if(teamNameToDelete === '') {
        logger.error(`Invalid team name for deletion event: ${event.team}`);
        break;
      }
      await deleteTeam(om.broker.ghesOctokit, event.org, teamNameToDelete);
      break;
    case 'team.rename':
      const teamRenameEvent = event as TeamAuditLogEvent;
      logger.error(`Unsupported action. Team ${teamRenameEvent.team} needs to be manually renamed in org ${teamRenameEvent.org}`);
      break;
    case 'team.add_member':
      await addMemberToTeam(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.remove_member':
      await removeMemberFromTeam(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.add_repository':
      await addRepositoryToTeam(om.broker, event as TeamAddOrUpdateRepositoryAuditLogEvent);
      break;
    case 'team.remove_repository':
      await removeRepositoryFromTeam(om.broker, event as TeamRepositoryAuditLogEvent);
      break;
    case 'team.update_repository_permission':
      await updateRepositoryPermission(om.broker, event as TeamAddOrUpdateRepositoryAuditLogEvent);
      break;
    case 'team.change_parent_team':
      await changeParentTeam(om.broker, event);
      break;
    case 'team.change_privacy':
      await changeTeamPrivacy(om.broker, event);
      break;
    case 'team.demote_maintainer':
      await demoteMaintainer(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.promote_maintainer':
      await promoteMaintainer(om.broker, event as TeamMemberAuditLogEvent);
      break;
    default:
      logger.info(`Ignoring event ${event.action}`);
      break;
  }
}

async function addMemberToTeam(broker: OctokitBroker, event: TeamMemberAuditLogEvent) {
  try {
    await broker.ghesOctokit.rest.teams.addOrUpdateMembershipForUserInOrg({
      'org': event.org,
      'team_slug': event.team,
      'username': event.user,
      'role': 'member',
    });
    logger.info(`Successfully added member ${event.user} to team ${event.team} in org ${event.org}`);
  } catch (error: any) {
    logger.error(`Failed to add member ${event.user} to team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function removeMemberFromTeam(broker: OctokitBroker, event: TeamMemberAuditLogEvent) {
  try {
    await broker.ghesOctokit.rest.teams.removeMembershipForUserInOrg({
      'org': event.org,
      'team_slug': event.team,
      'username': event.user,
    });
    logger.info(`Successfully removed member ${event.user} from team ${event.team} in org ${event.org}`);
  } catch (error: any) {
    logger.error(`Failed to remove member ${event.user} from team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function addRepositoryToTeam(broker: OctokitBroker, event: TeamAddOrUpdateRepositoryAuditLogEvent) {
  try {
    let org = event.repo.split('/')[0];
    let repo = event.repo.split('/')[1];
    const role_name = event.permission === 'read' ? 'pull' : event.permission;

    await broker.ghesOctokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
      'org': event.org,
      'team_slug': event.team,
      'owner': org,
      'repo': repo,
      'permission': role_name,
    });
    logger.info(`Successfully added repository ${repo} to team ${event.team} in org ${org} with permission ${event.permission}`);
  } catch (error: any) {
    logger.error(`Failed to add repository ${event.repo} to team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function removeRepositoryFromTeam(broker: OctokitBroker, event: TeamRepositoryAuditLogEvent) {
  try {
    let org = event.repo.split('/')[0];
    let repo = event.repo.split('/')[1];
    await broker.ghesOctokit.rest.teams.removeRepoInOrg({
      'org': event.org,
      'team_slug': event.team,
      'owner': org,
      'repo': repo,
    });
    logger.info(`Successfully removed repository ${repo} from team ${event.team} in org ${org}`);
  } catch (error: any) {
    logger.error(`Failed to remove repository ${event.repo} from team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function updateRepositoryPermission(broker: OctokitBroker, event: TeamAddOrUpdateRepositoryAuditLogEvent) {
  try {
    let org = event.repo.split('/')[0];
    let repo = event.repo.split('/')[1];
    await broker.ghesOctokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
      'org': event.org,
      'team_slug': event.team,
      'owner': org,
      'repo': repo,
      'permission': event.permission,
    });
    logger.info(`Successfully updated repository ${repo} permission to ${event.permission} for team ${event.team} in org ${org}`);
  } catch (error: any) {
    logger.error(`Failed to update repository ${event.repo} permission for team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function changeParentTeam(broker: OctokitBroker, event: TeamAuditLogEvent) {
  // The audit log event doesn't mention the old parent team, so we need to get the team data on dotcom to find it
  const octokit = await broker.getAppInstallationOctokit(event.org);
  try {
    const {data: dotcomTeam}  = await octokit.rest.teams.getByName({
      'org': event.org,
      'team_slug': event.team
    });

    if(dotcomTeam.parent) {
      // Parent was set, we need to find the parent team on GHES
      try {
        // Getting the parent team on GHES
        const { data: parentTeam } = await broker.ghesOctokit.rest.teams.getByName({
          'org': event.org,
          'team_slug': dotcomTeam.parent.slug,
        });

        // Setting the parent team on the actual team on GHES
        try {
            await broker.ghesOctokit.rest.teams.updateInOrg({
              'org': event.org,
              'team_slug': dotcomTeam.slug,
              'parent_team_id': parentTeam.id,
            });
        } catch (error: any) {
          logger.error(`Failed to update parent team ${dotcomTeam.parent.name} for team ${event.team} in org ${event.org} on GHES. The parent team will not be updated. Error is: ${error.message}`);
          return;
        }
      } catch (error: any) {
        logger.error(`Failed to get parent team ${dotcomTeam.parent.name} for team ${event.team} in org ${event.org} on GHES. The parent team will not be updated. Error is: ${error.message}`);
        return;
      }
    } else {
      // Parent was removed, this now is a top level team
      try {
        await broker.ghesOctokit.rest.teams.updateInOrg({
          'org': event.org,
          'team_slug': event.team,
          'parent_team_id': null,
        });
      } catch (error: any) {
        logger.error(`Failed to unset the parent team for team ${event.team} in org ${event.org} on GHES. The parent team will not be updated. Error is: ${error.message}`);
        return;
      }
    }
  } catch (error: any) {
    logger.error(`Failed to get team ${event.team} in org ${event.org} on dotcom. The parent team will not be updated. Error is: ${error.message}`);
    return;
  }  
}

async function changeTeamPrivacy(broker: OctokitBroker, event: TeamAuditLogEvent) {
  // The audit log event doesn't mention the value of the privacy field, so we need to get the team data on dotcom to find it
  const octokit = await broker.getAppInstallationOctokit(event.org);
  try {
    const {data: dotcomTeam}  = await octokit.rest.teams.getByName({
      'org': event.org,
      'team_slug': event.team
    });
    
    try {
      await broker.ghesOctokit.rest.teams.updateInOrg({
        'org': event.org,
        'team_slug': event.team,
        'privacy': dotcomTeam.privacy === 'secret' ? 'secret' : 'closed',
      });
    } catch (error: any) {
      logger.error(`Failed to update privacy for team ${dotcomTeam.name} for team ${event.team} in org ${event.org} on GHES. Error is: ${error.message}`);
      return;
    }
  } catch (error: any) {
    logger.error(`Failed to get team ${event.team} in org ${event.org} on dotcom. The privacy will not be updated. Error is: ${error.message}`);
    return;
  }  
}

async function demoteMaintainer(broker: OctokitBroker, event: TeamMemberAuditLogEvent) {
  try {
    await broker.ghesOctokit.rest.teams.addOrUpdateMembershipForUserInOrg({
      'org': event.org,
      'team_slug': event.team,
      'username': event.user,
      'role': 'member',
    });
    logger.info(`Successfully demoted maintainer ${event.user} to member in team ${event.team} in org ${event.org}`);
  } catch (error: any) {
    logger.error(`Failed to demote maintainer ${event.user} to member in team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

async function promoteMaintainer(broker: OctokitBroker, event: TeamMemberAuditLogEvent) {
  try {
    await broker.ghesOctokit.rest.teams.addOrUpdateMembershipForUserInOrg({
      'org': event.org,
      'team_slug': event.team,
      'username': event.user,
      'role': 'maintainer',
    });
    logger.info(`Successfully promoted member ${event.user} to maintainer in team ${event.team} in org ${event.org}`);
  } catch (error: any) {
    logger.error(`Failed to promote member ${event.user} to maintainer in team ${event.team} in org ${event.org}. Error is: ${error.message}`);
  }
}

export async function createOrgTeams(broker: OctokitBroker, org: string, owner: string) {
  const teamToRetry: Team[] = [];
  const orgOctokit = await broker.getAppInstallationOctokit(org);
  
  //loaddotcomExternalGroups(broker, org);
  await loadGHESdotcomExternalGroups(broker, org);
  //await loadEnterpriseGroups(broker);
  
  for await (const response of orgOctokit.paginate.iterator(
    orgOctokit.rest.teams.list,{ 'org': org, 'per_page': 100 },)) {
    for(const team of response.data) {
      if(team.parent && !teamCache.get(`${org}.${team.parent.name}`)) {
        // We're not trying to create the team yet as the parent team is not in the cache and it might be created later
        logger.info(`Cache missed for parent team ${team.parent.name} of team ${team.name} in org ${org}`);
        teamToRetry.push(team);
      } else {
        await createTeam(broker, org, team, owner);
      }
    }
  }
  for(const team of teamToRetry) {
    await createTeam(broker, org, team, owner);
  }
}

export async function deleteOrgTeams(broker: OctokitBroker, org: string) {
  for await (const response of broker.dotcomOctokit.paginate.iterator(
    broker.dotcomOctokit.rest.teams.list,{ 'org': org, 'per_page': 100 },)) {
    for(const team of response.data) {
      logger.info(`Deleting team ${team.name} in org ${org}...`)
      try {
        await broker.ghesOctokit.rest.teams.deleteInOrg({
          'org': org,
          'team_slug': team.slug
        });
      } catch (error: any) {
        if (error.status === 404) {
          logger.info(`Team ${team.name} does not exist, skipping deletion`)
          continue;
        } else {
          logger.error(`Failed to delete team ${team.name} in org ${org} with status: ${error.status}. Error is: ${error.message}`);
        }
      }
    }
  }
}

export async function deleteTeam(ghesOctokit: any, org: string, teamName: string) {
  logger.info(`Deleting team ${teamName} in org ${org}...`);
  try {
    await ghesOctokit.rest.teams.deleteInOrg({
      org,
      team_slug: teamName
    });
    logger.info(`Successfully deleted team ${teamName} in org ${org}`);
  } catch (error: any) {
    if (error.status === 404) {
      logger.info(`Team ${teamName} does not exist in org ${org}, skipping deletion`);
    } else {
      logger.error(`Failed to delete team ${teamName} in org ${org}. Error is: ${error.message}`);
    }
  }
}

async function createTeam(broker: OctokitBroker,  org: string, team: Team, owner: string) {
  logger.info(`Creating team ${team.name} in org ${org}...`)
  let createdTeam;

  try {
    const teamToCreate: TeamToCreate = {
      'org': org,
      'name': team.name,
      'description': team.description || '',
      'privacy': team.privacy === 'secret' ? 'secret' : 'closed',
      'maintainers': [owner],
    };

    if (team.parent) {
      const cachedParentTeam = teamCache.get(`${org}.${team.parent.name}`);
      if (cachedParentTeam) {
        teamToCreate['parent_team_id'] = cachedParentTeam.id;
      } else {
        // API Call to get the parent team if it's not in the cache
        logger.debug(`Parent team ${team.parent.name} with slug ${team.parent.slug} of team ${team.name} in org ${org} not in cache, fetching...`);
        // The parent team creation can take couple seconds to be available, so when both the parent and child are created together, we might fail at the first attempt
        let retryCount = 0;
        while(retryCount++ < PARENT_TEAM_LOOKUP_RETRY_LIMIT) {
          try {
            const { data: parentTeam } = await broker.ghesOctokit.rest.teams.getByName({
              'org': org,
              'team_slug': team.parent.slug
            });
            teamToCreate['parent_team_id'] = parentTeam.id;
            teamCache.set(`${org}.${parentTeam.name}`, parentTeam as Team);
          } catch (error: any) {
            if(retryCount <= 3) {
              logger.info(`Failed to get parent team ${team.parent?.name} for team ${team.name} in org ${org}. Retrying ${retryCount}/3 in 5 sec...`);
              setTimeout(() => {}, 5000);
            } else {
              logger.error(`Failed to get parent team ${team.parent?.name} for team ${team.name} in org ${org}. The team will not be created. Error is: ${error.message}`);
              return;
            }
          }
        }
      }
    }
    // Do create the team
    createdTeam = await broker.ghesOctokit.rest.teams.create({ ...teamToCreate });

    // Remove the owner that's automatically added by the API
    await broker.ghesOctokit.rest.teams.removeMembershipForUserInOrg({
      'org': org,
      'team_slug': team.slug,
      'username': owner
    });

  } catch (error: any) {
    if (error.status === 422 && error.response?.data.message === 'Validation Failed') {
      logger.info(`Team ${team.name} already exists, skipping creation`);
    } else {
      logger.error(`Failed to create team ${team.name} in org ${org} with status: ${error.status}. Error is: ${error.message}`);
    }
  } finally {
    if(createdTeam) {
      team.id = createdTeam.data.id;
      teamCache.set(`${org}.${team.name}`, team);
    }
    populateTeamMembers(broker, org, team);
    populateRepositories(broker, org, team);
  } 
}

export async function createTeamFromAuditLog(broker: OctokitBroker,  org: string, team: string, owner: string) {
  // Check if the team on dotcom has a parent team
  broker.dotcomOctokit.rest.teams.getByName({
    'org': org,
    'team_slug': team
  }).then((response) => {
    const dotComTeam: GetTeamByName = response.data;
    if(dotComTeam.parent == undefined) {
      dotComTeam.parent = null;
    }
    createTeam(broker, org, dotComTeam as Team, owner);
  }).catch((error: any) => {
    logger.error(`Failed to get team ${team} in org ${org}. The team will not be created. Error is: ${error.message}`);
    return;
  });
}

async function populateTeamMembers(broker: OctokitBroker, org: string, team: Team) {
  let hasExternalGroup = false;
  const orgOctokit = await broker.getAppInstallationOctokit(org);
    
  try {
    const externalGroup = await orgOctokit.request('GET /orgs/:org/teams/:team_slug/external-groups', {
      'org': org, 
      'team_slug': team.slug
    });

    if(externalGroup.data.groups.length > 0) {
      // The team is synced with an IdP group
      hasExternalGroup = true;
      mapTeamToExternalGroup(broker, org, team, externalGroup.data.groups[0].group_name);
    } 
  } catch (error: any) {
    if(error.status === 400) {
      logger.debug(`Team ${team.name} in org ${org} is not synced with a group`);
    } else {
      logger.error(`Failed to get external group for team ${team.name} in org ${org}. Error is: ${error.message}`);
    }
  }

  if (!hasExternalGroup) {
    // The team is not synced with an IdP group, we need to add each user
    await addIndividualUsersToTeam(broker, org, team);
  }
}
async function populateRepositories(broker: OctokitBroker, org: string, team: Team) {
  const orgOctokit = await broker.getAppInstallationOctokit(org);

  try {
    for await (const { data } of orgOctokit.paginate.iterator(
      'GET /orgs/{org}/teams/{team}/repos', {
      'org': org,
      'team': team.slug,
      'per_page': 100
      },
    )) {
      const repos = (data as any as {name: string; role_name: string; }[]);
      for(const repo of repos) {
        logger.debug(`Adding repository ${repo.name} with role ${repo.role_name} to team ${team.slug} in org ${org}`);

        const role_name = repo.role_name === 'read' ? 'pull' : repo.role_name;

        try {
          await broker.ghesOctokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
            org,
            team_slug: team.slug,
            owner: org,
            repo: repo.name,
            permission: role_name
          });
        } catch (error: any) {
          if (error.status === 404) {
            logger.error(`Failed to add repository ${repo.name} to team ${team.slug} in org ${org}. Repository doesn't exist on GHES`);
          } else {
            logger.error(`Failed to add repository ${repo.name} to team ${team.slug} in org ${org}. Error is: ${error.message}`);
          }
        }
      }
    }
  } catch (error: any) {
    logger.error(`Failed to list external IDP groups for org ${org}. Error is: ${error}`);
    if(error.status === 404) {
      logger.debug(`Org ${org} doesn't have any external group`);
    } else {
      logger.error(`Failed to list external IDP groups for org ${org}. Error is: ${error.message}`);
    }
  }
}

async function mapTeamToExternalGroup(broker: OctokitBroker, org: string, team: Team, groupName: string) {
  if(ghesExternalGroups.get(groupName)) {
    // Finding the id of that group on the GHES side.
    const group_id = ghesExternalGroups.get(groupName);
    logger.debug(`External group for team ${team.name} in org ${org} is ${groupName}. Its ID in GHES is ${group_id}`);
    
    try {
      await broker.ghesOctokit.request('PATCH /orgs/{org}/teams/{team_slug}/external-groups', {
        'org': org,
        'team_slug': team.slug,
        'group_id': group_id
      });
    } catch (error: any) {
      logger.error(`Failed to map external group ${groupName} to team ${team.name} in org ${org}. Error is: ${error.message}`);
    }
  } else {
    logger.error(`External group for team ${team.name} in org ${org} is ${groupName}. Its ID in GHES is not available.`);
  }
}

async function addIndividualUsersToTeam(broker: OctokitBroker, org: string, team: Team) {
    let hasNextPage = true;
    let cursor = undefined;
    const orgOctokit = await broker.getAppInstallationOctokit(org);

    while (hasNextPage) {
      let res = await orgOctokit.graphql(TEAM_MEMBERSHIP_QUERY, {organization: org, team: team.slug, cursor: cursor}) as { 
        organization: { 
          teams: { 
            nodes: Array<{ 
              members: {
                pageInfo: {
                  hasNextPage: boolean,
                  endCursor: string | null
                },
                edges: Array<{
                  role: 'MAINTAINER' | 'MEMBER',
                  node: {
                    login: string
                  }
                }>
              } 
            }> 
          } 
        } 
      };

      hasNextPage = res.organization.teams.nodes[0].members.pageInfo.hasNextPage;
      cursor = res.organization.teams.nodes[0].members.pageInfo.endCursor;

      for (const edge of res.organization.teams.nodes[0].members.edges) {
        const login = edge.node.login.split('_')[0];
        const role = edge.role === 'MAINTAINER' ? 'maintainer' : 'member';
        try {
          await broker.ghesOctokit.rest.teams.addOrUpdateMembershipForUserInOrg({
            org,
            team_slug: team.slug,
            username: login,
            role,
          });
        } catch (error: any) {
          if (error.status === 404) {
            logger.error(`Failed to add member ${login} to team ${team.slug} in org ${org}. User doesn't exist on GHES`);
          } else {
            logger.error(`Failed to add member ${login} to team ${team.slug} in org ${org}. Error is: ${error.message}`);
          }
        }
      }
    } 
}