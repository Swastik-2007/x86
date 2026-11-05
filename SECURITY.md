# Security policy

Report vulnerabilities privately through GitHub's security advisory flow for this repository. Do not include real API keys, meeting audio, transcripts, or personal data in public issues.

## Deployment boundary

Manuscript's default server binds to `0.0.0.0:3001` for local-network and VM demos. It does not provide authentication and enables extension-friendly CORS. Do not expose it directly to the public internet. Use a firewall or an authenticated TLS reverse proxy and restrict access to trusted users.

Provider and export credentials are stored in `.data/config.json` (or `MANUSCRIPT_DATA_DIR`). Protect that directory with host filesystem permissions, exclude it from backups that are not encrypted, and rotate any key that may have been disclosed.

The extension requests tab capture only after an explicit click and uploads recordings only to the backend URL configured in its popup. Review that URL before recording sensitive meetings.
