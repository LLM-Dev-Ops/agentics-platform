FROM node:20

WORKDIR /app

COPY packages/api/package*.json ./
RUN npm install

COPY packages/api/src ./src
COPY packages/api/tsconfig.json ./
COPY tsconfig.base.json ./

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "dist/index.js"]
