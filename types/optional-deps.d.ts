// Type declarations for optional dependencies not installed in the project

// MediaPipe (used by CVision body language analyzer)
declare module '@mediapipe/face_mesh' {
  export class FaceMesh {
    constructor(config?: any);
    setOptions(options: any): void;
    onResults(callback: (results: any) => void): void;
    send(inputs: any): Promise<void>;
    close(): void;
  }
}

declare module '@mediapipe/pose' {
  export class Pose {
    constructor(config?: any);
    setOptions(options: any): void;
    onResults(callback: (results: any) => void): void;
    send(inputs: any): Promise<void>;
    close(): void;
  }
}

declare module '@mediapipe/camera_utils' {
  export class Camera {
    constructor(videoElement: HTMLVideoElement, config: any);
    start(): Promise<void>;
    stop(): void;
  }
}

// AWS SDK (used by CVision SES email provider)
declare module '@aws-sdk/client-ses' {
  export class SESClient {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class SendEmailCommand {
    constructor(input: any);
  }
}

// Sentry (used by error reporter)
declare module '@sentry/nextjs' {
  export function init(options: any): void;
  export function isInitialized(): boolean;
  export function captureException(error: any, context?: any): string;
  export function captureMessage(message: string, level?: string): string;
  export function setUser(user: any): void;
  export function setTag(key: string, value: string): void;
  export function setExtra(key: string, value: any): void;
  export function withScope(callback: (scope: any) => void): void;
}

// Nodemailer (used by CVision email providers)
declare module 'nodemailer' {
  export interface Transporter {
    sendMail(options: any): Promise<any>;
    verify(): Promise<boolean>;
  }
  function createTransport(config: any): Transporter;
  export { createTransport };
  export default { createTransport };
}
