import mqtt from 'mqtt'
import type { IClientOptions, MqttClient } from 'mqtt'

export interface MqttWireClientOptions {
  brokerUrl: string
  clientId: string
  username?: string
  password?: string
}

export interface MqttIncomingMessage {
  topic: string
  payloadText: string
}

export interface MqttWireClient {
  connect(): Promise<void>
  publish(topic: string, payloadText: string): Promise<void>
  subscribe(topics: string | string[]): Promise<void>
  onMessage(handler: (message: MqttIncomingMessage) => void): void
  disconnect(): Promise<void>
  isConnected(): boolean
}

export function createMqttWireClient(options: MqttWireClientOptions): MqttWireClient {
  let client: MqttClient | null = null
  let messageHandler: ((message: MqttIncomingMessage) => void) | null = null

  const connectOptions: IClientOptions = {
    clientId: options.clientId,
    username: options.username,
    password: options.password,
    reconnectPeriod: 1000,
    connectTimeout: 30_000,
    clean: true,
  }

  return {
    connect() {
      return new Promise((resolve, reject) => {
        client = mqtt.connect(options.brokerUrl, connectOptions)

        client.once('connect', () => {
          resolve()
        })

        client.once('error', (error) => {
          reject(error)
        })

        client.on('message', (topic, payload) => {
          messageHandler?.({
            topic,
            payloadText: payload.toString(),
          })
        })
      })
    },

    publish(topic: string, payloadText: string) {
      return new Promise((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client is not connected'))
          return
        }
        client.publish(topic, payloadText, { qos: 1 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },

    subscribe(topics: string | string[]) {
      return new Promise((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client is not connected'))
          return
        }
        client.subscribe(topics, { qos: 1 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },

    onMessage(handler: (message: MqttIncomingMessage) => void) {
      messageHandler = handler
    },

    disconnect() {
      return new Promise((resolve) => {
        if (!client) return resolve()
        client.end(true, {}, () => {
          client = null
          resolve()
        })
      })
    },

    isConnected() {
      return Boolean(client?.connected)
    },
  }
}
