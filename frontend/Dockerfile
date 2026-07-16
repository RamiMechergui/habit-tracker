FROM node:22-alpine

ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

EXPOSE 5173

# Expose host to allow running in docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
