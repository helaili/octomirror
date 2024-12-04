import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations, createOrg } from "./organizations.js";
import { installApp, getInstallationToken } from "./installation.js";
import { createRepo, getRepos, mirrorRepo } from "./repository.js";

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
        this.processNewOrg(org)
      }
    }
  }

  async processNewOrg(org: string) {
    // Intall the app on the dotcom org so that we can access its repositories
    const installationId = await installApp(this.broker.installationOctokit, this.enterpriseSlug, org, this.appSlug, this.appClientId);
    // Get the ocktokit for this app.
    const orgOctokit = await this.broker.getAppInstallationOctokit(org, installationId)
    //Get all repos from the doctcom org
    const repos = await getRepos(orgOctokit, org);
    console.log(repos);
    // Create the org on GHES
    await createOrg(this.broker.ghesOctokit, org, this.ghesOwnerUser)
    //Create all repos on the ghes org
    for(const repo of repos) {
      await createRepo(this.broker.ghesOctokit, org, repo)
      const dotcomRepoUrl = await this.broker.getDotcomRepoUrl(org, repo.name);
      const ghesRepoUrl = await this.broker.getGhesRepoUrl(org, repo.name);
      mirrorRepo(dotcomRepoUrl, ghesRepoUrl);
    }
  }
}
