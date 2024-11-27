import { allInstallableOrganizations } from "./organizations.js";
import { OctokitBroker } from "./octokitBroker.js";
import { Installation, GetInstallationTokenResponse } from "./types.js";


export async function installApps(broker: OctokitBroker, enterpriseSlug: string, appSlug: string, appClientId: string) {
  const orgs = await allInstallableOrganizations(broker);
  for(const org of orgs) {
    installApp(broker, enterpriseSlug, org, appSlug, appClientId);    
  }
}

export async function installApp(broker: OctokitBroker, enterpriseSlug: string, orgLogin: string, appSlug: string, appClientId: string) {
  const result = await broker.installationOctokit.request('POST /enterprises/{enterprise}/apps/organizations/{org}/installations', { 
    enterprise: enterpriseSlug, 
    org: orgLogin, 
    client_id: appClientId, 
    repository_selection: "all" 
  });

  switch (result.status) { 
    case 201 : 
      console.log(`The app ${appSlug} was installed in ${orgLogin}`); 
      break; 
    case 200 : 
      console.log(`The app ${appSlug} was already installed in ${orgLogin}`); 
      break ; 
    default : 
      console.log(`An error occurred while installing the app ${appSlug} in ${orgLogin} with status code ${result.status}`); 
      break ; 
  }
}

export async function getInstallation(broker: OctokitBroker, enterpriseSlug: string, orgLogin: string, appSlug: string) : Promise<Installation | undefined> {
  const installations: Installation[] = await broker.installationOctokit.paginate('GET /enterprises/{enterprise}/apps/organizations/{org}/installations', {
    enterprise: enterpriseSlug, 
    org: orgLogin
  });

  if (installations.length == 0){
    console.log(`${orgLogin} has no installations.`);
    return undefined;
  } else {
    for(const installation of installations) {
      if (installation.app_slug == appSlug) {
        return installation;
      }
    }
    return undefined;
  }
}

export async function getInstallationToken(broker: OctokitBroker, enterpriseSlug: string, orgLogin: string, appSlug: string) : Promise<GetInstallationTokenResponse['data'] | undefined> {
  const installation = await getInstallation(broker, enterpriseSlug, orgLogin, appSlug);
  if (installation) {
    const result: GetInstallationTokenResponse = await broker.installationOctokit.request('POST /app/installations/{installation_id}/access_tokens' , { 
      installation_id: Number(installation.id)
    });
    if(result.status === 201) { 
      return result.data;
    } else {
      console.log(`Failed to get installation token for ${appSlug} in ${orgLogin}`, result.data);
      return undefined
    }
  } else {
    return undefined;
  }
}