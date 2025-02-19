import { describe, it, expect, vi, afterEach } from 'vitest';
import { processRepositoryEvent } from './repositoryEventProcessor.js';
import { Octomirror } from './octomirror.js';
import { RepositoryAuditLogEvent, RepositoryRenameAuditLogEvent } from './types.js';
import { OctokitBroker } from './octokitBroker.js';
import * as repositories from './repositories.js';

vi.mock('./logger');
vi.mock('./repositories.js');

describe('processRepositoryEvent', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    });

    const mockBroker = { 
        ghesOctokit: {}, 
        getDotcomRepoUrl: vi.fn().mockResolvedValue('https://dotcom.com/test-org/test-repo'),
        getGhesRepoUrl: vi.fn().mockResolvedValue('https://ghes.com/test-org/test-repo')
    };
    const mockOctomirror: Octomirror = { 
        broker: mockBroker as any as OctokitBroker,
        ghesOwnerUser: 'ghe-admin'
    } as Octomirror;

    it('should create a repository on repo.create event', async () => {
        const event: RepositoryAuditLogEvent = {
            action: 'repo.create',
            org: 'test-org',
            repo: 'test-org/test-repo',
            visibility: 'public',
            created_at: 0
        };

        await processRepositoryEvent(mockOctomirror as any as Octomirror, event);
        expect(repositories.createRepo).toHaveBeenCalledWith(mockBroker.ghesOctokit, {
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

        expect(repositories.deleteRepo).toHaveBeenCalledWith(mockBroker.ghesOctokit, {
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

        expect(repositories.renameRepo).toHaveBeenCalledWith(mockBroker.ghesOctokit, {
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
