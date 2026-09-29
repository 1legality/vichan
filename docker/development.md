# Developing vichan on a Mac

This workflow uses [Apple container](https://github.com/apple/container) to run PHP 8.3, nginx, MySQL 8.4 and Redis 7 on Linux. Edit this checkout with your usual Mac editor and test the application in your browser.

## Requirements

- A Mac with Apple silicon and macOS 26 or later.
- The `container` CLI installed from the [official Apple project](https://github.com/apple/container).
- The `jq`, `curl` and `openssl` commands available in your terminal.
- An Internet connection to download images and dependencies on the first run.

You do not need PHP, Composer or Docker Desktop on the Mac. Run the following commands from the repository root.

## First start

```sh
./tools/dev.sh up
```

The script starts the Apple container engine, builds the PHP image if missing and starts all four services. The first run takes longer because it downloads images and installs dependencies.

For a fresh instance, open the [local installer](http://127.0.0.1:9080/install.php) and follow its steps. `up` prepares the environment; it does not complete installation or restore an existing site. Importing a database and uploaded files is a separate step.

After installation, open the initial board [/b/](http://127.0.0.1:9080/b/) or the moderation panel at [mod.php](http://127.0.0.1:9080/mod.php). The site root may return HTTP 403 until a homepage theme is configured.

## Editing code

PHP and nginx mount the checkout read-only at `/code`. Edits to existing PHP, CSS and template files are immediately available inside the containers without rebuilding the image. Adding or removing files directly in the repository root, `inc/` or `templates/` may require `./tools/dev.sh restart`, because their source links are created at startup. Regenerate board HTML and `main.js` after changes that affect these generated files:

```sh
./tools/dev.sh rebuild
```

Instance configuration lives in `local-instances/apple/www/inc/instance-config.php`.

| Command | Purpose |
| --- | --- |
| `./tools/dev.sh up` | Start the environment. |
| `./tools/dev.sh down` | Stop and remove development containers while preserving data. |
| `./tools/dev.sh restart` | Recreate the containers with `down`, then `up`. |
| `./tools/dev.sh build` | Rebuild the PHP image after changing its dependencies or configuration. |
| `./tools/dev.sh status` | Show service status. |
| `./tools/dev.sh logs` | Show PHP logs. |
| `./tools/dev.sh logs php` | Show logs for `php`, `web`, `db` or `redis`. |
| `./tools/dev.sh shell` | Open a shell in the PHP container. |
| `./tools/dev.sh php <arguments>` | Run PHP in the container. |
| `./tools/dev.sh composer <arguments>` | Run Composer in the container. |
| `./tools/dev.sh rebuild` | Regenerate the instance's pages and JavaScript. |
| `./tools/dev.sh check` | Check the development environment. |

After `build`, run `restart` to use the new image. To check a PHP change, for example:

```sh
./tools/dev.sh php -l /code/post.php
./tools/dev.sh check
```

The `composer` command supports operations such as `install` and `check-platform-reqs`. Manage `composer.json` and `composer.lock` from the Mac checkout: their read-only mount prevents `composer update` from rewriting the lock file inside the container.

Page rebuilding has been tested locally with PHP 8.3. Existing PHP warnings and deprecation notices come from application code and dependencies; check their messages when working on compatibility.

To use a different local port, set it when starting or restarting:

```sh
VICHAN_DEV_PORT=9081 ./tools/dev.sh restart
```

The initial board is then available at `http://127.0.0.1:9081/b/`. Keep this environment variable set for subsequent commands.

## Local data

### Theme choices

A restored configuration may expose only Cyberpunk in the Style selector. To enable the bundled alternatives locally, add this override after the restored configuration is loaded in `local-instances/apple/www/inc/instance-config.php`:

```php
$config['stylesheets'] = array(
    'Cyberpunk' => 'cyberpunk.css',
    'Yotsuba B' => '',
    'Yotsuba' => 'yotsuba.css',
    'Futaba' => 'futaba.css',
    'Dark' => 'dark.css',
    'Photon' => 'photon.css',
);
```

Keep the restored `default_stylesheet` setting to retain Cyberpunk as the default. Rebuild the pages and JavaScript with `./tools/dev.sh rebuild`, then reload the page. Theme choices stay in the browser; the private instance configuration stays out of Git.

### Persistent instance files

The instance uses the Git-ignored `local-instances/apple/` directory:

- `www/` contains instance configuration, generated files, uploads and dependencies; it is mounted writable at `/var/www`.
- `dev.env` contains random MySQL and Redis credentials generated on the first run.

MySQL and Redis persist data in the Linux volumes `vichan-dev-db-data` and `vichan-dev-redis-data`. `down` and `restart` preserve these volumes and the local directory. Keep `dev.env` with the instance so it can reuse its credentials.

This local instance is separate from existing Docker Compose instances. It preserves the existing `.env` file and Compose configuration. These commands do not publish changes or modify a production site.

## Restoring an existing site

Keep backups in `restauration-vichan/`, which is excluded from Git and container build contexts. Import the SQL dump into a separate, empty database before selecting it in `local-instances/apple/dev.env`; keep the previous database and instance directory for rollback. Do not run the fresh installer over restored data.

Restore board directories, generated homepage files, `.installed` and the instance configuration. Preserve the original password salts and moderator accounts. Keep application source linked to the checkout and install Composer dependencies for that checkout. Initialize the JavaScript submodules with `git submodule update --init --recursive`.

Apply local database, Redis and executable-path overrides in the instance's `inc/instance-config.php`. Backups can reference server-only sockets, Nix paths or external secret files; adapt those references for the local containers. Use `./tools/dev.sh rebuild` to regenerate pages, then verify post counts, media and `./tools/dev.sh check`.
