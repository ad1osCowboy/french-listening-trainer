/**
 * Reusable audio player with play/pause, seekable progress bar,
 * speed controls (0.5x / 0.75x / 1x), and loop toggle.
 * Uses expo-av Audio.Sound API.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';

const SPEEDS = [0.5, 0.75, 1.0];

export default function AudioPlayer({
  uri,
  speed: speedProp,
  loop: loopProp = false,
  showSpeedControls = true,
  showLoopControl = false,
  onPlaybackStatus,
  onSpeedChange,
}) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(speedProp || 1.0);
  const [loop, setLoop] = useState(loopProp);

  const soundRef = useRef(null);
  const speedRef = useRef(speed);
  const isSeekingRef = useRef(false);

  // Sync speed prop if provided
  useEffect(() => {
    if (speedProp !== undefined && speedProp !== speed) {
      setSpeed(speedProp);
    }
  }, [speedProp]);

  useEffect(() => {
    speedRef.current = speed;
    if (soundRef.current && isPlaying) {
      soundRef.current.setRateAsync(speed, true);
    }
    if (onSpeedChange) onSpeedChange(speed);
  }, [speed]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setIsLoopingAsync(loop);
    }
  }, [loop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Load and play audio
  const loadAndPlay = useCallback(async () => {
    if (!uri) return;

    setIsLoading(true);
    setError(null);

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        {
          rate: speedRef.current,
          shouldCorrectPitch: true,
          isLooping: loop,
        },
        onPlaybackStatusUpdate,
      );

      soundRef.current = newSound;
      setSound(newSound);
      await newSound.playAsync();
      setIsPlaying(true);
    } catch (e) {
      console.error('Audio load error:', e, 'URI:', uri);
      setError('Audio error: ' + (e.message || String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [uri, loop]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      if (!isSeekingRef.current) {
        setPosition(status.positionMillis || 0);
      }
      setDuration(status.durationMillis || 0);

      if (status.didJustFinish) {
        setIsPlaying(false);
      }

      if (onPlaybackStatus) {
        onPlaybackStatus(status);
      }
    }
  }, [onPlaybackStatus]);

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (!soundRef.current) {
      await loadAndPlay();
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          if (status.didJustFinish) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (e) {
      console.error('Toggle play error:', e);
      setError('Playback error');
    }
  }, [loadAndPlay]);

  // Seek to position
  const seekTo = useCallback(async (ms) => {
    if (soundRef.current) {
      isSeekingRef.current = true;
      try {
        await soundRef.current.setPositionAsync(ms);
        setPosition(ms);
      } catch (e) {
        console.error('Seek error:', e);
      } finally {
        isSeekingRef.current = false;
      }
    }
  }, []);

  // Handle progress bar press for seeking
  const progressWidthRef = useRef(0);

  const handleProgressLayout = useCallback((evt) => {
    progressWidthRef.current = evt.nativeEvent.layout.width;
  }, []);

  const handleProgressPress = useCallback((evt) => {
    if (!duration) return;
    const barWidth = progressWidthRef.current || 200;
    const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / barWidth));
    seekTo(ratio * duration);
  }, [duration, seekTo]);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progressRatio = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.container}>
      {/* Play button + speed controls row */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.playBtn, isLoading && styles.btnDisabled]}
          onPress={togglePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>

        {/* Speed controls */}
        {showSpeedControls && (
          <View style={styles.speedGroup}>
            {SPEEDS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                onPress={() => setSpeed(s)}
              >
                <Text
                  style={[styles.speedBtnText, speed === s && styles.speedBtnTextActive]}
                >
                  {s === 1.0 ? '1x' : `${s}x`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loop toggle */}
        {showLoopControl && (
          <TouchableOpacity
            style={[styles.speedBtn, loop && styles.loopBtnActive]}
            onPress={() => setLoop((l) => !l)}
          >
            <Text style={[styles.speedBtnText, loop && styles.speedBtnTextActive]}>
              🔁 {loop ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <TouchableOpacity
          style={styles.progressBar}
          onPress={handleProgressPress}
          onLayout={handleProgressLayout}
          activeOpacity={0.8}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            <View
              style={[
                styles.progressThumb,
                { left: `${progressRatio * 100}%` },
              ]}
            />
          </View>
        </TouchableOpacity>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  playIcon: {
    color: '#fff',
    fontSize: 16,
  },
  speedGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  speedBtnActive: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  loopBtnActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  speedBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  speedBtnTextActive: {
    color: '#fff',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a73e8',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a73e8',
    position: 'absolute',
    marginLeft: -7,
    top: -4,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#888',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
  },
  errorText: {
    fontSize: 11,
    color: '#e53935',
  },
});
