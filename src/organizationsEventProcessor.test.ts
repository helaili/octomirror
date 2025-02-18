import { describe, it, expect, vi, Mock, afterEach } from 'vitest';
import { processOrganizationEvent } from './organizationsEventProcessor.js';
import { Octomirror } from './octomirror.js';
import { OrganizationAuditLogEvent, OrganizationRenameAuditLogEvent } from './types.js';
import { deleteOrg, processOrgCreation, renameOrg } from './organizations.js';
import logger from './logger.js';
import { OctokitBroker } from './octokitBroker.js';

vi.mock('./organizations');
vi.mock('./logger');


describe('processOrganizationEvent', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    });
    
    const mockBroker = { ghesOctokit: {}, otherProps: 'otherValues' };
    const mockAppClientId = 'mockAppClientId';
    const mockGhesOwnerUser = 'mockGhesOwnerUser';
    const om: Octomirror = {
        broker: mockBroker as any as OctokitBroker,
        appClientId: mockAppClientId,
        ghesOwnerUser: mockGhesOwnerUser,
    } as Octomirror;

    it('should process org.create event', async () => {
        const event: OrganizationAuditLogEvent = { action: 'org.create', org: 'testOrg', created_at: 0 };

        await processOrganizationEvent(om, event);

        expect(processOrgCreation).toHaveBeenCalledWith(mockBroker, mockAppClientId, 'testOrg', mockGhesOwnerUser);
    });

    it('should process org.delete event', async () => {
        const event: OrganizationAuditLogEvent = { action: 'org.delete', org: 'testOrg', created_at: 0 };

        await processOrganizationEvent(om, event);

        expect(deleteOrg).toHaveBeenCalledWith(mockBroker.ghesOctokit, 'testOrg');
    });

    it('should process org.rename event and rename the org', async () => {
        const event: OrganizationRenameAuditLogEvent = { action: 'org.rename', org: 'newOrg', old_login: 'oldOrg', created_at: 0 };
        (renameOrg as Mock).mockResolvedValue(200);

        await processOrganizationEvent(om, event);

        expect(renameOrg).toHaveBeenCalledWith(mockBroker.ghesOctokit, 'oldOrg', 'newOrg');
        expect(processOrgCreation).not.toHaveBeenCalled();
    });

    it('should process org.rename event and create the org if old org not found', async () => {
        const event: OrganizationRenameAuditLogEvent = { action: 'org.rename', org: 'newOrg', old_login: 'oldOrg', created_at: 0 };
        (renameOrg as Mock).mockResolvedValue(404);

        await processOrganizationEvent(om, event);

        expect(renameOrg).toHaveBeenCalledWith(mockBroker.ghesOctokit, 'oldOrg', 'newOrg');
        expect(processOrgCreation).toHaveBeenCalledWith(mockBroker, mockAppClientId, 'newOrg', mockGhesOwnerUser);
    });

    it('should log info for unknown event action', async () => {
        const event: OrganizationAuditLogEvent = { action: 'unknown.action', org: 'testOrg', created_at: 0 };

        await processOrganizationEvent(om, event);

        expect(logger.info).toHaveBeenCalledWith('Ignoring event unknown.action');
    });
});