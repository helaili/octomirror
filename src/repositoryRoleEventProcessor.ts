import { RepositoryRoleAuditLogEvent } from './types.js';
import logger from './logger.js';
import { Octomirror } from './octomirror.js';
import { createRepositoryRole, updateRepositoryRole, deleteRepositoryRole } from './repositoryRoles.js';

export async function processRepositoryRoleEvent(om: Octomirror, event: RepositoryRoleAuditLogEvent) {
  switch(event.action) {
    case 'role.create':
      await createRepositoryRole(om.broker, event.org, event.name);
      break;
    case 'role.update':
      await updateRepositoryRole(om.broker, event.org, event.name);
      break;
    case 'role.destroy':
      await deleteRepositoryRole(om.broker, event.org, event.name);
      break;
    default:
      logger.info(`Ignoring event ${event.action}`);
      break;
  }
}
