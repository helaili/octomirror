import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations, createOrg, deleteOrg, renameOrg } from "./organizations.js";
import { installApp } from "./installation.js";
import { createRepo, deleteMirror, deleteRepo, getRepos, mirrorRepo, renameMirror, renameRepo } from "./repository.js";
import { auditEvents } from "./enterprise.js";
import { OrganizationRenameAuditLogEvent, Repository, RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from "./types.js";

export class Octomirror {
  broker: OctokitBroker;
  enterpriseSlug: string;
  appSlug: string;
  appClientId: string;
  ghesOwnerUser: string

  constructor(ghesPat: string, ghesUrl: string, ghesOwnerUser: string, dotcomPat: string, enterpriseSlug: string, appSlug: string, 
    appId: number, appClientId: string, privateKey: string) {
    this.appClientId = appClientId;
    this.enterpriseSlug = enterpriseSlug;
    this.appSlug = appSlug;
    this.broker = new OctokitBroker(ghesPat, ghesUrl, dotcomPat, appSlug, appId, privateKey);
    this.ghesOwnerUser = ghesOwnerUser;
  }

  public async initMirror() {
    let newOrgs: string[]
    const updatedRepos= new Map<string, string[]>()

    const allOrgs = await allInstallableOrganizations(this.broker.installationOctokit, this.enterpriseSlug);
    if (allOrgs) {
      for(const org of allOrgs) {
        this.processOrgCreation(org)
      }
    }
  }

  public async syncMirror(syncFrom: Date) {
    // Using the PAT Octokit to get the audit log as the installation token doesn't have access to it
    const events = await auditEvents(this.broker.dotcomOctokit, this.enterpriseSlug, syncFrom);

    const testOrgs = process.env.TEST_ORG?.split(',');
    
    for(const event of events) {
      if (process.env.ENVIRONMENT === 'Development' && testOrgs && !testOrgs.includes(event.org)) {
        continue
      } 

      console.debug(`Processing event ${event.action} for org ${event.org} from ${new Date(event.created_at).toLocaleString()}`);
      
      switch(event.action) {
        case 'org.create':
          await this.processOrgCreation(event.org);
          break;
        case 'org.delete':
          await this.processOrgDeletion(event.org);
          break; 
        case 'org.rename': 
          const orgRenameEvent = event as OrganizationRenameAuditLogEvent;
          const httpStatus = await this.processOrgRename(orgRenameEvent.old_login, orgRenameEvent.org);
          if (httpStatus == 404) {
            // The old org wasn't found, let's create the new one
            this.processOrgCreation(orgRenameEvent.org);
          }  
          break;
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
          await createRepo(this.broker.ghesOctokit, repoToCreate)
          const dotcomRepoUrl = await this.broker.getDotcomRepoUrl(repoToCreate.org, repoToCreate.name);
          const ghesRepoUrl = await this.broker.getGhesRepoUrl(repoToCreate.org, repoToCreate.name);
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
          await deleteRepo(this.broker.ghesOctokit, repoToDelete);
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
          await renameRepo(this.broker.ghesOctokit, repoToRename, repoRenameEvent.old_name);
          await renameMirror(repoToRename, repoRenameEvent.old_name);
          break;
        default:
          console.log(`Ignoring event ${event.action}`);
      }
    }
  }

  async processOrgCreation(orgLogin: string) {
    // Intall the app on the dotcom org so that we can access its repositories
    const installationId = await installApp(this.broker.installationOctokit, this.enterpriseSlug, orgLogin, this.appSlug, this.appClientId);
    if (installationId) {
      // Get the ocktokit for this app.
      const orgOctokit = await this.broker.getAppInstallationOctokit(orgLogin, installationId)
      
      //Get all repos from the doctcom org
      const repos = await getRepos(orgOctokit, orgLogin);
      // Create the org on GHES
      await createOrg(this.broker.ghesOctokit, orgLogin, this.ghesOwnerUser)
      //Create all repos on the ghes org
      for(const repo of repos) {
        await createRepo(this.broker.ghesOctokit, repo)
        const dotcomRepoUrl = await this.broker.getDotcomRepoUrl(orgLogin, repo.name);
        const ghesRepoUrl = await this.broker.getGhesRepoUrl(orgLogin, repo.name);
        mirrorRepo(dotcomRepoUrl, ghesRepoUrl);
      }
    }
  }

  async processOrgDeletion(orgLogin: string) {
    await deleteOrg(this.broker.ghesOctokit, orgLogin)
  }

  async processOrgRename(oldLogin: string, newLogin: string) : Promise<number> {
    return renameOrg(this.broker.ghesOctokit, oldLogin, newLogin)
  }
}
