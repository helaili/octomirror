import { describe, it, expect } from 'vitest';
import { extractOrgAndRepo } from './repository.js';

describe('extractOrgAndRepo', () => {
  it('should extract org and repo from a valid URL', () => {
    const url = 'https://github.com/octodemo/codespace-oddity';
    const result = extractOrgAndRepo(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });

  it('should return null for an invalid URL', () => {
    const url = 'https://github.com/octodemo';
    const result = extractOrgAndRepo(url);
    expect(result).toBeNull();
  });

  it('should return null for a malformed URL', () => {
    const url = 'not-a-valid-url';
    const result = extractOrgAndRepo(url);
    expect(result).toBeNull();
  });

  it('should extract org and repo from a URL with subdirectories', () => {
    const url = 'https://github.com/octodemo/codespace-oddity/subdir';
    const result = extractOrgAndRepo(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });

  it('should extract org and repo from a URL with query parameters', () => {
    const url = 'https://github.com/octodemo/codespace-oddity?param=value';
    const result = extractOrgAndRepo(url);
    expect(result).toEqual({ org: 'octodemo', repo: 'codespace-oddity' });
  });
});