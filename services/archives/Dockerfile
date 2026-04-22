FROM node:20-alpine
WORKDIR /app
COPY package.json . 
RUN npm install
COPY . .
EXPOSE 5108
CMD ["npm", "start"]