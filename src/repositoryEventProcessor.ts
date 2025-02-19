import { Repository, RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from "./types.js";
import { Octomirror } from "./octomirror.js";
import logger from './logger.js';
import { createRepo, mirrorRepo, deleteRepo, deleteMirror, renameRepo, renameMirror } from "./repositories.js";
import { extractOrgAndRepoFromNWO } from "./repositoryUtils.js";

export async function processRepositoryEvent(om: Octomirror, repoEvent: RepositoryAuditLogEvent) {
  const nwo = extractOrgAndRepoFromNWO(repoEvent.repo);

  if (!nwo) {
    logger.error(`Invalid repository name for ${repoEvent.action} on org ${repoEvent.org} : ${repoEvent.repo}`);
    return;
  }
  
  const repo: Repository = {
    org: nwo.org,
    name: nwo.repo,
    visibility: repoEvent.visibility
  };

  switch(repoEvent.action) {
    case 'repo.create':
      await createRepo(om.broker.ghesOctokit, repo)
      const dotcomRepoUrl = await om.broker.getDotcomRepoUrl(repo.org, repo.name);
      const ghesRepoUrl = await om.broker.getGhesRepoUrl(repo.org, repo.name);
      await mirrorRepo(dotcomRepoUrl, ghesRepoUrl);
      break;
    case 'repo.destroy':
      await deleteRepo(om.broker.ghesOctokit, repo);
      await deleteMirror(repo);
      break;
    case 'repo.rename':
      const repoRenameEvent = repoEvent as RepositoryRenameAuditLogEvent;
      const repoNameRegex = /^[a-zA-Z0-9-.]+$/;

      if (!repoNameRegex.test(repoRenameEvent.old_name)) {
        logger.error(`Invalid old repository name for ${repoEvent.action} on org ${repoEvent.org} : ${repoRenameEvent.old_name}`);
        return;
      }

      await renameRepo(om.broker.ghesOctokit, repo, repoRenameEvent.old_name);
      await renameMirror(repo, repoRenameEvent.old_name);
      break;
    default:
      logger.info(`Ignoring event ${repoEvent.action}`);
      break;
  }
}
