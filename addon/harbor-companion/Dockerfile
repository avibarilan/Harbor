ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.11-alpine3.17
FROM $BUILD_FROM

ENV LANG C.UTF-8

WORKDIR /app

COPY app/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY app/ .

COPY rootfs/ /
