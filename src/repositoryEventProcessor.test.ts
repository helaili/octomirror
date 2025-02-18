import { describe, it, expect, vi, afterEach } from 'vitest';
import { Octomirror } from './octomirror.js';
import { EnterpriseOctokit, RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from './types.js';
import { App } from '@octokit/app';
import * as repositories from './repositories.js';
import { processRepositoryEvent } from './repositoryEventProcessor.js';

vi.mock('./logger');
// TODO: Why can't we mock the whole module?
vi.mock('./repositories', async () => {
  const originalModule = await vi.importActual('./repositories.js');
  return {
    ...originalModule,
    createRepo: vi.fn(),
    mirrorRepo: vi.fn(),
    deleteRepo: vi.fn(),
    deleteMirror: vi.fn(),
    renameRepo: vi.fn(),
    renameMirror: vi.fn()
  };
});

describe('processRepositoryEvent', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    });

    const installationOctokit  = {
        auth: 'installpat',
        baseUrl: `https://api.dotcom.com`,
    };
    const appInstallationOctokit = {
        auth: 'appinstallpat',
        baseUrl: `https://api.dotcom.com`,
    };
    const ghesOctokit = {
        auth: 'ghespat',
        baseUrl: `https://ghes.com/api/v3`,
        repos: {
            createInOrg: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        }
    };
    const dotcomOctokit = {
        auth: 'dotcompat',
        baseUrl: `https://api.dotcom.com`,
    };

    const mockOctomirror = {
        enterpriseSlug: 'enterpriseSlug',
        appSlug: 'appSlug',
        appClientId: 123,
        ghesOwnerUser: 'ghe-admin',
        initMirror: vi.fn(),
        resetMirror: vi.fn(),
        syncMirror: vi.fn(),
        processOrgReset: vi.fn(),
        broker: {
            app: new App({ appId: 123, privateKey: 'xxxx'}),
            appSlug: 'appSlug',
            enterpriseSlug: 'enterpriseSlug', 
            dotcomUrl: 'https://dotcom.com',
            dotcomApiUrl: 'https://api.dotcom.com',
            ghesPat: 'ghesPat', 
            ghesUrl: 'https://ghes.com', 
            octokitLogger : {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn()
            },
            installationTokens: new Map<string, string>(),
            ghesOctokit: ghesOctokit as any as EnterpriseOctokit,
            dotcomOctokit: dotcomOctokit as any as EnterpriseOctokit,
            installationOctokit: installationOctokit as any as EnterpriseOctokit,
            ready: vi.fn().mockResolvedValue(true),
            getAppInstallationOctokit: vi.fn().mockResolvedValue(appInstallationOctokit), 
            getDotcomRepoUrl: vi.fn().mockResolvedValue('https://dotcom.com/test-org/test-repo'),
            getGhesRepoUrl: vi.fn().mockResolvedValue('https://ghes.com/test-org/test-repo')
        }
    }

    it('should create a repository on repo.create event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.create',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            created_at: 0
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.createRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        });
        expect(repositories.mirrorRepo).toHaveBeenCalledWith('https://dotcom.com/test-org/test-repo', 'https://ghes.com/test-org/test-repo');
    });

    it('should delete a repository on repo.destroy event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.destroy',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            created_at: 0,
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.deleteRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        });
        expect(repositories.deleteMirror).toHaveBeenCalledWith({
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        });
    });

    it('should rename a repository on repo.rename event', async () => {
        const event: RepositoryRenameAuditLogEvent = {
            action: 'repo.rename',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            old_name: 'old-repo',
            created_at: 0,
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.renameRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        }, 'old-repo');
        expect(repositories.renameMirror).toHaveBeenCalledWith({
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        }, 'old-repo');
    });

    it('should log an error for invalid repository name on repo.create event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.create',
            org: 'test-org',
            repo: 'test-org/',
            visibility: 'public',
            created_at: 0,
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.createRepo).not.toHaveBeenCalled();
        expect(repositories.mirrorRepo).not.toHaveBeenCalled();
    });

    it('should log an error for invalid repository name on repo.destroy event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.destroy',
            org: 'test-org',
            repo: 'test-org/',
            visibility: 'public',
            created_at: 0,
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.deleteRepo).not.toHaveBeenCalled();
        expect(repositories.deleteMirror).not.toHaveBeenCalled();
    });

    it('should log an error for invalid repository name on repo.rename event', async () => {
        const event: RepositoryRenameAuditLogEvent = {
            action: 'repo.rename',
            org: 'test-org',
            repo: 'test-org/',
            visibility: 'public',
            old_name: 'old-repo',
            created_at: 0,
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.renameRepo).not.toHaveBeenCalled();
        expect(repositories.renameMirror).not.toHaveBeenCalled();
    });

    it('should log info for unknown event action', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'unknown.action',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            created_at: 0
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(repositories.createRepo).not.toHaveBeenCalled();
        expect(repositories.deleteRepo).not.toHaveBeenCalled();
        expect(repositories.renameRepo).not.toHaveBeenCalled();
        expect(repositories.mirrorRepo).not.toHaveBeenCalled();
        expect(repositories.deleteMirror).not.toHaveBeenCalled();
        expect(repositories.renameMirror).not.toHaveBeenCalled();
    });
});
