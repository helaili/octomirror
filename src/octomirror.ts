import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations } from "./organizations.js";
import { installApps, installApp, getInstallation, getInstallationToken } from "./installation.js";
import { RequestValidator } from "./requestValidator.js";
import { GetInstallationTokenResponse, Installation } from "./types.js";

export class Octomirror {
  ghesUrl: string;
  broker: OctokitBroker;
  requestValidator: RequestValidator;

  constructor(ghesUrl: string, pat: string, appId: number, privateKey: string) {
    this.ghesUrl = ghesUrl;
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

  public async installApps(authHeader: string, enterpriseSlug: string, appSlug: string, appClientId: string) {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return installApps(this.broker, enterpriseSlug, appSlug, appClientId);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async installApp(authHeader: string, enterpriseSlug: string, orgLogin: string, appSlug: string, appClientId: string) {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return installApp(this.broker, enterpriseSlug, orgLogin, appSlug, appClientId);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async getInstallation(authHeader: string, enterpriseSlug: string, orgLogin: string, appSlug: string) : Promise<Installation | undefined>{
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return await getInstallation(this.broker, enterpriseSlug, orgLogin, appSlug);
    } else {
      throw new Error('Invalid token');
    }
  }

  public async getInstallationToken(authHeader: string, enterpriseSlug: string, orgLogin: string, appSlug: string) : Promise<GetInstallationTokenResponse['data'] | undefined> {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return await getInstallationToken(this.broker, enterpriseSlug, orgLogin, appSlug);
    } else {
      throw new Error('Invalid token');
    }
  }
}