import { Octomirror } from './octomirror.js';
import { OrganizationAuditLogEvent, OrganizationRenameAuditLogEvent } from './types.js';
import logger from './logger.js';
import { deleteOrg, processOrgCreation, renameOrg } from './organizations.js';

export async function processOrganizationEvent(om: Octomirror, event: OrganizationAuditLogEvent) {
  switch(event.action) {
    case 'org.create':
      await processOrgCreation(om.broker, om.appClientId, event.org, om.ghesOwnerUser);
      break;
    case 'org.delete':
      await deleteOrg(om.broker.ghesOctokit, event.org);
      break; 
    case 'org.rename': 
      const orgRenameEvent = event as OrganizationRenameAuditLogEvent;
      const httpStatus = await renameOrg(om.broker.ghesOctokit, orgRenameEvent.old_login, orgRenameEvent.org);
      if (httpStatus == 404) {
        // The old org wasn't found, let's create the new one
        processOrgCreation(om.broker, om.appClientId, event.org, om.ghesOwnerUser);
      }  
      break;
    default:
      logger.info(`Ignoring event ${event.action}`);
      break;
  }
}