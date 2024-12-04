import { describe, it, expect, vi, Mock } from 'vitest';
import { getInstallationToken } from './installation.js';
import { OctokitBroker } from './octokitBroker.js';
import { Installation, GetInstallationTokenResponse } from './types.js';

describe('getInstallationToken', () => {
  const broker = {
    installationOctokit: {
      request: vi.fn(),
      paginate: vi.fn()
    }
  } as unknown as OctokitBroker;

  const enterpriseSlug = 'test-enterprise';
  const orgLogin = 'test-org';
  const appSlug = 'test-app';
  const clientId = 'Iv12xxxxxxxxxx';

  it('should return installation token data when installation exists', async () => {
    const installation: Installation = { id: 123, app_slug: appSlug, client_id: clientId  };
    const tokenResponse: GetInstallationTokenResponse = {
      status: 201,
      data: {
        token: 'test-token',
        expires_at: '2024-11-27T15:19:54Z',
        permissions: {
          organization_administration: 'read',
          organization_events: 'read',
          contents: 'read',
          metadata: 'read'
        },
        repository_selection: 'all' 
      },
      headers: {},
      url: ''
    };

    (broker.installationOctokit.paginate as unknown as Mock).mockResolvedValue([installation]);
    (broker.installationOctokit.request as unknown as Mock).mockResolvedValue(tokenResponse);

    const result = await getInstallationToken(broker.installationOctokit, enterpriseSlug, orgLogin, appSlug);

    expect(result).toEqual(tokenResponse.data);
    expect(broker.installationOctokit.request).toHaveBeenCalledWith('POST /app/installations/{installation_id}/access_tokens', { installation_id: 123 });
  });

  it('should return undefined when installation does not exist', async () => {
    (broker.installationOctokit.paginate as unknown as Mock).mockResolvedValue([]);

    const result = await getInstallationToken(broker.installationOctokit, enterpriseSlug, orgLogin, appSlug);

    expect(result).toBeUndefined();
  });

});