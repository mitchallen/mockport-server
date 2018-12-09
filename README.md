# mockport-server

A mock port server for testing HTTP requests.

<a href="https://hub.docker.com/r/mitchallen/mockport-server/">
<img src="https://img.shields.io/badge/mitchallen-mockport--server-green.svg?logo=docker&style=for-the-badge" />
</a>

## Usage

There are two ways to use this project

1. Run locally 
2. Run as a docker container

* * *

## Running Locally

To run locally:

	npm start
	
This will echo the default mocks requests as curl commands.

### To test locally

Cut and paste some of the sample curl commands from the console into another terminal window.

For example, to issue one of the GET requests:

    curl "http://localhost:1234/pets/1"
    

### Test locally with a different mockfile


	MOCKFILE=./data/animal.json node src/index.js
    

* * *

## Running as a Docker Container

### Use a different mockfile

By fault the server will use its internal file:

	/usr/src/app/data/mock.json
	
The run command below shows how to map that folder to a local folder called **test/data**.

Before running the contain, create __test/data__ in your current folder.

Create the file __test/data/mock.json__

Run the container and the mocks should be picked up from your file.

See the example in the repo for what a mock.json file should look like.

* * *

### Pull the image from the repo

    docker pull mitchallen/mockport-server:latest

### Run the image locally as a container

There are two ways to run the container:

* In the background, using the -d (detached) flag
* Or in the foreground without it, to monitor console output.

__You will need to change the port in the examples echoed to the docker console.__

* * *

#### Run in the background

This example runs the server locally on port 7777 in the background.

    docker run -d -p 7777:1234 ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport
    
* * *
    
#### Run in the foreground

This example runs the server locally on port 7777 in the background.

It removes -d flag to monitor the console.

    docker run -p 7777:1234 ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport
    
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
    docker run -d -p 7777:1234 ${PWD}/test/data:/usr/src/app/data  --name mockport-server mitchallen/mockport

* * *

### Confirm the image is running

    docker ps
    
* * *

### Test with curl commands

Assumes container is running and set to port 7777.
 
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

    docker run -p 7001:1234 ${PWD}/test/data/srv1:/usr/src/app/data --name mock1 mitchallen/mockport

Open another terminal window to monitor the second container.

    docker run -p 7002:1234 ${PWD}/test/data/srv2:/usr/src/app/data --name mock2 mitchallen/mockport
    
They will look for and use these two files on you host machine:

    ${PWD}/test/data/srv1/mock.json
    ${PWD}/test/data/srv2/mock.json
    
* * *

### Automated Docker Builds

New builds of the image are created automatically using Docker Cloud.

To trigger a new build via a github tag I do the following (using v1.0.6 as an example):

*NOTE: using annotated tags didn't trigger a new build. Use the simpler format.*

Tags must match this format to trigger a build: /v[0-9.]+$/ 

    git checkout master
    git tag v1.0.6
    git push origin --tags

This triggers two new builds of the Docker image: __v1.0.6__ and __latest__

Docker Cloud:

* https://cloud.docker.com

My Docker Hub page:

* https://hub.docker.com/u/mitchallen/

Docker Hub page for this image

* https://hub.docker.com/r/mitchallen/mockport-server/

Docker Hub page for this images tags

* https://hub.docker.com/r/mitchallen/mockport-server/tags/

* * *

