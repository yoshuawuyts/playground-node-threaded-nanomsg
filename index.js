const summary = require('server-summary')
const cluster = require('cluster')
const nano = require('nanomsg')
const bole = require('bole')
const http = require('http')
const os = require('os')

const log = bole('main')

startCluster({
  ports: {
    http: 1337,
    ventilator: 7789,
    sink: 7790
  },
  ip: {
    ventilator: '127.0.0.1',
    sink: '127.0.0.1'
  },
  logLevel: 'debug'
})

function startCluster (config) {
  bole.output({ level: config.logLevel, stream: process.stdout })
  if (cluster.isMaster) {
    createServer(config)
    createCluster(config)
  } else {
    createWorker(config)
  }
}

function createServer (config) {
  const ventaddr = `tcp://${config.ip.ventilator}:${config.ports.ventilator}`
  const push = nano.socket('push')
  push.bind(ventaddr)

  const server = http.createServer(function (req, res) {
    req.pipe(push, { end: false })
    res.end()
  })
  server.listen(config.ports.http, summary(server))
}

function createCluster () {
  const numCPUs = os.cpus().length
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
}

function createWorker (config) {
  const pull = nano.socket('pull')
  const ventaddr = `tcp://${config.ip.ventilator}:${config.ports.ventilator}`
  pull.connect(ventaddr, { utf8: true })

  const pid = process.pid
  pull.on('data', function (str) {
    log.info(`worker: pid=${pid}, msg=${str}`)
  })
  log.info(`worker started, pid=${pid}`)
}
