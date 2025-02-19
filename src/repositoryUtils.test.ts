import { describe, it, expect } from 'vitest';
import { extractOrgAndRepoFromURL, extractOrgAndRepoFromNWO } from './repositoryUtils.js';

describe('extractOrgAndRepo', () => {
  it('should extract org and repo from a valid URL', () => {
    const url = 'https://github.com/octodemo/codespace-oddity';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });
  
  it('should extract org and repo from a valid URL when the repo name has a dot', () => {
    const url = 'https://github.com/octodemo/.github-private';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toEqual({ org: 'octodemo', repo: '.github-private' });
  });
  
  it('should return undefined for an invalid URL', () => {
    const url = 'https://github.com/octodemo';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toBeUndefined();
  });

  it('should return undefined for a malformed URL', () => {
    const url = 'not-a-valid-url';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toBeUndefined();
  });

  it('should extract org and repo from a URL with subdirectories', () => {
    const url = 'https://github.com/octodemo/codespace-oddity/subdir';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });

  it('should extract org and repo from a URL with query parameters', () => {
    const url = 'https://github.com/octodemo/codespace-oddity?param=value';
    const result = extractOrgAndRepoFromURL(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });

  describe('extractOrgAndRepoFromURL', () => {
    it('should extract org and repo from a valid URL', () => {
      const url = 'https://github.com/octodemo/codespace-oddity';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
    });
    
    it('should extract org and repo from a valid URL when the repo name has a dot', () => {
      const url = 'https://github.com/octodemo/.github-private';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toEqual({ org: 'octodemo', repo: '.github-private' });
    });
    
    it('should return undefined for an invalid URL', () => {
      const url = 'https://github.com/octodemo';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toBeUndefined();
    });

    it('should return undefined for a malformed URL', () => {
      const url = 'not-a-valid-url';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toBeUndefined();
    });

    it('should extract org and repo from a URL with subdirectories', () => {
      const url = 'https://github.com/octodemo/codespace-oddity/subdir';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
    });

    it('should extract org and repo from a URL with query parameters', () => {
      const url = 'https://github.com/octodemo/codespace-oddity?param=value';
      const result = extractOrgAndRepoFromURL(url);
      expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
    });
  });

  describe('extractOrgAndRepoFromNWO', () => {
    it('should extract org and repo from a valid NWO', () => {
      const nwo = 'octodemo/codespace-oddity';
      const result = extractOrgAndRepoFromNWO(nwo);
      expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
    });

    it('should extract org and repo from a valid NWO with a dot in the repo name', () => {
      const nwo = 'octodemo/.github-private';
      const result = extractOrgAndRepoFromNWO(nwo);
      expect(result).toEqual({ org: 'octodemo', repo: '.github-private' });
    });

    it('should return undefined for an invalid NWO', () => {
      const nwo = 'octodemo';
      const result = extractOrgAndRepoFromNWO(nwo);
      expect(result).toBeUndefined();
    });

    it('should return undefined for a malformed NWO', () => {
      const nwo = 'not-a-valid-nwo';
      const result = extractOrgAndRepoFromNWO(nwo);
      expect(result).toBeUndefined();
    });

    it('should return undefined for an NWO with invalid characters', () => {
      const nwo = 'octodemo/invalid_repo!';
      const result = extractOrgAndRepoFromNWO(nwo);
      expect(result).toBeUndefined();
    });
  });
});