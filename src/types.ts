import { Endpoints } from '@octokit/types';

export class OrganizationLifecyleEvent {
  name: string;
  event: 'created' | 'deleted';
  date: Date;

  constructor(name: string, event: 'created' | 'deleted', date: Date) {
    this.name = name;
    this.event = event;
    this.date = date;
  }
}

// TODO: this should be replaced by an Octokit type 
// once GET /enterprises/{enterprise}/apps/organizations/{org}/installations is supported  
export interface Installation {
  id: Number;
  app_slug: string; 
  client_id: string;
}

export type GetInstallationTokenResponse = Endpoints['POST /app/installations/{installation_id}/access_tokens']["response"];
