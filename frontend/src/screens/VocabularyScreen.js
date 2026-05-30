/**
 * VocabularyScreen — View, review, and manage saved vocabulary words.
 * Supports filtering by mastered status and quick review actions.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unmastered', label: 'Learning' },
  { key: 'mastered', label: 'Mastered' },
  { key: 'due', label: 'Due Today' },
];

export default function VocabularyScreen() {
  const [vocabList, setVocabList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadVocabulary();
    }, [filter])
  );

  const loadVocabulary = async () => {
    setLoading(true);
    try {
      let data;
      if (filter === 'due') {
        data = await api.getDueReviews();
      } else if (filter === 'mastered') {
        data = await api.listVocabulary('true');
      } else if (filter === 'unmastered') {
        data = await api.listVocabulary('false');
      } else {
        data = await api.listVocabulary();
      }
      setVocabList(data);
    } catch (e) {
      console.error('Load vocabulary error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (item, result) => {
    try {
      await api.reviewVocabulary(item.id, result);
      if (result === 'mastered') {
        setVocabList((prev) =>
          prev.map((v) => (v.id === item.id ? { ...v, is_mastered: true } : v))
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to log review.');
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete', `Remove "${item.word}" from vocabulary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteVocabulary(item.id);
            setVocabList((prev) => prev.filter((v) => v.id !== item.id));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }) => {
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, item.is_mastered && styles.cardMastered]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.wordCol}>
            <Text style={styles.wordText}>{item.word}</Text>
            <Text style={styles.translationText}>{item.translation || '—'}</Text>
          </View>

          {item.is_mastered ? (
            <View style={styles.masteredTag}>
              <Text style={styles.masteredTagText}>✓</Text>
            </View>
          ) : (
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          )}
        </View>

        {/* Expanded: show context + review buttons */}
        {isExpanded && (
          <View style={styles.expanded}>
            {item.context_sentence && (
              <View style={styles.contextBox}>
                <Text style={styles.contextLabel}>Context</Text>
                <Text style={styles.contextText}>"{item.context_sentence}"</Text>
              </View>
            )}

            <View style={styles.reviewRow}>
              {!item.is_mastered && (
                <>
                  <TouchableOpacity
                    style={[styles.reviewBtn, styles.forgotBtn]}
                    onPress={() => handleReview(item, 'forgot')}
                  >
                    <Text style={styles.reviewBtnText}>😕 Forgot</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.reviewBtn, styles.rememberedBtn]}
                    onPress={() => handleReview(item, 'remembered')}
                  >
                    <Text style={styles.reviewBtnText}>👍 Got it</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.reviewBtn, styles.masterBtn]}
                onPress={() => handleReview(item, 'mastered')}
              >
                <Text style={styles.reviewBtnText}>
                  {item.is_mastered ? 'Already Mastered' : '⭐ Mastered'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[styles.filterText, filter === f.key && styles.filterTextActive]}
            >
              {f.label}
            </Text>
            {f.key === 'due' && (
              <Text style={styles.filterCount}>
                {vocabList.length}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {vocabList.length} words
          {' · '}
          {vocabList.filter((v) => v.is_mastered).length} mastered
        </Text>
      </View>

      {/* Word list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={vocabList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {filter === 'due'
                  ? 'No words due for review today! 🎉'
                  : 'No vocabulary words yet. Tap words in the sentence practice screen to add them.'}
              </Text>
            </View>
          }
        />
      )}
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
  emptyText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 6,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#1a73e8',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Stats
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#999',
  },

  // Cards
  list: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardMastered: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordCol: {
    flex: 1,
  },
  wordText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a73e8',
  },
  translationText: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  masteredTag: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  masteredTagText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: '#bbb',
  },

  // Expanded
  expanded: {
    marginTop: 12,
  },
  contextBox: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  contextText: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  forgotBtn: {
    backgroundColor: '#ffebee',
  },
  rememberedBtn: {
    backgroundColor: '#e8f5e9',
  },
  masterBtn: {
    backgroundColor: '#fff3e0',
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
});
