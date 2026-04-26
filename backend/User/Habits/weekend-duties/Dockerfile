FROM node:20-alpine
WORKDIR /app
COPY package.json . 
RUN npm install
COPY . .
EXPOSE 5121
CMD ["npm", "start"]
