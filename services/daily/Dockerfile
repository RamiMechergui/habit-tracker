FROM node:20-alpine
WORKDIR /app
COPY package.json . 
RUN npm install
COPY . .
EXPOSE 5105
CMD ["npm", "start"]