import { describe, it, expect, vi, afterEach } from 'vitest';
import { processTeamEvent } from './teamEventProcessor.js';
import { Octomirror } from './octomirror.js';
import * as teams from './teams.js';
import logger from './logger.js';
import { TeamAuditLogEvent, TeamMemberAuditLogEvent, TeamAddOrUpdateRepositoryAuditLogEvent, TeamRepositoryAuditLogEvent } from './types.js';
import { OctokitBroker } from './octokitBroker.js';

vi.mock('./teams');
vi.mock('./logger');

describe('processTeamEvent', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockBroker = { ghesOctokit: {} };
    const om: Octomirror = { 
        broker: mockBroker as any as OctokitBroker,
        ghesOwnerUser: 'ghe-admin'
    } as Octomirror;

    it('should create a team', async () => {
        const event: TeamAuditLogEvent = { action: 'team.create', team: 'org/team', org: 'org', created_at: 0};
        await processTeamEvent(om, event);
        expect(teams.createTeamFromAuditLog).toHaveBeenCalledWith(mockBroker, 'org', 'team', 'ghe-admin');
    });

    it('should log error for invalid team name on create', async () => {
        const event: TeamAuditLogEvent = { action: 'team.create', team: '', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(logger.error).toHaveBeenCalledWith('Invalid team name for team.create event: ');
    });

    it('should delete a team', async () => {
        const event: TeamAuditLogEvent = { action: 'team.destroy', team: 'org/team', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.deleteTeam).toHaveBeenCalledWith(mockBroker.ghesOctokit, 'org', 'team');
    });

    it('should log error for invalid team name on delete', async () => {
        const event: TeamAuditLogEvent = { action: 'team.destroy', team: '', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(logger.error).toHaveBeenCalledWith('Invalid team name for team.destroy event: ');
    });

    it('should log error for unsupported rename action', async () => {
        const event: TeamAuditLogEvent = { action: 'team.rename', team: 'org/team', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(logger.error).toHaveBeenCalledWith('Unsupported action. Team org/team needs to be manually renamed in org org');
    });

    it('should add a member to a team', async () => {
        const event: TeamMemberAuditLogEvent = { action: 'team.add_member', team: 'org/team', org: 'org', user: 'user', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.addMemberToTeam).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should remove a member from a team', async () => {
        const event: TeamMemberAuditLogEvent = { action: 'team.remove_member', team: 'org/team', org: 'org', user: 'user', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.removeMemberFromTeam).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should add a repository to a team', async () => {
        const event: TeamAddOrUpdateRepositoryAuditLogEvent = { action: 'team.add_repository', team: 'org/team', org: 'org', repo: 'repo', permission: 'write', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.addRepositoryToTeam).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should remove a repository from a team', async () => {
        const event: TeamRepositoryAuditLogEvent = { action: 'team.remove_repository', team: 'org/team', org: 'org', repo: 'repo', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.removeRepositoryFromTeam).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should update repository permission for a team', async () => {
        const event: TeamAddOrUpdateRepositoryAuditLogEvent = { action: 'team.update_repository_permission', team: 'org/team', org: 'org', repo: 'repo', permission: 'write', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.updateRepositoryPermission).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should change parent team', async () => {
        const event: TeamAuditLogEvent = { action: 'team.change_parent_team', team: 'org/team', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.changeParentTeam).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should change team privacy', async () => {
        const event: TeamAuditLogEvent = { action: 'team.change_privacy', team: 'org/team', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.changeTeamPrivacy).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should demote a maintainer', async () => {
        const event: TeamMemberAuditLogEvent = { action: 'team.demote_maintainer', team: 'org/team', org: 'org', user: 'user', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.demoteMaintainer).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should promote a maintainer', async () => {
        const event: TeamMemberAuditLogEvent = { action: 'team.promote_maintainer', team: 'org/team', org: 'org', user: 'user', created_at: 0 };
        await processTeamEvent(om, event);
        expect(teams.promoteMaintainer).toHaveBeenCalledWith(mockBroker, event);
    });

    it('should log info for unsupported action', async () => {
        const event: TeamAuditLogEvent = { action: 'unsupported.action', team: 'org/team', org: 'org', created_at: 0 };
        await processTeamEvent(om, event);
        expect(logger.info).toHaveBeenCalledWith('Ignoring event unsupported.action');
    });
});