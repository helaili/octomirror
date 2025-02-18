import { TeamAuditLogEvent, TeamMemberAuditLogEvent, TeamAddOrUpdateRepositoryAuditLogEvent, TeamRepositoryAuditLogEvent } from "./types.js";
import { Octomirror } from "./octomirror.js";
import logger from './logger.js';
import { addMemberToTeam, addRepositoryToTeam, changeParentTeam, changeTeamPrivacy, createTeamFromAuditLog, deleteTeam, demoteMaintainer, promoteMaintainer, removeMemberFromTeam, removeRepositoryFromTeam, updateRepositoryPermission } from "./teams.js";

export async function processTeamEvent(om: Octomirror, event: TeamAuditLogEvent) {
  const teamName = event.team?.split('/').pop() || '';
  if(teamName === '') {
    logger.error(`Invalid team name for ${event.action} event: ${event.team}`);
    return;
  }
        
  switch(event.action) {
    case 'team.create':
      await createTeamFromAuditLog(om.broker, event.org, teamName, om.ghesOwnerUser);
      break;
    case 'team.destroy':
      await deleteTeam(om.broker.ghesOctokit, event.org, teamName);
      break;
    case 'team.rename':
      const teamRenameEvent = event as TeamAuditLogEvent;
      logger.error(`Unsupported action. Team ${teamRenameEvent.team} needs to be manually renamed in org ${teamRenameEvent.org}`);
      break;
    case 'team.add_member':
      await addMemberToTeam(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.remove_member':
      await removeMemberFromTeam(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.add_repository':
      await addRepositoryToTeam(om.broker, event as TeamAddOrUpdateRepositoryAuditLogEvent);
      break;
    case 'team.remove_repository':
      await removeRepositoryFromTeam(om.broker, event as TeamRepositoryAuditLogEvent);
      break;
    case 'team.update_repository_permission':
      await updateRepositoryPermission(om.broker, event as TeamAddOrUpdateRepositoryAuditLogEvent);
      break;
    case 'team.change_parent_team':
      await changeParentTeam(om.broker, event);
      break;
    case 'team.change_privacy':
      await changeTeamPrivacy(om.broker, event);
      break;
    case 'team.demote_maintainer':
      await demoteMaintainer(om.broker, event as TeamMemberAuditLogEvent);
      break;
    case 'team.promote_maintainer':
      await promoteMaintainer(om.broker, event as TeamMemberAuditLogEvent);
      break;
    default:
      logger.info(`Ignoring event ${event.action}`);
      break;
  }
}