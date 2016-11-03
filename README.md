## Kevoree NodeJS Runtime

### Install
Prefer a global install for this module as it is intended to be used as a client tool:
```sh
npm i -g kevoree-cli
```

Now we can start a new **Kevoree** JavaScript runtime from the command-line by using:
```sh
kevoree start
```

### Usage
Usage documentation is available by using the `-h` flag (or nothing):
```sh
kevoree -h
```
Outputs:
```
$ kevoree

  Usage: kevoree [options] [command]


  Commands:

    clean       Delete installed modules out of the cache folder
    init        Initialize Kevoree's config file
    start       Start a Kevoree Javascript runtime
    help [cmd]  display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

> To get more details about a command: `$ kevoree help <command>`
