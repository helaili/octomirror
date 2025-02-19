
export function extractOrgAndRepoFromURL(url: string): { org: string, repo: string } | undefined {
    // Find the owner and repo name from a url like https://github.com/octodemo/.github-private
    const regex = /https:\/\/[^\/]+\/([^\/]+)\/([^\/?]+)(\/.*)?/;
    const match = url.match(regex);
    
    if (match && match.length >= 3) {
      return { org: match[1], repo: match[2] };
    }
    
    return;
  }
  
  export function extractOrgAndRepoFromNWO(nwo: string): { org: string, repo: string } | undefined {
    // Find the owner and repo name from a url like octodemo/.github-private. 
    const regex = /^([^-][a-zA-Z0-9-]*[^-])\/([a-zA-Z0-9-.]+)$/;
    const match = nwo.match(regex);
    
    if (match && match.length === 3) {
      return { org: match[1], repo: match[2] };
    } 
    
    return;
  }
  