FROM python:3.12-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

CMD ["/bin/sh"]
