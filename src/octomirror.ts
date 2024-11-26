import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations } from "./organizations.js";
import { installApp } from "./installation.js";
import { RequestValidator } from "./requestValidator.js";

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

  public async installApp(authHeader: string, enterpriseSlug: string, orgLogin: string, appSlug: string, appClientId: string) {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return installApp(this.broker.installationOctokit, enterpriseSlug, orgLogin, appSlug, appClientId);
    } else {
      throw new Error('Invalid token');
    }
  }
}