FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

COPY package.json package-lock.json* ./

# Install ALL dependencies (including dev) for the build step
RUN npm ci && npm cache clean --force

COPY . .

# Generate Prisma client and build the app
RUN npx prisma generate
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
