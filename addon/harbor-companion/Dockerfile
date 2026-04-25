ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

COPY app/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY app/ .

COPY rootfs /
RUN chmod a+x /etc/services.d/harbor-companion/run

CMD ["/etc/services.d/harbor-companion/run"]
