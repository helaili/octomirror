import { OctokitBroker } from "./octokitBroker.js";
import { allInstallableOrganizations, processOrgCreation } from "./organizations.js";
import { processOrganizationEvent } from "./organizationsEventProcessor.js";
import { installApp } from "./installation.js";
import { processRepositoryEvent } from "./repositoryEventProcessor.js";
import { auditEvents } from "./enterprise.js";
import { OrganizationAuditLogEvent, RepositoryAuditLogEvent, RepositoryRoleAuditLogEvent, TeamAuditLogEvent } from "./types.js";
import { deleteOrgTeams } from "./teams.js";
import { processTeamEvent } from "./teamEventProcessor.js";
import { processRepositoryRoleEvent } from "./repositoryRoleEventProcessor.js";
import logger from './logger.js';

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
        processOrgCreation(this.broker, this.appClientId, org, this.ghesOwnerUser)
      }
    }
  }

  public async resetMirror() {
    let newOrgs: string[]
    const updatedRepos= new Map<string, string[]>()

    const allOrgs = await allInstallableOrganizations(this.broker.installationOctokit, this.enterpriseSlug);
    if (allOrgs) {
      for(const org of allOrgs) {
        this.processOrgReset(org)
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

      logger.debug(`Processing event ${event.action} for org ${event.org} from ${new Date(event.created_at).toLocaleString()}`);
      const actionDomain = event.action.split('.')[0];

      switch(actionDomain) {
        case 'org':
          processOrganizationEvent(this, event as OrganizationAuditLogEvent);
          break;
        case 'repo':
          processRepositoryEvent(this, event as RepositoryAuditLogEvent);
          break;
        case 'team':
          processTeamEvent(this, event as TeamAuditLogEvent);
          break;
        case 'role':
          processRepositoryRoleEvent(this, event as RepositoryRoleAuditLogEvent);
          break;
        default:
          logger.info(`Ignoring event ${event.action}`);
      }
    }
  }

  async processOrgReset(orgLogin: string) {
    // Intall the app on the dotcom org so that we can access its repositories
    const installationId = await installApp(this.broker.installationOctokit, this.enterpriseSlug, orgLogin, this.appSlug, this.appClientId);
    if (installationId) {
      // Get the ocktokit for this app.
      const orgOctokit = await this.broker.getAppInstallationOctokit(orgLogin, installationId);
      deleteOrgTeams(this.broker, orgLogin);
    }
  }
}

