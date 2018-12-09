# docker build -t <your username>/mockport-server .
# docker run -d -p 7777:3002 -v ${PWD}/test/data:/usr/src/app/data --name mockport mitchallen/mockport-server

FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 1234

CMD [ "npm", "start" ]