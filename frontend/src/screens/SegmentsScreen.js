/**
 * SegmentsScreen — Upload audio, add question segments with time ranges,
 * view/generate sentences, and navigate to practice screens.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, getAudioUrl } from '../api/client';
import AudioPlayer from '../components/AudioPlayer';

export default function SegmentsScreen({ route, navigation }) {
  const { session: initialSession } = route.params;
  const [session, setSession] = useState(initialSession);
  const [segments, setSegments] = useState(initialSession.segments || []);
  const [loading, setLoading] = useState(false);

  // Segment form state
  const [qNumber, setQNumber] = useState('');
  const [startTime, setStartTime] = useState('');   // user types MM:SS
  const [endTime, setEndTime] = useState('');         // user types MM:SS

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [])
  );

  const refreshData = async () => {
    try {
      const [sess, segs] = await Promise.all([
        api.getSession(initialSession.id),
        api.listSegments(initialSession.id),
      ]);
      setSession(sess);
      setSegments(segs);
    } catch (e) {
      console.error('Refresh error:', e);
    }
  };

  // Parse "MM:SS" or "HH:MM:SS" → total seconds
  const parseTime = (text) => {
    const parts = text.trim().split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    if (parts.length === 3) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }
    return NaN;
  };

  // Format seconds → "MM:SS" for display
  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Upload audio file
  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setLoading(true);
      await api.uploadAudio(session.id, file.uri, file.name);
      await refreshData();
      Alert.alert('Success', 'Audio file uploaded.');
    } catch (e) {
      Alert.alert('Error', 'Failed to upload audio: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add a new segment
  const handleAddSegment = async () => {
    const qn = parseInt(qNumber, 10);
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (isNaN(qn) || isNaN(start) || isNaN(end)) {
      Alert.alert('Error', 'Please enter valid question number and times (MM:SS).');
      return;
    }
    if (start >= end) {
      Alert.alert('Error', 'Start time must be before end time.');
      return;
    }

    setLoading(true);
    try {
      await api.createSegment(session.id, {
        question_number: qn,
        start_time: start,
        end_time: end,
      });
      setQNumber('');
      setStartTime('');
      setEndTime('');
      await refreshData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add segment.');
    } finally {
      setLoading(false);
    }
  };

  // Generate sentences for a segment
  const handleGenerate = async (segmentId) => {
    setLoading(true);
    try {
      const sentences = await api.generateSentences(segmentId);
      console.log('[handleGenerate] parsed sentences array:', JSON.stringify(sentences));
      console.log('[handleGenerate] sentence count:', sentences.length);
      if (sentences.length > 0) {
        console.log('[handleGenerate] first sentence sample:', JSON.stringify(sentences[0]));
      }
      Alert.alert('Done', `Generated ${sentences.length} sentences.`);
      await refreshData();
      console.log('[handleGenerate] refreshData complete');
    } catch (e) {
      Alert.alert('Error', 'Failed to generate sentences: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSegment = ({ item }) => {
    const audioUrl = getAudioUrl(item.audio_file_path);
    const hasSentences = item.sentences && item.sentences.length > 0;

    console.log('[renderSegment] segment', item.id, 'hasSentences:', hasSentences, 'count:', item.sentences?.length || 0);
    if (hasSentences) {
      console.log('[renderSegment] sentences for rendering:', JSON.stringify(item.sentences.map(s => ({
        index: s.sentence_index,
        french_text: s.french_text,
        start_time: s.start_time,
        end_time: s.end_time,
      }))));
    }

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeText}>Q{item.question_number}</Text>
          </View>
          <Text style={styles.timeRange}>
            {formatSeconds(item.start_time)} — {formatSeconds(item.end_time)}
          </Text>
        </View>

        {/* Audio player */}
        {audioUrl && (
          <View style={styles.playerRow}>
            <AudioPlayer uri={audioUrl} />
          </View>
        )}

        {/* Generated sentences */}
        {hasSentences && (
          <View style={styles.sentencesSection}>
            <Text style={styles.sentencesLabel}>
              Sentences ({item.sentences.length})
            </Text>
            {item.sentences.map((s, idx) => (
              <View key={s.id || idx} style={styles.sentenceRow}>
                <Text style={styles.sentenceIdx}>#{idx + 1}</Text>
                <View style={styles.sentenceTextBlock}>
                  <Text style={styles.sentenceFrench}>{s.french_text || '(no text)'}</Text>
                  {s.start_time != null && s.end_time != null && (
                    <Text style={styles.sentenceTime}>
                      {formatSeconds(s.start_time)} — {formatSeconds(s.end_time)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {hasSentences ? (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('Sentences', {
                  segment: { ...item, session_id: session.id },
                })}
              >
                <Text style={styles.actionBtnText}>📝 句子跟读 ({item.sentences.length})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.passageBtn]}
                onPress={() => navigation.navigate('Passage', {
                  segment: { ...item, session_id: session.id },
                })}
              >
                <Text style={styles.actionBtnText}>🎧 整段</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.generateBtn]}
              onPress={() => handleGenerate(item.id)}
            >
              <Text style={styles.actionBtnText}>✨ Generate Sentences</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              Alert.alert('Delete', `Delete Q${item.question_number}?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive',
                  onPress: async () => {
                    await api.deleteSegment(item.id);
                    refreshData();
                  },
                },
              ]);
            }}
          >
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Session info bar */}
      <View style={styles.sessionBar}>
        <Text style={styles.sessionTitle}>{session.title}</Text>
        {session.audio_file_path ? (
          <Text style={styles.audioStatus}>🎵 Audio ready</Text>
        ) : (
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
            <Text style={styles.uploadBtnText}>📁 Upload Audio</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add segment form */}
      <View style={styles.addForm}>
        <Text style={styles.formTitle}>Add Question Segment</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, styles.qInput]}
            placeholder="Q#"
            placeholderTextColor="#aaa"
            value={qNumber}
            onChangeText={setQNumber}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.formInput}
            placeholder="Start (MM:SS)"
            placeholderTextColor="#aaa"
            value={startTime}
            onChangeText={setStartTime}
          />
          <TextInput
            style={styles.formInput}
            placeholder="End (MM:SS)"
            placeholderTextColor="#aaa"
            value={endTime}
            onChangeText={setEndTime}
          />
          <TouchableOpacity
            style={[styles.addBtn, loading && styles.btnDisabled]}
            onPress={handleAddSegment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addBtnText}>+</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Segment list */}
      <FlatList
        data={segments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSegment}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {session.audio_file_path
                ? 'Add question segments above to get started.'
                : 'Upload an audio file first, then add segments.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sessionBar: {
    backgroundColor: '#fff',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  audioStatus: {
    fontSize: 13,
    color: '#4caf50',
  },
  uploadBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 12,
    borderRadius: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  qInput: {
    flex: 0.4,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.5 },
  list: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  qBadge: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  timeRange: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  playerRow: {
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  generateBtn: {
    backgroundColor: '#fff3e0',
  },
  passageBtn: {
    flex: 0,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    fontSize: 13,
    color: '#1a73e8',
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  sentencesSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginBottom: 10,
  },
  sentencesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sentenceRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  sentenceIdx: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    width: 24,
    marginTop: 2,
  },
  sentenceTextBlock: {
    flex: 1,
  },
  sentenceFrench: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  sentenceTime: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
  },
});
