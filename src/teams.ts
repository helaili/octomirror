import { Team, TeamToCreate } from "./types.js";
import { OctokitBroker } from "./octokitBroker.js";


const teamCache = new Map<string, Team>();
const teamToRetry: Team[] = [];

export async function createOrgTeams(broker: OctokitBroker, org: string) {
  for await (const response of broker.dotcomOctokit.paginate.iterator(
    broker.dotcomOctokit.rest.teams.list,{ 'org': org, 'per_page': 100 },)) {
    for(const team of response.data) {
      if(team.parent && !teamCache.get(`${org}.${team.parent.name}`)) {
        console.info(`Cache missed for parent team ${team.parent.name} of team ${team.name} in org ${org}`);
        teamToRetry.push(team);
      } else {
        await createTeam(broker, org, team);
      }
    }
  }
  let retryCount = 0;
  while(teamToRetry.length > 0 && retryCount < 10) {
    console.info(`Attempt #${retryCount+1} to create ${teamToRetry.length} orphaned teams in org ${org}...`)
    for(const team of teamToRetry) {
      if(teamCache.get(`${org}.${team.parent?.name}`)) {
        // Remove the team from the retry list
        const index = teamToRetry.indexOf(team);
        if (index > -1) {
          teamToRetry.splice(index, 1);
        }
        await createTeam(broker, org, team);
  
      }
    }
    retryCount++;
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

async function createTeam(broker: OctokitBroker,  org: string, team: Team) {
  console.info(`Creating team ${team.name} in org ${org}...`)
  try {
    const teamToCreate: TeamToCreate = {
      'org': org,
      'name': team.name,
      'description': team.description || '',
      'privacy': team.privacy === 'secret' ? 'secret' : 'closed'
    };

    if (team.parent) {
      const parentTeam = teamCache.get(`${org}.${team.parent.name}`);
      if (parentTeam) {
        teamToCreate['parent_team_id'] = parentTeam.id;
      } else {
        // API Call to get the parent team
        console.error(`Parent team ${team.parent} not found for team ${team.name} in org ${org}`);
        return;
      }
    }

    const createdTeam = await broker.ghesOctokit.rest.teams.create({ ...teamToCreate });
    
    team.id = createdTeam.data.id;
    teamCache.set(`${org}.${team.name}`, team);
  } catch (error: any) {
    if (error.status === 422 && error.response?.data.message === 'Validation Failed') {
      console.info(`Team ${team.name} already exists, skipping creation`)
      return;
    } else {
      console.error(`Failed to create team ${team.name} in org ${org} with status: ${error.status}. Error is: ${error.message}`);
    }
  }
}