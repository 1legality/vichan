# Repository guidance

## Working conventions

- Write code, comments, documentation and commit messages in English.
- Keep changes focused on the requested behavior and preserve unrelated work.
- Inspect the current branch and working tree before editing. Stay on that branch unless the user requests a change.
- Follow existing application conventions. The development runtime is PHP 8.3, but `composer.json` still targets PHP 7.4; do not silently raise application requirements.

## macOS development

Read [docker/development.md](docker/development.md) for setup and restoration details. Use Apple's `container` CLI through `tools/dev.sh`; host PHP and Composer are not required.

- `./tools/dev.sh up`: start the local environment.
- `./tools/dev.sh down`: remove containers while preserving local data.
- `./tools/dev.sh restart`: recreate containers.
- `./tools/dev.sh build`: rebuild the PHP image; follow with `restart`.
- `./tools/dev.sh php <arguments>`: run PHP inside Linux.
- `./tools/dev.sh composer <arguments>`: run Composer inside Linux.
- `./tools/dev.sh rebuild`: regenerate board HTML and `main.js`.
- `./tools/dev.sh check`: check dependencies, services and HTTP.

The checkout is mounted read-only at `/code`; edit source on the Mac. Existing source edits become available immediately, but generated pages and JavaScript require `rebuild`. Adding or removing files in the repository root, `inc/` or `templates/` may require `restart` to refresh source links. Use the normal rebuild command when existing thread pages need updates; `--quick` skips them.

## Local data and restoration

- Never commit or force-add `restauration-vichan/`, `local-instances/`, credentials, database dumps or private instance configuration. Never print secrets in logs or command output.
- Keep backups and restored content out of source changes and container build contexts.
- Preserve the restored database, uploaded media, moderator accounts and original password salts.
- Do not run the fresh installer over a restored instance or reset persistent data as a troubleshooting shortcut.
- Keep `local-instances/apple/dev.env` with its persistent volumes; it contains the credentials needed to reuse them.

## Validation

- Run `git diff --check` and inspect the intended diff before committing. Stage only intended source and documentation paths.
- Lint changed PHP files using `./tools/dev.sh php -l /code/path/to/file.php`.
- Run `./tools/dev.sh check` for environment or integration changes.
- Rebuild generated output when needed, then inspect the affected page or behavior in the browser.
- Existing PHP warnings and deprecations are known in this legacy application. Distinguish them from new failures and keep unrelated compatibility changes separate.
- Report what was actually checked. Successful service checks do not establish that a user interaction works.
