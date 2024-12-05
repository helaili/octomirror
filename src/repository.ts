import { Octokit } from "octokit";
import { EnterpriseOctokit, Repository } from "./types.js";
import { simpleGit, SimpleGit } from 'simple-git';
import { access, constants } from 'fs/promises';

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


export async function createRepo(octokit: EnterpriseOctokit, org: string, repo: Repository): Promise<'created' | 'existing'> {
  // Use octokit to create the orgs
  console.log(`Creating repo ${repo.name} with owner ${org} and visibility ${repo.visibility.toLowerCase()}...`)
    
  try {
    await octokit.rest.repos.createInOrg({
      'org': org, 
      'name': repo.name,
      'visibility': repo.visibility.toLowerCase() as any 
    });
    return 'created';
  } catch (requestError: any) {
    if (requestError.status === 422) {
      for (const error of requestError.response?.data.errors) {
        if (error.message === 'name already exists on this account') {
          console.log(`Repository ${org}/${repo.name} already exists, skipping creation`);
          return 'existing';
        }
      }
    }
    console.error(`Failed to create repo ${org}/${repo.name}`);
    throw requestError;
  }
}

export async function mirrorRepo(dotcomRepoUrl: string, ghesRepoUrl: string) {
  const git: SimpleGit = simpleGit(process.env.workingDir || '/tmp');
  const repoName = dotcomRepoUrl.split('/').pop();
  const repoFolder = `${process.env.workingDir || '/tmp'}/${repoName}`;
  
  try {
    try {
      // Check if the directory already exists
      await access(repoFolder, constants.F_OK);
      console.log(`Directory ${repoFolder} already exists`);
    } catch {
      // Clone with mirror flag as the directory doesn't exist yet
      await git.clone(dotcomRepoUrl,repoFolder, {'--mirror': null});
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
    await git.fetch(['--prune', 'origin']);

    // Push to GHES
    await git.push(['--mirror']);
  } catch (error) {
    console.error(`Git operation failed for : ${repoName} w`, error);
    //throw error;
  } finally {
    // Remove tokens from the urls
    console.log(`Reset fetch to  https://${dotcomRepoUrl.split('@').pop() || ''}`);
    console.log(`Reset push to  https://${ghesRepoUrl.split('@').pop() || ''}`);
    await git.remote(['set-url', 'origin', `https://${dotcomRepoUrl.split('@').pop() || ''}`]);
    await git.remote(['set-url', '--push', 'origin', `https://${ghesRepoUrl.split('@').pop() || ''}`]);
    await git.cwd('../');
  }
}

export async function getRepos(ocotkit: Octokit, org: string): Promise<Repository[]> {
  let repos: Repository[] = [];
  let hasNextPage = true;
  let cursor = undefined;

  while (hasNextPage) {
    let res = await ocotkit.graphql(repoGraphqlQuery, {login: org, cursor: cursor}) as { organization: { repositories: { nodes: Repository[], pageInfo: { hasNextPage: boolean, endCursor: string } } } };
    let data = res.organization.repositories;
  
    data.nodes.forEach((repo: Repository ) => {
      repos.push(repo);
    });

    hasNextPage = data.pageInfo.hasNextPage
    cursor = data.pageInfo.endCursor
  }
  return repos;
}

