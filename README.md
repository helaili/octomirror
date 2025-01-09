# Octomirror

Mirror an Enterprise on GitHub Enterprise Cloud with a GHES instance. 

## Environment Variables

- `ENTERPRISE_SLUG`: the slug of the Enterprise on the Cloud instance
- `APP_SLUG`: the slug of the octomirror app on the Cloud instance's Enterprise
- `APP_ID`: the app id of the octomirror app on the Cloud instance's Enterprise
- `CLIENT_ID`: the client id of the octomirror app on the Cloud instance's Enterprise
- `PRIVATE_KEY_FILE`: the path to file containing the private key of the octomirror app on the Cloud instance's Enterprise
- `DOTCOM_PAT`: a classic PAT on the Cloud instance with scopes `admin:org`, `audit_log`, `repo`. This will be removed once enterprise apps can access the audit log.
- `GHES_PAT`: the classic PAT that is used to create everything on the GHES instance. This should have `admin:enterprise`, `admin:org`, `repo`, `site_admin` and `workflow` scopes.
- `GHES_URL`: the URL of the GHES instance
- `GHES_OWNER`: the name of the owner of the repos created on the GHES instance
- `ENVIRONMENT`: Optional - set to `Development` to restrict the mirorring to the `TEST_ORG` organization
- `TEST_ORG`: Optional - only this org will be mirrored if `ENVIRONMENT` is set to `Development`

## Enterprise App

### Repository permissions
- Contents: Read only
- Metadata: Read only

### Organization permissions
- Administration: Read only

### Enterprise permissions
- Enterprise organization installation repositories: Read & write
-Enterprise organization installations: Read & write

## Usage

```bash
npm start init
```

or 

```bash
npm start sync 2024-10-01
```

