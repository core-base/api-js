const WebsocketClient = require('./websocket-client.js')
const EventEmitter = require('eventemitter3')
const { randomBytes } = require('crypto')

module.exports = class LNMarketsWebsocket extends EventEmitter {
  constructor(opt = {}) {
    super()
    const { network } = opt

    this.ws = undefined
    this.network = network || 'mainnet'
    this.hostname =
      this.network === 'mainnet'
        ? 'api.lnmarkets.com'
        : 'api.testnet.lnmarkets.com'
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const WebsocketOptions = {
          url: `wss://${this.hostname}`,
        }
        this.ws = new WebsocketClient(WebsocketOptions)
      } catch (error) {
        return reject(error)
      }

      this.ws.onOpen = () => {
        this.emit('connected')
        resolve()
      }

      this.ws.onMessage = this._onMessage.bind(this)

      this.ws.connect()
    })
  }

  async _send({ request, id = null }) {
    // Set a random ID if none is sent
    Object.assign(request, {
      jsonrpc: '2.0',
      id: id || randomBytes(8).toString('hex'),
    })

    return new Promise((resolve, reject) => {
      try {
        const message = JSON.stringify(request)
        this.ws.send(message)

        const done = (response) => {
          this.removeListener(response.id, done)

          if (response.error) {
            reject(response.error)
          } else {
            resolve(response.result)
          }
        }

        this.on(request.id, done)
      } catch (error) {
        reject(error)
      }
    })
  }

  _onMessage(message) {
    try {
      const response = JSON.parse(message)
      if (response && response.id) {
        this.emit(response.id, response)
      } else {
        this.emit('message', response)
      }
    } catch (error) {
      console.error(error)
    }
  }

  subscribe({ params, id }) {
    const request = {
      method: 'subscribe',
      params,
    }

    return this._send({ request, id })
  }

  unsubscribe({ params, id }) {
    const request = {
      method: 'unsubscribe',
      params,
    }

    return this._send({ request, id })
  }

  listEvents() {
    const request = {
      method: '__listEvents',
    }

    return this._send({ request })
  }

  listMethods() {
    const request = {
      method: '__listMethods',
    }

    return this._send({ request })
  }

  terminate() {
    this.ws.terminate()
  }
}
