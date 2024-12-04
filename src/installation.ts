import { Installation, GetInstallationTokenResponse } from "./types.js";
import { Octokit } from "octokit";


export async function installApp(octokit: Octokit, enterpriseSlug: string, orgLogin: string, appSlug: string, appClientId: string): Promise<number | undefined> {
  const result = await octokit.request('POST /enterprises/{enterprise}/apps/organizations/{org}/installations', { 
    enterprise: enterpriseSlug, 
    org: orgLogin, 
    client_id: appClientId, 
    repository_selection: "all" 
  });

  switch (result.status) { 
    case 201 : 
      console.log(`The app ${appSlug} was installed in ${orgLogin}`); 
      return result.data.id;
      break; 
    case 200 : 
      console.log(`The app ${appSlug} was already installed in ${orgLogin}`); 
      return result.data.id;
      break ; 
    default : 
      console.log(`An error occurred while installing the app ${appSlug} in ${orgLogin} with status code ${result.status}`); 
      return undefined;
      break ; 
  }
}

export async function getInstallation(octokit: Octokit, enterpriseSlug: string, orgLogin: string, appSlug: string) : Promise<Installation | undefined> {
  const installations: Installation[] = await octokit.paginate('GET /enterprises/{enterprise}/apps/organizations/{org}/installations', {
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

export async function getInstallationToken(octokit: Octokit, enterpriseSlug: string, orgLogin: string, appSlug: string, installationId?: number) : Promise<GetInstallationTokenResponse['data'] | undefined> {
  if(!installationId) {
    const installation = await getInstallation(octokit, enterpriseSlug, orgLogin, appSlug);
    if (installation) {
      installationId = Number(installation.id);  
    } else {
      return undefined;
    }
  }
  
  const result: GetInstallationTokenResponse = await octokit.request('POST /app/installations/{installation_id}/access_tokens' , { 
    installation_id: installationId
  });
  if(result.status === 201) { 
    return result.data;
  } else {
    console.log(`Failed to get installation token for ${appSlug} in ${orgLogin}`, result.data);
    return undefined
  }
}