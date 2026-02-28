ARG PARENT_VERSION=2.10.3-node24.12.0
ARG PORT=3021

FROM defradigital/node-development:${PARENT_VERSION} AS development
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node-development:${PARENT_VERSION}

ENV TZ="Europe/London"

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

COPY --chown=node:node --chmod=755 package*.json ./
RUN npm install
COPY --chown=node:node --chmod=755 . .

CMD [ "npm", "run", "dev" ]

FROM development AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev

CMD [ "npm", "start" ]
