import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations } from "./organizations.js";
import { RequestValidator } from "./requestValidator.js";

export class Octomirror {
  ghesUrl: string;
  broker: OctokitBroker;
  requestValidator: RequestValidator;

  constructor(ghesUrl: string) {
    this.ghesUrl = ghesUrl;
    this.broker = new OctokitBroker();
    this.requestValidator = new RequestValidator(this.ghesUrl);  
  }

  public async allInstallableOrganizations(authHeader: string): Promise<string[]> {
    if(await this.requestValidator.veryfyAuthHeader(authHeader)) {
      return allInstallableOrganizations(this.broker);
    } else {
      throw new Error('Invalid token');
    }
  }
}