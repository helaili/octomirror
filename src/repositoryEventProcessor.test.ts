import { describe, it, expect, vi, afterEach } from 'vitest';
import { Octomirror } from './octomirror.js';
import { EnterpriseOctokit, RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from './types.js';
import { App } from '@octokit/app';
import * as RepositoriesModule from './repositories.js';
import { processRepositoryEvent } from './repositoryEventProcessor.js';

// Partially mock the module
vi.mock('./repositories.js', async () => {
  const originalModule = await vi.importActual<typeof RepositoriesModule>('./repositories.js');
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
            operation_type: 'create',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.createRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        });
        expect(RepositoriesModule.mirrorRepo).toHaveBeenCalledWith('https://dotcom.com/test-org/test-repo', 'https://ghes.com/test-org/test-repo');
    });

    it('should delete a repository on repo.destroy event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.destroy',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            operation_type: 'delete',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.deleteRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        });
        expect(RepositoriesModule.deleteMirror).toHaveBeenCalledWith({
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
            operation_type: 'rename',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.renameRepo).toHaveBeenCalledWith(ghesOctokit, {
            org: 'test-org',
            name: 'test-repo',
            visibility: 'public'
        }, 'old-repo');
        expect(RepositoriesModule.renameMirror).toHaveBeenCalledWith({
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
            operation_type: 'create',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.createRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.mirrorRepo).not.toHaveBeenCalled();
    });

    it('should log an error for invalid repository name on repo.destroy event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.destroy',
            org: 'test-org',
            repo: 'test-org/',
            visibility: 'public',
            operation_type: 'delete',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.deleteRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.deleteMirror).not.toHaveBeenCalled();
    });

    it('should log an error for invalid repository name on repo.rename event', async () => {
        const event: RepositoryRenameAuditLogEvent = {
            action: 'repo.rename',
            org: 'test-org',
            repo: 'test-org/',
            visibility: 'public',
            old_name: 'old-repo',
            operation_type: 'rename',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.renameRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.renameMirror).not.toHaveBeenCalled();
    });

    it('should log info for unknown event action', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'unknown.action',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            operation_type: 'create',
            created_at: 0,
            business: 'test-org'
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);

        expect(RepositoriesModule.createRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.deleteRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.renameRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.mirrorRepo).not.toHaveBeenCalled();
        expect(RepositoriesModule.deleteMirror).not.toHaveBeenCalled();
        expect(RepositoriesModule.renameMirror).not.toHaveBeenCalled();
    });
});
