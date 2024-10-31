import { App, Octokit } from 'octokit';

export class OctokitBroker {
  app: App;
  slug!: string;
  patOctokit: Octokit;
  installationOctokit!: Octokit;
  
  constructor(pat: string, appId: number, privateKey: string) {
    this.app = new App({ appId, privateKey });
    // We should be able to get rid of this as soon as Enteprise GitHub Apps can acces more endpoints
    this.patOctokit = new Octokit({
      auth: pat,
    });
    this.initialize();
  }

  public ready(): boolean {
    return this.installationOctokit !== undefined && this.slug !== undefined;
  }

  private async initialize() {
    const { data: appMeta } = await this.app.octokit.rest.apps.getAuthenticated();
    if(appMeta) {
      console.log(`App authenticated as ${appMeta.name} owned by ${appMeta.owner?.login}`)

      for await (const { octokit, installation } of this.app.eachInstallation.iterator()) {
        if (installation.target_type === 'Enterprise') {
          this.slug = installation.account?.slug || 'undefined';
          this.installationOctokit = octokit;
          console.log(`OctokitBroker is ready for ${this.slug}`); 
        }
      }
    }
  } 
}