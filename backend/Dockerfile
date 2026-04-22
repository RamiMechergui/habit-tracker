FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

# We use nodemon in dev
CMD ["npm", "run", "dev"]
