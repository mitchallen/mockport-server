# mockport-server

A mock port server for testing HTTP requests.

[![CI](https://github.com/mitchallen/mockport-server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mitchallen/mockport-server/actions/workflows/ci.yml)
[![Docker image version](https://img.shields.io/docker/v/mitchallen/mockport-server?sort=semver&logo=docker&label=docker%20hub)](https://hub.docker.com/r/mitchallen/mockport-server/tags/)
[![Docker image size](https://img.shields.io/docker/image-size/mitchallen/mockport-server/latest?logo=docker&label=image%20size)](https://hub.docker.com/r/mitchallen/mockport-server/tags/)
[![Docker pulls](https://img.shields.io/docker/pulls/mitchallen/mockport-server?logo=docker)](https://hub.docker.com/r/mitchallen/mockport-server/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/github/license/mitchallen/mockport-server)](LICENSE)

## Usage

There are two ways to use this project

1. Run locally 
2. Run as a docker container

* * *

## Running Locally

Requires Node.js 20 or later.

	npm install
	npm start
	
This will echo the default mocks requests as curl commands.

There is also a `Makefile` covering the whole workflow — `make start`,
`make test`, `make run` and so on. Run `make help` for the list, or see
[Make targets](#make-targets).

### To test locally

Cut and paste some of the sample curl commands from the console into another terminal window.

For example, to issue one of the GET requests:

    curl "http://localhost:1234/pets/1"
    

### Test locally with a different mockfile

The mockfile is chosen with the `MOCKFILE` environment variable, which defaults
to `./data/mock.json`. The repo ships a second mockfile, `data/animal.json`, and
a script that uses it:

	npm run start:animal

which is the same as:

	MOCKFILE=./data/animal.json node src/index.js

### Environment variables

| Name | Default | Purpose |
| --- | --- | --- |
| `MOCKFILE` | `./data/mock.json` | Path to the mockfile to serve |
| `PORT` | `1234` | Port the server listens on |

For example, to serve the animal mocks on port 4321:

	MOCKFILE=./data/animal.json PORT=4321 npm start
    

* * *

## Mock file format

A mockfile is a JSON array of request/response pairs:

```json
[
    {
        "request": {
            "method": "GET",
            "url": "/pets/1"
        },
        "response": {
            "status": 200,
            "body": { "id": 1, "name": "Pepper" }
        }
    }
]
```

Notes on matching and defaults:

* `request.url` is matched **exactly**, including any query string. `/api/login?foo=bar` will not match a mock registered as `/api/login`.
* A `HEAD` route is registered automatically for every non-`HEAD` mock, so `curl -I` reports a sensible status.
* If `response.status` is omitted, a per-method default is used: `GET`/`HEAD` → 200, `POST` → 201, `PUT`/`PATCH`/`DELETE` → 204.
* A 204 status never returns a body, even if one is defined — that is what the `/pets/4` entry in `data/mock.json` demonstrates.
* Anything unmatched returns 404.
* Every request is echoed to the console — method, host, url, path, and any query string, body, or headers — so you can see exactly what the client under test sent.
* CORS is enabled for all origins, so a browser-based client can call the mock server directly.

### Mockfiles in the repo

| File | Mocks | Used by |
| --- | --- | --- |
| `data/mock.json` | `/pets/*` | `npm start`, and the image's built-in default |
| `data/animal.json` | `/animals/*` | `npm run start:animal` |
| `test/data/mock.json` | `/dogs/*` | the sample volume mount in the docker examples below |

All three are exercised by the test suite, so they cannot drift out of sync with the server.

* * *

## Development

Install dependencies and run the unit tests:

	npm install
	npm test

With coverage:

	npm run test:coverage

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every pull
request. It runs the tests on Node 20, 22 and 24, fails the build on an
`npm audit` finding of moderate or higher, and builds the Docker image and
curls a mock out of the running container.

### Make targets

A `Makefile` wraps the whole workflow. It is the quickest way to drive the
project without memorising docker flags:

	make help

| Target | What it does |
| --- | --- |
| `make install` | `npm ci` from the lockfile |
| `make test` | Run the unit tests |
| `make coverage` | Run the tests with coverage |
| `make audit` | Fail on known vulnerabilities, as CI does |
| `make check` | `test` + `audit` |
| `make start` | Run the server locally |
| `make start-animal` | Run locally against `data/animal.json` |
| `make build` | Build the docker image |
| `make run` | Build, then run the container detached |
| `make logs` | Follow the container's console output |
| `make stop` / `make rm` | Stop / remove the container |
| `make restart` | Recreate the container from the current image |
| `make ps` | Show the container's status |
| `make smoke` | Build the image and prove it serves a mock |
| `make ci` | Everything CI runs, locally |
| `make tag` | Tag a release (see [Publishing](#publishing-the-docker-image)) |
| `make clean` / `make distclean` | Remove build output / also `node_modules` and the image |

Targets that need dependencies install them first, so `make test` works from a
fresh clone. The install is stamped against the lockfile, so it only re-runs
when `package.json` or `package-lock.json` actually changes.

Anything worth changing is a variable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE` | `mitchallen/mockport-server` | Image name |
| `TAG` | `latest` | Image tag |
| `CONTAINER` | `mockport-server` | Container name |
| `HOST_PORT` | `7777` | Host port `make run` publishes |
| `PORT` | `1234` | Port inside the container |
| `MOUNT` | `$(PWD)/test/data` | Host dir mounted over `/usr/src/app/data` |
| `MOCKFILE` | unset | Mockfile for `make start` |

For example:

	make run HOST_PORT=8080
	make run MOUNT=                       # use the image's built-in mockfile
	make start MOCKFILE=./data/animal.json

`make smoke` mirrors the docker job in CI: it builds the image, starts a
container on its own name and port so it never disturbs one left running by
`make run`, waits for the server, curls a mock, and tears the container down
whether or not the check passed. It follows `MOUNT`, so it curls `/dogs/1`
against the mounted mockfile and `/pets/1` against the built-in one.

* * *

## Running as a Docker Container

The published image is built for `linux/amd64` and `linux/arm64`, runs as the
unprivileged `node` user, and declares a `HEALTHCHECK` — so `docker ps` reports
the container as healthy once the server answers. (The healthcheck hits an
unmocked path and accepts the 404: any HTTP response means the server is up.)

### Use a different mockfile

By default the server will use its internal file:

	/usr/src/app/data/mock.json
	
The run command below shows how to map that folder to a local folder called **test/data**.

Before running the container, create __test/data__ in your current folder.

Create the file __test/data/mock.json__

Run the container and the mocks should be picked up from your file.

See the example in the repo for what a mock.json file should look like.

Note that the copy in this repo, `test/data/mock.json`, mocks `/dogs/*` rather
than the `/pets/*` of the built-in file — that is how the examples below make it
obvious which mockfile the container actually picked up.

* * *

### Pull the image from the repo

    docker pull mitchallen/mockport-server:latest

### Build the image locally

    make build

or, equivalently:

    npm run docker:build

The raw `docker` commands in the sections below spell out what is happening.
`make build`, `make run`, `make stop`, `make rm` and `make restart` do the same
things with the ports and paths already filled in — see
[Make targets](#make-targets).

### Run the image locally as a container

There are two ways to run the container:

* In the background, using the -d (detached) flag
* Or in the foreground without it, to monitor console output.

__You will need to change the port in the examples echoed to the docker console.__

* * *

#### Run in the background

This example runs the server locally on port 7777 in the background.

    docker run -d -p 7777:1234 -v ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport-server
    
* * *
    
#### Run in the foreground

This example runs the server locally on port 7777 in the foreground.

It removes the -d flag to monitor the console.

    docker run -p 7777:1234 -v ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport-server
    
* * *

### Reattach to a container

Unless you remove the container you can't run it again.

You have to use the start command.

Use __-a__ flag to attach to the console to monitor output

    docker start -a mockport-server
    
* * *

### Rerun with the same or a new container

    docker stop mockport-server
    docker rm mockport-server
    docker run -d -p 7777:1234 -v ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport-server

* * *

### Confirm the image is running

    docker ps
    
* * *

### Test with curl commands

Assumes the container is running and mapped to port 7777.

With the `test/data` volume mounted, as in the run examples above:

    curl http://localhost:7777/dogs/1

Without a volume mount the container serves its built-in `data/mock.json`:

    curl http://localhost:7777/pets/1

* * *

### Start and stop a running container

    docker stop mockport-server

    docker start mockport-server
    
* * *

### Remove

#### Remove Container

    docker stop mockport-server
    docker rm mockport-server

### Remove Image

    docker stop mockport-server
    docker rm mockport-server
    docker rmi mitchallen/mockport-server
    
* * *

### Mock two containers

This example runs the two servers on ports 7001 and 7002.

    docker run -p 7001:1234 -v ${PWD}/test/data/srv1:/usr/src/app/data --name mock1 mitchallen/mockport-server

Open another terminal window to monitor the second container.

    docker run -p 7002:1234 -v ${PWD}/test/data/srv2:/usr/src/app/data --name mock2 mitchallen/mockport-server
    
They will look for and use these two files on your host machine:

    ${PWD}/test/data/srv1/mock.json
    ${PWD}/test/data/srv2/mock.json
    
* * *

### Publishing the Docker image

Earlier versions of this project were built automatically by Docker Cloud, which
Docker shut down in 2021. Publishing now runs in GitHub Actions
(`.github/workflows/publish.yml`), triggered by a version tag:

    git checkout main
    git tag v0.1.1
    git push origin --tags

That runs the tests, then builds and pushes `linux/amd64` and `linux/arm64`
images tagged `0.1.1`, `0.1` and `latest`. The most recent release is `v0.1.0`.

The tag must stay in step with the `version` in `package.json` — the server
echoes that version on startup, so a mismatch ships an image that misreports
itself. `make tag` enforces it:

    make tag VERSION=0.1.1

which refuses to tag unless `package.json` already says `0.1.1`. It creates the
tag but does not push it, since pushing is what triggers the publish — that
stays a deliberate, separate step:

    git push origin v0.1.1

#### One-time setup

The workflow needs Docker Hub credentials, under
__Settings > Secrets and variables > Actions__:

| Name | Kind | Value |
| --- | --- | --- |
| `DOCKERHUB_TOKEN` | secret | A Docker Hub access token with Read/Write scope |
| `DOCKERHUB_USERNAME` | variable | Docker Hub account (optional, defaults to `mitchallen`) |

Until `DOCKERHUB_TOKEN` is set the job skips with a notice instead of failing, so
tagging a release will not produce a red build.

To check the credentials without publishing, run the workflow by hand from the
__Actions__ tab (or `gh workflow run publish.yml`). A manual run is a dry run —
it logs in and builds both architectures, but only a `v*` tag actually pushes.

#### Publishing by hand

    make build
    docker tag mitchallen/mockport-server mitchallen/mockport-server:0.1.1
    docker push mitchallen/mockport-server:0.1.1
    docker push mitchallen/mockport-server:latest

Docker Hub page for this image

* https://hub.docker.com/r/mitchallen/mockport-server/

Docker Hub page for this image's tags

* https://hub.docker.com/r/mitchallen/mockport-server/tags/

* * *

## License

MIT — see [LICENSE](LICENSE).

The license covers this project's own code. It does not apply to any third
party assets that were imported into the project as a utility or for
demonstration purposes; contact the authors of those assets for their
licensing information.
