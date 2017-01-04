FROM        mhart/alpine-node:6.9.1
MAINTAINER  Maxime Tricoire <max.tricoire@gmail.com> (@maxleiko)

WORKDIR     /root

RUN         apk add --no-cache make g++ python && \
            npm i -g kevoree-cli node-gyp && \
            npm cache clean

COPY        ./config.json /root/.kevoree/config.json

ENTRYPOINT  ["kevoree"]
CMD         ["start"]
