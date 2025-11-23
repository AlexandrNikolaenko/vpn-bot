FROM node:alpine as build

WORKDIR /usr/src/app
COPY package.json /usr/src/app
RUN npm install
RUN npm install --global pm2
COPY . /usr/src/app

EXPOSE 5000

CMD ["pm2-runtime", "bot.js"]