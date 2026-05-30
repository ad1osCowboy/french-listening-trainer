/**
 * SentencesScreen — Sentence-level listening and shadowing practice.
 *
 * Features per sentence:
 *  - French text + English translation
 *  - Audio playback (1x, 0.75x, loop)
 *  - Mark as mastered
 *  - Tap any word → add to vocabulary
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getAudioUrl } from '../api/client';
import AudioPlayer from '../components/AudioPlayer';

export default function SentencesScreen({ route, navigation }) {
  const { segment } = route.params;
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatTimestamp = (seconds) => {
    if (seconds == null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Word popup state
  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState(null);
  const [wordTranslation, setWordTranslation] = useState('');
  const [savingWord, setSavingWord] = useState(false);

  // Edit mode state
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [retranslatingId, setRetranslatingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadSentences();
    }, [])
  );

  const loadSentences = async () => {
    try {
      setLoading(true);
      const data = await api.listSentences(segment.id);

      // If no sentences yet, generate them
      if (data.length === 0) {
        const generated = await api.generateSentences(segment.id);
        setSentences(generated);
      } else {
        setSentences(data);
      }
    } catch (e) {
      console.error('Load sentences error:', e);
      Alert.alert('Error', 'Failed to load sentences.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle mastered status
  const handleMastered = async (sentence) => {
    try {
      const updated = await api.updateSentence(sentence.id, {
        is_mastered: !sentence.is_mastered,
      });
      setSentences((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update.');
    }
  };

  // Start editing a sentence
  const handleEdit = (sentence) => {
    console.log('Editing sentence:', sentence);
    setEditingId(sentence.id);
    setEditText(sentence.french_text || '');
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  // Save edited french_text
  const handleSave = async (sentence) => {
    if (!editText.trim()) {
      Alert.alert('Error', 'French text cannot be empty.');
      return;
    }
    try {
      const updated = await api.updateSentenceText(sentence.id, {
        french_text: editText.trim(),
        english_translation: sentence.english_translation,
      });
      setSentences((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setEditingId(null);
      setEditText('');
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes.');
      console.error('Save error:', e);
    }
  };

  // Retranslate (regenerate English from current French)
  const handleRetranslate = async (sentence) => {
    setRetranslatingId(sentence.id);
    try {
      const updated = await api.retranslateSentence(sentence.id);
      setSentences((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (e) {
      Alert.alert('Error', 'Translation failed.');
      console.error('Retranslate error:', e);
    } finally {
      setRetranslatingId(null);
    }
  };

  // Word tap → open vocab popup
  const handleWordTap = (word, sentence) => {
    const cleaned = word.replace(/[.,!?;:'"()«»-]/g, '');
    if (!cleaned) return;

    setSelectedWord(cleaned);
    setSelectedSentence(sentence);
    setWordTranslation('');
    setPopupVisible(true);
  };

  // Save word to vocabulary
  const handleSaveWord = async () => {
    if (!selectedWord) return;

    setSavingWord(true);
    try {
      await api.addVocabulary({
        word: selectedWord,
        translation: wordTranslation.trim() || null,
        context_sentence: selectedSentence?.french_text || null,
        sentence_segment_id: selectedSentence?.id || null,
      });
      setPopupVisible(false);
      Alert.alert('Saved', `"${selectedWord}" added to vocabulary.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save word.');
    } finally {
      setSavingWord(false);
    }
  };

  // Render individual words as tappable
  const renderTappableText = (text, sentence) => {
    if (!text) return null;
    const words = text.split(' ');
    return (
      <Text style={styles.frenchText}>
        {words.map((word, i) => (
          <Text key={i}>
            <Text
              style={styles.word}
              onPress={() => handleWordTap(word, sentence)}
            >
              {word}
            </Text>
            {i < words.length - 1 ? ' ' : ''}
          </Text>
        ))}
      </Text>
    );
  };

  const renderSentence = ({ item, index }) => {
    const audioUrl = getAudioUrl(item.audio_file_path);
    const isEditing = editingId === item.id;
    const isRetranslating = retranslatingId === item.id;

    return (
      <View style={[styles.card, item.is_mastered && styles.cardMastered]}>
        {/* Sentence index */}
        <View style={styles.cardHeader}>
          <Text style={styles.sentenceIdx}>#{index + 1}</Text>
          {item.is_mastered && (
            <View style={styles.masteredBadge}>
              <Text style={styles.masteredText}>✓ Mastered</Text>
            </View>
          )}
        </View>

        {/* French text */}
        <Text style={styles.labelText}>French:</Text>
        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
        ) : (
          <View style={styles.textBlock}>
            {renderTappableText(item.french_text, item)}
          </View>
        )}

        {/* English translation */}
        {item.english_translation && (
          <>
            <Text style={styles.labelText}>English:</Text>
            <Text style={styles.englishText}>{item.english_translation}</Text>
          </>
        )}

        {/* Timestamp */}
        <Text style={styles.timestampText}>
          Time: {formatTimestamp(item.start_time)}–{formatTimestamp(item.end_time)}
        </Text>

        {/* Audio player */}
        {audioUrl && (
          <View style={styles.playerRow}>
            <AudioPlayer
              uri={audioUrl}
              showSpeedControls={true}
              showLoopControl={true}
            />
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.actionSaveBtn} onPress={() => handleSave(item)}>
                <Text style={styles.actionSaveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCancelBtn} onPress={handleCancel}>
                <Text style={styles.actionCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retranslateBtn, isRetranslating && styles.btnDisabled]}
                onPress={() => handleRetranslate(item)}
                disabled={isRetranslating}
              >
                {isRetranslating ? (
                  <ActivityIndicator color="#1a73e8" size="small" />
                ) : (
                  <Text style={styles.retranslateBtnText}>Retranslate</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Mastered toggle */}
        <TouchableOpacity
          style={[styles.masteredBtn, item.is_mastered && styles.masteredBtnActive]}
          onPress={() => handleMastered(item)}
        >
          <Text style={styles.masteredBtnText}>
            {item.is_mastered ? '✓ 已掌握' : '○ 标记已掌握'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading sentences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sentences}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSentence}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No sentences yet.</Text>
          </View>
        }
      />

      {/* ── Word Popup Modal ───────────────────────────────────── */}
      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Vocabulary</Text>

            <Text style={styles.wordDisplay}>{selectedWord}</Text>

            {selectedSentence && (
              <Text style={styles.contextText}>
                "{selectedSentence.french_text}"
              </Text>
            )}

            <Text style={styles.modalLabel}>Translation (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter English translation..."
              placeholderTextColor="#aaa"
              value={wordTranslation}
              onChangeText={setWordTranslation}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPopupVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, savingWord && styles.btnDisabled]}
                onPress={handleSaveWord}
                disabled={savingWord}
              >
                {savingWord ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save to 生词本</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
  },
  list: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardMastered: {
    opacity: 0.7,
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sentenceIdx: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  masteredBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  masteredText: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: '600',
  },
  textBlock: {
    marginBottom: 8,
  },
  frenchText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#222',
  },
  word: {
    // Each word is individually tappable (no underline to keep it clean)
  },
  englishText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 12,
  },
  playerRow: {
    marginBottom: 10,
  },
  masteredBtn: {
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  masteredBtnActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  masteredBtnText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  btnDisabled: { opacity: 0.5 },

  // Edit mode styles
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    lineHeight: 28,
    color: '#222',
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a73e8',
    backgroundColor: '#fff',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a73e8',
  },
  retranslateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a73e8',
    backgroundColor: '#f0f6ff',
  },
  retranslateBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a73e8',
  },
  actionSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1a73e8',
  },
  actionSaveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  actionCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  wordDisplay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a73e8',
    marginBottom: 8,
  },
  contextText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
