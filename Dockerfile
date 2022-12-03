FROM node:19

WORKDIR /usr/src/app

COPY . .

RUN npm ci --only=production

ENTRYPOINT ["npm", "start"]