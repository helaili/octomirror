import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processRepositoryRoleEvent } from './repositoryRoleEventProcessor.js';
import { Octomirror } from './octomirror.js';
import { RepositoryRoleAuditLogEvent } from './types.js';
import * as repositoryRoles from './repositoryRoles.js';
import logger from './logger.js';

vi.mock('./repositoryRoles');
vi.mock('./logger');

describe('processRepositoryRoleEvent', () => {
    const mockBroker = {};
    const om: Octomirror = { broker: mockBroker } as Octomirror;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call createRepositoryRole when action is role.create', async () => {
        const event: RepositoryRoleAuditLogEvent = { action: 'role.create', org: 'test-org', name: 'test-role', base_role: 'read', created_at: 0 };
        
        await processRepositoryRoleEvent(om, event);

        expect(repositoryRoles.createRepositoryRole).toHaveBeenCalledWith(mockBroker, 'test-org', 'test-role');
    });

    it('should call updateRepositoryRole when action is role.update', async () => {
        const event: RepositoryRoleAuditLogEvent = { action: 'role.update', org: 'test-org', name: 'test-role', base_role: 'read', created_at: 0 };
        
        await processRepositoryRoleEvent(om, event);

        expect(repositoryRoles.updateRepositoryRole).toHaveBeenCalledWith(mockBroker, 'test-org', 'test-role');
    });

    it('should call deleteRepositoryRole when action is role.destroy', async () => {
        const event: RepositoryRoleAuditLogEvent = { action: 'role.destroy', org: 'test-org', name: 'test-role', base_role: 'read', created_at: 0 };
        
        await processRepositoryRoleEvent(om, event);

        expect(repositoryRoles.deleteRepositoryRole).toHaveBeenCalledWith(mockBroker, 'test-org', 'test-role');
    });

    it('should log info when action is unknown', async () => {
        const event: RepositoryRoleAuditLogEvent = { action: 'unknown.action', org: 'test-org', name: 'test-role', base_role: 'read', created_at: 0 };
        
        await processRepositoryRoleEvent(om, event);

        expect(logger.info).toHaveBeenCalledWith('Ignoring event unknown.action');
    });
});