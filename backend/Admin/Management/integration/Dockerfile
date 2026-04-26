FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY test.js .
CMD ["node", "test.js"]