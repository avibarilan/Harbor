ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.11-alpine3.17
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

COPY app/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY app/ .

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]
