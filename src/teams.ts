import { SCIMGroup, GetTeamByName, Team, TeamToCreate, ListProvisionedGroupsEnterprise } from "./types.js";
import { OctokitBroker } from "./octokitBroker.js";

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
      console.error(`Failed to list external IDP groups for org ${org}. Error is: ${error}`);
      if(error.status === 404) {
        console.debug(`Org ${org} doesn't have any external group`);
      } else {
        console.error(`Failed to list external IDP groups for org ${org}. Error is: ${error.message}`);
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
      console.error(`Failed to list external IDP groups for org ${org} on GHES. Error is: ${error}`);
      if(error.status === 404) {
        console.debug(`Org ${org} doesn't have any external group`);
      } else {
        console.error(`Failed to list external IDP groups for org ${org}. Error is: ${error.message}`);
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
            console.debug(`Adding SCIM group ${group.displayName} with externalId ${group.externalId} to cache`);
          } else {
            console.error(`SCIM roup ${group.externalId} has no displayName`);
          }
        }
      } while(startIndex < groupCount);
    } catch (error: any) {
      console.error(`Failed to list external IDP groups for enterprise ${broker.enterpriseSlug}. Error is: ${error}`);
    }
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
        console.info(`Cache missed for parent team ${team.parent.name} of team ${team.name} in org ${org}`);
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
      console.info(`Deleting team ${team.name} in org ${org}...`)
      try {
        await broker.ghesOctokit.rest.teams.deleteInOrg({
          'org': org,
          'team_slug': team.slug
        });
      } catch (error: any) {
        if (error.status === 404) {
          console.info(`Team ${team.name} does not exist, skipping deletion`)
          continue;
        } else {
          console.error(`Failed to delete team ${team.name} in org ${org} with status: ${error.status}. Error is: ${error.message}`);
        }
      }
    }
  }
}

export async function deleteTeam(ghesOctokit: any, org: string, teamName: string) {
  console.info(`Deleting team ${teamName} in org ${org}...`);
  try {
    await ghesOctokit.rest.teams.deleteInOrg({
      org,
      team_slug: teamName
    });
    console.info(`Successfully deleted team ${teamName} in org ${org}`);
  } catch (error: any) {
    if (error.status === 404) {
      console.info(`Team ${teamName} does not exist in org ${org}, skipping deletion`);
    } else {
      console.error(`Failed to delete team ${teamName} in org ${org}. Error is: ${error.message}`);
    }
  }
}

async function createTeam(broker: OctokitBroker,  org: string, team: Team, owner: string) {
  console.info(`Creating team ${team.name} in org ${org}...`)
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
        console.debug(`Parent team ${team.parent.name} with slug ${team.parent.slug} of team ${team.name} in org ${org} not in cache, fetching...`);
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
              console.info(`Failed to get parent team ${team.parent?.name} for team ${team.name} in org ${org}. Retrying ${retryCount}/3 in 5 sec...`);
              setTimeout(() => {}, 5000);
            } else {
              console.error(`Failed to get parent team ${team.parent?.name} for team ${team.name} in org ${org}. The team will not be created. Error is: ${error.message}`);
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
      console.info(`Team ${team.name} already exists, skipping creation`);
    } else {
      console.error(`Failed to create team ${team.name} in org ${org} with status: ${error.status}. Error is: ${error.message}`);
    }
  } finally {
    if(createdTeam) {
      team.id = createdTeam.data.id;
      teamCache.set(`${org}.${team.name}`, team);
    }
    populateTeam(broker, org, team);
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
    console.error(`Failed to get team ${team} in org ${org}. The team will not be created. Error is: ${error.message}`);
    return;
  });
}

async function populateTeam(broker: OctokitBroker, org: string, team: Team) {
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
      console.debug(`Team ${team.name} in org ${org} is not synced with a group`);
    } else {
      console.error(`Failed to get external group for team ${team.name} in org ${org}. Error is: ${error.message}`);
    }
  }

  if (!hasExternalGroup) {
    // The team is not synced with an IdP group, we need to add each user
    await addIndividualUsersToTeam(broker, org, team);
  }
}

async function mapTeamToExternalGroup(broker: OctokitBroker, org: string, team: Team, groupName: string) {
  if(ghesExternalGroups.get(groupName)) {
    // Finding the id of that group on the GHES side.
    const group_id = ghesExternalGroups.get(groupName);
    console.debug(`External group for team ${team.name} in org ${org} is ${groupName}. Its ID in GHES is ${group_id}`);
    
    try {
      await broker.ghesOctokit.request('PATCH /orgs/{org}/teams/{team_slug}/external-groups', {
        'org': org,
        'team_slug': team.slug,
        'group_id': group_id
      });
    } catch (error: any) {
      console.error(`Failed to map external group ${groupName} to team ${team.name} in org ${org}. Error is: ${error.message}`);
    }
  } else {
    console.error(`External group for team ${team.name} in org ${org} is ${groupName}. Its ID in GHES is not available.`);
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
            console.error(`Failed to add member ${login} to team ${team.slug} in org ${org}. User doesn't exist on GHES`);
          } else {
            console.error(`Failed to add member ${login} to team ${team.slug} in org ${org}. Error is: ${error.message}`);
          }
        }
      }
    } 
}