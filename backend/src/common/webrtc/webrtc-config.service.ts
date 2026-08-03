/**
 * WebRTC Deep Dive Configuration with Recording and Screen Sharing
 * Implements TURN/STUN servers and SFU (Selective Forwarding Unit)
 * Handles WebRTC signaling, ICE candidates, and connection management
 * Enhanced with recording capabilities and screen sharing support
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  sfuUrl: string;
  stunServers: string[];
  turnServers: {
    urls: string[];
    username: string;
    credential: string;
  }[];
  maxVideoBitrate: number;
  maxAudioBitrate: number;
  enableRecording?: boolean;
  enableScreenSharing?: boolean;
}

export interface VideoCallConfig {
  roomId: string;
  patientToken: string;
  doctorToken: string;
  iceServers: RTCIceServer[];
  sfuUrl: string;
  recordingEnabled?: boolean;
  screenSharingEnabled?: boolean;
}

export interface RecordingConfig {
  enabled: boolean;
  format: 'webm' | 'mp4' | 'mkv';
  quality: 'low' | 'medium' | 'high';
  audioOnly: boolean;
  maxDuration: number; // seconds
  autoStart: boolean;
  storageLocation: string;
}

export interface ScreenShareConfig {
  enabled: boolean;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  audioEnabled: boolean;
}

export class WebRTCConfigService {
  /**
   * Get ICE server configuration
   * Includes STUN and TURN servers for NAT traversal
   */
  static getIceServers(): RTCIceServer[] {
    return [
      // Google STUN servers (free)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      
      // TURN servers for relay (required for symmetric NAT)
      {
        urls: process.env.TURN_SERVER_URL || 'turn:turn.telemedicine.com:3478',
        username: process.env.TURN_USERNAME || 'telemedicine',
        credential: process.env.TURN_CREDENTIAL || 'secret',
      },
      
      // Backup TURN server
      {
        urls: process.env.TURN_BACKUP_URL || 'turn:turn-backup.telemedicine.com:3478',
        username: process.env.TURN_USERNAME || 'telemedicine',
        credential: process.env.TURN_CREDENTIAL || 'secret',
      },
    ];
  }

  /**
   * Get SFU (Selective Forwarding Unit) configuration
   * SFU routes media streams between participants
   * Better than mesh for 1:1 calls, essential for group calls
   */
  static getSFUConfig(): { url: string; config: any } {
    return {
      url: process.env.SFU_URL || 'wss://sfu.telemedicine.com',
      config: {
        // SFU configuration options
        enableSimulcast: true, // Send multiple quality layers
        enableRed: true, // Redundant encoding for lossy networks
        enableFec: true, // Forward error correction
        maxVideoBitrate: 2000000, // 2 Mbps
        maxAudioBitrate: 128000, // 128 kbps
        videoCodecs: ['VP9', 'VP8', 'H264'],
        audioCodecs: ['Opus', 'PCMU'],
      },
    };
  }

  /**
   * Generate video call tokens for patient and doctor
   * Tokens authenticate users to the video room
   */
  static generateVideoCallTokens(appointmentId: string, options?: { recording?: boolean; screenSharing?: boolean }): VideoCallConfig {
    const roomId = `room_${appointmentId}`;
    
    // In production, use JWT tokens with proper signing
    const patientToken = this.generateToken(roomId, 'patient', appointmentId);
    const doctorToken = this.generateToken(roomId, 'doctor', appointmentId);

    return {
      roomId,
      patientToken,
      doctorToken,
      iceServers: this.getIceServers(),
      sfuUrl: process.env.SFU_URL || 'wss://sfu.telemedicine.com',
      recordingEnabled: options?.recording ?? true,
      screenSharingEnabled: options?.screenSharing ?? true,
    };
  }

  /**
   * Get recording configuration
   */
  static getRecordingConfig(): RecordingConfig {
    return {
      enabled: process.env.RECORDING_ENABLED === 'true',
      format: (process.env.RECORDING_FORMAT as 'webm' | 'mp4' | 'mkv') || 'webm',
      quality: (process.env.RECORDING_QUALITY as 'low' | 'medium' | 'high') || 'medium',
      audioOnly: process.env.RECORDING_AUDIO_ONLY === 'true',
      maxDuration: parseInt(process.env.RECORDING_MAX_DURATION || '3600'), // 1 hour default
      autoStart: process.env.RECORDING_AUTO_START === 'true',
      storageLocation: process.env.RECORDING_STORAGE_LOCATION || '/recordings',
    };
  }

  /**
   * Get screen sharing configuration
   */
  static getScreenShareConfig(): ScreenShareConfig {
    return {
      enabled: process.env.SCREEN_SHARING_ENABLED === 'true',
      frameRate: parseInt(process.env.SCREEN_SHARE_FRAME_RATE || '30'),
      resolution: {
        width: parseInt(process.env.SCREEN_SHARE_WIDTH || '1920'),
        height: parseInt(process.env.SCREEN_SHARE_HEIGHT || '1080'),
      },
      audioEnabled: process.env.SCREEN_SHARE_AUDIO === 'true',
    };
  }

  /**
   * Generate recording metadata
   */
  static generateRecordingMetadata(appointmentId: string, userId: string): any {
    return {
      recordingId: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      appointmentId,
      userId,
      timestamp: new Date().toISOString(),
      config: this.getRecordingConfig(),
    };
  }

  /**
   * Validate recording configuration
   */
  static validateRecordingConfig(config: RecordingConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.format || !['webm', 'mp4', 'mkv'].includes(config.format)) {
      errors.push('Invalid recording format');
    }

    if (!config.quality || !['low', 'medium', 'high'].includes(config.quality)) {
      errors.push('Invalid recording quality');
    }

    if (config.maxDuration <= 0 || config.maxDuration > 86400) {
      errors.push('Invalid max duration (must be between 1 and 86400 seconds)');
    }

    if (!config.storageLocation) {
      errors.push('Storage location is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get recording quality settings
   */
  static getRecordingQualitySettings(quality: 'low' | 'medium' | 'high'): any {
    const settings = {
      low: {
        videoBitrate: 500000, // 500 kbps
        audioBitrate: 64000, // 64 kbps
        frameRate: 15,
        resolution: { width: 640, height: 480 },
      },
      medium: {
        videoBitrate: 1500000, // 1.5 Mbps
        audioBitrate: 128000, // 128 kbps
        frameRate: 30,
        resolution: { width: 1280, height: 720 },
      },
      high: {
        videoBitrate: 3000000, // 3 Mbps
        audioBitrate: 192000, // 192 kbps
        frameRate: 30,
        resolution: { width: 1920, height: 1080 },
      },
    };

    return settings[quality];
  }

  /**
   * Start screen sharing session
   */
  static startScreenSharing(roomId: string, userId: string): any {
    const config = this.getScreenShareConfig();
    
    return {
      sessionId: `screen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId,
      config,
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Stop screen sharing session
   */
  static stopScreenSharing(sessionId: string): any {
    return {
      sessionId,
      stoppedAt: new Date().toISOString(),
      duration: 0, // Calculate actual duration
    };
  }

  /**
   * Generate authentication token for video room
   */
  private static generateToken(roomId: string, role: string, appointmentId: string): string {
    // In production, use JWT with proper signing
    const payload = {
      roomId,
      role,
      appointmentId,
      timestamp: Date.now(),
      exp: Date.now() + 3600000, // 1 hour expiry
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Validate video call token
   */
  static validateToken(token: string): any {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check expiry
      if (payload.exp < Date.now()) {
        throw new Error('Token expired');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get network quality thresholds
   * Used for adaptive bitrate streaming
   */
  static getNetworkQualityThresholds() {
    return {
      excellent: {
        bitrate: 2000000, // 2 Mbps
        rtt: 50, // 50ms
        packetLoss: 0.01, // 1%
      },
      good: {
        bitrate: 1000000, // 1 Mbps
        rtt: 100, // 100ms
        packetLoss: 0.03, // 3%
      },
      fair: {
        bitrate: 500000, // 500 kbps
        rtt: 200, // 200ms
        packetLoss: 0.05, // 5%
      },
      poor: {
        bitrate: 250000, // 250 kbps
        rtt: 500, // 500ms
        packetLoss: 0.1, // 10%
      },
    };
  }

  /**
   * Calculate quality score based on network metrics
   */
  static calculateQualityScore(
    bitrate: number,
    rtt: number,
    packetLoss: number,
  ): number {
    const thresholds = this.getNetworkQualityThresholds();
    
    let score = 100;
    
    // Bitrate score (0-40)
    if (bitrate >= thresholds.excellent.bitrate) {
      score += 0;
    } else if (bitrate >= thresholds.good.bitrate) {
      score -= 10;
    } else if (bitrate >= thresholds.fair.bitrate) {
      score -= 20;
    } else {
      score -= 30;
    }
    
    // RTT score (0-30)
    if (rtt <= thresholds.excellent.rtt) {
      score += 0;
    } else if (rtt <= thresholds.good.rtt) {
      score -= 10;
    } else if (rtt <= thresholds.fair.rtt) {
      score -= 20;
    } else {
      score -= 30;
    }
    
    // Packet loss score (0-30)
    if (packetLoss <= thresholds.excellent.packetLoss) {
      score += 0;
    } else if (packetLoss <= thresholds.good.packetLoss) {
      score -= 10;
    } else if (packetLoss <= thresholds.fair.packetLoss) {
      score -= 20;
    } else {
      score -= 30;
    }
    
    return Math.max(0, score);
  }

  /**
   * Get adaptive bitrate based on network quality
   */
  static getAdaptiveBitrate(qualityScore: number): number {
    if (qualityScore >= 80) return 2000000; // 2 Mbps
    if (qualityScore >= 60) return 1000000; // 1 Mbps
    if (qualityScore >= 40) return 500000; // 500 kbps
    return 250000; // 250 kbps
  }
}

/**
 * WebRTC Connection States
 */
export enum WebRTCConnectionState {
  NEW = 'new',
  CHECKING = 'checking',
  CONNECTED = 'connected',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISCONNECTED = 'disconnected',
  CLOSED = 'closed',
}

/**
 * ICE Gathering States
 */
export enum ICEGatheringState {
  NEW = 'new',
  GATHERING = 'gathering',
  COMPLETE = 'complete',
}

/**
 * Signaling Protocol for WebRTC
 */
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reconnect';
  roomId: string;
  userId: string;
  data?: any;
}

/**
 * ICE Candidate
 */
export interface ICECandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}
