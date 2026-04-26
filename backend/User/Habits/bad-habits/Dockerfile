FROM node:20-alpine
WORKDIR /app
COPY package.json . 
RUN npm install
COPY . .
EXPOSE 5119
CMD ["npm", "start"]
