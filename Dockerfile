FROM node:19

WORKDIR /usr/src/app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./src ./src
COPY ./script ./script
COPY ./index.js ./

RUN npm ci --only=production

ENTRYPOINT ["npm", "start"]