import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations } from "./organizations.js";
import { installApps, installApp, getInstallation, getInstallationToken } from "./installation.js";
import { RequestValidator } from "./requestValidator.js";
import { GetInstallationTokenResponse, Installation } from "./types.js";

export class Octomirror {
  ghesUrl: string;
  broker: OctokitBroker;
  requestValidator: RequestValidator;
  enterpriseSlug: string;
  appSlug: string;
  appClientId: string;

  constructor(ghesUrl: string, pat: string, enterpriseSlug: string, appSlug: string, 
    appId: number, appClientId: string, privateKey: string) {
    this.ghesUrl = ghesUrl;
    this.appClientId = appClientId;
    this.enterpriseSlug = enterpriseSlug;
    this.appSlug = appSlug;
    this.broker = new OctokitBroker(pat, appId, privateKey);
    this.requestValidator = new RequestValidator(this.ghesUrl);  
  }

  public async allInstallableOrganizations(authHeader: string): Promise<string[]> {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return allInstallableOrganizations(this.broker);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async installApps(authHeader: string) {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return installApps(this.broker, this.enterpriseSlug, this.appSlug, this.appClientId);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async installApp(authHeader: string, orgLogin: string) {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return installApp(this.broker, this.enterpriseSlug, orgLogin, this.appSlug, this.appClientId);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async getInstallation(authHeader: string, orgLogin: string) : Promise<Installation | undefined>{
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return await getInstallation(this.broker, this.enterpriseSlug, orgLogin, this.appSlug);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async getInstallationToken(authHeader: string, orgLogin: string) : Promise<GetInstallationTokenResponse['data'] | undefined> {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return await getInstallationToken(this.broker, this.enterpriseSlug, orgLogin, this.appSlug);
    } else {
      throw new Error('Invalid token');
    }
  }
}