# Octomirror

Mirror an Enterprise on GitHub Enterprise Cloud with a GHES instance. 

## Environment Variables

- `ENTERPRISE_SLUG`: the slug of the Enterprise on the Cloud instance
- `APP_SLUG`: the slug of the octomirror app on the Cloud instance's Enterprise
- `APP_ID`: the app id of the octomirror app on the Cloud instance's Enterprise
- `CLIENT_ID`: the client id of the octomirror app on the Cloud instance's Enterprise
- `PRIVATE_KEY_FILE`: the path to file containing the private key of the octomirror app on the Cloud instance's Enterprise
- `DOTCOM_PAT`: a classic PAT on the Cloud instance with scopes `scim:enterprise`, `admin:org`, `audit_log`, `repo`. This will be removed once enterprise apps can access the audit log and scim config.
- `GHES_PAT`: the classic PAT that is used to create everything on the GHES instance. This should have `admin:enterprise`, `admin:org`, `repo`, `delete_repo`, `site_admin` and `workflow` scopes.
- `GHES_URL`: the URL of the GHES instance
- `GHES_OWNER`: the name of the owner of the repos created on the GHES instance
- `ENVIRONMENT`: Optional - set to `Development` to restrict the mirorring to the `TEST_ORG` organization
- `TEST_ORG`: Optional - only this org will be mirrored if `ENVIRONMENT` is set to `Development`

## Configure SAML and SCIM on GHES

See https://docs.github.com/en/enterprise-server@3.15/admin/managing-iam/provisioning-user-accounts-with-scim/configuring-authentication-and-provisioning-with-entra-id

Make sure both Enteprise Applications in Entra ID have access to the same groups.

## Enterprise App

Create an enterprise app on the Cloud instance with the following permissions. Do not forget to also install the app on the Cloud instance's Enterprise.

### Repository permissions
- Contents: Read only
- Metadata: Read only

### Organization permissions
- Administration: Read only
- Members: Read & write
- Custom organization roles: Read only

### Enterprise permissions
- Enterprise organization installation repositories: Read & write
- Enterprise organization installations: Read & write

## Usage

```bash
npm start init
```

or 

```bash
npm start sync 2024-10-01
```

