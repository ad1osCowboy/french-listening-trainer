/**
 * PassageScreen — Full-segment playback with speed control and looping.
 * Use this after practicing individual sentences to test comprehension.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getAudioUrl } from '../api/client';
import AudioPlayer from '../components/AudioPlayer';

const formatTimestamp = (seconds) => {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function PassageScreen({ route }) {
  const { segment } = route.params;
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(false);

  const audioUrl = getAudioUrl(segment.audio_file_path);

  useFocusEffect(
    useCallback(() => {
      loadSentences();
    }, [])
  );

  const loadSentences = async () => {
    try {
      setLoading(true);
      const data = await api.listSentences(segment.id);
      setSentences(data);
    } catch (e) {
      console.error('Load sentences error:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderSentence = ({ item, index }) => (
    <View style={[styles.sentenceRow, item.is_mastered && styles.masteredRow]}>
      <Text style={styles.sentenceNum}>{index + 1}</Text>
      <View style={styles.sentenceContent}>
        <Text style={styles.frenchText}>{item.french_text}</Text>
        {item.english_translation && (
          <Text style={styles.englishText}>{item.english_translation}</Text>
        )}
        <Text style={styles.timestampText}>
          Time: {formatTimestamp(item.start_time)}–{formatTimestamp(item.end_time)}
        </Text>
      </View>
      {item.is_mastered && <Text style={styles.checkMark}>✓</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Audio player section */}
      <View style={styles.playerSection}>
        <Text style={styles.segmentTitle}>
          Q{segment.question_number} — Full Passage
        </Text>

        {audioUrl ? (
          <AudioPlayer
            uri={audioUrl}
            showSpeedControls={true}
            showLoopControl={true}
          />
        ) : (
          <View style={styles.noAudio}>
            <Text style={styles.noAudioText}>No audio available for this segment.</Text>
            <Text style={styles.noAudioHint}>Upload audio and add this segment first.</Text>
          </View>
        )}
      </View>

      {/* Transcript section */}
      <View style={styles.transcriptSection}>
        <Text style={styles.transcriptTitle}>Transcript</Text>

        {loading ? (
          <ActivityIndicator size="small" color="#1a73e8" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={sentences}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSentence}
            contentContainerStyle={styles.transcriptList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No transcript yet. Generate sentences from the segment first.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  playerSection: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  noAudio: {
    padding: 20,
    alignItems: 'center',
  },
  noAudioText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  noAudioHint: {
    fontSize: 12,
    color: '#aaa',
  },
  transcriptSection: {
    flex: 1,
    padding: 16,
  },
  transcriptTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  transcriptList: {
    paddingBottom: 40,
  },
  sentenceRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    alignItems: 'flex-start',
    gap: 10,
  },
  masteredRow: {
    opacity: 0.6,
  },
  sentenceNum: {
    width: 24,
    fontSize: 12,
    fontWeight: '600',
    color: '#bbb',
    textAlign: 'center',
  },
  sentenceContent: {
    flex: 1,
  },
  frenchText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  englishText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#bbb',
    marginTop: 4,
  },
  checkMark: {
    fontSize: 14,
    color: '#4caf50',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
