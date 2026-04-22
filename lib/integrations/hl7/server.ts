import * as net from 'net';
import { processORU } from './oruProcessor';
import { EventEmitter } from 'events';
import { logger } from '@/lib/monitoring/logger';

const MLLP_START = '\x0B';
const MLLP_END = '\x1C\x0D';

export interface HL7ServerConfig {
  port: number;
  host?: string;
  applicationName: string;
  facilityName: string;
  onResult?: (result: any) => Promise<void>;
  onError?: (error: Error) => void;
}

export class HL7Server extends EventEmitter {
  private server: net.Server | null = null;
  private config: HL7ServerConfig;
  private connections: Set<net.Socket> = new Set();

  constructor(config: HL7ServerConfig) {
    super();
    this.config = config;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        this.config.onError?.(err);
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host || '0.0.0.0', () => {
        logger.info('HL7 Server listening', { category: 'system', port: this.config.port });
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const socket of this.connections) {
        socket.destroy();
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          logger.info('HL7 Server stopped', { category: 'system' });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleConnection(socket: net.Socket): void {
    this.connections.add(socket);
    let buffer = '';

    logger.info('HL7 connection established', { category: 'system', remoteAddress: socket.remoteAddress, remotePort: socket.remotePort });

    socket.on('data', async (data) => {
      buffer += data.toString();

      while (buffer.includes(MLLP_START) && buffer.includes(MLLP_END)) {
        const startIdx = buffer.indexOf(MLLP_START);
        const endIdx = buffer.indexOf(MLLP_END);

        if (startIdx < endIdx) {
          const message = buffer.substring(startIdx + 1, endIdx);
          buffer = buffer.substring(endIdx + 2);

          try {
            const result = processORU(message, {
              receivingApplication: this.config.applicationName,
              receivingFacility: this.config.facilityName,
            });

            const ackWithMLLP = MLLP_START + result.ackMessage + MLLP_END;
            socket.write(ackWithMLLP);

            if (result.success && result.results.length > 0) {
              this.emit('results', result.results);
              await this.config.onResult?.(result);
            }

            if (result.errors.length > 0) {
              this.emit('errors', result.errors);
            }
          } catch (error) {
            logger.error('Error processing HL7 message', { category: 'system', error });
            this.config.onError?.(error as Error);
          }
        } else {
          break;
        }
      }
    });

    socket.on('close', () => {
      this.connections.delete(socket);
      logger.info('HL7 connection closed', { category: 'system', remoteAddress: socket.remoteAddress });
    });

    socket.on('error', (err) => {
      logger.error('HL7 socket error', { category: 'system', error: err });
      this.connections.delete(socket);
    });
  }
}

let hl7ServerInstance: HL7Server | null = null;

export function getHL7Server(config?: HL7ServerConfig): HL7Server {
  if (!hl7ServerInstance && config) {
    hl7ServerInstance = new HL7Server(config);
  }
  return hl7ServerInstance!;
}
