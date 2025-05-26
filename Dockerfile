FROM node:22-slim

WORKDIR /app

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
