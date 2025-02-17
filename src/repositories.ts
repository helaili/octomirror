import { EnterpriseOctokit, Repository, RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from "./types.js";
import { simpleGit, SimpleGit } from 'simple-git';
import { access, constants } from 'fs/promises';
import { rm } from "fs/promises";
import { move } from 'fs-extra/esm';
import { OctokitBroker } from "./octokitBroker.js";
import { Octomirror } from "./octomirror.js";

const repoGraphqlQuery = `
query($login: String!, $cursor: String) {
  organization(login: $login) {
    repositories(first: 100, after: $cursor) {
      nodes {
        name
        visibility
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

const WORKING_DIR = process.env.WORKING_DIR || '/tmp';


export async function processRepositoryEvent(om: Octomirror, event: RepositoryAuditLogEvent) {
  switch(event.action) {
    case 'repo.create':
      const repoCreateEvent = event as RepositoryAuditLogEvent;
      const repoToCreate: Repository = {
        org: repoCreateEvent.org,
        name: repoCreateEvent.repo.split('/').pop() || '', 
        visibility: repoCreateEvent.visibility
      };

      if(repoToCreate.name === '') {
        console.error(`Invalid repository name for creation event: ${repoCreateEvent.repo}`);
        break;
      }
      await createRepo(om.broker.ghesOctokit, repoToCreate)
      const dotcomRepoUrl = await om.broker.getDotcomRepoUrl(repoToCreate.org, repoToCreate.name);
      const ghesRepoUrl = await om.broker.getGhesRepoUrl(repoToCreate.org, repoToCreate.name);
      await mirrorRepo(dotcomRepoUrl, ghesRepoUrl);
      break;
    case 'repo.destroy':
      const repoDeleteEvent = event as RepositoryAuditLogEvent;
      const repoToDelete: Repository = {
        org: repoDeleteEvent.org,
        name: repoDeleteEvent.repo.split('/').pop() || '', 
        visibility: repoDeleteEvent.visibility
      };

      if(repoToDelete.name === '') {
        console.error(`Invalid repository name for deletions event: ${repoDeleteEvent.repo}`);
        break;
      }
      await deleteRepo(om.broker.ghesOctokit, repoToDelete);
      await deleteMirror(repoToDelete);
      break;
    case 'repo.rename':
      const repoRenameEvent = event as RepositoryRenameAuditLogEvent;
      const repoToRename: Repository = {
        org: repoRenameEvent.org,
        name: repoRenameEvent.repo.split('/').pop() || '', 
        visibility: repoRenameEvent.visibility
      };

      if(repoToRename.name === '') {
        console.error(`Invalid repository name for deletions event: ${repoRenameEvent.repo}`);
        break;
      }
      await renameRepo(om.broker.ghesOctokit, repoToRename, repoRenameEvent.old_name);
      await renameMirror(repoToRename, repoRenameEvent.old_name);
      break;
    default:
      console.log(`Ignoring event ${event.action}`);
      break;
  }
}

export async function createRepo(octokit: EnterpriseOctokit, repo: Repository): Promise<'created' | 'existing'> {
  // Use octokit to create the orgs
  console.info(`Creating repo ${repo.name} with owner ${repo.org} and visibility ${repo.visibility.toLowerCase()}...`)
    
  try {
    await octokit.rest.repos.createInOrg({
      'org': repo.org, 
      'name': repo.name,
      'visibility': repo.visibility.toLowerCase() as any 
    });
    return 'created';
  } catch (requestError: any) {
    if (requestError.status === 422) {
      for (const error of requestError.response?.data.errors) {
        if (error.message === 'name already exists on this account') {
          console.log(`Repository ${repo.org}/${repo.name} already exists, skipping creation`);
          return 'existing';
        }
      }
    }
    console.error(`Failed to create repo ${repo.org}/${repo.name}`);
    throw requestError;
  }
}

export async function deleteRepo(octokit: EnterpriseOctokit, repo: Repository) {
  console.info(`Deleting repo ${repo.name} with owner ${repo.org}`)
    
  try {
    await octokit.rest.repos.delete({
      'owner': repo.org, 
      'repo': repo.name
    });
  } catch (requestError: any) {
    if (requestError.status === 403) {
      console.info(`Repository ${repo.org}/${repo.name} could not be deleted, deleting is not allowed but the organization owner.`);
    } else if (requestError.status === 404) {
      console.info(`Repository ${repo.org}/${repo.name} could not be deleted, repository does not exist.`);
    } else {
      console.error(`Failed to delete repo ${repo.org}/${repo.name} with status: ${requestError.status}`);
      throw requestError;
    }
  }
}

export async function renameRepo(octokit: EnterpriseOctokit, repo: Repository, oldName: string) {
  console.info(`Renaming repo ${oldName} with owner ${repo.org} to ${repo.name}`)
  try {
    await octokit.rest.repos.update({
      'owner': repo.org, 
      'repo': oldName, 
      'name': repo.name
    });
  } catch (requestError: any) {
    if (requestError.status === 403) {
      console.info(`Repository ${repo.org}/${oldName} could not be renamed: forbidden.`);
    } else if (requestError.status === 404) {
      console.info(`Repository ${repo.org}/${oldName} could not be renamed, repository does not exist.`);
    } else if (requestError.status === 422) {
      for (const error of requestError.response?.data.errors) {
        if (error.message === 'name already exists on this account') {
          console.error(`Failed to rename repo ${repo.org}/${oldName} to ${repo.org}/${repo.name} has the repository already exists.`);
          // Seems like the move was made already, so let's delete the old repo.
          deleteRepo(octokit, {
            name: oldName,
            org: repo.org,
            visibility: repo.visibility
          });
          return;
        }
      }

      console.error(`Failed to rename repo ${repo.org}/${oldName} with status: ${requestError.status}`);
      throw requestError;
    } else {
      console.error(`Failed to rename repo ${repo.org}/${oldName} with status: ${requestError.status}`);
      throw requestError;
    }
  }
}

export async function renameMirror(repo: Repository, oldName: string): Promise<void> {
  const newFolder = `${WORKING_DIR}/${repo.org}/${repo.name}`;
  const oldFolder = `${WORKING_DIR}/${repo.org}/${oldName}`;
  try {
    // Check if the directory already exists
    await access(oldFolder, constants.F_OK);
    return move(oldFolder, newFolder, { overwrite: true });
  } catch {
    console.error(`Could not rename directory ${oldFolder} as it does not exist`);
  }
}

export async function deleteMirror(repo: Repository): Promise<void> {
  const repoFolder = `${WORKING_DIR}/${repo.org}/${repo.name}`;
  return rm(repoFolder, { recursive: true, force: true });
}


export async function mirrorRepo(dotcomRepoUrl: string, ghesRepoUrl: string) {
  const git: SimpleGit = simpleGit(WORKING_DIR);
  // Get the org and repo name from the url to create the folder

  const repoAndOrg = extractOrgAndRepo(dotcomRepoUrl);
  if (!repoAndOrg) {
    console.error(`Invalid repository url: ${dotcomRepoUrl}`);
    return;
  }
  const repoFolder = `${WORKING_DIR}/${repoAndOrg.org}/${repoAndOrg.repo}`;
  
  try {
    try {
      // Check if the directory already exists
      await access(repoFolder, constants.F_OK);
      console.debug(`Directory ${repoFolder} already exists`);
    } catch {
      // Clone with mirror flag as the directory doesn't exist yet
      await git.clone(dotcomRepoUrl,repoFolder, {'--mirror': null}).catch((error) => {
        console.error(error.message);
        return;
      });
    }

    await git.cwd(repoFolder);
    // Make sure remotes are up to date
    await git.remote(['set-url', 'origin', dotcomRepoUrl]);
    await git.remote(['set-url', '--push', 'origin', ghesRepoUrl]);

    // We don't want to push hidden refs from PRs
    await git.raw(['config', '--local', 'remote.origin.push', '+refs/heads/*:refs/heads/*', '--replace-all']);
    await git.raw(['config', '--local', 'remote.origin.push', '+refs/tags/*:refs/tags/*', '--add']);

    // Bump the http post buffer to 150MB to avoid error:
    // RPC failed; HTTP 400 curl 22 The requested URL returned error: 400
    // send-pack: unexpected disconnect while reading sideband packet
    await git.raw(['config', '--local', 'http.postBuffer', '157286400']);

    // Fetch all branches
    await git.fetch(['--prune', 'origin']).catch((error) => {
      console.error(`Fetch failed for ${dotcomRepoUrl} with error: `, error.message);
      return;
    });

    // Push to GHES
    await git.push(['--mirror']).catch((error) => {
      console.error(`Push failed for ${ghesRepoUrl} with error: `, error.message);
      return;
    });
    
    // Remove tokens from the urls
    console.debug(`Reset fetch to  https://${dotcomRepoUrl.split('@').pop() || ''}`);
    await git.remote(['set-url', 'origin', `https://${dotcomRepoUrl.split('@').pop() || ''}`]);

    console.debug(`Reset push to  https://${ghesRepoUrl.split('@').pop() || ''}`);
    await git.remote(['set-url', '--push', 'origin', `https://${ghesRepoUrl.split('@').pop() || ''}`]);
  } catch (error) {
    console.error(`Git operation failed for : ${repoAndOrg.org}/${repoAndOrg.repo} with error: `, error);
  } finally {
    await git.cwd('../');
  }
}

export async function createOrgRepos(broker: OctokitBroker, org: string) {
  let hasNextPage = true;
  let cursor = undefined;
  const orgOctokit = await broker.getAppInstallationOctokit(org);

  console.debug(`Creating repos for org ${org}...`);

  while (hasNextPage) {
    let res = await orgOctokit.graphql(repoGraphqlQuery, {login: org, cursor: cursor}) as { organization: { repositories: { nodes: Repository[], pageInfo: { hasNextPage: boolean, endCursor: string } } } };
    let data = res.organization.repositories;
  
    data.nodes.forEach(async (repo: Repository ) => {
      repo.org = org;
      await createRepo(broker.ghesOctokit, repo);
      const dotcomRepoUrl = await broker.getDotcomRepoUrl(org, repo.name);
      const ghesRepoUrl = await broker.getGhesRepoUrl(org, repo.name);
      mirrorRepo(dotcomRepoUrl, ghesRepoUrl);
    });

    hasNextPage = data.pageInfo.hasNextPage
    cursor = data.pageInfo.endCursor
  }
}


export function extractOrgAndRepo(url: string): { org: string, repo: string } | null {
  const regex = /https:\/\/[^\/]*\/([^\/]+)\/([^\/?.]+)/;
  const match = url.match(regex);
  
  if (match && match.length === 3) {
    return { org: match[1], repo: match[2] };
  }
  
  return null;
}
