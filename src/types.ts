import { Endpoints } from '@octokit/types';
import { enterpriseCloud } from "@octokit/plugin-enterprise-cloud";
import { Octokit } from 'octokit';

export interface AuditLogEvent {
  action: string;
  operation_type: string;
  created_at: number;
  business: string;
  org: string;
}

export interface OrganizationAuditLogEvent extends AuditLogEvent {
  org: string
}

export interface RepositoryAuditLogEvent extends AuditLogEvent {
  org: string;
  repo: string;
  visibility: 'public' | 'private' | 'internal';
}

export interface RepositoryRenameAuditLogEvent extends RepositoryAuditLogEvent {
  old_name: string;
}


export interface OrganizationRenameAuditLogEvent extends OrganizationAuditLogEvent {
  old_login: string
}

// TODO: this should be replaced by an Octokit type 
// once GET /enterprises/{enterprise}/apps/organizations/{org}/installations is supported  
export interface Installation {
  id: Number;
  app_slug: string; 
  client_id: string;
}

export type GetInstallationTokenResponse = Endpoints['POST /app/installations/{installation_id}/access_tokens']["response"];

export interface Repository {
  name: string;
  org: string;
  visibility:  'public' | 'private' | 'internal';
}

export const EnterpriseOctokitBuilder = Octokit.plugin(enterpriseCloud);
export type EnterpriseOctokit = InstanceType<typeof EnterpriseOctokitBuilder>;
