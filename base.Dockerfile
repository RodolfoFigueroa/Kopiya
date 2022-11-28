FROM node:19

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./

# RUN npm ci --only=production
RUN npm install

COPY ./src ./src
COPY ./script/index.js ./script/index.js

CMD ["node", "./script/index.js"]