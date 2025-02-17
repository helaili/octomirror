import { Octokit } from '@octokit/rest';
import { enterpriseCloud } from "@octokit/plugin-enterprise-cloud";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import type { operations as GhecOperations } from '@octokit/openapi-types-ghec';
import {
  GetResponseDataTypeFromEndpointMethod,
  Endpoints
} from "@octokit/types";

//export const EnterpriseOctokitBuilder = Octokit.plugin(enterpriseCloud, paginateRest, throttling, retry);
export const EnterpriseOctokitBuilder = Octokit.plugin(enterpriseCloud, paginateRest);
export type EnterpriseOctokit = InstanceType<typeof EnterpriseOctokitBuilder>;

const octokit = new EnterpriseOctokitBuilder({});

export interface AuditLogEvent {
  action: string;
  operation_type: string;
  created_at: number;
  business: string;
  org: string;
}

export interface OrganizationAuditLogEvent extends AuditLogEvent {
}

export interface RepositoryAuditLogEvent extends AuditLogEvent {
  repo: string;
  visibility: 'public' | 'private' | 'internal';
}

export interface RepositoryRenameAuditLogEvent extends RepositoryAuditLogEvent {
  old_name: string;
}

export interface OrganizationRenameAuditLogEvent extends OrganizationAuditLogEvent {
  old_login: string
}

export interface TeamAuditLogEvent extends AuditLogEvent {
  team: string;
}

export interface TeamMemberAuditLogEvent extends TeamAuditLogEvent {
  user: string;
}

export interface TeamRepositoryAuditLogEvent extends TeamAuditLogEvent {
  repo: string;
}

export interface TeamAddOrUpdateRepositoryAuditLogEvent extends TeamRepositoryAuditLogEvent {
  permission: string;
}

export interface RepositoryRoleAuditLogEvent extends AuditLogEvent {
  name: string;
  base_role: string;
}

// TODO: this should be replaced by an Octokit generated type 
// once GET /enterprises/{enterprise}/apps/organizations/{org}/installations is supported  
export interface Installation {
  id: Number;
  app_slug: string; 
  client_id: string;
}

type Defined<T> = T extends undefined ? never : T;
type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType[number];

export type GetInstallationTokenResponse = Endpoints['POST /app/installations/{installation_id}/access_tokens']["response"];

export type ListProvisionedGroupsEnterprise = GhecOperations['enterprise-admin/list-provisioned-groups-enterprise']['responses']['200']['content']['application/scim+json'];
export type SCIMGroup = ArrayElement<GhecOperations['enterprise-admin/list-provisioned-groups-enterprise']['responses']['200']['content']['application/scim+json']['Resources']>;

export interface Repository {
  name: string;
  org: string;
  visibility:  'public' | 'private' | 'internal';
}

export type Team = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.teams.list
>[number];

export type GetTeamByName = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.teams.getByName
>

export interface TeamToCreate {
  org: string; 
  name: string; 
  description: string; 
  privacy: 'closed' | 'secret' | undefined; 
  parent_team_id?: number, 
  maintainers: string[]
};

export type ListCustomRepositoryRole = Defined<GhecOperations['orgs/list-custom-repo-roles']['responses']['200']['content']['application/json']['custom_roles']>;
export type CustomRepositoryRole = ArrayElement<Defined<ListCustomRepositoryRole>>;
