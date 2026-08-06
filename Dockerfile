# docker build -t <your username>/mockport-server .
# docker run -d -p 7777:1234 -v ${PWD}/test/data:/usr/src/app/data --name mockport-server mitchallen/mockport-server

FROM node:25-alpine

ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# npm ci installs exactly what the lockfile pins; --omit=dev keeps the
# test toolchain out of the image.
RUN npm ci --omit=dev && npm cache clean --force

# Bundle app source
COPY . .

# node:alpine ships an unprivileged "node" user - don't run as root.
USER node

EXPOSE 1234

# Any HTTP response means the server is up. An unmocked path returns 404,
# which is still a healthy answer for a mock server.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:1234/healthz',r=>process.exit(r.statusCode?0:1)).on('error',()=>process.exit(1))"

CMD [ "npm", "start" ]
