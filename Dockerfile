FROM node:19-alpine

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./

# RUN npm ci --only=production
RUN npm install

COPY . .

CMD ["node", "index.js"]