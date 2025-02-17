import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { getInstallationToken } from './installation.js';
import { EnterpriseOctokit, EnterpriseOctokitBuilder } from './types.js';
import logger from './logger.js';

export class OctokitBroker {
  app: App;
  appSlug: string;
  enterpriseSlug!: string;
  dotcomUrl: string;
  dotcomApiUrl: string;
  dotcomOctokit: EnterpriseOctokit;
  ghesOctokit: EnterpriseOctokit;
  installationOctokit!: EnterpriseOctokit;
  ghesPat: string;
  ghesUrl: string;
  installationTokens: Map<string, string> = new Map();
  
  constructor(ghespat: string, ghesUrl: string, dotcompat: string, appSlug: string, appId: number, privateKey: string, dotcomUrl: string = "https://github.com") {
    this.appSlug = appSlug;
    this.ghesPat = ghespat;
    this.ghesUrl = ghesUrl;
    this.dotcomUrl = dotcomUrl;

    // We should be able to get rid of this as soon as Enteprise GitHub Apps can acces more endpoints
    this.dotcomApiUrl = `${this.dotcomUrl}/api/v3`;
    if(this.dotcomUrl === "https://github.com") {
      this.dotcomApiUrl = 'https://api.github.com';
    }

    logger.debug(`Dotcom pat is ${dotcompat} and ghes pat is ${ghespat}`);
        
    this.dotcomOctokit = new EnterpriseOctokitBuilder({
      auth: dotcompat,
      baseUrl: this.dotcomApiUrl
    });
    this.ghesOctokit = new EnterpriseOctokitBuilder({
      auth: ghespat,
      baseUrl: `${ghesUrl}/api/v3`
    });

    const Octokit = EnterpriseOctokitBuilder.defaults({
      baseUrl: this.dotcomApiUrl,
    });


    this.app = new App({ appId, privateKey, Octokit });
    
    this.initialize();
  }

  public ready(): boolean {
    return this.installationOctokit !== undefined && this.enterpriseSlug !== undefined;
  }

  public async getDotcomRepoUrl(org: string, repo: string) {
    let token = this.installationTokens.get(org);
    if (!token) {
      const tokenObj = await getInstallationToken(this.installationOctokit, this.enterpriseSlug, org, this.appSlug);
      if (tokenObj) {
        token = tokenObj.token;
        this.installationTokens.set(org, token);
      } else {
        throw new Error(`Failed to get token for ${org}`);
      }
    }
    const url = new URL(this.dotcomUrl);
    url.username = 'x-access-token';
    url.password = token;
    return `${url.toString()}${org}/${repo}`;
  }

  public async getGhesRepoUrl(org: string, repo: string) {    
    const url = new URL(this.ghesUrl);
    url.username = this.ghesPat;
    return `${url.toString()}${org}/${repo}`;

  }

  /* 
   * Retrieve an octokit authenticated on the organization
   */
  public async getAppInstallationOctokit(org:string, installationId?: number) : Promise<EnterpriseOctokit> {
    if (!this.installationOctokit) {
      throw new Error('OctokitBroker not initialized');
    }

    let apiUrl = `${this.dotcomUrl}/api/v3`;
    if(this.dotcomUrl === "https://github.com") {
      apiUrl = 'https://api.github.com';
    } 

    if (this.installationTokens.has(org)) {
      logger.debug(`Installation token already exists for ${org}`);
      logger.debug(`Installation token for org ${org} is ${this.installationTokens.get(org)}`);
      return new EnterpriseOctokitBuilder({ 
        auth: this.installationTokens.get(org),
        baseUrl: apiUrl
      });
    } else {
      const token = await getInstallationToken(this.installationOctokit, this.enterpriseSlug, org, this.appSlug, installationId);
      if (!token) {
        throw new Error(`Failed to get token for ${org}`);
      } else {
        logger.info(`Installation token retrieved for ${org}`);
        this.installationTokens.set(org, token.token);
        logger.debug(`Installation token for org ${org} is ${this.installationTokens.get(org)}`);
        return new EnterpriseOctokitBuilder({ 
          auth: token.token,
          baseUrl: apiUrl
        });
      }
    }
    
  }

  private async initialize() {
    const { data: appMeta } = await (this.app.octokit as EnterpriseOctokit).rest.apps.getAuthenticated();
    if(appMeta) {
      logger.info(`App authenticated as ${appMeta.name} owned by ${appMeta.owner?.login}`)

      for await (const { octokit, installation } of this.app.eachInstallation.iterator()) {
        if (installation.target_type === 'Enterprise') {
          this.enterpriseSlug = installation.account?.slug || 'undefined';
          this.installationOctokit = octokit as EnterpriseOctokit;
          logger.info(`OctokitBroker is ready for ${this.enterpriseSlug}`); 
        }
      }
    }
  } 
}