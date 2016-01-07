## Kevoree NodeJS Runtime

### Install
Prefer a global install for this module as it is intended to be used that way:
```sh
npm i -g kevoree-nodejs-runtime
```

This will allow you to start a new **Kevoree** JavaScript runtime from the command-line by using:
```sh
kevoreejs
```

### Usage
Usage documentation is available by using the `-h` flag:
```sh
kevoreejs -h
```

**NB** You can override the Kevoree registry your runtime uses by specifying two ENV VAR:
```sh
KEVOREE_REGISTRY_HOST=localhost KEVOREE_REGISTRY_PORT=9000 kevoreejs
```
