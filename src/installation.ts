import { Octokit } from "octokit";

async function installApp(octokit: Octokit, enterpriseSlug: string, orgLogin: string, appSlug: string, appClientId: string) {
  const result = await octokit.request( "POST /enterprises/{enterprise}/apps/organizations/{org}/installations " , { 
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