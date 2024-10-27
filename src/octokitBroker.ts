import { App, Octokit } from 'octokit';
import * as fs from 'fs';

export class OctokitBroker {
  private privateKey: string;
  private _patOctokit!: Octokit;
  appId: number;
  app: App;
  slug!: string;
  installationOctokit!: Octokit;
  
  constructor() {
    this.appId = this.getAppId();
    this.privateKey = this.getPrivateKey();
    this.app = new App({ appId: this.appId, privateKey: this.getPrivateKey() });
    this.initialize();
  }

  public patOctokit() : Octokit {
    if (!this._patOctokit) {
      const pat = process.env.PAT;
      if (!pat) {
        throw new Error('PAT environment variable is required');
      } 
      
      this._patOctokit = new Octokit({
        auth: pat,
      });
    }
    return this._patOctokit;
  }

  private getAppId() : number {
    if (!process.env.APP_ID) {
      throw new Error('APP_ID environment variable is required');
    } 
    return parseInt(process.env.APP_ID);
  }

  // Load the private key from the file system in development mode, or from an environment variable in production mode
  private getPrivateKey() : string {
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT && process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
      if (!process.env.PRIVATE_KEY_FILE) {
        throw new Error('PRIVATE_KEY_FILE environment variable is required');
      }  
      return fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8');
    } else {
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY environment variable is required');
      }  
      return Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf8');
    }
  }

  private async initialize() {
    const { data: appMeta } = await this.app.octokit.rest.apps.getAuthenticated();
    if(appMeta) {
      console.log(`App authenticated as ${appMeta.name} owned by ${appMeta.owner?.login}`)

      const installations = await this.app.eachInstallation.iterator();
      for await (const { octokit, installation } of installations) {
        if (installation.target_type === 'Enterprise') {
          this.slug = installation.account?.slug || 'undefined';
          this.installationOctokit = octokit;
        }
      }
    }
  }

  public ready(): boolean {
    return this.installationOctokit !== undefined && this.slug !== undefined;
  }
}