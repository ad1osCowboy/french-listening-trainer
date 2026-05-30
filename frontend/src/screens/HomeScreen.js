/**
 * HomeScreen — Create listening sessions and view existing ones.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

export default function HomeScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Refresh sessions list when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the listening session.');
      return;
    }

    setLoading(true);
    try {
      const session = await api.createSession({
        title: title.trim(),
        youtube_url: youtubeUrl.trim() || null,
      });
      setTitle('');
      setYoutubeUrl('');
      navigation.navigate('Segments', { session });
    } catch (e) {
      Alert.alert('Error', 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (session) => {
    Alert.alert('Delete Session', `Delete "${session.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSession(session.id);
            loadSessions();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const renderSession = ({ item }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => navigation.navigate('Segments', { session: item })}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.sessionMeta}>
          {formatDate(item.created_at)}
          {item.audio_file_path ? '  🎵' : ''}
          {item.segments?.length ? `  ${item.segments.length} segments` : ''}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── New Session Form ──────────────────────────────────── */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>New Listening Session</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. TEF Blanc 2024 - Partie A'
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>YouTube URL (optional — placeholder for future)</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          placeholder="https://youtube.com/watch?v=..."
          placeholderTextColor="#ccc"
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          editable={false}
        />

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createBtnText}>
            {loading ? 'Creating...' : 'Create Session'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Existing Sessions ─────────────────────────────────── */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          My Sessions ({sessions.length})
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No sessions yet. Create one above to get started.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSession}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      {/* ── Vocabulary shortcut ───────────────────────────────── */}
      <TouchableOpacity
        style={styles.vocabFAB}
        onPress={() => navigation.navigate('Vocabulary')}
      >
        <Text style={styles.vocabFABText}>📖 生词本</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#ccc',
  },
  createBtn: {
    marginTop: 16,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  list: {
    paddingBottom: 60,
  },
  sessionCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
  },
  vocabFAB: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  vocabFABText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
